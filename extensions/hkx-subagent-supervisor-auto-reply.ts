/**
 * HKX subagent supervisor auto-reply.
 *
 * When review-only subagents hit GateGuard / permission friction while writing
 * chain artifacts under `.pi-subagents/`, they often escalate via
 * `contact_supervisor` / intercom and detach the foreground chain.
 *
 * This parent-session extension polls the native pi-subagents supervisor
 * channel under tmpdir (pi-subagents-<scope>/supervisor-channels/.../requests)
 * and auto-replies to artifact-write authorization asks so chains do not stall.
 *
 * Scope (deliberately narrow):
 * - Only `need_decision` requests that look like artifact-write / GateGuard /
 *   chain-run path authorization.
 * - Never auto-replies to product/architecture decisions, destructive ops,
 *   or requests that do not mention subagent artifact surfaces.
 *
 * Disable: `HKX_SUPERVISOR_AUTO_REPLY=off`
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type ExtensionUI = {
	notify?: (message: string, level?: "info" | "warning" | "error") => void;
};

type ExtensionContext = {
	ui?: ExtensionUI;
	cwd?: string;
};

type ExtensionAPI = {
	on(
		event: "session_start" | "session_shutdown" | "agent_end",
		handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>,
	): void;
};

type SupervisorRequest = {
	type: "subagent.supervisor.request";
	id: string;
	createdAt: number;
	expiresAt?: number;
	reason: "need_decision" | "interview_request" | "progress_update";
	message: string;
	expectsReply: boolean;
	runId: string;
	agent: string;
	childIndex: number;
};

const POLL_MS = 400;
const REQUESTS_DIR = "requests";
const REPLIES_DIR = "replies";

const AUTO_REPLY_MESSAGE = [
	"Auto-approved by hkx-subagent-supervisor-auto-reply.",
	"",
	"You may write the configured chain output artifact under `.pi-subagents/`",
	"(chain-runs/** and artifacts/**). Do not modify project/source files.",
	"Use the write/edit tool (or a bash write) only to the configured output path,",
	"then finish the review.",
].join("\n");

// ---------------------------------------------------------------------------
// Path helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export function resolveTempScopeId(
	env: NodeJS.ProcessEnv = process.env,
	getuid: (() => number) | undefined = process.getuid?.bind(process),
): string {
	if (typeof getuid === "function") {
		try {
			return `uid-${getuid()}`;
		} catch {
			// fall through
		}
	}
	for (const key of ["USERNAME", "USER", "LOGNAME"] as const) {
		const value = env[key];
		if (value) return `user-${sanitize(value)}`;
	}
	return "user-unknown";
}

function sanitize(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 64);
}

export function supervisorChannelsRoot(
	tmpdir: string = os.tmpdir(),
	env: NodeJS.ProcessEnv = process.env,
): string {
	return path.join(
		tmpdir,
		`pi-subagents-${resolveTempScopeId(env)}`,
		"supervisor-channels",
	);
}

/**
 * True when a supervisor need_decision message is about writing chain
 * artifacts (GateGuard / permission / configured output path), not a real
 * product decision.
 */
export function isArtifactWriteAuthorizationRequest(message: string): boolean {
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
	// Exclude clearly non-artifact product decisions
	const looksLikeProductDecision =
		/\b(architecture|api design|schema migration|product decision|which approach|trade-?off)\b/i.test(
			message,
		) && !mentionsArtifactSurface;
	if (looksLikeProductDecision) return false;
	return mentionsArtifactSurface && mentionsWriteFriction;
}

export function isAutoReplyEnabled(
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	const v = env.HKX_SUPERVISOR_AUTO_REPLY?.toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "disabled";
}

function requestPath(channelDir: string, id: string): string {
	return path.join(channelDir, REQUESTS_DIR, `${id}.json`);
}

function replyPath(channelDir: string, id: string): string {
	return path.join(channelDir, REPLIES_DIR, `${id}.json`);
}

function writeAtomicJson(file: string, value: unknown): void {
	const dir = path.dirname(file);
	fs.mkdirSync(dir, { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
	fs.renameSync(tmp, file);
}

function listRequestFiles(root: string): Array<{ channelDir: string; file: string }> {
	let channelEntries: fs.Dirent[];
	try {
		channelEntries = fs.readdirSync(root, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const files: Array<{ channelDir: string; file: string }> = [];
	for (const entry of channelEntries) {
		if (!entry.isDirectory()) continue;
		const channelDir = path.join(root, entry.name);
		const requestsDir = path.join(channelDir, REQUESTS_DIR);
		let requestEntries: fs.Dirent[];
		try {
			requestEntries = fs.readdirSync(requestsDir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const requestEntry of requestEntries) {
			if (requestEntry.isFile() && requestEntry.name.endsWith(".json")) {
				files.push({
					channelDir,
					file: path.join(requestsDir, requestEntry.name),
				});
			}
		}
	}
	return files;
}

function parseRequest(file: string): SupervisorRequest | undefined {
	try {
		const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<SupervisorRequest>;
		if (parsed.type !== "subagent.supervisor.request") return undefined;
		if (typeof parsed.id !== "string" || !parsed.id) return undefined;
		if (parsed.reason !== "need_decision") return undefined;
		if (!parsed.expectsReply) return undefined;
		if (typeof parsed.message !== "string" || !parsed.message) return undefined;
		return parsed as SupervisorRequest;
	} catch {
		return undefined;
	}
}

/**
 * Process one poll tick. Returns number of auto-replies written.
 * Exported for unit tests (inject root + now).
 */
export function pollAndAutoReply(
	root: string = supervisorChannelsRoot(),
	nowMs: number = Date.now(),
	seen: Set<string> = new Set(),
): { replied: number; skipped: number } {
	let replied = 0;
	let skipped = 0;
	for (const { channelDir, file } of listRequestFiles(root)) {
		if (seen.has(file)) continue;
		seen.add(file);
		const request = parseRequest(file);
		if (!request) {
			skipped++;
			continue;
		}
		if (request.expiresAt !== undefined && request.expiresAt < nowMs) {
			skipped++;
			continue;
		}
		if (!isArtifactWriteAuthorizationRequest(request.message)) {
			skipped++;
			continue;
		}
		// Already replied?
		const dest = replyPath(channelDir, request.id);
		if (fs.existsSync(dest)) {
			skipped++;
			continue;
		}
		writeAtomicJson(dest, {
			type: "subagent.supervisor.reply",
			requestId: request.id,
			createdAt: nowMs,
			message: AUTO_REPLY_MESSAGE,
		});
		// Best-effort: remove request file so native channel does not keep it pending
		try {
			fs.unlinkSync(requestPath(channelDir, request.id));
		} catch {
			// ignore
		}
		replied++;
	}
	return { replied, skipped };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI): void {
	let poller: ReturnType<typeof setInterval> | undefined;
	const seen = new Set<string>();
	let lastNotifyAt = 0;

	const stop = (): void => {
		if (poller) clearInterval(poller);
		poller = undefined;
		seen.clear();
	};

	const tick = (ctx?: ExtensionContext): void => {
		if (!isAutoReplyEnabled()) return;
		try {
			const { replied } = pollAndAutoReply(supervisorChannelsRoot(), Date.now(), seen);
			if (replied > 0 && ctx?.ui?.notify) {
				const now = Date.now();
				// Rate-limit UI noise: at most one notify per 5s
				if (now - lastNotifyAt > 5000) {
					lastNotifyAt = now;
					ctx.ui.notify(
						`Auto-replied to ${replied} subagent artifact-write request(s)`,
						"info",
					);
				}
			}
		} catch {
			// Never break the parent session for auto-reply failures
		}
	};

	pi.on("session_start", (_event, ctx) => {
		if (!isAutoReplyEnabled()) return;
		stop();
		tick(ctx);
		poller = setInterval(() => tick(ctx), POLL_MS);
		poller.unref?.();
	});

	pi.on("session_shutdown", () => {
		stop();
	});

	// Also tick after agent turns so replies land quickly even if poll is delayed
	pi.on("agent_end", (_event, ctx) => {
		tick(ctx);
	});
}
