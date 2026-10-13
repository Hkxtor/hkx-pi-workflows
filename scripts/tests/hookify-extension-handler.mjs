#!/usr/bin/env node
/**
 * Regression test for Hookify's before_agent_start extension handler.
 *
 * Exercises the default extension factory rather than only the pure prompt
 * evaluator, so the result stays compatible with Pi's CustomMessage contract.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const extPath = path.join(root, "extensions", "hkx-hookify.ts");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-hookify-handler-"));
const projectDir = path.join(tmp, "project");
const projectPiDir = path.join(projectDir, ".pi");
const homeDir = path.join(tmp, "home");
// Second fixture project: a single always-on prompt rule (`pattern: ".*"`), used to
// prove an extension-triggered run is skipped even when a rule would match an
// empty prompt.
const altProjectDir = path.join(tmp, "alt-project");
const altProjectPiDir = path.join(altProjectDir, ".pi");

const pass = [];
const fail = [];

function check(name, condition, detail) {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

try {
	fs.mkdirSync(projectPiDir, { recursive: true });
	fs.mkdirSync(homeDir, { recursive: true });
	fs.mkdirSync(altProjectPiDir, { recursive: true });
	fs.writeFileSync(
		path.join(altProjectPiDir, "hookify.always-prompt.local.md"),
		`---
name: always-warn-on-prompt
enabled: true
event: prompt
action: warn
pattern: ".*"
---
ALWAYS: apply this reminder to every prompt.
`,
	);
	fs.writeFileSync(
		path.join(projectPiDir, "hookify.warn-prompt.local.md"),
		`---
name: warn-force-push-request
enabled: true
event: prompt
action: warn
pattern: "force[- ]push"
---
Prefer non-force push workflows.
`,
	);
	fs.writeFileSync(
		path.join(projectPiDir, "hookify.warn-stop.local.md"),
		`---
name: warn-final-settle
enabled: true
event: stop
action: warn
pattern: ".*"
---
Final settlement reached.
`,
	);

	const childSource = `
import extension from ${JSON.stringify(pathToFileURL(extPath).href)};

const handlers = new Map();
extension({
  on(event, handler) {
    handlers.set(event, handler);
  },
});

const promptHandler = handlers.get("before_agent_start");
if (typeof promptHandler !== "function") {
  throw new Error("before_agent_start handler was not registered");
}
const settledHandler = handlers.get("agent_settled");
if (typeof settledHandler !== "function") {
  throw new Error("agent_settled handler was not registered");
}
if (handlers.has("agent_end")) {
  throw new Error("stop rules must not run at the non-final agent_end boundary");
}

const notifications = [];
const ctx = {
  cwd: process.env.HKX_TEST_PROJECT_DIR,
  ui: {
    notify(message, level) {
      notifications.push({ message, level });
    },
  },
};
const result = await promptHandler(
  {
    type: "before_agent_start",
    prompt: "please force push my branch",
    systemPrompt: "BASE SYSTEM PROMPT",
  },
  ctx,
);
const promptNotifications = [...notifications];
notifications.length = 0;
// Pi 1.2.0 fires before_agent_start for idle sendMessage({ triggerTurn: true })
// runs too, as messageType "custom" with no prompt field. Prompt guardrails target
// user submissions, so a custom run must be skipped without notifications.
const customResult = await promptHandler(
  {
    type: "before_agent_start",
    messageType: "custom",
    message: { customType: "hkx-test", content: "please force push my branch", display: false },
    systemPrompt: "BASE SYSTEM PROMPT",
  },
  ctx,
);
const customNotifications = [...notifications];
notifications.length = 0;
// An explicitly typed user run must keep evaluating prompt rules.
const typedUserResult = await promptHandler(
  {
    type: "before_agent_start",
    messageType: "user",
    prompt: "please force push my branch",
    systemPrompt: "BASE SYSTEM PROMPT",
  },
  ctx,
);
const typedUserNotifications = [...notifications];
notifications.length = 0;
// Second fixture: an always-on prompt rule (pattern ".*") must never reach an
// extension-triggered run. Unguarded code read the absent prompt as "", which the
// pattern matches, and injected the reminder into a run with no user prompt.
const altCtx = {
  cwd: process.env.HKX_TEST_ALT_DIR,
  ui: {
    notify(message, level) {
      notifications.push({ message, level });
    },
  },
};
const alwaysCustomResult = await promptHandler(
  {
    type: "before_agent_start",
    messageType: "custom",
    message: { customType: "hkx-test", content: "unrelated note", display: false },
    systemPrompt: "BASE SYSTEM PROMPT",
  },
  altCtx,
);
const alwaysCustomNotifications = [...notifications];
notifications.length = 0;
// Positive control: the alt fixture is live, so a user run in it does warn.
const alwaysUserResult = await promptHandler(
  {
    type: "before_agent_start",
    messageType: "user",
    prompt: "unrelated request",
    systemPrompt: "BASE SYSTEM PROMPT",
  },
  altCtx,
);
const alwaysUserNotifications = [...notifications];
notifications.length = 0;
const stopResult = await settledHandler({ type: "agent_settled", aborted: false }, ctx);
const stopNotifications = [...notifications];
notifications.length = 0;
const abortedStopResult = await settledHandler({ type: "agent_settled", aborted: true }, ctx);
const abortedStopNotifications = [...notifications];

console.log(
  JSON.stringify({
    result,
    promptNotifications,
    customResult,
    customNotifications,
    typedUserResult,
    typedUserNotifications,
    alwaysCustomResult,
    alwaysCustomNotifications,
    alwaysUserResult,
    alwaysUserNotifications,
    stopResult,
    stopNotifications,
    abortedStopResult,
    abortedStopNotifications,
  }),
);
`;

	const child = spawnSync(
		process.execPath,
		["--experimental-strip-types", "--input-type=module", "--eval", childSource],
		{
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				HOME: homeDir,
				USERPROFILE: homeDir,
				HKX_HOOKIFY: "on",
				HKX_TEST_PROJECT_DIR: projectDir,
				HKX_TEST_ALT_DIR: altProjectDir,
			},
		},
	);

	check(
		"handler process exits successfully",
		child.status === 0,
		`status=${child.status}\nstdout=${child.stdout}\nstderr=${child.stderr}`,
	);

	if (child.status === 0) {
		const line = child.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
		let data;
		try {
			data = JSON.parse(line);
		} catch (error) {
			fail.push(`handler output is JSON :: ${String(error)} :: ${line}`);
		}

		if (data) {
			const message = data.result?.message;
			check(
				"warning handler leaves systemPrompt unchanged",
				data.result?.systemPrompt === undefined,
				JSON.stringify(data.result),
			);
			check(
				"warning handler returns a CustomMessage object",
				typeof message === "object" && message !== null,
				JSON.stringify(message),
			);
			check(
				"warning message uses the Hookify custom type",
				message?.customType === "hkx-hookify",
				JSON.stringify(message),
			);
			check(
				"warning message contains the guardrail marker",
				typeof message?.content === "string" && message.content.includes("WARN:"),
				JSON.stringify(message),
			);
			check(
				"warning message contains the rule body",
				typeof message?.content === "string" &&
					message.content.includes("Prefer non-force push workflows."),
				JSON.stringify(message),
			);
			check(
				"warning message stays hidden from duplicate TUI rendering",
				message?.display === false,
				JSON.stringify(message),
			);
			check(
				"warning handler still emits one UI notification",
				data.promptNotifications?.length === 1 &&
					data.promptNotifications[0]?.level === "warning" &&
					data.promptNotifications[0]?.message?.includes(
						"Prefer non-force push workflows.",
					),
				JSON.stringify(data.promptNotifications),
			);
			check(
				"custom-run before_agent_start is skipped (Pi 1.2.0 messageType union)",
				data.customResult === undefined &&
					data.customNotifications?.length === 0,
				JSON.stringify({
					customResult: data.customResult,
					customNotifications: data.customNotifications,
				}),
			);
			check(
				"explicit user messageType still evaluates prompt rules",
				data.typedUserResult?.message?.content?.includes("WARN:") === true &&
					data.typedUserNotifications?.length === 1,
				JSON.stringify({
					typedUserResult: data.typedUserResult,
					typedUserNotifications: data.typedUserNotifications,
				}),
			);
			check(
				"alt fixture is live: always-on rule warns on a user run",
				data.alwaysUserNotifications?.length === 1 &&
					data.alwaysUserResult?.message?.content?.includes("ALWAYS:") === true,
				JSON.stringify({
					alwaysUserResult: data.alwaysUserResult,
					alwaysUserNotifications: data.alwaysUserNotifications,
				}),
			);
			check(
				"always-on prompt rule never reaches an extension-triggered run",
				data.alwaysCustomResult === undefined &&
					data.alwaysCustomNotifications?.length === 0,
				JSON.stringify({
					alwaysCustomResult: data.alwaysCustomResult,
					alwaysCustomNotifications: data.alwaysCustomNotifications,
				}),
			);
			check(
				"settled handler returns no continuation request",
				data.stopResult === undefined,
				JSON.stringify(data.stopResult),
			);
			check(
				"stop rule notifies exactly once at final settlement",
				data.stopNotifications?.length === 1 &&
					data.stopNotifications[0]?.level === "info" &&
					data.stopNotifications[0]?.message?.includes(
						"Final settlement reached.",
					),
				JSON.stringify(data.stopNotifications),
			);
			check(
				"aborted settlement skips stop rules",
				data.abortedStopResult === undefined &&
					data.abortedStopNotifications?.length === 0,
				JSON.stringify({
					abortedStopResult: data.abortedStopResult,
					abortedStopNotifications: data.abortedStopNotifications,
				}),
			);
		}
	}
} finally {
	fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`hookify-extension-handler: ${pass.length} passed, ${fail.length} failed`);
for (const failure of fail) console.error(`  FAIL ${failure}`);
if (fail.length > 0) process.exit(1);
console.log("OK");
