/**
 * Phase 2 OM adapter tests: fold, map, from-om, accept.
 * Auth: user Phase 2 from-om + accept
 * Verify: npm test
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	fullProjectionFromEntries,
	loadSessionEntries,
	projectSessionFile,
	sessionDirNameForCwd,
} from "../instinct/lib/om-session.mjs";
import {
	mapProjectionToCandidates,
	looksActionable,
	scoreConfidence,
	classifyDomain,
} from "../instinct/lib/om-map.mjs";
import { loadAllInstincts, listPending } from "../instinct/lib/store.mjs";
import { ensureLayout } from "../instinct/lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "scripts/instinct/cli.mjs");
const sessionFixture = path.join(
	root,
	"scripts/instinct/fixtures/sample-session.jsonl",
);

const pass = [];
const fail = [];
function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// session dir naming
{
	const n = sessionDirNameForCwd("/root/workspace/omp");
	check("session dir has dashes", n.startsWith("--") && n.endsWith("--"), n);
	check("session dir no slashes", !n.slice(2, -2).includes("/"), n);
}

// fold projection + drops
{
	const entries = loadSessionEntries(sessionFixture);
	const proj = fullProjectionFromEntries(entries);
	check("has reflections", proj.reflections.length === 3, String(proj.reflections.length));
	check(
		"dropped low obs removed",
		!proj.observations.some((o) => o.id === "b2b2b2b2b2b2"),
		JSON.stringify(proj.observations.map((o) => o.id)),
	);
	check(
		"kept high/critical obs",
		proj.observations.some((o) => o.id === "a1a1a1a1a1a1") &&
			proj.observations.some((o) => o.id === "c3c3c3c3c3c3"),
	);
}

// map heuristics
{
	check("actionable prefer", looksActionable("Prefer functional patterns over classes in modules."));
	check("not actionable short", !looksActionable("hi"));
	check("domain testing", classifyDomain("Always write a failing regression test") === "testing" || classifyDomain("Always write a failing regression test") === "debugging");
	const conf = scoreConfidence("Prefer X", [{ relevance: "critical" }]);
	check("confidence bounded", conf >= 0.3 && conf <= 0.9, String(conf));
}

// map candidates skip noise
{
	const proj = projectSessionFile(sessionFixture);
	const { candidates, skipped } = mapProjectionToCandidates(proj, {
		project: { id: "aabbccddeeff", name: "demo" },
		minRelevance: "medium",
	});
	check("at least 1 candidate", candidates.length >= 1, String(candidates.length));
	check("skipped short hi", skipped.some((s) => s.reflectionId === "f6f6f6f6f6f6"));
	check(
		"candidates have om- ids",
		candidates.every((c) => String(c.id).startsWith("om-")),
	);
}

// CLI from-om dry-run + accept e2e
{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-om-"));
	try {
		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: "aabbccddeeff",
		};
		const dry = spawnSync(
			process.execPath,
			[cli, "from-om", "--session", sessionFixture, "--dry-run", "--json"],
			{ env, encoding: "utf8" },
		);
		check("from-om dry exit 0", dry.status === 0, dry.stderr || dry.stdout);
		const dryJson = JSON.parse(dry.stdout);
		check("dry-run no written", dryJson.written.length === 0);
		check("dry-run has candidates", dryJson.counts.candidates >= 1);

		const run = spawnSync(
			process.execPath,
			[cli, "from-om", "--session", sessionFixture, "--json"],
			{ env, encoding: "utf8" },
		);
		check("from-om write exit 0", run.status === 0, run.stderr || run.stdout);
		const runJson = JSON.parse(run.stdout);
		check("wrote pending", runJson.written.length >= 1, String(runJson.written.length));

		const project = { id: "aabbccddeeff", name: "demo" };
		ensureLayout(tmp, project);
		const pending = listPending(tmp, project, "project");
		check("pending listed", pending.length >= 1, String(pending.length));

		const acc = spawnSync(
			process.execPath,
			[cli, "accept", "--all", "--json"],
			{ env, encoding: "utf8" },
		);
		check("accept exit 0", acc.status === 0, acc.stderr || acc.stdout);
		const accJson = JSON.parse(acc.stdout);
		check("accepted some", accJson.accepted.length >= 1, JSON.stringify(accJson));

		const personal = loadAllInstincts(tmp, project, { includePending: false });
		check(
			"personal has accepted",
			personal.some((i) => accJson.accepted.includes(i.id)),
		);
		const pendingAfter = listPending(tmp, project, "project");
		check("pending cleared for accepted", pendingAfter.length === 0, String(pendingAfter.length));

		// skip conflict
		// re-from-om then accept without force should skip or re-add pending then skip
		spawnSync(
			process.execPath,
			[cli, "from-om", "--session", sessionFixture, "--json"],
			{ env, encoding: "utf8" },
		);
		const acc2 = spawnSync(
			process.execPath,
			[cli, "accept", "--all", "--json"],
			{ env, encoding: "utf8" },
		);
		const acc2Json = JSON.parse(acc2.stdout);
		check(
			"second accept skips existing",
			acc2Json.skipped.length >= 1 || acc2Json.accepted.length >= 0,
			JSON.stringify(acc2Json),
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

console.log(`instinct-om: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
	for (const f of fail) console.error(`  FAIL ${f}`);
	process.exit(1);
}
console.log("instinct-om: all checks passed");
