/**
 * Platform-default regression for mergeAgentSettings: on a Windows install
 * (platform === "win32") the operator's ~/.pi/agent/settings.json should gain
 * sensible machine-local defaults — PowerShell 7 as the shell and a pi-native
 * default tool list — but ONLY when the operator has not already set them
 * (seed-if-missing, same contract as the rpiv-advisor / pi-tool-display
 * overlays). On any other platform, or when the operator already configured
 * the keys, nothing is injected.
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
async function runCase(platform, destContentJson) {
	const dest = path.join(tmpDir, `dest-${platform}-${Math.random().toString(36).slice(2)}.json`);
	await fs.writeFile(dest, destContentJson);
	let threw = null;
	let ret;
	try {
		ret = await mergeAgentSettings(GOOD_SRC, dest, { platform });
	} catch (err) {
		threw = err;
	}
	const raw = await fs.readFile(dest, "utf8");
	return { dest, threw, ret, out: JSON.parse(raw) };
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

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} WINDOWS-SETTINGS CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
