/**
 * Windows seed regression for the pi-permission-system config overlay:
 * `seedWindowsPermissionShellTools` seeds `shellTools.powershell` (the
 * non-bash shell tool that replaces `bash` on win32) so the permission
 * system gates `powershell` calls through the same enforcement stack as
 * native `bash`. Seed is per-tool, only-if-missing (same contract as the
 * rpiv-advisor / pi-tool-display / Windows settings overlays).
 *
 * Why this matters: without the alias, `powershell` tool calls bypass the
 * `bash:` rule block (e.g. `powershell *Remove-Item*` -> ask), so the Windows
 * destructive-command gates would be inert. The tool's command argument is
 * `command`.
 *
 * Isolation: load the slice of install.mjs from `function isPlainObject` to
 * `function runCommand` in node:vm (same slice as merge-agent-settings.mjs),
 * so the test does not import the running install path. The vm context has NO
 * global `process`, which keeps the pure-function test hermetic.
 */
import path from "node:path";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const pass = [];
const fail = [];

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

// --- Load the install.mjs helper slice into a vm, same approach as
// merge-agent-settings.mjs. The slice covers isPlainObject() through the
// function just before runCommand(), which now includes
// seedWindowsPermissionShellTools + WINDOWS_PERMISSION_SHELL_TOOLS. ---
const installSrc = readFileSync(
	path.resolve(import.meta.dirname, "..", "install.mjs"),
	"utf8",
);
const sliceStart = installSrc.indexOf("function isPlainObject");
let sliceEnd = installSrc.indexOf("function runCommand");
while (sliceEnd > sliceStart) {
	const prev = installSrc.slice(sliceEnd - 1, sliceEnd);
	if (/\s/.test(prev)) {
		sliceEnd--;
		continue;
	}
	break;
}
const helperSlice = installSrc.slice(sliceStart, sliceEnd).trimEnd();

const vmCtx = {
	console: { ...console, error: () => {}, warn: () => {}, log: () => {} },
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
};
vm.createContext(vmCtx);
const exposed = `
${helperSlice}
return {
	seed: seedWindowsPermissionShellTools,
	defaults: WINDOWS_PERMISSION_SHELL_TOOLS,
};
`;
const api = vm.runInContext(`(function(){${exposed}})()`, vmCtx);
const seed = api.seed;

// ---------------------------------------------------------------------------
// P1: empty config -> shellTools.powershell seeded with commandArgument.
// ---------------------------------------------------------------------------
{
	const config = {};
	seed(config);
	check(
		"P1: seeds shellTools as object",
		isPlainObjectLocal(config.shellTools),
		`shellTools=${JSON.stringify(config.shellTools)}`,
	);
	check(
		"P1: seeds powershell tool alias",
		isPlainObjectLocal(config.shellTools?.powershell) &&
			config.shellTools.powershell.commandArgument === "command",
		`powershell=${JSON.stringify(config.shellTools?.powershell)}`,
	);
	check(
		"P1: does not add workdirArgument (unspecified)",
		config.shellTools.powershell.workdirArgument === undefined,
		`powershell=${JSON.stringify(config.shellTools.powershell)}`,
	);
}

// ---------------------------------------------------------------------------
// P2: config already has shellTools with an unrelated tool (exec_command) ->
// that entry is preserved and powershell is added alongside it.
// ---------------------------------------------------------------------------
{
	const config = {
		shellTools: { exec_command: { commandArgument: "cmd", workdirArgument: "workdir" } },
	};
	seed(config);
	check(
		"P2: preserves unrelated exec_command alias",
		config.shellTools?.exec_command?.commandArgument === "cmd" &&
			config.shellTools.exec_command.workdirArgument === "workdir",
		`exec_command=${JSON.stringify(config.shellTools?.exec_command)}`,
	);
	check(
		"P2: adds powershell alongside exec_command",
		config.shellTools?.powershell?.commandArgument === "command",
		`powershell=${JSON.stringify(config.shellTools?.powershell)}`,
	);
	check(
		"P2: keeps both keys",
		Object.keys(config.shellTools).sort().join(",") === "exec_command,powershell",
		`keys=${JSON.stringify(Object.keys(config.shellTools))}`,
	);
}

// ---------------------------------------------------------------------------
// P3: operator already set shellTools.powershell with a custom argument ->
// that value is preserved (seed-if-missing, never overwrite).
// ---------------------------------------------------------------------------
{
	const config = {
		shellTools: { powershell: { commandArgument: "custom-arg", workdirArgument: "wd" } },
	};
	seed(config);
	check(
		"P3: preserves operator powershell.commandArgument",
		config.shellTools?.powershell?.commandArgument === "custom-arg",
		`powershell=${JSON.stringify(config.shellTools?.powershell)}`,
	);
	check(
		"P3: preserves operator powershell.workdirArgument",
		config.shellTools?.powershell?.workdirArgument === "wd",
		`powershell=${JSON.stringify(config.shellTools?.powershell)}`,
	);
}

// ---------------------------------------------------------------------------
// P4: shellTools present but no powershell key, alongside a pre-existing
// alias -> only powershell is added; the existing alias is untouched.
// ---------------------------------------------------------------------------
{
	const config = {
		shellTools: { bash: { commandArgument: "command" } },
	};
	seed(config);
	check(
		"P4: preserves existing bash alias",
		config.shellTools?.bash?.commandArgument === "command",
		`bash=${JSON.stringify(config.shellTools?.bash)}`,
	);
	check(
		"P4: adds powershell alias",
		config.shellTools?.powershell?.commandArgument === "command",
		`powershell=${JSON.stringify(config.shellTools?.powershell)}`,
	);
}

// ---------------------------------------------------------------------------
// P5: shellTools is a non-object invalid value (schema requires object) ->
// treated as missing and replaced with a seeded object.
// ---------------------------------------------------------------------------
{
	const config = { shellTools: "kept-by-operator" };
	seed(config);
	check(
		"P5: replaces non-object shellTools with a seeded object",
		isPlainObjectLocal(config.shellTools) &&
			config.shellTools.powershell?.commandArgument === "command",
		`shellTools=${JSON.stringify(config.shellTools)}`,
	);
}

// ---------------------------------------------------------------------------
// P6: seeding is idempotent (running twice does not duplicate or nest).
// ---------------------------------------------------------------------------
{
	const config = {};
	seed(config);
	seed(config);
	check(
		"P6: idempotent — single powershell key after two seeds",
		isPlainObjectLocal(config.shellTools) &&
			Object.keys(config.shellTools).length === 1 &&
			config.shellTools.powershell?.commandArgument === "command",
		`shellTools=${JSON.stringify(config.shellTools)}`,
	);
}

// ---------------------------------------------------------------------------
// P7: the default constant matches the expected Windows alias shape.
// ---------------------------------------------------------------------------
{
	check(
		"P7: WINDOWS_PERMISSION_SHELL_TOOLS.powershell.commandArgument === 'command'",
		api.defaults?.powershell?.commandArgument === "command",
		`defaults=${JSON.stringify(api.defaults)}`,
	);
	check(
		"P7: defaults has no workdirArgument",
		api.defaults?.powershell?.workdirArgument === undefined,
		`defaults=${JSON.stringify(api.defaults)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} WINDOWS-PERMISSION CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
