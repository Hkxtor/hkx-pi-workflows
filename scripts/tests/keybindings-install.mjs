import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const templatePath = path.join(root, "configs", "keybindings.json");
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-keybindings-"));
const pass = [];
const fail = [];

const expected = {
	"tui.altScreen.searchPrevious": ["shift+enter"],
	"tui.editor.cursorUp": ["up", "ctrl+p", "alt+k"],
	"tui.editor.cursorDown": ["down", "ctrl+n", "alt+j"],
	"tui.editor.cursorLeft": ["left", "ctrl+b", "alt+h"],
	"tui.editor.cursorRight": ["right", "ctrl+f", "alt+l"],
	"tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
	"tui.editor.cursorWordRight": ["alt+right", "alt+f", "alt+w"],
	"tui.editor.deleteCharForward": ["delete", "ctrl+d"],
	"tui.editor.deleteCharBackward": ["backspace", "ctrl+h"],
	"tui.editor.deleteWordBackward": ["ctrl+w", "alt+backspace"],
	"tui.input.newLine": ["shift+enter", "ctrl+j", "alt+enter"],
};

function check(name, condition, detail = "") {
	if (condition) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

let template = null;
try {
	template = JSON.parse(await fs.readFile(templatePath, "utf8"));
} catch (error) {
	check("template exists and is valid JSON", false, error.message);
}
if (template) {
	check(
		"template matches the managed bindings",
		JSON.stringify(template) === JSON.stringify(expected),
		JSON.stringify(template),
	);
	check(
		"template releases ctrl+shift+g",
		!JSON.stringify(template).includes("ctrl+shift+g"),
		JSON.stringify(template),
	);
}

const installPath = path.join(root, "scripts", "install.mjs");
const installSrc = readFileSync(installPath, "utf8");
const start = installSrc.indexOf("function isValidKeybindingValue");
const end = installSrc.indexOf("function getPiUpdateInvocation");
check("installer defines mergeKeybindingsConfig", start >= 0, "missing helper");
check(
	"installer invokes mergeKeybindingsConfig",
	(installSrc.match(/mergeKeybindingsConfig\(/g) ?? []).length >= 2,
	"missing install call",
);

let mergeKeybindingsConfig = null;
if (start >= 0 && end > start) {
	const context = {
		console: { log: () => {}, warn: () => {}, error: () => {} },
		fs,
		JSON,
		Object,
		Array,
		Boolean,
		Promise,
		isPlainObject: (value) =>
			Boolean(value) && typeof value === "object" && !Array.isArray(value),
	};
	vm.createContext(context);
	vm.runInContext(
		`${installSrc.slice(start, end)}\nthis.__merge = mergeKeybindingsConfig;`,
		context,
	);
	mergeKeybindingsConfig = context.__merge;
}

async function writeJson(file, value) {
	await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

if (mergeKeybindingsConfig && template) {
	const src = templatePath;

	{
		const dest = path.join(tmpDir, "cold.json");
		const result = await mergeKeybindingsConfig(src, dest);
		const out = JSON.parse(await fs.readFile(dest, "utf8"));
		check("cold install creates keybindings", result === true, String(result));
		check(
			"cold install writes managed bindings",
			JSON.stringify(out) === JSON.stringify(expected),
			JSON.stringify(out),
		);
	}

	{
		const dest = path.join(tmpDir, "merge.json");
		await writeJson(dest, {
			"app.interrupt": ["ctrl+q"],
			"tui.editor.cursorUp": ["up", "custom-up"],
		});
		const result = await mergeKeybindingsConfig(src, dest);
		const out = JSON.parse(await fs.readFile(dest, "utf8"));
		check("merge succeeds", result === true, String(result));
		check(
			"merge preserves non-managed actions",
			out["app.interrupt"]?.[0] === "ctrl+q",
			JSON.stringify(out),
		);
		check(
			"merge updates managed actions",
			JSON.stringify(out["tui.editor.cursorUp"]) ===
				JSON.stringify(expected["tui.editor.cursorUp"]),
			JSON.stringify(out),
		);
	}

	for (const [name, body] of [
		["corrupt", "{ not-json"],
		["non-object", "[]"],
	]) {
		const dest = path.join(tmpDir, `${name}.json`);
		await fs.writeFile(dest, body, "utf8");
		const result = await mergeKeybindingsConfig(src, dest);
		const after = await fs.readFile(dest, "utf8");
		check(`${name} destination reports failure`, result === false, String(result));
		check(`${name} destination is unchanged`, after === body, after);
	}

	{
		const invalidSrc = path.join(tmpDir, "invalid-source.json");
		const dest = path.join(tmpDir, "invalid-source-dest.json");
		await writeJson(invalidSrc, { "tui.input.submit": [42] });
		await writeJson(dest, { "app.interrupt": ["escape"] });
		const before = await fs.readFile(dest, "utf8");
		const result = await mergeKeybindingsConfig(invalidSrc, dest);
		const after = await fs.readFile(dest, "utf8");
		check("invalid source reports failure", result === false, String(result));
		check("invalid source leaves destination unchanged", after === before, after);
	}
}

await fs.rm(tmpDir, { recursive: true, force: true });
for (const name of pass) console.log("ok:", name);
if (fail.length > 0) {
	for (const item of fail) console.error("FAIL:", item);
	process.exit(1);
}
console.log(`keybindings-install: all ${pass.length} checks passed`);
