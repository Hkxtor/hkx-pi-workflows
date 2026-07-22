/**
 * Confidence decay tests (ECC -0.02/week model).
 * Auth: user confidence time decay
 * Verify: npm test
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLayout } from "../instinct/lib/paths.mjs";
import { writeInstinct, loadAllInstincts } from "../instinct/lib/store.mjs";
import {
	weeksInactive,
	computeDecayedConfidence,
	planDecay,
	applyDecay,
	parseActivityDate,
	DEFAULT_DECAY_PER_WEEK,
} from "../instinct/lib/decay.mjs";
import { parseInstinctFile } from "../instinct/lib/parse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "../..");
const cli = path.join(pkgRoot, "scripts/instinct/cli.mjs");

const pass = [];
const fail = [];
function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// pure math
{
	const start = new Date("2026-01-01T00:00:00.000Z");
	const asOf = new Date("2026-01-29T00:00:00.000Z"); // 28 days = 4 weeks
	check(
		"weeksInactive 4",
		weeksInactive(start, asOf) === 4,
		String(weeksInactive(start, asOf)),
	);
	check(
		"partial week no extra",
		weeksInactive(start, new Date("2026-01-07T23:00:00.000Z")) === 0,
	);
	check(
		"decay 4 weeks",
		computeDecayedConfidence(0.9, 4) === 0.82,
		String(computeDecayedConfidence(0.9, 4)),
	);
	check(
		"floor",
		computeDecayedConfidence(0.15, 10) === 0.1,
		String(computeDecayedConfidence(0.15, 10)),
	);
	check("zero weeks", computeDecayedConfidence(0.7, 0) === 0.7);
	check("default rate", DEFAULT_DECAY_PER_WEEK === 0.02);
	check(
		"parse date-only",
		parseActivityDate("2026-01-01")?.toISOString().startsWith("2026-01-01"),
	);
}

{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-decay-"));
	try {
		const project = { id: "aabbccddeeff", name: "decay-proj" };
		ensureLayout(tmp, project);
		// old instinct (updated long ago)
		writeInstinct(
			tmp,
			project,
			{
				id: "stale-rule",
				trigger: "when coding stale",
				confidence: 0.9,
				domain: "code-style",
				source: "test",
				scope: "project",
				updated: "2025-01-01",
				created: "2024-12-01",
				content: "# Stale\n\n## Action\nOld rule.\n",
			},
			"personal",
			"project",
		);
		// fresh instinct
		writeInstinct(
			tmp,
			project,
			{
				id: "fresh-rule",
				trigger: "when coding fresh",
				confidence: 0.8,
				domain: "code-style",
				source: "test",
				scope: "project",
				updated: "2026-07-20",
				content: "# Fresh\n\n## Action\nNew rule.\n",
			},
			"personal",
			"project",
		);
		// last_seen preferred over updated
		writeInstinct(
			tmp,
			project,
			{
				id: "seen-recently",
				trigger: "when last seen wins",
				confidence: 0.85,
				domain: "testing",
				source: "test",
				scope: "project",
				updated: "2025-01-01",
				last_seen: "2026-07-20",
				content: "# Seen\n\n## Action\nRecently confirmed.\n",
			},
			"personal",
			"project",
		);

		const asOf = new Date("2026-07-22T00:00:00.000Z");
		const plan = planDecay(tmp, project, { asOf });
		const stale = plan.find((p) => p.id === "stale-rule");
		const fresh = plan.find((p) => p.id === "fresh-rule");
		const seen = plan.find((p) => p.id === "seen-recently");
		check("stale changes", !!stale?.changed, JSON.stringify(stale));
		check("stale weeks large", (stale?.weeks ?? 0) > 50, String(stale?.weeks));
		check(
			"stale conf dropped",
			(stale?.newConfidence ?? 1) < 0.9,
			String(stale?.newConfidence),
		);
		check("fresh not changed", fresh?.changed === false, JSON.stringify(fresh));
		check(
			"last_seen activity source",
			seen?.activitySource === "last_seen",
			seen?.activitySource,
		);
		check("seen not changed", seen?.changed === false, JSON.stringify(seen));

		// dry apply
		const dry = applyDecay(plan, { dryRun: true, asOf });
		check(
			"dry would write stale",
			dry.written.some((w) => w.id === "stale-rule"),
		);
		const before = loadAllInstincts(tmp, project).find(
			(i) => i.id === "stale-rule",
		);
		check("file not yet changed", before?.confidence === 0.9);

		// real apply
		const app = applyDecay(plan, { dryRun: false, asOf });
		check(
			"applied stale",
			app.written.some((w) => w.id === "stale-rule"),
		);
		const after = loadAllInstincts(tmp, project).find(
			(i) => i.id === "stale-rule",
		);
		check(
			"confidence written",
			after?.confidence === stale?.newConfidence,
			String(after?.confidence),
		);
		check("updated stamped", after?.updated === "2026-07-22", after?.updated);

		// CLI
		// re-seed stale high conf with old date for cli
		writeInstinct(
			tmp,
			project,
			{
				id: "cli-stale",
				trigger: "when cli decay",
				confidence: 0.88,
				domain: "workflow",
				source: "test",
				scope: "project",
				updated: "2025-06-01",
				content: "# CLI\n\n## Action\nDecay me.\n",
			},
			"personal",
			"project",
		);
		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: project.id,
		};
		const prev = spawnSync(
			process.execPath,
			[cli, "decay", "--as-of", "2026-07-22", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli preview 0", prev.status === 0, prev.stderr || prev.stdout);
		const pj = JSON.parse(prev.stdout);
		check("cli preview not apply", pj.apply === false);
		check(
			"cli sees cli-stale changing",
			(pj.plan || []).some((p) => p.id === "cli-stale" && p.changed),
		);

		const apply = spawnSync(
			process.execPath,
			[cli, "decay", "--as-of", "2026-07-22", "--apply", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli apply 0", apply.status === 0, apply.stderr || apply.stdout);
		const aj = JSON.parse(apply.stdout);
		check("cli apply true", aj.apply === true);
		const cliInst = loadAllInstincts(tmp, project).find(
			(i) => i.id === "cli-stale",
		);
		check(
			"cli wrote lower conf",
			(cliInst?.confidence ?? 1) < 0.88,
			String(cliInst?.confidence),
		);

		// multi-instinct file blocked
		const multiPath = path.join(
			tmp,
			"projects",
			project.id,
			"instincts",
			"personal",
			"multi.md",
		);
		fs.writeFileSync(
			multiPath,
			`---
id: multi-a
confidence: 0.9
updated: 2025-01-01
trigger: when a
domain: general
---

## Action
A

---
id: multi-b
confidence: 0.9
updated: 2025-01-01
trigger: when b
domain: general
---

## Action
B
`,
		);
		const planM = planDecay(tmp, project, { asOf });
		const multiItems = planM.filter((p) => p.filePath === multiPath);
		check(
			"multi blocked",
			multiItems.every((p) => p.blockedMultiInstinctFile && !p.changed),
			JSON.stringify(
				multiItems.map((p) => ({
					id: p.id,
					changed: p.changed,
					blocked: p.blockedMultiInstinctFile,
				})),
			),
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

console.log(`instinct-decay: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
	for (const f of fail) console.error(`  FAIL ${f}`);
	process.exit(1);
}
console.log("instinct-decay: all checks passed");
