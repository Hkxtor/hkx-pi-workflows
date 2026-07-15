/**
 * M4 regression: apply-mcp-profile.mjs::main() refuse behavior must be
 * exercised as a real process, not a source-text grep.
 *
 * Pre-fix Case S only locked the refuse *message wording* via readFileSync
 * + regex. That was false-positive on benign rewording (M17) and false-
 * negative when the throw was downgraded to console.warn (M18) — the unit
 * suite never invoked main() orchestration.
 *
 * Contract this suite enforces:
 *   1. Missing required env (research profile needs FIRECRAWL_API_KEY) →
 *      non-zero exit AND --target file is not created / not mutated.
 *   2. Unresolved ${VAR} after requiredEnv is satisfied still refuses write
 *      (defense-in-depth; research template uses ${FIRECRAWL_API_KEY}).
 *   3. --dry-run with missing env → exit 0 (preview path) AND still no write.
 *   4. Happy path with env set → exit 0 AND target gains the server.
 *
 * Isolation: spawn the real CLI against a throwaway --target under os.tmpdir().
 * Env is pinned so runner process.env cannot flip red/green (parallel to M5).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/apply-mcp-profile.mjs");
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-m4-apply-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

function baseEnv() {
	// Strip FIRECRAWL_API_KEY so research profile is deterministic regardless
	// of the operator/CI shell. Keep PATH and other process essentials.
	const env = { ...process.env };
	delete env.FIRECRAWL_API_KEY;
	return env;
}

function runApply(args, { env = baseEnv() } = {}) {
	const result = spawnSync(process.execPath, [script, ...args], {
		cwd: root,
		env,
		encoding: "utf8",
	});
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		signal: result.signal,
	};
}

// ---------------------------------------------------------------------------
// Case A (M4 red): missing FIRECRAWL_API_KEY → non-zero exit, target NOT written
// ---------------------------------------------------------------------------
{
	const target = path.join(tmpDir, "a-mcp.json");
	// Ensure target does not pre-exist
	if (existsSync(target)) await fs.rm(target);

	const { status, stderr } = runApply([
		"--target",
		target,
		"research",
	]);

	check(
		"A: missing required env exits non-zero",
		status !== 0 && status !== null,
		`status=${status} stderr=${JSON.stringify(stderr).slice(0, 200)}`,
	);
	check(
		"A: missing required env does not create target",
		!existsSync(target),
		`target was created despite refuse: ${target}`,
	);
	check(
		"A: refuse message mentions missing/unresolved (behavior, not exact wording)",
		/Missing required environment variables|Unresolved/.test(stderr),
		`stderr=${JSON.stringify(stderr).slice(0, 240)}`,
	);
}

// ---------------------------------------------------------------------------
// Case B (M4 red): pre-seeded target must not be mutated on refuse
// ---------------------------------------------------------------------------
{
	const target = path.join(tmpDir, "b-mcp.json");
	const before = JSON.stringify(
		{ $schema: "x", mcpServers: { keepme: { command: "echo" } } },
		null,
		2,
	) + "\n";
	writeFileSync(target, before);

	const { status } = runApply(["--target", target, "research"]);

	check(
		"B: missing env exits non-zero (pre-seeded target)",
		status !== 0 && status !== null,
		`status=${status}`,
	);
	const after = readFileSync(target, "utf8");
	check(
		"B: pre-seeded target not mutated on refuse",
		after === before,
		`target rewritten to ${JSON.stringify(after).slice(0, 120)}`,
	);
}

// ---------------------------------------------------------------------------
// Case C (M4 guard): --dry-run with missing env → exit 0, still no write
// ---------------------------------------------------------------------------
{
	const target = path.join(tmpDir, "c-mcp.json");
	if (existsSync(target)) await fs.rm(target);

	const { status } = runApply([
		"--dry-run",
		"--target",
		target,
		"research",
	]);

	check(
		"C: --dry-run with missing env exits 0",
		status === 0,
		`status=${status}`,
	);
	check(
		"C: --dry-run does not create target",
		!existsSync(target),
		`target was created on dry-run: ${target}`,
	);
}

// ---------------------------------------------------------------------------
// Case D (M4 guard): happy path with env set → exit 0 and target written
// ---------------------------------------------------------------------------
{
	const target = path.join(tmpDir, "d-mcp.json");
	if (existsSync(target)) await fs.rm(target);
	mkdirSync(path.dirname(target), { recursive: true });

	const env = baseEnv();
	env.FIRECRAWL_API_KEY = "test-only-not-a-real-secret";

	const { status, stderr } = runApply(
		["--target", target, "research"],
		{ env },
	);

	check(
		"D: happy path exits 0",
		status === 0,
		`status=${status} stderr=${JSON.stringify(stderr).slice(0, 200)}`,
	);
	check(
		"D: happy path writes target with firecrawl server",
		existsSync(target),
		`target missing after success`,
	);
	if (existsSync(target)) {
		let out = null;
		let parseErr = null;
		try {
			out = JSON.parse(readFileSync(target, "utf8"));
		} catch (err) {
			parseErr = err.message;
		}
		check(
			"D: happy path target is parseable JSON",
			out !== null,
			parseErr ? `parse failed: ${parseErr}` : "",
		);
		check(
			"D: firecrawl server present with resolved env",
			out?.mcpServers?.firecrawl?.env?.FIRECRAWL_API_KEY ===
				"test-only-not-a-real-secret",
			`got ${JSON.stringify(out?.mcpServers?.firecrawl)}`,
		);
		check(
			"D: requiresEnv stripped from persisted firecrawl",
			!Object.hasOwn(out?.mcpServers?.firecrawl ?? {}, "requiresEnv"),
			`requiresEnv leaked: ${JSON.stringify(out?.mcpServers?.firecrawl)}`,
		);
	}
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} M4 APPLY-MCP-PROFILE CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
