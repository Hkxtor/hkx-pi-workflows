#!/usr/bin/env node
/**
 * Regression contract for the pi-lens -> @narumitw/pi-lsp migration.
 *
 * The Path B installer must manage the pi-lsp package and install a global
 * primary-language configuration without retaining pi-lens-only tools in the
 * operator guidance or packaged agents.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const pass = [];
const fail = [];

function check(name, condition, detail = "") {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

const configPath = "configs/pi-lsp/pi-lsp.json";
let config;
try {
	config = JSON.parse(await fs.readFile(path.join(root, configPath), "utf8"));
	check(
		"pi-lsp config is a non-empty JSON object",
		config && typeof config === "object" && !Array.isArray(config),
		JSON.stringify(config),
	);
} catch (error) {
	check("pi-lsp config is a non-empty JSON object", false, error.message);
}

const expectedRoutes = {
	ty: {
		command: ["ty", "server"],
		extensions: [".py", ".pyi"],
	},
	ruff: {
		command: ["ruff", "server"],
		extensions: [".py", ".pyi"],
	},
	biome: {
		command: ["biome", "lsp-proxy"],
		extensions: [
			".astro",
			".css",
			".graphql",
			".gql",
			".html",
			".js",
			".jsx",
			".json",
			".jsonc",
			".ts",
			".tsx",
			".vue",
		],
	},
	"rust-analyzer": {
		command: ["rust-analyzer"],
		extensions: [".rs"],
		pullDiagnosticsGraceMs: 5000,
	},
	gopls: {
		command: ["gopls"],
		extensions: [".go"],
	},
};

for (const [name, expected] of Object.entries(expectedRoutes)) {
	const actual = config?.[name];
	check(`${name} route exists`, Boolean(actual));
	check(
		`${name} command is canonical argv`,
		JSON.stringify(actual?.command) === JSON.stringify(expected.command),
		JSON.stringify(actual?.command),
	);
	check(
		`${name} extensions are canonical`,
		JSON.stringify(actual?.extensions) === JSON.stringify(expected.extensions),
		JSON.stringify(actual?.extensions),
	);
	if (Object.hasOwn(expected, "pullDiagnosticsGraceMs")) {
		check(
			`${name} retains pull-diagnostics grace`,
			actual?.pullDiagnosticsGraceMs === expected.pullDiagnosticsGraceMs,
			JSON.stringify(actual?.pullDiagnosticsGraceMs),
		);
	}
}

try {
	const settings = JSON.parse(
		await fs.readFile(path.join(root, "configs/agent-settings.json"), "utf8"),
	);
	const sources = (settings.packages ?? []).map((entry) =>
		typeof entry === "string" ? entry : entry?.source,
	);
	check(
		"managed package list includes pi-lsp",
		sources.includes("npm:@narumitw/pi-lsp"),
		JSON.stringify(sources),
	);
	check(
		"managed package list removes pi-lens",
		!sources.includes("npm:pi-lens"),
		JSON.stringify(sources),
	);
} catch (error) {
	check("managed package list is readable", false, error.message);
}

try {
	const installSource = await fs.readFile(
		path.join(root, "scripts/install.mjs"),
		"utf8",
	);
	check(
		"installer defines the pi-lsp config install step",
		/function installPiLspConfig\(\)/.test(installSource),
		"installPiLspConfig is missing",
	);
	check(
		"installer targets the global pi-lsp config path",
		/path\.join\(piHome, "pi-lsp\.json"\)/.test(installSource),
		"~/.pi/agent/pi-lsp.json target is missing",
	);
	check(
		"installer runs the pi-lsp config step after package update",
		/updatePiExtensions\(\)[\s\S]{0,900}installPiLspConfig\(\)/.test(
			installSource,
		),
		"pi-lsp config step is missing or ordered before package update",
	);
} catch (error) {
	check("installer is readable", false, error.message);
}

const runtimeSources = [
	"AGENTS.md",
	"GLOBAL_AGENTS.md",
	"APPEND_SYSTEM.md",
	"README.md",
	"README.zh-CN.md",
	"docs/architecture.md",
	"docs/conversion-map.md",
	"scripts/convert-agents-to-pi.mjs",
];
const agentsDir = path.join(root, "agents");
for (const entry of await fs.readdir(agentsDir)) {
	if (entry.endsWith(".md")) runtimeSources.push(path.join("agents", entry));
}

const stalePattern =
	/\b(?:pi-lens|lsp_navigation|ast_grep_search|ast_grep_replace|lens_diagnostics|module_report|symbol_search|read_symbol|read_enclosing)\b/i;
for (const relativePath of runtimeSources) {
	const content = await fs.readFile(path.join(root, relativePath), "utf8");
	const match = content.match(stalePattern);
	check(
		`${relativePath} does not require removed pi-lens capabilities`,
		match === null,
		match?.[0] ?? "",
	);
}

for (const name of pass) console.log(`ok: ${name}`);
if (fail.length > 0) {
	for (const name of fail) console.error(`FAIL: ${name}`);
	process.exit(1);
}
console.log(`pi-lsp migration: ${pass.length} checks passed`);
