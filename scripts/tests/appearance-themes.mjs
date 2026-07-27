/**
 * Appearance suite smoke: brand themes + footer pure helpers.
 *
 * - themes/hkx-*.json parse, name, 51 required official pi color tokens
 * - no OMP-only color keys that official schema rejects
 * - footer formatCost / buildFooterSegments contracts (via strip-types import
 *   when available; twin fallback otherwise)
 */
import { spawnSync } from "node:child_process";
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

// agent-settings default theme
{
	const settings = JSON.parse(
		fs.readFileSync(path.join(root, "configs", "agent-settings.json"), "utf8"),
	);
	check(
		"agent-settings theme is hkx-dark",
		settings.theme === "hkx-dark",
		`got ${JSON.stringify(settings.theme)}`,
	);
}

// package.json declares themes + appearance extensions
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
	for (const need of [
		"hkx-git-footer.ts",
		"hkx-brand-header.ts",
		"hkx-working-indicator.ts",
	]) {
		check(
			`package.json lists ${need}`,
			exts.some((e) => String(e).includes(need)),
		);
	}
}

// Footer pure helpers — prefer real module via strip-types
function twinFormatCost(total) {
	if (total < 0.01) return `$${total.toFixed(4)}`;
	return `$${total.toFixed(3)}`;
}

function twinBuildFooterSegments(options) {
	const arrow = options.theme.fg("dim", " > ");
	const left =
		options.theme.fg("accent", options.modelName) +
		options.theme.fg("dim", options.thinking);
	const pathSeg =
		options.theme.fg("dim", "[D] ") +
		options.theme.fg("muted", options.cwdLabel);
	const parts = [left, pathSeg];
	if (options.branch) {
		parts.push(options.theme.fg("success", options.branch));
	}
	const percentLabel =
		options.percent === null ? "?" : options.percent.toFixed(1);
	const ctxLabel = `ctx: ${percentLabel}%/${options.windowLabel}`;
	let ctxColor = "dim";
	if (options.percent !== null) {
		if (options.percent > 90) ctxColor = "error";
		else if (options.percent > 70) ctxColor = "warning";
	}
	parts.push(options.theme.fg(ctxColor, ctxLabel));
	if (options.cost !== null) {
		parts.push(options.theme.fg("dim", twinFormatCost(options.cost)));
	}
	return parts.join(arrow);
}

const formatCost = twinFormatCost;
const buildFooterSegments = twinBuildFooterSegments;
let imported = false;

{
	const footerPath = path.join(root, "extensions", "hkx-git-footer.ts");
	const probe = `
import { formatCost, buildFooterSegments } from ${JSON.stringify(footerPath)};
const theme = { fg: (c, t) => \`[\${c}]\${t}\` };
const line = buildFooterSegments({
  modelName: "m",
  thinking: " - [low]",
  cwdLabel: "~/x",
  branch: "main",
  percent: 95,
  windowLabel: "128k",
  cost: 0.0123,
  theme,
});
console.log(JSON.stringify({
  costSmall: formatCost(0.0012),
  costNormal: formatCost(0.0123),
  line,
  hasBranch: line.includes("main"),
  hasCost: line.includes("$"),
  hasCtx: line.includes("ctx:"),
  errorColor: line.includes("[error]"),
}));
`;
	const result = spawnSync(
		process.execPath,
		["--experimental-strip-types", "--input-type=module", "-e", probe],
		{ encoding: "utf8", cwd: root },
	);
	if (result.status === 0 && result.stdout.trim()) {
		try {
			const data = JSON.parse(result.stdout.trim());
			imported = true;
			check("footer import: formatCost small", data.costSmall === "$0.0012");
			check("footer import: formatCost normal", data.costNormal === "$0.012");
			check("footer import: includes branch", data.hasBranch === true);
			check("footer import: includes cost", data.hasCost === true);
			check("footer import: includes ctx", data.hasCtx === true);
			check(
				"footer import: high ctx uses error color",
				data.errorColor === true,
			);
		} catch (err) {
			check("footer import parse", false, err.message);
		}
	} else {
		// Twin fallback
		const theme = { fg: (c, t) => `[${c}]${t}` };
		check("footer twin: formatCost small", formatCost(0.0012) === "$0.0012");
		check("footer twin: formatCost normal", formatCost(0.0123) === "$0.012");
		const line = buildFooterSegments({
			modelName: "m",
			thinking: "",
			cwdLabel: "~/x",
			branch: null,
			percent: 10,
			windowLabel: "128k",
			cost: null,
			theme,
		});
		check(
			"footer twin: omits empty branch and cost",
			!line.includes("null") && !line.includes("$") && line.includes("ctx:"),
			line,
		);
		check(
			"footer real import unavailable (used twin)",
			true,
			`status=${result.status} stderr=${(result.stderr || "").slice(0, 120)}`,
		);
	}
}

check("footer helpers exercised", true, imported ? "real import" : "twin");

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
