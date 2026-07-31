/**
 * HKX Hookify — operator-authored behavior guardrails for Pi.
 *
 * Loads Markdown+YAML rule files and enforces them on tool_call /
 * before_agent_start / agent_end. Complements GateGuard (investigation gate)
 * with user-defined pattern gates.
 *
 * Rule locations:
 * - project: `.pi/hookify.{name}.local.md` (under cwd)
 * - global:  `~/.pi/agent/hookify/hookify.{name}.md`
 *
 * Disable per-session: `HKX_HOOKIFY=off` (also 0/false/disabled).
 *
 * Origin: ECC hookify, rewritten for Pi extensions.
 */

import * as nodeFsMod from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

type ToolName = "bash" | "edit" | "write" | "ast_grep_replace" | string;

type ToolCallEvent = {
	toolName: ToolName;
	toolCallId?: string;
	input?: Record<string, unknown>;
};

type ToolCallBlockResult = {
	block: true;
	reason: string;
};

type BeforeAgentStartEvent = {
	prompt?: string;
	systemPrompt?: string;
};

type BeforeAgentStartResult = {
	systemPrompt?: string;
	message?: string;
};

type ExtensionContext = {
	ui?: {
		notify?(message: string, level?: string): void;
	};
	cwd?: string;
};

type ExtensionRuntime = {
	on(
		event: "session_start" | "tool_call" | "before_agent_start" | "agent_end",
		handler: (
			event: unknown,
			ctx: ExtensionContext,
		) => unknown | undefined | Promise<unknown | undefined>,
	): void;
};

type ExtensionFactory = (pi: ExtensionRuntime) => void;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HookifyEvent = "bash" | "file" | "prompt" | "stop" | "all";
export type HookifyAction = "warn" | "block";
export type HookifyOperator =
	| "regex_match"
	| "contains"
	| "equals"
	| "not_contains"
	| "starts_with"
	| "ends_with";

export type HookifyCondition = {
	field: string;
	operator: HookifyOperator;
	pattern: string;
};

export type HookifyRule = {
	name: string;
	enabled: boolean;
	event: HookifyEvent;
	action: HookifyAction;
	pattern?: string;
	conditions?: HookifyCondition[];
	message: string;
	sourcePath: string;
};

export type MatchContext = {
	event: HookifyEvent;
	fields: Record<string, string>;
};

export type EvaluateResult = {
	blocked: boolean;
	warnings: string[];
	blockReasons: string[];
	matched: string[];
};

export type ParseRuleResult =
	| { ok: true; rule: HookifyRule }
	| { ok: false; error: string };

const VALID_EVENTS = new Set<HookifyEvent>([
	"bash",
	"file",
	"prompt",
	"stop",
	"all",
]);
const VALID_ACTIONS = new Set<HookifyAction>(["warn", "block"]);
const VALID_OPERATORS = new Set<HookifyOperator>([
	"regex_match",
	"contains",
	"equals",
	"not_contains",
	"starts_with",
	"ends_with",
]);

const FILE_MUTATING_TOOLS = new Set<ToolName>([
	"edit",
	"write",
	"ast_grep_replace",
]);

const PROJECT_RULE_RE = /^hookify\.(.+)\.local\.md$/i;
const GLOBAL_RULE_RE = /^hookify\.(.+)\.md$/i;

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function envRecord(): Record<string, string | undefined> {
	return (
		(globalThis as { process?: { env?: Record<string, string | undefined> } })
			.process?.env ?? {}
	);
}

export function isEnabled(): boolean {
	const v = envRecord().HKX_HOOKIFY?.toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "disabled";
}

export function projectRulesDir(cwd: string): string {
	return nodePath.join(cwd, ".pi");
}

export function globalRulesDir(home = nodeOs.homedir()): string {
	if (!home) return "";
	return nodePath.join(home, ".pi", "agent", "hookify");
}

// ---------------------------------------------------------------------------
// Frontmatter parse
// ---------------------------------------------------------------------------

export function splitFrontmatter(raw: string): {
	frontmatter: string | null;
	body: string;
} {
	const text = raw.replace(/^\uFEFF/, "");
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
	if (!m) return { frontmatter: null, body: text.trim() };
	return { frontmatter: m[1], body: m[2].trim() };
}

/**
 * Strip surrounding quotes. Double-quoted values get minimal JSON/YAML-like
 * unescape so `pattern: "rm\\s+-rf"` becomes the RegExp source `rm\s+-rf`.
 * Unknown escapes like `\s` keep the backslash (needed for regex classes).
 * Single-quoted values are literal (YAML: only '' → ').
 */
function stripQuotes(value: string): string {
	const v = value.trim();
	if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
		const inner = v.slice(1, -1);
		let out = "";
		for (let i = 0; i < inner.length; i++) {
			const ch = inner[i];
			if (ch === "\\" && i + 1 < inner.length) {
				const n = inner[++i];
				switch (n) {
					case "\\":
						out += "\\";
						break;
					case "n":
						out += "\n";
						break;
					case "r":
						out += "\r";
						break;
					case "t":
						out += "\t";
						break;
					case '"':
						out += '"';
						break;
					case "'":
						out += "'";
						break;
					case "0":
						out += "\0";
						break;
					default:
						// Keep unknown escapes as backslash+char (e.g. \s \d \w for regex).
						out += `\\${n}`;
						break;
				}
			} else {
				out += ch;
			}
		}
		return out;
	}
	if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
		return v.slice(1, -1).replace(/''/g, "'");
	}
	return v;
}

/**
 * Minimal YAML-ish frontmatter reader for the Hookify subset.
 * Supports flat keys and a simple `conditions:` list of maps.
 */
export function parseFrontmatterFields(
	frontmatter: string,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = frontmatter.replace(/\r\n/g, "\n").split("\n");
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			i++;
			continue;
		}

		if (
			/^conditions:\s*$/.test(trimmed) ||
			/^conditions:\s*\[\]\s*$/.test(trimmed)
		) {
			if (/^conditions:\s*\[\]\s*$/.test(trimmed)) {
				result.conditions = [];
				i++;
				continue;
			}
			const conditions: HookifyCondition[] = [];
			i++;
			let current: Partial<HookifyCondition> | null = null;
			while (i < lines.length) {
				const cl = lines[i];
				if (/^\S/.test(cl) && cl.trim() !== "") break;

				const itemStart = /^\s*-\s+field:\s*(.*)$/.exec(cl);
				if (itemStart) {
					if (current?.field && current.operator && current.pattern != null) {
						conditions.push(current as HookifyCondition);
					}
					current = { field: stripQuotes(itemStart[1]) };
					i++;
					continue;
				}
				const op = /^\s+operator:\s*(.*)$/.exec(cl);
				if (op && current) {
					current.operator = stripQuotes(op[1]) as HookifyOperator;
					i++;
					continue;
				}
				const pat = /^\s+pattern:\s*(.*)$/.exec(cl);
				if (pat && current) {
					current.pattern = stripQuotes(pat[1]);
					i++;
					continue;
				}
				const fieldCont = /^\s+field:\s*(.*)$/.exec(cl);
				if (fieldCont && current) {
					current.field = stripQuotes(fieldCont[1]);
					i++;
					continue;
				}
				if (/^\s+/.test(cl)) {
					i++;
					continue;
				}
				break;
			}
			if (current?.field && current.operator && current.pattern != null) {
				conditions.push(current as HookifyCondition);
			}
			result.conditions = conditions;
			continue;
		}

		const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(trimmed);
		if (kv) {
			const key = kv[1];
			const rawVal = kv[2].trim();
			if (rawVal === "" || rawVal === "|" || rawVal === ">") {
				result[key] = "";
			} else if (rawVal === "true" || rawVal === "false") {
				result[key] = rawVal === "true";
			} else {
				result[key] = stripQuotes(rawVal);
			}
		}
		i++;
	}
	return result;
}

export function parseRuleFile(
	raw: string,
	sourcePath: string,
): ParseRuleResult {
	const { frontmatter, body } = splitFrontmatter(raw);
	if (frontmatter == null) {
		return { ok: false, error: "missing YAML frontmatter fences" };
	}
	const fields = parseFrontmatterFields(frontmatter);

	const nameRaw = fields.name;
	if (typeof nameRaw !== "string" || !nameRaw.trim()) {
		return { ok: false, error: "name is required" };
	}
	const name = nameRaw.trim();
	if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
		return {
			ok: false,
			error: `name must be kebab-case (got ${JSON.stringify(name)})`,
		};
	}

	const eventRaw = fields.event;
	if (
		typeof eventRaw !== "string" ||
		!VALID_EVENTS.has(eventRaw as HookifyEvent)
	) {
		return {
			ok: false,
			error: `event must be one of ${[...VALID_EVENTS].join("|")}`,
		};
	}
	const event = eventRaw as HookifyEvent;

	let action: HookifyAction = "warn";
	if (
		fields.action !== undefined &&
		fields.action !== null &&
		fields.action !== ""
	) {
		if (
			typeof fields.action !== "string" ||
			!VALID_ACTIONS.has(fields.action as HookifyAction)
		) {
			return { ok: false, error: "action must be warn|block" };
		}
		action = fields.action as HookifyAction;
	}

	let enabled = true;
	if (typeof fields.enabled === "boolean") {
		enabled = fields.enabled;
	} else if (typeof fields.enabled === "string") {
		const e = fields.enabled.toLowerCase();
		if (e === "false" || e === "0" || e === "off") enabled = false;
		else if (e === "true" || e === "1" || e === "on") enabled = true;
		else return { ok: false, error: "enabled must be true|false" };
	}

	const pattern =
		typeof fields.pattern === "string" && fields.pattern.length > 0
			? fields.pattern
			: undefined;

	let conditions: HookifyCondition[] | undefined;
	if (Array.isArray(fields.conditions)) {
		conditions = [];
		for (const c of fields.conditions) {
			if (!c || typeof c !== "object") {
				return { ok: false, error: "invalid condition entry" };
			}
			const cond = c as HookifyCondition;
			if (!cond.field || !cond.operator || cond.pattern == null) {
				return {
					ok: false,
					error: "each condition needs field, operator, pattern",
				};
			}
			if (!VALID_OPERATORS.has(cond.operator)) {
				return {
					ok: false,
					error: `invalid operator ${JSON.stringify(cond.operator)}`,
				};
			}
			conditions.push({
				field: String(cond.field),
				operator: cond.operator,
				pattern: String(cond.pattern),
			});
		}
	}

	if (!pattern && (!conditions || conditions.length === 0)) {
		return { ok: false, error: "pattern or conditions[] is required" };
	}

	return {
		ok: true,
		rule: {
			name,
			enabled,
			event,
			action,
			pattern,
			conditions,
			message: body || `(hookify rule ${name})`,
			sourcePath,
		},
	};
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function applyOperator(
	operator: HookifyOperator,
	value: string,
	pattern: string,
): boolean {
	switch (operator) {
		case "contains":
			return value.includes(pattern);
		case "equals":
			return value === pattern;
		case "not_contains":
			return !value.includes(pattern);
		case "starts_with":
			return value.startsWith(pattern);
		case "ends_with":
			return value.endsWith(pattern);
		case "regex_match": {
			try {
				return new RegExp(pattern).test(value);
			} catch {
				return false;
			}
		}
		default:
			return false;
	}
}

function primaryField(ctx: MatchContext): string {
	switch (ctx.event) {
		case "bash":
			return ctx.fields.command ?? "";
		case "file":
			return ctx.fields.file_path ?? "";
		case "prompt":
			return ctx.fields.user_prompt ?? "";
		case "stop":
			return ctx.fields.stop ?? "";
		default:
			return (
				ctx.fields.command ??
				ctx.fields.file_path ??
				ctx.fields.user_prompt ??
				ctx.fields.content ??
				""
			);
	}
}

function patternCandidates(ctx: MatchContext): string[] {
	if (ctx.event === "bash") return [ctx.fields.command ?? ""];
	if (ctx.event === "prompt") return [ctx.fields.user_prompt ?? ""];
	if (ctx.event === "stop") return [ctx.fields.stop ?? ""];
	if (ctx.event === "file") {
		return [
			ctx.fields.file_path ?? "",
			ctx.fields.content ?? "",
			ctx.fields.new_text ?? "",
			ctx.fields.old_text ?? "",
		];
	}
	// all
	return [
		ctx.fields.command ?? "",
		ctx.fields.file_path ?? "",
		ctx.fields.content ?? "",
		ctx.fields.new_text ?? "",
		ctx.fields.old_text ?? "",
		ctx.fields.user_prompt ?? "",
		ctx.fields.stop ?? "",
	];
}

/**
 * True when rule applies to this logical event and all matchers hit.
 * Disabled rules never match.
 */
export function matchRule(rule: HookifyRule, ctx: MatchContext): boolean {
	if (!rule.enabled) return false;
	if (rule.event !== "all" && rule.event !== ctx.event) return false;

	if (rule.conditions && rule.conditions.length > 0) {
		for (const cond of rule.conditions) {
			const value = ctx.fields[cond.field] ?? "";
			if (!applyOperator(cond.operator, value, cond.pattern)) return false;
		}
		// conditions alone are enough when present (AND). If pattern also set,
		// require pattern too for extra specificity.
		if (!rule.pattern) return true;
	}

	if (rule.pattern) {
		try {
			const re = new RegExp(rule.pattern);
			const candidates = patternCandidates(ctx);
			if (candidates.some((v) => v.length > 0 && re.test(v))) return true;
			// stop rules often use `.*` against a synthetic field
			if (ctx.event === "stop" && re.test(primaryField(ctx))) return true;
			// empty candidates: still try primary
			return re.test(primaryField(ctx));
		} catch {
			return false;
		}
	}

	return false;
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

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

export function extractFileContent(input: Record<string, unknown>): {
	content: string;
	new_text: string;
	old_text: string;
} {
	const partsNew: string[] = [];
	const partsOld: string[] = [];
	const push = (arr: string[], v: unknown) => {
		if (typeof v === "string" && v) arr.push(v);
	};

	push(partsNew, input.content);
	push(partsNew, input.newText);
	push(partsNew, input.new_text);
	push(partsNew, input.text);
	push(partsOld, input.oldText);
	push(partsOld, input.old_text);

	if (Array.isArray(input.edits)) {
		for (const edit of input.edits) {
			if (edit && typeof edit === "object") {
				const e = edit as Record<string, unknown>;
				push(partsNew, e.newText);
				push(partsNew, e.new_text);
				push(partsNew, e.content);
				push(partsOld, e.oldText);
				push(partsOld, e.old_text);
			}
		}
	}

	const new_text = partsNew.join("\n");
	const old_text = partsOld.join("\n");
	return {
		content: [new_text, old_text].filter(Boolean).join("\n"),
		new_text,
		old_text,
	};
}

export function matchContextFromToolCall(
	toolName: string,
	input: Record<string, unknown>,
): MatchContext | null {
	if (toolName === "bash") {
		const command = typeof input.command === "string" ? input.command : "";
		return { event: "bash", fields: { command } };
	}
	if (FILE_MUTATING_TOOLS.has(toolName)) {
		const file_path = extractFilePath(input) ?? "";
		const { content, new_text, old_text } = extractFileContent(input);
		return {
			event: "file",
			fields: { file_path, content, new_text, old_text },
		};
	}
	return null;
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

function formatHit(rule: HookifyRule): string {
	const header = `[Hookify:${rule.name}]`;
	const body = rule.message.trim();
	return body ? `${header}\n${body}` : header;
}

export function evaluateRules(
	rules: readonly HookifyRule[],
	ctx: MatchContext,
): EvaluateResult {
	const warnings: string[] = [];
	const blockReasons: string[] = [];
	const matched: string[] = [];

	for (const rule of rules) {
		if (!matchRule(rule, ctx)) continue;
		matched.push(rule.name);
		const text = formatHit(rule);
		if (rule.action === "block") blockReasons.push(text);
		else warnings.push(text);
	}

	return {
		blocked: blockReasons.length > 0,
		warnings,
		blockReasons,
		matched,
	};
}

export function evaluateToolCall(
	rules: readonly HookifyRule[],
	toolName: string,
	input: Record<string, unknown>,
	opts?: { enabled?: boolean },
): EvaluateResult {
	const enabled = opts?.enabled !== undefined ? opts.enabled : isEnabled();
	if (!enabled) {
		return { blocked: false, warnings: [], blockReasons: [], matched: [] };
	}
	const ctx = matchContextFromToolCall(toolName, input);
	if (!ctx) {
		return { blocked: false, warnings: [], blockReasons: [], matched: [] };
	}
	return evaluateRules(rules, ctx);
}

export function evaluatePrompt(
	rules: readonly HookifyRule[],
	prompt: string,
	opts?: { enabled?: boolean },
): EvaluateResult {
	const enabled = opts?.enabled !== undefined ? opts.enabled : isEnabled();
	if (!enabled) {
		return { blocked: false, warnings: [], blockReasons: [], matched: [] };
	}
	return evaluateRules(rules, {
		event: "prompt",
		fields: { user_prompt: prompt ?? "" },
	});
}

export function evaluateStop(
	rules: readonly HookifyRule[],
	opts?: { enabled?: boolean },
): EvaluateResult {
	const enabled = opts?.enabled !== undefined ? opts.enabled : isEnabled();
	if (!enabled) {
		return { blocked: false, warnings: [], blockReasons: [], matched: [] };
	}
	return evaluateRules(rules, {
		event: "stop",
		fields: { stop: "session-end" },
	});
}

// ---------------------------------------------------------------------------
// Filesystem load
// ---------------------------------------------------------------------------

export function listRulePaths(
	cwd: string,
	home = nodeOs.homedir(),
): { project: string[]; global: string[] } {
	const project: string[] = [];
	const global: string[] = [];

	const projDir = nodePath.join(cwd, ".pi");
	if (nodeFsMod.existsSync(projDir)) {
		try {
			const st = nodeFsMod.statSync(projDir);
			if (st.isDirectory()) {
				for (const name of nodeFsMod.readdirSync(projDir)) {
					if (PROJECT_RULE_RE.test(name)) {
						project.push(nodePath.join(projDir, name));
					}
				}
			}
		} catch {
			// ignore unreadable project dir
		}
	}

	const globDir = nodePath.join(home, ".pi", "agent", "hookify");
	if (nodeFsMod.existsSync(globDir)) {
		try {
			const st = nodeFsMod.statSync(globDir);
			if (st.isDirectory()) {
				for (const name of nodeFsMod.readdirSync(globDir)) {
					if (GLOBAL_RULE_RE.test(name) || PROJECT_RULE_RE.test(name)) {
						global.push(nodePath.join(globDir, name));
					}
				}
			}
		} catch {
			// ignore unreadable global dir
		}
	}

	project.sort();
	global.sort();
	return { project, global };
}

export function loadRulesFromPaths(paths: readonly string[]): {
	rules: HookifyRule[];
	errors: Array<{ path: string; error: string }>;
} {
	const rules: HookifyRule[] = [];
	const errors: Array<{ path: string; error: string }> = [];
	for (const p of paths) {
		try {
			if (!nodeFsMod.existsSync(p)) continue;
			const raw = nodeFsMod.readFileSync(p, "utf8");
			const parsed = parseRuleFile(raw, p);
			if (!parsed.ok) {
				errors.push({ path: p, error: parsed.error });
				continue;
			}
			rules.push(parsed.rule);
		} catch (err) {
			errors.push({
				path: p,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
	return { rules, errors };
}

export function loadAllRules(
	cwd: string,
	home = nodeOs.homedir(),
): {
	rules: HookifyRule[];
	errors: Array<{ path: string; error: string }>;
} {
	const { project, global } = listRulePaths(cwd, home);
	return loadRulesFromPaths([...project, ...global]);
}

function fingerprintPaths(paths: readonly string[]): string {
	const parts: string[] = [];
	for (const p of paths) {
		try {
			if (!nodeFsMod.existsSync(p)) {
				parts.push(`${p}:missing`);
				continue;
			}
			const st = nodeFsMod.statSync(p);
			parts.push(`${p}:${st.mtimeMs}`);
		} catch {
			parts.push(`${p}:err`);
		}
	}
	return parts.join("|");
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const extension: ExtensionFactory = (pi) => {
	let cachedRules: HookifyRule[] = [];
	let cacheKey = "";
	const reportedParseErrors = new Set<string>();

	function resolveCwd(ctx: ExtensionContext): string {
		if (typeof ctx.cwd === "string" && ctx.cwd) return ctx.cwd;
		try {
			return (
				(globalThis as { process?: { cwd?: () => string } }).process?.cwd?.() ??
				"."
			);
		} catch {
			return ".";
		}
	}

	function refresh(ctx: ExtensionContext): HookifyRule[] {
		if (!isEnabled()) {
			cachedRules = [];
			cacheKey = "";
			return cachedRules;
		}
		const cwd = resolveCwd(ctx);
		const { project, global } = listRulePaths(cwd, nodeOs.homedir());
		const paths = [...project, ...global];
		const key = fingerprintPaths(paths);
		if (key === cacheKey) return cachedRules;

		const { rules, errors } = loadRulesFromPaths(paths);
		cachedRules = rules;
		cacheKey = key;

		for (const err of errors) {
			const id = `${err.path}:${err.error}`;
			if (reportedParseErrors.has(id)) continue;
			reportedParseErrors.add(id);
			ctx.ui?.notify?.(
				`[Hookify] skipped invalid rule ${err.path}: ${err.error}`,
				"warning",
			);
		}
		return cachedRules;
	}

	pi.on("session_start", async (_event, ctx) => {
		cacheKey = "";
		refresh(ctx as ExtensionContext);
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!isEnabled()) return undefined;
		const e = event as ToolCallEvent;
		const rules = refresh(ctx as ExtensionContext);
		if (rules.length === 0) return undefined;

		const input = (e.input ?? {}) as Record<string, unknown>;
		const result = evaluateToolCall(rules, e.toolName, input, {
			enabled: true,
		});

		for (const w of result.warnings) {
			(ctx as ExtensionContext).ui?.notify?.(w, "warning");
		}

		if (result.blocked) {
			return {
				block: true,
				reason: result.blockReasons.join("\n---\n"),
			} satisfies ToolCallBlockResult;
		}
		return undefined;
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (!isEnabled()) return undefined;
		const e = event as BeforeAgentStartEvent;
		const rules = refresh(ctx as ExtensionContext);
		if (rules.length === 0) return undefined;

		const prompt = typeof e.prompt === "string" ? e.prompt : "";
		const result = evaluatePrompt(rules, prompt, { enabled: true });
		if (result.matched.length === 0) return undefined;

		for (const w of result.warnings) {
			(ctx as ExtensionContext).ui?.notify?.(w, "warning");
		}
		for (const b of result.blockReasons) {
			(ctx as ExtensionContext).ui?.notify?.(b, "error");
		}

		// Pi cannot hard-block user submit; inject a reminder instead.
		const lines = [
			...result.blockReasons.map((r) => `BLOCK guidance:\n${r}`),
			...result.warnings.map((r) => `WARN:\n${r}`),
		];
		if (lines.length === 0) return undefined;

		const injection = [
			"[Hookify] Matched prompt guardrail(s). Honor these constraints for this turn:",
			...lines,
		].join("\n\n");

		const out: BeforeAgentStartResult = {};
		if (result.blocked) {
			const base = typeof e.systemPrompt === "string" ? e.systemPrompt : "";
			out.systemPrompt = `${base}\n\n${injection}`;
		} else {
			out.message = injection;
		}
		return out;
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!isEnabled()) return undefined;
		const rules = refresh(ctx as ExtensionContext);
		if (rules.length === 0) return undefined;
		const result = evaluateStop(rules, { enabled: true });
		for (const w of [...result.warnings, ...result.blockReasons]) {
			(ctx as ExtensionContext).ui?.notify?.(w, "info");
		}
		return undefined;
	});
};

export default extension;
