/**
 * HKX Working Indicator — accent-tinted braille spinner while streaming.
 *
 * Controls:
 * - Auto-enable on session_start (default on).
 * - Disable auto-enable: `HKX_WORKING_INDICATOR=off`
 * - Toggle during a session: `/hkx-working-indicator`
 *
 * Investigation (GateGuard):
 * 1. Callers/docs: package.json pi.extensions, scripts/validate.mjs required
 *    files, docs/architecture.md + docs/conversion-map.md, README appearance.
 * 2. Public surface: default export ExtensionFactory; command
 *    `hkx-working-indicator`; env `HKX_WORKING_INDICATOR`;
 *    uses ctx.ui.setWorkingIndicator.
 * 3. API shape: setWorkingIndicator({ frames, intervalMs } | undefined),
 *    ctx.ui.theme.fg, ctx.mode/hasUI.
 * 4. User instruction: full appearance suite with accent spinner.
 * 5. Verify: npm run validate && npm test; manual toggle.
 */

type Theme = {
	fg(color: string, text: string): string;
};

type WorkingIndicatorOptions = {
	frames: string[];
	intervalMs?: number;
};

type ExtensionContext = {
	ui: {
		theme?: Theme;
		setWorkingIndicator(options?: WorkingIndicatorOptions): void;
		notify(message: string, level?: string): void;
	};
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

const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function canUseUi(ctx: ExtensionContext): boolean {
	if (ctx.hasUI === false) return false;
	if (ctx.mode && ctx.mode !== "tui") return false;
	return true;
}

function buildFrames(theme: Theme | undefined): string[] {
	if (!theme?.fg) return [...BRAILLE];
	return BRAILLE.map((frame) => theme.fg("accent", frame));
}

function enableIndicator(ctx: ExtensionContext): void {
	ctx.ui.setWorkingIndicator({
		frames: buildFrames(ctx.ui.theme),
		intervalMs: 80,
	});
}

function disableIndicator(ctx: ExtensionContext): void {
	// undefined restores pi's default spinner
	ctx.ui.setWorkingIndicator();
}

const autoEnable = process.env.HKX_WORKING_INDICATOR !== "off";

const extension: ExtensionFactory = (pi) => {
	let enabled = false;

	pi.on("session_start", (_event, ctx) => {
		if (!autoEnable) return;
		if (!canUseUi(ctx)) return;
		enabled = true;
		enableIndicator(ctx);
	});

	pi.registerCommand("hkx-working-indicator", {
		description: "Toggle HKX accent working spinner",
		handler: async (_args, ctx) => {
			if (!canUseUi(ctx)) {
				ctx.ui.notify("Working indicator requires interactive TUI", "warning");
				return;
			}
			enabled = !enabled;
			if (enabled) {
				enableIndicator(ctx);
				ctx.ui.notify("HKX working indicator enabled", "info");
			} else {
				disableIndicator(ctx);
				ctx.ui.notify("Default working indicator restored", "info");
			}
		},
	});
};

export default extension;
