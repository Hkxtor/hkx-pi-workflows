/**
 * HKX Git Footer — compact single-line status footer.
 *
 * Layout:
 *   <model> - [<thinking>] > [D] <cwd> > ctx: <pct>%/<window>
 *
 * Example:
 *   grok-4.5 - [medium] > [D] ~/workspace/omp > ctx: 8.8%/512K
 *
 * Optional second line: extension status texts from setStatus().
 *
 * Controls:
 * - Auto-enable on session_start (default on).
 * - Disable auto-enable: `HKX_GIT_FOOTER=off`
 * - Toggle during a session: `/hkx-git-footer`
 *
 * Data sources:
 * - model / thinkingLevel / cwd / getContextUsage() from ExtensionContext
 * - branch change still subscribed via FooterDataProvider.onBranchChange for re-render
 *
 * Investigation (GateGuard):
 * 1. Callers/docs: package.json pi.extensions, scripts/validate.mjs required
 *    files, docs/architecture.md + docs/conversion-map.md extension lists.
 * 2. Public surface: default export ExtensionFactory; command `hkx-git-footer`;
 *    env `HKX_GIT_FOOTER`; uses ctx.ui.setFooter.
 * 3. API shape: ctx.model, ctx.thinkingLevel, ctx.cwd, ctx.getContextUsage(),
 *    FooterDataProvider.onBranchChange / getExtensionStatuses.
 * 4. User instruction: compact footer "模型 - [思考强度] > [D] 路径 > ctx".
 * 5. Verify: npm run validate && npm test; manual /hkx-git-footer toggle.
 */

import { isAbsolute, relative, resolve, sep } from "node:path";

type Theme = {
	fg(color: string, text: string): string;
};

type TUI = {
	requestRender(): void;
};

type FooterData = {
	getGitBranch(): string | null;
	getExtensionStatuses(): ReadonlyMap<string, string>;
	onBranchChange(callback: () => void): () => void;
};

type Component = {
	render(width: number): string[];
	invalidate(): void;
	dispose?(): void;
};

type ContextUsage = {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
};

type ExtensionContext = {
	ui: {
		setFooter(
			factory:
				| ((tui: TUI, theme: Theme, footerData: FooterData) => Component)
				| undefined,
		): void;
		notify(message: string, level?: string): void;
	};
	cwd: string;
	model?: { id?: string; reasoning?: boolean } | null;
	thinkingLevel?: string;
	getContextUsage?(): ContextUsage | undefined;
};

type ExtensionRuntime = {
	on(
		event: "session_start",
		handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>,
	): void;
	registerCommand(
		name: string,
		options: {
			description: string;
			handler: (args: string, ctx: ExtensionContext) => void | Promise<void>;
		},
	): void;
};

type ExtensionFactory = (pi: ExtensionRuntime) => void;

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_RE, "");
}

/** Display width ignoring ANSI; treats each code point as width 1. */
function visibleWidth(text: string): number {
	return [...stripAnsi(text)].length;
}

function truncateToWidth(text: string, width: number, ellipsis = "…"): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	if (width <= ellipsis.length) return ellipsis.slice(0, width);

	const target = width - ellipsis.length;
	let out = "";
	let w = 0;
	let i = 0;
	const chars = [...text];
	while (i < chars.length) {
		const ch = chars[i]!;
		// Keep whole ANSI sequences without counting width.
		if (ch === "\x1b") {
			let seq = ch;
			i++;
			while (i < chars.length) {
				seq += chars[i];
				if (/[a-zA-Z]/.test(chars[i]!)) {
					i++;
					break;
				}
				i++;
			}
			out += seq;
			continue;
		}
		if (w + 1 > target) break;
		out += ch;
		w += 1;
		i++;
	}
	return out + ellipsis;
}

function formatTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${Math.round(n / 1_000_000)}M`;
}

/** Collapse $HOME prefix to ~ (same idea as built-in footer). */
function formatCwd(cwd: string, home?: string): string {
	if (!home) return cwd;
	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const relativeToHome = relative(resolvedHome, resolvedCwd);
	const isInsideHome =
		relativeToHome === "" ||
		(relativeToHome !== ".." &&
			!relativeToHome.startsWith(`..${sep}`) &&
			!isAbsolute(relativeToHome));
	if (!isInsideHome) return cwd;
	return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

function contextColor(percent: number | null): "error" | "warning" | "dim" {
	if (percent === null) return "dim";
	if (percent > 90) return "error";
	if (percent > 70) return "warning";
	return "dim";
}

function createStatusFooter(
	ctx: ExtensionContext,
	tui: TUI,
	theme: Theme,
	footerData: FooterData,
): Component {
	// Re-render on branch change even though branch is not shown — keeps
	// footer fresh when cwd/session state shifts with git operations.
	const unsub = footerData.onBranchChange(() => tui.requestRender());

	return {
		dispose: unsub,
		invalidate() {},
		render(width: number): string[] {
			const modelName = ctx.model?.id || "no-model";
			const thinking =
				ctx.model?.reasoning && ctx.thinkingLevel && ctx.thinkingLevel !== "off"
					? ` - [${ctx.thinkingLevel}]`
					: ctx.model?.reasoning && ctx.thinkingLevel === "off"
						? " - [off]"
						: "";

			const home = process.env.HOME || process.env.USERPROFILE;
			const cwdLabel = formatCwd(ctx.cwd || process.cwd(), home);

			const usage = ctx.getContextUsage?.();
			const contextWindow = usage?.contextWindow ?? 0;
			const percent = usage?.percent ?? null;
			const percentLabel = percent === null ? "?" : percent.toFixed(1);
			const windowLabel = contextWindow > 0 ? formatTokens(contextWindow) : "?";
			const ctxLabel = `ctx: ${percentLabel}%/${windowLabel}`;

			const arrow = theme.fg("dim", " > ");
			const left = theme.fg("accent", modelName) + theme.fg("dim", thinking);
			const mid = theme.fg("dim", "[D] ") + theme.fg("muted", cwdLabel);
			const right = theme.fg(contextColor(percent), ctxLabel);

			const line = left + arrow + mid + arrow + right;
			const lines = [truncateToWidth(line, width)];

			const statuses = footerData.getExtensionStatuses();
			if (statuses.size > 0) {
				const statusLine = Array.from(statuses.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([, text]) => text)
					.join(" ");
				lines.push(truncateToWidth(statusLine, width, "…"));
			}

			return lines;
		},
	};
}

function enableFooter(ctx: ExtensionContext): void {
	ctx.ui.setFooter((tui, theme, footerData) =>
		createStatusFooter(ctx, tui, theme, footerData),
	);
}

function disableFooter(ctx: ExtensionContext): void {
	ctx.ui.setFooter(undefined);
}

const autoEnable = process.env.HKX_GIT_FOOTER !== "off";

const extension: ExtensionFactory = (pi) => {
	let enabled = false;

	pi.on("session_start", (_event, ctx) => {
		if (!autoEnable) return;
		enabled = true;
		enableFooter(ctx);
	});

	pi.registerCommand("hkx-git-footer", {
		description: "Toggle compact footer (model - [thinking] > [D] path > ctx)",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				enableFooter(ctx);
				ctx.ui.notify("Compact footer enabled", "info");
			} else {
				disableFooter(ctx);
				ctx.ui.notify("Default footer restored", "info");
			}
		},
	});
};

export default extension;
