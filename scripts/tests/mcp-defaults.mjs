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
const reasoning = await readJson("mcp-configs/templates/reasoning.json");
const memory = await readJson("mcp-configs/templates/memory.json");
const research = await readJson("mcp-configs/templates/research.json");
const catalog = await readJson("mcp-configs/mcp-servers.json");
const managed = await readJson("configs/agent-settings.json");

check(
	"built-in MCP needs no adapter package or proxy settings",
	!managed.packages.includes("npm:pi-mcp-adapter") &&
		defaults.settings === undefined,
	JSON.stringify(defaults.settings),
);

const servers = defaults.mcpServers ?? {};
const context7 = servers.context7;
check(
	"Context7 is the sole default server: HTTP, built-in direct exposure",
	Object.keys(servers).length === 1 &&
		context7?.url === "https://mcp.context7.com/mcp" &&
		context7?.command === undefined &&
		context7?.args === undefined &&
		context7?.exposure === "direct" &&
		context7?.protocolVersion === undefined &&
		context7?.lifecycle === undefined &&
		context7?.directTools === undefined,
	JSON.stringify(servers),
);

for (const name of [
	"github",
	"exa",
	"playwright",
	"sequential-thinking",
	"mcp-server-time",
	"mcp-deepwiki",
	"chrome-devtools-mcp",
]) {
	check(
		`${name} stays out of the default surface (opt-in only)`,
		servers[name] === undefined,
		JSON.stringify(servers[name]),
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
		shrimp?.exposure === "direct" &&
		shrimp?.lifecycle === undefined &&
		shrimp?.directTools === undefined,
	JSON.stringify(shrimp),
);

check(
	"optional profiles and catalog use built-in MCP fields",
	[reasoning, taskManagement, memory, research].every(
			(profile) => profile.$schema === undefined &&
				Object.values(profile.mcpServers).every((server) =>
					["directTools", "lifecycle", "protocolVersion"].every(
						(key) => !Object.hasOwn(server, key),
					),
				),
		) &&
		reasoning.mcpServers?.["sequential-thinking"]?.exposure === "direct" &&
		Object.values(catalog.mcpServers).every((server) =>
			["directTools", "lifecycle", "protocolVersion"].every(
				(key) => !Object.hasOwn(server, key),
			),
		) &&
		catalog._comments.disabling.includes("enabled: false"),
);

for (const item of pass) console.log("ok:", item);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} MCP DEFAULT CHECKS PASS`);
} else {
	for (const item of fail) console.error("FAIL:", item);
	process.exit(1);
}
