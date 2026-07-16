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
 * HKX GateGuard — fact-forcing pre-action gate for Pi.
 *
 * A `tool_call` hook that blocks first edit/write/ast_grep_replace per file and
 * destructive commands, demanding concrete investigation facts before
 * allowing the action to proceed.
 *
 * Disable per-session: set `HKX_GATEGUARD=off` in the environment.
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

/** Files that have been investigated (tool_call seen or explicitly allowed). */
const investigatedFiles = new Set<string>();

/** Count of full denials emitted this session; later denials are condensed. */
let denialCount = 0;

/** Max full denials before switching to condensed single-line messages. */
const MAX_FULL_DENIALS = 3;

const MUTATING_TOOL_NAMES = new Set<ToolName>([
	"edit",
	"write",
	"ast_grep_replace",
]);

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

export function extractFilePath(
	input: Record<string, unknown>,
): string | undefined {
	const candidates = [input.path, input.file_path, input.filePath, input.file];
	for (const c of candidates) {
		if (typeof c === "string" && c.trim()) return c;
	}
	if (Array.isArray(input.edits)) {
		for (const edit of input.edits) {
			if (edit && typeof edit === "object") {
				const p =
					(edit as Record<string, unknown>).path ??
					(edit as Record<string, unknown>).file_path;
				if (typeof p === "string" && p.trim()) return p;
			}
		}
	}
	return undefined;
}

export function isDestructiveCommand(command: string): boolean {
	const destructive = [
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
	return destructive.some((re) => re.test(command));
}

function gateMessage(
	_toolName: string,
	filePath: string | undefined,
	isDestructive: boolean,
): string {
	denialCount++;
	const condensed = denialCount > MAX_FULL_DENIALS;

	if (isDestructive) {
		if (condensed) {
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

	const target = filePath ?? "target file";
	if (condensed) {
		return `[GateGuard #${denialCount}] First access to ${target} blocked. Investigate before editing.`;
	}
	return [
		`[GateGuard] First access to ${target} blocked.`,
		`Before editing:`,
		`1. Which files import, call, configure, or document this file?`,
		`2. Which public functions, classes, exports, or schemas can be affected?`,
		`3. What are the observed fields, structure, and date/ID formats?`,
		`4. What exact user instruction authorizes this change?`,
		`5. What focused verification will prove the change?`,
	].join("\n");
}

function markInvestigated(filePath: string): void {
	investigatedFiles.add(filePath);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const extension: ExtensionFactory = (pi) => {
	pi.on("tool_call", async (event) => {
		if (!isEnabled()) return undefined;

		const { toolName, input } = event;
		const rawInput = (input ?? {}) as Record<string, unknown>;

		// --- edit / write / ast_grep_replace: block first access per file ---
		if (MUTATING_TOOL_NAMES.has(toolName)) {
			const filePath = extractFilePath(rawInput);
			if (!filePath) return undefined;

			if (investigatedFiles.has(filePath)) return undefined;

			if (
				isSubagentArtifactPath(filePath) ||
				filePath.includes("node_modules/") ||
				filePath.includes(".git/") ||
				filePath.includes("__pycache__/") ||
				filePath.endsWith(".lock") ||
				filePath.endsWith(".lockb")
			) {
				markInvestigated(filePath);
				return undefined;
			}

			markInvestigated(filePath);
			return {
				block: true,
				reason: gateMessage(toolName, filePath, false),
			};
		}

		// --- Bash: destructive first (MF1), then artifact-only allow ---
		if (toolName === "bash") {
			const command =
				typeof rawInput.command === "string" ? rawInput.command : "";
			if (!command) return undefined;

			// MF1: never short-circuit past destructive detection.
			if (isDestructiveCommand(command)) {
				return {
					block: true,
					reason: gateMessage(toolName, undefined, true),
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
