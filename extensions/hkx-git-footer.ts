/**
 * HKX Git Footer — show the current git branch in a custom TUI footer.
 *
 * Pi's built-in footer already appends `(branch)` after the cwd. This extension
 * replaces the footer with a git-first layout: branch on its own line (accent),
 * then token/model stats, then any extension status texts from setStatus().
 *
 * Controls:
 * - Auto-enable on session_start (default on).
 * - Disable auto-enable: `HKX_GIT_FOOTER=off`
 * - Toggle during a session: `/hkx-git-footer`
 *
 * Branch updates come from FooterDataProvider.onBranchChange (HEAD watcher).
 *
 * Investigation (GateGuard):
 * 1. Callers/docs: package.json pi.extensions, scripts/validate.mjs required
 *    files, docs/architecture.md + docs/conversion-map.md extension lists.
 * 2. Public surface: default export ExtensionFactory; command `hkx-git-footer`;
 *    env `HKX_GIT_FOOTER`; uses ctx.ui.setFooter / FooterData.getGitBranch.
 * 3. API shape: FooterDataProvider.getGitBranch() → string | null ("detached"
 *    when detached HEAD); onBranchChange returns unsubscribe.
 * 4. User instruction: "加 footer 显示 git" after TUI customization Q&A.
 * 5. Verify: npm run validate && npm test; manual /hkx-git-footer toggle.
 */

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

type SessionEntry = {
	type: string;
	message?: {
		role?: string;
		usage?: {
			input?: number;
			output?: number;
			cost?: { total?: number };
		};
	};
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
	model?: { id?: string } | null;
	sessionManager?: {
		getBranch(): SessionEntry[];
	};
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
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}

function usageFromSession(ctx: ExtensionContext): {
	input: number;
	output: number;
	cost: number;
} {
	let input = 0;
	let output = 0;
	let cost = 0;
	const branch = ctx.sessionManager?.getBranch?.() ?? [];
	for (const entry of branch) {
		if (entry.type === "message" && entry.message?.role === "assistant") {
			const usage = entry.message.usage;
			input += usage?.input ?? 0;
			output += usage?.output ?? 0;
			cost += usage?.cost?.total ?? 0;
		}
	}
	return { input, output, cost };
}

function createGitFooter(
	ctx: ExtensionContext,
	tui: TUI,
	theme: Theme,
	footerData: FooterData,
): Component {
	const unsub = footerData.onBranchChange(() => tui.requestRender());

	return {
		dispose: unsub,
		invalidate() {},
		render(width: number): string[] {
			const branch = footerData.getGitBranch();
			const branchLabel =
				branch === null
					? "no git"
					: branch === "detached"
						? "detached HEAD"
						: branch;

			const branchColor =
				branch === null
					? "muted"
					: branch === "detached"
						? "warning"
						: "accent";
			const branchLine = truncateToWidth(
				theme.fg(branchColor, `⎇ ${branchLabel}`),
				width,
			);

			const { input, output, cost } = usageFromSession(ctx);
			const statsParts: string[] = [];
			if (input) statsParts.push(`↑${formatTokens(input)}`);
			if (output) statsParts.push(`↓${formatTokens(output)}`);
			if (cost) statsParts.push(`$${cost.toFixed(3)}`);
			const left = theme.fg(
				"dim",
				statsParts.length > 0 ? statsParts.join(" ") : "—",
			);
			const right = theme.fg("dim", ctx.model?.id || "no-model");

			const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
			const statsLine = truncateToWidth(left + " ".repeat(gap) + right, width);

			const lines = [branchLine, statsLine];

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

function enableGitFooter(ctx: ExtensionContext): void {
	ctx.ui.setFooter((tui, theme, footerData) =>
		createGitFooter(ctx, tui, theme, footerData),
	);
}

function disableGitFooter(ctx: ExtensionContext): void {
	ctx.ui.setFooter(undefined);
}

const autoEnable = process.env.HKX_GIT_FOOTER !== "off";

const extension: ExtensionFactory = (pi) => {
	let enabled = false;

	pi.on("session_start", (_event, ctx) => {
		if (!autoEnable) return;
		enabled = true;
		enableGitFooter(ctx);
	});

	pi.registerCommand("hkx-git-footer", {
		description: "Toggle git-first custom footer (branch + tokens + model)",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				enableGitFooter(ctx);
				ctx.ui.notify("Git footer enabled", "info");
			} else {
				disableGitFooter(ctx);
				ctx.ui.notify("Default footer restored", "info");
			}
		},
	});
};

export default extension;
