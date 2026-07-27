/**
 * Pending prune + projects stats tests (P0 instinct gap fill).
 *
 * GateGuard (create):
 * 1. Runner: scripts/tests/run.mjs picks up every *.mjs except itself; npm test.
 * 2. Exercises: lib/prune.mjs, lib/projects.mjs, cli prune/projects; no production exports.
 * 3. Temp HKX_HOMUNCULUS_DIR layouts; created dates YYYY-MM-DD; 12-hex project ids.
 * 4. Auth: user "接按 P0 开实现".
 * 5. Verify: node scripts/tests/instinct-prune.mjs; npm test.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLayout } from "../instinct/lib/paths.mjs";
import { writeInstinct, listPending } from "../instinct/lib/store.mjs";
import {
	ageDays,
	planPrune,
	applyPrune,
	DEFAULT_PENDING_TTL_DAYS,
} from "../instinct/lib/prune.mjs";
import {
	listProjectStats,
	formatProjectStats,
} from "../instinct/lib/projects.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "../..");
const cli = path.join(pkgRoot, "scripts/instinct/cli.mjs");

const pass = [];
const fail = [];
function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// pure ageDays
{
	const start = new Date("2026-01-01T00:00:00.000Z");
	const asOf = new Date("2026-01-31T12:00:00.000Z");
	check(
		"ageDays 30",
		ageDays(start, asOf) === 30,
		String(ageDays(start, asOf)),
	);
	check("ageDays zero future", ageDays(asOf, start) === 0);
	check("default TTL 30", DEFAULT_PENDING_TTL_DAYS === 30);
}

{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-prune-"));
	try {
		const project = {
			id: "aabbccddeeff",
			name: "prune-proj",
			remote: null,
			source: "test",
		};
		const other = {
			id: "112233445566",
			name: "other-proj",
			remote: null,
			source: "test",
		};
		ensureLayout(tmp, project);
		ensureLayout(tmp, other);

		writeInstinct(
			tmp,
			project,
			{
				id: "old-pending",
				trigger: "when pending expires",
				confidence: 0.4,
				domain: "testing",
				source: "test",
				scope: "project",
				created: "2026-01-01",
				content: "# Old pending\n\n## Action\nExpire me.\n",
			},
			"pending",
			"project",
		);
		writeInstinct(
			tmp,
			project,
			{
				id: "new-pending",
				trigger: "when pending is fresh",
				confidence: 0.5,
				domain: "testing",
				source: "test",
				scope: "project",
				created: "2026-07-01",
				content: "# New pending\n\n## Action\nKeep me.\n",
			},
			"pending",
			"project",
		);
		writeInstinct(
			tmp,
			project,
			{
				id: "old-personal",
				trigger: "when personal is old",
				confidence: 0.9,
				domain: "testing",
				source: "test",
				scope: "project",
				created: "2025-01-01",
				content: "# Personal\n\n## Action\nStay.\n",
			},
			"personal",
			"project",
		);
		writeInstinct(
			tmp,
			{ id: "global" },
			{
				id: "global-old-pending",
				trigger: "when global pending expires",
				confidence: 0.3,
				domain: "testing",
				source: "test",
				scope: "global",
				created: "2026-01-01",
				content: "# Global old\n\n## Action\nExpire.\n",
			},
			"pending",
			"global",
		);
		writeInstinct(
			tmp,
			other,
			{
				id: "other-pending",
				trigger: "when other has pending",
				confidence: 0.55,
				domain: "testing",
				source: "test",
				scope: "project",
				created: "2026-06-01",
				content: "# Other\n\n## Action\nList me.\n",
			},
			"pending",
			"project",
		);

		const asOf = new Date("2026-02-15T00:00:00.000Z");
		const planned = planPrune(tmp, project, { asOf, maxAgeDays: 30 });
		const expiredIds = planned.expired.map((e) => e.id).sort();
		check(
			"expired includes old project+global",
			expiredIds.includes("old-pending") &&
				expiredIds.includes("global-old-pending"),
			expiredIds.join(","),
		);
		check(
			"fresh not expired",
			!expiredIds.includes("new-pending"),
			expiredIds.join(","),
		);
		check(
			"personal not in plan items as pending target",
			!planned.items.some((i) => i.id === "old-personal"),
		);
		check("maxAgeDays echoed", planned.maxAgeDays === 30);

		const dry = applyPrune(planned.expired, { dryRun: true });
		check("dry lists deletes", dry.deleted.length === planned.expired.length);
		check(
			"files still present after dry",
			fs.existsSync(
				path.join(
					tmp,
					"projects",
					project.id,
					"instincts",
					"pending",
					"old-pending.md",
				),
			),
		);

		const app = applyPrune(planned.expired, { dryRun: false });
		check(
			"deleted old-pending",
			app.deleted.some((d) => d.id === "old-pending"),
		);
		check(
			"file gone",
			!fs.existsSync(
				path.join(
					tmp,
					"projects",
					project.id,
					"instincts",
					"pending",
					"old-pending.md",
				),
			),
		);
		check(
			"fresh still present",
			fs.existsSync(
				path.join(
					tmp,
					"projects",
					project.id,
					"instincts",
					"pending",
					"new-pending.md",
				),
			),
		);
		check(
			"personal still present",
			fs.existsSync(
				path.join(
					tmp,
					"projects",
					project.id,
					"instincts",
					"personal",
					"old-personal.md",
				),
			),
		);

		const pendingLeft = listPending(tmp, project, "all");
		check(
			"listPending no old-pending",
			!pendingLeft.some((p) => p.id === "old-pending"),
		);

		const stats = listProjectStats(tmp);
		check(
			"two projects listed",
			stats.projects.length >= 2,
			String(stats.projects.length),
		);
		const row = stats.projects.find((p) => p.id === project.id);
		check("project personal count", row?.personal === 1, JSON.stringify(row));
		check("project pending remaining", row?.pending === 1, JSON.stringify(row));
		check(
			"global personal/pending fields",
			typeof stats.global.pending === "number",
		);
		const text = formatProjectStats(stats, { root: tmp, source: "test" });
		check("format has GLOBAL", text.includes("GLOBAL"));
		check("format has project name", text.includes("prune-proj"));

		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: project.id,
		};
		writeInstinct(
			tmp,
			project,
			{
				id: "cli-old-pending",
				trigger: "when cli prunes",
				confidence: 0.2,
				domain: "testing",
				source: "test",
				scope: "project",
				created: "2026-01-01",
				content: "# CLI old\n\n## Action\nPrune.\n",
			},
			"pending",
			"project",
		);
		const preview = spawnSync(
			process.execPath,
			[cli, "prune", "--as-of", "2026-02-15", "--max-age", "30", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli prune preview exit 0", preview.status === 0, preview.stderr);
		const previewJson = JSON.parse(preview.stdout);
		check("cli preview apply false", previewJson.apply === false);
		check(
			"cli preview sees cli-old-pending",
			previewJson.expired.some((e) => e.id === "cli-old-pending"),
			JSON.stringify(previewJson.expired),
		);
		check(
			"cli preview did not delete",
			fs.existsSync(
				path.join(
					tmp,
					"projects",
					project.id,
					"instincts",
					"pending",
					"cli-old-pending.md",
				),
			),
		);

		const applied = spawnSync(
			process.execPath,
			[
				cli,
				"prune",
				"--as-of",
				"2026-02-15",
				"--max-age",
				"30",
				"--apply",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli prune apply exit 0", applied.status === 0, applied.stderr);
		const appliedJson = JSON.parse(applied.stdout);
		check("cli apply true", appliedJson.apply === true);
		check(
			"cli deleted file",
			!fs.existsSync(
				path.join(
					tmp,
					"projects",
					project.id,
					"instincts",
					"pending",
					"cli-old-pending.md",
				),
			),
		);

		const projectsCli = spawnSync(
			process.execPath,
			[cli, "projects", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli projects exit 0", projectsCli.status === 0, projectsCli.stderr);
		const projectsJson = JSON.parse(projectsCli.stdout);
		check("cli projects ok", projectsJson.ok === true);
		check(
			"cli projects has prune-proj",
			projectsJson.projects.some((p) => p.id === project.id),
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

console.log(`PASS ${pass.length}`);
for (const n of pass) console.log(`  ✓ ${n}`);
if (fail.length) {
	console.error(`FAIL ${fail.length}`);
	for (const n of fail) console.error(`  ✗ ${n}`);
	process.exit(1);
}
console.log("instinct-prune: ok");
