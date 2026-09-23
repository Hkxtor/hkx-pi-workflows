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
import {
	VERSION,
	keyHint,
	keyText,
	rawKeyHint,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

// Blue → purple horizontal gradient endpoints.
const GRADIENT_FROM = { r: 0x3b, g: 0x82, b: 0xf6 }; // #3b82f6 blue
const GRADIENT_TO = { r: 0xa8, g: 0x55, b: 0xf7 }; // #a855f7 purple

function rgbTo256(r: number, g: number, b: number): number {
	const q = (v: number) => Math.round((v / 255) * 5);
	return 16 + 36 * q(r) + 6 * q(g) + q(b);
}

/** Colorize one art line left-to-right with a blue→purple gradient. */
function gradientLine(line: string, truecolor: boolean): string {
	const last = Math.max(line.length - 1, 1);
	let out = "\x1b[1m";
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === " ") {
			out += ch;
			continue;
		}
		const t = i / last;
		const r = Math.round(GRADIENT_FROM.r + (GRADIENT_TO.r - GRADIENT_FROM.r) * t);
		const g = Math.round(GRADIENT_FROM.g + (GRADIENT_TO.g - GRADIENT_FROM.g) * t);
		const b = Math.round(GRADIENT_FROM.b + (GRADIENT_TO.b - GRADIENT_FROM.b) * t);
		out += truecolor
			? `\x1b[38;2;${r};${g};${b}m${ch}`
			: `\x1b[38;5;${rgbTo256(r, g, b)}m${ch}`;
	}
	return out + "\x1b[0m";
}

/**
 * Build the header lines. Edit the ascii art and hints below to customize.
 */
function buildHeader(theme: Theme): string[] {
	// ── Logo ──────────────────────────────────────────────
	const rawArt = [
		"      ___           ___           ___           ___           ___           ___",
		"     /\\__\\         /\\__\\         |\\__\\         /\\  \\         /\\  \\         /\\  \\",
		"    /:/  /        /:/  /         |:|  |        \\:\\  \\       /::\\  \\       /::\\  \\",
		"   /:/__/        /:/__/          |:|  |         \\:\\  \\     /:/\\:\\  \\     /:/\\:\\  \\",
		"  /::\\  \\ ___   /::\\__\\____      |:|__|__       /::\\  \\   /:/  \\:\\  \\   /::\\~\\:\\  \\",
		" /:/\\:\\  /\\__\\ /:/\\:::::\\__\\ ____/::::\\__\\     /:/\\:\\__\\ /:/__/ \\:\\__\\ /:/\\:\\ \\:\\__\\",
		" \\/__\\:\\/:/  / \\/_|:|~~|~    \\::::/~~/~       /:/  \\/__/ \\:\\  \\ /:/  / \\/_|::\\/:/  /",
		"      \\::/  /     |:|  |      ~~|:|~~|       /:/  /       \\:\\  /:/  /     |:|::/  /",
		"      /:/  /      |:|  |        |:|  |       \\/__/         \\:\\/:/  /      |:|\\/__/",
		"     /:/  /       |:|  |        |:|  |                      \\::/  /       |:|  |",
		"     \\/__/         \\|__|         \\|__|                       \\/__/         \\|__|",
	];
	const asciiArt = rawArt.map((line) =>
		gradientLine(line, theme.getColorMode() === "truecolor"),
	);

	const logo = [
		"",
		...asciiArt,
		"",
		theme.bold(theme.fg("accent", "pi")) + theme.fg("dim", ` v${VERSION}`),
	];

	// ── Keybinding hints ─────────────────────────────────
	// Use configured, namespaced actions whenever Pi owns the shortcut. Keep
	// raw hints only for literal input syntax or compound key descriptions.
	const hints = [
		keyHint("app.interrupt", "to interrupt"),
		keyHint("app.clear", "to clear"),
		rawKeyHint(`${keyText("app.clear")} twice`, "to exit"),
		keyHint("app.exit", "to exit (empty)"),
		keyHint("app.suspend", "to suspend"),
		keyHint("tui.editor.deleteToLineEnd", "to delete to end"),
		keyHint("app.thinking.cycle", "to cycle thinking level"),
		rawKeyHint(
			`${keyText("app.model.cycleForward")}/${keyText("app.model.cycleBackward")}`,
			"to cycle models",
		),
		keyHint("app.model.select", "to select model"),
		keyHint("app.tools.expand", "to expand tools"),
		keyHint("app.thinking.toggle", "to expand thinking"),
		keyHint("app.editor.external", "for external editor"),
		rawKeyHint("/", "for commands"),
		rawKeyHint("!", "to run bash"),
		rawKeyHint("!!", "to run bash (no context)"),
		keyHint("app.message.followUp", "to queue follow-up"),
		keyHint("app.message.dequeue", "to edit all queued messages"),
		keyHint("app.clipboard.pasteImage", "to paste image"),
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
		if (ctx.mode !== "tui") return;
		enabled = true;
		applyHeader(ctx);
	});

	// Some chrome extensions clear the header inside their session_start;
	// re-apply after the startup lifecycle completes.
	pi.on("resources_discover", async (_event, ctx) => {
		if (!enabled || !isEnabled()) return;
		if (ctx.mode !== "tui") return;
		applyHeader(ctx);
	});

	// Fallback: if a late async handler still clobbered the header, restore
	// it on the first agent turn.
	let recovered = false;
	pi.on("agent_start", async (_event, ctx) => {
		if (recovered) return;
		recovered = true;
		if (!enabled || !isEnabled()) return;
		if (ctx.mode !== "tui") return;
		applyHeader(ctx);
	});

	pi.registerCommand("hkx-custom-header", {
		description: "Toggle HKX custom startup header",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				if (ctx.hasUI) {
					ctx.ui.notify("Custom header requires interactive TUI", "warning");
				}
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
		render(width: number): string[] {
			return buildHeader(theme).map((line) => truncateToWidth(line, width));
		},
		invalidate() {},
	}));
}
