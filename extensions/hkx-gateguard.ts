type ToolName = "edit" | "write" | "ast_grep_replace" | "bash" | string;

type ToolCallEvent = {
	toolName: ToolName;
	input?: Record<string, unknown>;
};

type ToolCallBlockResult = {
	block: true;
	reason: string;
};

type ExtensionRuntime = {
	on(
		event: "tool_call",
		handler: (
			event: ToolCallEvent,
		) =>
			| ToolCallBlockResult
			| undefined
			| Promise<ToolCallBlockResult | undefined>,
	): void;
};

type ExtensionFactory = (pi: ExtensionRuntime) => void;

/**
 * HKX GateGuard — destructive-command hard gate for Pi.
 *
 * A `tool_call` hook that blocks destructive shell commands. The former
 * first-edit-per-file interception was retired (see skills/gateguard/SKILL.md):
 * a 2026-08 A/B retest on current models measured zero score gap (8.5 vs 8.5),
 * while every first edit paid a wasted round-trip.
 *
 * Disable per-session: set `HKX_GATEGUARD=off` in the environment.
 *
 * Destructive detection runs on a masked view of the command: quoted strings
 * and heredoc bodies are removed so commands merely *mentioning* destructive
 * text (regex sources, echoed docs) are not blocked. When the remaining
 * skeleton contains an eval-invoker (`bash -c`, `node -e`, `psql -c`, …) the
 * masked fragments are scanned as well, so `bash -c 'rm -rf build/'` stays
 * blocked while `echo "git reset --hard"` passes.
 *
 * Artifact exception (chain review outputs):
 * Paths under a real `.pi-subagents/` directory segment (chain-runs + artifacts)
 * are pre-authorized after path normalization (rejects `..` escapes and
 * substring false positives like `evil.pi-subagents/`).
 *
 * Bash: destructive detection always runs first. Artifact bash short-circuit
 * only applies to non-destructive commands that clearly write into
 * `.pi-subagents/` path segments — compound `write-artifact && rm -rf src`
 * stays blocked.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Count of full denials emitted this session; later denials are condensed. */
let denialCount = 0;

/** Max full denials before switching to condensed single-line messages. */
const MAX_FULL_DENIALS = 3;

/** Path-segment boundary for the runtime artifact directory. */
const ARTIFACT_DIR_SEGMENT = ".pi-subagents";

// ---------------------------------------------------------------------------
// Helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export function isEnabled(): boolean {
	const env = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process?.env;
	const v = env?.HKX_GATEGUARD?.toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "disabled";
}

/**
 * Collapse `.` / `..` path segments without requiring the path to exist.
 * Returns null when the path would escape above its relative root via `..`.
 */
export function normalizePathSegments(filePath: string): string | null {
	const n = filePath.replace(/\\/g, "/");
	const isAbs = n.startsWith("/");
	const parts = n.split("/");
	const stack: string[] = [];
	for (const part of parts) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (stack.length === 0) return null;
			stack.pop();
			continue;
		}
		stack.push(part);
	}
	const joined = stack.join("/");
	if (isAbs) return `/${joined}`;
	return joined;
}

/**
 * True when the normalized path contains a full directory segment
 * `.pi-subagents` (not a substring of another name).
 *
 * Rejects:
 * - `evil.pi-subagents/foo` (name collision)
 * - `.pi-subagents/../scripts/x` (traversal out of artifact tree)
 * - empty / non-string
 */
export function isSubagentArtifactPath(filePath: string): boolean {
	if (typeof filePath !== "string" || !filePath.trim()) return false;
	const normalized = normalizePathSegments(filePath);
	if (normalized === null) return false;
	const segments = normalized.split("/").filter((s) => s.length > 0);
	return segments.includes(ARTIFACT_DIR_SEGMENT);
}

/**
 * True when a bash command performs a clear write into a `.pi-subagents/`
 * path segment and is not destructive.
 *
 * Order contract (MF1): callers must still run `isDestructiveCommand` first;
 * this helper also returns false for destructive commands as defense in depth.
 *
 * Requires path-segment boundary (not `evil.pi-subagents/`).
 */
export function isSubagentArtifactBashWrite(command: string): boolean {
	if (typeof command !== "string" || !command.includes(ARTIFACT_DIR_SEGMENT)) {
		return false;
	}
	// MF1 defense-in-depth: never classify destructive compounds as artifact-only.
	if (isDestructiveCommand(command)) return false;

	// Path-segment boundary: `/ .pi-subagents/` or start-of-string `.pi-subagents/`
	// or quote-delimited. Rejects `evil.pi-subagents/`.
	const artifactPath =
		/(?:^|[\s"'`=])\.pi-subagents\//.test(command) ||
		/\/\.pi-subagents\//.test(command);
	if (!artifactPath) return false;

	const writesArtifact =
		/>\s*['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command) ||
		/>>\s*['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command) ||
		/tee\s+['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command) ||
		/\bcp\s+[^\n]*\/\.pi-subagents\//.test(command) ||
		/\bcp\s+[^\n]*(?:^|[\s"'`])\.pi-subagents\//.test(command) ||
		/\binstall\s+[^\n]*\.pi-subagents\//.test(command) ||
		/\bmkdir\s+(-p\s+)?['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command);
	return writesArtifact;
}

const DESTRUCTIVE_PATTERNS = [
	/\brm\s+(-[rfirvRF]*\s+)*(?!\/tmp\/)/,
	/\bgit\s+checkout\s+(-f|--force|--)\s/,
	/\bgit\s+reset\s+--hard/,
	/\bgit\s+clean\s+-[fF]/,
	/\bgit\s+push\s+.*--force/,
	/\bgit\s+branch\s+-[dD]/,
	/\bgit\s+tag\s+-d/,
	/\bgit\s+rebase\s+.*--abort/,
	/\bgit\s+stash\s+drop/,
	/\bdrop\s+(table|database|index)\b/i,
	/\bdelete\s+from\b/i,
	/\btruncate\b/i,
	/\bmkfs\b/,
	/\bdd\s+.*of=/,
	/\bformat\b/,
	/\bkill\s+-9\b/,
	/\bpkill\b/,
	/\bsudo\s+rm\b/,
];

const EVAL_INVOKERS = [
	/\b(?:ba|z)?sh\s+(?:-\w+\s+)*-c\b/,
	/\beval\b/,
	/\bnode\s+(?:-\w+\s+)*-e\b/,
	/\bpython[0-9.]*\s+(?:-\w+\s+)*-c\b/,
	/\bperl\s+(?:-\w+\s+)*-e\b/,
	/\bpsql\s+(?:-\w+\s+)*-c\b/,
];

function matchesDestructive(text: string): boolean {
	return DESTRUCTIVE_PATTERNS.some((re) => re.test(text));
}

/**
 * Mask quoted spans and heredoc bodies, returning the remaining skeleton plus
 * the removed fragments. Quoted/backtick regex-source literals (e.g.
 * `const re = /\brm\s+/` inside `node -e '...'`) must not trip destructive
 * detection; see scripts/tests/gateguard-selfmatch.mjs.
 */
export function maskCommandLiterals(command: string): {
	skeleton: string;
	fragments: string[];
} {
	const fragments: string[] = [];
	let text = String(command);

	// Heredocs: <<TAG ... \nTAG (quoted or plain tag, optional `-`).
	text = text.replace(
		/<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n\s*\1(?=\n|$)/g,
		(_m, _tag, body: string) => {
			fragments.push(body);
			return "<<MASKED";
		},
	);

	// Quoted spans (single, double, backtick), backslash escapes honored.
	text = text.replace(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g, (_m, _q, body: string) => {
		fragments.push(body);
		return " ";
	});

	return { skeleton: text, fragments };
}

export function isDestructiveCommand(command: string): boolean {
	if (typeof command !== "string" || !command) return false;
	const { skeleton, fragments } = maskCommandLiterals(command);
	if (matchesDestructive(skeleton)) return true;
	// Quoted destructive text is inert unless an eval-invoker re-executes it
	// (`bash -c 'rm -rf x'`, `psql -c "drop table t"` stay blocked).
	if (
		EVAL_INVOKERS.some((re) => re.test(skeleton)) &&
		fragments.some(matchesDestructive)
	) {
		return true;
	}
	return false;
}

function gateMessage(): string {
	denialCount++;
	if (denialCount > MAX_FULL_DENIALS) {
		return `[GateGuard #${denialCount}] Destructive command blocked. Investigate target scope before retrying.`;
	}
	return [
		`[GateGuard] Destructive command blocked.`,
		`Before running:`,
		`1. What files, data, branches, services, or accounts can be modified?`,
		`2. Is the target local, test, staging, or production?`,
		`3. What rollback or recovery path exists?`,
		`4. What exact user instruction authorizes this action?`,
	].join("\n");
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const extension: ExtensionFactory = (pi) => {
	pi.on("tool_call", async (event) => {
		if (!isEnabled()) return undefined;

		const { toolName, input } = event;
		const rawInput = (input ?? {}) as Record<string, unknown>;

		// --- Bash: destructive first (MF1), then artifact-only allow ---
		if (toolName === "bash") {
			const command =
				typeof rawInput.command === "string" ? rawInput.command : "";
			if (!command) return undefined;

			// MF1: never short-circuit past destructive detection.
			if (isDestructiveCommand(command)) {
				return {
					block: true,
					reason: gateMessage(),
				};
			}

			// Non-destructive artifact-only shell writes are pre-authorized.
			if (isSubagentArtifactBashWrite(command)) {
				return undefined;
			}

			return undefined;
		}

		return undefined;
	});
};

export default extension;
