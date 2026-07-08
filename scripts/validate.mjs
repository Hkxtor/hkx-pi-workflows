import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
	"package.json",
	"README.md",
	".mcp.json",
	"mcp-configs/mcp-servers.json",
	"mcp-configs/templates/manifest.json",
	"mcp-configs/templates/memory.json",
	"mcp-configs/templates/reasoning.json",
	"mcp-configs/templates/research.json",
	"docs/conversion-map.md",
	"APPEND_SYSTEM.md",
	"commands/hkx-workflow.md",
	"commands/hkx-plan.md",
	"commands/hkx-plan-prd.md",
	"commands/hkx-build-fix.md",
	"commands/hkx-code-review.md",
	"commands/hkx-review-pr.md",
	"commands/hkx-update-codemaps.md",
	"commands/hkx-update-docs.md",
	"commands/hkx-checkpoint.md",
	"commands/hkx-quality-gate.md",
	"commands/hkx-security-scan.md",
	"commands/hkx-refactor-clean.md",
	"commands/hkx-test-coverage.md",
	"commands/hkx-project-init.md",
	"commands/hkx-recipes.md",
	"commands/hkx-orch-review.md",
	"commands/hkx-session-summary.md",
	"commands/hkx-delivery-gate.md",
	"commands/hkx-orch-add-feature.md",
	"commands/hkx-orch-build-mvp.md",
	"commands/hkx-orch-change-feature.md",
	"commands/hkx-orch-fix-defect.md",
	"commands/hkx-orch-refine-code.md",
	"commands/hkx-harness-audit.md",
	"commands/hkx-loop-start.md",
	"commands/hkx-loop-status.md",
	"commands/hkx-model-route.md",
	"skills/tdd-workflow/SKILL.md",
	"skills/security-review/SKILL.md",
	"skills/coding-standards/SKILL.md",
	"skills/frontend-patterns/SKILL.md",
	"skills/backend-patterns/SKILL.md",
	"skills/verification-loop/SKILL.md",
	"skills/typescript-workflow/SKILL.md",
	"skills/python-workflow/SKILL.md",
	"skills/rust-workflow/SKILL.md",
	"skills/go-workflow/SKILL.md",
	"skills/agent-architecture-audit/SKILL.md",
	"skills/agent-harness-construction/SKILL.md",
	"skills/agent-introspection-debugging/SKILL.md",
	"skills/ai-regression-testing/SKILL.md",
	"skills/bun-runtime/SKILL.md",
	"skills/rust-patterns/SKILL.md",
	"skills/rust-testing/SKILL.md",
	"skills/engineering-pack/SKILL.md",
	"skills/search-first/SKILL.md",
	"skills/error-handling/SKILL.md",
	"skills/iterative-retrieval/SKILL.md",
	"skills/intent-driven-development/SKILL.md",
	"skills/parallel-execution-optimizer/SKILL.md",
	"skills/gateguard/SKILL.md",
	"skills/strategic-compact/SKILL.md",
	"skills/api-design/SKILL.md",
	"skills/api-connector-builder/SKILL.md",
	"skills/hexagonal-architecture/SKILL.md",
	"skills/database-migrations/SKILL.md",
	"skills/production-audit/SKILL.md",
	"skills/repo-scan/SKILL.md",
	"skills/codebase-onboarding/SKILL.md",
	"skills/architecture-decision-records/SKILL.md",
	"skills/code-tour/SKILL.md",
	"skills/documentation-lookup/SKILL.md",
	"skills/e2e-testing/SKILL.md",
	"skills/accessibility/SKILL.md",
	"skills/ops-pack/SKILL.md",
	"skills/terminal-ops/SKILL.md",
	"skills/github-ops/SKILL.md",
	"skills/project-flow-ops/SKILL.md",
	"skills/deployment-patterns/SKILL.md",
	"skills/docker-patterns/SKILL.md",
	"skills/automation-audit-ops/SKILL.md",
	"skills/workspace-surface-audit/SKILL.md",
	"skills/canary-watch/SKILL.md",
	"skills/mcp-server-patterns/SKILL.md",
	"skills/git-workflow/SKILL.md",
	"skills/safety-guard/SKILL.md",
	"skills/security-scan/SKILL.md",
	"skills/loop-design-check/SKILL.md",
	"skills/growth-log/SKILL.md",
	"skills/agent-self-evaluation/SKILL.md",
	"skills/benchmark-optimization-loop/SKILL.md",
	"skills/content-hash-cache-pattern/SKILL.md",
	"skills/cost-aware-llm-pipeline/SKILL.md",
	"skills/data-throughput-accelerator/SKILL.md",
	"skills/latency-critical-systems/SKILL.md",
	"skills/prompt-optimizer/SKILL.md",
	"skills/recursive-decision-ledger/SKILL.md",
	"skills/regex-vs-llm-structured-text/SKILL.md",
	"skills/skill-stocktake/SKILL.md",
	"rules/hkx-common-security.md",
	"rules/hkx-common-testing.md",
	"rules/hkx-common-coding-style.md",
	"rules/hkx-common-code-review.md",
	"rules/hkx-common-development-workflow.md",
	"rules/hkx-common-git-workflow.md",
	"rules/hkx-common-patterns.md",
	"rules/hkx-common-performance.md",
	"rules/hkx-typescript.md",
	"rules/hkx-python.md",
	"rules/hkx-rust.md",
	"rules/hkx-go.md",
	"rules/hkx-ts-no-console-log.md",
	"rules/hkx-rust-no-unwrap.md",
	"rules/hkx-python-no-bare-except.md",
	"rules/hkx-web-design-quality.md",
	"rules/hkx-web-performance.md",
	"extensions/hkx-language-quality.ts",
	"extensions/hkx-gateguard.ts",
	"scripts/apply-mcp-profile.mjs",
	"agents/typescript-reviewer.md",
	"agents/build-error-resolver.md",
	"agents/python-reviewer.md",
	"agents/rust-reviewer.md",
	"agents/rust-build-resolver.md",
	"agents/go-reviewer.md",
	"agents/go-build-resolver.md",
	"agents/security-reviewer.md",
	"agents/code-reviewer.md",
	"agents/silent-failure-hunter.md",
	"agents/pr-test-analyzer.md",
	"agents/doc-updater.md",
	"agents/agent-evaluator.md",
	"agents/architect.md",
	"agents/planner.md",
	"agents/tdd-guide.md",
	"agents/refactor-cleaner.md",
	"agents/docs-lookup.md",
	"agents/e2e-runner.md",
	"agents/database-reviewer.md",
	"agents/loop-operator.md",
	"agents/harness-optimizer.md",
];

const disallowed = [
	new RegExp("\\." + "claude"),
	new RegExp("CLAUDE_" + "PLUGIN_ROOT"),
	new RegExp("Task" + "Output"),
	new RegExp("AskUser" + "Question"),
	new RegExp("subagent" + "_type"),
	new RegExp("Bash" + "\\("),
	new RegExp("~/\\." + "claude"),
];

async function isFile(filePath) {
	try {
		return (await fs.stat(filePath)).isFile();
	} catch {
		return false;
	}
}

async function collectMarkdownFiles(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async entry => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) return collectMarkdownFiles(fullPath);
			if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
			return [];
		}),
	);
	return nested.flat();
}

async function collectTextFiles(dir) {
	const extensions = new Set([".json", ".js", ".mjs", ".ts", ".md"]);
	const skippedDirs = new Set([".git", "." + "claude", "node_modules", "vendor", "generated", "dist", "build", "coverage", ".cache"]);
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async entry => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) return skippedDirs.has(entry.name) ? [] : collectTextFiles(fullPath);
			if (entry.isFile() && extensions.has(path.extname(entry.name))) return [fullPath];
			return [];
		}),
	);
	return nested.flat();
}

function frontmatterField(frontmatter, field) {
	const lines = frontmatter.split("\n");
	const pattern = new RegExp(`^${field}:\\s*(.*)$`);
	for (let index = 0; index < lines.length; index++) {
		const match = pattern.exec(lines[index]);
		if (!match) continue;
		const block = [];
		for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex++) {
			const line = lines[blockIndex];
			if (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(line)) break;
			block.push(line);
		}
		return { value: match[1].trim(), block };
	}
	return undefined;
}

function unquoteFrontmatterScalar(value) {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function parseFrontmatterList(frontmatter, field) {
	const entry = frontmatterField(frontmatter, field);
	if (!entry) return undefined;
	if (entry.value.length > 0) {
		const value = entry.value.startsWith("[") && entry.value.endsWith("]") ? entry.value.slice(1, -1) : entry.value;
		return value.split(",").map(unquoteFrontmatterScalar).filter(Boolean);
	}
	const items = [];
	for (const line of entry.block) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("-")) continue;
		const item = trimmed.slice(1).trim();
		if (!item) continue;
		if (item.startsWith("[") && item.endsWith("]")) {
			items.push(...item.slice(1, -1).split(",").map(unquoteFrontmatterScalar).filter(Boolean));
		} else {
			items.push(unquoteFrontmatterScalar(item));
		}
	}
	return items;
}

function requireFrontmatter(relativePath, text, requiredFields = ["description"]) {
	const errors = [];
	const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
	if (!match) return [`${relativePath}: missing complete frontmatter block`];

	const frontmatter = match[1];
	for (const field of requiredFields) {
		const entry = frontmatterField(frontmatter, field);
		if (!entry || (entry.value.length === 0 && !entry.block.some(line => line.trim().length > 0))) {
			errors.push(`${relativePath}: missing frontmatter field ${field}`);
		}
	}
	return errors;
}

function normalizePackagePath(entry) {
	return entry.replace(/^\.\//, "");
}

function sortJson(value) {
	if (Array.isArray(value)) return value.map(sortJson);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, nested]) => [key, sortJson(nested)]),
		);
	}
	return value;
}

const errors = [];

async function readJsonFile(relativePath) {
	try {
		return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
	} catch (error) {
		errors.push(`${relativePath}: invalid JSON ${error.message}`);
		return undefined;
	}
}

const requiredFileNames = new Set();
for (const relativePath of requiredFiles) {
	const normalizedPath = normalizePackagePath(relativePath);
	if (requiredFileNames.has(normalizedPath)) errors.push(`requiredFiles: duplicate required file ${relativePath}`);
	requiredFileNames.add(normalizedPath);
	if (!(await isFile(path.join(root, relativePath)))) errors.push(`missing required file: ${relativePath}`);
}

const commandFiles = await collectMarkdownFiles(path.join(root, "commands"));
for (const filePath of commandFiles) {
	const relativePath = path.relative(root, filePath);
	if (!path.basename(filePath).startsWith("hkx-")) errors.push(`${relativePath}: command must use hkx- prefix`);
	const text = await fs.readFile(filePath, "utf8");
	errors.push(...requireFrontmatter(relativePath, text));
}

const skillFiles = await collectMarkdownFiles(path.join(root, "skills"));
const skillNames = new Set();
for (const filePath of skillFiles) {
	if (path.basename(filePath) !== "SKILL.md") continue;
	const relativePath = path.relative(root, filePath);
	const text = await fs.readFile(filePath, "utf8");
	errors.push(...requireFrontmatter(relativePath, text, ["name", "description"]));
	const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
	if (!match) continue;
	const nameMatch = /^name:\s*(.+)$/m.exec(match[1]);
	const skillName = nameMatch?.[1]?.trim();
	const expectedName = `hkx-${path.basename(path.dirname(filePath))}`;
	if (skillName && skillName !== expectedName) errors.push(`${relativePath}: skill name must be ${expectedName}`);
	if (skillName) {
		if (skillNames.has(skillName)) errors.push(`${relativePath}: duplicate skill name ${skillName}`);
		skillNames.add(skillName);
	}
}

const ruleFiles = await collectMarkdownFiles(path.join(root, "rules"));
for (const filePath of ruleFiles) {
	const relativePath = path.relative(root, filePath);
	const text = await fs.readFile(filePath, "utf8");
	errors.push(...requireFrontmatter(relativePath, text));
}

const agentFiles = await collectMarkdownFiles(path.join(root, "agents"));
const allowedOmpTools = new Set(["read", "write", "edit", "bash", "search", "find", "lsp", "ast_grep", "ast_edit", "ask", "debug", "eval", "todo", "web_search", "browser", "task", "job", "irc", "resolve", "yield"]);
const agentNames = new Set();
for (const filePath of agentFiles) {
	const relativePath = path.relative(root, filePath);
	const text = await fs.readFile(filePath, "utf8");
	errors.push(...requireFrontmatter(relativePath, text, ["name", "description", "tools"]));
	const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
	if (!match) continue;

	const frontmatter = match[1];
	const nameMatch = /^name:\s*(.+)$/m.exec(frontmatter);
	const agentName = nameMatch?.[1]?.trim();
	const expectedName = path.basename(filePath, ".md");
	if (agentName && agentName !== expectedName) {
		errors.push(`${relativePath}: agent name in frontmatter must be ${expectedName}`);
	}
	if (agentName) {
		if (agentNames.has(agentName)) errors.push(`${relativePath}: duplicate agent name ${agentName}`);
		agentNames.add(agentName);
	}

	const tools = parseFrontmatterList(frontmatter, "tools");
	if (tools) {
		for (const rawTool of tools) {
			const tool = rawTool.toLowerCase();
			if (!allowedOmpTools.has(tool)) {
				errors.push(`${relativePath}: disallowed or non-OMP canonical tool name ${JSON.stringify(rawTool)}`);
			}
		}
	}
}

const textFiles = await collectTextFiles(root);
for (const filePath of textFiles) {
	const relativePath = path.relative(root, filePath);
	const text = await fs.readFile(filePath, "utf8");
	for (const pattern of disallowed) {
		if (pattern.test(text)) errors.push(`${relativePath}: disallowed non-OMP residue ${pattern}`);
	}
}

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const extensionEntries = packageJson?.omp?.extensions;
const allowedExtensions = new Set(["extensions/hkx-language-quality.ts",
	"extensions/hkx-gateguard.ts"]);
if (!Array.isArray(extensionEntries)) {
	errors.push("package.json: omp.extensions must be an array");
} else {
	const normalizedEntries = new Set();
	for (const entry of extensionEntries) {
		if (typeof entry !== "string") {
			errors.push(`package.json: OMP extension entry must be a string ${JSON.stringify(entry)}`);
			continue;
		}
		const normalizedEntry = normalizePackagePath(entry);
		normalizedEntries.add(normalizedEntry);
		if (!allowedExtensions.has(normalizedEntry)) errors.push(`package.json: unexpected OMP extension entry ${entry}`);
		const resolved = path.resolve(root, entry);
		const relative = path.relative(root, resolved);
		if (relative.startsWith("..") || path.isAbsolute(relative)) errors.push(`package.json: OMP extension escapes package root ${entry}`);
		if (!(await isFile(resolved))) errors.push(`package.json: OMP extension file not found ${entry}`);
	}
	for (const entry of allowedExtensions) {
		if (!normalizedEntries.has(entry)) errors.push(`package.json: missing OMP extension entry ${entry}`);
	}
}

const mcpCatalog = await readJsonFile("mcp-configs/mcp-servers.json");
const templateManifest = await readJsonFile("mcp-configs/templates/manifest.json");
const templateProfiles = templateManifest?.profiles;
if (!templateProfiles || typeof templateProfiles !== "object" || Array.isArray(templateProfiles)) {
	errors.push("mcp-configs/templates/manifest.json: profiles must be an object");
} else {
	const seenTemplateFiles = new Set();
	for (const [profileName, profile] of Object.entries(templateProfiles)) {
		if (!/^[a-z0-9-]+$/.test(profileName)) {
			errors.push(`mcp-configs/templates/manifest.json: invalid profile name ${JSON.stringify(profileName)}`);
		}
		if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
			errors.push(`mcp-configs/templates/manifest.json: profile ${profileName} must be an object`);
			continue;
		}

		const { description, file, servers, requiresEnv } = profile;
		if (typeof description !== "string" || description.trim().length === 0) {
			errors.push(`mcp-configs/templates/manifest.json: profile ${profileName} missing description`);
		}
		if (typeof file !== "string" || file.trim().length === 0) {
			errors.push(`mcp-configs/templates/manifest.json: profile ${profileName} missing file`);
			continue;
		}
		if (file.includes("..") || path.isAbsolute(file)) {
			errors.push(`mcp-configs/templates/manifest.json: profile ${profileName} file must stay within templates/`);
			continue;
		}
		if (seenTemplateFiles.has(file)) {
			errors.push(`mcp-configs/templates/manifest.json: duplicate template file ${file}`);
		}
		seenTemplateFiles.add(file);

		if (!Array.isArray(servers) || servers.length === 0 || !servers.every(server => typeof server === "string" && server.trim().length > 0)) {
			errors.push(`mcp-configs/templates/manifest.json: profile ${profileName} must declare a non-empty servers array`);
			continue;
		}
		if (requiresEnv !== undefined && (!Array.isArray(requiresEnv) || !requiresEnv.every(entry => typeof entry === "string" && entry.trim().length > 0))) {
			errors.push(`mcp-configs/templates/manifest.json: profile ${profileName} requiresEnv must be an array of strings`);
		}

		const templatePath = path.join("mcp-configs", "templates", file);
		const template = await readJsonFile(templatePath);
		const templateServers = template?.mcpServers;
		if (!templateServers || typeof templateServers !== "object" || Array.isArray(templateServers)) {
			errors.push(`${templatePath}: mcpServers must be an object`);
			continue;
		}

		const templateServerNames = Object.keys(templateServers).sort();
		const declaredServers = [...servers].sort();
		if (JSON.stringify(templateServerNames) !== JSON.stringify(declaredServers)) {
			errors.push(`${templatePath}: template server names must match manifest servers for profile ${profileName}`);
		}

		for (const serverName of templateServerNames) {
			const catalogServer = mcpCatalog?.mcpServers?.[serverName];
			if (!catalogServer) {
				errors.push(`${templatePath}: server ${serverName} not found in mcp-configs/mcp-servers.json`);
				continue;
			}
			const templateServer = templateServers[serverName];
			if (JSON.stringify(sortJson(templateServer)) !== JSON.stringify(sortJson(catalogServer))) {
				errors.push(`${templatePath}: server ${serverName} must match the reference catalog entry`);
			}
		}
	}
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log(`Validated ${requiredFiles.length} required files and ${textFiles.length} text files.`);
