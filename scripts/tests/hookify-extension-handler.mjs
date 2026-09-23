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

const pass = [];
const fail = [];

function check(name, condition, detail) {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

try {
	fs.mkdirSync(projectPiDir, { recursive: true });
	fs.mkdirSync(homeDir, { recursive: true });
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
const stopResult = await settledHandler({ type: "agent_settled" }, ctx);
const stopNotifications = [...notifications];

console.log(JSON.stringify({ result, promptNotifications, stopResult, stopNotifications }));
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
		}
	}
} finally {
	fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`hookify-extension-handler: ${pass.length} passed, ${fail.length} failed`);
for (const failure of fail) console.error(`  FAIL ${failure}`);
if (fail.length > 0) process.exit(1);
console.log("OK");
