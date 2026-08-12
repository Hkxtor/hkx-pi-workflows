#!/usr/bin/env node
/**
 * Default MCP surface regression checks.
 *
 * These assertions keep the checked-in Path B defaults portable and ensure
 * optional Shrimp task management remains opt-in behind MCP_DATA_DIR.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pass = [];
const fail = [];

function check(name, condition, detail = "") {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

async function readJson(relativePath) {
	return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function findPlaceholder(value) {
	if (typeof value === "string") return /<[^>]+>|YOUR_[A-Z0-9_]*|REPLACE_ME/.test(value);
	if (Array.isArray(value)) return value.some(findPlaceholder);
	if (value && typeof value === "object") return Object.values(value).some(findPlaceholder);
	return false;
}

const defaults = await readJson(".mcp.json");
const manifest = await readJson("mcp-configs/templates/manifest.json");
const taskManagement = await readJson("mcp-configs/templates/task-management.json");

check(
	"default settings keep unselected MCP tools behind the proxy",
	defaults.settings?.directTools === false,
	JSON.stringify(defaults.settings),
);

const context7 = defaults.mcpServers?.context7;
check(
	"Context7 is the sole HTTP default with direct eager tools",
	defaults.mcpServers?.["context7-1"] === undefined &&
		context7?.url === "https://mcp.context7.com/mcp" &&
		context7?.command === undefined &&
		context7?.args === undefined &&
		context7?.protocolVersion === "auto" &&
		context7?.lifecycle === "eager" &&
		context7?.directTools === true,
	JSON.stringify(context7),
);

const sequentialThinking = defaults.mcpServers?.["sequential-thinking"];
check(
	"sequential-thinking is eager and direct",
	sequentialThinking?.command === "npx" &&
		sequentialThinking?.lifecycle === "eager" &&
		sequentialThinking?.directTools === true,
	JSON.stringify(sequentialThinking),
);

const timeServer = defaults.mcpServers?.["mcp-server-time"];
check(
	"time server uses the requested Asia/Shanghai uvx configuration",
	timeServer?.command === "uvx" &&
		timeServer?.args?.includes("mcp-server-time") &&
		timeServer?.args?.includes("--local-timezone=Asia/Shanghai") &&
		timeServer?.lifecycle === "eager" &&
		timeServer?.directTools === true,
	JSON.stringify(timeServer),
);

const deepWiki = defaults.mcpServers?.["mcp-deepwiki"];
check(
	"DeepWiki uses the canonical public remote endpoint with direct eager tools",
	deepWiki?.url === "https://mcp.deepwiki.com/mcp" &&
		deepWiki?.protocolVersion === "auto" &&
		deepWiki?.lifecycle === "eager" &&
		deepWiki?.directTools === true,
	JSON.stringify(deepWiki),
);

for (const name of ["playwright", "chrome-devtools-mcp"]) {
	const server = defaults.mcpServers?.[name];
	check(
		`${name} uses a cross-platform lazy npx invocation`,
		server?.command === "npx" && server?.lifecycle === "lazy" && !server?.args?.includes("--extension"),
		JSON.stringify(server),
	);
}

check(
	"default config contains no literal placeholder slots",
	!findPlaceholder(defaults),
	JSON.stringify(defaults),
);

const taskProfile = manifest.profiles?.["task-management"];
const shrimp = taskManagement.mcpServers?.["shrimp-task-manager"];
check(
	"task-management profile is registered for Shrimp",
	taskProfile?.file === "task-management.json" &&
		taskProfile?.servers?.includes("shrimp-task-manager") &&
		taskProfile?.requiresEnv?.includes("MCP_DATA_DIR"),
	JSON.stringify(taskProfile),
);
check(
	"Shrimp remains optional and requires a concrete MCP_DATA_DIR",
	shrimp?.env?.DATA_DIR === "${MCP_DATA_DIR}" &&
		shrimp?.requiresEnv?.includes("MCP_DATA_DIR") &&
		shrimp?.lifecycle === "eager" &&
		shrimp?.directTools === true,
	JSON.stringify(shrimp),
);

for (const item of pass) console.log("ok:", item);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} MCP DEFAULT CHECKS PASS`);
} else {
	for (const item of fail) console.error("FAIL:", item);
	process.exit(1);
}
