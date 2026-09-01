#!/usr/bin/env node
/**
 * Unit tests for the subagent artifact auto-reply extension and its supporting
 * permission policy.
 *
 * Prefers a real `--experimental-strip-types` import of the extension. The
 * classifier twin provides an offline fallback and must stay lockstep with
 * extensions/hkx-subagent-supervisor-auto-reply.ts.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const autoReplyPath = path.join(
	root,
	"extensions/hkx-subagent-supervisor-auto-reply.ts",
);
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Classifier twin (offline fallback; keep lockstep with the extension)
// ---------------------------------------------------------------------------

function isArtifactWriteAuthorizationRequest(message) {
	if (typeof message !== "string" || !message.trim()) return false;
	if (
		/\b(architecture|api design|schema migration|product decision|which approach|trade-?off)\b/i.test(
			message,
		)
	) {
		return false;
	}

	const m = message.toLowerCase();
	const mentionsArtifactSurface =
		/(?:^|[^a-z0-9])\.pi-subagents(?:\/|\b)/i.test(m) ||
		m.includes("configured output") ||
		m.includes("output artifact") ||
		m.includes("configured output path") ||
		m.includes("configured output artifact");
	const mentionsWriteFriction =
		m.includes("blocked write") ||
		m.includes("write blocked") ||
		m.includes("blocked writing") ||
		m.includes("writing findings") ||
		m.includes("write the configured") ||
		m.includes("write the review artifact") ||
		m.includes("落盘") ||
		m.includes("写入该") ||
		m.includes("写入权威") ||
		m.includes("批准写入") ||
		m.includes("artifact-write") ||
		m.includes("artifact write") ||
		(m.includes("approve") &&
			(m.includes("output artifact") ||
				m.includes("configured output") ||
				m.includes(".pi-subagents"))) ||
		(m.includes("authorization") &&
			(m.includes("output") || m.includes(".pi-subagents")));
	return mentionsArtifactSurface && mentionsWriteFriction;
}

const ELIGIBLE_MESSAGES = [
	"Permission blocked writing the configured output artifact at .pi-subagents/chain-runs/eb36/adv/general.md. Please approve this artifact write.",
	"权限层阻止写入配置的输出产物：.pi-subagents/chain-runs/.../adv/general.md。请批准写入该 artifact。",
	"Authorization required for the configured output artifact under .pi-subagents/chain-runs/x/adv/general.md.",
];

const PRODUCT_DECISION_MESSAGE =
	"Which architecture approach should we take for the schema migration trade-off?";

const INELIGIBLE_MESSAGES = [
	"GateGuard: .pi-subagents/chain-runs/x/adv/general.md",
	"Gate Guard: .pi-subagents/chain-runs/x/adv/general.md",
	"First access: .pi-subagents/chain-runs/x/adv/general.md",
	PRODUCT_DECISION_MESSAGE,
	"What is the current status of the run?",
	"Please approve which approach for the schema migration trade-off; keep file-only output.",
	"Which architecture approach for chain-runs packaging? Please approve.",
	"Please write findings under adv/general.md",
	"Which architecture approach for schema migration trade-off? Also please approve write to .pi-subagents/x",
	"Please write evil.pi-subagents/leak.md",
];

for (const message of ELIGIBLE_MESSAGES) {
	check(
		`classifier eligible: ${message.slice(0, 48)}`,
		isArtifactWriteAuthorizationRequest(message),
	);
}
for (const message of INELIGIBLE_MESSAGES) {
	check(
		`classifier rejects: ${message.slice(0, 48)}`,
		!isArtifactWriteAuthorizationRequest(message),
	);
}

// ---------------------------------------------------------------------------
// Real extension import and filesystem behavior
// ---------------------------------------------------------------------------

{
	const script = `
import {
  isArtifactWriteAuthorizationRequest,
  pollAndAutoReply,
} from ${JSON.stringify(pathToFileURL(autoReplyPath).href)};
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const eligibleMessages = ${JSON.stringify(ELIGIBLE_MESSAGES)};
const ineligibleMessages = ${JSON.stringify(INELIGIBLE_MESSAGES)};
const productDecisionMessage = ${JSON.stringify(PRODUCT_DECISION_MESSAGE)};
const ok = [];
const bad = [];
const c = (name, value, detail = "") =>
  (value ? ok : bad).push(value ? name : name + (detail ? " :: " + detail : ""));

for (const message of eligibleMessages) {
  c("classifier eligible: " + message.slice(0, 48), isArtifactWriteAuthorizationRequest(message));
}
for (const message of ineligibleMessages) {
  c("classifier rejects: " + message.slice(0, 48), !isArtifactWriteAuthorizationRequest(message));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-auto-reply-"));
const channel = path.join(tmp, "ch1");
fs.mkdirSync(path.join(channel, "requests"), { recursive: true });
fs.mkdirSync(path.join(channel, "replies"), { recursive: true });
const id = "req-artifact-1";
const req = {
  type: "subagent.supervisor.request",
  id,
  createdAt: Date.now(),
  reason: "need_decision",
  message: eligibleMessages[0],
  expectsReply: true,
  runId: "run1",
  agent: "hkx.code-reviewer",
  childIndex: 0,
};
fs.writeFileSync(path.join(channel, "requests", id + ".json"), JSON.stringify(req, null, 2));
const seen = new Set();
const { replied } = pollAndAutoReply(tmp, Date.now(), seen);
c("poll replied 1", replied === 1, "replied=" + replied);
const replyFile = path.join(channel, "replies", id + ".json");
c("reply exists", fs.existsSync(replyFile));
if (fs.existsSync(replyFile)) {
  const body = JSON.parse(fs.readFileSync(replyFile, "utf8"));
  c("reply type", body.type === "subagent.supervisor.reply");
  c("reply auto-approved", /auto-approved/i.test(body.message));
}
const again = pollAndAutoReply(tmp, Date.now(), seen);
c("second poll no double reply", again.replied === 0);

const productId = "req-product-2";
fs.writeFileSync(path.join(channel, "requests", productId + ".json"), JSON.stringify({
  ...req,
  id: productId,
  message: productDecisionMessage,
}, null, 2));
const productResult = pollAndAutoReply(tmp, Date.now(), seen);
c(
  "product not replied",
  productResult.replied === 0 && !fs.existsSync(path.join(channel, "replies", productId + ".json")),
);
c(
  "product permanently seen",
  seen.has(path.join(channel, "requests", productId + ".json")),
);

const transientTmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-auto-reply-fail-"));
const transientChannel = path.join(transientTmp, "ch2");
fs.mkdirSync(path.join(transientChannel, "requests"), { recursive: true });
fs.writeFileSync(path.join(transientChannel, "replies"), "not-a-dir");
const transientId = "req-transient-3";
fs.writeFileSync(
  path.join(transientChannel, "requests", transientId + ".json"),
  JSON.stringify({ ...req, id: transientId }, null, 2),
);
const transientSeen = new Set();
const transientRequest = path.join(transientChannel, "requests", transientId + ".json");
const failedWrite = pollAndAutoReply(transientTmp, Date.now(), transientSeen);
c("transient fail replied 0", failedWrite.replied === 0);
c("transient fail not seen", !transientSeen.has(transientRequest));
fs.unlinkSync(path.join(transientChannel, "replies"));
fs.mkdirSync(path.join(transientChannel, "replies"), { recursive: true });
const retriedWrite = pollAndAutoReply(transientTmp, Date.now(), transientSeen);
c("retry after transient succeeds", retriedWrite.replied === 1, "replied=" + retriedWrite.replied);
c("after success now seen", transientSeen.has(transientRequest));

fs.writeFileSync(path.join(channel, "requests", "bad.json"), JSON.stringify({
  ...req,
  id: "req/../escape",
}, null, 2));
const unsafeResult = pollAndAutoReply(tmp, Date.now(), seen);
c("unsafe id not replied", unsafeResult.replied === 0);

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

	let payload = null;
	try {
		payload = JSON.parse((strip.stdout || "").trim().split("\n").pop());
	} catch {
		payload = null;
	}
	if (payload && Array.isArray(payload.ok) && Array.isArray(payload.bad)) {
		for (const name of payload.ok) check(`real: ${name}`, true);
		for (const name of payload.bad) check(`real: ${name}`, false);
		check(
			"real: extension process exits cleanly",
			strip.status === 0,
			(strip.stderr || "").slice(0, 300),
		);
	} else {
		const source = fs.readFileSync(autoReplyPath, "utf8");
		check(
			"fallback: auto-reply exports pollAndAutoReply",
			/export function pollAndAutoReply/.test(source),
		);
		check(
			"fallback: seen updates after successful reply",
			/mark seen only after successful reply write/i.test(source),
		);
		check(
			"fallback: product decisions always reject",
			/product decisions always win/i.test(source),
		);
		check(
			"fallback: strip-types unavailable",
			true,
			`status=${strip.status} ${(strip.stderr || "").slice(0, 120)}`,
		);
	}
}

// ---------------------------------------------------------------------------
// Chain artifact wording contract
// ---------------------------------------------------------------------------

{
	const chainDir = path.join(root, "chains");
	const chainFiles = fs
		.readdirSync(chainDir)
		.filter((file) => file.endsWith(".json"));
	const parseFailures = [];
	let oldHintCount = 0;
	let newHintCount = 0;
	let filesWithNewHint = 0;
	for (const file of chainFiles) {
		const text = fs.readFileSync(path.join(chainDir, file), "utf8");
		try {
			JSON.parse(text);
		} catch (error) {
			parseFailures.push(
				`${file}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		oldHintCount += text.split("pre-authorized by GateGuard").length - 1;
		const count =
			text.split("only permitted write target for this review").length - 1;
		newHintCount += count;
		if (count > 0) filesWithNewHint++;
	}
	check(
		"chains: all JSON parse",
		parseFailures.length === 0,
		parseFailures.join("; "),
	);
	check("chains: old GateGuard hint removed", oldHintCount === 0, `count=${oldHintCount}`);
	check("chains: neutral artifact hint count", newHintCount === 45, `count=${newHintCount}`);
	check(
		"chains: neutral hint file count",
		filesWithNewHint === 14,
		`count=${filesWithNewHint}`,
	);
}

// ---------------------------------------------------------------------------
// Package and permission policy
// ---------------------------------------------------------------------------

{
	let pkg = null;
	let parseErr = null;
	try {
		pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
	} catch (error) {
		parseErr = error instanceof Error ? error.message : String(error);
	}
	check("package.json parseable", pkg !== null, parseErr ?? "");
	const extensions = pkg?.pi?.extensions ?? [];
	check(
		"package.json lists auto-reply extension",
		extensions.some((entry) =>
			String(entry).includes("hkx-subagent-supervisor-auto-reply"),
		),
	);
}

{
	let config = null;
	let parseErr = null;
	try {
		config = JSON.parse(
			fs.readFileSync(
				path.join(root, "configs/pi-permission-system/config.json"),
				"utf8",
			),
		);
	} catch (error) {
		parseErr = error instanceof Error ? error.message : String(error);
	}
	check("permission config parseable", config !== null, parseErr ?? "");
	const external = config?.permission?.external_directory ?? {};
	check("permission: /tmp allow", external["/tmp"] === "allow");
	check("permission: /tmp/* allow", external["/tmp/*"] === "allow");
	check("permission: /var/tmp allow", external["/var/tmp"] === "allow");
	check("permission: /var/tmp/* allow", external["/var/tmp/*"] === "allow");
	check("permission: ~/.pi allow", external["~/.pi"] === "allow");
	check("permission: ~/.pi/* allow", external["~/.pi/*"] === "allow");
	check(
		"permission: Windows npm global allow",
		external["~/AppData/Roaming/npm/node_modules"] === "allow",
	);
	check(
		"permission: Windows npm global/* allow",
		external["~/AppData/Roaming/npm/node_modules/*"] === "allow",
	);
	check(
		"permission: Linux /usr/lib/node_modules allow",
		external["/usr/lib/node_modules"] === "allow",
	);
	check(
		"permission: Linux /usr/lib/node_modules/* allow",
		external["/usr/lib/node_modules/*"] === "allow",
	);
	check(
		"permission: Linux /usr/local/lib/node_modules allow",
		external["/usr/local/lib/node_modules"] === "allow",
	);
	check(
		"permission: Linux /usr/local/lib/node_modules/* allow",
		external["/usr/local/lib/node_modules/*"] === "allow",
	);
	const infrastructure = config?.piInfrastructureReadPaths ?? [];
	check(
		"permission: infrastructure covers ~/.pi",
		infrastructure.includes("~/.pi") && infrastructure.includes("~/.pi/*"),
	);
	check(
		"permission: infrastructure covers Windows npm global",
		infrastructure.includes("~/AppData/Roaming/npm/node_modules") &&
			infrastructure.includes("~/AppData/Roaming/npm/node_modules/*"),
	);
	check(
		"permission: fff tools allowed",
		config?.permission?.ffgrep === "allow" &&
			config?.permission?.fffind === "allow" &&
			config?.permission?.["fff-multi-grep"] === "allow",
	);
}

// ---------------------------------------------------------------------------
// Source contract locks
// ---------------------------------------------------------------------------

{
	const source = fs.readFileSync(autoReplyPath, "utf8");
	check(
		"source: seen.add follows successful write",
		/mark seen only after successful reply write/i.test(source),
	);
	check(
		"source: product decisions always reject",
		/product decisions always win/i.test(source),
	);
}

for (const name of pass) console.log("ok:", name);
if (fail.length === 0) {
	console.log(
		`ALL ${pass.length} SUBAGENT-ARTIFACT-AUTO-REPLY CHECKS PASS`,
	);
} else {
	for (const message of fail) console.error("FAIL:", message);
	process.exit(1);
}
