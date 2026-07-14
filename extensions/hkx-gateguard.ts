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
// Helpers
// ---------------------------------------------------------------------------

function isEnabled(): boolean {
	const env = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process?.env;
	const v = env?.HKX_GATEGUARD?.toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "disabled";
}

function extractFilePath(input: Record<string, unknown>): string | undefined {
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

function isDestructiveCommand(command: string): boolean {
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
			if (!command || !isDestructiveCommand(command)) return undefined;

			return {
				block: true,
				reason: gateMessage(toolName, undefined, true),
			};
		}

		return undefined;
	});
};

export default extension;
