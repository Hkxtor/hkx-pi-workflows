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
 *   this script and does not write rules, MCP, GLOBAL_AGENTS, or settings overlays.
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
 *                              (managed keys only: packages + portable defaults)
 * - GLOBAL_AGENTS.md         -> ~/.pi/agent/AGENTS.md
 * - APPEND_SYSTEM.md         -> ~/.pi/agent/APPEND_SYSTEM.md
 * - .mcp.json                -> safe-merge into ~/.pi/agent/mcp.json
 *                              (hard-fail on corrupt dest; preserve env/headers;
 *                               backup before write; never wipe user tokens)
 * - mcp-configs/             -> ~/.pi/agent/hkx-pi-workflows/mcp-configs/ (reference)
 * - then: pi update --extensions (install/update packages listed in settings)
 * - configs/pi-permission-system/config.json
 *                            -> ~/.pi/agent/extensions/pi-permission-system/config.json
 *                              (after package update; creates the extension dir if missing)
 *
 * This is the full operator install path. It does not run migration helpers.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import process from "node:process";
import { scanServerForRefusal } from "./lib/mcp-resolver.mjs";
import { fileURLToPath } from "node:url";

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

function mergeMcpServers(destServers, srcServers) {
	// MF-6: every server that lands in ~/.pi/agent/mcp.json — whether newly
	// added or preserved — must pass the same resolver/placeholder/unresolved
	// guards that apply-mcp-profile enforces, so the install path cannot
	// silently persist literal ${VAR} or YOUR_*_HERE from a future .mcp.json
	// env/args/url/headers edit. scanServerForRefusal throws on unresolved
	// or placeholder, mutates in-place, and returns an allowlist shape.
	const dest = isPlainObject(destServers) ? destServers : {};
	const src = isPlainObject(srcServers) ? srcServers : {};
	const out = { ...dest };
	const added = [];
	const preserved = [];

	for (const [name, srcServer] of Object.entries(src)) {
		if (out[name] === undefined) {
			const guardeded = scanServerForRefusal(name, structuredClone(srcServer));
			out[name] = guardeded;
			added.push(name);
		} else {
			const merged = mergeServerConfig(out[name], srcServer);
			// Re-scan a preserved server too — it may carry old placeholder /
			// unresolved refs from a previous install that predate this guard.
			out[name] = scanServerForRefusal(name, merged);
			preserved.push(name);
		}
	}

	return { servers: out, added, preserved };
}

async function mergeMcpConfig(srcPath, destPath) {
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

		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = `${destPath}.bak.${stamp}`;
		await fs.copyFile(destPath, backupPath);
		console.log(`Backed up MCP config: ${backupPath}`);
	}

	const { servers, added, preserved } = mergeMcpServers(
		destContent.mcpServers,
		srcContent.mcpServers,
	);
	destContent.mcpServers = servers;

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
 * Merge managed agent settings into ~/.pi/agent/settings.json.
 * Managed keys from configs/agent-settings.json overwrite local values.
 * packages is replaced by the managed list (authoritative), not unioned.
 * Machine-local keys (shellPath, defaultProvider, …) are preserved when absent from source.
 *
 * Returns `true` on success, `false` on a read/parse failure. The caller must
 * push a label into failed[] on `false` so the install path cannot silently
 * claim success while agent settings failed to merge (MF-7).
 */
async function mergeAgentSettings(srcPath, destPath) {
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
	} catch {
		// init empty — dest may not exist yet on first install
	}

	const next = deepMerge(current, managed);

	// packages: managed list is authoritative (order preserved)
	if (Array.isArray(managed.packages)) {
		next.packages = managed.packages;
	}

	await fs.writeFile(destPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
	const pkgCount = Array.isArray(next.packages) ? next.packages.length : 0;
	console.log(
		`Merged agent settings (${pkgCount} packages, managed keys): ${destPath}`,
	);
	return true;
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: true,
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
	const result = await runCommand("pi", ["update", "--extensions"]);
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
 */
async function installPermissionSystemConfig() {
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
	await linkOrCopy(
		permissionConfigSrc,
		path.join(permissionExtDir, "config.json"),
	);
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
	const applyProfile = path.join(repoRoot, "scripts", "apply-mcp-profile.mjs");
	if (await pathExists(applyProfile)) {
		await linkOrCopy(
			applyProfile,
			path.join(packageAssetRoot, "scripts", "apply-mcp-profile.mjs"),
		);
	}

	// Install/update packages listed in ~/.pi/agent/settings.json
	const piUpdateOk = await updatePiExtensions();
	if (!piUpdateOk) failed.push("pi update --extensions");

	// After packages are installed: ensure extension config dir exists and
	// write the managed overlay (first install often has no config yet).
	const permissionConfigOk = await installPermissionSystemConfig();
	if (!permissionConfigOk) failed.push("pi-permission-system config");

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
	console.log("Packages: pi update --extensions (from settings packages)");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
