/**
 * Instinct evolve Phase 1 smoke tests (paths, parse, cluster, e2e CLI).
 * Auth: user "开工"; plan docs/instinct-evolve-plan.md
 * Verify: npm test
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	resolveHomunculusDir,
	normalizePathForHash,
	stripRemoteCredentials,
	hash12,
	detectProject,
	ensureLayout,
	isValidInstinctId,
	isAbsolutePath,
} from "../instinct/lib/paths.mjs";
import {
	parseInstinctFile,
	extractAction,
	serializeInstinct,
} from "../instinct/lib/parse.mjs";
import { analyzeEvolve, normalizeTrigger } from "../instinct/lib/cluster.mjs";
import { loadAllInstincts, writeInstinct } from "../instinct/lib/store.mjs";
import { writeFileAtomic } from "../instinct/lib/atomic-write.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "scripts/instinct/cli.mjs");
const fixturesDir = path.join(root, "scripts/instinct/fixtures");

const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// --- paths: Linux default ---
{
	const r = resolveHomunculusDir({
		platform: "linux",
		homedir: () => "/home/dev",
	});
	check(
		"linux default root",
		r.root === "/home/dev/.local/share/hkx-homunculus",
		r.root,
	);
	check("linux source default-xdg", r.source === "default-xdg", r.source);
}

// --- paths: XDG ---
{
	const r = resolveHomunculusDir({
		platform: "linux",
		XDG_DATA_HOME: "/var/data",
		homedir: () => "/home/dev",
	});
	check("linux XDG root", r.root === "/var/data/hkx-homunculus", r.root);
}

// --- paths: Windows LOCALAPPDATA ---
{
	const r = resolveHomunculusDir({
		platform: "win32",
		LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local",
		homedir: () => "C:\\Users\\dev",
	});
	const expected = "C:\\Users\\dev\\AppData\\Local\\hkx-homunculus";
	check(
		"win32 LOCALAPPDATA root",
		r.root === expected || r.root.replace(/\//g, "\\") === expected,
		r.root,
	);
	check("win32 source LOCALAPPDATA", r.source === "LOCALAPPDATA", r.source);
}

// --- paths: Windows override absolute ---
{
	const r = resolveHomunculusDir({
		platform: "win32",
		HKX_HOMUNCULUS_DIR: "D:\\data\\hkx-homunculus",
		LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local",
		homedir: () => "C:\\Users\\dev",
	});
	check(
		"win32 absolute override",
		r.root === "D:\\data\\hkx-homunculus",
		r.root,
	);
	check("win32 isAbsolute D:", isAbsolutePath("D:\\data\\x", "win32"));
}

// --- paths: reject relative override ---
{
	const r = resolveHomunculusDir({
		platform: "linux",
		HKX_HOMUNCULUS_DIR: "relative/path",
		homedir: () => "/home/dev",
	});
	check(
		"relative override ignored",
		r.root === "/home/dev/.local/share/hkx-homunculus",
		r.root,
	);
	check("relative override warning", r.warnings.length >= 1);
}

// --- path hash stability ---
{
	const a = normalizePathForHash("C:\\Repos\\app", "win32");
	const b = normalizePathForHash("c:/Repos/app/", "win32");
	check("win path hash normalize equal", a === b, `${a} vs ${b}`);
	check("hash12 length", hash12("https://github.com/a/b").length === 12);
}

// --- remote strip ---
{
	const stripped = stripRemoteCredentials(
		"https://user:token@github.com/org/repo.git",
	);
	check(
		"strip credentials",
		stripped === "https://github.com/org/repo",
		stripped,
	);
	const id1 = hash12(stripped);
	const id2 = hash12(stripRemoteCredentials("https://github.com/org/repo"));
	check("same remote same id cross style", id1 === id2);
}

// --- detectProject remote ---
{
	const p = detectProject("/tmp/proj", {
		env: {},
		git: (args) => {
			if (args[0] === "remote") {
				return {
					status: 0,
					stdout: "https://github.com/acme/demo.git\n",
					stderr: "",
				};
			}
			return { status: 1, stdout: "", stderr: "" };
		},
	});
	check("detect git-remote", p.source === "git-remote", p.source);
	check(
		"detect id from remote",
		p.id === hash12("https://github.com/acme/demo"),
		p.id,
	);
}

// --- detectProject explicit ---
{
	const p = detectProject("/tmp/proj", {
		env: { HKX_PROJECT_ID: "abcdef012345" },
		git: () => ({ status: 1, stdout: "", stderr: "" }),
	});
	check(
		"detect HKX_PROJECT_ID",
		p.id === "abcdef012345" && p.source === "HKX_PROJECT_ID",
	);
}

// --- valid id ---
check("valid id ok", isValidInstinctId("prefer-functional"));
check("valid id rejects slash", !isValidInstinctId("a/b"));
check("valid id rejects windows bad", !isValidInstinctId("a:b"));

// --- parse LF ---
{
	const sample = `---
id: demo
trigger: "when testing"
confidence: 0.7
domain: testing
---

# Demo

## Action
Do the thing.
`;
	const list = parseInstinctFile(sample);
	check("parse one instinct", list.length === 1 && list[0].id === "demo");
	check("parse confidence", list[0].confidence === 0.7);
	check("extractAction", extractAction(list[0].content) === "Do the thing.");
}

// --- parse CRLF + bad confidence ---
{
	const crlf = [
		"---",
		"id: crlf-demo",
		"confidence: not-a-number",
		"trigger: when writing",
		"---",
		"",
		"## Action",
		"Works with CRLF",
		"",
	].join("\r\n");
	const list = parseInstinctFile(crlf);
	check("parse CRLF", list.length === 1 && list[0].id === "crlf-demo");
	check("bad confidence -> 0.5", list[0].confidence === 0.5);
}

// --- serialize roundtrip ---
{
	const md = serializeInstinct({
		id: "roundtrip",
		trigger: "when adding tests",
		confidence: 0.9,
		domain: "testing",
		content: "# Roundtrip\n\n## Action\nKeep it.\n",
	});
	check("serialize has LF only", !md.includes("\r"));
	const back = parseInstinctFile(md);
	check("roundtrip id", back[0]?.id === "roundtrip");
}

// --- cluster ---
{
	const instincts = [
		{
			id: "a",
			trigger: "when writing new functions",
			confidence: 0.85,
			domain: "code-style",
		},
		{
			id: "b",
			trigger: "when writing new functions",
			confidence: 0.8,
			domain: "code-style",
		},
		{
			id: "c",
			trigger: "when writing new functions",
			confidence: 0.78,
			domain: "code-style",
		},
		{
			id: "d",
			trigger: "when implementing a feature",
			confidence: 0.84,
			domain: "workflow",
		},
	];
	check(
		"normalize trigger collapses stopwords",
		normalizeTrigger("when writing new functions") === "new functions",
	);
	const tooFew = analyzeEvolve(instincts.slice(0, 2));
	check("evolve needs 3", tooFew.ok === false);
	const analysis = analyzeEvolve(instincts);
	check("evolve ok", analysis.ok === true);
	check("skill cluster >=1", analysis.skillCandidates.length >= 1);
	check("agent candidate from 3-cluster", analysis.agentCandidates.length >= 1);
	check(
		"command from workflow",
		analysis.commandCandidates.some((c) => c.instinct.id === "d"),
	);
}

// --- atomic write + store e2e in temp ---
{
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-instinct-"));
	try {
		const project = {
			id: "aabbccddeeff",
			name: "fixture-proj",
			source: "test",
			remote: null,
		};
		ensureLayout(tmp, project);
		for (const name of [
			"prefer-functional.md",
			"use-immutable.md",
			"avoid-classes.md",
			"test-first-workflow.md",
		]) {
			const text = fs.readFileSync(path.join(fixturesDir, name), "utf8");
			const inst = parseInstinctFile(text)[0];
			writeInstinct(tmp, project, inst, "personal", "project");
		}
		writeInstinct(
			tmp,
			project,
			{
				id: "prefer-functional",
				trigger: "global-should-lose",
				confidence: 0.1,
				domain: "code-style",
				content: "## Action\nGlobal",
			},
			"personal",
			"global",
		);
		const loaded = loadAllInstincts(tmp, project);
		check(
			"loaded 4 (project wins id)",
			loaded.length === 4,
			String(loaded.length),
		);
		const pf = loaded.find((i) => i.id === "prefer-functional");
		check(
			"project wins over global",
			pf?.trigger === "when writing new functions",
			String(pf?.trigger),
		);

		writeFileAtomic(path.join(tmp, "x.txt"), "hello\r\nworld");
		const atomic = fs.readFileSync(path.join(tmp, "x.txt"), "utf8");
		check(
			"atomic write LF",
			atomic === "hello\nworld\n",
			JSON.stringify(atomic),
		);

		const env = {
			...process.env,
			HKX_HOMUNCULUS_DIR: tmp,
			HKX_PROJECT_ID: project.id,
		};
		const status = spawnSync(process.execPath, [cli, "status", "--json"], {
			env,
			encoding: "utf8",
		});
		check("cli status exit 0", status.status === 0, String(status.status));
		const statusJson = JSON.parse(status.stdout);
		check("cli status count 4", statusJson.counts.total === 4);

		const evolve = spawnSync(
			process.execPath,
			[cli, "evolve", "--generate", "--json"],
			{ env, encoding: "utf8" },
		);
		check(
			"cli evolve exit 0",
			evolve.status === 0,
			evolve.stderr || String(evolve.status),
		);
		const evolveJson = JSON.parse(evolve.stdout);
		check("cli evolve ok", evolveJson.analysis.ok === true);
		check(
			"cli generated files",
			Array.isArray(evolveJson.generated) && evolveJson.generated.length > 0,
			JSON.stringify(evolveJson.generated?.length),
		);
		check(
			"generated under data root",
			evolveJson.generated.every((p) => String(p).startsWith(tmp)),
		);
		check(
			"not writing package skills",
			!evolveJson.generated.some((p) =>
				String(p).includes(`${path.sep}skills${path.sep}instinct-evolve`),
			),
		);

		const emptyRoot = path.join(tmp, "empty-root");
		fs.mkdirSync(emptyRoot, { recursive: true });
		const tooFewCli = spawnSync(process.execPath, [cli, "evolve", "--json"], {
			env: {
				...env,
				HKX_HOMUNCULUS_DIR: emptyRoot,
				HKX_PROJECT_ID: "ffffffffffff",
			},
			encoding: "utf8",
		});
		check(
			"cli evolve <3 fails",
			tooFewCli.status === 1,
			String(tooFewCli.status) + " " + tooFewCli.stdout,
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

console.log(`instinct-core: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
	for (const f of fail) console.error(`  FAIL ${f}`);
	process.exit(1);
}
console.log("instinct-core: all checks passed");
