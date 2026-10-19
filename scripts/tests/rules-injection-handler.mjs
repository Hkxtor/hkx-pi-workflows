#!/usr/bin/env node
/**
 * Event-level tests for the hkx-rules extension handler.
 *
 * Mirrors scripts/tests/hookify-extension-handler.mjs: the real default
 * extension factory is loaded, a fabricated host records the registered
 * handlers, and synthetic `before_agent_start` events drive it. The point is
 * the prompt-injection contract, which pure loader tests cannot see:
 *
 * - the handler mutates `systemPromptOptions.sections` instead of returning a
 *   replacement `systemPrompt` (Pi documents returning `systemPrompt` as a
 *   whole-prompt override that drops the structured sections);
 * - the injected section name is a legal literal that cannot collide with a
 *   built-in section (Pi throws on an illegal name, failing the entire run);
 * - the toggle and an empty rules directory both produce no injection and no
 *   spam.
 *
 * The fixtures sit under a temp HOME so the real ~/.pi/agent/rules/ is never
 * touched.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const selfPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(selfPath), "../..");
const extPath = path.join(root, "extensions", "hkx-rules.ts");
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

/**
 * Built-in section names from Pi's system prompt builder. A custom section with
 * one of these names would be overwritten by the framework, and "preamble" or
 * an illegal identifier throws while the prompt is built.
 */
const BUILTIN_SECTIONS = [
	"preamble",
	"tools",
	"rules",
	"docs",
	"addendum",
	"project_context",
	"skills",
	"cwd",
	"magic_context",
];

const IS_CHILD = process.env.RULESH_EXT_CHILD === "1";

function runInProcess(mod) {
	const { default: extension, RULES_SECTION, RESERVED_SECTIONS } = mod;

	// H1: the extension registers the events the contract needs.
	const handlers = new Map();
	const registeredCommands = new Map();
	extension({
		on(event, handler) {
			handlers.set(event, handler);
		},
		registerCommand(name, options) {
			registeredCommands.set(name, options);
		},
	});
	check("H1 session_start registered", typeof handlers.get("session_start") === "function");
	check("H1 before_agent_start registered", typeof handlers.get("before_agent_start") === "function");
	check("H1 tool_call registered", typeof handlers.get("tool_call") === "function");
	check("H1 turn_end registered", typeof handlers.get("turn_end") === "function");
	check("H1 /hkx-rules command registered", registeredCommands.has("hkx-rules"));

	// H2: the section name is a legal literal that dodges every built-in name.
	check("H2 section name is a string", typeof RULES_SECTION === "string", String(RULES_SECTION));
	check(
		"H2 section name matches the framework regex",
		/^[a-z][a-z0-9_-]*$/.test(RULES_SECTION ?? ""),
		String(RULES_SECTION),
	);
	check(
		"H2 section name is not a built-in",
		!BUILTIN_SECTIONS.includes(RULES_SECTION),
		String(RULES_SECTION),
	);
	check(
		"H2 reserved set covers every built-in section",
		BUILTIN_SECTIONS.every((n) => RESERVED_SECTIONS.has(n)),
		[...RESERVED_SECTIONS].join(","),
	);
	check("H2 built-ins are all legal section names", BUILTIN_SECTIONS.every((n) => /^[a-z][a-z0-9_-]*$/.test(n)));

	// The remaining checks need fixtures under a temp HOME.
	const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-rules-handler-"));
	const rulesHome = path.join(tmpHome, ".pi", "agent", "rules");
	fs.mkdirSync(rulesHome, { recursive: true });
	fs.writeFileSync(
		path.join(rulesHome, "hkx-always.md"),
		"---\ndescription: always-on fixture\n---\n# Always\nALWAYS_BODY_MARKER.\n",
	);
	fs.writeFileSync(
		path.join(rulesHome, "hkx-gated.md"),
		'---\ndescription: gated fixture\nglobs:\n  - "**/*.py"\n---\n# Gated\nGATED_BODY_MARKER.\n',
	);

	const savedHome = process.env.HOME;
	process.env.HOME = tmpHome;

	const notifications = [];
	const ctx = {
		cwd: root,
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};

	return (async () => {
		await handlers.get("session_start")({ type: "session_start" }, ctx);

		// H3: injection goes through structured sections, never a replacement prompt.
		const sections = {};
		const event = {
			type: "before_agent_start",
			messageType: "user",
			prompt: "do the thing",
			systemPrompt: "BASE SYSTEM PROMPT",
			systemPromptOptions: { sections },
		};
		const result = await handlers.get("before_agent_start")(event, ctx);

		check("H3 handler returns no replacement prompt", result?.systemPrompt === undefined, JSON.stringify(result));
		check("H3 injected section present", typeof sections[RULES_SECTION] === "string", JSON.stringify(Object.keys(sections)));
		const body = sections[RULES_SECTION] ?? "";
		check("H3 always-on rule body injected", body.includes("ALWAYS_BODY_MARKER"));
		check("H3 gated rule body withheld", !body.includes("GATED_BODY_MARKER"));
		check("H3 frontmatter not leaked into the prompt", !body.includes("description:"));
		check("H3 no carriage returns in the injected text", !body.includes("\r"));
		check(
			"H3 injection does not clobber built-in sections",
			Object.keys(sections).every((n) => n === RULES_SECTION),
			Object.keys(sections).join(","),
		);

		// H4: idempotent within a session — a second run must not duplicate.
		await handlers.get("before_agent_start")(event, ctx);
		const occurrences = (sections[RULES_SECTION] ?? "").split("ALWAYS_BODY_MARKER").length - 1;
		check("H4 second run does not duplicate the section", occurrences === 1, String(occurrences));

		// H5: no structured sections on the host → documented append fallback.
		const legacy = await handlers.get("before_agent_start")(
			{ type: "before_agent_start", messageType: "user", prompt: "x", systemPrompt: "BASE" },
			ctx,
		);
		check("H5 fallback keeps the base prompt", String(legacy?.systemPrompt ?? "").startsWith("BASE"));
		check("H5 fallback wraps the section", String(legacy?.systemPrompt ?? "").includes("<hkx_rules>"));

		// H6: HKX_RULES=off disables injection entirely.
		process.env.HKX_RULES = "off";
		const offSections = {};
		const offResult = await handlers.get("before_agent_start")(
			{ type: "before_agent_start", messageType: "user", prompt: "x", systemPrompt: "BASE", systemPromptOptions: { sections: offSections } },
			ctx,
		);
		check("H6 toggle off returns undefined", offResult === undefined, JSON.stringify(offResult));
		check("H6 toggle off leaves sections untouched", Object.keys(offSections).length === 0, Object.keys(offSections).join(","));
		delete process.env.HKX_RULES;

		// H7: a HOME with no rules directory injects nothing and does not spam.
		const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-rules-empty-home-"));
		const savedHome2 = process.env.HOME;
		process.env.HOME = emptyHome;
		notifications.length = 0;
		const otherMod = await import(`${pathToFileURL(extPath).href}?empty-home`);
		const otherHandlers = new Map();
		otherMod.default({
			on(event, handler) {
				otherHandlers.set(event, handler);
			},
		});
		const emptyCtx = {
			cwd: root,
			ui: {
				notify(message, level) {
					notifications.push({ message, level });
				},
			},
		};
		await otherHandlers.get("session_start")({ type: "session_start" }, emptyCtx);
		const emptySections = {};
		const emptyResult = await otherHandlers.get("before_agent_start")(
			{ type: "before_agent_start", messageType: "user", prompt: "x", systemPrompt: "BASE", systemPromptOptions: { sections: emptySections } },
			emptyCtx,
		);
		check("H7 missing rules dir injects nothing", emptyResult === undefined && Object.keys(emptySections).length === 0, JSON.stringify(emptySections));
		// Silent by design: Path A installs the extension without the rules tree, so
		// a notification here would greet every Path A session with a non-problem.
		check("H7 missing rules dir notifies nothing", notifications.length === 0, JSON.stringify(notifications));
		process.env.HOME = savedHome2;
		fs.rmSync(emptyHome, { recursive: true, force: true });

		// H8-H11: promotion. A fresh extension instance keeps the counters clean.
		const promoMod = await import(`${pathToFileURL(extPath).href}?promotion`);
		const promoHandlers = new Map();
		promoMod.default({
			on(event, handler) {
				promoHandlers.set(event, handler);
			},
		});
		await promoHandlers.get("session_start")({ type: "session_start" }, ctx);

		// H8: a matching file promotes; an unrelated file does not.
		const noHit = await promoHandlers.get("tool_call")(
			{ type: "tool_call", toolName: "read", input: { path: "README.md" } },
			ctx,
		);
		check("H8 tool_call never blocks", noHit === undefined, JSON.stringify(noHit));
		const noTurn = await promoHandlers.get("turn_end")({ type: "turn_end" }, ctx);
		check("H8 no promotion yields no turn_end injection", noTurn === undefined, JSON.stringify(noTurn));

		await promoHandlers.get("tool_call")({ type: "tool_call", toolName: "read", input: { path: "src/main.py" } }, ctx);
		const turn = await promoHandlers.get("turn_end")({ type: "turn_end" }, ctx);
		check("H9 a matching file produces a turn_end injection", turn !== undefined);
		check("H9 injection asks for one more request", turn?.continue === true, JSON.stringify(turn?.continue));
		check("H9 injection is a custom_message", turn?.entries?.[0]?.type === "custom_message", JSON.stringify(turn?.entries?.[0]?.type));
		check("H9 injection is not displayed", turn?.entries?.[0]?.display === false);
		const noticeContent = String(turn?.entries?.[0]?.content ?? "");
		// The temp HOME holds two fixtures: an always-on rule and a `**\/*.py` gated
		// rule. Reading a .py file must promote the gated one (and only it).
		check("H9 injection carries the promoted rule body", noticeContent.includes("### hkx-gated"), noticeContent.slice(0, 120));
		check("H9 injection carries the promoted rule marker", noticeContent.includes("GATED_BODY_MARKER"));
		check("H9 injection has no frontmatter", !noticeContent.includes("globs:") && !noticeContent.includes("description:"));
		check("H9 injection excludes the always-on rule", !noticeContent.includes("### hkx-always"), noticeContent.slice(0, 120));

		// H10: monotonic — the same rule is never injected twice.
		await promoHandlers.get("tool_call")({ type: "tool_call", toolName: "read", input: { path: "other.py" } }, ctx);
		const secondTurn = await promoHandlers.get("turn_end")({ type: "turn_end" }, ctx);
		check("H10 a second match yields no second injection", secondTurn === undefined, JSON.stringify(secondTurn));

		// H11: promotion survives into the next run's always-on section? It must NOT
		// — promotion travels as a message, and the section stays baseline. This
		// guards against reintroducing the duplicate-body design rejected in M1.
		const afterPromoSections = {};
		await promoHandlers.get("before_agent_start")(
			{ type: "before_agent_start", messageType: "user", prompt: "next", systemPrompt: "BASE", systemPromptOptions: { sections: afterPromoSections } },
			ctx,
		);
		const afterBody = afterPromoSections[mod.RULES_SECTION] ?? "";
		check("H11 the prompt section stays body-of-always-on only", !afterBody.includes("GATED_BODY_MARKER"), afterBody.slice(0, 60));
		check("H11 the always-on rule is still in the section", afterBody.includes("ALWAYS_BODY_MARKER"), afterBody.slice(0, 60));

		// H12: the toggle also gates promotion.
		const offMod = await import(`${pathToFileURL(extPath).href}?promotion-off`);
		const offHandlers = new Map();
		offMod.default({
			on(event, handler) {
				offHandlers.set(event, handler);
			},
		});
		process.env.HKX_RULES = "off";
		await offHandlers.get("session_start")({ type: "session_start" }, ctx);
		await offHandlers.get("tool_call")({ type: "tool_call", toolName: "read", input: { path: "src/main.py" } }, ctx);
		check("H12 toggle off suppresses promotion", (await offHandlers.get("turn_end")({ type: "turn_end" }, ctx)) === undefined);
		delete process.env.HKX_RULES;

		// H13: the cost report reports real numbers for the fixture directory.
		{
			const reportMod = await import(`${pathToFileURL(extPath).href}?report`);
			const reportHandlers = new Map();
			const reportCommands = new Map();
			reportMod.default({
				on(event, handler) {
					reportHandlers.set(event, handler);
				},
				registerCommand(name, options) {
					reportCommands.set(name, options);
				},
			});
			const reportNotes = [];
			const reportCtx = { cwd: root, ui: { notify: (m, l) => reportNotes.push({ m, l }) } };
			await reportHandlers.get("session_start")({ type: "session_start" }, reportCtx);
			await reportCommands.get("hkx-rules").handler("", reportCtx);
			const text = String(reportNotes[0]?.m ?? "");
			check("H13 report mentions the loaded count", /rules: 2 loaded/.test(text), text);
			check("H13 report splits always-on from gated", /1 always-on, 1 gated/.test(text), text);
			check("H13 report lists a token estimate", /~\s*\d+ tokens/.test(text), text);
			check("H13 report names the always-on rule", text.includes("hkx-always"), text);
			check("H13 report names the gated rule", text.includes("hkx-gated"), text);
		}

		process.env.HOME = savedHome === undefined ? tmpHome : savedHome;
		fs.rmSync(tmpHome, { recursive: true, force: true });
	})();
}

function runViaChild() {
	if (IS_CHILD) return null;
	return spawnSync(process.execPath, ["--experimental-strip-types", selfPath], {
		encoding: "utf8",
		env: { ...process.env, RULESH_EXT_CHILD: "1" },
	});
}

let mod = null;
try {
	mod = await import(pathToFileURL(extPath).href);
} catch {
	mod = null;
}

if (mod && typeof mod.default === "function") {
	await runInProcess(mod);
} else {
	const child = runViaChild();
	if (child?.status === 0) {
		console.log("rules-injection-handler: delegated to strip-types child, OK");
		process.exit(0);
	}
	fail.push(
		fs.existsSync(extPath)
			? "extensions/hkx-rules.ts does not export a default extension factory"
			: "extensions/hkx-rules.ts is missing",
	);
}

console.log(`rules-injection-handler: ${pass.length} passed, ${fail.length} failed`);
for (const f of fail) console.error(`  FAIL ${f}`);
if (fail.length) process.exit(1);
console.log("OK");
