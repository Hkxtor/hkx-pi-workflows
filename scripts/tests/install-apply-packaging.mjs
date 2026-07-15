/**
 * C1 regression: install-global must ship scripts/lib/mcp-resolver.mjs next to
 * the installed apply-mcp-profile.mjs.
 *
 * apply-mcp-profile.mjs does:
 *   import { ... } from "./lib/mcp-resolver.mjs"
 * Pre-fix install only linked the helper into
 *   ~/.pi/agent/hkx-pi-workflows/scripts/apply-mcp-profile.mjs
 * and left the relative import broken → ERR_MODULE_NOT_FOUND at runtime.
 *
 * Contract:
 *   1. Helper alone under scripts/ → spawn fails with MODULE_NOT_FOUND (or
 *      non-zero exit whose stderr mentions mcp-resolver).
 *   2. Helper + lib/mcp-resolver.mjs (post-fix layout) → --help exits 0.
 *
 * Isolation: throwaway packageAssetRoot under os.tmpdir(); no real
 * ~/.pi/agent mutation. Mirrors scripts/install.mjs install block shape.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const srcApply = path.join(root, "scripts", "apply-mcp-profile.mjs");
const srcResolver = path.join(root, "scripts", "lib", "mcp-resolver.mjs");
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-c1-pack-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

function runNode(scriptPath, args = []) {
	return spawnSync(process.execPath, [scriptPath, ...args], {
		cwd: path.dirname(scriptPath),
		encoding: "utf8",
		env: process.env,
	});
}

// ---------------------------------------------------------------------------
// Case A (C1 red): apply alone → import fails
// ---------------------------------------------------------------------------
{
	const assetRoot = path.join(tmpDir, "a-asset");
	const scriptsDir = path.join(assetRoot, "scripts");
	mkdirSync(scriptsDir, { recursive: true });
	const destApply = path.join(scriptsDir, "apply-mcp-profile.mjs");
	copyFileSync(srcApply, destApply);
	// deliberately do NOT install lib/mcp-resolver.mjs

	const { status, stderr } = runNode(destApply, ["--help"]);
	const combined = `${stderr}`;
	check(
		"A: apply without resolver fails import (ERR_MODULE_NOT_FOUND)",
		status !== 0 &&
			status !== null &&
			/ERR_MODULE_NOT_FOUND|Cannot find module|mcp-resolver/.test(combined),
		`status=${status} stderr=${JSON.stringify(combined).slice(0, 240)}`,
	);
	check(
		"A: resolver not present under scripts/lib (precondition)",
		!existsSync(path.join(scriptsDir, "lib", "mcp-resolver.mjs")),
		"resolver unexpectedly present",
	);
}

// ---------------------------------------------------------------------------
// Case B (C1 green): apply + resolver + templates (install layout) → --help 0
// apply-mcp-profile resolves repoRoot as parent of scripts/, then loads
// mcp-configs/templates/manifest.json from there — same layout install.mjs
// writes under packageAssetRoot.
// ---------------------------------------------------------------------------
{
	const assetRoot = path.join(tmpDir, "b-asset");
	const scriptsDir = path.join(assetRoot, "scripts");
	const libDir = path.join(scriptsDir, "lib");
	const templatesDir = path.join(assetRoot, "mcp-configs", "templates");
	mkdirSync(libDir, { recursive: true });
	mkdirSync(templatesDir, { recursive: true });
	const destApply = path.join(scriptsDir, "apply-mcp-profile.mjs");
	const destResolver = path.join(libDir, "mcp-resolver.mjs");
	copyFileSync(srcApply, destApply);
	copyFileSync(srcResolver, destResolver);
	// Minimal catalog so --help can list profiles (mirrors install mcp-configs copy).
	writeFileSync(
		path.join(templatesDir, "manifest.json"),
		JSON.stringify(
			{
				profiles: {
					reasoning: {
						file: "reasoning.json",
						description: "fixture",
						servers: ["sequential-thinking"],
					},
				},
			},
			null,
			2,
		),
	);

	const { status, stderr, stdout } = runNode(destApply, ["--help"]);
	check(
		"B: apply with resolver --help exits 0",
		status === 0,
		`status=${status} stderr=${JSON.stringify(stderr).slice(0, 200)}`,
	);
	check(
		"B: --help prints usage (profiles list)",
		/Usage:|Available profiles|profile/i.test(stdout + stderr),
		`stdout=${JSON.stringify(stdout).slice(0, 200)}`,
	);
	check(
		"B: resolver present under scripts/lib",
		existsSync(destResolver),
		`missing ${destResolver}`,
	);
}

// ---------------------------------------------------------------------------
// Case C (C1 guard): install.mjs source must install the resolver path
// ---------------------------------------------------------------------------
{
	const installSrc = await fs.readFile(
		path.join(root, "scripts", "install.mjs"),
		"utf8",
	);
	check(
		"C: install.mjs references scripts/lib/mcp-resolver.mjs in apply install block",
		/mcp-resolver\.mjs/.test(installSrc) &&
			/packageAssetRoot.*scripts.*lib|scripts.*lib.*mcp-resolver/.test(
				installSrc,
			),
		"install.mjs apply block does not install mcp-resolver.mjs",
	);
	check(
		"C: install.mjs fails closed when resolver missing (failed.push)",
		/install apply-mcp-profile resolver/.test(installSrc),
		"missing failed.push label for resolver install",
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} C1 INSTALL-APPLY-PACKAGING CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
