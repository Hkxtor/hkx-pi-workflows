/**
 * GateGuard self-match false-positive regression tests.
 *
 * Motivation: `isDestructiveCommand` used to match regex-source literals and
 * quoted mentions of destructive commands (e.g. a node script defining
 * /\brm\s+/), blocking the agent's own meta-commands. The fix masks quoted
 * strings and heredoc bodies before matching, except when the skeleton still
 * contains an eval-invoker (`bash -c`, `node -e`, `psql -c`, `eval`…), in
 * which case the masked fragments are scanned too.
 *
 * Mirrors gateguard-artifacts.mjs: prefers real `--experimental-strip-types`
 * import of the extension; twin predicates are the offline fallback and must
 * stay lockstep with extensions/hkx-gateguard.ts.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Twin predicates (lockstep with extensions/hkx-gateguard.ts)
// ---------------------------------------------------------------------------

const DESTRUCTIVE_PATTERNS = [
	/\brm\s+(-[rfirvRF]*\s+)*(?!\/tmp\/)/,
	/\bgit\s+checkout\s+(-f|--force|--)\s/,
	/\bgit\s+reset\s+--hard/,
	/\bgit\s+clean\s+-[fF]/,
	/\bgit\s+push\s+.*--force/,
	/\bgit\s+branch\s+-[dD]/,
	/\bgit\s+tag\s+-d/,
	/\bgit\s+rebase\s+.*--abort/,
	/\bgit\s+stash\s+drop/,
	/\bdrop\s+(table|database|index)\b/i,
	/\bdelete\s+from\b/i,
	/\btruncate\b/i,
	/\bmkfs\b/,
	/\bdd\s+.*of=/,
	/\bformat\b/,
	/\bkill\s+-9\b/,
	/\bpkill\b/,
	/\bsudo\s+rm\b/,
];

const EVAL_INVOKERS = [
	/\b(?:ba|z)?sh\s+(?:-\w+\s+)*-c\b/,
	/\beval\b/,
	/\bnode\s+(?:-\w+\s+)*-e\b/,
	/\bpython[0-9.]*\s+(?:-\w+\s+)*-c\b/,
	/\bperl\s+(?:-\w+\s+)*-e\b/,
	/\bpsql\s+(?:-\w+\s+)*-c\b/,
];

function matchesDestructive(text) {
	return DESTRUCTIVE_PATTERNS.some((re) => re.test(text));
}

/** Mask quoted spans and heredoc bodies; return { skeleton, fragments }. */
function maskCommandLiterals(command) {
	const fragments = [];
	let text = String(command);

	// Heredocs: <<TAG ... \nTAG (quoted or plain tag, optional `-`).
	text = text.replace(
		/<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n\s*\1(?=\n|$)/g,
		(m, tag, body) => {
			fragments.push(body);
			return "<<MASKED";
		},
	);

	// Quoted spans (single, double, backtick), backslash escapes honored.
	text = text.replace(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g, (m, _q, body) => {
		fragments.push(body);
		return " ";
	});

	return { skeleton: text, fragments };
}

function hasEvalInvoker(skeleton) {
	return EVAL_INVOKERS.some((re) => re.test(skeleton));
}

function isDestructiveCommand(command) {
	if (typeof command !== "string" || !command) return false;
	const { skeleton, fragments } = maskCommandLiterals(command);
	if (matchesDestructive(skeleton)) return true;
	if (hasEvalInvoker(skeleton) && fragments.some(matchesDestructive)) {
		return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

// False positives observed in-session (must NOT be destructive).
const REGEX_SOURCE_SCRIPT =
	"const pats = [[/\\brm\\s+(-[rfirvRF]*\\s+)*/,\"rm\"]," +
	"[/\\bgit\\s+branch\\s+-[dD]/,\"branch -d\"]," +
	"[/\\bgit\\s+reset\\s+--hard/,\"reset\"]]; " +
	"for (const [re, n] of pats) console.log(n, re.source);";

const FALSE_POSITIVE_CASES = [
	[
		"self-match: node -e with regex-source literals (session case #26)",
		`node -e '${REGEX_SOURCE_SCRIPT}'`,
	],
	[
		"self-match: heredoc node script with regex literals (session case #27)",
		`node <<'EOF'\nconst pats = [[/\\brm\\s+/, "rm"], [/\\bpkill\\b/, "pkill"]];\nconsole.log(pats.length);\nEOF`,
	],
	["quoted mention: echo git reset --hard", 'echo "git reset --hard is dangerous"'],
	["quoted mention: grep git reset --hard", 'grep "git reset --hard" scripts/'],
	["quoted mention: echo rm -rf", "echo 'rm -rf build/'"],
	["quoted mention: grep pkill in source", 'grep -n "pkill" extensions/hkx-gateguard.ts'],
	["eval invoker, harmless fragment", "node -e 'console.log(\"hi\")'"],
	["eval invoker, harmless heredoc", "node <<'EOF'\nconsole.log('hi');\nEOF"],
];

// True positives that must remain blocked (anti-over-strip guardrails).
const TRUE_POSITIVE_CASES = [
	["bare rm -rf dir", "rm -rf build/"],
	["bare rm -r dir", "rm -r ./dist"],
	["bare git reset --hard", "git reset --hard HEAD~1"],
	["bare git push --force", "git push origin main --force"],
	["bare git clean -fd", "git clean -fd"],
	["bare drop table", "psql -d app -w -c 'select 1'; drop table users;"],
	["compound tail destructive", "npm run build && rm -rf dist"],
	["masked but eval'd: bash -c rm", "bash -c 'rm -rf build/'"],
	["masked but eval'd: sh -c git", "sh -c 'git reset --hard'"],
	["masked but eval'd: psql -c drop", 'psql -c "drop table users"'],
	["masked but eval'd: eval rm", "eval 'rm -rf /opt/x'"],
];

// ---------------------------------------------------------------------------
// Run against twin predicates (offline fallback)
// ---------------------------------------------------------------------------

for (const [name, cmd] of FALSE_POSITIVE_CASES) {
	check(`twin FP: ${name}`, !isDestructiveCommand(cmd), "twin blocked a benign command");
}
for (const [name, cmd] of TRUE_POSITIVE_CASES) {
	check(`twin TP: ${name}`, isDestructiveCommand(cmd), "twin failed to block");
}

// Sanity: masking helper basics.
{
	const m = maskCommandLiterals("echo \"git reset --hard\" && ls");
	check("mask: quoted content removed from skeleton", !/git\s+reset/.test(m.skeleton));
	check("mask: fragment captured", m.fragments.some((f) => f.includes("git reset --hard")));
}

// ---------------------------------------------------------------------------
// Real extension import via --experimental-strip-types
// ---------------------------------------------------------------------------

{
	const gatePath = path.join(root, "extensions/hkx-gateguard.ts");
	const script = `
import { isDestructiveCommand } from ${JSON.stringify(pathToFileURL(gatePath).href)};

const falsePositives = ${JSON.stringify(FALSE_POSITIVE_CASES)};
const truePositives = ${JSON.stringify(TRUE_POSITIVE_CASES)};

const ok = [];
const bad = [];
for (const [name, cmd] of falsePositives) {
  (isDestructiveCommand(cmd) ? bad : ok).push("FP: " + name);
}
for (const [name, cmd] of truePositives) {
  (isDestructiveCommand(cmd) ? ok : bad).push("TP: " + name);
}
console.log(JSON.stringify({ ok, bad }));
process.exit(bad.length ? 1 : 0);
`;
	const strip = spawnSync(
		process.execPath,
		["--experimental-strip-types", "--input-type=module", "-e", script],
		{ encoding: "utf8", cwd: root },
	);
	check(
		"real: strip-types runnable",
		!/ERR_UNSUPPORTED_ESM_URL_SCHEME/.test(strip.stderr || ""),
		(strip.stderr || "").slice(0, 300),
	);
	// The inline script exits 1 when any real-import check fails, so read the
	// JSON payload from stdout regardless of exit status; only fall back to
	// twins when no payload was produced at all.
	let payload = null;
	try {
		payload = JSON.parse((strip.stdout || "").trim().split("\n").pop());
	} catch {
		payload = null;
	}
	if (payload && Array.isArray(payload.ok) && Array.isArray(payload.bad)) {
		for (const n of payload.ok) check(`real: ${n}`, true);
		for (const n of payload.bad) check(`real: ${n}`, false);
	} else {
		check(
			"real: extension produced results",
			strip.status === 0 || (strip.stdout || "").trim().length > 0,
			`status=${strip.status} stderr=${(strip.stderr || "").slice(0, 200)} ` +
				"(strip-types unavailable; twin results stand)",
		);
	}
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} GATEGUARD-SELFMATCH CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
