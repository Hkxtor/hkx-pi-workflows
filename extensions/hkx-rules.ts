/**
 * HKX Rules — inject `~/.pi/agent/rules/*.md` into the session prompt.
 *
 * Pi has no native rules layer: `<agent-dir>/rules/` is not in the resource list
 * (docs/configuration.md), nothing under dist/ opens it, and settings has no
 * `rules` key. `scripts/install.mjs` still links `rules/*.{md,mdc}` there, so
 * without this extension those files are dead weight — a rule like
 * `hkx-ts-no-console-log.md` never reaches a session.
 *
 * This extension reads the directory once per session and injects rule bodies
 * into the request's system prompt through `before_agent_start`.
 *
 * Frontmatter subset (mirrors the Hookify reader on purpose — one parser
 * dialect, not two):
 *   description: <one line>        required
 *   globs: ["**\/*.{py,pyi}"]      optional; file-type filter
 *   condition: "<regex>"           optional; edit-content filter
 *   scope: "tool:edit(**\/*.ts)"   optional; pairs with condition
 *
 * Classification: no `globs` and no `condition` → always-on (injected every
 * session); otherwise the rule waits for its trigger (wired up in M3).
 *
 * CRLF matters: 16 of the 17 rule files in this repo use CRLF line endings, and
 * a `\n`-only frontmatter regex silently reports "no frontmatter" for all of
 * them — which switches every filter off without raising anything. The splitter
 * below takes `\r?\n` and is pinned by scripts/tests/rules-injection.mjs.
 *
 * Disable per session: `HKX_RULES=off` (also 0/false/disabled).
 *
 * Read-only by contract: the source directory and the installed directory are
 * the same symlinked files, so this extension never writes.
 *
 * Same-run promotion (measured, M1 spike — see the M1 plan for the raw logs):
 * a rule that becomes applicable mid-run cannot reach the *same* request through
 * `before_agent_start`, which only fires once per run. Three candidate paths were
 * measured on this host:
 *
 *   A. `turn_end` -> `{ entries: [{type:"custom_message", ...}], continue: true }`
 *      The text arrives as a conversation message and IS visible to the next
 *      request of the same run. Works, but the text is then stored in the
 *      transcript and rides every later request until compaction.
 *   B. `turn_end` notice + body on the next run's `before_agent_start`.
 *      Measured: the second request still carried the old prompt. Only the
 *      notice lands in-run.
 *   C. `turn_end` -> `{ continue: true }` plus `context_with_system` rewriting
 *      the system message. Works, but the prompt lives at messages[0] with role
 *      "developer" in the request while the event exposes a role "system" entry
 *      with EMPTY content; assigning a fresh object to messages[0] silently
 *      deletes the entire system prompt (measured: headLen 68827 -> 35). Spreading
 *      (`{ ...head, content }`) keeps it (68827 -> 68895). Too easy to get
 *      silently wrong, and it defeats prompt caching per request.
 *
 * Decision for M3: use A for a one-time, bounded promotion notice and let the
 * rule body land through the next run's `before_agent_start`. Do not use C.
 *
 * Not yet declared in package.json `pi.extensions` (see the M1 plan): the
 * always-on baseline is validated first so a half-built injector never loads in
 * every real session.
 */
import * as nodeFs from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

export type RuleClass = "always" | "globs" | "condition";

export type Rule = {
	/** File basename without extension. */
	name: string;
	description: string;
	globs: string[];
	condition?: string;
	scope: string[];
	body: string;
	/** Absolute path the rule was read from. */
	source: string;
};

export type LoadResult = {
	rules: Rule[];
	warnings: string[];
};

/** Built-in prompt section names this extension must never collide with. */
export const RESERVED_SECTIONS = new Set([
	"preamble",
	"tools",
	"rules",
	"docs",
	"addendum",
	"project_context",
	"skills",
	"cwd",
	"magic_context",
]);

/**
 * The section name is a literal, never derived from a filename or user input:
 * Pi throws when a section name fails /^[a-z][a-z0-9_-]*$/ or equals
 * "preamble", and a thrown handler would fail the whole run.
 */
export const RULES_SECTION = "hkx_rules";

// ---------------------------------------------------------------------------
// Env / paths
// ---------------------------------------------------------------------------

function envRecord(): Record<string, string | undefined> {
	return (
		(globalThis as { process?: { env?: Record<string, string | undefined> } })
			.process?.env ?? {}
	);
}

export function isEnabled(): boolean {
	const v = envRecord().HKX_RULES?.toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "disabled";
}

export function rulesDir(home: string = nodeOs.homedir()): string {
	if (!home) return "";
	return nodePath.join(home, ".pi", "agent", "rules");
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Split a rule file into frontmatter and body.
 *
 * Same shape as hkx-hookify's exported splitter (`\r?\n` fences, BOM stripped,
 * body trimmed) so both layers read the same files the same way.
 */
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
 * Strip surrounding quotes. Double-quoted values get a minimal escape pass that
 * keeps unknown escapes (`\s`, `\d`, `\w`) intact, since `condition` holds a
 * regular expression source; single-quoted values are literal.
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
 * Split a comma-separated matcher list without breaking inside `{...}` or `(...)`.
 * Rule `scope` values look like
 * `tool:edit(**\/*.{ts,tsx,js,jsx,mts,cts}), tool:write(**\/*.{ts,...})`, whose
 * glob braces contain commas of their own — a naive `.split(",")` corrupts them.
 */
export function splitTopLevelCommas(value: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of value) {
		if (ch === "{" || ch === "(" || ch === "[") depth++;
		else if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
		if (ch === "," && depth === 0) {
			out.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	out.push(current.trim());
	return out.filter((s) => s.length > 0);
}

/** Parse inline (`[a, b]`) and block-sequence (`- a`) YAML lists. */
function parseList(lines: string[], startIndex: number): { values: string[]; next: number } {
	const first = lines[startIndex].trim();
	const inline = /^-\s*\[(.*)\]\s*$/.exec(first);
	if (inline) {
		return {
			values: inline[1]
				.split(",")
				.map((s) => stripQuotes(s))
				.filter((s) => s.length > 0),
			next: startIndex + 1,
		};
	}
	const inlineEmpty = /^-\s*\[\]\s*$/.exec(first);
	if (inlineEmpty) return { values: [], next: startIndex + 1 };

	const values: string[] = [];
	let i = startIndex + 1;
	while (i < lines.length) {
		const item = /^\s+-\s+(.*)$/.exec(lines[i]);
		if (!item) break;
		const v = stripQuotes(item[1]);
		if (v) values.push(v);
		i++;
	}
	return { values, next: i };
}

/** Minimal frontmatter reader for the rules subset: flat scalars, scalar lists. */
export function parseFrontmatterFields(frontmatter: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = frontmatter.replace(/\r\n/g, "\n").split("\n");
	let i = 0;
	while (i < lines.length) {
		const trimmed = lines[i].trim();
		if (!trimmed || trimmed.startsWith("#")) {
			i++;
			continue;
		}
		const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(trimmed);
		if (!kv) {
			i++;
			continue;
		}
		const key = kv[1];
		const rawValue = kv[2].trim();
		if (rawValue === "" || rawValue === "[]") {
			// Possibly a block sequence on the following lines.
			const list = parseList(lines, i);
			if (list.values.length > 0 || /^\s+-/.test(lines[i + 1] ?? "")) {
				result[key] = list.values;
				i = list.next;
				continue;
			}
			result[key] = [];
			i++;
			continue;
		}
		result[key] = stripQuotes(rawValue);
		i++;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function parseRule(raw: string, sourcePath: string): Rule | null {
	const { frontmatter, body } = splitFrontmatter(raw);
	const fields = frontmatter == null ? {} : parseFrontmatterFields(frontmatter);
	const name = nodePath.basename(sourcePath).replace(/\.(md|mdc)$/i, "");
	if (!name) return null;
	const description = typeof fields.description === "string" ? fields.description.trim() : "";
	const globs = Array.isArray(fields.globs)
		? fields.globs.filter((g): g is string => typeof g === "string" && g.length > 0)
		: [];
	const condition = typeof fields.condition === "string" ? fields.condition : undefined;
	const scopeRaw = Array.isArray(fields.scope)
		? fields.scope.filter((s): s is string => typeof s === "string")
		: typeof fields.scope === "string"
			? [fields.scope]
			: [];
	const scope = scopeRaw.flatMap((s) => splitTopLevelCommas(s)).filter((s) => s.length > 0);
	return {
		name,
		description,
		globs,
		condition,
		scope,
		// Prompt text is line-ending agnostic: 16 of 17 rule files are CRLF, and a
		// stray `\r` only spends tokens. Rendering normalizes to LF.
		body: body.replace(/\r\n/g, "\n").trim(),
		source: sourcePath,
	};
}

/**
 * `globs` wins over `condition` when both are present: a file-type filter is
 * checkable before an edit happens, while `condition` needs tool input.
 */
export function classify(rule: Rule): RuleClass {
	if (rule.globs.length > 0) return "globs";
	if (rule.condition !== undefined && rule.condition.length > 0) return "condition";
	return "always";
}

/**
 * Read every rule in `dir`. Fail-open by contract: a missing directory, an
 * unreadable file, or a file with no usable body is reported as a warning and
 * skipped — never thrown, because a thrown handler fails the model run.
 * Results are sorted by name so the injected prompt is stable across sessions.
 */
export function loadRules(dir: string): LoadResult {
	const rules: Rule[] = [];
	const warnings: string[] = [];
	if (!dir || !nodeFs.existsSync(dir)) {
		// A missing directory is a legitimate state, not a fault: Path A installs
		// this extension without the rules tree, and an operator may not use rules
		// at all. Warning here would put a notification in front of every such
		// session.
		return { rules, warnings };
	}
	let entries: string[];
	try {
		entries = nodeFs.readdirSync(dir).sort();
	} catch (err) {
		warnings.push(`cannot read rules directory ${dir}: ${(err as Error).message}`);
		return { rules, warnings };
	}
	for (const entry of entries) {
		if (!/\.(md|mdc)$/i.test(entry)) continue;
		const source = nodePath.join(dir, entry);
		let raw: string;
		try {
			raw = nodeFs.readFileSync(source, "utf8");
		} catch (err) {
			warnings.push(`cannot read rule ${entry}: ${(err as Error).message}`);
			continue;
		}
		const rule = parseRule(raw, source);
		if (!rule) {
			warnings.push(`skipped rule ${entry}: unusable name`);
			continue;
		}
		if (rule.body.length === 0) {
			warnings.push(`skipped rule ${entry}: empty body`);
			continue;
		}
		if (rule.description.length === 0) {
			warnings.push(`rule ${entry}: missing description`);
		}
		rules.push(rule);
	}
	// Sorted by rule name, not filename: `hkx-python.md` and
	// `hkx-python-no-bare-except.md` order differently under the two keys, and the
	// injected prompt must be stable.
	rules.sort((a, b) => a.name.localeCompare(b.name));
	return { rules, warnings };
}

// ---------------------------------------------------------------------------
// Matching (globs / scope / condition)
// ---------------------------------------------------------------------------

function escapeRegex(ch: string): string {
	return /[.+^$()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

/**
 * Convert a glob to an anchored RegExp.
 *
 * Supports the subset the rule files actually use and nothing more:
 *   `**`  any depth (`**\/*.py`, `**\/*.{ts,tsx}`)
 *   `*`   anything except `/`
 *   `?`   one non-`/` character
 *   `{a,b}` alternation, expanded by the caller (see `expandBraces`)
 *
 * A glob is matched against the path relative to the session cwd, but callers
 * may pass an absolute path: patterns starting with `**\/` are made to match at
 * any depth, so the leading directory does not matter.
 */
export function globToRegExp(glob: string): RegExp {
	let out = "";
	for (let i = 0; i < glob.length; i++) {
		const ch = glob[i];
		if (ch === "*") {
			if (glob[i + 1] === "*") {
				i++;
				if (glob[i + 1] === "/") {
					i++;
					out += "(?:[^/]*/)*";
				} else {
					out += ".*";
				}
			} else {
				out += "[^/]*";
			}
			continue;
		}
		if (ch === "?") {
			out += "[^/]";
			continue;
		}
		out += escapeRegex(ch);
	}
	return new RegExp(`^${out}$`);
}

/** Expand `{a,b}` alternation anywhere in a glob (`**\/*.{ts,tsx}`). */
export function expandBraces(glob: string): string[] {
	const m = /\{([^{}]*)\}/.exec(glob);
	if (!m) return [glob];
	const head = glob.slice(0, m.index);
	const tail = glob.slice(m.index + m[0].length);
	return m[1]
		.split(",")
		.map((alt) => alt.trim())
		.filter((alt) => alt.length > 0)
		.flatMap((alt) => expandBraces(`${head}${alt}${tail}`));
}

/** True when `filePath` matches any of the patterns. */
export function matchesAnyGlob(filePath: string, globs: string[]): boolean {
	if (!filePath) return false;
	const normalized = filePath.replace(/\\/g, "/");
	for (const glob of globs) {
		for (const expanded of expandBraces(glob)) {
			if (globToRegExp(expanded).test(normalized)) return true;
		}
	}
	return false;
}

/**
 * A `scope` entry: `tool:edit(<glob>)`, `tool:write(<glob>)`.
 * Returns null for anything that does not follow that shape, so an unknown
 * matcher is ignored instead of silently matching everything.
 */
export function parseScope(raw: string): { tool: string; glob: string } | null {
	const m = /^tool:([a-z_]+)\((.+)\)$/.exec(raw.trim());
	if (!m) return null;
	return { tool: m[1], glob: m[2] };
}

/**
 * Does this tool call fall inside the rule's `scope`?
 * Only the tool name and the target path are compared; content matching is the
 * `condition` regex and is handled separately.
 */
export function scopeMatches(rule: Rule, toolName: string, filePath: string): boolean {
	for (const raw of rule.scope) {
		const parsed = parseScope(raw);
		if (!parsed) continue;
		if (parsed.tool !== toolName) continue;
		if (matchesAnyGlob(filePath, [parsed.glob])) return true;
	}
	return false;
}

/** Compile a rule's `condition`; an invalid regex is a non-match, never a throw. */
export function conditionMatches(rule: Rule, text: string): boolean {
	if (!rule.condition || !text) return false;
	try {
		return new RegExp(rule.condition).test(text);
	} catch {
		return false;
	}
}

/**
 * Extract the path and the writable text from an edit/write tool input.
 * `edit` carries `edits[].newText`; `write` carries `content`. Both are optional
 * from the extension's point of view, so a malformed input yields empty text
 * rather than an exception.
 */
export function extractToolTarget(input: Record<string, unknown> | undefined): {
	path: string;
	text: string;
} {
	if (!input) return { path: "", text: "" };
	const path = typeof input.path === "string" ? input.path : typeof input.file_path === "string" ? input.file_path : "";
	const parts: string[] = [];
	if (typeof input.content === "string") parts.push(input.content);
	if (Array.isArray(input.edits)) {
		for (const edit of input.edits) {
			if (edit && typeof edit === "object") {
				const e = edit as { newText?: unknown; oldText?: unknown };
				if (typeof e.newText === "string") parts.push(e.newText);
				else if (typeof e.oldText === "string") parts.push(e.oldText);
			}
		}
	}
	return { path, text: parts.join("\n") };
}

/**
 * Should this tool call activate one of the gated rules?
 *
 * `globs` rules react to any file the session touches (read/write/edit) because
 * their guidance is type-wide; `condition` rules react only inside their
 * `scope` and only when the written text matches — that is what keeps a
 * "don't add console.log" rule from firing on unrelated edits.
 */
export function rulesForToolCall(
	rules: Rule[],
	toolName: string,
	input: Record<string, unknown> | undefined,
): Rule[] {
	const { path, text } = extractToolTarget(input);
	const hits: Rule[] = [];
	for (const rule of rules) {
		const cls = classify(rule);
		if (cls === "always") continue;
		if (cls === "globs") {
			if (matchesAnyGlob(path, rule.globs)) hits.push(rule);
			continue;
		}
		if (cls === "condition") {
			// A scope entry narrows the trigger; an empty scope falls back to the
			// rule's own glob-less behaviour, which cannot match a path, so it needs
			// the content test alone.
			if (rule.scope.length > 0 && !scopeMatches(rule, toolName, path)) continue;
			if (conditionMatches(rule, text)) hits.push(rule);
		}
	}
	return hits;
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

/**
 * Calibrated against the real 8-rule always-on set with cl100k_base:
 * 12,699 characters rendered to 2,515 tokens, i.e. 5.05 chars/token. The
 * extension cannot depend on a tokenizer (no runtime dependencies allowed), so
 * this constant carries the calibration instead. scripts/tests/rules-injection.mjs
 * re-measures with a real tokenizer and fails if the estimate drifts past ±5%.
 *
 * Recalibrated when hkx-web-performance and hkx-web-design-quality moved from
 * always-on to `globs` (10 rules / 4.98 chars/token -> 8 rules / 5.05).
 */
export const CHARS_PER_TOKEN = 5.05;

/** Approximate token count for prompt-budget reporting. */
export function estimateTokens(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export type CostSummary = {
	rules: number;
	always: number;
	chars: number;
	tokens: number;
	perRule: Array<{ name: string; cls: RuleClass; tokens: number }>;
};

/** What this session's always-on section costs, for operator reporting. */
export function summarizeCost(rules: Rule[]): CostSummary {
	const section = renderRulesSection(rules);
	const perRule = rules
		.map((r) => ({ name: r.name, cls: classify(r), tokens: estimateTokens(r.body) }))
		.sort((a, b) => b.tokens - a.tokens);
	return {
		rules: rules.length,
		always: rules.filter((r) => classify(r) === "always").length,
		chars: section.length,
		tokens: estimateTokens(section),
		perRule,
	};
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/** Render the always-on rules as one prompt section body. */
export function renderRulesSection(rules: Rule[]): string {
	return renderSection(rules.filter((r) => classify(r) === "always"), [
		"Rules loaded from ~/.pi/agent/rules/. They apply to this session unless the",
		"project's own instructions or the operator say so.",
	]);
}

/**
 * Body text for a mid-run promotion notice.
 *
 * Measured (M1): `before_agent_start` does not fire again for the follow-up
 * request that `turn_end -> { continue: true }` produces, so a promoted rule can
 * only reach the same run as a message. The body goes here instead of a second
 * prompt section — one copy, visible immediately, and never duplicated.
 */
export function renderPromotionNotice(rules: Rule[]): string {
	if (rules.length === 0) return "";
	const sorted = [...rules].sort((a, b) => a.name.localeCompare(b.name));
	return [
		"[hkx-rules] These rules became active because of the files just touched.",
		"Follow them from here on.",
		"",
		sorted.map((r) => `### ${r.name}\n${r.body}`).join("\n\n"),
	].join("\n");
}

function renderSection(subset: Rule[], introLines: string[]): string {
	if (subset.length === 0) return "";
	const sorted = [...subset].sort((a, b) => a.name.localeCompare(b.name));
	const blocks = sorted.map((r) => `### ${r.name}\n${r.body}`);
	return [...introLines, "", blocks.join("\n\n")].join("\n");
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

type SystemPromptOptions = {
	sections?: Record<string, string>;
	[key: string]: unknown;
};
type BeforeAgentStartLike = {
	systemPrompt?: string;
	systemPromptOptions?: SystemPromptOptions;
	messageType?: "user" | "custom";
};

type UiContext = { ui?: { notify?: (message: string, level?: string) => void } };

type ToolCallLike = { toolName?: string; input?: Record<string, unknown> };

type PiApi = {
	on: (
		event: string,
		handler: (event: unknown, ctx: unknown) => unknown | Promise<unknown>,
	) => unknown;
	registerCommand?: (
		name: string,
		options: { description: string; handler: (args: string, ctx: unknown) => unknown | Promise<unknown> },
	) => unknown;
};

export default function hkxRulesExtension(pi: PiApi): void {
	let rules: Rule[] = [];
	let warned = false;
	/** Monotonic: a promoted rule stays active for the rest of the session. */
	const promoted = new Set<string>();
	/** Rules promoted since the last notice was emitted. */
	let pendingNotice: Rule[] = [];

	const reset = () => {
		promoted.clear();
		pendingNotice = [];
	};

	// Reporting: what this session pays for, and what has been activated.
	pi.registerCommand?.("hkx-rules", {
		description: "Show loaded rules, promotions, and prompt cost",
		handler: async (_args: string, ctx: unknown) => {
			const live = rules.length > 0 ? rules : loadRules(rulesDir()).rules;
			const cost = summarizeCost(live);
			const alwaysNames = live.filter((r) => classify(r) === "always").map((r) => r.name);
			const gatedNames = live.filter((r) => classify(r) !== "always").map((r) => r.name);
			const activeNow = gatedNames.filter((n) => promoted.has(n));
			const lines = [
				`[hkx-rules] ${isEnabled() ? "on" : "OFF (HKX_RULES)"}`,
				`rules: ${cost.rules} loaded (${cost.always} always-on, ${cost.rules - cost.always} gated)`,
				`prompt: ${cost.chars} chars ~ ${cost.tokens} tokens (always-on section)`,
				`always-on: ${alwaysNames.join(", ") || "(none)"}`,
				`gated: ${gatedNames.join(", ") || "(none)"}`,
				`promoted this session: ${activeNow.join(", ") || "(none)"}`,
				`heaviest: ${cost.perRule.filter((r) => r.cls === "always").slice(0, 5).map((r) => `${r.name} ${r.tokens}`).join(", ")}`,
			];
			(ctx as UiContext).ui?.notify?.(lines.join("\n"), "info");
			return undefined;
		},
	});

	pi.on("session_start", async (_event: unknown, ctx: unknown) => {
		reset();
		if (!isEnabled()) {
			rules = [];
			return undefined;
		}
		const loaded = loadRules(rulesDir());
		rules = loaded.rules;
		if (loaded.warnings.length > 0 && !warned) {
			warned = true;
			(ctx as UiContext).ui?.notify?.(`[hkx-rules] ${loaded.warnings[0]}`, "warning");
		}
		return undefined;
	});

	// Promotion: decide once per tool call whether a gated rule became relevant.
	// Nothing is injected here — the body has to arrive in a message (see below).
	pi.on("tool_call", async (event: unknown) => {
		if (!isEnabled() || rules.length === 0) return undefined;
		const e = event as ToolCallLike;
		const toolName = typeof e.toolName === "string" ? e.toolName : "";
		if (!toolName) return undefined;
		const hits = rulesForToolCall(rules, toolName, e.input);
		if (hits.length === 0) return undefined;
		for (const rule of hits) {
			if (promoted.has(rule.name)) continue;
			promoted.add(rule.name);
			pendingNotice.push(rule);
		}
		return undefined;
	});

	// Delivery: `before_agent_start` fires once per run, so a rule promoted mid-run
	// can only reach the same run as a message. Measured in the M1 spike: the
	// `continue: true` follow-up request does NOT re-enter before_agent_start, so
	// the body travels as a `custom_message` — one copy, visible immediately.
	pi.on("turn_end", async () => {
		if (!isEnabled() || pendingNotice.length === 0) return undefined;
		const batch = pendingNotice;
		pendingNotice = [];
		const content = renderPromotionNotice(batch);
		if (!content) return undefined;
		return {
			entries: [
				{
					type: "custom_message",
					customType: "hkx-rules-promotion",
					content,
					display: false,
				},
			],
			continue: true,
		};
	});

	pi.on("before_agent_start", async (event: unknown) => {
		if (!isEnabled()) return undefined;
		const e = event as BeforeAgentStartLike;
		// Re-read lazily when session_start did not run (a resumed run may skip it).
		if (rules.length === 0) rules = loadRules(rulesDir()).rules;
		const section = renderRulesSection(rules);
		if (!section) return undefined;

		const options = e.systemPromptOptions;
		const sections = options?.sections;
		if (options && sections) {
			// Preferred path: mutate the structured sections so Pi keeps its own
			// transcript deltas instead of replacing the whole prompt. Already
			// present means a previous run of this session injected it — adding it
			// again would duplicate the text in every later request.
			if (!(RULES_SECTION in sections)) sections[RULES_SECTION] = section;
			return undefined;
		}
		// Fallback for hosts without structured sections: append to the rendered
		// prompt. `<hkx_rules>` mirrors the framework's own section wrapper.
		const base = typeof e.systemPrompt === "string" ? e.systemPrompt : "";
		return { systemPrompt: `${base}\n<hkx_rules>\n${section}\n</hkx_rules>` };
	});
}
