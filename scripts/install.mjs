#!/usr/bin/env node
/**
 * Full-operator package installer for @hkx/pi-workflows.
 *
 * npm entry: npm run install-global
 *
 * MF-6: the .mcp.json -> ~/.pi/agent/mcp.json merge path routes each
 * server through scripts/lib/mcp-resolver.mjs::scanServerForRefusal, the
 * same SSOT used by scripts/apply-mcp-profile.mjs, so the install path
 * cannot silently persist literal ${VAR} or YOUR_*_HERE templates once
 * .mcp.json grows env/headers/args/url.
 *
 * Dual install model:
 * - `pi install git:...` / `pi install npm:...` loads official package resources
 *   declared in package.json (`pi` + `pi-subagents`). That path does NOT run
 *   this script and does not write rules, MCP, GLOBAL_AGENTS, or settings/keybindings overlays.
 * - `npm run install-global` (this file) is the complete operator path: it syncs
 *   every surface into ~/.pi/agent, including overlays that pi package install
 *   cannot express.
 *
 * Syncs package surfaces into ~/.pi/agent for pi / pi-subagents discovery:
 * - agents/*.md              -> ~/.pi/agent/agents/hkx/*.md   (runtime: hkx.<name>)
 * - chains/*                 -> ~/.pi/agent/chains/
 * - commands/ skills/ rules/ -> ~/.pi/agent/{commands,prompts,skills,rules}/
 *   (commands/ is also linked into prompts/ for current pi slash discovery)
 * - package.json pi.extensions -> ~/.pi/agent/extensions/
 * - configs/agent-settings.json
 *                            -> deep-merge into ~/.pi/agent/settings.json
 *                              (managed keys: packages, portable defaults)
 * - configs/keybindings.json -> merge managed actions into
 *                              ~/.pi/agent/keybindings.json
 *                              (preserve non-managed operator bindings)
 * - configs/pi-lsp/pi-lsp.json
 *                            -> ~/.pi/agent/pi-lsp.json (managed LSP routes)
 * - GLOBAL_AGENTS.md         -> ~/.pi/agent/AGENTS.md
 * - APPEND_SYSTEM.md         -> ~/.pi/agent/APPEND_SYSTEM.md
 * - .mcp.json                -> safe-merge into ~/.pi/agent/mcp.json
 *                              (hard-fail on corrupt dest; preserve env/headers;
 *                               backup before write; never wipe user tokens)
 * - mcp-configs/             -> ~/.pi/agent/hkx-pi-workflows/mcp-configs/ (reference)
 * - scripts/apply-mcp-profile.mjs + scripts/lib/mcp-resolver.mjs
 *                            -> ~/.pi/agent/hkx-pi-workflows/scripts/
 *                              (C1: resolver is a hard dependency of the helper)
 * - then: pi update --extensions (install/update packages listed in settings)
 * - configs/pi-permission-system/config.json
 *                            -> ~/.pi/agent/extensions/pi-permission-system/config.json
 *                              (after package update; creates the extension dir if missing)
 * - configs/rpiv-advisor/advisor.json
 *                            -> ~/.config/rpiv-advisor/advisor.json
 *                              (or $XDG_CONFIG_HOME/rpiv-advisor/advisor.json)
 *                              seed-if-missing only: never overwrite /advisor choices
 * - configs/pi-tool-display/config.json
 *                            -> ~/.pi/agent/extensions/pi-tool-display/config.json
 *                              (after package update; seed-if-missing only: the
 *                               extension's /tool-display settings UI rewrites it)
 * - configs/magic-context/magic-context.jsonc
 *                            -> ${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc
 *                              (or ~/.config/cortexkit/magic-context.jsonc)
 *                              authoritative managed overlay: copied on every
 *                              install (never symlinked); existing destination
 *                              is backed up before write so operator-edited
 *                              values are recoverable. Magic Context owns
 *                              compaction; pi native compaction is disabled
 *                              in configs/agent-settings.json.
 *
 * This is the full operator install path. It does not run migration helpers.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { scanServerForRefusal } from "./lib/mcp-resolver.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const piHome = path.join(os.homedir(), ".pi", "agent");

async function ensureDir(dir) {
	await fs.mkdir(dir, { recursive: true });
}

async function pathExists(p) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function linkOrCopy(src, dest, { copyOnly = false } = {}) {
	try {
		await fs.rm(dest, { force: true, recursive: true });
	} catch {
		// ignore
	}

	if (copyOnly) {
		await fs.cp(src, dest, { recursive: true });
		console.log(`Copied: ${dest} <- ${src}`);
		return;
	}

	try {
		await fs.symlink(src, dest);
		console.log(`Linked: ${dest} -> ${src}`);
	} catch {
		await fs.cp(src, dest, { recursive: true });
		console.log(`Copied: ${dest} <- ${src}`);
	}
}

/**
 * Merge package MCP defaults into an existing user mcp.json without wiping secrets.
 *
 * Safety rules (P0):
 * - Source parse failure → abort (caller / main exits non-zero).
 * - Destination exists but JSON.parse fails → hard-fail (never rewrite as empty).
 * - Same-name servers: dest env/headers win so install cannot clobber user tokens.
 * - Existing dest file is backed up before write.
 */
function isPlainObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSecretMaps(srcMap, destMap) {
	// Dest keys always win (preserve real tokens). Src only fills missing keys.
	return {
		...(isPlainObject(srcMap) ? srcMap : {}),
		...(isPlainObject(destMap) ? destMap : {}),
	};
}

function mergeServerConfig(destServer, srcServer) {
	if (!isPlainObject(destServer)) {
		return structuredClone(srcServer);
	}
	if (!isPlainObject(srcServer)) {
		return structuredClone(destServer);
	}

	const merged = { ...destServer };
	for (const [key, value] of Object.entries(srcServer)) {
		if (key === "env" || key === "headers") continue;
		// Do not overwrite user-owned fields when dest already set.
		if (merged[key] === undefined) {
			merged[key] = value;
		}
	}

	if (srcServer.env !== undefined || destServer.env !== undefined) {
		merged.env = mergeSecretMaps(srcServer.env, destServer.env);
	}
	if (srcServer.headers !== undefined || destServer.headers !== undefined) {
		merged.headers = mergeSecretMaps(srcServer.headers, destServer.headers);
	}
	return merged;
}

const LEGACY_CONTEXT7_DEFAULT_ARGS = [
	"-y",
	"@upstash/context7-mcp@2.1.4",
];
const MCP_TRANSPORT_KEYS = new Set([
	"command",
	"args",
	"socket",
	"type",
	"url",
	"cwd",
]);

function hasStdioTransport(server) {
	return isPlainObject(server) &&
		(typeof server.command === "string" || typeof server.socket === "string");
}

function hasHttpTransport(server) {
	return isPlainObject(server) && typeof server.url === "string";
}

function isLegacyContext7Default(server) {
	return hasStdioTransport(server) &&
		server.command === "npx" &&
		server.url === undefined &&
		server.socket === undefined &&
		Array.isArray(server.args) &&
		server.args.length === LEGACY_CONTEXT7_DEFAULT_ARGS.length &&
		server.args.every((arg, index) => arg === LEGACY_CONTEXT7_DEFAULT_ARGS[index]);
}

function migrateContext7ToHttp(destServer, srcServer) {
	const migrated = structuredClone(srcServer);
	for (const [key, value] of Object.entries(destServer)) {
		if (MCP_TRANSPORT_KEYS.has(key)) continue;
		if (key === "env" || key === "headers") {
			migrated[key] = mergeSecretMaps(migrated[key], value);
			continue;
		}
		// Preserve explicit operator choices such as disabled/directTools.
		migrated[key] = structuredClone(value);
	}
	return migrated;
}

function mergeMcpServers(destServers, srcServers, { sourceLabel, env } = {}) {
	// MF-6: every server that lands in ~/.pi/agent/mcp.json — whether newly
	// added or preserved — must pass the same resolver/placeholder/unresolved
	// guards that apply-mcp-profile enforces, so the install path cannot
	// silently persist literal ${VAR} or YOUR_*_HERE from a future .mcp.json
	// env/args/url/headers edit. scanServerForRefusal throws on unresolved
	// or placeholder, mutates in-place, and returns an allowlist shape.
	// M5: optional `env` is threaded through so tests can pin a frozen env
	// and production can keep the default (process.env) when omitted.
	const dest = isPlainObject(destServers) ? destServers : {};
	const src = isPlainObject(srcServers) ? srcServers : {};
	const out = { ...dest };
	const added = [];
	const preserved = [];
	const migrated = [];
	const transportConflicts = [];

	for (const [name, srcServer] of Object.entries(src)) {
		if (out[name] === undefined) {
			const guardeded = scanServerForRefusal(name, structuredClone(srcServer), {
				sourceLabel,
				env,
			});
			out[name] = guardeded;
			added.push(name);
		} else {
			// M2: for a preserved server, scan ONLY the source-supplied
			// values (those the merge is introducing). The operator's
			// pre-existing dest-owned values (env/headers/args/command/url)
			// are carried over via mergeServerConfig and are not re-checked:
			// they predate this install (possibly from a pre-guard era) and
			// checking them would throw on the operator's own ${VAR} refs,
			// blocking ALL future MCP-config upgrades until they hand-fix
			// their dest file. Dest-owned values stay as the operator wrote
			// them; source-supplied new values pass the refuse guard.
			const scanned = scanServerForRefusal(name, structuredClone(srcServer), {
				sourceLabel,
				env,
			});

			if (name === "context7" && hasHttpTransport(scanned) && hasStdioTransport(out[name])) {
				if (isLegacyContext7Default(out[name])) {
					out[name] = migrateContext7ToHttp(out[name], scanned);
					migrated.push(name);
				} else {
					// A user-managed stdio Context7 must never gain a conflicting URL.
					out[name] = structuredClone(out[name]);
					preserved.push(name);
					transportConflicts.push(name);
				}
			} else {
				out[name] = mergeServerConfig(out[name], scanned);
				preserved.push(name);
			}
		}
	}

	return { servers: out, added, preserved, migrated, transportConflicts };
}

async function mergeMcpConfig(srcPath, destPath, { env } = {}) {
	let srcContent;
	try {
		const rawSrc = await fs.readFile(srcPath, "utf-8");
		srcContent = JSON.parse(rawSrc);
	} catch (err) {
		throw new Error(
			`Failed to read source MCP config ${srcPath}: ${err.message}`,
		);
	}
	if (!isPlainObject(srcContent)) {
		throw new Error(`Source MCP config must be a JSON object: ${srcPath}`);
	}
	if (!isPlainObject(srcContent.mcpServers)) {
		srcContent.mcpServers = {};
	}

	const destExists = await pathExists(destPath);
	let destContent = {
		mcpServers: {},
	};

	if (destExists) {
		let rawDest;
		try {
			rawDest = await fs.readFile(destPath, "utf-8");
		} catch (err) {
			throw new Error(
				`Failed to read destination MCP config ${destPath}: ${err.message}`,
			);
		}
		try {
			destContent = JSON.parse(rawDest);
		} catch (err) {
			// Hard-fail: never rewrite a corrupt user mcp.json as {}.
			throw new Error(
				`Destination MCP config is invalid JSON (${destPath}): ${err.message}. ` +
					"Fix or remove it before re-running install-global (refusing to wipe tokens).",
			);
		}
		if (!isPlainObject(destContent)) {
			throw new Error(
				`Destination MCP config must be a JSON object: ${destPath}`,
			);
		}
		if (!isPlainObject(destContent.mcpServers)) {
			destContent.mcpServers = {};
		}
	}

	const { servers, added, preserved, migrated, transportConflicts } = mergeMcpServers(
		destContent.mcpServers,
		srcContent.mcpServers,
		{ sourceLabel: srcPath, env },
	);
	destContent.mcpServers = servers;

	// M2: back up the existing dest ONLY after the merge scan passes,
	// so a throw from mergeMcpServers does not leave a stale .bak.* file.
	if (destExists) {
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = `${destPath}.bak.${stamp}`;
		await fs.copyFile(destPath, backupPath);
		console.log(`Backed up MCP config: ${backupPath}`);
	}

	// Carry optional package-level keys only when dest lacks them.
	for (const key of Object.keys(srcContent)) {
		if (key === "mcpServers") continue;
		if (destContent[key] === undefined) {
			destContent[key] = srcContent[key];
		}
	}

	await fs.writeFile(destPath, JSON.stringify(destContent, null, 2), "utf-8");
	console.log(`Merged MCP configuration: ${destPath}`);
	console.log(`  added servers: ${added.length ? added.join(", ") : "(none)"}`);
	console.log(
		`  preserved existing (env/headers kept): ${preserved.length ? preserved.join(", ") : "(none)"}`,
	);
	console.log(
		`  migrated package defaults: ${migrated.length ? migrated.join(", ") : "(none)"}`,
	);
	if (transportConflicts.length > 0) {
		console.warn(
			`  kept custom stdio transport (not mixed with HTTP): ${transportConflicts.join(", ")}`,
		);
	}
}

/** Deep-merge objects; arrays are replaced by source (not concatenated). */
function deepMerge(target, source) {
	if (source === null || typeof source !== "object" || Array.isArray(source)) {
		return source;
	}
	const out =
		target && typeof target === "object" && !Array.isArray(target)
			? { ...target }
			: {};
	for (const [key, value] of Object.entries(source)) {
		if (
			value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			out[key] &&
			typeof out[key] === "object" &&
			!Array.isArray(out[key])
		) {
			out[key] = deepMerge(out[key], value);
		} else {
			out[key] = value;
		}
	}
	return out;
}

/**
 * Machine-local agent settings seeded on Windows installs only, and only when
 * the operator has NOT already set them. These are deliberately NOT versioned
 * in configs/agent-settings.json (validate.mjs rejects shellPath as a
 * managed key): they come from the OS the install runs on, so the repo stays
 * portable while a fresh Windows operator still lands a sensible default
 * shell (PowerShell 7) and a pi-native tool list.
 */
const WINDOWS_AGENT_SETTINGS_DEFAULTS = {
	shellPath: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
	defaultTools: [
		"read",
		"powershell",
		"edit",
		"write",
		"grep",
		"find",
		"ls",
	],
};

/**
 * Build Windows tool overrides for pi-subagents discovered agents by scanning
 * the installed hkx agent definitions (`~/.pi/agent/agents/hkx/*.md`), not by
 * hard-coding a role name. Each agent keeps its own declared tool set, with the
 * native `bash` shell replaced by `powershell` (the shell available on win32).
 * Agents already carrying `powershell` or that do not use a shell are left
 * unchanged. These are machine-local, so they are never versioned in
 * configs/agent-settings.json — they come from the OS the install runs on.
 *
 * The returned keys are the pi-subagents RUNTIME names (`<package>.<name>`, or
 * bare `<name>` when no package frontmatter), because `agentOverrides.<name>`
 * is matched against the agent's runtime name (agents.ts: `agent.name`). For
 * the hkx package that is `hkx.<name>`.
 *
 * Returns `{ runtimeName: { tools: [...] } }` keyed by runtime name.
 */
async function buildWindowsSubagentOverrides(agentsDir) {
	const overrides = {};
	let names;
	try {
		names = await fs.readdir(agentsDir);
	} catch (err) {
		// Missing/unreadable agent dir is not a settings failure: nothing to
		// seed. Callers must not treat this as a merge error.
		console.warn(`Skipping Windows subagent overrides (cannot read ${agentsDir}): ${err.message}`);
		return overrides;
	}

	for (const file of names) {
		if (!file.endsWith(".md")) continue;
		let text;
		try {
			text = await fs.readFile(path.join(agentsDir, file), "utf-8");
		} catch {
			continue;
		}
		const localName = parseAgentFrontmatterName(text);
		const rawTools = parseAgentFrontmatterTools(text);
		if (!localName || !rawTools) continue;
		// Runtime name matches how pi-subagents keys agentOverrides:
		// `<package>.<name>` when a package is declared, else bare `<name>`.
		const pkg = parseAgentFrontmatterPackage(text);
		const runtimeName = pkg ? `${pkg}.${localName}` : localName;
		// Swap the native shell for the Windows shell; keep every other tool.
		const windowsTools = rawTools.map((t) => (t === "bash" ? "powershell" : t));
		overrides[runtimeName] = { tools: windowsTools };
	}
	return overrides;
}

/** Extract the `name` value from an agent frontmatter block, or null. */
function parseAgentFrontmatterName(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
	if (!m) return null;
	const line = /^name:\s*(.*)$/m.exec(m[1]);
	return line ? line[1].trim() : null;
}

/** Extract the `package` namespace value from an agent frontmatter block, or null. */
function parseAgentFrontmatterPackage(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
	if (!m) return null;
	const line = /^package:\s*(.*)$/m.exec(m[1]);
	const value = line ? line[1].trim() : "";
	return value ? value : null;
}

/**
 * Extract the `tools` array from an agent frontmatter block. Accepts a JSON
 * array (`tools: ["read", "edit"]`) or the comma/space-separated YAML form
 * (`tools: read, ffgrep, find`). A JSON-ish entry that fails to parse falls
 * through to the comma/split path (matching validate.mjs parseToolsList) so an
 * agent is never silently skipped. Returns null when tools is absent/blank.
 */
function parseAgentFrontmatterTools(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
	if (!m) return null;
	const line = /^tools:\s*(.*)$/m.exec(m[1]);
	if (!line) return null;
	const raw = line[1].trim();
	if (!raw) return null;
	if (raw.startsWith("[")) {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return parsed.map(String);
		} catch {
			// fall through to the comma/split path below (e.g. [read, grep])
		}
	}
	return raw
		.replace(/[\[\]"]/g, "")
		.split(/,/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Seed Windows subagent tool overrides into a settings object in place,
 * keyed by agent name from the scan. Each agent's `tools` list is set ONLY
 * when that agent has none yet (seed-if-missing): an operator who already
 * configured a tool list for a given agent keeps theirs, and unrelated
 * agentOverrides keys are untouched. Missing nested objects are created so a
 * fresh install still lands the per-agent defaults.
 */
function seedWindowsSubagentOverrides(target, overrides) {
	// Nothing derived from the agent dir -> leave subagents untouched (no
	// empty agentOverrides scaffold on a blank dest).
	const entries = Object.entries(overrides || {});
	if (entries.length === 0) return;

	const sub = target.subagents;
	const subagents = isPlainObject(sub) ? sub : {};
	const agentOverrides = isPlainObject(subagents.agentOverrides)
		? subagents.agentOverrides
		: {};

	for (const [agentName, override] of entries) {
		if (!isPlainObject(agentOverrides[agentName])) {
			agentOverrides[agentName] = {
				tools: [...override.tools],
			};
		} else if (agentOverrides[agentName].tools === undefined) {
			agentOverrides[agentName].tools = [...override.tools];
		}
	}

	subagents.agentOverrides = agentOverrides;
	target.subagents = subagents;
}

/**
 * Merge managed agent settings into ~/.pi/agent/settings.json.
 * Managed keys from configs/agent-settings.json overwrite local values.
 * packages is replaced by the managed list (authoritative), not unioned.
 * Machine-local keys (shellPath, defaultProvider, …) are preserved when absent from source.
 *
 * Optional `options.platform` (defaults to process.platform when available)
 * lets tests pin a fixed platform via vm without a global `process`. These are
 * machine-local keys, so a Windows default is seeded ONLY when the operator has
 * not already set it (seed-if-missing, same contract as the rpiv-advisor and
 * pi-tool-display overlays).
 *
 * Optional `options.agentsDir` points at the installed hkx agent directory;
 * when platform is win32 and it is set, per-agent `subagents.agentOverrides`
 * tool lists (bash -> powershell) are derived from those agent definitions and
 * seeded under `subagents.agentOverrides.<name>.tools` (seed-if-missing per
 * agent). Tests pass a temp agent dir; the install path passes the hkx dir.
 *
 * Returns `true` on success, `false` on a read/parse failure. The caller must
 * push a label into failed[] on `false` so the install path cannot silently
 * claim success while agent settings failed to merge (MF-7).
 */
async function mergeAgentSettings(srcPath, destPath, options) {
	// IMPORTANT: never reference process.platform in a parameter default here.
	// The vm-isolated regression suite loads mergeAgentSettings without a global
	// `process`, so a default parameter would throw ReferenceError on evaluation.
	const platform =
		options?.platform ??
		(typeof process !== "undefined" ? process.platform : undefined);
	let managed;
	try {
		managed = JSON.parse(await fs.readFile(srcPath, "utf-8"));
	} catch (err) {
		console.error(`Failed to read agent settings: ${err.message}`);
		return false;
	}

	let current = {};
	try {
		current = JSON.parse(await fs.readFile(destPath, "utf-8"));
	} catch (err) {
		// M1: only ENOENT (first install) may fall through to {}
		// gracefully. Any other failure (corrupt JSON, EACCES, EISDIR,
		// EPERM, …) must NOT be swallowed — it would be followed by
		// deepMerge({}, managed) → writeFile overwriting the operator's
		// settings with managed-only content, silently wiping
		// machine-local keys (shellPath, defaultProvider, etc.).
		if (err.code !== "ENOENT") {
			console.error(
				`Failed to read existing agent settings (${destPath}): ${err.message}`,
			);
			return false;
		}
		// init empty — dest may not exist yet on first install
	}

	// M1 (silent-failure finding-1): a dest that parses as valid JSON but is
	// NOT a plain object (e.g. `[]`, `null`, `"string"`, `123`, `true`) would
	// be silently re-seeded to {} by deepMerge and then overwritten with
	// managed-only content — wiping the operator's machine-local keys. Mirror
	// the mergeMcpConfig dest guard (scripts/install.mjs:214).
	if (!isPlainObject(current)) {
		console.error(
			`Destination agent settings must be a JSON object (${destPath})`,
		);
		return false;
	}

	const next = deepMerge(current, managed);

	// packages: managed list is authoritative (order preserved)
	if (Array.isArray(managed.packages)) {
		next.packages = managed.packages;
	}

	// Remove settings that this package previously managed but has retired.
	// A plain deep merge cannot delete absent source keys, which would otherwise
	// leave pi-observational-memory options behind after its package is removed.
	for (const retiredKey of ["observational-memory"]) {
		delete next[retiredKey];
	}

	// Windows-only machine-local defaults, seeded only when the operator has
	// not already set them. deepMerge already carries a pre-existing dest
	// shellPath/defaultTools and any agentOverrides through (they are not
	// managed keys), so this is a documented seed-if-missing fallback, not an
	// overwrite.
	if (platform === "win32") {
		if (next.shellPath === undefined) {
			next.shellPath = WINDOWS_AGENT_SETTINGS_DEFAULTS.shellPath;
		}
		if (next.defaultTools === undefined) {
			next.defaultTools = [...WINDOWS_AGENT_SETTINGS_DEFAULTS.defaultTools];
		}
		// Per-agent Windows tool overrides, derived from the installed hkx
		// agent definitions (bash -> powershell), seeded only for agents the
		// operator has not already configured. Requires the scanned agent dir.
		if (options?.agentsDir) {
			const subagentOverrides = await buildWindowsSubagentOverrides(
				options.agentsDir,
			);
			seedWindowsSubagentOverrides(next, subagentOverrides);
		}
	}

	await fs.writeFile(destPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
	const pkgCount = Array.isArray(next.packages) ? next.packages.length : 0;
	console.log(
		`Merged agent settings (${pkgCount} packages, managed keys): ${destPath}`,
	);
	return true;
}

function isValidKeybindingValue(value) {
	if (typeof value === "string") return value.trim().length > 0;
	if (!Array.isArray(value)) return false;
	return value.every(
		(binding) => typeof binding === "string" && binding.trim().length > 0,
	);
}

function validateKeybindingsConfig(config, label) {
	if (!isPlainObject(config)) return `${label} must be a JSON object`;
	for (const [action, value] of Object.entries(config)) {
		if (!isValidKeybindingValue(value)) {
			return `${label}.${action} must be a key string or string array`;
		}
	}
	return null;
}

/** Merge package-managed actions while preserving unrelated operator bindings. */
async function mergeKeybindingsConfig(srcPath, destPath) {
	let managed;
	try {
		managed = JSON.parse(await fs.readFile(srcPath, "utf-8"));
	} catch (err) {
		console.error(`Failed to read keybindings config: ${err.message}`);
		return false;
	}
	const sourceError = validateKeybindingsConfig(managed, "Managed keybindings");
	if (sourceError) {
		console.error(`${sourceError} (${srcPath})`);
		return false;
	}

	let current = {};
	try {
		current = JSON.parse(await fs.readFile(destPath, "utf-8"));
	} catch (err) {
		if (err.code !== "ENOENT") {
			console.error(`Failed to read existing keybindings (${destPath}): ${err.message}`);
			return false;
		}
	}
	const destError = validateKeybindingsConfig(current, "Destination keybindings");
	if (destError) {
		console.error(`${destError} (${destPath})`);
		return false;
	}

	const next = { ...current, ...managed };
	await fs.writeFile(destPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
	console.log(
		`Merged keybindings (${Object.keys(managed).length} managed actions): ${destPath}`,
	);
	return true;
}

function getPiUpdateInvocation(platform = process.platform, env = process.env) {
	if (platform === "win32") {
		// npm exposes global CLIs as .cmd shims on Windows. Node cannot execute
		// those shims directly with spawn(), so run this fixed command via cmd.exe.
		return {
			command: env.ComSpec || env.COMSPEC || "cmd.exe",
			args: ["/d", "/c", "pi.cmd update --extensions"],
		};
	}

	return { command: "pi", args: ["update", "--extensions"] };
}

/**
 * Windows-only shell-tool alias seeded into pi-permission-system config. On
 * win32 the native `bash` tool is replaced by `powershell` (see
 * mergeAgentSettings), so the permission system must be told that
 * `powershell` carries shell semantics — otherwise `powershell` calls bypass
 * the bash enforcement stack (command decomposition, wrapper flooring,
 * path/external-directory token gates, and `bash:` rules). The tool's input
 * argument holding the command string is `command`. Never versioned in the
 * source config; it is a machine-local Windows seed.
 */
const WINDOWS_PERMISSION_SHELL_TOOLS = {
	powershell: { commandArgument: "command" },
};

/**
 * Seed Windows shell-tool aliases into a pi-permission-system config object
 * in place, adding each tool ONLY when the operator has not already set it
 * (seed-if-missing). A non-object `shellTools` value is treated as missing
 * (the schema requires an object, so a non-object entry is invalid) and is
 * replaced with a seeded object; missing nested objects are created so a
 * fresh install still lands the defaults.
 */
function seedWindowsPermissionShellTools(config) {
	const shellTools = isPlainObject(config.shellTools)
		? config.shellTools
		: {};
	for (const [tool, mapping] of Object.entries(WINDOWS_PERMISSION_SHELL_TOOLS)) {
		if (!isPlainObject(shellTools[tool])) {
			shellTools[tool] = { ...mapping };
		}
	}
	config.shellTools = shellTools;
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			...options,
		});
		child.on("error", (err) => {
			console.error(`Failed to spawn ${command}: ${err.message}`);
			resolve({ ok: false, code: 1 });
		});
		child.on("close", (code) => {
			resolve({ ok: code === 0, code: code ?? 1 });
		});
	});
}

async function updatePiExtensions() {
	console.log("Updating pi packages (pi update --extensions)...");
	const { command, args } = getPiUpdateInvocation();
	const result = await runCommand(command, args);
	if (!result.ok) {
		console.warn(
			`Warning: pi update --extensions exited with code ${result.code}. Settings were still written; install packages manually if needed.`,
		);
		return false;
	}
	console.log("Pi packages updated successfully.");
	return true;
}

/**
 * Install managed pi-permission-system config overlay.
 * Runs after `pi update --extensions` so a first-time install can create
 * ~/.pi/agent/extensions/pi-permission-system/ when the package did not
 * materialize that path yet (common on cold install).
 *
 * Optional `options.platform` (defaults to process.platform when available)
 * lets tests pin a fixed platform. On win32 the overlay is copied (not
 * symlinked) and seeded with `shellTools.powershell` so the permission system
 * gates the Windows `powershell` shell tool through the same stack as native
 * `bash`; the seed is per-tool seed-if-missing. On other platforms the source
 * is symlinked as before.
 */
async function installPermissionSystemConfig(options) {
	const platform =
		options?.platform ??
		(typeof process !== "undefined" ? process.platform : undefined);
	const permissionConfigSrc = path.join(
		repoRoot,
		"configs",
		"pi-permission-system",
		"config.json",
	);
	if (!(await pathExists(permissionConfigSrc))) {
		console.warn(
			"Skip pi-permission-system config: source missing at",
			permissionConfigSrc,
		);
		return false;
	}

	const permissionExtDir = path.join(
		piHome,
		"extensions",
		"pi-permission-system",
	);
	await ensureDir(permissionExtDir);
	const dest = path.join(permissionExtDir, "config.json");
	// On win32, copy (not symlink) so we can merge the Windows shellTools seed
	// into the target without mutating the cross-platform source file. Other
	// platforms keep the symlink for source-update propagation.
	const copyOnly = platform === "win32";
	await linkOrCopy(permissionConfigSrc, dest, { copyOnly });
	if (copyOnly) {
		let raw;
		try {
			raw = await fs.readFile(dest, "utf-8");
		} catch (err) {
			console.error(
				`Failed to read pi-permission-system config for Windows seed: ${err.message}`,
			);
			return false;
		}
		let config;
		try {
			config = JSON.parse(raw);
		} catch (err) {
			console.error(
				`Failed to parse pi-permission-system config for Windows seed: ${err.message}`,
			);
			return false;
		}
		seedWindowsPermissionShellTools(config);
		await fs.writeFile(dest, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
		console.log("Seeded Windows shellTools.powershell into:", dest);
	}
	return true;
}

/**
 * Install the managed primary-language routes for @narumitw/pi-lsp.
 * Custom pi-lsp maps replace the upstream catalog, so this source stays
 * explicit and is linked/copied on every full operator installation.
 */
async function installPiLspConfig() {
	const src = path.join(repoRoot, "configs", "pi-lsp", "pi-lsp.json");
	if (!(await pathExists(src))) {
		console.warn("Skip pi-lsp config: source missing at", src);
		return false;
	}

	try {
		const config = JSON.parse(await fs.readFile(src, "utf-8"));
		if (!isPlainObject(config) || Object.keys(config).length === 0) {
			throw new Error("must be a non-empty JSON object");
		}
	} catch (err) {
		console.error(`pi-lsp config is invalid (${src}): ${err.message}`);
		return false;
	}

	await linkOrCopy(src, path.join(piHome, "pi-lsp.json"));
	return true;
}

/**
 * Resolve XDG-aware config dir for rpiv-* overlays.
 * Mirrors @juicesharp/rpiv-config: absolute XDG_CONFIG_HOME or ~/.config.
 */
function resolveXdgConfigDir() {
	const xdg = process.env.XDG_CONFIG_HOME?.trim();
	if (xdg && path.isAbsolute(xdg)) return xdg;
	return path.join(os.homedir(), ".config");
}

/**
 * Seed portable rpiv-advisor template when the operator has no local file yet.
 * Never overwrite ~/.config/rpiv-advisor/advisor.json — that file holds the
 * machine-local modelKey selected via /advisor.
 */
async function installRpivAdvisorConfig() {
	const src = path.join(repoRoot, "configs", "rpiv-advisor", "advisor.json");
	if (!(await pathExists(src))) {
		console.warn("Skip rpiv-advisor config: source missing at", src);
		return false;
	}

	const destDir = path.join(resolveXdgConfigDir(), "rpiv-advisor");
	const dest = path.join(destDir, "advisor.json");
	if (await pathExists(dest)) {
		console.log(`Keep existing rpiv-advisor config (not overwriting): ${dest}`);
		return true;
	}

	await ensureDir(destDir);
	const body = await fs.readFile(src, "utf-8");
	// Validate JSON before writing so we never seed a broken template.
	try {
		JSON.parse(body);
	} catch (err) {
		console.error(
			`rpiv-advisor template is invalid JSON (${src}): ${err.message}`,
		);
		return false;
	}
	await fs.writeFile(dest, body.endsWith("\n") ? body : `${body}\n`, {
		encoding: "utf-8",
		mode: 0o600,
	});
	// writeFile mode is umask-sensitive on some platforms; force 0600.
	await fs.chmod(dest, 0o600);
	console.log(`Seeded rpiv-advisor config: ${dest}`);
	return true;
}

/**
 * Seed the portable pi-tool-display config template when the operator has no
 * local file yet.
 * Never overwrite ~/.pi/agent/extensions/pi-tool-display/config.json — the
 * extension's /tool-display settings UI rewrites that file at runtime, so a
 * symlink or overwrite would clobber operator choices.
 */
async function installPiToolDisplayConfig() {
	const src = path.join(repoRoot, "configs", "pi-tool-display", "config.json");
	if (!(await pathExists(src))) {
		console.warn("Skip pi-tool-display config: source missing at", src);
		return false;
	}

	const destDir = path.join(piHome, "extensions", "pi-tool-display");
	const dest = path.join(destDir, "config.json");
	if (await pathExists(dest)) {
		console.log(
			`Keep existing pi-tool-display config (not overwriting): ${dest}`,
		);
		return true;
	}

	await ensureDir(destDir);
	const body = await fs.readFile(src, "utf-8");
	// Validate JSON before writing so we never seed a broken template.
	try {
		JSON.parse(body);
	} catch (err) {
		console.error(
			`pi-tool-display template is invalid JSON (${src}): ${err.message}`,
		);
		return false;
	}
	await fs.writeFile(dest, body.endsWith("\n") ? body : `${body}\n`, {
		encoding: "utf-8",
	});
	console.log(`Seeded pi-tool-display config: ${dest}`);
	return true;
}

/**
 * Install the authoritative managed overlay for @cortexkit/pi-magic-context.
 *
 * Unlike rpiv-advisor (seed-if-missing) and pi-tool-display (seed-if-missing),
 * this overlay is the source of truth for Magic Context behavior: it is copied
 * on every install so re-running `npm run install-global` keeps the operator on
 * the package-managed settings. A previous destination is backed up before
 * write (timestamped `.bak.*` sibling, same scheme as mergeMcpConfig) so
 * operator-edited values remain recoverable.
 *
 * Path: ${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc (or ~/.config/...).
 * Never symlinked: a runtime config symlinked at the repo would let plugin
 * edits mutate the checkout. Magic Context owns compaction; pi native
 * compaction is disabled in configs/agent-settings.json.
 *
 * The source is plain JSON (despite the .jsonc extension) so JSON.parse is
 * sufficient. Returns true on success, false on a read/parse/write failure.
 */
async function installMagicContextConfig() {
	const src = path.join(
		repoRoot,
		"configs",
		"magic-context",
		"magic-context.jsonc",
	);
	if (!(await pathExists(src))) {
		console.warn("Skip magic-context config: source missing at", src);
		return false;
	}

	let body;
	try {
		body = await fs.readFile(src, "utf-8");
	} catch (err) {
		console.error(`Failed to read magic-context template: ${err.message}`);
		return false;
	}
	// Validate JSON before writing so we never ship a broken overlay. The
	// template is plain JSON; a future JSONC comment would need a stripper.
	try {
		JSON.parse(body);
	} catch (err) {
		console.error(
			`magic-context template is invalid JSON (${src}): ${err.message}`,
		);
		return false;
	}

	const destDir = path.join(resolveXdgConfigDir(), "cortexkit");
	await ensureDir(destDir);
	const dest = path.join(destDir, "magic-context.jsonc");

	// Back up an existing destination before the authoritative overwrite, so
	// operator-edited values are recoverable. Mirrors mergeMcpConfig backup.
	if (await pathExists(dest)) {
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = `${dest}.bak.${stamp}`;
		try {
			await fs.copyFile(dest, backupPath);
			console.log(`Backed up magic-context config: ${backupPath}`);
		} catch (err) {
			console.error(
				`Failed to back up existing magic-context config (${dest}): ${err.message}`,
			);
			return false;
		}
	}

	try {
		await fs.writeFile(dest, body.endsWith("\n") ? body : `${body}\n`, {
			encoding: "utf-8",
			mode: 0o600,
		});
		// writeFile mode is umask-sensitive on some platforms; force 0600 so a
		// runtime config holding behavior flags does not end up world-readable.
		await fs.chmod(dest, 0o600);
	} catch (err) {
		console.error(`Failed to write magic-context config (${dest}): ${err.message}`);
		return false;
	}
	console.log(`Installed managed magic-context config: ${dest}`);
	return true;
}

async function main() {
	console.log(`Installing Pi Workflows globally to ${piHome}...`);
	const packageAssetRoot = path.join(piHome, "hkx-pi-workflows");
	const failed = [];

	await ensureDir(path.join(piHome, "extensions"));
	await ensureDir(path.join(piHome, "commands"));
	await ensureDir(path.join(piHome, "prompts"));
	await ensureDir(path.join(piHome, "skills"));
	await ensureDir(path.join(piHome, "rules"));
	await ensureDir(path.join(piHome, "agents", "hkx"));
	await ensureDir(path.join(piHome, "chains"));
	await ensureDir(path.join(packageAssetRoot, "scripts"));

	let pkg = {};
	try {
		pkg = JSON.parse(
			await fs.readFile(path.join(repoRoot, "package.json"), "utf-8"),
		);
	} catch (err) {
		console.warn("Could not parse package.json:", err.message);
	}

	// Extensions (same set as package.json pi.extensions)
	const extensions = pkg.pi?.extensions ?? [];
	for (const ext of extensions) {
		const srcPath = path.resolve(repoRoot, ext);
		if (!(await pathExists(srcPath))) {
			console.warn(`Skip missing extension: ${ext}`);
			continue;
		}
		await linkOrCopy(
			srcPath,
			path.join(piHome, "extensions", path.basename(ext)),
		);
	}

	// Commands / prompt templates
	// Repo keeps commands/ on disk; package.json maps it as pi.prompts for
	// `pi install`. Global install links into both commands/ and prompts/ so
	// slash discovery works on current pi (prompts/) and any residual tools
	// still looking at commands/.
	const commandsDir = path.join(repoRoot, "commands");
	if (await pathExists(commandsDir)) {
		for (const cmd of await fs.readdir(commandsDir)) {
			if (cmd.endsWith(".md")) {
				const src = path.join(commandsDir, cmd);
				await linkOrCopy(src, path.join(piHome, "commands", cmd));
				await linkOrCopy(src, path.join(piHome, "prompts", cmd));
			}
		}
	}

	// Rules
	const rulesDir = path.join(repoRoot, "rules");
	if (await pathExists(rulesDir)) {
		for (const rule of await fs.readdir(rulesDir)) {
			if (rule.endsWith(".md") || rule.endsWith(".mdc")) {
				await linkOrCopy(
					path.join(rulesDir, rule),
					path.join(piHome, "rules", rule),
				);
			}
		}
	}

	// Skills
	const skillsDir = path.join(repoRoot, "skills");
	if (await pathExists(skillsDir)) {
		for (const skill of await fs.readdir(skillsDir)) {
			const skillPath = path.join(skillsDir, skill);
			const stat = await fs.stat(skillPath);
			if (stat.isDirectory()) {
				await linkOrCopy(skillPath, path.join(piHome, "skills", skill));
			}
		}
	}

	// Agents under agents/hkx so package: hkx is discoverable and namespaced
	const agentsDir = path.join(repoRoot, "agents");
	if (await pathExists(agentsDir)) {
		for (const agent of await fs.readdir(agentsDir)) {
			if (agent.endsWith(".md")) {
				await linkOrCopy(
					path.join(agentsDir, agent),
					path.join(piHome, "agents", "hkx", agent),
				);
			}
		}
	}

	// Chains
	const chainsDir = path.join(repoRoot, "chains");
	if (await pathExists(chainsDir)) {
		for (const chain of await fs.readdir(chainsDir)) {
			if (chain.endsWith(".chain.json") || chain.endsWith(".chain.md")) {
				await linkOrCopy(
					path.join(chainsDir, chain),
					path.join(piHome, "chains", chain),
				);
			}
		}
	}

	// MCP
	const mcpSrc = path.join(repoRoot, ".mcp.json");
	if (await pathExists(mcpSrc)) {
		try {
			await mergeMcpConfig(mcpSrc, path.join(piHome, "mcp.json"));
		} catch (err) {
			failed.push("merge mcp config");
			console.error(`MCP merge failed: ${err.message}`);
			console.error(
				"Resolve the error above before relying on ~/.pi/agent/mcp.json. Tokens were not modified.",
			);
		}
	}

	// Managed global agent settings (packages + portable defaults)
	const agentSettingsSrc = path.join(
		repoRoot,
		"configs",
		"agent-settings.json",
	);
	if (await pathExists(agentSettingsSrc)) {
		const agentSettingsOk = await mergeAgentSettings(
			agentSettingsSrc,
			path.join(piHome, "settings.json"),
			// Windows per-agent subagent overrides are derived from the hkx
			// agents that were just installed into ~/.pi/agent/agents/hkx.
			{ agentsDir: path.join(piHome, "agents", "hkx") },
		);
		if (!agentSettingsOk) {
			failed.push("merge agent settings");
			console.error(
				"Agent settings merge failed. Managed settings from configs/agent-settings.json were NOT applied.",
			);
		}
	} else {
		console.warn("Skip agent settings: configs/agent-settings.json not found");
	}

	// Managed global keybindings. Package actions overwrite their previous values;
	// unrelated operator actions remain untouched.
	const keybindingsSrc = path.join(repoRoot, "configs", "keybindings.json");
	if (await pathExists(keybindingsSrc)) {
		const keybindingsOk = await mergeKeybindingsConfig(
			keybindingsSrc,
			path.join(piHome, "keybindings.json"),
		);
		if (!keybindingsOk) failed.push("merge keybindings");
	} else {
		console.error("Missing managed keybindings: configs/keybindings.json");
		failed.push("merge keybindings");
	}

	// System / agent guidance files
	const appendSrc = path.join(repoRoot, "APPEND_SYSTEM.md");
	if (await pathExists(appendSrc)) {
		await linkOrCopy(appendSrc, path.join(piHome, "APPEND_SYSTEM.md"));
	}
	const globalAgentsSrc = path.join(repoRoot, "GLOBAL_AGENTS.md");
	if (await pathExists(globalAgentsSrc)) {
		await linkOrCopy(globalAgentsSrc, path.join(piHome, "AGENTS.md"));
	}

	// MCP templates + helper
	// mcp-configs is copied (not symlinked) so editing the installed copy
	// does not accidentally propagate local edits back into the repo tree.
	const mcpConfigs = path.join(repoRoot, "mcp-configs");
	if (await pathExists(mcpConfigs)) {
		await linkOrCopy(mcpConfigs, path.join(packageAssetRoot, "mcp-configs"), {
			copyOnly: true,
		});
	}
	// C1: apply-mcp-profile.mjs imports ./lib/mcp-resolver.mjs (MF-6 SSOT).
	// Installing the helper alone leaves the installed copy with
	// ERR_MODULE_NOT_FOUND. Always ship the resolver next to it under
	// packageAssetRoot/scripts/lib/.
	const applyProfile = path.join(repoRoot, "scripts", "apply-mcp-profile.mjs");
	const mcpResolver = path.join(repoRoot, "scripts", "lib", "mcp-resolver.mjs");
	if (await pathExists(applyProfile)) {
		await linkOrCopy(
			applyProfile,
			path.join(packageAssetRoot, "scripts", "apply-mcp-profile.mjs"),
		);
		if (await pathExists(mcpResolver)) {
			await ensureDir(path.join(packageAssetRoot, "scripts", "lib"));
			await linkOrCopy(
				mcpResolver,
				path.join(packageAssetRoot, "scripts", "lib", "mcp-resolver.mjs"),
			);
		} else {
			console.error(
				`Missing shared resolver at ${mcpResolver}; installed apply-mcp-profile would fail to import.`,
			);
			failed.push("install apply-mcp-profile resolver");
		}
	}

	// Instinct evolve CLI (Phase 1): ship tree so /evolve works after install-global.
	// Callers: commands/evolve.md, commands/instinct-status.md
	// Auth: user "开工" Phase 1; plan docs/instinct-evolve-plan.md
	// Verify: npm test; path exists under ~/.pi/agent/hkx-pi-workflows/scripts/instinct/
	const instinctSrc = path.join(repoRoot, "scripts", "instinct");
	if (await pathExists(instinctSrc)) {
		await linkOrCopy(
			instinctSrc,
			path.join(packageAssetRoot, "scripts", "instinct"),
			{
				copyOnly: true,
			},
		);
	}

	// Plan Canvas CLI: local browser review for .pi/plans artifacts.
	// Callers: commands/hkx-plan-canvas.md, skills/plan-canvas
	const planCanvasCli = path.join(repoRoot, "scripts", "plan-canvas.cjs");
	const planCanvasLib = path.join(repoRoot, "scripts", "lib", "plan-canvas");
	const loopbackGuard = path.join(
		repoRoot,
		"scripts",
		"lib",
		"loopback-guard.cjs",
	);
	if (await pathExists(planCanvasCli)) {
		await linkOrCopy(
			planCanvasCli,
			path.join(packageAssetRoot, "scripts", "plan-canvas.cjs"),
			{ copyOnly: true },
		);
		if (await pathExists(planCanvasLib)) {
			await linkOrCopy(
				planCanvasLib,
				path.join(packageAssetRoot, "scripts", "lib", "plan-canvas"),
				{ copyOnly: true },
			);
		}
		if (await pathExists(loopbackGuard)) {
			await ensureDir(path.join(packageAssetRoot, "scripts", "lib"));
			await linkOrCopy(
				loopbackGuard,
				path.join(packageAssetRoot, "scripts", "lib", "loopback-guard.cjs"),
				{ copyOnly: true },
			);
		}
	}

	// Install/update packages listed in ~/.pi/agent/settings.json
	const piUpdateOk = await updatePiExtensions();
	if (!piUpdateOk) failed.push("pi update --extensions");

	// After packages are installed: write managed configuration overlays.
	const piLspConfigOk = await installPiLspConfig();
	if (!piLspConfigOk) failed.push("pi-lsp config");

	// Ensure extension config dir exists and write the managed overlay
	// (first install often has no config yet).
	const permissionConfigOk = await installPermissionSystemConfig();
	if (!permissionConfigOk) failed.push("pi-permission-system config");

	// XDG seed for rpiv-advisor (guidance/effort only; never clobber modelKey).
	const advisorConfigOk = await installRpivAdvisorConfig();
	if (!advisorConfigOk) failed.push("rpiv-advisor config");

	// Seed pi-tool-display config (extension settings UI rewrites it at runtime).
	const toolDisplayConfigOk = await installPiToolDisplayConfig();
	if (!toolDisplayConfigOk) failed.push("pi-tool-display config");

	// Authoritative managed overlay for @cortexkit/pi-magic-context.
	// Magic Context owns compaction; pi native compaction is disabled in
	// configs/agent-settings.json. Copy on every install (backup first).
	const magicContextConfigOk = await installMagicContextConfig();
	if (!magicContextConfigOk) failed.push("magic-context config");

	if (failed.length > 0) {
		console.error(
			`\nInstall completed with ${failed.length} non-fatal issue(s): ${failed.join(", ")}`,
		);
		console.error(
			"Review the warnings above. Surfaces that did succeed are usable, but do not trust the install as clean.",
		);
		process.exitCode = 1;
	} else {
		console.log("Global installation to ~/.pi/agent completed successfully!");
	}
	console.log("Agents: ~/.pi/agent/agents/hkx/*.md  (runtime: hkx.<name>)");
	console.log("Chains: ~/.pi/agent/chains/hkx-*.chain.json");
	console.log(
		"Settings: configs/agent-settings.json → merge ~/.pi/agent/settings.json",
	);
	console.log(
		"Keybindings: configs/keybindings.json → merge ~/.pi/agent/keybindings.json",
	);
	console.log("Packages: pi update --extensions (from settings packages)");
	console.log("pi-lsp: configs/pi-lsp/pi-lsp.json → ~/.pi/agent/pi-lsp.json");
	console.log(
		"rpiv-advisor: configs/rpiv-advisor/advisor.json → seed ~/.config/rpiv-advisor/advisor.json (if missing)",
	);
	console.log(
		"pi-tool-display: configs/pi-tool-display/config.json → seed ~/.pi/agent/extensions/pi-tool-display/config.json (if missing)",
	);
	console.log(
		"magic-context: configs/magic-context/magic-context.jsonc → ${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc (authoritative; backup previous)",
	);
}

// Export the managed-overlay installer so the versioned smoke suite can
// exercise the real implementation against a temporary HOME/XDG_CONFIG_HOME
// instead of a duplicated mirror. main() only runs when this file is the
// entry point (node scripts/install.mjs), not when imported by a test.
const isMain =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

export { installMagicContextConfig };
