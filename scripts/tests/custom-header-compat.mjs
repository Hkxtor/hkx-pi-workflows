#!/usr/bin/env node
/**
 * Pi API compatibility contract for the first-party custom header.
 *
 * This is intentionally source-level: the package has no local install step,
 * while Pi provides the peer modules that load the TypeScript extension.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = fs.readFileSync(
	path.join(root, "extensions", "hkx-custom-header.ts"),
	"utf8",
);

const pass = [];
const fail = [];

function check(name, condition, detail = "") {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

check(
	"uses the Pi 0.87 namespaced delete-to-line-end keybinding",
	source.includes('keyHint("tui.editor.deleteToLineEnd",'),
);
check(
	"does not use the removed pre-namespaced keybinding id",
	!source.includes('keyHint("deleteToLineEnd",'),
);
check(
	"derives compound hints from configured keybindings",
	source.includes('keyText("app.clear")') &&
		source.includes('keyText("app.model.cycleForward")') &&
		source.includes('keyText("app.model.cycleBackward")'),
);
check(
	"uses ANSI-aware width truncation",
	source.includes('from "@earendil-works/pi-tui"') &&
		source.includes("truncateToWidth(line, width)"),
);
const tuiModeGuards = source.match(/ctx\.mode !== "tui"/g)?.length ?? 0;
check(
	"guards every component-factory entry point to TUI mode",
	tuiModeGuards >= 4,
	`found ${tuiModeGuards} explicit guards`,
);

console.log(`custom-header-compat: ${pass.length} passed, ${fail.length} failed`);
for (const failure of fail) console.error(`  FAIL ${failure}`);
if (fail.length > 0) process.exit(1);
console.log("OK");
