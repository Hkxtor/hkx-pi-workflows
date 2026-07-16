/**
 * HKX subagent supervisor auto-reply.
 *
 * When review-only subagents hit GateGuard / permission friction while writing
 * chain artifacts under `.pi-subagents/`, they often escalate via
 * `contact_supervisor` / intercom and detach the foreground chain.
 *
 * This parent-session extension polls the native pi-subagents supervisor
 * channel under tmpdir (pi-subagents-scope/supervisor-channels/.../requests)
 * and auto-replies to artifact-write authorization asks so chains do not stall.
 *
 * Scope (deliberately narrow — MF4):
 * - Only need_decision requests that look like GateGuard / configured-output
 *   artifact-write authorization with a real `.pi-subagents` path surface.
 * - Product/architecture/trade-off language always rejects, even if the
 *   message also mentions chain-runs or file-only context.
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
/** Safe request id characters for filesystem path segments. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]+$/;

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
 *
 * MF4 rules:
 * 1. Product/architecture/trade-off language always rejects (even with
 *    artifact surface tokens).
 * 2. Surface requires a real `.pi-subagents` path form (not bare `adv/` or
 *    lone `file-only`).
 * 3. Friction requires GateGuard / blocked-write / configured-output
 *    authorization semantics (not bare `write` / `approve` / `permission`).
 */
export function isArtifactWriteAuthorizationRequest(message: string): boolean {
	if (typeof message !== "string" || !message.trim()) return false;

	// MF4: product decisions always win over artifact co-mentions.
	if (
		/\b(architecture|api design|schema migration|product decision|which approach|trade-?off)\b/i.test(
			message,
		)
	) {
		return false;
	}

	const m = message.toLowerCase();

	// Real path surface only (segment boundary).
	// Allow any non-[A-Za-z0-9] char before `.pi-subagents` so fullwidth
	// punctuation (：) and quotes work; still rejects evil.pi-subagents.
	const mentionsArtifactSurface =
		/(?:^|[^a-z0-9])\.pi-subagents(?:\/|\b)/i.test(m) ||
		m.includes("configured output") ||
		m.includes("output artifact") ||
		m.includes("configured output path") ||
		m.includes("configured output artifact");

	// Explicit write-authorization friction (not bare approve/write).
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

function listRequestFiles(
	root: string,
): Array<{ channelDir: string; file: string }> {
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
		const parsed = JSON.parse(
			fs.readFileSync(file, "utf8"),
		) as Partial<SupervisorRequest>;
		if (parsed.type !== "subagent.supervisor.request") return undefined;
		if (typeof parsed.id !== "string" || !parsed.id) return undefined;
		// Reject path-unsafe ids (no traversal via reply/request paths).
		if (!SAFE_REQUEST_ID.test(parsed.id)) return undefined;
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
 *
 * MF3: only permanently mark a file as `seen` after a terminal outcome:
 * - successful reply write
 * - permanent skip (expired, non-eligible product decision, already replied,
 *   unparseable/non-request)
 * Transient write failures leave the file off `seen` so the next poll retries.
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

		const request = parseRequest(file);
		if (!request) {
			// Permanent: not a valid need_decision request.
			seen.add(file);
			skipped++;
			continue;
		}
		if (request.expiresAt !== undefined && request.expiresAt < nowMs) {
			seen.add(file);
			skipped++;
			continue;
		}
		if (!isArtifactWriteAuthorizationRequest(request.message)) {
			// Permanent skip for non-eligible (product decisions, etc.).
			seen.add(file);
			skipped++;
			continue;
		}
		const dest = replyPath(channelDir, request.id);
		if (fs.existsSync(dest)) {
			seen.add(file);
			skipped++;
			continue;
		}
		try {
			writeAtomicJson(dest, {
				type: "subagent.supervisor.reply",
				requestId: request.id,
				createdAt: nowMs,
				message: AUTO_REPLY_MESSAGE,
			});
		} catch {
			// MF3: do not mark seen — retry on next poll.
			skipped++;
			continue;
		}
		// Best-effort: remove request file so native channel does not keep it pending
		try {
			fs.unlinkSync(requestPath(channelDir, request.id));
		} catch {
			// ignore
		}
		// MF3: mark seen only after successful reply write.
		seen.add(file);
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
	let lastErrorNotifyAt = 0;

	const stop = (): void => {
		if (poller) clearInterval(poller);
		poller = undefined;
		seen.clear();
	};

	const tick = (ctx?: ExtensionContext): void => {
		if (!isAutoReplyEnabled()) return;
		try {
			const { replied } = pollAndAutoReply(
				supervisorChannelsRoot(),
				Date.now(),
				seen,
			);
			if (replied > 0 && ctx?.ui?.notify) {
				const now = Date.now();
				if (now - lastNotifyAt > 5000) {
					lastNotifyAt = now;
					ctx.ui.notify(
						`Auto-replied to ${replied} subagent artifact-write request(s)`,
						"info",
					);
				}
			}
		} catch (error) {
			// Never break the parent session; surface rare poll failures at low rate.
			if (ctx?.ui?.notify) {
				const now = Date.now();
				if (now - lastErrorNotifyAt > 30_000) {
					lastErrorNotifyAt = now;
					const msg =
						error instanceof Error ? error.message : String(error);
					ctx.ui.notify(
						`supervisor auto-reply poll failed: ${msg.slice(0, 120)}`,
						"warning",
					);
				}
			}
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

	pi.on("agent_end", (_event, ctx) => {
		tick(ctx);
	});
}
