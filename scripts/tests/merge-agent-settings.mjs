/**
 * MF-7 regression: mergeAgentSettings MUST NOT silently no-op on read/parse
 * failure. The three sibling install surfaces (mergeMcpConfig,
 * updatePiExtensions, installPermissionSystemConfig) report failure into the
 * caller's `failed[]` so install sets process.exitCode != 0. Pre-fix
 * mergeAgentSettings caught the error, logged to stderr, and returned void —
 * the caller never learned, so install printed
 * "Global installation to ~/.pi/agent completed successfully!" with exit 0.
 *
 * Contract this test enforces (channel-agnostic shape):
 *   - On source-file read/parse failure, mergeAgentSettings communicates the
 *     failure to its caller (one of: throws, returns `false`, returns a label
 *     string). A silent `return` is a bug.
 *   - On success it communicates success (returns truthy / undefined for
 *     back-compat with the void success return is fine as long as the failure
 *     channel is distinct and non-silent).
 *
 * Isolation: load mergeAgentSettings source in node:vm like merge-contract.mjs
 * does, so the test does not import the running install path.
 */
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { readFileSync } from "node:fs";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-mf7-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) {
		pass.push(name);
	} else {
		fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
	}
}

// Slice the helpers out of install.mjs the same way merge-contract does so the
// test stays isolated from the full install I/O surface. mergeAgentSettings
// uses: isPlainObject, deepMerge, fs, path, console. We provide all of them.
const installSrc = readFileSync("scripts/install.mjs", "utf8");
const start = installSrc.indexOf("function isPlainObject");
// End just before `function runCommand`, which immediately follows
// mergeAgentSettings. This slice carries isPlainObject, deepMerge,
// mergeSecretMaps, mergeServerConfig, mergeMcpServers, mergeMcpConfig,
// and mergeAgentSettings. mergeAgentSettings only needs isPlainObject +
// deepMerge + fs + JSON, but bundling the full helper block matches the
// existing merge-contract smoke isolation and keeps vm.eval stable.
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
		// capture stderr/log noise so the test output stays focused
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

// ---------------------------------------------------------------------------
// Case A (MF-7 red): corrupt source settings file -> must surface failure.
// Pre-fix: mergeAgentSettings catches the JSON error, logs, and returns void
// with no distinct failure channel -> install reports success.
// ---------------------------------------------------------------------------
{
	const corruptSrc = path.join(tmpDir, "agent-settings-bad.json");
	const dest = path.join(tmpDir, "settings-a.json");
	await fs.writeFile(corruptSrc, "{ not-json");
	await fs.writeFile(dest, "{}");

	let threw = false;
	let ret;
	let retIsFalse = false;
	let retIsLabel = false;
	try {
		ret = await mergeAgentSettings(corruptSrc, dest);
	} catch (err) {
		threw = true;
	}
	if (ret === false) retIsFalse = true;
	if (typeof ret === "string" && ret.length > 0) retIsLabel = true;

	const surfaced = threw || retIsFalse || retIsLabel;
	check(
		"A: corrupt source surfaces failure (throw | false | label)",
		surfaced === true,
		`threw=${threw} ret=${JSON.stringify(ret)} (pre-fix silent no-op)`,
	);

	// No partial write must occur on a source-read failure: dest should be
	// untouched so the operator's existing settings are not corrupted by a bad
	// managed-source read.
	const destAfter = await fs.readFile(dest, "utf8");
	check(
		"A: corrupt source did not rewrite dest",
		destAfter === "{}",
		`dest was rewritten to ${JSON.stringify(destAfter)}`,
	);
}

// ---------------------------------------------------------------------------
// Case B (MF-7 red): missing source file -> must surface failure too
// (readFileSync throws ENOENT which the pre-fix catch swallows silently).
// ---------------------------------------------------------------------------
{
	const missingSrc = path.join(tmpDir, "does-not-exist.json");
	const dest = path.join(tmpDir, "settings-b.json");
	await fs.writeFile(dest, "{}");

	let threw = false;
	let ret;
	let retIsFalse = false;
	let retIsLabel = false;
	try {
		ret = await mergeAgentSettings(missingSrc, dest);
	} catch (err) {
		threw = true;
	}
	if (ret === false) retIsFalse = true;
	if (typeof ret === "string" && ret.length > 0) retIsLabel = true;

	const surfaced = threw || retIsFalse || retIsLabel;
	check(
		"B: missing source surfaces failure (throw | false | label)",
		surfaced === true,
		`threw=${threw} ret=${JSON.stringify(ret)} (pre-fix silent no-op)`,
	);
}

// ---------------------------------------------------------------------------
// Case C (guard): valid source -> merges, writes dest, and does NOT surface a
// spurious failure. The success path must remain non-failing.
// ---------------------------------------------------------------------------
{
	const goodSrc = path.join(tmpDir, "agent-settings-good.json");
	const dest = path.join(tmpDir, "settings-c.json");
	await fs.writeFile(
		goodSrc,
		JSON.stringify({ packages: ["some-pkg"], managedKey: "v1" }),
	);
	await fs.writeFile(dest, JSON.stringify({ localKey: "keep" }));

	let threw = false;
	let ret;
	try {
		ret = await mergeAgentSettings(goodSrc, dest);
	} catch (err) {
		threw = true;
	}
	let out = null;
	let parseErr = null;
	try {
		out = JSON.parse(await fs.readFile(dest, "utf8"));
	} catch (err) {
		parseErr = err.message;
	}
	check(
		"C: valid source writes parseable dest",
		out !== null,
		parseErr ? `dest parse failed: ${parseErr}` : "",
	);
	check(
		"C: valid source does not surface failure",
		threw === false && !(ret === false),
		`threw=${threw} ret=${JSON.stringify(ret)}`,
	);
	check(
		"C: valid source merged managed keys into dest",
		out !== null &&
			out.managedKey === "v1" &&
			out.localKey === "keep" &&
			Array.isArray(out.packages) &&
			out.packages[0] === "some-pkg",
		`out=${JSON.stringify(out)}`,
	);
}

// ---------------------------------------------------------------------------
// Case D (M1 red): corrupt DEST settings file -> must surface failure, NOT
// silently overwrite with managed-only content.
//
// The dest read catch currently has no ENOENT gate — it swallows EVERY
// failure including corrupt JSON. After swallowing, current={}, the managed
// keys are deep-merged into an empty object, and the user's file is
// overwritten — wiping machine-local keys (shellPath, defaultProvider, etc.)
// while the function reports success (return true). This mirrors the
// mergeMcpConfig dest-corrupt hard-fail that was already hardened.
// ---------------------------------------------------------------------------
{
	const goodSrc = path.join(tmpDir, "agent-settings-good-d.json");
	const dest = path.join(tmpDir, "settings-d.json");
	await fs.writeFile(
		goodSrc,
		JSON.stringify({ packages: ["some-pkg"], managedKey: "v1" }),
	);
	// Write a CORRUPT dest — not valid JSON, but the file EXISTS
	await fs.writeFile(dest, "{ not-json-here");

	let threw = false;
	let ret;
	let retIsFalse = false;
	let retIsLabel = false;
	try {
		ret = await mergeAgentSettings(goodSrc, dest);
	} catch (err) {
		threw = true;
	}
	if (ret === false) retIsFalse = true;
	if (typeof ret === "string" && ret.length > 0) retIsLabel = true;

	const surfaced = threw || retIsFalse || retIsLabel;
	check(
		"D: corrupt dest surfaces failure (throw | false | label)",
		surfaced === true,
		`threw=${threw} ret=${JSON.stringify(ret)} (dest-corrupt silent clobber)`,
	);

	// The corrupt dest must NOT be overwritten with managed-only content.
	// (Data-loss guard: operator's machine-local keys survive.)
	const destAfter = await fs.readFile(dest, "utf8");
	check(
		"D: corrupt dest did not get rewritten",
		destAfter === "{ not-json-here",
		`dest was overwritten to ${JSON.stringify(destAfter)}`,
	);
}

// ---------------------------------------------------------------------------
// Case D2 (M1 silent-failure finding-1 red): dest is VALID JSON but NOT a
// plain object (e.g. `[]`, `null`, `"string"`, `123`, `true`). The read
// succeeds (no catch entry), `current` holds the non-object value, and
// pre-fix deepMerge re-seeded to {} when target was not a plain object,
// then writeFile overwrote the operator's file with managed-only content
// while the function returned true. Mirrors the mergeMcpConfig dest guard
// at scripts/install.mjs:214 (`if (!isPlainObject(destContent)) throw ...`).
// ---------------------------------------------------------------------------
{
	const goodSrc = path.join(tmpDir, "agent-settings-good-d2.json");
	const dest = path.join(tmpDir, "settings-d2.json");
	await fs.writeFile(
		goodSrc,
		JSON.stringify({ packages: ["some-pkg"], managedKey: "v1" }),
	);
	// Write a VALID-JSON-but-non-object dest (a JSON array). The read succeeds,
	// so the catch branch never fires; only an isPlainObject guard after the
	// try block can catch this and prevent the silent clobber.
	const before = JSON.stringify([{ machineLocal: "shell-of-operator" }]);
	await fs.writeFile(dest, before);

	let threw = false;
	let ret;
	let retIsFalse = false;
	let retIsLabel = false;
	try {
		ret = await mergeAgentSettings(goodSrc, dest);
	} catch (err) {
		threw = true;
	}
	if (ret === false) retIsFalse = true;
	if (typeof ret === "string" && ret.length > 0) retIsLabel = true;

	const surfaced = threw || retIsFalse || retIsLabel;
	check(
		"D2: non-object valid-JSON dest surfaces failure (throw | false | label)",
		surfaced === true,
		`threw=${threw} ret=${JSON.stringify(ret)} (valid-JSON-non-object silent clobber)`,
	);

	// The non-object dest must NOT be overwritten with managed-only content.
	// Machine-local keys (here modeled as `machineLocal`) would be wiped by
	// a silent deepMerge re-seed-to-{}; the isPlainObject guard prevents it.
	const destAfter = await fs.readFile(dest, "utf8");
	check(
		"D2: non-object valid-JSON dest did not get rewritten",
		destAfter === before,
		`dest was overwritten to ${JSON.stringify(destAfter)}`,
	);
}

// ---------------------------------------------------------------------------
// Case E (guard): MISSING dest (ENOENT) -> still succeeds, creates the file.
// This is the legitimate first-install path that the ENOENT gate must allow.
// ---------------------------------------------------------------------------
{
	const goodSrc = path.join(tmpDir, "agent-settings-good-e.json");
	const dest = path.join(tmpDir, "settings-e.json");
	await fs.writeFile(
		goodSrc,
		JSON.stringify({ packages: ["some-pkg"], managedKey: "v1" }),
	);
	// dest does NOT exist — first install, ENOENT is expected

	let threw = false;
	let ret;
	try {
		ret = await mergeAgentSettings(goodSrc, dest);
	} catch (err) {
		threw = true;
	}
	let out = null;
	try {
		out = JSON.parse(await fs.readFile(dest, "utf8"));
	} catch {}
	check(
		"E: missing dest (ENOENT) succeeds and creates file",
		threw === false &&
			!(ret === false) &&
			out !== null &&
			out.managedKey === "v1",
		`threw=${threw} ret=${JSON.stringify(ret)} out=${JSON.stringify(out)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} MF-7 CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
