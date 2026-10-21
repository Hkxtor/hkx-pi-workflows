#!/usr/bin/env node
/**
 * Path B retirement contract: install.mjs::pruneDanglingLinks.
 *
 * Retiring a rule/command/agent/chain/skill deletes its repo file, but
 * linkOrCopy only ever writes the files the repo still has, so the old
 * `~/.pi/agent/...` symlink survives. A dangling rule link is not cosmetic:
 * hkx-rules fails open with a warning, so every session opens with a
 * `cannot read rule ...` notice for a surface that no longer exists.
 *
 * The pruning must be narrow — it must never delete an operator's real file,
 * an operator symlink that points outside the package tree, or a copy-only
 * directory. Everything here runs against temp dirs; the real ~/.pi/agent is
 * never touched.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const installPath = path.join(root, "scripts", "install.mjs");
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-retired-surface-"));
const pass = [];
const fail = [];

function check(name, condition, detail = "") {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

/**
 * Windows denies file symlinks without Developer Mode. A directory junction is
 * the available stand-in, but junctions report the resolved target from
 * readlink(), which is exactly the shape pruneDanglingLinks must refuse — so
 * the junction fallback only proves the link is skipped, not pruned.
 */
async function makeLink(target, linkPath) {
	try {
		await fs.symlink(target, linkPath, "file");
		return "symlink";
	} catch (error) {
		if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
		const junctionTarget = `${target}-junction-target`;
		await fs.mkdir(junctionTarget, { recursive: true });
		await fs.symlink(junctionTarget, linkPath, "junction");
		return "junction";
	}
}

try {
	const installModule = await import(
		`${pathToFileURL(installPath).href}?t=${Date.now()}`
	);
	const pruneDanglingLinks = installModule.pruneDanglingLinks;
	check(
		"install.mjs exports pruneDanglingLinks",
		typeof pruneDanglingLinks === "function",
		typeof pruneDanglingLinks,
	);

	if (typeof pruneDanglingLinks === "function") {
		// A: a dangling link into the package source tree is pruned, and the
		// live links beside it survive untouched.
		{
			const srcDir = path.join(tmpRoot, "a-src");
			const destDir = path.join(tmpRoot, "a-dest");
			mkdirSync(srcDir, { recursive: true });
			mkdirSync(destDir, { recursive: true });

			const liveSrc = path.join(srcDir, "hkx-live.md");
			writeFileSync(liveSrc, "---\ndescription: live\n---\nbody\n", "utf8");
			const retiredSrc = path.join(srcDir, "hkx-retired.md");
			writeFileSync(retiredSrc, "retired\n", "utf8");

			const liveLink = path.join(destDir, "hkx-live.md");
			const retiredLink = path.join(destDir, "hkx-retired.md");
			const liveKind = await makeLink(liveSrc, liveLink);
			await makeLink(retiredSrc, retiredLink);

			// Retire the source: the link is now dangling.
			await fs.rm(retiredSrc, { force: true });

			const pruned = await pruneDanglingLinks(srcDir, destDir, {
				extensions: [".md", ".mdc"],
			});
			check(
				"A: prunes the dangling link",
				Array.isArray(pruned) && pruned.includes("hkx-retired.md"),
				JSON.stringify(pruned),
			);
			check(
				"A: dangling link is gone",
				!existsSync(retiredLink) && !(await pathExistsLstat(retiredLink)),
				retiredLink,
			);
			check(
				"A: live link survives",
				await pathExistsLstat(liveLink),
				`kind=${liveKind}`,
			);
			check(
				"A: live link still resolves",
				readFileSync(liveLink, "utf8").includes("description: live"),
				"",
			);
		}

		// B: an operator-owned real file is never deleted, even when the repo
		// has no matching source.
		{
			const srcDir = path.join(tmpRoot, "b-src");
			const destDir = path.join(tmpRoot, "b-dest");
			mkdirSync(srcDir, { recursive: true });
			mkdirSync(destDir, { recursive: true });

			const operatorFile = path.join(destDir, "hkx-operator-local.md");
			writeFileSync(operatorFile, "operator owned\n", "utf8");

			const pruned = await pruneDanglingLinks(srcDir, destDir, {
				extensions: [".md"],
			});
			check("B: prunes nothing when no links dangle", pruned.length === 0, JSON.stringify(pruned));
			check("B: operator file survives", existsSync(operatorFile), operatorFile);
			check(
				"B: operator file content unchanged",
				readFileSync(operatorFile, "utf8") === "operator owned\n",
				"",
			);
		}

		// C: a symlink that points OUTSIDE the package source tree belongs to
		// someone else. Even when its target is missing, it must be left alone.
		{
			const srcDir = path.join(tmpRoot, "c-src");
			const destDir = path.join(tmpRoot, "c-dest");
			mkdirSync(srcDir, { recursive: true });
			mkdirSync(destDir, { recursive: true });

			const foreignTarget = path.join(tmpRoot, "c-foreign", "gone.md");
			const foreignLink = path.join(destDir, "hkx-foreign.md");
			const kind = await makeLink(foreignTarget, foreignLink);

			if (kind === "symlink") {
				const pruned = await pruneDanglingLinks(srcDir, destDir, {
					extensions: [".md"],
				});
				check(
					"C: foreign dangling link is not pruned",
					pruned.length === 0,
					JSON.stringify(pruned),
				);
				check(
					"C: foreign link still present",
					await pathExistsLstat(foreignLink),
					foreignLink,
				);
			} else {
				// Junction fallback: readlink() reports the resolved target, so
				// the link is skipped by the link-text guard. Same outcome.
				const pruned = await pruneDanglingLinks(srcDir, destDir, {
					extensions: [".md"],
				});
				check(
					"C: junction link is not pruned",
					pruned.length === 0,
					JSON.stringify(pruned),
				);
			}
		}

		// D: extension filter — a dangling .md link is not pruned when the
		// caller scopes the pass to chains.
		{
			const srcDir = path.join(tmpRoot, "d-src");
			const destDir = path.join(tmpRoot, "d-dest");
			mkdirSync(srcDir, { recursive: true });
			mkdirSync(destDir, { recursive: true });

			const mdSrc = path.join(srcDir, "hkx-doc.md");
			writeFileSync(mdSrc, "doc\n", "utf8");
			const mdLink = path.join(destDir, "hkx-doc.md");
			await makeLink(mdSrc, mdLink);
			await fs.rm(mdSrc, { force: true });

			const pruned = await pruneDanglingLinks(srcDir, destDir, {
				extensions: [".chain.json", ".chain.md"],
			});
			check("D: extension filter skips out-of-scope links", pruned.length === 0, JSON.stringify(pruned));
			check("D: out-of-scope link survives", await pathExistsLstat(mdLink), mdLink);
		}

		// E: a missing destination directory (cold install) is a no-op, not a
		// throw — main() calls this before the first link exists.
		{
			const srcDir = path.join(tmpRoot, "e-src");
			mkdirSync(srcDir, { recursive: true });
			let threw = null;
			let pruned = null;
			try {
				pruned = await pruneDanglingLinks(
					srcDir,
					path.join(tmpRoot, "e-dest-does-not-exist"),
				);
			} catch (error) {
				threw = error;
			}
			check("E: missing destination does not throw", threw === null, threw?.message ?? "");
			check("E: missing destination returns empty list", Array.isArray(pruned) && pruned.length === 0, JSON.stringify(pruned));
		}
	}

	// F: main() wires the pruning in for every linked surface. Source-level
	// assertion — the per-surface loops are inside main() and cannot be driven
	// without a full install.
	{
		const installSource = readFileSync(installPath, "utf8");
		for (const surface of ["rules", "prompts", "skills", "hkx", "chains"]) {
			check(
				`F: main() prunes retired ${surface} links`,
				new RegExp(`pruneDanglingLinks\\([^)]*"${surface}"`).test(installSource),
				surface,
			);
		}
		check(
			"F: prune only unlinks symlinks (lstat guard present)",
			/stats\.isSymbolicLink\(\)/.test(installSource),
			"",
		);
		check(
			"F: prune requires the link text to resolve into the source dir",
			/target\.startsWith\(srcRoot\)/.test(installSource),
			"",
		);
	}
} catch (error) {
	fail.push(`suite threw: ${error?.stack ?? error?.message ?? error}`);
} finally {
	await fs.rm(tmpRoot, { recursive: true, force: true });
}

async function pathExistsLstat(p) {
	try {
		await fs.lstat(p);
		return true;
	} catch {
		return false;
	}
}

console.log(`pass: ${pass.length}`);
for (const p of pass) console.log(`  ok: ${p}`);
if (fail.length) {
	console.error(`fail: ${fail.length}`);
	for (const f of fail) console.error(`  FAIL: ${f}`);
	process.exit(1);
}
console.log("retired-surface-prune: ok");
