type ToolCallEvent = {
	toolName: string;
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
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Count of full denials emitted this session; later denials are condensed. */
let denialCount = 0;

/** Max full denials before switching to condensed single-line messages. */
const MAX_FULL_DENIALS = 3;

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

const DESTRUCTIVE_PATTERNS = [
	/\bgit\s+checkout\s+(-f|--force|--)\s/,
	/\bgit\s+reset\s+--hard/,
	/\bgit\s+branch\s+-[dD]/,
	/\bgit\s+tag\s+-d/,
	/\bgit\s+rebase\s+.*--abort/,
	/\bgit\s+stash\s+drop/,
	/\bdrop\s+(table|database|index)\b/i,
	/\bdelete\s+from\b/i,
	/\btruncate\b/i,
	/\bmkfs\b/,
	/\bdd\s+.*of=/,
	/\bkill\s+-9\b/,
	/\bpkill\b/,
];

const GIT_CLEAN_FORCE_PATTERN =
	/\bgit\s+clean\b(?=[^;&|\n]*\s(?:--force|-[a-z]*f[a-z]*)(?=$|[\s;&|]))/i;
const GIT_PUSH_FORCE_PATTERN =
	/\bgit\s+push\b(?=[^;&|\n]*\s(?:--force(?:-[a-z-]+)?(?:=[^\s;&|]+)?|-[a-z]*f[a-z]*)(?=$|[\s;&|]))/i;
const FORMAT_COMMAND_PATTERN =
	/(?:^|[;&|]|\n)\s*(?:sudo\s+)?format(?:\.com)?(?=\s|$)/i;
const RM_INVOCATION_PATTERN = /\brm\s+([^;&|\n]*)/g;
const RM_SHORT_FLAGS = /^-[rfirvRF]+$/;

const EVAL_INVOKERS = [
	/\b(?:ba|z)?sh\s+(?:-\w+\s+)*-c\b/,
	/\beval\b/,
	/\bnode\s+(?:-\w+\s+)*-e\b/,
	/\bpython[0-9.]*\s+(?:-\w+\s+)*-c\b/,
	/\bperl\s+(?:-\w+\s+)*-e\b/,
	/\bpsql\s+(?:-\w+\s+)*-c\b/,
];

function isSafeTmpRmTarget(target: string): boolean {
	return (
		target.startsWith("/tmp/") &&
		!/(?:^|\/)\.\.(?:\/|$)/.test(target)
	);
}

function matchesDestructiveRm(text: string): boolean {
	const rmPattern = new RegExp(RM_INVOCATION_PATTERN.source, "g");
	let match: RegExpExecArray | null;
	while ((match = rmPattern.exec(text)) !== null) {
		const args = match[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
		const targets: string[] = [];
		let parsingOptions = true;
		for (const arg of args) {
			if (parsingOptions && arg === "--") {
				parsingOptions = false;
				continue;
			}
			if (parsingOptions && RM_SHORT_FLAGS.test(arg)) continue;
			targets.push(arg);
		}

		// Missing, mixed, relative, or traversal-containing targets stay blocked.
		if (
			targets.length === 0 ||
			targets.some((target) => !isSafeTmpRmTarget(target))
		) {
			return true;
		}
	}
	return false;
}

function matchesDestructive(text: string): boolean {
	return (
		matchesDestructiveRm(text) ||
		GIT_CLEAN_FORCE_PATTERN.test(text) ||
		GIT_PUSH_FORCE_PATTERN.test(text) ||
		FORMAT_COMMAND_PATTERN.test(text) ||
		DESTRUCTIVE_PATTERNS.some((re) => re.test(text))
	);
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

		// --- Bash: block destructive commands, allow everything else. ---
		if (toolName === "bash") {
			const command =
				typeof rawInput.command === "string" ? rawInput.command : "";
			if (!command) return undefined;

			if (isDestructiveCommand(command)) {
				return {
					block: true,
					reason: gateMessage(),
				};
			}

			return undefined;
		}

		return undefined;
	});
};

export default extension;
