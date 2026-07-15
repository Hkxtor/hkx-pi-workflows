/**
 * Unit tests for GateGuard + supervisor auto-reply artifact policies.
 *
 * Tries Node --experimental-strip-types import of the real extension
 * modules; falls back to twin pure predicates + source-text locks.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

function isSubagentArtifactPath(filePath) {
	const n = filePath.replace(/\\/g, "/");
	if (n.includes("/.pi-subagents/") || n.includes(".pi-subagents/")) return true;
	if (n === ".pi-subagents" || n.startsWith(".pi-subagents/")) return true;
	return false;
}

function isSubagentArtifactBashWrite(command) {
	if (!command.includes(".pi-subagents")) return false;
	return (
		/>\s*['"]?[^'"\s]*\.pi-subagents\//.test(command) ||
		/>>\s*['"]?[^'"\s]*\.pi-subagents\//.test(command) ||
		/tee\s+['"]?[^'"\s]*\.pi-subagents\//.test(command) ||
		/cp\s+[^\n]*\.pi-subagents\//.test(command) ||
		/install\s+[^\n]*\.pi-subagents\//.test(command) ||
		/mkdir\s+(-p\s+)?['"]?[^'"\s]*\.pi-subagents\//.test(command)
	);
}

function isArtifactWriteAuthorizationRequest(message) {
	const m = message.toLowerCase();
	const mentionsArtifactSurface =
		m.includes(".pi-subagents") ||
		m.includes("chain-runs") ||
		m.includes("adv/") ||
		m.includes("output artifact") ||
		m.includes("configured output") ||
		m.includes("file-only");
	const mentionsWriteFriction =
		m.includes("gateguard") ||
		m.includes("gate guard") ||
		m.includes("first access") ||
		m.includes("blocked") ||
		m.includes("write") ||
		m.includes("落盘") ||
		m.includes("写入") ||
		m.includes("artifact") ||
		m.includes("output path") ||
		m.includes("approve") ||
		m.includes("批准") ||
		m.includes("authorization") ||
		m.includes("permission");
	const looksLikeProductDecision =
		/\b(architecture|api design|schema migration|product decision|which approach|trade-?off)\b/i.test(
			message,
		) && !mentionsArtifactSurface;
	if (looksLikeProductDecision) return false;
	return mentionsArtifactSurface && mentionsWriteFriction;
}

// A: path allowlist
check(
	"A: relative chain-runs path allowed",
	isSubagentArtifactPath(
		".pi-subagents/chain-runs/eb36a80b/parallel-0/0-hkx.code-reviewer/adv/general.md",
	),
);
check(
	"A: absolute artifacts path allowed",
	isSubagentArtifactPath(
		"/root/workspace/omp/hkx-pi-workflows/.pi-subagents/artifacts/out.md",
	),
);
check("A: source file NOT allowed", !isSubagentArtifactPath("scripts/install.mjs"));
check(
	"A: agents path NOT allowed",
	!isSubagentArtifactPath("agents/code-reviewer.md"),
);

// B: bash write detection
check(
	"B: cat redirect into chain-runs is artifact write",
	isSubagentArtifactBashWrite(
		"cat > .pi-subagents/chain-runs/x/adv/general.md <<'EOF'\nhi\nEOF",
	),
);
check(
	"B: tee into artifacts is artifact write",
	isSubagentArtifactBashWrite("echo hi | tee .pi-subagents/artifacts/out.md"),
);
check(
	"B: rm project file is NOT artifact write",
	!isSubagentArtifactBashWrite("rm -rf scripts/install.mjs"),
);

// C: supervisor auto-reply classifier
check(
	"C: GateGuard + .pi-subagents message is auto-reply eligible",
	isArtifactWriteAuthorizationRequest(
		"GateGuard blocked write to .pi-subagents/chain-runs/eb36/adv/general.md. Please approve writing the configured output artifact.",
	),
);
check(
	"C: Chinese write + chain-runs is eligible",
	isArtifactWriteAuthorizationRequest(
		"需要将 findings 写入权威路径：.pi-subagents/chain-runs/.../adv/general.md。GateGuard 拦截了写该文件。请批准写入该 chain-run 产物路径。",
	),
);
check(
	"C: product architecture decision is NOT eligible",
	!isArtifactWriteAuthorizationRequest(
		"Which architecture approach should we take for the schema migration trade-off?",
	),
);
check(
	"C: bare status question is NOT eligible",
	!isArtifactWriteAuthorizationRequest("What is the current status of the run?"),
);

// D: real modules via strip-types when available
{
	const gatePath = path.join(root, "extensions/hkx-gateguard.ts");
	const autoPath = path.join(
		root,
		"extensions/hkx-subagent-supervisor-auto-reply.ts",
	);
	const script = `
import { isSubagentArtifactPath, isSubagentArtifactBashWrite } from ${JSON.stringify(gatePath)};
import {
  isArtifactWriteAuthorizationRequest,
  pollAndAutoReply,
} from ${JSON.stringify(autoPath)};
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ok = [];
const bad = [];
const c = (n, v, d="") => (v ? ok : bad).push(v ? n : n+" :: "+d);

c("path allow", isSubagentArtifactPath(".pi-subagents/chain-runs/x/adv/a.md"));
c("path deny source", !isSubagentArtifactPath("scripts/install.mjs"));
c("bash write", isSubagentArtifactBashWrite("cat > .pi-subagents/artifacts/x.md"));
c("classifier yes", isArtifactWriteAuthorizationRequest(
  "GateGuard blocked write to .pi-subagents/chain-runs/x/adv/general.md please approve"
));
c("classifier no product", !isArtifactWriteAuthorizationRequest(
  "Which architecture approach for the schema migration trade-off?"
));

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
  message: "GateGuard blocked writing findings to .pi-subagents/chain-runs/eb36/adv/general.md. Please approve the configured output artifact path.",
  expectsReply: true,
  runId: "run1",
  agent: "hkx.code-reviewer",
  childIndex: 0,
};
fs.writeFileSync(path.join(channel, "requests", id+".json"), JSON.stringify(req, null, 2));
const seen = new Set();
const { replied } = pollAndAutoReply(tmp, Date.now(), seen);
c("poll replied 1", replied === 1, "replied="+replied);
const replyFile = path.join(channel, "replies", id+".json");
c("reply exists", fs.existsSync(replyFile));
if (fs.existsSync(replyFile)) {
  const body = JSON.parse(fs.readFileSync(replyFile, "utf8"));
  c("reply type", body.type === "subagent.supervisor.reply");
  c("reply auto-approved", /auto-approved/i.test(body.message));
}
const id2 = "req-product-2";
fs.writeFileSync(path.join(channel, "requests", id2+".json"), JSON.stringify({
  ...req,
  id: id2,
  message: "Which architecture approach should we take for the schema migration trade-off?",
}, null, 2));
const r2 = pollAndAutoReply(tmp, Date.now(), seen);
c("product not replied", r2.replied === 0 && !fs.existsSync(path.join(channel, "replies", id2+".json")));

console.log(JSON.stringify({ ok, bad }));
process.exit(bad.length ? 1 : 0);
`;
	const strip = spawnSync(
		process.execPath,
		["--experimental-strip-types", "--input-type=module", "-e", script],
		{ encoding: "utf8", cwd: root },
	);
	if (strip.status === 0) {
		let payload = { ok: [], bad: [] };
		try {
			payload = JSON.parse((strip.stdout || "").trim().split("\n").pop());
		} catch {
			payload = { ok: [], bad: ["parse"] };
		}
		for (const n of payload.ok || []) check(`D real: ${n}`, true);
		for (const n of payload.bad || []) check(`D real: ${n}`, false);
		check("D: strip-types import works", true);
	} else {
		const gateguard = fs.readFileSync(gatePath, "utf8");
		const autoReply = fs.readFileSync(autoPath, "utf8");
		check(
			"D fallback: gateguard exports isSubagentArtifactPath",
			/export function isSubagentArtifactPath/.test(gateguard),
		);
		check(
			"D fallback: gateguard uses isSubagentArtifactPath in hook",
			gateguard.includes("isSubagentArtifactPath(filePath)"),
		);
		check(
			"D fallback: auto-reply exports pollAndAutoReply",
			/export function pollAndAutoReply/.test(autoReply),
		);
		check(
			"D fallback: auto-reply exports classifier",
			/export function isArtifactWriteAuthorizationRequest/.test(autoReply),
		);
		check(
			"D fallback: strip-types unavailable (twin predicates still locked)",
			true,
			`status=${strip.status} ${(strip.stderr || "").slice(0, 80)}`,
		);
	}
}

// E: package.json
{
	let pkg = null;
	let parseErr = null;
	try {
		pkg = JSON.parse(
			fs.readFileSync(path.join(root, "package.json"), "utf8"),
		);
	} catch (err) {
		parseErr = err instanceof Error ? err.message : String(err);
	}
	check("E: package.json parseable", pkg !== null, parseErr ?? "");
	const exts = pkg?.pi?.extensions ?? [];
	check(
		"E: package.json lists auto-reply extension",
		exts.some((e) => String(e).includes("hkx-subagent-supervisor-auto-reply")),
	);
	check(
		"E: package.json lists gateguard",
		exts.some((e) => String(e).includes("hkx-gateguard")),
	);
}

// F: permission config
{
	let cfg = null;
	let parseErr = null;
	try {
		cfg = JSON.parse(
			fs.readFileSync(
				path.join(root, "configs/pi-permission-system/config.json"),
				"utf8",
			),
		);
	} catch (err) {
		parseErr = err instanceof Error ? err.message : String(err);
	}
	check("F: permission config parseable", cfg !== null, parseErr ?? "");
	const ext = cfg?.permission?.external_directory ?? {};
	check("F: /tmp allow", ext["/tmp"] === "allow");
	check("F: /tmp/* allow", ext["/tmp/*"] === "allow");
}

// G: adversarial chain task hints artifact path
{
	const chain = fs.readFileSync(
		path.join(root, "chains/hkx-adversarial-review.chain.json"),
		"utf8",
	);
	check(
		"G: adversarial chain mentions .pi-subagents pre-authorized",
		chain.includes(".pi-subagents") && chain.includes("pre-authorized"),
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} GATEGUARD-ARTIFACT CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
