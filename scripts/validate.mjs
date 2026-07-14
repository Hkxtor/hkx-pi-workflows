#!/usr/bin/env node
/**
 * Day-to-day package surface validator for @hkx/pi-workflows.
 *
 * npm entry: npm run validate
 *
 * Enforces the package contract for:
 * - required docs / metadata files
 * - package.json dual-path manifest (pi + pi-subagents)
 * - agents frontmatter and pi-native tools allowlist
 * - chains presence and basic shape
 * - rejection of superseded tool aliases (grep/find/search, lsp/ast_grep/ast_edit)
 *
 * Frontmatter matching accepts both LF and CRLF.
 * This is a pure check: it never installs or mutates package surfaces.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
	"package.json",
	"README.md",
	".mcp.json",
	"mcp-configs/mcp-servers.json",
	"AGENTS.md",
	"GLOBAL_AGENTS.md",
	"APPEND_SYSTEM.md",
	"docs/README.md",
	"docs/architecture.md",
	"docs/conversion-map.md",
	"docs/skill-routing.md",
	"docs/language-hooks.md",
	"configs/pi-permission-system/config.json",
	"configs/agent-settings.json",
	"agents/code-reviewer.md",
	"agents/planner.md",
	"chains/hkx-pr-review.chain.json",
	"chains/hkx-feature-flow.chain.json",
];

const allowedPiTools = new Set([
	"read",
	"write",
	"edit",
	"bash",
	"ls",
	"ffgrep",
	"fffind",
	"fff-multi-grep",
	"web_search",
	"todo",
	"intercom",
	"contact_supervisor",
	"lsp_diagnostics",
	"lsp_navigation",
	"ast_grep_search",
	"ast_grep_replace",
	"ast_grep_outline",
	"lens_diagnostics",
	"module_report",
	"read_symbol",
	"read_enclosing",
	"symbol_search",
]);

const errors = [];

function frontmatterField(frontmatter, field) {
	const re = new RegExp(`^${field}:\\s*(.*)$`, "m");
	const m = re.exec(frontmatter);
	if (!m) return null;
	return { value: m[1].trim() };
}

function isYamlQuotedScalar(value) {
	return (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	);
}

/**
 * YAML compact-mapping guard: unquoted scalars that contain ":" are invalid
 * for common frontmatter parsers (e.g. description: Foo: bar).
 */
function requireQuotedIfColon(relativePath, field, rawValue) {
	if (!rawValue || isYamlQuotedScalar(rawValue)) return [];
	if (!rawValue.includes(":")) return [];
	return [
		`${relativePath}: frontmatter field ${field} must be quoted when the value contains ":"`,
	];
}

function requireFrontmatter(
	relativePath,
	text,
	requiredFields = ["description"],
) {
	const local = [];
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
	if (!match) return [`${relativePath}: missing complete frontmatter block`];

	const frontmatter = match[1];
	for (const field of requiredFields) {
		const entry = frontmatterField(frontmatter, field);
		if (!entry || entry.value.length === 0) {
			local.push(`${relativePath}: missing frontmatter field ${field}`);
			continue;
		}
		// description is free-form prose and frequently contains colons; force quotes.
		if (field === "description") {
			local.push(...requireQuotedIfColon(relativePath, field, entry.value));
		}
	}
	return local;
}

function parseToolsList(raw) {
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

async function collectMdFiles(dir) {
	const out = [];
	async function walk(d) {
		let ents;
		try {
			ents = await fs.readdir(d, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of ents) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) await walk(p);
			else if (e.name.endsWith(".md")) out.push(p);
		}
	}
	await walk(dir);
	return out;
}

async function main() {
	for (const rel of requiredFiles) {
		try {
			await fs.access(path.join(root, rel));
		} catch {
			errors.push(`missing required file: ${rel}`);
		}
	}

	// package.json shape
	let pkg;
	try {
		pkg = JSON.parse(
			await fs.readFile(path.join(root, "package.json"), "utf8"),
		);
	} catch (err) {
		errors.push(`package.json: ${err.message}`);
		pkg = {};
	}
	if (pkg.name !== "@hkx/pi-workflows") {
		errors.push(
			`package.json name should be @hkx/pi-workflows (got ${pkg.name})`,
		);
	}
	if (!pkg.pi) errors.push("package.json missing pi block");
	if (pkg.omp)
		errors.push(
			"package.json still has omp block — remove for pi-native package",
		);

	// Official pi package resources (pi install / package gallery)
	const pi = pkg.pi && typeof pkg.pi === "object" ? pkg.pi : {};
	const keywords = Array.isArray(pkg.keywords) ? pkg.keywords : [];
	if (!keywords.includes("pi-package")) {
		errors.push('package.json keywords must include "pi-package"');
	}
	for (const key of ["extensions", "skills", "prompts"]) {
		if (!Array.isArray(pi[key]) || pi[key].length === 0) {
			errors.push(`package.json pi.${key} must be a non-empty array`);
		}
	}
	// Superseded / non-native top-level pi keys (use prompts + pi-subagents instead)
	for (const banned of ["commands", "agents", "chains", "rules", "name"]) {
		if (Object.hasOwn(pi, banned)) {
			errors.push(
				`package.json pi.${banned} is not a native pi package field — use pi.prompts / pi-subagents / install-global instead`,
			);
		}
	}
	if (
		Array.isArray(pi.prompts) &&
		!pi.prompts.some((p) => String(p).includes("commands"))
	) {
		errors.push(
			'package.json pi.prompts should reference "./commands" (repo keeps commands/ on disk)',
		);
	}

	// pi-subagents discovery (agents/chains from installed packages)
	const piSub =
		pkg["pi-subagents"] && typeof pkg["pi-subagents"] === "object"
			? pkg["pi-subagents"]
			: null;
	if (!piSub) {
		errors.push(
			'package.json missing "pi-subagents" block for agents/chains discovery',
		);
	} else {
		for (const key of ["agents", "chains"]) {
			if (!Array.isArray(piSub[key]) || piSub[key].length === 0) {
				errors.push(
					`package.json pi-subagents.${key} must be a non-empty array`,
				);
			}
		}
	}

	// External extension config overlay (managed by this package, not shipped as TS)
	const permissionConfigPath = path.join(
		root,
		"configs",
		"pi-permission-system",
		"config.json",
	);
	try {
		const permissionConfig = JSON.parse(
			await fs.readFile(permissionConfigPath, "utf8"),
		);
		if (!permissionConfig || typeof permissionConfig !== "object") {
			errors.push(
				"configs/pi-permission-system/config.json: must be a JSON object",
			);
		} else if (!permissionConfig.permission) {
			errors.push(
				"configs/pi-permission-system/config.json: missing permission block",
			);
		}
	} catch (err) {
		if (err && err.code !== "ENOENT") {
			errors.push(
				`configs/pi-permission-system/config.json: invalid JSON: ${err.message}`,
			);
		}
	}

	// Managed global agent settings (packages + portable defaults)
	const agentSettingsPath = path.join(root, "configs", "agent-settings.json");
	try {
		const agentSettings = JSON.parse(
			await fs.readFile(agentSettingsPath, "utf8"),
		);
		if (!agentSettings || typeof agentSettings !== "object") {
			errors.push("configs/agent-settings.json: must be a JSON object");
		} else {
			if (!Array.isArray(agentSettings.packages)) {
				errors.push("configs/agent-settings.json: packages must be an array");
			} else if (agentSettings.packages.length === 0) {
				errors.push("configs/agent-settings.json: packages must not be empty");
			} else {
				for (const [i, entry] of agentSettings.packages.entries()) {
					const ok =
						typeof entry === "string" ||
						(entry &&
							typeof entry === "object" &&
							typeof entry.source === "string");
					if (!ok) {
						errors.push(
							`configs/agent-settings.json: packages[${i}] must be a string or { source } object`,
						);
					}
				}
			}
			// Disallow machine-local keys that should never be versioned here
			for (const banned of [
				"shellPath",
				"lastChangelogVersion",
				"defaultProvider",
				"defaultModel",
				"defaultThinkingLevel",
			]) {
				if (Object.hasOwn(agentSettings, banned)) {
					errors.push(
						`configs/agent-settings.json: do not version machine-local key "${banned}"`,
					);
				}
			}
		}
	} catch (err) {
		if (err && err.code !== "ENOENT") {
			errors.push(`configs/agent-settings.json: invalid JSON: ${err.message}`);
		}
	}

	// agents
	const agentFiles = await collectMdFiles(path.join(root, "agents"));
	const agentNames = new Set();
	for (const filePath of agentFiles) {
		const relativePath = path.relative(root, filePath);
		const text = await fs.readFile(filePath, "utf8");
		errors.push(
			...requireFrontmatter(relativePath, text, [
				"name",
				"description",
				"tools",
			]),
		);

		const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
		if (!match) continue;
		const frontmatter = match[1];
		const name = frontmatterField(frontmatter, "name")?.value;
		const expected = path.basename(filePath, ".md");
		if (name && name !== expected) {
			errors.push(
				`${relativePath}: agent name in frontmatter must be ${expected}`,
			);
		}
		if (name) {
			if (agentNames.has(name))
				errors.push(`${relativePath}: duplicate agent name ${name}`);
			agentNames.add(name);
		}

		const pkgName = frontmatterField(frontmatter, "package")?.value;
		if (pkgName && pkgName !== "hkx") {
			errors.push(`${relativePath}: package should be hkx (got ${pkgName})`);
		}

		const toolsRaw = frontmatterField(frontmatter, "tools")?.value;
		const tools = parseToolsList(toolsRaw);
		for (const tool of tools) {
			if (!allowedPiTools.has(tool)) {
				errors.push(`${relativePath}: unknown tool ${JSON.stringify(tool)}`);
			}
		}
		// Reject superseded search aliases. They are checked here intentionally
		// so newly-authored package surfaces cannot regress to pre-pi-fff names.
		if (
			tools.includes("grep") ||
			tools.includes("find") ||
			tools.includes("search")
		) {
			errors.push(
				`${relativePath}: use ffgrep/fffind instead of grep/find/search for pi-fff`,
			);
		}
		// Reject superseded pi-lens aliases for the same reason: current package
		// surfaces must use the explicit modern tool names.
		if (
			tools.includes("lsp") ||
			tools.includes("ast_grep") ||
			tools.includes("ast_edit")
		) {
			errors.push(
				`${relativePath}: use lsp_diagnostics/lsp_navigation/ast_grep_search/ast_grep_replace for pi-lens`,
			);
		}
	}

	// chains
	let chainFiles = [];
	try {
		chainFiles = (await fs.readdir(path.join(root, "chains"))).filter(
			(f) => f.endsWith(".chain.json") || f.endsWith(".chain.md"),
		);
	} catch {
		errors.push("missing chains/ directory");
	}
	for (const file of chainFiles) {
		const full = path.join(root, "chains", file);
		if (file.endsWith(".chain.json")) {
			try {
				const obj = JSON.parse(await fs.readFile(full, "utf8"));
				if (!obj.name || !obj.description || !Array.isArray(obj.chain)) {
					errors.push(
						`chains/${file}: must include name, description, chain[]`,
					);
				}
			} catch (err) {
				errors.push(`chains/${file}: invalid JSON: ${err.message}`);
			}
		}
	}

	// commands (prompt templates) / skills / rules — frontmatter only
	// On disk the directory remains commands/; package.json maps it as pi.prompts.
	for (const dir of ["commands", "skills", "rules"]) {
		const files = await collectMdFiles(path.join(root, dir));
		for (const filePath of files) {
			const relativePath = path.relative(root, filePath);
			const text = await fs.readFile(filePath, "utf8");
			// skills often use name+description; commands/prompts description; rules description
			errors.push(...requireFrontmatter(relativePath, text, ["description"]));
		}
	}

	if (errors.length) {
		for (const e of errors) console.error(e);
		process.exit(1);
	}
	console.log(
		`validate ok: ${agentFiles.length} agents, ${chainFiles.length} chains, package @hkx/pi-workflows (pi + pi-subagents)`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
