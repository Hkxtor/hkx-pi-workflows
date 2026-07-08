import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const ompHome = path.join(os.homedir(), ".omp", "agent");

async function ensureDir(dir) {
	await fs.mkdir(dir, { recursive: true });
}

async function linkOrCopy(src, dest) {
	try {
		await fs.rm(dest, { force: true, recursive: true });
	} catch {}

	try {
		await fs.symlink(src, dest);
		console.log(`Linked: ${dest} -> ${src}`);
	} catch (err) {
		await fs.cp(src, dest, { recursive: true });
		console.log(`Copied: ${dest} <- ${src}`);
	}
}

async function mergeMcpConfig(srcPath, destPath) {
	let srcContent;
	try {
		const rawSrc = await fs.readFile(srcPath, "utf-8");
		srcContent = JSON.parse(rawSrc);
	} catch (err) {
		console.error(`Failed to read source MCP config: ${err.message}`);
		return;
	}

	let destContent = {
		$schema: "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json",
		mcpServers: {},
	};

	try {
		const rawDest = await fs.readFile(destPath, "utf-8");
		destContent = JSON.parse(rawDest);
	} catch (err) {
		// File doesn't exist or is invalid JSON; we will initialize it
	}

	destContent.mcpServers = {
		...destContent.mcpServers,
		...srcContent.mcpServers,
	};

	if (!destContent.$schema) {
		destContent.$schema = "https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json";
	}

	await fs.writeFile(destPath, JSON.stringify(destContent, null, 2), "utf-8");
	console.log(`Merged MCP configuration: ${destPath}`);
}

async function main() {
	console.log(`Installing OMP Workflows globally to ${ompHome}...`);
	const packageAssetRoot = path.join(ompHome, "hkx-omp-workflows");

	await ensureDir(path.join(ompHome, "extensions"));
	await ensureDir(path.join(ompHome, "commands"));
	await ensureDir(path.join(ompHome, "skills"));
	await ensureDir(path.join(ompHome, "rules"));
	await ensureDir(path.join(ompHome, "agents"));
	await ensureDir(path.join(packageAssetRoot, "scripts"));

	// Link extensions from package.json omp.extensions
	const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf-8"));
	const extensions = pkg.omp?.extensions ?? [];
	for (const ext of extensions) {
		const srcPath = path.resolve(repoRoot, ext);
		const destName = path.basename(ext);
		await linkOrCopy(srcPath, path.join(ompHome, "extensions", destName));
	}

	// Link commands
	const commands = await fs.readdir(path.join(repoRoot, "commands"));
	for (const cmd of commands) {
		if (cmd.endsWith(".md")) {
			await linkOrCopy(
				path.join(repoRoot, "commands", cmd),
				path.join(ompHome, "commands", cmd),
			);
		}
	}

	// Link rules
	const rules = await fs.readdir(path.join(repoRoot, "rules"));
	for (const rule of rules) {
		if (rule.endsWith(".md") || rule.endsWith(".mdc")) {
			await linkOrCopy(
				path.join(repoRoot, "rules", rule),
				path.join(ompHome, "rules", rule),
			);
		}
	}

	// Link agents
	const agents = await fs.readdir(path.join(repoRoot, "agents"));
	for (const agent of agents) {
		if (agent.endsWith(".md")) {
			await linkOrCopy(
				path.join(repoRoot, "agents", agent),
				path.join(ompHome, "agents", agent),
			);
		}
	}

	// Link skills
	const skills = await fs.readdir(path.join(repoRoot, "skills"));
	for (const skill of skills) {
		const skillPath = path.join(repoRoot, "skills", skill);
		const stat = await fs.stat(skillPath);
		if (stat.isDirectory()) {
			await linkOrCopy(skillPath, path.join(ompHome, "skills", skill));
		}
	}

	// Merge MCP config
	await mergeMcpConfig(
		path.join(repoRoot, ".mcp.json"),
		path.join(ompHome, "mcp.json"),
	);

	// Link APPEND_SYSTEM.md
	await linkOrCopy(
		path.join(repoRoot, "APPEND_SYSTEM.md"),
		path.join(ompHome, "APPEND_SYSTEM.md"),
	);

	// Link MCP template assets for optional profile-based loading
	await linkOrCopy(
		path.join(repoRoot, "mcp-configs"),
		path.join(packageAssetRoot, "mcp-configs"),
	);
	await linkOrCopy(
		path.join(repoRoot, "scripts", "apply-mcp-profile.mjs"),
		path.join(packageAssetRoot, "scripts", "apply-mcp-profile.mjs"),
	);

	console.log("Global installation to ~/.omp completed successfully!");
}

main().catch(console.error);
