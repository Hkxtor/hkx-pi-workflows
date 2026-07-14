#!/usr/bin/env node
/**
 * Versioned package smoke suite for @hkx/pi-workflows (MF-4).
 *
 * npm entry: npm test
 *
 * Runs each scripts/tests/*.mjs smoke (except this runner) sequentially.
 * Failures abort with non-zero exit. Keeps CI/local operators on one command.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, "../..");

const files = fs
	.readdirSync(testsDir)
	.filter((f) => f.endsWith(".mjs") && f !== "run.mjs")
	.sort();

if (files.length === 0) {
	console.error("FAIL: no smoke tests under scripts/tests/");
	process.exit(1);
}

let failed = 0;
for (const file of files) {
	const rel = path.join("scripts/tests", file);
	console.log(`\n=== ${rel} ===`);
	const result = spawnSync(process.execPath, [path.join(testsDir, file)], {
		cwd: root,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		failed += 1;
		console.error(`FAIL: ${rel} exited ${result.status ?? "signal"}`);
	}
}

if (failed > 0) {
	console.error(`\nnpm test: ${failed}/${files.length} smoke suite(s) failed`);
	process.exit(1);
}
console.log(`\nnpm test: all ${files.length} smoke suite(s) passed`);
