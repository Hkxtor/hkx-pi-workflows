type ToolName = "edit" | "write" | "ast_grep_replace" | string;

type ToolResultEvent = {
	isError?: boolean;
	toolName: ToolName;
	input: Record<string, unknown>;
	details?: unknown;
};

type ExtensionContext = {
	ui: {
		notify(message: string, level?: string): void;
	};
	cwd?: string;
};

type ExtensionRuntime = {
	on(
		event: "tool_result",
		handler: (
			event: ToolResultEvent,
			ctx: ExtensionContext,
		) => void | Promise<void>,
	): void;
	logger: {
		debug(message: string, data?: unknown): void;
	};
};

type ExtensionFactory = (pi: ExtensionRuntime) => void;

const LANGUAGE_CHECKS: Array<{
	label: string;
	pattern: RegExp;
	checks: string[];
}> = [
	{
		label: "TypeScript",
		pattern: /\.(?:ts|tsx|js|jsx|mts|cts)$/,
		checks: ["typecheck", "lint", "targeted tests"],
	},
	{
		label: "Python",
		pattern: /\.(?:py|pyi)$/,
		checks: ["ruff", "type check", "targeted tests"],
	},
	{
		label: "Rust",
		pattern: /\.rs$/,
		checks: ["cargo fmt", "cargo clippy", "cargo test"],
	},
	{
		label: "Go",
		pattern: /\.go$/,
		checks: ["gofmt", "go test"],
	},
];

const MUTATING_TOOL_NAMES = new Set<ToolName>([
	"edit",
	"write",
	"ast_grep_replace",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function addPath(paths: Set<string>, value: unknown): void {
	if (typeof value === "string" && value.trim()) paths.add(value);
}

function addPaths(paths: Set<string>, value: unknown): void {
	if (Array.isArray(value)) {
		for (const item of value) addPath(paths, item);
	}
}

function extractPathsFromUnknown(paths: Set<string>, value: unknown): void {
	if (!isRecord(value)) return;

	addPath(paths, value.path);
	addPath(paths, value.file_path);
	addPath(paths, value.filePath);
	addPaths(paths, value.paths);

	const edits = value.edits;
	if (Array.isArray(edits)) {
		for (const edit of edits) extractPathsFromUnknown(paths, edit);
	}

	const changes = value.changes;
	if (Array.isArray(changes)) {
		for (const change of changes) extractPathsFromUnknown(paths, change);
	}
}

function extractPaths(
	input: Record<string, unknown>,
	details: unknown,
): string[] {
	const paths = new Set<string>();
	extractPathsFromUnknown(paths, input);
	extractPathsFromUnknown(paths, details);
	return [...paths];
}

function matchingChecks(paths: readonly string[]): string[] {
	const seen = new Set<string>();
	for (const filePath of paths) {
		for (const language of LANGUAGE_CHECKS) {
			if (!language.pattern.test(filePath)) continue;
			seen.add(`${language.label}: ${language.checks.join(", ")}`);
		}
	}
	return [...seen];
}

const extension: ExtensionFactory = (pi) => {
	pi.on("tool_result", async (event, ctx) => {
		if (event.isError) return;
		if (!MUTATING_TOOL_NAMES.has(event.toolName)) return;

		const paths = extractPaths(event.input, event.details);
		const checks = matchingChecks(paths);
		if (checks.length === 0) return;

		const message = `HKX language quality: ${checks.join("; ")}`;
		ctx.ui.notify(message, "info");
		pi.logger.debug("HKX language quality reminder", {
			toolName: event.toolName,
			paths,
			checks,
			cwd: ctx.cwd,
		});
	});
};

export default extension;
