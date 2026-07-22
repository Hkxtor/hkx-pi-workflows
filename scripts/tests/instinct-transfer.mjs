/**
 * Phase 3 export/import/promote tests.
 * Auth: user Phase 3
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
	formatExportBundle,
	importInstinctBundle,
	collectExportInstincts,
} from "../instinct/lib/transfer.mjs";
import {
	listPromoteCandidates,
	promoteAuto,
	PROMOTE_MIN_PROJECTS,
} from "../instinct/lib/promote.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "../..");
const cli = path.join(pkgRoot, "scripts/instinct/cli.mjs");

const pass = [];
const fail = [];
function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

function mkInst(id, conf, extra = {}) {
	return {
		id,
		trigger: `when using ${id}`,
		confidence: conf,
		domain: extra.domain || "code-style",
		source: "test",
		scope: "project",
		content: `# ${id}\n\n## Action\nDo ${id}.\n`,
		...extra,
	};
}

{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-xfer-"));
	try {
		// two projects with shared high-conf instinct
		const p1 = { id: "111111111111", name: "proj-one" };
		const p2 = { id: "222222222222", name: "proj-two" };
		ensureLayout(tmp, p1);
		ensureLayout(tmp, p2);
		writeInstinct(tmp, p1, mkInst("shared-pref", 0.9), "personal", "project");
		writeInstinct(tmp, p1, mkInst("only-p1", 0.85), "personal", "project");
		writeInstinct(tmp, p2, mkInst("shared-pref", 0.85), "personal", "project");
		writeInstinct(tmp, p2, mkInst("only-p2", 0.7), "personal", "project");

		// promote candidates: shared-pref in p1+p2 (before further imports)
		const cands = listPromoteCandidates(tmp);
		check(
			"promote candidate shared",
			cands.some((c) => c.id === "shared-pref"),
			JSON.stringify(cands.map((c) => c.id)),
		);
		check(
			"only-p1 not candidate",
			!cands.some((c) => c.id === "only-p1"),
			JSON.stringify(cands.map((c) => c.id)),
		);
		check("min projects const", PROMOTE_MIN_PROJECTS === 2);

		const exported = collectExportInstincts(tmp, p1, { scope: "project" });
		check("export project count", exported.length === 2, String(exported.length));
		const bundle = formatExportBundle(exported, { project: p1, scope: "project" });
		check("bundle LF", !bundle.includes("\r"));
		check("bundle has shared", bundle.includes("id: shared-pref"));

		// import into new project p3
		const p3 = { id: "333333333333", name: "proj-three" };
		ensureLayout(tmp, p3);
		const imp = importInstinctBundle(bundle, tmp, p3, {
			scope: "project",
			dryRun: false,
		});
		check("import ok", imp.ok === true);
		check("import adds 2", imp.toAdd.length === 2, String(imp.toAdd.length));
		const loaded = loadAllInstincts(tmp, p3, { includePending: false });
		check(
			"p3 has shared",
			loaded.some((i) => i.id === "shared-pref" && i._scope_label === "project"),
		);

		// dry-run import no write
		const p4 = { id: "444444444444", name: "proj-four" };
		ensureLayout(tmp, p4);
		const dry = importInstinctBundle(bundle, tmp, p4, { dryRun: true });
		check("dry import no written", dry.written.length === 0);
		check("dry still counts add", dry.toAdd.length === 2);

		const autoDry = promoteAuto(tmp, { dryRun: true });
		check(
			"auto dry ok",
			autoDry.results.every((r) => r.ok && r.dryRun),
		);

		const auto = promoteAuto(tmp, { dryRun: false });
		check(
			"auto apply promoted",
			auto.results.some((r) => r.ok && r.id === "shared-pref" && !r.dryRun),
			JSON.stringify(auto.results),
		);
		const global = loadAllInstincts(tmp, { id: "global" }, { includePending: false });
		// loadAll with global project loads only global dirs when project id global...
		// actually loadAllInstincts with id global has projectInstincts null, only global
		check(
			"global has shared",
			global.some((i) => i.id === "shared-pref" && i._scope_label === "global"),
			JSON.stringify(global.map((i) => i.id + ":" + i._scope_label)),
		);

		// second promote candidates exclude already global
		const cands2 = listPromoteCandidates(tmp);
		check(
			"shared no longer candidate",
			!cands2.some((c) => c.id === "shared-pref"),
		);

		// CLI export/import/promote
		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: p1.id,
		};
		const outFile = path.join(tmp, "bundle.md");
		const ex = spawnSync(
			process.execPath,
			[cli, "export", "--scope", "project", "--output", outFile, "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli export 0", ex.status === 0, ex.stderr || ex.stdout);
		check("cli export file", fs.existsSync(outFile));

		const env3 = { ...env, HKX_PROJECT_ID: "555555555555" };
		// ensure p5 layout via init
		spawnSync(process.execPath, [cli, "init", "--json"], {
			env: env3,
			encoding: "utf8",
		});
		const im = spawnSync(
			process.execPath,
			[cli, "import", outFile, "--json"],
			{ env: env3, encoding: "utf8" },
		);
		check("cli import 0", im.status === 0, im.stderr || im.stdout);
		const imj = JSON.parse(im.stdout);
		check("cli import adds", (imj.counts?.add ?? 0) >= 1, JSON.stringify(imj.counts));

		const pr = spawnSync(
			process.execPath,
			[cli, "promote", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli promote list 0", pr.status === 0, pr.stderr || pr.stdout);
		const prj = JSON.parse(pr.stdout);
		check("cli promote has criteria", !!prj.criteria);

		// ECC import tree
		const ecc = path.join(tmp, "ecc-home");
		fs.mkdirSync(path.join(ecc, "instincts", "personal"), { recursive: true });
		fs.writeFileSync(
			path.join(ecc, "instincts", "personal", "ecc-one.md"),
			`---
id: ecc-imported
trigger: "when importing from ecc"
confidence: 0.88
domain: general
scope: global
---

# ECC

## Action
Imported from ECC layout.
`,
		);
		const ei = spawnSync(
			process.execPath,
			[
				cli,
				"import",
				"--from-ecc",
				ecc,
				"--scope",
				"global",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli ecc import 0", ei.status === 0, ei.stderr || ei.stdout);
		const eij = JSON.parse(ei.stdout);
		check(
			"ecc import wrote",
			(eij.counts?.written ?? 0) >= 1 || (eij.counts?.add ?? 0) >= 1,
			JSON.stringify(eij.counts),
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

console.log(`instinct-transfer: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
	for (const f of fail) console.error(`  FAIL ${f}`);
	process.exit(1);
}
console.log("instinct-transfer: all checks passed");
