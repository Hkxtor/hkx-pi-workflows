/**
 * Platform-default regression for mergeAgentSettings: on a Windows install
 * (platform === "win32") the operator's ~/.pi/agent/settings.json should gain
 * sensible machine-local defaults — PowerShell 7 as the shell, a pi-native
 * default tool list, and per-agent `subagents.agentOverrides` tool lists
 * derived from the installed hkx agents — but ONLY when the operator has not
 * already set them (seed-if-missing, same contract as the rpiv-advisor /
 * pi-tool-display overlays). On any other platform, or when the operator
 * already configured the keys, nothing is injected.
 *
 * The subagent overrides are scanned from the agent dir (not hard-coded role
 * names like scout/worker): each agent keeps its own declared tools with the
 * native `bash` shell swapped for `powershell`. Tests pass a temp agent dir
 * via options.agentsDir to exercise the scan.
 *
 * These defaults are deliberately NOT versioned in configs/agent-settings.json
 * (validate.mjs rejects shellPath as a managed machine-local key); they come
 * from the OS the install runs on.
 *
 * Isolation: load mergeAgentSettings source in node:vm like
 * merge-agent-settings.mjs does, so the test does not import the running
 * install path. The vm context deliberately has NO global `process`, which
 * also proves the two-arg call shape keeps working (platform resolves to
 * undefined → no injection, no throw).
 */
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { readFileSync } from "node:fs";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-winsettings-"));
const pass = [];
const fail = [];

const DEFAULTS = {
	shellPath: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
	defaultTools: ["read", "powershell", "edit", "write", "grep", "find", "ls"],
};

function isPlainObjectLocal(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function check(name, cond, detail) {
	if (cond) {
		pass.push(name);
	} else {
		fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
	}
}

// Slice helpers out of install.mjs the same way merge-agent-settings.mjs does,
// so the test stays isolated from the full install I/O surface.
const installSrc = readFileSync("scripts/install.mjs", "utf8");
const start = installSrc.indexOf("function isPlainObject");
let end = installSrc.indexOf("function runCommand");
while (end > start) {
	const prev = installSrc.slice(end - 1, end);
	if (/\s/.test(prev)) {
		end--;
		continue;
	}
	break;
}
const helperCode = installSrc.slice(start, end).trimEnd();

const ctx = {
	console: {
		...console,
		error: () => {},
		warn: () => {},
		log: () => {},
	},
	structuredClone,
	Error,
	Date,
	Object,
	Array,
	Boolean,
	JSON,
	Promise,
	Math,
	RegExp,
	fs,
	path,
};
vm.createContext(ctx);
vm.runInContext(
	helperCode + "\nthis.__mergeAgentSettings = mergeAgentSettings;\n",
	ctx,
);
const mergeAgentSettings = ctx.__mergeAgentSettings;

const GOOD_SRC = path.join(tmpDir, "agent-settings-w-src.json");
await fs.writeFile(
	GOOD_SRC,
	JSON.stringify({ packages: ["some-pkg"], managedKey: "v1" }),
);

/**
 * Run one case in a fresh dest file and return the merged object written to it.
 * Pass platform via the third `options` argument (like getPiUpdateInvocation,
 * tests pin a frozen platform instead of touching process.platform).
 */
async function runCase(platform, destContentJson, agentsDir) {
	const dest = path.join(tmpDir, `dest-${platform}-${Math.random().toString(36).slice(2)}.json`);
	await fs.writeFile(dest, destContentJson);
	let threw = null;
	let ret;
	try {
		const options = { platform };
		if (agentsDir) options.agentsDir = agentsDir;
		ret = await mergeAgentSettings(GOOD_SRC, dest, options);
	} catch (err) {
		threw = err;
	}
	const raw = await fs.readFile(dest, "utf8");
	return { dest, threw, ret, out: JSON.parse(raw) };
}

/**
 * Write a temporary hkx-style agent dir with the given name -> tools specs,
 * and return its path. Each spec is either an array (JSON-style tools) or a
 * space/comma string (YAML-style tools). Agents get `package: hkx` like the
 * real installed hkx agents, so runtime names are `hkx.<name>`.
 */
async function writeAgentDir(specs, { pkg = "hkx" } = {}) {
	const dir = path.join(tmpDir, `agents-${Math.random().toString(36).slice(2)}`);
	await fs.mkdir(dir, { recursive: true });
	for (const [name, tools] of Object.entries(specs)) {
		const toolsLine = Array.isArray(tools)
			? JSON.stringify(tools)
			: tools;
		const packageLine = pkg ? `package: ${pkg}\n` : "";
		await fs.writeFile(
			path.join(dir, `${name}.md`),
			`---\nname: ${name}\n${packageLine}tools: ${toolsLine}\n---\n`,
			"utf-8",
		);
	}
	return dir;
}

// ---------------------------------------------------------------------------
// W1: platform win32 + empty dest (fresh install) -> both keys injected with
// the exact defaults.
// ---------------------------------------------------------------------------
{
	const { threw, ret, out } = await runCase("win32", "{}");
	check(
		"W1: win32 fresh install does not throw",
		threw === null,
		`threw=${String(threw)}`,
	);
	check(
		"W1: win32 fresh install reports success",
		threw === null && ret === true,
		`ret=${JSON.stringify(ret)}`,
	);
	check(
		"W1: win32 injects shellPath",
		out?.shellPath === DEFAULTS.shellPath,
		`shellPath=${JSON.stringify(out?.shellPath)}`,
	);
	check(
		"W1: win32 injects defaultTools",
		Array.isArray(out?.defaultTools) &&
			out.defaultTools.length === DEFAULTS.defaultTools.length &&
			DEFAULTS.defaultTools.every((t, i) => out.defaultTools[i] === t),
		`defaultTools=${JSON.stringify(out?.defaultTools)}`,
	);
	check(
		"W1: win32 keeps managed keys",
		out?.managedKey === "v1" && Array.isArray(out?.packages),
		`out=${JSON.stringify(out)}`,
	);
}

// ---------------------------------------------------------------------------
// W2: platform win32 + dest already has operator-chosen shellPath/defaultTools
// -> both keys keep the operator's values (seed-if-missing, never overwrite).
// ---------------------------------------------------------------------------
{
	const destContent = JSON.stringify({
		shellPath: "C:\\tools\\custom\\pwsh.exe",
		defaultTools: ["read", "powershell", "custom-tool"],
	});
	const { threw, ret, out } = await runCase("win32", destContent);
	check(
		"W2: win32 respects existing shellPath",
		threw === null && out?.shellPath === "C:\\tools\\custom\\pwsh.exe",
		`shellPath=${JSON.stringify(out?.shellPath)} threw=${String(threw)}`,
	);
	check(
		"W2: win32 respects existing defaultTools",
		threw === null &&
			Array.isArray(out?.defaultTools) &&
			out.defaultTools.length === 3 &&
			out.defaultTools[2] === "custom-tool",
		`defaultTools=${JSON.stringify(out?.defaultTools)}`,
	);
	check(
		"W2: win32 still reports success",
		ret === true,
		`ret=${JSON.stringify(ret)}`,
	);
}

// ---------------------------------------------------------------------------
// W3: non-win32 platforms (linux / darwin) -> NO injection, regardless of dest.
// ---------------------------------------------------------------------------
for (const plat of ["linux", "darwin"]) {
	const { threw, ret, out } = await runCase(plat, "{}");
	check(
		`W3: ${plat} does not throw`,
		threw === null,
		`threw=${String(threw)}`,
	);
	check(
		`W3: ${plat} leaves shellPath unset`,
		out?.shellPath === undefined,
		`shellPath=${JSON.stringify(out?.shellPath)}`,
	);
	check(
		`W3: ${plat} leaves defaultTools unset`,
		out?.defaultTools === undefined,
		`defaultTools=${JSON.stringify(out?.defaultTools)}`,
	);
	check(
		`W3: ${plat} still reports success and keeps managed keys`,
		ret === true && out?.managedKey === "v1",
		`ret=${JSON.stringify(ret)} out=${JSON.stringify(out)}`,
	);
}

// ---------------------------------------------------------------------------
// W4: omitted third arg (vm has NO global process -> platform undefined) ->
// no injection and NO throw. Guards the existing two-arg call shape so
// merge-agent-settings.mjs keeps passing in the same vm context.
// ---------------------------------------------------------------------------
{
	const dest = path.join(tmpDir, "dest-noargs.json");
	await fs.writeFile(dest, "{}");
	let threw = null;
	let ret;
	try {
		ret = await mergeAgentSettings(GOOD_SRC, dest);
	} catch (err) {
		threw = err;
	}
	const out = JSON.parse(await fs.readFile(dest, "utf8"));
	check(
		"W4: two-arg call does not throw without a process global",
		threw === null,
		`threw=${String(threw)}`,
	);
	check(
		"W4: two-arg call does not inject on unknown platform",
		out?.shellPath === undefined && out?.defaultTools === undefined,
		`out=${JSON.stringify(out)}`,
	);
	check(
		"W4: two-arg call still succeeds and merges managed keys",
		ret === true && out?.managedKey === "v1",
		`ret=${JSON.stringify(ret)}`,
	);
}

// ---------------------------------------------------------------------------
// W5: win32 + empty dest -> subagents.agentOverrides derived from the agent
// dir (NOT hard-coded names), keyed by RUNTIME name (hkx.<name>). planner uses
// bash (swapped to powershell); reviewer already uses powershell (unchanged).
// ---------------------------------------------------------------------------
const AGENT_DIR = await writeAgentDir({
	planner: "read, ffgrep, fffind, grep, find, ls, bash, intercom",
	reviewer: ["read", "grep", "find", "powershell"],
});
{
	const { threw, ret, out } = await runCase("win32", "{}", AGENT_DIR);
	const overrides = out?.subagents?.agentOverrides;
	check(
		"W5: win32 does not throw and reports success",
		threw === null && ret === true,
		`threw=${String(threw)} ret=${JSON.stringify(ret)}`,
	);
	check(
		"W5: win32 derives runtime-keyed overrides, no scout/worker",
		isPlainObjectLocal(overrides) &&
			Object.keys(overrides).sort().join(",") === "hkx.planner,hkx.reviewer" &&
			overrides.scout === undefined &&
			overrides.worker === undefined &&
			overrides.planner === undefined,
		`overrides keys=${JSON.stringify(overrides && Object.keys(overrides))}`,
	);
	check(
		"W5: win32 swaps bash -> powershell for hkx.planner",
		Array.isArray(overrides?.["hkx.planner"]?.tools) &&
			overrides["hkx.planner"].tools.includes("powershell") &&
			!overrides["hkx.planner"].tools.includes("bash") &&
			overrides["hkx.planner"].tools.includes("ffgrep") &&
			overrides["hkx.planner"].tools.includes("intercom"),
		`hkx.planner=${JSON.stringify(overrides?.["hkx.planner"])}`,
	);
	check(
		"W5: win32 keeps non-bash hkx.reviewer unchanged",
		Array.isArray(overrides?.["hkx.reviewer"]?.tools) &&
			overrides["hkx.reviewer"].tools.includes("powershell") &&
			overrides["hkx.reviewer"].tools.length === 4,
		`hkx.reviewer=${JSON.stringify(overrides?.["hkx.reviewer"])}`,
	);
}

// ---------------------------------------------------------------------------
// W6: win32 + dest already sets hkx.planner.tools -> that runtime key keeps
// the operator's list, hkx.reviewer (unset) is still seeded from the agent dir.
// ---------------------------------------------------------------------------
{
	const destContent = JSON.stringify({
		subagents: {
			agentOverrides: {
				"hkx.planner": { tools: ["read", "powershell", "custom-planner"] },
			},
		},
	});
	const { threw, ret, out } = await runCase("win32", destContent, AGENT_DIR);
	const overrides = out?.subagents?.agentOverrides;
	check(
		"W6: win32 preserves operator hkx.planner tools",
		threw === null &&
			Array.isArray(overrides?.["hkx.planner"]?.tools) &&
			overrides["hkx.planner"].tools.length === 3 &&
			overrides["hkx.planner"].tools[2] === "custom-planner",
		`hkx.planner=${JSON.stringify(overrides?.["hkx.planner"])} threw=${String(threw)}`,
	);
	check(
		"W6: win32 still seeds hkx.reviewer from agent dir",
		Array.isArray(overrides?.["hkx.reviewer"]?.tools) &&
			overrides["hkx.reviewer"].tools.includes("powershell") &&
			overrides["hkx.reviewer"].tools.length === 4,
		`hkx.reviewer=${JSON.stringify(overrides?.["hkx.reviewer"])}`,
	);
	check(
		"W6: win32 still reports success",
		ret === true,
		`ret=${JSON.stringify(ret)}`,
	);
}

// ---------------------------------------------------------------------------
// W7: win32 + dest already sets ALL agent runtime tools -> all preserved, and
// an unrelated agent override (custom-extra) is left untouched.
// ---------------------------------------------------------------------------
{
	const destContent = JSON.stringify({
		subagents: {
			agentOverrides: {
				"hkx.planner": { tools: ["read"] },
				"hkx.reviewer": { tools: ["read", "write"] },
				"custom-extra": { tools: ["read", "grep", "find"] },
			},
		},
	});
	const { threw, ret, out } = await runCase("win32", destContent, AGENT_DIR);
	const overrides = out?.subagents?.agentOverrides;
	check(
		"W7: win32 preserves all operator tool lists",
		threw === null &&
			Array.isArray(overrides?.["hkx.planner"]?.tools) &&
			Array.isArray(overrides?.["hkx.reviewer"]?.tools) &&
			overrides["hkx.planner"].tools.length === 1 &&
			overrides["hkx.reviewer"].tools.length === 2 &&
			overrides["hkx.reviewer"].tools[1] === "write",
		`overrides=${JSON.stringify(overrides)} threw=${String(threw)}`,
	);
	check(
		"W7: win32 preserves unrelated agent overrides (custom-extra)",
		Array.isArray(overrides?.["custom-extra"]?.tools) &&
			overrides["custom-extra"].tools.length === 3 &&
			overrides["custom-extra"].tools[2] === "find",
		`custom-extra=${JSON.stringify(overrides?.["custom-extra"])}`,
	);
	check(
		"W7: win32 still reports success",
		ret === true,
		`ret=${JSON.stringify(ret)}`,
	);
}

// ---------------------------------------------------------------------------
// W8: non-win32 platforms -> NO subagents injection even with an agent dir.
// ---------------------------------------------------------------------------
for (const plat of ["linux", "darwin"]) {
	const { threw, ret, out } = await runCase(plat, "{}", AGENT_DIR);
	check(
		`W8: ${plat} leaves subagents unset`,
		threw === null && out?.subagents === undefined,
		`subagents=${JSON.stringify(out?.subagents)} threw=${String(threw)}`,
	);
	check(
		`W8: ${plat} still reports success`,
		ret === true,
		`ret=${JSON.stringify(ret)}`,
	);
}

// ---------------------------------------------------------------------------
// W9: win32 but no agent dir (or empty dir) -> no override, still succeeds
// (graceful degradation, not a merge failure).
// ---------------------------------------------------------------------------
{
	const emptyDir = await writeAgentDir({});
	const { threw, ret, out } = await runCase("win32", "{}", emptyDir);
	check(
		"W9: win32 empty agent dir does not throw",
		threw === null && ret === true,
		`threw=${String(threw)} ret=${JSON.stringify(ret)}`,
	);
	check(
		"W9: win32 empty agent dir leaves subagents unset",
		out?.subagents === undefined,
		`subagents=${JSON.stringify(out?.subagents)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} WINDOWS-SETTINGS CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
