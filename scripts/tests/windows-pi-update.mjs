#!/usr/bin/env node
/**
 * Windows regression: npm installs the pi CLI as a pi.cmd shim. Node cannot
 * launch that batch file directly through spawn(), so install.mjs must invoke
 * it through cmd.exe when running `pi update --extensions`.
 *
 * The helper is vm-loaded to keep this smoke test free of ~/.pi/agent writes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const installSource = readFileSync(
	path.join(root, "scripts", "install.mjs"),
	"utf8",
);
const pass = [];
const fail = [];

function check(name, condition, detail) {
	if (condition) {
		pass.push(name);
	} else {
		fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
	}
}

const helperStart = installSource.indexOf("function getPiUpdateInvocation");
const helperEnd = installSource.indexOf("\nfunction runCommand", helperStart);
check(
	"installer exposes a platform-specific pi update invocation helper",
	helperStart >= 0 && helperEnd > helperStart,
	`start=${helperStart} end=${helperEnd}`,
);

let getPiUpdateInvocation;
if (helperStart >= 0 && helperEnd > helperStart) {
	const context = {};
	vm.createContext(context);
	vm.runInContext(
		`${installSource.slice(helperStart, helperEnd).trimEnd()}\nthis.__getPiUpdateInvocation = getPiUpdateInvocation;`,
		context,
	);
	getPiUpdateInvocation = context.__getPiUpdateInvocation;
}

if (getPiUpdateInvocation) {
	const windows = getPiUpdateInvocation("win32", {
		ComSpec: "C:\\Windows\\System32\\cmd.exe",
	});
	check(
		"Windows invokes the configured cmd.exe shell",
		windows.command === "C:\\Windows\\System32\\cmd.exe",
		JSON.stringify(windows),
	);
	check(
		"Windows passes pi.cmd through cmd.exe with fixed update arguments",
		JSON.stringify(windows.args) ===
			JSON.stringify(["/d", "/c", "pi.cmd update --extensions"]),
		JSON.stringify(windows.args),
	);

	const uppercaseComSpec = getPiUpdateInvocation("win32", {
		COMSPEC: "C:\\Windows\\System32\\cmd.exe",
	});
	check(
		"Windows accepts an uppercase COMSPEC environment key",
		uppercaseComSpec.command === "C:\\Windows\\System32\\cmd.exe",
		JSON.stringify(uppercaseComSpec),
	);

	const fallback = getPiUpdateInvocation("win32", {});
	check(
		"Windows falls back to cmd.exe when ComSpec is absent",
		fallback.command === "cmd.exe",
		JSON.stringify(fallback),
	);

	const posix = getPiUpdateInvocation("linux", {});
	check(
		"non-Windows keeps direct pi process invocation",
		posix.command === "pi" &&
			JSON.stringify(posix.args) === JSON.stringify(["update", "--extensions"]),
		JSON.stringify(posix),
	);
}

const updateStart = installSource.indexOf("async function updatePiExtensions");
const updateEnd = installSource.indexOf("\n/**", updateStart);
const updateBody =
	updateStart >= 0 && updateEnd > updateStart
		? installSource.slice(updateStart, updateEnd)
		: "";
check(
	"pi update uses the platform-specific invocation helper",
	/getPiUpdateInvocation\(\)/.test(updateBody) &&
		/await runCommand\(command, args\)/.test(updateBody),
	updateBody || "updatePiExtensions block not found",
);

for (const name of pass) console.log("ok:", name);
if (fail.length > 0) {
	for (const message of fail) console.error("FAIL:", message);
	process.exit(1);
}
console.log(`ALL ${pass.length} WINDOWS PI UPDATE CHECKS PASS`);
