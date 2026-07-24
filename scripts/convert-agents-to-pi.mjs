#!/usr/bin/env node
/**
 * MAINTENANCE-ONLY import helper.
 *
 * Convert older agent frontmatter/tool names into the pi-subagents format
 * used by this repository.
 *
 * - Rewrites agents/*.md in place
 * - Safe to re-run when importing older HKX / ECC-style agent definitions
 * - NOT part of the normal package install/runtime path
 * - NOT exposed as an npm script intentionally
 *
 * Prefer writing new agents directly in the current pi-native format.
 * Run this only when bulk-importing older definitions:
 *   node scripts/convert-agents-to-pi.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const agentsDir = path.join(root, "agents");

// Legacy import compatibility only: maps older HKX / ECC / OMP-era tool
// names into the pi-native tool surface used by this repository today.
const LEGACY_TOOL_MAP = {
	read: ["read"],
	write: ["write"],
	edit: ["edit"],
	bash: ["bash"],
	search: ["ffgrep"],
	find: ["fffind"],
	grep: ["ffgrep"],
	web_search: ["web_search"],
	lsp: ["lsp_diagnostics", "lsp_navigation"],
	ast_grep: ["ast_grep_search"],
	ast_edit: ["ast_grep_replace"],
	browser: ["bash"],
	task: null,
	todo: ["todo"],
	yield: null,
	ask: null,
	debug: null,
	eval: null,
	job: null,
	irc: null,
	resolve: null,
};

const WRITERS = new Set([
	"build-error-resolver",
	"code-simplifier",
	"database-reviewer",
	"doc-updater",
	"e2e-runner",
	"go-build-resolver",
	"harness-optimizer",
	"loop-operator",
	"refactor-cleaner",
	"rust-build-resolver",
	"tdd-guide",
]);

const REVIEWERS = new Set([
	"agent-evaluator",
	"code-reviewer",
	"go-reviewer",
	"pr-test-analyzer",
	"python-reviewer",
	"rust-reviewer",
	"security-reviewer",
	"silent-failure-hunter",
	"typescript-reviewer",
]);

const HIGH_THINKING = new Set([
	...REVIEWERS,
	"planner",
	"architect",
	"code-architect",
	"database-reviewer",
	"harness-optimizer",
	"loop-operator",
	"tdd-guide",
	"code-simplifier",
	"refactor-cleaner",
]);

function parseFrontmatter(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) throw new Error("no frontmatter");
	const fm = {};
	for (const line of m[1].split(/\r?\n/)) {
		const i = line.indexOf(":");
		if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
	return { fm, body: m[2].trim() };
}

function parseTools(raw) {
	if (!raw) return [];
	try {
		if (raw.startsWith("[")) return JSON.parse(raw);
	} catch {
		// fall through
	}
	return raw
		.replace(/[[\]"]/g, "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function mapTools(ompTools, name, isReviewer) {
	const mapped = new Set();
	// Accept older source agent tool names on input, then normalize them to
	// the repository's current pi-native tool vocabulary.
	for (const t of ompTools) {
		const key = String(t).toLowerCase();
		if (!(key in LEGACY_TOOL_MAP)) {
			if (/^[a-z0-9_:-]+$/.test(key)) mapped.add(key);
			continue;
		}
		const vals = LEGACY_TOOL_MAP[key];
		if (vals) for (const v of vals) mapped.add(v);
	}

	mapped.add("read");
	mapped.add("ffgrep");
	mapped.add("fffind");
	mapped.add("grep");
	mapped.add("find");
	mapped.add("ls");
	mapped.add("bash");
	mapped.delete("search");
	mapped.delete("lsp");
	mapped.delete("ast_grep");
	mapped.delete("ast_edit");

	if (isReviewer) {
		mapped.delete("write");
		mapped.delete("edit");
		mapped.delete("ast_grep_replace");
		mapped.add("intercom");
	} else if (WRITERS.has(name)) {
		mapped.add("contact_supervisor");
	} else {
		mapped.add("intercom");
	}

	const order = [
		"read",
		"ffgrep",
		"fffind",
		"grep",
		"find",
		"fff-multi-grep",
		"ls",
		"bash",
		"edit",
		"write",
		"ast_grep_search",
		"ast_grep_replace",
		"lsp_diagnostics",
		"lsp_navigation",
		"web_search",
		"todo",
		"intercom",
		"contact_supervisor",
	];
	const ordered = [];
	for (const t of order) if (mapped.has(t)) ordered.push(t);
	for (const t of [...mapped].sort()) if (!ordered.includes(t)) ordered.push(t);
	return ordered;
}

function adaptToolMentions(body) {
	// Rewrite older prompt/tool wording so imported agent prompts read as
	// pi-native instructions after conversion.
	let out = body
		.replaceAll("`search`", "`ffgrep`")
		.replaceAll("`grep`", "`ffgrep`")
		.replaceAll("`find`", "`fffind`")
		.replaceAll("`ast_grep`", "`ast_grep_search`")
		.replaceAll("`lsp`", "`lsp_diagnostics`, `lsp_navigation`")
		.replaceAll("search/find", "ffgrep/fffind")
		.replaceAll("find/search", "fffind/ffgrep")
		.replaceAll(" with search,", " with ffgrep,")
		.replaceAll("Use search ", "Use ffgrep ")
		.replaceAll(" use search ", " use ffgrep ")
		.replaceAll("Use find ", "Use fffind ")
		.replaceAll(" use find ", " use fffind ");

	out = out.replace(/`ffgrep`,\s*`ffgrep`,\s*and/g, "`ffgrep` and");
	out = out.replace(/`fffind`,\s*`fffind`,\s*and/g, "`fffind` and");
	out = out.replace(/`ffgrep`(,\s*`ffgrep`)+/g, "`ffgrep`");
	out = out.replace(/`fffind`(,\s*`fffind`)+/g, "`fffind`");
	out = out.replace(/`ffgrep`,\s*and/g, "`ffgrep` and");
	out = out.replace(/`fffind`,\s*and/g, "`fffind` and");
	return out;
}

function convertOne(file) {
	const raw = fs.readFileSync(path.join(agentsDir, file), "utf8");
	const { fm, body } = parseFrontmatter(raw);
	const name = fm.name || path.basename(file, ".md");

	// Already converted?
	if (fm.package === "hkx" && /ffgrep|fffind/.test(fm.tools || "")) {
		return { name, skipped: true };
	}

	const ompTools = parseTools(fm.tools);
	const isReviewer = REVIEWERS.has(name);
	const isWriter = WRITERS.has(name);
	const tools = mapTools(ompTools, name, isReviewer);
	const defaultContext = isWriter ? "fork" : "fresh";
	const thinking = HIGH_THINKING.has(name)
		? "high"
		: name === "code-explorer" || name === "docs-lookup"
			? "medium"
			: "high";

	const roleNote = isReviewer
		? "- Review-only: do not modify project/source files. Returning findings in your response (or configured output artifact) is allowed."
		: isWriter
			? "- You may edit files only within the assigned scope. Stay the single writer for your worktree. Escalate product/architecture decisions via contact_supervisor/intercom when needed."
			: "- Do not modify project/source files unless the task explicitly requires it.";

	const prefix = [
		`You are the \`hkx.${name}\` subagent running inside pi-subagents.`,
		"",
		"Operating rules for this runtime:",
		"- Use the provided tools directly (`read`, `ffgrep`, `fffind`, `grep`, `find`, `ls`, `bash`, and any write/lens tools listed in frontmatter).",
		"- Prefer `ffgrep` / `fffind` (pi-fff) for content and path search. Native `grep` / `find` are available as fallback when FFF tools are unavailable or for simple single-pattern lookups.",
		"- Prefer `lsp_diagnostics` / `lsp_navigation` and `ast_grep_search` (pi-lens) when type or structural evidence is needed.",
		"- Prefer targeted search and selective reading over whole-file dumps.",
		roleNote,
		"- Cite exact file paths and line ranges. Prefer evidence over speculation.",
		"- Finish with a concise structured summary the parent agent can act on.",
		"",
	].join("\n");

	const lines = [
		"---",
		`name: ${name}`,
		"package: hkx",
		`description: ${fm.description || name}`,
		`tools: ${tools.join(", ")}`,
		`thinking: ${thinking}`,
		"systemPromptMode: replace",
		"inheritProjectContext: true",
		"inheritSkills: false",
		`defaultContext: ${defaultContext}`,
		"---",
		"",
	];

	const content = lines.join("\n") + prefix + adaptToolMentions(body) + "\n";
	fs.writeFileSync(path.join(agentsDir, file), content, "utf8");
	return { name: `hkx.${name}`, tools, skipped: false };
}

function main() {
	console.error(
		"[convert-agents-to-pi] maintenance-only import helper; not part of install-global or day-to-day package use",
	);
	const files = fs
		.readdirSync(agentsDir)
		.filter((f) => f.endsWith(".md"))
		.sort();
	const out = [];
	for (const file of files) out.push({ file, ...convertOne(file) });
	console.log(JSON.stringify({ count: out.length, agents: out }, null, 2));
}

main();
