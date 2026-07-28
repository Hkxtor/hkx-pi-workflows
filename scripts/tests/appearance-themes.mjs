/**
 * Appearance suite smoke: brand themes + remaining appearance extensions.
 *
 * - themes/hkx-*.json parse, name, 51 required official pi color tokens
 * - no OMP-only color keys that official schema rejects
 * - package.json declares themes + remaining appearance extensions
 * - install.mjs still installs themes
 *
 * Footer/header UI is now provided by npm:@narumitw/pi-statusline
 * (Path B packages list), not first-party hkx-git-footer / hkx-brand-header.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

const REQUIRED_COLORS = [
	"accent",
	"border",
	"borderAccent",
	"borderMuted",
	"success",
	"error",
	"warning",
	"muted",
	"dim",
	"text",
	"thinkingText",
	"selectedBg",
	"userMessageBg",
	"userMessageText",
	"customMessageBg",
	"customMessageText",
	"customMessageLabel",
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
	"toolTitle",
	"toolOutput",
	"mdHeading",
	"mdLink",
	"mdLinkUrl",
	"mdCode",
	"mdCodeBlock",
	"mdCodeBlockBorder",
	"mdQuote",
	"mdQuoteBorder",
	"mdHr",
	"mdListBullet",
	"toolDiffAdded",
	"toolDiffRemoved",
	"toolDiffContext",
	"syntaxComment",
	"syntaxKeyword",
	"syntaxFunction",
	"syntaxVariable",
	"syntaxString",
	"syntaxNumber",
	"syntaxType",
	"syntaxOperator",
	"syntaxPunctuation",
	"thinkingOff",
	"thinkingMinimal",
	"thinkingLow",
	"thinkingMedium",
	"thinkingHigh",
	"thinkingXhigh",
	"bashMode",
];

const FORBIDDEN = [
	"statusLineBg",
	"statusLineSep",
	"statusLineModel",
	"pythonMode",
	"link",
];

for (const name of ["hkx-dark", "hkx-light"]) {
	const rel = path.join("themes", `${name}.json`);
	const raw = fs.readFileSync(path.join(root, rel), "utf8");
	let theme;
	try {
		theme = JSON.parse(raw);
	} catch (err) {
		check(`${name}: parses as JSON`, false, err.message);
		continue;
	}
	check(`${name}: name field`, theme.name === name, `got ${theme.name}`);
	check(
		`${name}: colors object`,
		theme.colors && typeof theme.colors === "object",
	);
	const missing = REQUIRED_COLORS.filter((k) => !(k in (theme.colors || {})));
	check(
		`${name}: all ${REQUIRED_COLORS.length} required colors`,
		missing.length === 0,
		missing.length ? `missing ${missing.join(",")}` : "",
	);
	const bad = FORBIDDEN.filter((k) => k in (theme.colors || {}));
	check(
		`${name}: no OMP-only color keys`,
		bad.length === 0,
		bad.length ? `has ${bad.join(",")}` : "",
	);
}

// agent-settings default theme + statusline package
{
	const settings = JSON.parse(
		fs.readFileSync(path.join(root, "configs", "agent-settings.json"), "utf8"),
	);
	check(
		"agent-settings theme is hkx-dark",
		settings.theme === "hkx-dark",
		`got ${JSON.stringify(settings.theme)}`,
	);
	const packages = settings.packages ?? [];
	check(
		"agent-settings lists @narumitw/pi-statusline",
		packages.some((p) => String(p).includes("@narumitw/pi-statusline")),
	);
	check(
		"agent-settings does not ship removed footer/header as first-party",
		!packages.some((p) => /hkx-git-footer|hkx-brand-header/.test(String(p))),
	);
}

// package.json declares themes + remaining appearance extensions
{
	const pkg = JSON.parse(
		fs.readFileSync(path.join(root, "package.json"), "utf8"),
	);
	check(
		"package.json pi.themes present",
		Array.isArray(pkg.pi?.themes) &&
			pkg.pi.themes.some((t) => String(t).includes("themes")),
	);
	const exts = pkg.pi?.extensions ?? [];
	check(
		"package.json lists hkx-working-indicator.ts",
		exts.some((e) => String(e).includes("hkx-working-indicator.ts")),
	);
	for (const removed of ["hkx-git-footer.ts", "hkx-brand-header.ts"]) {
		check(
			`package.json does not list ${removed}`,
			!exts.some((e) => String(e).includes(removed)),
		);
	}
}

// first-party footer/header sources must be gone
{
	for (const removed of ["hkx-git-footer.ts", "hkx-brand-header.ts"]) {
		const p = path.join(root, "extensions", removed);
		check(`extensions/${removed} removed`, !fs.existsSync(p));
	}
}

// install.mjs mentions themes install target
{
	const installSrc = fs.readFileSync(
		path.join(root, "scripts", "install.mjs"),
		"utf8",
	);
	check(
		"install.mjs installs themes dir",
		installSrc.includes('piHome, "themes"') ||
			installSrc.includes("piHome, 'themes'"),
	);
	check(
		"install.mjs reads themes/*.json",
		installSrc.includes("themes") && installSrc.includes(".json"),
	);
}

console.log(`appearance-themes: ${pass.length} pass, ${fail.length} fail`);
for (const p of pass) console.log(`  PASS ${p}`);
for (const f of fail) console.error(`  FAIL ${f}`);
if (fail.length) process.exit(1);
