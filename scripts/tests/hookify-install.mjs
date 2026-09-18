#!/usr/bin/env node
/**
 * Path B managed-global Hookify rule installation contract.
 *
 * Exercises the real install.mjs::installHookifyRules implementation against a
 * temporary agent directory. Package-owned pattern/body content is refreshed
 * on reinstall, while the operator-owned `enabled` flag is preserved.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const installPath = path.join(root, "scripts", "install.mjs");
const sourceDir = path.join(root, "configs", "hkx-hookify");
const ruleName = "hookify.block-unparseable-powershell-control-flow.md";
const sourcePath = path.join(sourceDir, ruleName);
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-hookify-install-"));
const agentDir = path.join(tmpRoot, "agent");
const hookifyDir = path.join(agentDir, "hookify");
const destPath = path.join(hookifyDir, ruleName);
const pass = [];
const fail = [];

function check(name, condition, detail = "") {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

function withEnabled(raw, enabled) {
	return raw.replace(
		/^(enabled:\s*)(?:true|false)\s*$/m,
		`$1${enabled ? "true" : "false"}`,
	);
}

try {
	const installModule = await import(
		`${pathToFileURL(installPath).href}?t=${Date.now()}`
	);
	const installHookifyRules = installModule.installHookifyRules;
	check(
		"install.mjs exports installHookifyRules",
		typeof installHookifyRules === "function",
		typeof installHookifyRules,
	);
	check("canonical managed rule exists", existsSync(sourcePath), sourcePath);

	if (typeof installHookifyRules === "function" && existsSync(sourcePath)) {
		const sourceRaw = readFileSync(sourcePath, "utf8");

		// A: cold install creates the managed global rule without touching peers.
		await fs.mkdir(hookifyDir, { recursive: true });
		const unrelatedPath = path.join(hookifyDir, "hookify.operator-rule.md");
		const unrelatedRaw = "---\nname: operator-rule\nevent: file\npattern: x\n---\nkeep me\n";
		await fs.writeFile(unrelatedPath, unrelatedRaw, "utf8");
		const cold = await installHookifyRules({ sourceDir, agentDir });
		check("cold install returns true", cold === true, String(cold));
		check("cold install creates global rule", existsSync(destPath), destPath);
		check(
			"cold install copies canonical content exactly",
			readFileSync(destPath, "utf8") === sourceRaw,
			destPath,
		);
		check(
			"cold install preserves unrelated global rule",
			readFileSync(unrelatedPath, "utf8") === unrelatedRaw,
			unrelatedPath,
		);

		// B: reinstall refreshes managed content, preserves enabled:false, and
		// backs up the previous operator-edited file before replacement.
		const staleRaw = sourceRaw
			.replace(/^enabled:\s*true\s*$/m, "enabled: false")
			.replace(/^pattern:.*$/m, 'pattern: "stale-pattern"')
			.replace(/This command contains PowerShell syntax/, "STALE BODY");
		await fs.writeFile(destPath, staleRaw, "utf8");
		const beforeBackups = readdirSync(hookifyDir).filter((name) =>
			name.startsWith(`${ruleName}.bak.`),
		);
		const refreshed = await installHookifyRules({ sourceDir, agentDir });
		const afterRaw = readFileSync(destPath, "utf8");
		const afterBackups = readdirSync(hookifyDir).filter((name) =>
			name.startsWith(`${ruleName}.bak.`),
		);
		check("reinstall returns true", refreshed === true, String(refreshed));
		check(
			"reinstall refreshes pattern and body",
			afterRaw === withEnabled(sourceRaw, false),
			afterRaw,
		);
		check(
			"reinstall preserves operator enabled:false",
			/^enabled:\s*false\s*$/m.test(afterRaw),
			afterRaw,
		);
		check(
			"reinstall creates one backup",
			afterBackups.length === beforeBackups.length + 1,
			`before=${beforeBackups.length} after=${afterBackups.length}`,
		);
		const backupName = afterBackups.find((name) => !beforeBackups.includes(name));
		check(
			"backup preserves previous stale file",
			Boolean(backupName) &&
				readFileSync(path.join(hookifyDir, backupName), "utf8") === staleRaw,
			backupName ?? "missing backup",
		);

		// C: malformed existing frontmatter fails closed and remains unchanged.
		const malformed = "not valid hookify frontmatter\n";
		await fs.writeFile(destPath, malformed, "utf8");
		const rejected = await installHookifyRules({ sourceDir, agentDir });
		check("malformed destination reports failure", rejected === false, String(rejected));
		check(
			"malformed destination remains unchanged",
			readFileSync(destPath, "utf8") === malformed,
			readFileSync(destPath, "utf8"),
		);

		// D: a pre-existing symlink must never be followed or replaced. Windows
		// may deny file symlinks without Developer Mode, so fall back to a junction
		// fixture there; lstat must reject either link type before reading it.
		await fs.rm(destPath, { force: true });
		let symlinkTarget = path.join(tmpRoot, "operator-owned-target.md");
		const symlinkTargetRaw = "operator-owned target\n";
		await fs.writeFile(symlinkTarget, symlinkTargetRaw, "utf8");
		let symlinkCreated = false;
		try {
			await fs.symlink(symlinkTarget, destPath, "file");
			symlinkCreated = true;
		} catch (error) {
			if (
				process.platform === "win32" &&
				(error?.code === "EPERM" || error?.code === "EACCES")
			) {
				const junctionTarget = path.join(tmpRoot, "operator-owned-target-dir");
				await fs.mkdir(junctionTarget);
				symlinkTarget = path.join(junctionTarget, "sentinel.txt");
				await fs.writeFile(symlinkTarget, symlinkTargetRaw, "utf8");
				await fs.symlink(junctionTarget, destPath, "junction");
				symlinkCreated = true;
			} else if (error?.code === "EPERM" || error?.code === "EACCES") {
				console.log("note: symlink creation unavailable; skipping symlink guard case");
			} else {
				check("symlink fixture creation succeeds", false, error.message);
			}
		}
		if (symlinkCreated) {
			const symlinkRejected = await installHookifyRules({ sourceDir, agentDir });
			check(
				"symlink destination reports failure",
				symlinkRejected === false,
				String(symlinkRejected),
			);
			check(
				"symlink destination remains a symlink",
				(await fs.lstat(destPath)).isSymbolicLink(),
				destPath,
			);
			check(
				"symlink target remains unchanged",
				readFileSync(symlinkTarget, "utf8") === symlinkTargetRaw,
				readFileSync(symlinkTarget, "utf8"),
			);
		}
	}
} finally {
	await fs.rm(tmpRoot, { recursive: true, force: true });
}

for (const name of pass) console.log("ok:", name);
if (fail.length > 0) {
	for (const item of fail) console.error("FAIL:", item);
	process.exit(1);
}
console.log(`hookify-install: all ${pass.length} checks passed`);
