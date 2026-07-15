/**
 * Regression test for MF-1 (resolver charset mismatch). Now also covers
 * MF-2 (placeholder false-pos / embedded misses), MF-3 (args/command/url
 * unresolved channels), and MF-5 (catalog metadata leak).
 *
 * The resolver is an ESM export in the shared module scripts/lib/mcp-resolver.mjs
 * so both write paths (apply-mcp-profile.mjs and install.mjs::mergeMcpConfig)
 * enforce the same invariants (MF-6 cross-path SSOT). This test imports it
 * directly — no vm slicing — because the module is side-effect-free and the
 * direct import exercises the actual module semantics.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readFileSync } from "node:fs";
import { resolveEnvVarsInServer } from "../lib/mcp-resolver.mjs";

// Mutable test env; reset per case via TEST_ENV = {...} then passed as { env: TEST_ENV }.
let TEST_ENV = {};

const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Case A (baseline, already worked): UPPER_SNAKE var set -> substituted
// ---------------------------------------------------------------------------
{
	TEST_ENV = { MY_UPCASE: "real-value" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_UPCASE}" } }, { env: TEST_ENV });
	check(
		"A: UPPER_SNAKE set -> substituted",
		r.config.env.K === "real-value",
		`got ${JSON.stringify(r.config.env.K)}`,
	);
	check(
		"A: no missing",
		r.missing.length === 0,
		`missing=${JSON.stringify(r.missing)}`,
	);
	check(
		"A: no placeholders",
		r.placeholders.length === 0,
		`placeholders=${JSON.stringify(r.placeholders)}`,
	);
}

// ---------------------------------------------------------------------------
// Case B (baseline): UPPER_SNAKE var unset -> reported as missing
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({ env: { K: "${UPPERCASE_MISSING}" } }, { env: TEST_ENV });
	check(
		"B: UPPER_SNAKE unset -> literal kept",
		r.config.env.K === "${UPPERCASE_MISSING}",
		`got ${JSON.stringify(r.config.env.K)}`,
	);
	check(
		"B: UPPER_SNAKE unset -> missing[K]",
		r.missing.includes("K"),
		`missing=${JSON.stringify(r.missing)}`,
	);
}

// ---------------------------------------------------------------------------
// Case C (MF-1 red): lowercase var SET -> MUST substitute (was: left literal)
// ---------------------------------------------------------------------------
{
	TEST_ENV = { x_browser_use_api_key: "lower-real" };
	const r = resolveEnvVarsInServer({
		headers: { "x-key": "${x_browser_use_api_key}" },
	}, { env: TEST_ENV });
	check(
		"C: lowercase set -> substituted",
		r.config.headers["x-key"] === "lower-real",
		`got ${JSON.stringify(r.config.headers["x-key"])}`,
	);
	check(
		"C: lowercase set -> no missing",
		r.missing.length === 0,
		`missing=${JSON.stringify(r.missing)}`,
	);
}

// ---------------------------------------------------------------------------
// Case D (MF-1 red): hyphenated var unset -> MUST report missing (was: silent)
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({
		headers: { "x-key": "${x-browser-use-api-key}" },
	}, { env: TEST_ENV });
	check(
		"D: hyphenated unset -> missing[x-key]",
		r.missing.length > 0,
		`missing=${JSON.stringify(r.missing)} (silent leak!)`,
	);
}

// ---------------------------------------------------------------------------
// Case E (MF-1 red): hyphenated var SET -> MUST substitute (was: left literal)
// ---------------------------------------------------------------------------
{
	TEST_ENV = { "x-browser-use-api-key": "real-hyphen-token" };
	const r = resolveEnvVarsInServer({
		headers: { "x-key": "${x-browser-use-api-key}" },
	}, { env: TEST_ENV });
	check(
		"E: hyphenated set -> substituted",
		r.config.headers["x-key"] === "real-hyphen-token",
		`got ${JSON.stringify(r.config.headers["x-key"])}`,
	);
	check(
		"E: hyphenated set -> no missing",
		r.missing.length === 0,
		`missing=${JSON.stringify(r.missing)}`,
	);
}

// ---------------------------------------------------------------------------
// Case F (MF-1 red, catalog-real): the exact `browser-use` header pattern
// from mcp-servers.json:210 must not silently leak with zero signals.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {}; // unset
	const r = resolveEnvVarsInServer({
		headers: { "x-browser-use-api-key": "${x-browser-use-api-key}" },
		requiresEnv: ["x-browser-use-api-key"],
	}, { env: TEST_ENV });
	const leaked = r.config.headers["x-browser-use-api-key"];
	check(
		"F: browser-use unset -> literal kept (NOT substituted)",
		leaked === "${x-browser-use-api-key}",
		`got ${JSON.stringify(leaked)}`,
	);
	check(
		"F: browser-use unset -> detected as unresolved (headers key in missing)",
		r.missing.includes("x-browser-use-api-key"),
		`missing=${JSON.stringify(r.missing)} (silent leak!)`,
	);
}

// ---------------------------------------------------------------------------
// Case G (regression guard): a var the OLD regex matched must still resolve
// ---------------------------------------------------------------------------
{
	TEST_ENV = { FIRECRAWL_API_KEY: "fc-real" };
	const r = resolveEnvVarsInServer({
		env: { FIRECRAWL_API_KEY: "${FIRECRAWL_API_KEY}" },
	}, { env: TEST_ENV });
	check(
		"G: FIRECRAWL (UPPER_SNAKE, multi-segment) still substitutes",
		r.config.env.FIRECRAWL_API_KEY === "fc-real",
		`got ${JSON.stringify(r.config.env.FIRECRAWL_API_KEY)}`,
	);
	check(
		"G: no missing",
		r.missing.length === 0,
		`missing=${JSON.stringify(r.missing)}`,
	);
}

// ---------------------------------------------------------------------------
// Case H (MF-1 red, args channel): unresolved ref in args MUST surface as
// missing too -- the old detector never inspected args at all.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { OK: "v" };
	const r = resolveEnvVarsInServer({
		args: ["--flag", "${MISSING_ARG}", "--ok=${OK}"],
		env: { OK: "${OK}" },
	}, { env: TEST_ENV });
	// args are resolved (good), but detection of unresolved refs in args was missing.
	check(
		"H: args resolved ${OK} substituted",
		r.config.args[2] === "--ok=v",
		`got ${JSON.stringify(r.config.args[2])}`,
	);
	check(
		"H: args MISSING_ARG reported as unresolved",
		r.missing.includes("args[1]"),
		`missing=${JSON.stringify(r.missing)} (args channel unguarded)`,
	);
}

// ---------------------------------------------------------------------------
// Case I (MF-2 red / B2): real secret whose value equals REPLACE_ME must NOT
// be refused as a placeholder. Detection must be pre-substitution on the
// template, not post-substitution on the resolved secret.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { MY_TOKEN: "REPLACE_ME" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_TOKEN}" } }, { env: TEST_ENV });
	check(
		"I: real secret REPLACE_ME substituted",
		r.config.env.K === "REPLACE_ME",
		`got ${JSON.stringify(r.config.env.K)}`,
	);
	check(
		"I: real secret REPLACE_ME not flagged as placeholder",
		r.placeholders.length === 0,
		`placeholders=${JSON.stringify(r.placeholders)} (false-positive!)`,
	);
}

// ---------------------------------------------------------------------------
// Case J (MF-2 red / B2): real secret YOUR_TOKEN_HERE must not be refused.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { MY_TOKEN: "YOUR_TOKEN_HERE" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_TOKEN}" } }, { env: TEST_ENV });
	check(
		"J: real secret YOUR_TOKEN_HERE not flagged",
		r.placeholders.length === 0,
		`placeholders=${JSON.stringify(r.placeholders)} (false-positive!)`,
	);
}

// ---------------------------------------------------------------------------
// Case K (MF-2 red / T8): template literal placeholder must still be detected
// (whole-string YOUR_*_HERE form, pre-substitution).
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({ env: { K: "YOUR_TOKEN_HERE" } }, { env: TEST_ENV });
	check(
		"K: template YOUR_TOKEN_HERE detected as placeholder",
		r.placeholders.includes("K"),
		`placeholders=${JSON.stringify(r.placeholders)}`,
	);
}

// ---------------------------------------------------------------------------
// Case L (MF-2 red / T8): embedded placeholder in template header value
// (e.g. "Bearer <REPLACE_ME>") must be detected. Anchored ^...$ only matched
// whole-string placeholders and missed realistic header forms.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({
		headers: { Auth: "Bearer <REPLACE_ME>" },
	}, { env: TEST_ENV });
	check(
		"L: Bearer <REPLACE_ME> template detected as placeholder",
		r.placeholders.includes("Auth"),
		`placeholders=${JSON.stringify(r.placeholders)} (embedded miss!)`,
	);
}

// ---------------------------------------------------------------------------
// Case M (MF-2 red / T8): "prefix YOUR_TOKEN suffix" template form.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({ env: { K: "prefix YOUR_TOKEN suffix" } }, { env: TEST_ENV });
	check(
		"M: prefix YOUR_TOKEN suffix template detected",
		r.placeholders.includes("K"),
		`placeholders=${JSON.stringify(r.placeholders)} (embedded miss!)`,
	);
}

// ---------------------------------------------------------------------------
// Case N (MF-2 guard): ${VAR} template with real non-placeholder secret OK.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { MY_TOKEN: "sk-live-real-not-a-placeholder" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_TOKEN}" } }, { env: TEST_ENV });
	check(
		"N: real non-placeholder secret not flagged",
		r.placeholders.length === 0 &&
			r.config.env.K === "sk-live-real-not-a-placeholder",
		`placeholders=${JSON.stringify(r.placeholders)} out=${JSON.stringify(r.config.env.K)}`,
	);
}

// ---------------------------------------------------------------------------
// Case O (MF-3 red): unresolved ${VAR} ONLY in args (no env/headers) must
// surface as missing so the write gate refuses to persist literal ${VAR}.
// Catalog supabase uses --project-ref=${SUPABASE_PROJECT_REF} in args.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({
		command: "npx",
		args: ["-y", "some-mcp", "--token", "${ONLY_IN_ARGS}"],
	}, { env: TEST_ENV });
	check(
		"O: args-only unresolved kept literal",
		r.config.args[3] === "${ONLY_IN_ARGS}",
		`got ${JSON.stringify(r.config.args[3])}`,
	);
	check(
		"O: args-only unresolved in missing",
		r.missing.includes("args[3]"),
		`missing=${JSON.stringify(r.missing)}`,
	);
}

// ---------------------------------------------------------------------------
// Case P (MF-3 red): placeholder ONLY in args must surface in placeholders.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({
		command: "npx",
		args: ["--auth", "Bearer <REPLACE_ME>"],
	}, { env: TEST_ENV });
	check(
		"P: args-only placeholder detected",
		r.placeholders.includes("args[1]"),
		`placeholders=${JSON.stringify(r.placeholders)}`,
	);
}

// ---------------------------------------------------------------------------
// Case Q (MF-3 red): unresolved ${VAR} in command must surface as missing.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({ command: "${CMD_BIN}", args: [] }, { env: TEST_ENV });
	check(
		"Q: command unresolved in missing",
		r.missing.includes("command"),
		`missing=${JSON.stringify(r.missing)}`,
	);
	check(
		"Q: command kept literal",
		r.config.command === "${CMD_BIN}",
		`got ${JSON.stringify(r.config.command)}`,
	);
}

// ---------------------------------------------------------------------------
// Case R (MF-3 red): unresolved ${VAR} in url must surface as missing.
// HTTP MCP servers commonly put tokens in url query strings.
// ---------------------------------------------------------------------------
{
	TEST_ENV = {};
	const r = resolveEnvVarsInServer({
		type: "http",
		url: "https://example.com/mcp?token=${URL_TOKEN}",
	}, { env: TEST_ENV });
	check(
		"R: url unresolved kept literal",
		r.config.url === "https://example.com/mcp?token=${URL_TOKEN}",
		`got ${JSON.stringify(r.config.url)}`,
	);
	check(
		"R: url unresolved in missing",
		r.missing.includes("url"),
		`missing=${JSON.stringify(r.missing)} (url channel unguarded — MF-3 residual)`,
	);
}

// ---------------------------------------------------------------------------
// Case S (MF-3 red): error message must not claim only env/headers — must
// mention args/command/url channels. Locks the main() refuse text shape.
// Note: source uses template-literal \${ so the on-disk text contains a
// backslash before ${; match the channel list, not the escape form.
// ---------------------------------------------------------------------------
{
	const srcText = readFileSync("scripts/apply-mcp-profile.mjs", "utf8");
	// Pre-fix message (env/headers only) must be gone.
	const badOnlyEnvHeaders = /Unresolved[^\n]*references in env\/headers:/.test(
		srcText,
	);
	// Channel-complete message must be present.
	const good =
		srcText.includes("references in env/headers/args/command/url:") ||
		/Unresolved[^\n]*references:/.test(srcText);
	check(
		"S: refuse message covers args/command/url channels",
		!badOnlyEnvHeaders && good,
		badOnlyEnvHeaders
			? "still says env/headers only"
			: "missing channel-agnostic refuse message",
	);
}

// ---------------------------------------------------------------------------
// Case T (MF-5 red): catalog-only metadata `requiresEnv` must NOT be
// persisted into the user's mcp.json. Pre-fix structuredClone(server)
// carried it through, so the written config leaked the catalog lint key.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { K: "v" };
	const r = resolveEnvVarsInServer({
		command: "npx",
		env: { K: "${K}" },
		requiresEnv: ["K"],
		description: "some server",
	}, { env: TEST_ENV });
	check(
		"T: requiresEnv stripped from persisted config",
		!Object.hasOwn(r.config, "requiresEnv"),
		`config still has requiresEnv=${JSON.stringify(r.config.requiresEnv)} (MF-5 metadata leak)`,
	);
	check(
		"T: description kept on persisted config",
		Object.hasOwn(r.config, "description"),
		`config lost description=${JSON.stringify(r.config.description)}`,
	);
}

// ---------------------------------------------------------------------------
// Case U (MF-5 red/guard): schema keys survive strip — command/args/env/
// headers/url/type must all be present in the persisted config. The strip
// must remove catalog metadata, not runtime fields.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { TOKEN: "tok", URL_TOK: "u" };
	const r = resolveEnvVarsInServer({
		command: "npx",
		args: ["-y", "mcp", "--token", "${TOKEN}"],
		env: { K: "${TOKEN}" },
		headers: { Auth: "Bearer ${TOKEN}" },
		type: "http",
		url: "https://example.com/mcp?k=${URL_TOK}",
		description: "schema-key guard",
		requiresEnv: ["TOKEN", "URL_TOK"],
	}, { env: TEST_ENV });
	const schemaKeys = [
		"command",
		"args",
		"env",
		"headers",
		"type",
		"url",
		"description",
	];
	const kept = schemaKeys.filter((k) => Object.hasOwn(r.config, k));
	check(
		"U: schema keys (command/args/env/headers/type/url/description) preserved",
		kept.length === schemaKeys.length,
		`missing=${schemaKeys.filter((k) => !Object.hasOwn(r.config, k)).join(",")}`,
	);
	check(
		"U: requiresEnv stripped even with multiple schema keys",
		!Object.hasOwn(r.config, "requiresEnv"),
		`config still has requiresEnv=${JSON.stringify(r.config.requiresEnv)}`,
	);
}

// ---------------------------------------------------------------------------
// Case V (MF-5 guard): the resolveEnvVarsInServer exposed resolve metadata
// (`missing`, `placeholders`) is still accurate after the strip — stripping
// requiresEnv must not swallow detection facts. Use the catalog-supabase
// shape: args has an unresolved ref and env carries a placeholder template.
// ---------------------------------------------------------------------------
{
	TEST_ENV = { FILLED: "x" };
	const r = resolveEnvVarsInServer({
		command: "cmd",
		args: ["--ref", "${UNSET_REF}"],
		env: { K: "${FILLED}", P: "YOUR_TOKEN_HERE" },
		requiresEnv: ["UNSET_REF", "FILLED"],
	}, { env: TEST_ENV });
	check(
		"V: strip does not swallow missing facts",
		r.missing.includes("args[1]"),
		`missing=${JSON.stringify(r.missing)}`,
	);
	check(
		"V: strip does not swallow placeholder facts",
		r.placeholders.includes("P"),
		`placeholders=${JSON.stringify(r.placeholders)}`,
	);
	check(
		"V: strip removes requiresEnv regardless of missing/placeholder状态",
		!Object.hasOwn(r.config, "requiresEnv"),
		`config still has requiresEnv=${JSON.stringify(r.config.requiresEnv)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} RESOLVE-ENV-VARS CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
