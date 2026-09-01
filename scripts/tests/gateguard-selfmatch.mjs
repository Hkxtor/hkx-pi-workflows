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
 * The suite prefers a real `--experimental-strip-types` import of the
 * extension; twin predicates are the offline fallback and must stay lockstep
 * with extensions/hkx-gateguard.ts.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const gatePath = path.join(root, "extensions/hkx-gateguard.ts");
const REMOVED_ARTIFACT_SYMBOLS = [
	"ARTIFACT_" + "DIR_SEGMENT",
	"isSubagent" + "ArtifactPath",
	"isSubagent" + "ArtifactBashWrite",
];
const CURRENT_CONTRACT_FILES = [
	"extensions/hkx-gateguard.ts",
	"skills/gateguard/SKILL.md",
	"docs/architecture.md",
	"docs/conversion-map.md",
	"docs/language-hooks.md",
	"skills/hookify-rules/SKILL.md",
	"extensions/hkx-hookify.ts",
	"agents/conversation-analyzer.md",
];
const STALE_CURRENT_PATTERNS = [
	["fact-forcing gate", /fact-forcing gate/i],
	["pre-edit gatekeeping", /pre-edit \/ destructive-action gatekeeping/i],
	["artifact pre-authorization", /pre-authoriz(?:es|ed)[^\n]*\.pi-subagents/i],
	["GateGuard investigation gate", /GateGuard \(investigation gate\)/i],
	["GateGuard investigation wording", /GateGuard investigation gates?/i],
	["GateGuard-style investigation", /GateGuard-style investigation/i],
	["GateGuard artifact classifier", /artifact-write \/ GateGuard \/ chain-run path/i],
	["GateGuard artifact allowlist", /GateGuard's `?\.pi-subagents\/?`? allowlist/i],
	["approve-and-rephrase", /approve-and-rephrase/i],
];
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
	/\bgit\s+checkout\s+(-f|--force|--)\s/,
	/\bgit\s+reset\s+--hard/,
	/\bgit\s+branch\s+-[dD]/,
	/\bgit\s+tag\s+-d/,
	/\bgit\s+rebase\s+.*--abort/,
	/\bgit\s+stash\s+drop/,
	/\bdrop\s+(table|database|index)\b/i,
	/\bdelete\s+from\b/i,
	/\btruncate\b/i,
	/\bmkfs\b/,
	/\bdd\s+.*of=/,
	/\bkill\s+-9\b/,
	/\bpkill\b/,
];

const GIT_CLEAN_FORCE_PATTERN =
	/\bgit\s+clean\b(?=[^;&|\n]*\s(?:--force|-[a-z]*f[a-z]*)(?=$|[\s;&|]))/i;
const GIT_PUSH_FORCE_PATTERN =
	/\bgit\s+push\b(?=[^;&|\n]*\s(?:--force(?:-[a-z-]+)?(?:=[^\s;&|]+)?|-[a-z]*f[a-z]*)(?=$|[\s;&|]))/i;
const FORMAT_COMMAND_PATTERN =
	/(?:^|[;&|]|\n)\s*(?:sudo\s+)?format(?:\.com)?(?=\s|$)/i;
const RM_INVOCATION_PATTERN = /\brm\s+([^;&|\n]*)/g;
const RM_SHORT_FLAGS = /^-[rfirvRF]+$/;

const EVAL_INVOKERS = [
	/\b(?:ba|z)?sh\s+(?:-\w+\s+)*-c\b/,
	/\beval\b/,
	/\bnode\s+(?:-\w+\s+)*-e\b/,
	/\bpython[0-9.]*\s+(?:-\w+\s+)*-c\b/,
	/\bperl\s+(?:-\w+\s+)*-e\b/,
	/\bpsql\s+(?:-\w+\s+)*-c\b/,
];

function isSafeTmpRmTarget(target) {
	return (
		target.startsWith("/tmp/") &&
		!/(?:^|\/)\.\.(?:\/|$)/.test(target)
	);
}

function matchesDestructiveRm(text) {
	const rmPattern = new RegExp(RM_INVOCATION_PATTERN.source, "g");
	let match;
	while ((match = rmPattern.exec(text)) !== null) {
		const args = match[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
		const targets = [];
		let parsingOptions = true;
		for (const arg of args) {
			if (parsingOptions && arg === "--") {
				parsingOptions = false;
				continue;
			}
			if (parsingOptions && RM_SHORT_FLAGS.test(arg)) continue;
			targets.push(arg);
		}
		if (
			targets.length === 0 ||
			targets.some((target) => !isSafeTmpRmTarget(target))
		) {
			return true;
		}
	}
	return false;
}

function matchesDestructive(text) {
	return (
		matchesDestructiveRm(text) ||
		GIT_CLEAN_FORCE_PATTERN.test(text) ||
		GIT_PUSH_FORCE_PATTERN.test(text) ||
		FORMAT_COMMAND_PATTERN.test(text) ||
		DESTRUCTIVE_PATTERNS.some((re) => re.test(text))
	);
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
	["format option: git log", "git log --format='%H %s' -1"],
	["format option: generic tool", "tool --format json"],
	["format mention outside command position", "echo format C:"],
	["git push without force", "git push origin main"],
	["git clean dry run", "git clean -nd"],
	["tmp rm: no flags", "rm /tmp/example"],
	["tmp rm: recursive", "rm -r /tmp/example"],
	["tmp rm: recursive force", "rm -rf /tmp/example"],
	["tmp rm: option delimiter", "rm -rf -- /tmp/example"],
	["tmp rm: multiple tmp targets", "rm -rf /tmp/example /tmp/other"],
];

// True positives that must remain blocked (anti-over-strip guardrails).
const TRUE_POSITIVE_CASES = [
	["bare rm -rf dir", "rm -rf build/"],
	["bare rm -r dir", "rm -r ./dist"],
	["mixed tmp and project rm targets", "rm -rf /tmp/example build/"],
	["tmp traversal rm target", "rm -rf /tmp/example/../../etc"],
	["bare git reset --hard", "git reset --hard HEAD~1"],
	["bare git push --force", "git push origin main --force"],
	["bare git push --force-with-lease", "git push origin main --force-with-lease"],
	["bare git push -f", "git push -f origin main"],
	["combined git push -fu", "git push -fu origin main"],
	["combined git push -uf", "git push -uf origin main"],
	["compound git push -f", "npm test && git push -f origin main"],
	["bare git clean -fd", "git clean -fd"],
	["bare git clean -xdf", "git clean -xdf"],
	["bare git clean -dfx", "git clean -dfx"],
	["bare git clean --force", "git clean --force -d"],
	["windows format command", "format C:"],
	["leading whitespace format command", "  format C:"],
	["sudo format command", "sudo format C:"],
	["windows format.com command", "format.com C:"],
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
// Source and real-export decoupling contracts
// ---------------------------------------------------------------------------

{
	const source = fs.readFileSync(gatePath, "utf8");
	for (const symbol of REMOVED_ARTIFACT_SYMBOLS) {
		check(
			`source: removed ${symbol}`,
			!source.includes(symbol),
			`${symbol} is still present`,
		);
	}

	const validateSource = fs.readFileSync(
		path.join(root, "scripts/validate.mjs"),
		"utf8",
	);
	for (const relativePath of [
		"scripts/tests/gateguard-selfmatch.mjs",
		"scripts/tests/subagent-artifact-auto-reply.mjs",
	]) {
		const count = validateSource.split(`"${relativePath}"`).length - 1;
		check(
			`source: validate requires ${relativePath}`,
			count === 1,
			`count=${count}`,
		);
	}
	const removedArtifactSuite = "scripts/tests/gateguard-" + "artifacts.mjs";
	check(
		"source: validate omits removed artifact suite",
		!validateSource.includes(removedArtifactSuite),
	);

	for (const relativePath of CURRENT_CONTRACT_FILES) {
		const text = fs.readFileSync(path.join(root, relativePath), "utf8");
		for (const [label, pattern] of STALE_CURRENT_PATTERNS) {
			check(
				`source: ${relativePath} omits ${label}`,
				!pattern.test(text),
				label,
			);
		}
	}

	const skillPath = path.join(root, "skills/gateguard/SKILL.md");
	const skill = fs.readFileSync(skillPath, "utf8");
	const evidenceStart = skill.indexOf("## Evidence");
	const currentBehaviorStart = skill.indexOf("## What The Gate Does");
	check(
		"source: GateGuard skill has bounded Evidence section",
		evidenceStart >= 0 && currentBehaviorStart > evidenceStart,
	);
	if (evidenceStart >= 0 && currentBehaviorStart > evidenceStart) {
		const outsideEvidence =
			skill.slice(0, evidenceStart) + skill.slice(currentBehaviorStart);
		check(
			"source: first-edit history only appears in Evidence",
			!/first[- ]?edit|first-per-file|investigation forcer/i.test(
				outsideEvidence,
			),
		);
	}

	const historicalDeclaration =
		/(?:GateGuard\s*\(create\)|GateGuard notes(?:\s*\(first create\))?|Investigation\s*\(GateGuard\))/i;
	const currentTestPath = fileURLToPath(import.meta.url);
	const historicalDeclarations = [];
	const pendingDirs = ["commands", "extensions", "scripts"].map((dir) =>
		path.join(root, dir),
	);
	while (pendingDirs.length > 0) {
		const dir = pendingDirs.pop();
		if (!dir) continue;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const entryPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				pendingDirs.push(entryPath);
				continue;
			}
			if (entryPath === currentTestPath || !/\.(?:md|mjs|ts)$/.test(entry.name)) {
				continue;
			}
			const text = fs.readFileSync(entryPath, "utf8");
			if (historicalDeclaration.test(text)) {
				historicalDeclarations.push(path.relative(root, entryPath));
			}
		}
	}
	check(
		"source: historical GateGuard declarations removed",
		historicalDeclarations.length === 0,
		historicalDeclarations.join(", "),
	);
}

// ---------------------------------------------------------------------------
// Real extension import via --experimental-strip-types
// ---------------------------------------------------------------------------

{
	const script = `
import * as gate from ${JSON.stringify(pathToFileURL(gatePath).href)};

const { isDestructiveCommand } = gate;
const falsePositives = ${JSON.stringify(FALSE_POSITIVE_CASES)};
const truePositives = ${JSON.stringify(TRUE_POSITIVE_CASES)};

const ok = [];
const bad = [];
const removedArtifactSymbols = ${JSON.stringify(REMOVED_ARTIFACT_SYMBOLS.slice(1))};
for (const symbol of removedArtifactSymbols) {
  (symbol in gate ? bad : ok).push("removed export: " + symbol);
}
for (const [name, cmd] of falsePositives) {
  (isDestructiveCommand(cmd) ? bad : ok).push("FP: " + name);
}
for (const [name, cmd] of truePositives) {
  (isDestructiveCommand(cmd) ? ok : bad).push("TP: " + name);
}

let toolHandler;
gate.default({
  on(event, handler) {
    if (event === "tool_call") toolHandler = handler;
  },
});
if (typeof toolHandler !== "function") {
  bad.push("runtime: tool_call handler registered");
} else {
  const reasons = [];
  for (let i = 0; i < 4; i++) {
    const result = await toolHandler({
      toolName: "bash",
      input: { command: "git reset --hard" },
    });
    reasons.push(result?.reason ?? "");
  }
  const full = reasons[0];
  const condensed = reasons[3];
  (/non-destructive alternative/i.test(full) ? ok : bad).push(
    "runtime: full denial names safe alternative",
  );
  (full.includes("HKX_GATEGUARD=off") ? ok : bad).push(
    "runtime: full denial names disable-restart path",
  );
  (/non-destructive alternative/i.test(condensed) ? ok : bad).push(
    "runtime: condensed denial names safe alternative",
  );
  (condensed.includes("HKX_GATEGUARD=off") ? ok : bad).push(
    "runtime: condensed denial names disable-restart path",
  );
  (!/before retrying|investigate target scope before retrying/i.test(reasons.join("\\n")) ? ok : bad).push(
    "runtime: denials do not imply retry unlock",
  );
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
