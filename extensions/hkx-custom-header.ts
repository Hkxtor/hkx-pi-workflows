/**
 * HKX Custom Header — replaces the built-in startup header with a
 * customizable logo + keybinding hints.
 *
 * Adapted from github.com/amosblomqvist/pi-config (custom-header.ts) for
 * this fork: imports resolve via pi's jiti alias
 * `@earendil-works/pi-coding-agent` (not the upstream package name).
 *
 * Controls:
 * - On by default (session_start).
 * - Disable: `HKX_CUSTOM_HEADER=off`
 * - Toggle during a session: `/hkx-custom-header`
 * - Footer/statusline: use pi's native footer (npm:pi-zentui removed).
 *
 * Load-order note: some extensions (e.g. pi-di18n, no longer installed)
 * force-clear the header in their own session_start handler, so we
 * re-apply defensively on `resources_discover` (emitted after
 * session_start) and once on the first `agent_start`.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { VERSION, keyHint, rawKeyHint } from "@earendil-works/pi-coding-agent";

/**
 * Build the header lines. Edit the ascii art and hints below to customize.
 */
function buildHeader(theme: Theme): string[] {
	// ── Logo ──────────────────────────────────────────────
	const asciiArt = [
		"   ███████████████████████████╗  ",
		"   ╚══██████╔════════██████╔══╝  ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"      ██████║        ██████║     ",
		"   ████████████╗  ████████████╗  ",
		"   ╚═══════════╝  ╚═══════════╝  ",
	].map((line) => theme.bold(theme.fg("success", line)));

	const logo = [
		"",
		...asciiArt,
		"",
		theme.bold(theme.fg("accent", "pi")) + theme.fg("dim", ` v${VERSION}`),
	];

	// ── Keybinding hints ─────────────────────────────────
	// rawKeyHint("key", "description") for app-level shortcuts;
	// keyHint("editorAction", "description") for editor shortcuts.
	const hints = [
		rawKeyHint("escape", "to interrupt"),
		rawKeyHint("ctrl+c", "to clear"),
		rawKeyHint("ctrl+c twice", "to exit"),
		rawKeyHint("ctrl+d", "to exit (empty)"),
		rawKeyHint("ctrl+z", "to suspend"),
		keyHint("deleteToLineEnd", "to delete to end"),
		rawKeyHint("shift+tab", "to cycle thinking level"),
		rawKeyHint("ctrl+p/shift+ctrl+p", "to cycle models"),
		rawKeyHint("ctrl+l", "to select model"),
		rawKeyHint("ctrl+o", "to expand tools"),
		rawKeyHint("ctrl+t", "to expand thinking"),
		rawKeyHint("ctrl+g", "for external editor"),
		rawKeyHint("/", "for commands"),
		rawKeyHint("!", "to run bash"),
		rawKeyHint("!!", "to run bash (no context)"),
		rawKeyHint("alt+enter", "to queue follow-up"),
		rawKeyHint("alt+up", "to edit all queued messages"),
		rawKeyHint(
			process.platform === "win32" ? "alt+v" : "ctrl+v",
			"to paste image",
		),
		rawKeyHint("drop files", "to attach"),
	];

	return [...logo, "", ...hints];
}

const isEnabled = (): boolean => {
	const v = process.env.HKX_CUSTOM_HEADER?.toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "disabled";
};

// Module-scoped toggle state (default follows env).
let enabled = isEnabled();

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!isEnabled()) return;
		if (!ctx.hasUI) return;
		if (ctx.mode && ctx.mode !== "tui") return;
		enabled = true;
		applyHeader(ctx);
	});

	// Some chrome extensions clear the header inside their session_start;
	// re-apply after the startup lifecycle completes.
	pi.on("resources_discover", async (_event, ctx) => {
		if (!enabled || !isEnabled()) return;
		if (!ctx.hasUI) return;
		applyHeader(ctx);
	});

	// Fallback: if a late async handler still clobbered the header, restore
	// it on the first agent turn.
	let recovered = false;
	pi.on("agent_start", async (_event, ctx) => {
		if (recovered) return;
		recovered = true;
		if (!enabled || !isEnabled()) return;
		if (!ctx.hasUI) return;
		applyHeader(ctx);
	});

	pi.registerCommand("hkx-custom-header", {
		description: "Toggle HKX custom startup header",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Custom header requires interactive TUI", "warning");
				return;
			}
			enabled = !enabled;
			if (enabled) {
				applyHeader(ctx);
				ctx.ui.notify("HKX custom header enabled", "info");
			} else {
				ctx.ui.setHeader(undefined);
				ctx.ui.notify("Built-in header restored", "info");
			}
		},
	});
}

function applyHeader(ctx: {
	ui: {
		setHeader(
			factory?: (
				tui: unknown,
				theme: Theme,
			) => { render(width: number): string[]; invalidate(): void },
		): void;
	};
}): void {
	ctx.ui.setHeader((_tui, theme) => ({
		render(_width: number): string[] {
			return buildHeader(theme);
		},
		invalidate() {},
	}));
}
