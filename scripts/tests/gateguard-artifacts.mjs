/**
 * Unit tests for GateGuard + supervisor auto-reply (MF1–MF5).
 *
 * Prefers Node --experimental-strip-types import of the real extension
 * modules. Twin predicates mirror production logic for offline fallback and
 * documentation of expected contracts.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
// Twin predicates (must stay lockstep with extensions/* — MF5 prefers real import)
// ---------------------------------------------------------------------------

function normalizePathSegments(filePath) {
	const n = filePath.replace(/\\/g, "/");
	const isAbs = n.startsWith("/");
	const parts = n.split("/");
	const stack = [];
	for (const part of parts) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (stack.length === 0) return null;
			stack.pop();
			continue;
		}
		stack.push(part);
	}
	const joined = stack.join("/");
	return isAbs ? `/${joined}` : joined;
}

function isDestructiveCommand(command) {
	const destructive = [
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
	return destructive.some((re) => re.test(command));
}

function isSubagentArtifactPath(filePath) {
	if (typeof filePath !== "string" || !filePath.trim()) return false;
	const normalized = normalizePathSegments(filePath);
	if (normalized === null) return false;
	const segments = normalized.split("/").filter((s) => s.length > 0);
	return segments.includes(".pi-subagents");
}

function isSubagentArtifactBashWrite(command) {
	if (typeof command !== "string" || !command.includes(".pi-subagents")) {
		return false;
	}
	if (isDestructiveCommand(command)) return false;
	const artifactPath =
		/(?:^|[\s"'`=])\.pi-subagents\//.test(command) ||
		/\/\.pi-subagents\//.test(command);
	if (!artifactPath) return false;
	return (
		/>\s*['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command) ||
		/>>\s*['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command) ||
		/tee\s+['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command) ||
		/\bcp\s+[^\n]*\/\.pi-subagents\//.test(command) ||
		/\bcp\s+[^\n]*(?:^|[\s"'`])\.pi-subagents\//.test(command) ||
		/\binstall\s+[^\n]*\.pi-subagents\//.test(command) ||
		/\bmkdir\s+(-p\s+)?['"]?(?:[^'"\s]*\/)?\.pi-subagents\//.test(command)
	);
}

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
		m.includes("gateguard") ||
		m.includes("gate guard") ||
		m.includes("first access") ||
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

// ---------------------------------------------------------------------------
// A: path allowlist (MF2)
// ---------------------------------------------------------------------------
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
check(
	"A: source file NOT allowed",
	!isSubagentArtifactPath("scripts/install.mjs"),
);
check(
	"A: agents path NOT allowed",
	!isSubagentArtifactPath("agents/code-reviewer.md"),
);
// MF2 regressions
check(
	"A-MF2: evil.pi-subagents substring NOT allowed",
	!isSubagentArtifactPath("evil.pi-subagents/foo.md"),
);
check(
	"A-MF2: traversal out of artifact tree NOT allowed",
	!isSubagentArtifactPath(".pi-subagents/../scripts/install.mjs"),
);
check(
	"A-MF2: nested .. still under artifact allowed",
	isSubagentArtifactPath(".pi-subagents/chain-runs/../artifacts/out.md"),
);
check(
	"A-MF2: absolute traversal out NOT allowed",
	!isSubagentArtifactPath(
		"/root/workspace/omp/hkx-pi-workflows/.pi-subagents/../scripts/x.ts",
	),
);

// ---------------------------------------------------------------------------
// B: bash write (MF1)
// ---------------------------------------------------------------------------
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
// MF1 regressions
check(
	"B-MF1: compound artifact write + rm is destructive (not artifact-only)",
	isDestructiveCommand(
		"cat > .pi-subagents/artifacts/x.md && rm -rf scripts/",
	),
);
check(
	"B-MF1: compound is NOT classified as artifact bash write",
	!isSubagentArtifactBashWrite(
		"cat > .pi-subagents/artifacts/x.md && rm -rf scripts/",
	),
);
check(
	"B-MF1: compound with tee + git reset --hard blocked",
	!isSubagentArtifactBashWrite(
		"tee .pi-subagents/artifacts/x.md && git reset --hard",
	),
);
check(
	"B-MF2: evil.pi-subagents bash write NOT artifact",
	!isSubagentArtifactBashWrite("cat > evil.pi-subagents/leak.md"),
);

// ---------------------------------------------------------------------------
// C: classifier (MF4)
// ---------------------------------------------------------------------------
check(
	"C: GateGuard + .pi-subagents message is auto-reply eligible",
	isArtifactWriteAuthorizationRequest(
		"GateGuard blocked write to .pi-subagents/chain-runs/eb36/adv/general.md. Please approve writing the configured output artifact.",
	),
);
check(
	"C: Chinese write + .pi-subagents is eligible",
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
	!isArtifactWriteAuthorizationRequest(
		"What is the current status of the run?",
	),
);
// MF4 regressions (adversarial false positives from 9d827ffa)
check(
	"C-MF4: file-only + approve trade-off NOT eligible",
	!isArtifactWriteAuthorizationRequest(
		"Please approve which approach for the schema migration trade-off; keep file-only output.",
	),
);
check(
	"C-MF4: architecture + chain-runs packaging NOT eligible",
	!isArtifactWriteAuthorizationRequest(
		"Which architecture approach for chain-runs packaging? Please approve.",
	),
);
check(
	"C-MF4: bare adv/ + write NOT eligible",
	!isArtifactWriteAuthorizationRequest(
		"Please write findings under adv/general.md",
	),
);
check(
	"C-MF4: product with .pi-subagents co-mention still NOT eligible",
	!isArtifactWriteAuthorizationRequest(
		"Which architecture approach for schema migration trade-off? Also please approve write to .pi-subagents/x",
	),
);

// ---------------------------------------------------------------------------
// D: real modules via strip-types + MF1–MF5 e2e
// ---------------------------------------------------------------------------
{
	const gatePath = path.join(root, "extensions/hkx-gateguard.ts");
	const autoPath = path.join(
		root,
		"extensions/hkx-subagent-supervisor-auto-reply.ts",
	);
	const script = `
import {
  isSubagentArtifactPath,
  isSubagentArtifactBashWrite,
  isDestructiveCommand,
} from ${JSON.stringify(gatePath)};
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

// MF2 path
c("path allow", isSubagentArtifactPath(".pi-subagents/chain-runs/x/adv/a.md"));
c("path deny source", !isSubagentArtifactPath("scripts/install.mjs"));
c("path deny evil substring", !isSubagentArtifactPath("evil.pi-subagents/foo.md"));
c("path deny traversal", !isSubagentArtifactPath(".pi-subagents/../scripts/install.mjs"));

// MF1 bash
c("bash write", isSubagentArtifactBashWrite("cat > .pi-subagents/artifacts/x.md"));
c("bash compound destructive", isDestructiveCommand("cat > .pi-subagents/x.md && rm -rf scripts/"));
c("bash compound not artifact-only", !isSubagentArtifactBashWrite("cat > .pi-subagents/x.md && rm -rf scripts/"));

// MF4 classifier
c("classifier yes", isArtifactWriteAuthorizationRequest(
  "GateGuard blocked writing findings to .pi-subagents/chain-runs/x/adv/general.md please approve the configured output artifact"
));
c("classifier no product", !isArtifactWriteAuthorizationRequest(
  "Which architecture approach for the schema migration trade-off?"
));
c("classifier no product+file-only", !isArtifactWriteAuthorizationRequest(
  "Please approve which approach for the schema migration trade-off; keep file-only output."
));
c("classifier no bare adv", !isArtifactWriteAuthorizationRequest(
  "Please write findings under adv/general.md"
));

// MF3: poll success marks seen; product permanent skip
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
// second poll must not double-reply (seen after success)
const rAgain = pollAndAutoReply(tmp, Date.now(), seen);
c("second poll no double reply", rAgain.replied === 0);

const id2 = "req-product-2";
fs.writeFileSync(path.join(channel, "requests", id2+".json"), JSON.stringify({
  ...req,
  id: id2,
  message: "Which architecture approach should we take for the schema migration trade-off?",
}, null, 2));
const r2 = pollAndAutoReply(tmp, Date.now(), seen);
c("product not replied", r2.replied === 0 && !fs.existsSync(path.join(channel, "replies", id2+".json")));
// product permanently in seen
const reqFile2 = path.join(channel, "requests", id2+".json");
c("product permanently seen", seen.has(reqFile2));

// MF3: transient write failure does not permanently seen — simulate by making replies a file
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-auto-reply-fail-"));
const channel2 = path.join(tmp2, "ch2");
fs.mkdirSync(path.join(channel2, "requests"), { recursive: true });
// Create replies as a FILE so writeAtomicJson mkdir/write fails
fs.writeFileSync(path.join(channel2, "replies"), "not-a-dir");
const id3 = "req-transient-3";
fs.writeFileSync(path.join(channel2, "requests", id3+".json"), JSON.stringify({
  ...req,
  id: id3,
}, null, 2));
const seen3 = new Set();
const reqFile3 = path.join(channel2, "requests", id3+".json");
const r3 = pollAndAutoReply(tmp2, Date.now(), seen3);
c("transient fail replied 0", r3.replied === 0);
c("transient fail NOT in seen (MF3)", !seen3.has(reqFile3));
// Fix replies dir and retry
fs.unlinkSync(path.join(channel2, "replies"));
fs.mkdirSync(path.join(channel2, "replies"), { recursive: true });
const r4 = pollAndAutoReply(tmp2, Date.now(), seen3);
c("retry after transient succeeds", r4.replied === 1, "replied="+r4.replied);
c("after success now seen", seen3.has(reqFile3));

// unsafe request id rejected
const idBad = "req/../escape";
fs.writeFileSync(path.join(channel, "requests", "bad.json"), JSON.stringify({
  ...req,
  id: idBad,
}, null, 2));
const rBad = pollAndAutoReply(tmp, Date.now(), seen);
c("unsafe id not replied", rBad.replied === 0);

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
			"D fallback: MF1 destructive before artifact",
			/MF1: never short-circuit past destructive/.test(gateguard) ||
				gateguard.indexOf("isDestructiveCommand(command)") <
					gateguard.indexOf("isSubagentArtifactBashWrite(command)"),
		);
		check(
			"D fallback: auto-reply exports pollAndAutoReply",
			/export function pollAndAutoReply/.test(autoReply),
		);
		check(
			"D fallback: MF3 seen after success comment",
			/mark seen only after successful reply write/i.test(autoReply),
		);
		check(
			"D fallback: strip-types unavailable",
			true,
			`status=${strip.status} ${(strip.stderr || "").slice(0, 120)}`,
		);
		if (strip.stderr) {
			console.error("strip-types stderr:", strip.stderr.slice(0, 400));
		}
	}
}

// ---------------------------------------------------------------------------
// E: package.json
// ---------------------------------------------------------------------------
{
	let pkg = null;
	let parseErr = null;
	try {
		pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
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

// ---------------------------------------------------------------------------
// F: permission config
// ---------------------------------------------------------------------------
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
	check("F: /var/tmp allow", ext["/var/tmp"] === "allow");
	check("F: /var/tmp/* allow", ext["/var/tmp/*"] === "allow");
}

// ---------------------------------------------------------------------------
// G: chain pre-authorized hints (broader than adversarial only)
// ---------------------------------------------------------------------------
{
	const chainDir = path.join(root, "chains");
	const chains = fs.readdirSync(chainDir).filter((f) => f.endsWith(".json"));
	let withHint = 0;
	for (const f of chains) {
		const text = fs.readFileSync(path.join(chainDir, f), "utf8");
		if (text.includes(".pi-subagents") && text.includes("pre-authorized")) {
			withHint++;
		}
	}
	check(
		"G: adversarial chain mentions .pi-subagents pre-authorized",
		fs
			.readFileSync(
				path.join(chainDir, "hkx-adversarial-review.chain.json"),
				"utf8",
			)
			.includes("pre-authorized"),
	);
	check(
		"G: majority of chains carry pre-authorized hint",
		withHint >= 10,
		`withHint=${withHint} total=${chains.length}`,
	);
}

// ---------------------------------------------------------------------------
// H: source contract locks (MF1 order in hook body)
// ---------------------------------------------------------------------------
{
	const gateguard = fs.readFileSync(
		path.join(root, "extensions/hkx-gateguard.ts"),
		"utf8",
	);
	const bashHookStart = gateguard.indexOf('toolName === "bash"');
	const bashSection = gateguard.slice(bashHookStart, bashHookStart + 800);
	const destIdx = bashSection.indexOf("isDestructiveCommand");
	const artIdx = bashSection.indexOf("isSubagentArtifactBashWrite");
	check(
		"H-MF1: bash hook checks destructive before artifact short-circuit",
		destIdx >= 0 && artIdx >= 0 && destIdx < artIdx,
		`destIdx=${destIdx} artIdx=${artIdx}`,
	);
	const autoReply = fs.readFileSync(
		path.join(root, "extensions/hkx-subagent-supervisor-auto-reply.ts"),
		"utf8",
	);
	check(
		"H-MF3: seen.add after successful write in source",
		/mark seen only after successful reply write/i.test(autoReply),
	);
	check(
		"H-MF4: product always rejects in source",
		/product decisions always win/i.test(autoReply),
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} GATEGUARD-ARTIFACT CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
