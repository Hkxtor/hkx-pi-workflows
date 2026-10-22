/**
 * Path B managed-key seed contract for configs/pi-plan-mode/config.json.
 *
 * install.mjs::installPlanModeConfig seeds the managed keys
 *   ~/.pi/agent/pi-plan-mode.json
 * into an operator file that lacks them, and creates the file on a cold
 * install. The extension's `/plan settings` UI rewrites that file at runtime,
 * so an existing operator value must never be clobbered and an unrelated
 * operator key must survive untouched.
 *
 * Why the seed exists (regression this suite protects): Pi tool registration
 * is a name-keyed Map, so an extension re-registering a built-in name replaces
 * it and rewrites `sourceInfo.source` from "builtin" to its own package. Plan
 * mode's automatic policy admits only "builtin"-sourced tools
 * (`defaultPlanModeToolNames` -> `isBuiltinTool`), so a display-only extension
 * such as pi-tool-display (registerToolOverrides) empties the automatic
 * allowlist and Plan mode blocks read/bash/grep/find/ls. An explicit
 * `defaultPlanTools` list bypasses that filter. Losing this key silently
 * reintroduces the outage, which is why the template is asserted here.
 *
 * Isolation: a temp agent dir is passed via options.agentDir (the real
 * ~/.pi/agent is never touched), and the bad-template cases pin
 * options.sourcePath at temp files.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const installSrc = path.join(root, "scripts", "install.mjs");
const srcTemplate = path.join(root, "configs", "pi-plan-mode", "config.json");
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-plan-mode-seed-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// Import the REAL installer. install.mjs guards main() behind an isMain check,
// so importing it here does NOT run the full install path.
const installModule = await import(`file://${installSrc}?t=${Date.now()}`);
const installPlanModeConfig = installModule.installPlanModeConfig;
check(
	"install.mjs exports installPlanModeConfig",
	typeof installPlanModeConfig === "function",
	typeof installPlanModeConfig,
);

const templateRaw = readFileSync(srcTemplate, "utf8");
const template = JSON.parse(templateRaw);

// ---------------------------------------------------------------------------
// Preconditions on the repo template
// ---------------------------------------------------------------------------
{
	check("template exists", existsSync(srcTemplate), srcTemplate);
	check(
		"template ends with newline",
		templateRaw.endsWith("\n"),
		JSON.stringify(templateRaw.slice(-4)),
	);
	const tools = template.defaultPlanTools;
	check("template defaultPlanTools is an array", Array.isArray(tools));
	check(
		"template defaultPlanTools is non-empty",
		Array.isArray(tools) && tools.length > 0,
		JSON.stringify(tools),
	);
	// The whole point of the seed: core exploration tools must be admitted
	// explicitly, because the automatic policy no longer sees them as builtin.
	for (const required of ["read", "bash", "grep", "find", "ls"]) {
		check(
			`template defaultPlanTools includes ${required}`,
			Array.isArray(tools) && tools.includes(required),
			JSON.stringify(tools),
		);
	}
	check(
		"template defaultPlanTools includes ffgrep",
		Array.isArray(tools) && tools.includes("ffgrep"),
		JSON.stringify(tools),
	);
	check(
		"template defaultPlanTools includes fffind",
		Array.isArray(tools) && tools.includes("fffind"),
		JSON.stringify(tools),
	);
	for (const blocked of ["edit", "write"]) {
		check(
			`template defaultPlanTools excludes ${blocked}`,
			!Array.isArray(tools) || !tools.includes(blocked),
			JSON.stringify(tools),
		);
	}
	check(
		"template safeSubcommands is an object",
		template.safeSubcommands &&
			typeof template.safeSubcommands === "object" &&
			!Array.isArray(template.safeSubcommands),
		JSON.stringify(template.safeSubcommands),
	);
	// safeSubcommands keys must be the configurable git subcommands only; the
	// built-in ones are always allowed and pinning them here would be noise.
	check(
		"template safeSubcommands.git lists only configurable subcommands",
		Array.isArray(template.safeSubcommands?.git) &&
			template.safeSubcommands.git.every((s) =>
				["rev-parse", "blame", "describe", "merge-base", "ls-tree", "cat-file"].includes(
					s,
				),
			),
		JSON.stringify(template.safeSubcommands?.git),
	);
	// Operator-owned keys must never be versioned: /plan settings owns them.
	for (const operatorOwned of [
		"thinkingLevel",
		"toggleShortcut",
		"defaultPlanExportPath",
		"implementationPlanRetention",
	]) {
		check(
			`template omits operator-owned key ${operatorOwned}`,
			!Object.hasOwn(template, operatorOwned),
			JSON.stringify(Object.keys(template)),
		);
	}
	// The cold-install path writes the whole template; the merge path appends
	// only PLAN_MODE_SEED_KEYS. Pin the template to exactly those keys so the
	// two paths cannot diverge silently.
	check(
		"template contains only managed keys",
		JSON.stringify(Object.keys(template).sort()) ===
			JSON.stringify(["defaultPlanTools", "safeSubcommands"]),
		JSON.stringify(Object.keys(template)),
	);
}

// ---------------------------------------------------------------------------
// A: cold seed creates the file
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "a-agent");
	mkdirSync(agentDir, { recursive: true });
	const dest = path.join(agentDir, "pi-plan-mode.json");

	const r1 = await installPlanModeConfig({ agentDir });
	check("A: cold install returns true", r1 === true, JSON.stringify(r1));
	check("A: dest file exists", existsSync(dest), dest);
	const seeded = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"A: seeded content deep-equals template",
		JSON.stringify(seeded) === JSON.stringify(template),
		JSON.stringify(seeded),
	);
}

// ---------------------------------------------------------------------------
// B: existing operator file keeps every operator value; only missing managed
//    keys are appended
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "b-agent");
	mkdirSync(agentDir, { recursive: true });
	const dest = path.join(agentDir, "pi-plan-mode.json");

	// Simulates a file written by /plan settings: operator-owned keys present,
	// managed keys absent (the exact state that produced the outage).
	const operator = {
		thinkingLevel: "high",
		toggleShortcut: "ctrl+shift+p",
		defaultPlanExportPath: "PLAN.md",
	};
	writeFileSync(dest, `${JSON.stringify(operator, null, 2)}\n`);

	const r = await installPlanModeConfig({ agentDir });
	check("B: install returns true", r === true, JSON.stringify(r));
	const after = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"B: operator thinkingLevel preserved",
		after.thinkingLevel === "high",
		JSON.stringify(after.thinkingLevel),
	);
	check(
		"B: operator toggleShortcut preserved",
		after.toggleShortcut === "ctrl+shift+p",
		JSON.stringify(after.toggleShortcut),
	);
	check(
		"B: operator defaultPlanExportPath preserved",
		after.defaultPlanExportPath === "PLAN.md",
		JSON.stringify(after.defaultPlanExportPath),
	);
	check(
		"B: missing defaultPlanTools seeded",
		JSON.stringify(after.defaultPlanTools) ===
			JSON.stringify(template.defaultPlanTools),
		JSON.stringify(after.defaultPlanTools),
	);
	check(
		"B: missing safeSubcommands seeded",
		JSON.stringify(after.safeSubcommands) ===
			JSON.stringify(template.safeSubcommands),
		JSON.stringify(after.safeSubcommands),
	);
}

// ---------------------------------------------------------------------------
// C: an operator-owned defaultPlanTools value wins over the template
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "c-agent");
	mkdirSync(agentDir, { recursive: true });
	const dest = path.join(agentDir, "pi-plan-mode.json");

	const operator = {
		defaultPlanTools: ["read", "bash", "custom_tool"],
		safeSubcommands: { git: ["status"] },
	};
	writeFileSync(dest, `${JSON.stringify(operator, null, 2)}\n`);

	const r = await installPlanModeConfig({ agentDir });
	check("C: install returns true", r === true, JSON.stringify(r));
	const after = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"C: operator defaultPlanTools kept verbatim",
		JSON.stringify(after.defaultPlanTools) ===
			JSON.stringify(operator.defaultPlanTools),
		JSON.stringify(after.defaultPlanTools),
	);
	check(
		"C: operator safeSubcommands kept verbatim",
		JSON.stringify(after.safeSubcommands) ===
			JSON.stringify(operator.safeSubcommands),
		JSON.stringify(after.safeSubcommands),
	);
	// Idempotence: a fully-seeded file must not be rewritten.
	const bytesBefore = readFileSync(dest, "utf8");
	const r2 = await installPlanModeConfig({ agentDir });
	check("C: rerun returns true", r2 === true, JSON.stringify(r2));
	check(
		"C: rerun leaves a fully-seeded file byte-identical",
		readFileSync(dest, "utf8") === bytesBefore,
		"",
	);
}

// ---------------------------------------------------------------------------
// D: cold seed creates the agent dir when missing
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "d-agent-nested", "agent");
	const dest = path.join(agentDir, "pi-plan-mode.json");
	const r = await installPlanModeConfig({ agentDir });
	check(
		"D: install returns true with missing agent dir",
		r === true,
		JSON.stringify(r),
	);
	check("D: dest file exists", existsSync(dest), dest);
}

// ---------------------------------------------------------------------------
// E: invalid template JSON is refused, not seeded
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "e-agent");
	mkdirSync(agentDir, { recursive: true });
	const badSrc = path.join(tmpRoot, "e-bad-template.json");
	writeFileSync(badSrc, "{ not-json-here");
	const dest = path.join(agentDir, "pi-plan-mode.json");
	const r = await installPlanModeConfig({ agentDir, sourcePath: badSrc });
	check("E: invalid template returns false", r === false, JSON.stringify(r));
	check("E: invalid template does not create dest", !existsSync(dest), dest);
}

// ---------------------------------------------------------------------------
// F: an unreadable destination fails closed (never silently replaced)
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "f-agent");
	mkdirSync(agentDir, { recursive: true });
	const dest = path.join(agentDir, "pi-plan-mode.json");
	const corrupt = "{ this is not valid json";
	writeFileSync(dest, corrupt);

	const r = await installPlanModeConfig({ agentDir });
	check("F: corrupt destination returns false", r === false, JSON.stringify(r));
	check(
		"F: corrupt destination left untouched",
		readFileSync(dest, "utf8") === corrupt,
		"",
	);
}

// ---------------------------------------------------------------------------
// G: non-object destination fails closed
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "g-agent");
	mkdirSync(agentDir, { recursive: true });
	const dest = path.join(agentDir, "pi-plan-mode.json");
	writeFileSync(dest, "[]");
	const r = await installPlanModeConfig({ agentDir });
	check("G: array destination returns false", r === false, JSON.stringify(r));
	check("G: array destination left untouched", readFileSync(dest, "utf8") === "[]", "");
}

// ---------------------------------------------------------------------------
// H: install.mjs source wiring (string presence smoke)
// ---------------------------------------------------------------------------
{
	const installSource = readFileSync(installSrc, "utf8");
	check(
		"H: install.mjs calls installPlanModeConfig in main",
		/installPlanModeConfig\(\)/.test(installSource),
		"",
	);
	check(
		"H: install.mjs exports installPlanModeConfig",
		/installPlanModeConfig,/.test(installSource),
		"",
	);
}

// ---------------------------------------------------------------------------
// I: npm-style validate exits 0 with the managed template
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
		"I: npm-style validate exits 0 with template",
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
console.log("pi-plan-mode-seed: ok");
