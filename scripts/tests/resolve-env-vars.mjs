/**
 * Regression test for MF-1 (resolver charset mismatch).
 *
 * Tickets: SV-1 / silent-failure F2 / typescript m2 / tests T7.
 *
 * The resolver `resolveEnvVarsInServer` previously used the strict regex
 * `/\$\{([A-Z_][A-Z0-9_]*)\}/g` for BOTH substitution AND unresolved-reference
 * detection. Any env-var name outside UPPER_SNAKE (lowercase, hyphenated,
 * dotted) was therefore:
 *   - left literally unchanged in the output value, AND
 *   - NOT added to `missing`/`unresolvedEnv` (same narrow detector charset),
 *   - NOT matched by PLACEHOLDER_PATTERN.
 *
 * Net effect: a reference like `${x-browser-use-api-key}` was written verbatim
 * into the user's mcp.json with exit 0 and zero warnings -- defeating the P1
 * hardening's "refuse to persist unresolved `${VAR}`" invariant.
 *
 * This test reproduces the bug via the same `vm`-based isolation the merge
 * smoke uses, so it does not import the running install path. It must FAIL on
 * the pre-fix code and PASS after MF-1 is closed.
 *
 * Run: node scripts/_smoke/resolve-env-vars.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { readFileSync } from "node:fs";

const src = readFileSync("scripts/apply-mcp-profile.mjs", "utf8");
// Slice from the shared charset / placeholder helpers through resolveEnvVarsInServer.
const startMarkers = [
	"const ENV_VAR_NAME =",
	"const PLACEHOLDER_EXACT",
	"const PLACEHOLDER_PATTERN", // pre-MF-2 marker (compat)
];
let start = -1;
for (const m of startMarkers) {
	start = src.indexOf(m);
	if (start !== -1) break;
}
const end = src.indexOf("async function readJson");
if (start === -1 || end === -1 || end <= start) {
	console.error("FAIL: could not locate resolveEnvVarsInServer slice");
	process.exit(1);
}
const helperCode = src.slice(start, end);

const ctx = {
	console,
	structuredClone,
	Error,
	Object,
	Array,
	Set,
	JSON,
	RegExp,
	Math,
	Promise,
	// process.env is read by the resolver; hand in an isolated copy.
	process: { env: {} },
};
vm.createContext(ctx);
vm.runInContext(
	helperCode + "\nthis.__resolve = resolveEnvVarsInServer;\n",
	ctx,
);
const resolveEnvVarsInServer = ctx.__resolve;
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
	ctx.process.env = { MY_UPCASE: "real-value" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_UPCASE}" } });
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({ env: { K: "${UPPERCASE_MISSING}" } });
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
	ctx.process.env = { x_browser_use_api_key: "lower-real" };
	const r = resolveEnvVarsInServer({
		headers: { "x-key": "${x_browser_use_api_key}" },
	});
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({
		headers: { "x-key": "${x-browser-use-api-key}" },
	});
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
	ctx.process.env = { "x-browser-use-api-key": "real-hyphen-token" };
	const r = resolveEnvVarsInServer({
		headers: { "x-key": "${x-browser-use-api-key}" },
	});
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
	ctx.process.env = {}; // unset
	const r = resolveEnvVarsInServer({
		headers: { "x-browser-use-api-key": "${x-browser-use-api-key}" },
		requiresEnv: ["x-browser-use-api-key"],
	});
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
	ctx.process.env = { FIRECRAWL_API_KEY: "fc-real" };
	const r = resolveEnvVarsInServer({
		env: { FIRECRAWL_API_KEY: "${FIRECRAWL_API_KEY}" },
	});
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
	ctx.process.env = { OK: "v" };
	const r = resolveEnvVarsInServer({
		args: ["--flag", "${MISSING_ARG}", "--ok=${OK}"],
		env: { OK: "${OK}" },
	});
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
	ctx.process.env = { MY_TOKEN: "REPLACE_ME" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_TOKEN}" } });
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
	ctx.process.env = { MY_TOKEN: "YOUR_TOKEN_HERE" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_TOKEN}" } });
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({ env: { K: "YOUR_TOKEN_HERE" } });
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({
		headers: { Auth: "Bearer <REPLACE_ME>" },
	});
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({ env: { K: "prefix YOUR_TOKEN suffix" } });
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
	ctx.process.env = { MY_TOKEN: "sk-live-real-not-a-placeholder" };
	const r = resolveEnvVarsInServer({ env: { K: "${MY_TOKEN}" } });
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({
		command: "npx",
		args: ["-y", "some-mcp", "--token", "${ONLY_IN_ARGS}"],
	});
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({
		command: "npx",
		args: ["--auth", "Bearer <REPLACE_ME>"],
	});
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({ command: "${CMD_BIN}", args: [] });
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
	ctx.process.env = {};
	const r = resolveEnvVarsInServer({
		type: "http",
		url: "https://example.com/mcp?token=${URL_TOKEN}",
	});
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
	ctx.process.env = { K: "v" };
	const r = resolveEnvVarsInServer({
		command: "npx",
		env: { K: "${K}" },
		requiresEnv: ["K"],
		description: "some server",
	});
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
	ctx.process.env = { TOKEN: "tok", URL_TOK: "u" };
	const r = resolveEnvVarsInServer({
		command: "npx",
		args: ["-y", "mcp", "--token", "${TOKEN}"],
		env: { K: "${TOKEN}" },
		headers: { Auth: "Bearer ${TOKEN}" },
		type: "http",
		url: "https://example.com/mcp?k=${URL_TOK}",
		description: "schema-key guard",
		requiresEnv: ["TOKEN", "URL_TOK"],
	});
	const schemaKeys = ["command", "args", "env", "headers", "type", "url", "description"];
	const kept = schemaKeys.filter((k) => Object.hasOwn(r.config, k));
	check(
		"U: schema keys (command/args/env/headers/type/url/description) preserved",
		kept.length === schemaKeys.length,
		`missing=${schemaKeys.filter((k)=>!Object.hasOwn(r.config,k)).join(",")}`,
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
	ctx.process.env = { FILLED: "x" };
	const r = resolveEnvVarsInServer({
		command: "cmd",
		args: ["--ref", "${UNSET_REF}"],
		env: { K: "${FILLED}", P: "YOUR_TOKEN_HERE" },
		requiresEnv: ["UNSET_REF", "FILLED"],
	});
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
