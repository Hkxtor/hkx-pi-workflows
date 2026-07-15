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
 *   2. H1: requiredEnv satisfied but server still has unresolved ${VAR} →
 *      non-zero exit AND target not written with the literal ${VAR}.
 *   3. H1: requiredEnv satisfied but server still has a placeholder template →
 *      non-zero exit AND target not written with the placeholder.
 *   4. --dry-run with missing env → exit 0 (preview path) AND still no write.
 *   5. Happy path with env set → exit 0 AND target gains the server.
 *
 * Isolation: spawn the real CLI against a throwaway --target under os.tmpdir().
 * Env is pinned so runner process.env cannot flip red/green (parallel to M5).
 * H1 cases use HKX_MCP_TEMPLATE_ROOT to inject a private catalog that the
 * stock research template cannot exercise (requiredEnv and unresolved refs
 * share FIRECRAWL_API_KEY there, so A/B only hit the requiredEnv gate).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
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

	const { status, stderr } = runApply(["--target", target, "research"]);

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
	const before =
		JSON.stringify(
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

	const { status } = runApply(["--dry-run", "--target", target, "research"]);

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

	const { status, stderr } = runApply(["--target", target, "research"], {
		env,
	});

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

// ---------------------------------------------------------------------------
// H1 fixture catalog helpers — private templates that stock research cannot
// exercise. requiredEnv is satisfied (or empty) while env still carries an
// unresolved ${VAR} or a placeholder template, so the throw at
// apply-mcp-profile.mjs unresolvedEnv/placeholderServers is the only gate.
// ---------------------------------------------------------------------------
function writeH1Catalog(name, serverEnv, { requiresEnv = [] } = {}) {
	const catalogRoot = path.join(tmpDir, `catalog-${name}`);
	mkdirSync(catalogRoot, { recursive: true });
	const profileName = `h1-${name}`;
	const fileName = `${profileName}.json`;
	writeFileSync(
		path.join(catalogRoot, "manifest.json"),
		JSON.stringify(
			{
				profiles: {
					[profileName]: {
						file: fileName,
						description: `H1 fixture ${name}`,
						servers: [profileName],
						requiresEnv,
					},
				},
			},
			null,
			2,
		),
	);
	writeFileSync(
		path.join(catalogRoot, fileName),
		JSON.stringify(
			{
				mcpServers: {
					[profileName]: {
						command: "npx",
						env: serverEnv,
						requiresEnv,
						description: `H1 fixture ${name}`,
					},
				},
			},
			null,
			2,
		),
	);
	return { catalogRoot, profileName };
}

// ---------------------------------------------------------------------------
// Case E (H1 red): requiredEnv satisfied, but env still has unresolved
// ${OTHER_UNSET} → non-zero exit AND target not written with the literal.
// A throw→warn mutation of the unresolvedEnv refuse must fail this case.
// ---------------------------------------------------------------------------
{
	const { catalogRoot, profileName } = writeH1Catalog(
		"unresolved",
		{
			FILLED: "${FILLED_KEY}",
			LEAK: "${OTHER_UNSET}",
		},
		{ requiresEnv: ["FILLED_KEY"] },
	);
	const target = path.join(tmpDir, "e-mcp.json");
	if (existsSync(target)) await fs.rm(target);

	const env = baseEnv();
	env.FILLED_KEY = "filled-ok";
	delete env.OTHER_UNSET;
	env.HKX_MCP_TEMPLATE_ROOT = catalogRoot;

	const { status, stderr } = runApply(["--target", target, profileName], {
		env,
	});

	check(
		"E: unresolved ${VAR} with requiredEnv satisfied exits non-zero",
		status !== 0 && status !== null,
		`status=${status} stderr=${JSON.stringify(stderr).slice(0, 240)}`,
	);
	check(
		"E: unresolved refuse does not create target",
		!existsSync(target),
		`target was created despite unresolved refuse: ${target}`,
	);
	check(
		"E: refuse message mentions unresolved (behavior, not exact wording)",
		/Unresolved|unresolved/.test(stderr),
		`stderr=${JSON.stringify(stderr).slice(0, 240)}`,
	);
}

// ---------------------------------------------------------------------------
// Case F (H1 red): requiredEnv empty, env carries a placeholder template →
// non-zero exit AND target not written. A throw→warn mutation of the
// placeholderServers refuse must fail this case.
// ---------------------------------------------------------------------------
{
	const { catalogRoot, profileName } = writeH1Catalog("placeholder", {
		TOKEN: "YOUR_TOKEN_HERE",
	});
	const target = path.join(tmpDir, "f-mcp.json");
	if (existsSync(target)) await fs.rm(target);

	const env = baseEnv();
	env.HKX_MCP_TEMPLATE_ROOT = catalogRoot;

	const { status, stderr } = runApply(["--target", target, profileName], {
		env,
	});

	check(
		"F: placeholder template exits non-zero",
		status !== 0 && status !== null,
		`status=${status} stderr=${JSON.stringify(stderr).slice(0, 240)}`,
	);
	check(
		"F: placeholder refuse does not create target",
		!existsSync(target),
		`target was created despite placeholder refuse: ${target}`,
	);
	check(
		"F: refuse message mentions placeholder (behavior, not exact wording)",
		/[Pp]laceholder/.test(stderr),
		`stderr=${JSON.stringify(stderr).slice(0, 240)}`,
	);
}

// ---------------------------------------------------------------------------
// Case G (H1 guard): pre-seeded target + unresolved refuse → dest not mutated
// ---------------------------------------------------------------------------
{
	const { catalogRoot, profileName } = writeH1Catalog(
		"unresolved-seed",
		{ LEAK: "${OTHER_UNSET}" },
	);
	const target = path.join(tmpDir, "g-mcp.json");
	const before =
		JSON.stringify(
			{ $schema: "x", mcpServers: { keepme: { command: "echo" } } },
			null,
			2,
		) + "\n";
	writeFileSync(target, before);

	const env = baseEnv();
	delete env.OTHER_UNSET;
	env.HKX_MCP_TEMPLATE_ROOT = catalogRoot;

	const { status } = runApply(["--target", target, profileName], { env });
	const after = readFileSync(target, "utf8");

	check(
		"G: unresolved refuse exits non-zero (pre-seeded)",
		status !== 0 && status !== null,
		`status=${status}`,
	);
	check(
		"G: pre-seeded target not mutated on unresolved refuse",
		after === before,
		`target rewritten to ${JSON.stringify(after).slice(0, 120)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} M4 APPLY-MCP-PROFILE CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
