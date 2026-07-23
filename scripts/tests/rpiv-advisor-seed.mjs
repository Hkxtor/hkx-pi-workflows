/**
 * Path B seed contract for configs/rpiv-advisor/advisor.json.
 *
 * install.mjs::installRpivAdvisorConfig seeds
 *   $XDG_CONFIG_HOME/rpiv-advisor/advisor.json  (or ~/.config/...)
 * only when the destination is missing. Existing operator /advisor
 * selections must never be clobbered.
 *
 * Isolation: temp HOME + XDG_CONFIG_HOME; never mutates the real
 * ~/.config/rpiv-advisor. Exercises the same path resolution rules
 * (absolute XDG_CONFIG_HOME vs default ~/.config).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import {
	existsSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	chmodSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const srcTemplate = path.join(root, "configs", "rpiv-advisor", "advisor.json");
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-advisor-seed-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// Mirror install.mjs resolveXdgConfigDir + installRpivAdvisorConfig
// without running full install-global (which would hit pi update).
function resolveXdgConfigDir(env) {
	const xdg = env.XDG_CONFIG_HOME?.trim();
	if (xdg && path.isAbsolute(xdg)) return xdg;
	return path.join(env.HOME || os.homedir(), ".config");
}

async function seedOnce(env) {
	const destDir = path.join(resolveXdgConfigDir(env), "rpiv-advisor");
	const dest = path.join(destDir, "advisor.json");
	if (existsSync(dest)) {
		return { dest, seeded: false, kept: true };
	}
	mkdirSync(destDir, { recursive: true });
	const body = readFileSync(srcTemplate, "utf8");
	JSON.parse(body);
	writeFileSync(dest, body.endsWith("\n") ? body : `${body}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
	chmodSync(dest, 0o600);
	return { dest, seeded: true, kept: false };
}

// ---------------------------------------------------------------------------
// Preconditions on repo template
// ---------------------------------------------------------------------------
{
	check("template exists", existsSync(srcTemplate), srcTemplate);
	const raw = readFileSync(srcTemplate, "utf8");
	let obj;
	try {
		obj = JSON.parse(raw);
		check("template is JSON object", obj && typeof obj === "object", "");
	} catch (err) {
		check("template is JSON object", false, err.message);
		obj = null;
	}
	if (obj) {
		check(
			"template omits modelKey",
			!Object.hasOwn(obj, "modelKey"),
			JSON.stringify(Object.keys(obj)),
		);
		check(
			"template has effort string",
			typeof obj.effort === "string" && obj.effort.length > 0,
			String(obj.effort),
		);
		check(
			"template has guidance.promptGuidelines array",
			Array.isArray(obj.guidance?.promptGuidelines) &&
				obj.guidance.promptGuidelines.length > 0,
			"",
		);
	}
}

// ---------------------------------------------------------------------------
// A: cold seed into XDG_CONFIG_HOME
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "a-home");
	const xdg = path.join(tmpRoot, "a-xdg");
	mkdirSync(home, { recursive: true });
	mkdirSync(xdg, { recursive: true });
	const env = { HOME: home, XDG_CONFIG_HOME: xdg };
	const r1 = await seedOnce(env);
	check("A: seeds when missing", r1.seeded === true, JSON.stringify(r1));
	check("A: dest under XDG_CONFIG_HOME", r1.dest.startsWith(xdg), r1.dest);
	check("A: dest file exists", existsSync(r1.dest), r1.dest);
	const mode = (await fs.stat(r1.dest)).mode & 0o777;
	check("A: mode 0600", mode === 0o600, `mode=${mode.toString(8)}`);
	const seeded = JSON.parse(readFileSync(r1.dest, "utf8"));
	check(
		"A: seeded content has no modelKey",
		!Object.hasOwn(seeded, "modelKey"),
		JSON.stringify(seeded),
	);

	// re-run must keep operator file (simulate /advisor wrote modelKey)
	const operator = {
		modelKey: "meme/test-operator-model",
		effort: "xhigh",
		disabledForModels: ["meme/test-operator-model"],
	};
	writeFileSync(r1.dest, JSON.stringify(operator, null, 2) + "\n");
	const r2 = await seedOnce(env);
	check("A: second run does not re-seed", r2.seeded === false && r2.kept, "");
	const after = JSON.parse(readFileSync(r1.dest, "utf8"));
	check(
		"A: operator modelKey preserved",
		after.modelKey === "meme/test-operator-model",
		JSON.stringify(after),
	);
	check(
		"A: operator effort preserved",
		after.effort === "xhigh",
		JSON.stringify(after),
	);
}

// ---------------------------------------------------------------------------
// B: falls back to $HOME/.config when XDG unset
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "b-home");
	mkdirSync(home, { recursive: true });
	const env = { HOME: home };
	const r = await seedOnce(env);
	const expected = path.join(home, ".config", "rpiv-advisor", "advisor.json");
	check("B: seeds under HOME/.config", r.dest === expected, r.dest);
	check("B: file exists", existsSync(expected), expected);
}

// ---------------------------------------------------------------------------
// C: install.mjs source still exports seed path (string presence smoke)
// ---------------------------------------------------------------------------
{
	const installSrc = readFileSync(
		path.join(root, "scripts", "install.mjs"),
		"utf8",
	);
	check(
		"C: install.mjs defines installRpivAdvisorConfig",
		/function installRpivAdvisorConfig/.test(installSrc),
		"",
	);
	check(
		"C: install.mjs calls installRpivAdvisorConfig",
		/installRpivAdvisorConfig\(\)/.test(installSrc),
		"",
	);
	check(
		"C: install.mjs documents seed-if-missing",
		/seed-if-missing|only if missing|not overwriting/i.test(installSrc),
		"",
	);
}

// ---------------------------------------------------------------------------
// D: validate accepts current template (subprocess)
// ---------------------------------------------------------------------------
{
	const result = spawnSync(
		process.execPath,
		[path.join(root, "scripts", "validate.mjs")],
		{
			cwd: root,
			encoding: "utf8",
			env: process.env,
		},
	);
	check(
		"D: npm-style validate exits 0 with template",
		result.status === 0,
		`status=${result.status} stderr=${(result.stderr || "").slice(0, 300)}`,
	);
}

await fs.rm(tmpRoot, { recursive: true, force: true });

console.log(`pass: ${pass.length}`);
for (const p of pass) console.log(`  ✓ ${p}`);
if (fail.length) {
	console.error(`fail: ${fail.length}`);
	for (const f of fail) console.error(`  ✗ ${f}`);
	process.exit(1);
}
console.log("rpiv-advisor-seed: ok");
