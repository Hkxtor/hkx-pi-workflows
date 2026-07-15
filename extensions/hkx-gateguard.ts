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
 * Mirrors ECC's `scripts/hooks/gateguard-fact-force.js` using Pi's native
 * extension `tool_call` event with `{ block: true, reason }` semantics.
 *
 * Disable per-session: set `HKX_GATEGUARD=off` in the environment.
 *
 * Artifact exception (chain review outputs):
 * Paths under `.pi-subagents/` (chain-runs + artifacts) are pre-authorized.
 * Review-only chains use `outputMode: file-only` into those paths; blocking
 * them caused detach/intercom deadlocks (see adversarial review runs).
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
 * True for pi-subagents chain/runtime output surfaces that review-only
 * agents must write without a GateGuard first-access interrogation.
 *
 * Matches:
 * - `.pi-subagents/chain-runs/**`
 * - `.pi-subagents/artifacts/**`
 * - any nested `.pi-subagents/` segment (absolute or relative)
 */
export function isSubagentArtifactPath(filePath: string): boolean {
	const n = filePath.replace(/\\/g, "/");
	// Absolute or relative project path containing the gitignored runtime dir.
	if (n.includes("/.pi-subagents/") || n.includes(".pi-subagents/")) {
		return true;
	}
	// Bare relative prefix
	if (n === ".pi-subagents" || n.startsWith(".pi-subagents/")) {
		return true;
	}
	return false;
}

/**
 * True when a bash command only mutates subagent artifact paths (or is a
 * pure write into those paths). Used so agents that shell out (`cat >`,
 * `tee`, heredoc) to write findings do not hit false "destructive" friction
 * and so we never interrogate artifact-only writes.
 *
 * Conservative: returns true only when at least one `.pi-subagents` path
 * appears and no obvious non-artifact project source path is targeted by
 * common write redirections.
 */
export function isSubagentArtifactBashWrite(command: string): boolean {
	if (!command.includes(".pi-subagents")) return false;
	// If the command clearly redirects/writes into .pi-subagents, allow.
	const writesArtifact =
		/>\s*['"]?[^'"\s]*\.pi-subagents\//.test(command) ||
		/>>\s*['"]?[^'"\s]*\.pi-subagents\//.test(command) ||
		/tee\s+['"]?[^'"\s]*\.pi-subagents\//.test(command) ||
		/cp\s+[^\n]*\.pi-subagents\//.test(command) ||
		/install\s+[^\n]*\.pi-subagents\//.test(command) ||
		/mkdir\s+(-p\s+)?['"]?[^'"\s]*\.pi-subagents\//.test(command);
	return writesArtifact;
}

export function extractFilePath(
	input: Record<string, unknown>,
): string | undefined {
	const candidates = [input.path, input.file_path, input.filePath, input.file];
	for (const c of candidates) {
		if (typeof c === "string" && c.trim()) return c;
	}
	// Multi-edit: extract from edits array
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

			// Auto-allow edits to well-known safe surfaces
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

		// --- Bash: block destructive commands ---
		if (toolName === "bash") {
			const command =
				typeof rawInput.command === "string" ? rawInput.command : "";
			if (!command) return undefined;

			// Artifact-only shell writes are pre-authorized (chain review outputs).
			if (isSubagentArtifactBashWrite(command)) {
				return undefined;
			}

			if (!isDestructiveCommand(command)) return undefined;

			return {
				block: true,
				reason: gateMessage(toolName, undefined, true),
			};
		}

		return undefined;
	});
};

export default extension;
