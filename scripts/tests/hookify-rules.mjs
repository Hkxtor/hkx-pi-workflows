/**
 * Unit tests for HKX Hookify pure functions (parse / match / evaluate).
 *
 * Prefers Node --experimental-strip-types import of extensions/hkx-hookify.ts.
 * Falls back to a child process with strip-types when in-process import fails.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

const extPath = path.join(root, "extensions/hkx-hookify.ts");
check("extension file exists", fs.existsSync(extPath));

async function loadModule() {
	try {
		const href = pathToFileURL(extPath).href;
		return await import(href);
	} catch {
		return null;
	}
}

async function runInProcess(mod) {
	const {
		parseRuleFile,
		matchRule,
		evaluateToolCall,
		evaluatePrompt,
		evaluateStop,
		listRulePaths,
		loadRulesFromPaths,
		isEnabled,
		extractFilePath,
		extractFileContent,
	} = mod;

	// T1: minimal valid rule, default action warn
	{
		const raw = `---
name: warn-console-log
enabled: true
event: file
pattern: "console\\\\.log\\\\("
---
Avoid console.log in TS.
`;
		const parsed = parseRuleFile(raw, "x.md");
		check("T1 parse ok", parsed.ok === true, JSON.stringify(parsed));
		if (parsed.ok) {
			check("T1 default action warn", parsed.rule.action === "warn");
			check("T1 name", parsed.rule.name === "warn-console-log");
			check("T1 enabled", parsed.rule.enabled === true);
			check("T1 message body", parsed.rule.message.includes("Avoid console"));
		}
	}

	// T1b: CRLF frontmatter
	{
		const raw =
			"---\r\nname: crlf-rule\r\nenabled: true\r\nevent: bash\r\npattern: foo\r\n---\r\nmsg\r\n";
		const parsed = parseRuleFile(raw, "crlf.md");
		check("T1 CRLF parse ok", parsed.ok === true, JSON.stringify(parsed));
	}

	// T1c: missing pattern+conditions fails
	{
		const bad = parseRuleFile(
			`---
name: bad-rule
event: bash
---
no pattern
`,
			"bad.md",
		);
		check("T1 missing pattern fails", bad.ok === false);
	}

	// T1d: invalid event
	{
		const bad = parseRuleFile(
			`---
name: bad-event
event: banana
pattern: x
---
m
`,
			"bad.md",
		);
		check("T1 invalid event fails", bad.ok === false);
	}

	// T1e: non-kebab name fails
	{
		const bad = parseRuleFile(
			`---
name: Not_Kebab
event: bash
pattern: x
---
m
`,
			"bad.md",
		);
		check("T1 non-kebab name fails", bad.ok === false);
	}

	// T2: conditions AND
	{
		const raw = `---
name: warn-env-api-keys
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \\.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
---
Don't put API keys in .env without gitignore check.
`;
		const parsed = parseRuleFile(raw, "cond.md");
		check("T2 conditions parse ok", parsed.ok === true, JSON.stringify(parsed));
		if (parsed.ok) {
			const hit = matchRule(parsed.rule, {
				event: "file",
				fields: {
					file_path: "/app/.env",
					new_text: "API_KEY=secret",
					content: "API_KEY=secret",
					old_text: "",
				},
			});
			check("T2 both conditions hit", hit === true);

			const missPath = matchRule(parsed.rule, {
				event: "file",
				fields: {
					file_path: "/app/config.ts",
					new_text: "API_KEY=secret",
					content: "API_KEY=secret",
					old_text: "",
				},
			});
			check("T2 path miss", missPath === false);

			const missText = matchRule(parsed.rule, {
				event: "file",
				fields: {
					file_path: "/app/.env",
					new_text: "DEBUG=1",
					content: "DEBUG=1",
					old_text: "",
				},
			});
			check("T2 text miss", missText === false);
		}
	}

	// T3: bash rm -rf block
	{
		const raw = `---
name: block-rm-rf
enabled: true
event: bash
action: block
pattern: "rm\\\\s+-rf"
---
Refusing recursive force delete. Confirm path and use a safer cleanup.
`;
		const parsed = parseRuleFile(raw, "rm.md");
		check("T3 parse ok", parsed.ok === true);
		if (parsed.ok) {
			const result = evaluateToolCall(
				[parsed.rule],
				"bash",
				{ command: "rm -rf /tmp/project-build" },
				{ enabled: true },
			);
			check("T3 blocked", result.blocked === true);
			check(
				"T3 reason has body",
				result.blockReasons.some((r) => r.includes("safer cleanup")),
				result.blockReasons.join("|"),
			);
			check("T3 matched name", result.matched.includes("block-rm-rf"));
		}
	}

	// T4: file path .env warn → not blocked
	{
		const raw = `---
name: warn-dotenv
enabled: true
event: file
action: warn
pattern: "\\\\.env$"
---
Editing .env — ensure secrets stay out of git.
`;
		const parsed = parseRuleFile(raw, "env.md");
		check("T4 parse ok", parsed.ok === true);
		if (parsed.ok) {
			const result = evaluateToolCall(
				[parsed.rule],
				"write",
				{ path: "config/.env", content: "FOO=1" },
				{ enabled: true },
			);
			check("T4 matched", result.matched.includes("warn-dotenv"));
			check("T4 not blocked", result.blocked === false);
			check("T4 has warning", result.warnings.length === 1);
		}
	}

	// T5: enabled false
	{
		const raw = `---
name: disabled-rule
enabled: false
event: bash
action: block
pattern: "npm\\s+publish"
---
no publish
`;
		const parsed = parseRuleFile(raw, "dis.md");
		check("T5 parse ok", parsed.ok === true);
		if (parsed.ok) {
			const result = evaluateToolCall(
				[parsed.rule],
				"bash",
				{ command: "npm publish" },
				{ enabled: true },
			);
			check("T5 disabled no match", result.matched.length === 0);
			check("T5 not blocked", result.blocked === false);
		}
	}

	// T6: enabled false short-circuit + isEnabled env
	{
		const raw = `---
name: always-block
enabled: true
event: bash
action: block
pattern: ".*"
---
block all
`;
		const parsed = parseRuleFile(raw, "all.md");
		check("T6 parse ok", parsed.ok === true);
		if (parsed.ok) {
			const result = evaluateToolCall(
				[parsed.rule],
				"bash",
				{ command: "echo hi" },
				{ enabled: false },
			);
			check("T6 off short-circuit", result.blocked === false);
			check("T6 off no match", result.matched.length === 0);
		}

		const prev = process.env.HKX_HOOKIFY;
		try {
			process.env.HKX_HOOKIFY = "off";
			check("T6 isEnabled off", isEnabled() === false);
			process.env.HKX_HOOKIFY = "0";
			check("T6 isEnabled 0", isEnabled() === false);
			// Default-on means unset (not whatever ambient parent env was).
			delete process.env.HKX_HOOKIFY;
			check("T6 isEnabled default on when unset", isEnabled() === true);
		} finally {
			if (prev === undefined) delete process.env.HKX_HOOKIFY;
			else process.env.HKX_HOOKIFY = prev;
		}
	}

	// T7: bad frontmatter
	{
		const bad = parseRuleFile("no fences at all\n", "x.md");
		check("T7 missing fences", bad.ok === false);
	}

	// extract helpers
	{
		check(
			"extract path from path",
			extractFilePath({ path: "a.ts" }) === "a.ts",
		);
		check(
			"extract path from edits",
			extractFilePath({ edits: [{ path: "b.ts", newText: "x" }] }) === "b.ts",
		);
		const content = extractFileContent({
			edits: [{ oldText: "old", newText: "console.log(1)" }],
		});
		check(
			"extract new_text",
			content.new_text.includes("console.log"),
			content.new_text,
		);
	}

	// prompt + stop
	{
		const promptRule = parseRuleFile(
			`---
name: warn-force-push-request
enabled: true
event: prompt
action: warn
pattern: "force[- ]push"
---
Prefer non-force push workflows.
`,
			"p.md",
		);
		check("prompt rule parse", promptRule.ok === true);
		if (promptRule.ok) {
			const r = evaluatePrompt(
				[promptRule.rule],
				"please force push my branch",
				{ enabled: true },
			);
			check("prompt match", r.matched.includes("warn-force-push-request"));
		}

		const stopRule = parseRuleFile(
			`---
name: remind-tests-on-stop
enabled: true
event: stop
action: warn
pattern: ".*"
---
Did you run targeted tests?
`,
			"s.md",
		);
		check("stop rule parse", stopRule.ok === true);
		if (stopRule.ok) {
			const r = evaluateStop([stopRule.rule], { enabled: true });
			check("stop match", r.matched.includes("remind-tests-on-stop"));
			check("stop action warn", stopRule.rule.action === "warn");
		}
	}

	// multi-rule: warn + block
	{
		const w = parseRuleFile(
			`---
name: warn-sudo
event: bash
action: warn
pattern: "sudo"
---
sudo used
`,
			"w.md",
		);
		const b = parseRuleFile(
			`---
name: block-sudo-rm
event: bash
action: block
pattern: "sudo\\\\s+rm"
---
sudo rm blocked
`,
			"b.md",
		);
		check("multi parse", w.ok && b.ok);
		if (w.ok && b.ok) {
			const r = evaluateToolCall(
				[w.rule, b.rule],
				"bash",
				{ command: "sudo rm -rf /" },
				{ enabled: true },
			);
			check("multi blocked", r.blocked === true);
			check("multi both matched", r.matched.length === 2, r.matched.join(","));
			check("multi has warning too", r.warnings.length === 1);
		}
	}

	// listRulePaths + load from temp dirs
	{
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-hookify-"));
		const projPi = path.join(tmp, "proj", ".pi");
		const homeHook = path.join(tmp, "home", ".pi", "agent", "hookify");
		fs.mkdirSync(projPi, { recursive: true });
		fs.mkdirSync(homeHook, { recursive: true });
		fs.writeFileSync(
			path.join(projPi, "hookify.warn-tmp.local.md"),
			`---
name: warn-tmp
enabled: true
event: bash
pattern: "echo"
---
tmp project rule
`,
		);
		fs.writeFileSync(
			path.join(homeHook, "hookify.global-warn.md"),
			`---
name: global-warn
enabled: true
event: file
pattern: "secret"
---
global
`,
		);
		fs.writeFileSync(path.join(projPi, "notes.md"), "nope");
		fs.writeFileSync(path.join(homeHook, "readme.txt"), "nope");

		const listed = listRulePaths(
			path.join(tmp, "proj"),
			path.join(tmp, "home"),
		);
		check(
			"list project rule",
			listed.project.some((p) => p.endsWith("hookify.warn-tmp.local.md")),
			listed.project.join(","),
		);
		check(
			"list global rule",
			listed.global.some((p) => p.endsWith("hookify.global-warn.md")),
			listed.global.join(","),
		);

		const loaded = loadRulesFromPaths([...listed.project, ...listed.global]);
		check(
			"load 2 rules",
			loaded.rules.length === 2,
			String(loaded.rules.length),
		);
		check(
			"load no errors",
			loaded.errors.length === 0,
			JSON.stringify(loaded.errors),
		);

		fs.rmSync(tmp, { recursive: true, force: true });
	}

	// event mismatch
	{
		const raw = parseRuleFile(
			`---
name: bash-only
event: bash
pattern: "rm"
---
x
`,
			"e.md",
		);
		if (raw.ok) {
			const r = evaluateToolCall(
				[raw.rule],
				"write",
				{ path: "rm.ts", content: "rm" },
				{ enabled: true },
			);
			check("event mismatch no hit", r.matched.length === 0);
		}
	}
}

async function runViaChild() {
	const childSrc = `
import * as mod from ${JSON.stringify(pathToFileURL(extPath).href)};
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const pass = [];
const fail = [];
function check(name, cond, detail) {
  if (cond) pass.push(name);
  else fail.push(name + (detail ? " :: " + detail : ""));
}

const {
  parseRuleFile, matchRule, evaluateToolCall, evaluatePrompt, evaluateStop,
  listRulePaths, loadRulesFromPaths, isEnabled, extractFilePath, extractFileContent,
} = mod;

const t1 = parseRuleFile(\`---
name: warn-console-log
enabled: true
event: file
pattern: "console\\\\.log\\\\("
---
Avoid console.log
\`, "x.md");
check("T1 parse ok", t1.ok === true, JSON.stringify(t1));
if (t1.ok) check("T1 action warn", t1.rule.action === "warn");

const crlf = parseRuleFile("---\\r\\nname: crlf-rule\\r\\nevent: bash\\r\\npattern: foo\\r\\n---\\r\\nmsg\\r\\n", "c.md");
check("T1 CRLF", crlf.ok === true);

const missing = parseRuleFile(\`---
name: bad-rule
event: bash
---
x
\`, "b.md");
check("T1 missing pattern", missing.ok === false);

const badEvent = parseRuleFile(\`---
name: bad-event
event: banana
pattern: x
---
m
\`, "b.md");
check("T1 invalid event", badEvent.ok === false);

const t3 = parseRuleFile(\`---
name: block-rm-rf
enabled: true
event: bash
action: block
pattern: "rm\\\\s+-rf"
---
Refusing recursive force delete. safer cleanup
\`, "rm.md");
const r3 = evaluateToolCall([t3.rule], "bash", { command: "rm -rf /tmp/x" }, { enabled: true });
check("T3 blocked", r3.blocked === true);
check("T3 body", r3.blockReasons.some(r => r.includes("safer cleanup")));

const t4 = parseRuleFile(\`---
name: warn-dotenv
event: file
pattern: "\\\\.env$"
---
env
\`, "e.md");
const r4 = evaluateToolCall([t4.rule], "write", { path: ".env", content: "A=1" }, { enabled: true });
check("T4 warn not block", r4.blocked === false && r4.matched.length === 1);

const t5 = parseRuleFile(\`---
name: disabled-rule
enabled: false
event: bash
action: block
pattern: "npm"
---
x
\`, "d.md");
const r5 = evaluateToolCall([t5.rule], "bash", { command: "npm publish" }, { enabled: true });
check("T5 disabled", r5.matched.length === 0);

const r6 = evaluateToolCall([t3.rule], "bash", { command: "rm -rf x" }, { enabled: false });
check("T6 off", r6.blocked === false);

const prev = process.env.HKX_HOOKIFY;
process.env.HKX_HOOKIFY = "off";
check("T6 env off", isEnabled() === false);
if (prev === undefined) delete process.env.HKX_HOOKIFY; else process.env.HKX_HOOKIFY = prev;

const bad = parseRuleFile("nope", "x.md");
check("T7 bad", bad.ok === false);

const cond = parseRuleFile(\`---
name: warn-env-api-keys
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \\\\.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
---
msg
\`, "c.md");
check("T2 parse", cond.ok === true, JSON.stringify(cond));
if (cond.ok) {
  check("T2 hit", matchRule(cond.rule, { event: "file", fields: { file_path: "a.env", new_text: "API_KEY=1", content: "API_KEY=1", old_text: "" } }) === true);
  check("T2 miss", matchRule(cond.rule, { event: "file", fields: { file_path: "a.ts", new_text: "API_KEY=1", content: "API_KEY=1", old_text: "" } }) === false);
}

check("extract", extractFilePath({ path: "z.ts" }) === "z.ts");
check("extract content", extractFileContent({ newText: "hi" }).new_text === "hi");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-hookify-"));
const projPi = path.join(tmp, "proj", ".pi");
const homeHook = path.join(tmp, "home", ".pi", "agent", "hookify");
fs.mkdirSync(projPi, { recursive: true });
fs.mkdirSync(homeHook, { recursive: true });
fs.writeFileSync(path.join(projPi, "hookify.a.local.md"), \`---
name: a-rule
event: bash
pattern: "x"
---
m
\`);
fs.writeFileSync(path.join(homeHook, "hookify.g.md"), \`---
name: g-rule
event: file
pattern: "y"
---
m
\`);
const listed = listRulePaths(path.join(tmp, "proj"), path.join(tmp, "home"));
check("list project", listed.project.length === 1);
check("list global", listed.global.length === 1);
const loaded = loadRulesFromPaths([...listed.project, ...listed.global]);
check("load", loaded.rules.length === 2 && loaded.errors.length === 0);
fs.rmSync(tmp, { recursive: true, force: true });

const pr = parseRuleFile(\`---
name: warn-force
event: prompt
pattern: "force"
---
m
\`, "p.md");
check("prompt", evaluatePrompt([pr.rule], "force push", { enabled: true }).matched.length === 1);

const sr = parseRuleFile(\`---
name: stop-x
event: stop
pattern: ".*"
---
m
\`, "s.md");
check("stop", evaluateStop([sr.rule], { enabled: true }).matched.length === 1);

const w = parseRuleFile(\`---
name: warn-sudo
event: bash
action: warn
pattern: "sudo"
---
sudo used
\`, "w.md");
const b = parseRuleFile(\`---
name: block-sudo-rm
event: bash
action: block
pattern: "sudo\\\\s+rm"
---
sudo rm blocked
\`, "b.md");
const multi = evaluateToolCall([w.rule, b.rule], "bash", { command: "sudo rm -rf /" }, { enabled: true });
check("multi blocked", multi.blocked === true && multi.matched.length === 2);

console.log(JSON.stringify({ pass, fail }));
if (fail.length) process.exit(1);
`;
	const tmp = path.join(os.tmpdir(), `hkx-hookify-assert-${process.pid}.mjs`);
	fs.writeFileSync(tmp, childSrc);
	const r = spawnSync(process.execPath, ["--experimental-strip-types", tmp], {
		encoding: "utf8",
		cwd: root,
	});
	try {
		fs.unlinkSync(tmp);
	} catch {
		// ignore
	}
	if (r.status !== 0) {
		console.error(r.stdout);
		console.error(r.stderr);
		throw new Error(`child assertions failed status=${r.status}`);
	}
	const line = r.stdout.trim().split("\n").filter(Boolean).at(-1);
	const data = JSON.parse(line);
	for (const p of data.pass) pass.push(p);
	for (const f of data.fail) fail.push(f);
}

const mod = await loadModule();
if (mod && typeof mod.parseRuleFile === "function") {
	await runInProcess(mod);
} else {
	await runViaChild();
}

console.log(`hookify-rules: ${pass.length} passed, ${fail.length} failed`);
for (const f of fail) console.error(`  FAIL ${f}`);
if (fail.length) process.exit(1);
console.log("OK");
