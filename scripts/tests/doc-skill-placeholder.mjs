/**
 * MF-8 regression: skills/exa-search/SKILL.md must NOT teach an operator to
 * put a `YOUR_EXA_API_KEY_HERE` literal into .mcp.json env. The install-time
 * `scanServerForRefusal` (MF-6 SSOT) refuses any `YOUR_*_HERE` placeholder
 * template in env, so an operator following the pre-fix doc verbatim would
 * hit `Refusing to write MCP server "exa-web-search": env "EXA_API_KEY"
 * placeholder template in .mcp.json` on the next install-global run.
 *
 * The skill doc must teach the workspace convention instead: env value is
 * a real `${VAR}` reference backed by the operator's environment, paired
 * with the same env-var name referenced requiresEnv (the catalog
 * mcp-configs/mcp-servers.json uses `"EXA_API_KEY": "${EXA_API_KEY}"` + a
 * paired `requiresEnv: ["EXA_API_KEY"]` entry — see line 136 / 139 of
 * mcp-configs/mcp-servers.json).
 *
 * This is a documentation regression test (no JavaScript runtime). It
 * asserts both:
 *   - the SKILL.md no longer shows `YOUR_EXA_API_KEY_HERE` anywhere
 *   - the SKILL.md shows the `EXA_API_KEY` env value as `${EXA_API_KEY}`
 *     (the workspace's secure resolver-compatible form)
 *
 * Tickets: MF-8 / security SV-2 / typescript I1 / doc regression.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillPath = path.resolve(__dirname, "../../skills/exa-search/SKILL.md");

const skill = await fs.readFile(skillPath, "utf8");

const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Case A (MF-8 red root cause): SKILL.md must NOT contain the literal
// placeholder `YOUR_EXA_API_KEY_HERE` (or any `YOUR_*_HERE` form) anywhere.
// Pre-fix: line 34 had `"env": { "EXA_API_KEY": "YOUR_EXA_API_KEY_HERE" }`.
// Post-fix: removed entirely.
// ---------------------------------------------------------------------------
{
	const forbidden = /YOUR_EXA_API_KEY_HERE|YOUR_[A-Z_]+_HERE/;
	const m = skill.match(forbidden);
	check(
		"A: SKILL.md has no YOUR_*_HERE literal placeholder",
		m === null,
		m ? `found ${JSON.stringify(m[0])}` : "",
	);
}

// ---------------------------------------------------------------------------
// Case B (MF-8 green guard): SKILL.md must teach the resolver-compatible
// `${EXA_API_KEY}` reference shape for the env value, not a bare literal.
// ---------------------------------------------------------------------------
{
	const hasRef = /\$\{EXA_API_KEY\}/.test(skill);
	check(
		"B: SKILL.md teaches ${EXA_API_KEY} env reference (resolver-compatible)",
		hasRef,
		"expected env value to use ${EXA_API_KEY} reference, matching mcp-configs/mcp-servers.json convention",
	);
}

// ---------------------------------------------------------------------------
// Case C (MF-8 guard, ephemeral but valuable): no REPLACE_ME / <TAG> form
// in the EXA example block specifically (avoids future regression where
// someone swaps YOUR_*_HERE for another refused form).
// Find the .mcp.json example block by loose scan and assert its env shape.
// ---------------------------------------------------------------------------
{
	const idx = skill.indexOf(`"exa-web-search"`);
	let block = "";
	if (idx !== -1) {
		// grab up to ~next blank line after ```
		const tail = skill.slice(idx, idx + 600);
		const fence = tail.indexOf("```", tail.indexOf("```") + 3);
		block = fence > 0 ? tail.slice(0, fence) : tail.slice(0, 400);
	}
	const badForms = /REPLACE_ME|<\s*[A-Z_]+\s*>/g;
	const m = block.match(badForms);
	check(
		"C: SKILL.md .mcp.json example block has no REPLACE_ME or <TAG>",
		m === null,
		m ? `found ${JSON.stringify(m)}` : "",
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} MF-8 CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
