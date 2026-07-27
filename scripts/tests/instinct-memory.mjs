/**
 * M1 unified memory vault tests (schema + store + CLI).
 *
 * GateGuard (create):
 * 1. Runner: scripts/tests/run.mjs picks up every *.mjs except itself; npm test.
 * 2. Exercises: memory-schema, memory-store, paths memory dirs, cli memory; no prod exports.
 * 3. Temp HKX_HOMUNCULUS_DIR; 12-hex project ids; hkx.memory.v1 frontmatter.
 * 4. Auth: user "proceed" on unified-memory M1 plan.
 * 5. Verify: node scripts/tests/instinct-memory.mjs; npm test.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLayout, layoutPaths } from "../instinct/lib/paths.mjs";
import {
	MEMORY_SCHEMA,
	parseMemoryFile,
	serializeMemory,
	slugMemoryId,
	validateMemoryDoc,
} from "../instinct/lib/memory-schema.mjs";
import {
	recallMemories,
	saveMemory,
	validateMemories,
	createHandoff,
	promoteMemoryToPending,
} from "../instinct/lib/memory-store.mjs";
import { listPending } from "../instinct/lib/store.mjs";
import {
	scanMemoryText,
	hasBlockingSecrets,
} from "../instinct/lib/memory-secrets.mjs";
import {
	planEccMemoryImport,
	applyEccMemoryImport,
} from "../instinct/lib/memory-import-ecc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "../..");
const cli = path.join(pkgRoot, "scripts/instinct/cli.mjs");

const pass = [];
const fail = [];
function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// schema pure
{
	check("schema const", MEMORY_SCHEMA === "hkx.memory.v1");
	const bad = validateMemoryDoc({
		schema: "x",
		id: "a",
		scope: "project",
		title: "t",
	});
	check("reject bad schema", !bad.ok);
	const good = validateMemoryDoc({
		schema: MEMORY_SCHEMA,
		id: "rate-limit",
		scope: "project",
		title: "Rate limit",
		tags: ["api"],
		created: "2026-07-27",
		body: "Use token bucket",
	});
	check("accept good doc", good.ok, good.ok ? "" : good.error);
	const ser = serializeMemory(good.doc);
	check("serialize has schema", ser.includes("schema: hkx.memory.v1"));
	const round = parseMemoryFile(ser);
	check("round-trip ok", round.ok, round.ok ? "" : round.error);
	check(
		"round-trip title",
		round.ok && round.doc.title === "Rate limit",
		JSON.stringify(round),
	);
	check("slug id", slugMemoryId("Hello World!") === "hello-world");
}

{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-mem-"));
	try {
		const project = {
			id: "aabbccddeeff",
			name: "mem-proj",
			remote: null,
			source: "test",
		};
		const layout = ensureLayout(tmp, project);
		check(
			"projectMemory dir",
			Boolean(layout.projectMemory) && fs.existsSync(layout.projectMemory),
			layout.projectMemory,
		);
		check("userMemory dir", fs.existsSync(layout.userMemory));
		check("teamMemory dir", fs.existsSync(layout.teamMemory));
		check(
			"instinct pending still exists",
			fs.existsSync(layout.projectInstincts.pending),
		);

		const preview = saveMemory(
			tmp,
			project,
			{
				title: "API rate limit decision",
				body: "Prefer token bucket",
				tags: ["api"],
				scope: "project",
			},
			{ apply: false },
		);
		check("preview ok", preview.ok && preview.apply === false);
		check(
			"preview no file",
			!fs.existsSync(preview.filePath),
			preview.filePath,
		);

		const saved = saveMemory(
			tmp,
			project,
			{
				title: "API rate limit decision",
				body: "Prefer token bucket",
				tags: ["api"],
				scope: "project",
				id: "api-rate-limit",
			},
			{ apply: true },
		);
		check("save apply ok", saved.ok && saved.apply === true, saved.error);
		check("file exists", fs.existsSync(saved.filePath));

		const recalled = recallMemories(tmp, project, { scope: "project" });
		check(
			"recall finds project",
			recalled.items.some((i) => i.id === "api-rate-limit"),
			JSON.stringify(recalled.items.map((i) => i.id)),
		);
		check(
			"tag filter",
			recallMemories(tmp, project, { tag: "api" }).items.length === 1,
		);
		check(
			"query filter",
			recallMemories(tmp, project, { query: "token" }).items.length === 1,
		);

		const userSave = saveMemory(
			tmp,
			project,
			{
				title: "Editor tabs",
				body: "prefer tabs",
				scope: "user",
				id: "editor-tabs",
			},
			{ apply: true },
		);
		check("user save ok", userSave.ok, userSave.error);
		const projectOnly = recallMemories(tmp, project, { scope: "project" });
		check(
			"user not in project recall",
			!projectOnly.items.some((i) => i.id === "editor-tabs"),
			JSON.stringify(projectOnly.items.map((i) => i.id)),
		);
		const userRecall = recallMemories(tmp, project, { scope: "user" });
		check(
			"user recall finds",
			userRecall.items.some((i) => i.id === "editor-tabs"),
		);

		const teamReject = saveMemory(
			tmp,
			project,
			{ title: "Team note", body: "x", scope: "team" },
			{ apply: true },
		);
		check("team write rejected", !teamReject.ok);

		const valOk = validateMemories(tmp, project, { scope: "all" });
		check("validate clean", valOk.ok, JSON.stringify(valOk.errors));

		fs.writeFileSync(
			path.join(layout.projectMemory, "broken.md"),
			"not frontmatter\n",
			"utf8",
		);
		const valBad = validateMemories(tmp, project, { scope: "project" });
		check("validate catches broken", !valBad.ok && valBad.errors.length >= 1);

		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: project.id,
		};
		const cliPrev = spawnSync(
			process.execPath,
			[
				cli,
				"memory",
				"save",
				"--title",
				"CLI note",
				"--body",
				"from cli",
				"--id",
				"cli-note",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli preview exit 0", cliPrev.status === 0, cliPrev.stderr);
		const prevJson = JSON.parse(cliPrev.stdout);
		check("cli preview apply false", prevJson.apply === false);
		check(
			"cli preview no write",
			!fs.existsSync(path.join(layout.projectMemory, "cli-note.md")),
		);

		const cliApply = spawnSync(
			process.execPath,
			[
				cli,
				"memory",
				"save",
				"--title",
				"CLI note",
				"--body",
				"from cli",
				"--id",
				"cli-note",
				"--apply",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli apply exit 0", cliApply.status === 0, cliApply.stderr);
		check(
			"cli wrote file",
			fs.existsSync(path.join(layout.projectMemory, "cli-note.md")),
		);

		const cliRecall = spawnSync(
			process.execPath,
			[cli, "memory", "recall", "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli recall exit 0", cliRecall.status === 0, cliRecall.stderr);
		const recallJson = JSON.parse(cliRecall.stdout);
		check(
			"cli recall has cli-note",
			recallJson.items.some((i) => i.id === "cli-note"),
		);
		check(
			"cli recall no user editor",
			!recallJson.items.some((i) => i.id === "editor-tabs"),
		);

		const help = spawnSync(process.execPath, [cli, "help"], {
			env,
			encoding: "utf8",
		});
		check("help mentions memory", help.stdout.includes("memory"));

		const lp = layoutPaths(tmp, project);
		check("layoutPaths projectMemory", typeof lp.projectMemory === "string");

		// M3 handoff
		const ho = createHandoff(
			tmp,
			project,
			{ title: "Auth handoff", body: "WIP on cookies", id: "auth-handoff" },
			{ apply: true },
		);
		check("handoff apply ok", ho.ok && ho.apply, ho.error);
		check(
			"handoff has tag",
			Boolean(ho.doc?.tags?.includes("handoff")),
			JSON.stringify(ho.doc?.tags),
		);
		const hoRecall = recallMemories(tmp, project, { tag: "handoff" });
		check(
			"recall tag handoff",
			hoRecall.items.some((i) => i.id === "auth-handoff"),
		);

		// M3 promote
		const promoMem = saveMemory(
			tmp,
			project,
			{
				id: "prefer-token-bucket",
				title: "Prefer token bucket",
				body: "Always use token bucket rate limiting for public APIs.",
				tags: ["api"],
				scope: "project",
			},
			{ apply: true },
		);
		check("promo mem saved", promoMem.ok, promoMem.error);
		const promoPrev = promoteMemoryToPending(tmp, project, {
			id: "prefer-token-bucket",
			apply: false,
		});
		check(
			"promote preview ok",
			promoPrev.ok && !promoPrev.apply,
			promoPrev.error,
		);
		check(
			"promote preview no pending file yet",
			!fs.existsSync(promoPrev.pendingPath),
		);
		const promo = promoteMemoryToPending(tmp, project, {
			id: "prefer-token-bucket",
			apply: true,
		});
		check("promote apply ok", promo.ok && promo.apply, promo.error);
		check("pending file exists", fs.existsSync(promo.pendingPath));
		check(
			"vault still exists",
			fs.existsSync(path.join(layout.projectMemory, "prefer-token-bucket.md")),
		);
		const pendingList = listPending(tmp, project, "project");
		check(
			"listPending has promoted",
			pendingList.some((p) => p.id === "prefer-token-bucket"),
		);
		const promoDup = promoteMemoryToPending(tmp, project, {
			id: "prefer-token-bucket",
			apply: true,
		});
		check("promote dup without force fails", !promoDup.ok);

		const cliHo = spawnSync(
			process.execPath,
			[
				cli,
				"memory",
				"handoff",
				"--title",
				"CLI handoff",
				"--body",
				"## Status\nShipping M3",
				"--id",
				"cli-handoff",
				"--apply",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli handoff exit 0", cliHo.status === 0, cliHo.stderr);
		const cliPromo = spawnSync(
			process.execPath,
			[
				cli,
				"memory",
				"promote-instinct",
				"--id",
				"prefer-token-bucket",
				"--force",
				"--apply",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli promote force exit 0", cliPromo.status === 0, cliPromo.stderr);

		// M4 secrets (assemble at runtime so pre-commit secret scanners ignore fixtures)
		const fakeSk = ["sk", "-", "abcdefghijklmnopqrstuvwxyz012345"].join("");
		check("scan flags sk", hasBlockingSecrets(`key ${fakeSk}`));
		check(
			"placeholder not secret",
			!hasBlockingSecrets("use ${API_KEY} and YOUR_TOKEN_HERE"),
		);
		const blocked = saveMemory(
			tmp,
			project,
			{ title: "bad", body: `token ${fakeSk}`, id: "bad-secret" },
			{ apply: true },
		);
		check("save apply blocked secret", !blocked.ok, blocked.error);
		const prevSecret = saveMemory(
			tmp,
			project,
			{ title: "bad", body: `token ${fakeSk}`, id: "bad-secret" },
			{ apply: false },
		);
		check("save preview still ok", prevSecret.ok && !prevSecret.apply);

		// plant high secret with force for validate
		const forced = saveMemory(
			tmp,
			project,
			{ title: "forced", body: `x ${fakeSk}`, id: "forced-secret" },
			{ apply: true, forceSecrets: true },
		);
		check("forceSecrets write", forced.ok && forced.apply, forced.error);
		const val = validateMemories(tmp, project, { scope: "project" });
		check("validate fails on high secret", !val.ok);
		check(
			"validate error mentions secret",
			val.errors.some((e) => /secret heuristic/i.test(e.error)),
		);

		// M4 ECC import
		const fixture = path.join(
			pkgRoot,
			"scripts/instinct/fixtures/ecc-memory-mini",
		);
		const plan = planEccMemoryImport(fixture, tmp, project, {});
		check("import plan ok", plan.ok, plan.error);
		check(
			"import plan has adds",
			(plan.counts?.add ?? 0) >= 2,
			JSON.stringify(plan.counts),
		);
		const teamItem = plan.items.find((i) => i.id === "rate-limit-shared");
		check(
			"team mapped to project tag",
			Boolean(
				teamItem?.doc &&
					/** @type {any} */ (teamItem.doc).tags?.includes(
						"imported-from-ecc-team",
					),
			),
		);
		const applied = applyEccMemoryImport(plan, tmp, project, { apply: true });
		check("import apply ok", applied.ok, applied.error);
		check(
			"import wrote files",
			(applied.written?.length ?? 0) >= 2,
			String(applied.written?.length),
		);
		const imported = recallMemories(tmp, project, { id: "auth-cookies" });
		check(
			"recall imported auth-cookies",
			imported.items.some((i) => i.id === "auth-cookies"),
		);

		const cliImp = spawnSync(
			process.execPath,
			[cli, "memory", "import-ecc", "--from", fixture, "--json"],
			{ env, encoding: "utf8" },
		);
		check("cli import-ecc preview exit 0", cliImp.status === 0, cliImp.stderr);
		const cliImpJson = JSON.parse(cliImp.stdout);
		check("cli import-ecc apply false", cliImpJson.apply === false);

		const cliBlock = spawnSync(
			process.execPath,
			[
				cli,
				"memory",
				"save",
				"--title",
				"cli-bad",
				"--body",
				fakeSk,
				"--id",
				"cli-bad",
				"--apply",
				"--json",
			],
			{ env, encoding: "utf8" },
		);
		check("cli save secret blocked", cliBlock.status !== 0);
		check("scanMemoryText export", scanMemoryText("ok").findings.length === 0);
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
console.log("instinct-memory: ok");
