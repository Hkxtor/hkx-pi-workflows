/**
 * publish-draft tests
 * Auth: user "要 publish-draft"
 * Verify: npm test
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLayout } from "../instinct/lib/paths.mjs";
import { writeInstinct } from "../instinct/lib/store.mjs";
import { analyzeEvolve } from "../instinct/lib/cluster.mjs";
import { generateEvolved } from "../instinct/lib/generate.mjs";
import { loadAllInstincts } from "../instinct/lib/store.mjs";
import {
	listEvolvedDrafts,
	planPublish,
	applyPublish,
	ensureSkillFrontmatter,
	isPackageRepoSkillsRoot,
} from "../instinct/lib/publish.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "../..");
const cli = path.join(pkgRoot, "scripts/instinct/cli.mjs");

const pass = [];
const fail = [];
function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// frontmatter helper
{
	const raw = "# demo\n\n## Actions\n- a\n";
	const withFm = ensureSkillFrontmatter("demo", raw);
	check("adds frontmatter", withFm.startsWith("---\n"));
	check("has name", /name:\s*demo/.test(withFm));
	check("has description", /description:/.test(withFm));
}

{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-pub-"));
	const publishRoot = path.join(tmp, "pi-agent");
	try {
		const project = { id: "aabbccddeeff", name: "pub-proj" };
		ensureLayout(tmp, project);
		// seed instincts + generate drafts
		const fixtures = path.join(pkgRoot, "scripts/instinct/fixtures");
		for (const f of [
			"prefer-functional.md",
			"use-immutable.md",
			"avoid-classes.md",
			"test-first-workflow.md",
		]) {
			const text = fs.readFileSync(path.join(fixtures, f), "utf8");
			// reuse parse via write raw files into personal
			const destDir = path.join(
				tmp,
				"projects",
				project.id,
				"instincts",
				"personal",
			);
			fs.mkdirSync(destDir, { recursive: true });
			fs.writeFileSync(path.join(destDir, f), text);
		}
		const instincts = loadAllInstincts(tmp, project);
		const analysis = analyzeEvolve(instincts);
		check("analysis ok", analysis.ok === true);
		const generated = generateEvolved(tmp, project, analysis);
		check("generated drafts", generated.length >= 1, String(generated.length));

		const drafts = listEvolvedDrafts(tmp, project);
		check("list drafts", drafts.length >= 1, String(drafts.length));

		const plan = planPublish(drafts, publishRoot, { force: false });
		check(
			"plan create actions",
			plan.every((p) => p.action === "create"),
			JSON.stringify(plan.map((p) => p.action)),
		);

		// preview dry
		const dry = applyPublish(plan, { dryRun: true });
		check("dry written meta", dry.written.length === plan.length);
		check(
			"dry no files",
			!fs.existsSync(path.join(publishRoot, "skills")),
		);

		// apply
		const applied = applyPublish(plan, { dryRun: false });
		check("applied writes", applied.written.length >= 1);
		const skillDest = plan.find((p) => p.kind === "skill")?.dest;
		check("skill dest exists", !!(skillDest && fs.existsSync(skillDest)), skillDest);

		// second plan without force blocks
		const plan2 = planPublish(drafts, publishRoot, { force: false });
		check(
			"blocked without force",
			plan2.some((p) => p.action === "blocked-exists" || p.action === "skip-identical"),
		);

		// force updates / identical
		const plan3 = planPublish(drafts, publishRoot, { force: true });
		const app3 = applyPublish(plan3, { dryRun: false });
		check("force apply ok", app3.written.length + app3.skipped.length === plan3.length);

		// CLI preview + apply
		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: project.id,
			HKX_PUBLISH_ROOT: publishRoot,
		};
		const prev = spawnSync(
			process.execPath,
			[cli, "publish-draft", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli preview 0", prev.status === 0, prev.stderr || prev.stdout);
		const prevJ = JSON.parse(prev.stdout);
		check("cli preview not apply", prevJ.apply === false);
		check("cli has plan", (prevJ.plan || []).length >= 1);

		// filter kind
		const onlySkill = spawnSync(
			process.execPath,
			[cli, "publish-draft", "--kind", "skill", "--json"],
			{ env, encoding: "utf8" },
		);
		const osJ = JSON.parse(onlySkill.stdout);
		check(
			"kind filter skill",
			(osJ.plan || []).every((p) => p.kind === "skill"),
			JSON.stringify(osJ.plan?.map((p) => p.kind)),
		);

		// package guard: target package root should refuse without force
		const guard = spawnSync(
			process.execPath,
			[cli, "publish-draft", "--target", pkgRoot, "--json"],
			{ env: { ...env, HKX_PUBLISH_ROOT: undefined }, encoding: "utf8" },
		);
		check("package guard blocks", guard.status === 1, guard.stdout);
		const gj = JSON.parse(guard.stdout);
		check("package guard error", gj.ok === false);

		check(
			"detect package root helper",
			isPackageRepoSkillsRoot(pkgRoot) === true,
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

console.log(`instinct-publish: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
	for (const f of fail) console.error(`  FAIL ${f}`);
	process.exit(1);
}
console.log("instinct-publish: all checks passed");
