/**
 * Path B seed contract for configs/pi-goal/pi-goal.json.
 *
 * install.mjs::installPiGoalConfig seeds
 *   ~/.pi/agent/pi-goal.json
 * only when the destination is missing. The extension's /goal settings UI
 * rewrites that file at runtime, so an existing operator file must never be
 * clobbered.
 *
 * Isolation: a temp agent dir is passed via options.agentDir (the real
 * ~/.pi/agent is never touched), and a bad-template case pins
 * options.sourcePath at a temp file.
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
const srcTemplate = path.join(root, "configs", "pi-goal", "pi-goal.json");
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-pi-goal-seed-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// Import the REAL installer. install.mjs guards main() behind an isMain check,
// so importing it here does NOT run the full install path.
const installModule = await import(`file://${installSrc}?t=${Date.now()}`);
const installPiGoalConfig = installModule.installPiGoalConfig;
check(
	"install.mjs exports installPiGoalConfig",
	typeof installPiGoalConfig === "function",
	typeof installPiGoalConfig,
);

const templateRaw = readFileSync(srcTemplate, "utf8");
const template = JSON.parse(templateRaw);

// ---------------------------------------------------------------------------
// Preconditions on repo template
// ---------------------------------------------------------------------------
{
	check("template exists", existsSync(srcTemplate), srcTemplate);
	check(
		"template ends with newline",
		templateRaw.endsWith("\n"),
		JSON.stringify(templateRaw.slice(-4)),
	);
	check(
		"template rpc.enabled === false",
		template.rpc?.enabled === false,
		JSON.stringify(template.rpc),
	);
	check(
		"template continuationLimits.automaticTurns === 25",
		template.continuationLimits?.automaticTurns === 25,
		JSON.stringify(template.continuationLimits),
	);
	check(
		"template continuationLimits.noProgressTurns === 3",
		template.continuationLimits?.noProgressTurns === 3,
		JSON.stringify(template.continuationLimits),
	);
}

// ---------------------------------------------------------------------------
// A: cold seed into an existing temp agent dir
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "a-agent");
	mkdirSync(agentDir, { recursive: true });
	const dest = path.join(agentDir, "pi-goal.json");

	const r1 = await installPiGoalConfig({ agentDir });
	check("A: cold install returns true", r1 === true, JSON.stringify(r1));
	check("A: dest file exists", existsSync(dest), dest);
	const seeded = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"A: seeded content deep-equals template",
		JSON.stringify(seeded) === JSON.stringify(template),
		JSON.stringify(seeded),
	);
	check(
		"A: seeded bytes equal template bytes",
		readFileSync(dest, "utf8") ===
			(templateRaw.endsWith("\n") ? templateRaw : `${templateRaw}\n`),
		"",
	);

	// Re-run must keep the operator file (simulate /goal settings wrote a
	// tightened automaticTurns and an extra key).
	const operator = {
		rpc: { enabled: true },
		continuationLimits: { automaticTurns: 10, noProgressTurns: 2 },
		deadlineMaxSeconds: 3600,
	};
	writeFileSync(dest, `${JSON.stringify(operator, null, 2)}\n`);
	const r2 = await installPiGoalConfig({ agentDir });
	check("B: rerun returns true", r2 === true, JSON.stringify(r2));
	check("B: rerun keeps operator file byte-for-byte", readFileSync(dest, "utf8") === `${JSON.stringify(operator, null, 2)}\n`, "");
	const after = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"B: operator automaticTurns preserved",
		after.continuationLimits?.automaticTurns === 10,
		JSON.stringify(after),
	);
	check(
		"B: operator extra key preserved",
		after.deadlineMaxSeconds === 3600,
		JSON.stringify(after),
	);
}

// ---------------------------------------------------------------------------
// C: cold seed creates the agent dir when missing
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "c-agent-nested", "agent");
	const dest = path.join(agentDir, "pi-goal.json");
	const r = await installPiGoalConfig({ agentDir });
	check("C: install returns true with missing agent dir", r === true, JSON.stringify(r));
	check("C: dest file exists", existsSync(dest), dest);
}

// ---------------------------------------------------------------------------
// D: invalid template JSON is refused, not seeded
// ---------------------------------------------------------------------------
{
	const agentDir = path.join(tmpRoot, "d-agent");
	mkdirSync(agentDir, { recursive: true });
	const badSrc = path.join(tmpRoot, "d-bad-template.json");
	writeFileSync(badSrc, "{ not-json-here");
	const dest = path.join(agentDir, "pi-goal.json");
	const r = await installPiGoalConfig({ agentDir, sourcePath: badSrc });
	check("D: invalid template returns false", r === false, JSON.stringify(r));
	check("D: invalid template does not create dest", !existsSync(dest), dest);
}

// ---------------------------------------------------------------------------
// E: install.mjs source wiring (string presence smoke)
// ---------------------------------------------------------------------------
{
	const installSource = readFileSync(installSrc, "utf8");
	check(
		"E: install.mjs calls installPiGoalConfig in main",
		/installPiGoalConfig\(\)/.test(installSource),
		"",
	);
	check(
		"E: install.mjs documents seed-if-missing",
		/seed-if-missing|not overwriting/i.test(installSource),
		"",
	);
}

// ---------------------------------------------------------------------------
// F: npm-style validate exits 0 with the managed template
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
		"F: npm-style validate exits 0 with template",
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
console.log("pi-goal-seed: ok");
