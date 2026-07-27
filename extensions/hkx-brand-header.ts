/**
 * HKX Brand Header — compact framed startup header for official pi TUI.
 *
 * Replaces the built-in logo + keybinding hints with a short brand bar:
 *
 *   ╭─ HKX ──────────────────────────────
 *   │  workflows  ·  <model>
 *   ╰────────────────────────────────────
 *
 * Controls:
 * - Auto-enable on session_start (default on).
 * - Disable auto-enable: `HKX_BRAND_HEADER=off`
 * - Toggle during a session: `/hkx-brand-header`
 *
 * Investigation (GateGuard):
 * 1. Callers/docs: package.json pi.extensions, scripts/validate.mjs required
 *    files, docs/architecture.md + docs/conversion-map.md extension lists,
 *    README dual-path appearance section.
 * 2. Public surface: default export ExtensionFactory; command `hkx-brand-header`;
 *    env `HKX_BRAND_HEADER`; uses ctx.ui.setHeader; exports buildHeaderLines.
 * 3. API shape: ctx.ui.setHeader(factory|undefined), ctx.model, ctx.mode/hasUI.
 * 4. User instruction: full appearance suite with compact HKX brand header
 *    (no OMP gradient intro). User: TUI theme header looks bad — redesign.
 * 5. Verify: npm run validate && npm test; manual /hkx-brand-header toggle.
 */

type Theme = {
	fg(color: string, text: string): string;
};

type TUI = {
	requestRender(): void;
};

type Component = {
	render(width: number): string[];
	invalidate(): void;
	dispose?(): void;
};

type ExtensionContext = {
	ui: {
		setHeader(
			factory: ((tui: TUI, theme: Theme) => Component) | undefined,
		): void;
		notify(message: string, level?: string): void;
	};
	model?: { id?: string } | null;
	mode?: string;
	hasUI?: boolean;
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

/** Display width ignoring ANSI; treats each code point as width 1. */
export function visibleWidth(text: string): number {
	return [...text.replace(ANSI_RE, "")].length;
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

function canUseUi(ctx: ExtensionContext): boolean {
	if (ctx.hasUI === false) return false;
	if (ctx.mode && ctx.mode !== "tui") return false;
	return true;
}

/**
 * Pure header builder for tests / render.
 * Keeps a compact three-line framed brand bar (no dual-column OMP intro).
 */
export function buildHeaderLines(options: {
	modelId?: string | null;
	theme: Theme;
	width?: number;
}): string[] {
	const theme = options.theme;
	const width = Math.max(24, options.width ?? 48);

	// Brand title is accent-only "HKX" (no · π suffix).
	const brand = theme.fg("accent", "HKX");

	const modelRaw = options.modelId?.trim() || "";
	const model = modelRaw
		? theme.fg("muted", modelRaw)
		: theme.fg("dim", "no-model");
	const subtitle =
		theme.fg("dim", "workflows") + theme.fg("dim", "  ·  ") + model;

	// Frame uses rounded corners; top embeds the brand title.
	const leftPad = "  ";
	const contentWidth = Math.max(16, width - leftPad.length);
	const titleLead = theme.fg("borderAccent", "─ ");
	const title = `${titleLead}${brand} `;
	const titleVis = visibleWidth(title);
	const topFill = Math.max(1, contentWidth - 1 - titleVis); // 1 for ╭
	const top =
		leftPad +
		theme.fg("borderAccent", "╭") +
		title +
		theme.fg("borderAccent", "─".repeat(topFill));

	// "│" takes 1 col; body starts with a space for breathing room.
	const midBudget = contentWidth - 1;
	const midBody = truncateToWidth(` ${subtitle}`, midBudget);
	const midPad = Math.max(0, midBudget - visibleWidth(midBody));
	const mid =
		leftPad + theme.fg("borderAccent", "│") + midBody + " ".repeat(midPad);

	const bottom =
		leftPad + theme.fg("borderAccent", "╰" + "─".repeat(contentWidth - 1));

	return ["", top, mid, bottom, ""];
}

function enableHeader(ctx: ExtensionContext): void {
	ctx.ui.setHeader((_tui, theme) => {
		return {
			invalidate() {},
			render(width: number): string[] {
				return buildHeaderLines({
					modelId: ctx.model?.id,
					theme,
					width,
				});
			},
		};
	});
}

function disableHeader(ctx: ExtensionContext): void {
	ctx.ui.setHeader(undefined);
}

const autoEnable = process.env.HKX_BRAND_HEADER !== "off";

const extension: ExtensionFactory = (pi) => {
	let enabled = false;

	pi.on("session_start", (_event, ctx) => {
		if (!autoEnable) return;
		if (!canUseUi(ctx)) return;
		enabled = true;
		enableHeader(ctx);
	});

	pi.registerCommand("hkx-brand-header", {
		description: "Toggle HKX brand startup header",
		handler: async (_args, ctx) => {
			if (!canUseUi(ctx)) {
				ctx.ui.notify("Brand header requires interactive TUI", "warning");
				return;
			}
			enabled = !enabled;
			if (enabled) {
				enableHeader(ctx);
				ctx.ui.notify("HKX brand header enabled", "info");
			} else {
				disableHeader(ctx);
				ctx.ui.notify("Built-in header restored", "info");
			}
		},
	});
};

export default extension;
