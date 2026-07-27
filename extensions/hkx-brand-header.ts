/**
 * HKX Brand Header — compact startup header for official pi TUI.
 *
 * Replaces the built-in logo + keybinding hints with a short brand bar:
 *   HKX · π
 *   workflows  ·  <model>
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
 *    env `HKX_BRAND_HEADER`; uses ctx.ui.setHeader.
 * 3. API shape: ctx.ui.setHeader(factory|undefined), ctx.model, ctx.mode/hasUI.
 * 4. User instruction: full appearance suite with compact HKX brand header
 *    (no OMP gradient intro).
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

function canUseUi(ctx: ExtensionContext): boolean {
	if (ctx.hasUI === false) return false;
	if (ctx.mode && ctx.mode !== "tui") return false;
	return true;
}

function enableHeader(ctx: ExtensionContext): void {
	ctx.ui.setHeader((_tui, theme) => {
		const brand =
			theme.fg("accent", "HKX") +
			theme.fg("dim", " · ") +
			theme.fg("borderAccent", "π");
		const model = ctx.model?.id
			? theme.fg("muted", ctx.model.id)
			: theme.fg("dim", "no-model");
		const subtitle =
			theme.fg("dim", "workflows") + theme.fg("dim", "  ·  ") + model;
		return {
			invalidate() {},
			render(_width: number): string[] {
				return ["", `  ${brand}`, `  ${subtitle}`, ""];
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
