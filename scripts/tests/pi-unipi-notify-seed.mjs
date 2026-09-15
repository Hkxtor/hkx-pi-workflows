/**
 * Path B seed contract for configs/pi-unipi-notify/config.json.
 *
 * Tests the REAL install.mjs::installPiUnipiNotifyConfig (imported, not
 * mirrored) against a temporary HOME so the versioned suite exercises the same
 * code path that `npm run install-global` runs.
 *
 * installPiUnipiNotifyConfig seeds
 *   ~/.unipi/config/notify/config.json  (@pi-unipi/core NOTIFY_DIRS.CONFIG)
 * only when the destination is missing. The extension's /unipi:notify-settings
 * overlay and /unipi:notify-event command rewrite that file at runtime, so an
 * overwrite or symlink would clobber operator choices; the file also holds
 * gotify/telegram credentials once those platforms are enabled, hence the 0600
 * seed mode.
 *
 * Isolation: temp HOME (USERPROFILE on win32); never mutates the real
 * ~/.unipi/config/notify. On POSIX os.homedir() honors HOME.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const srcTemplate = path.join(root, "configs", "pi-unipi-notify", "config.json");
const installSrc = path.join(root, "scripts", "install.mjs");
const agentSettingsPath = path.join(root, "configs", "agent-settings.json");
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-unipi-notify-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// Import the REAL installer. install.mjs guards main() behind an isMain check,
// so importing it here does NOT run the full install path.
const installModule = await import(`file://${installSrc}?t=${Date.now()}`);
const installPiUnipiNotifyConfig = installModule.installPiUnipiNotifyConfig;
check(
	"install.mjs exports installPiUnipiNotifyConfig",
	typeof installPiUnipiNotifyConfig === "function",
	typeof installPiUnipiNotifyConfig,
);

// ---------------------------------------------------------------------------
// Template contract
//
// The template IS the operator intent, so assert the managed values rather than
// only their JSON types. Every one of the nine upstream event keys is pinned
// explicitly: loadConfig() merges {...defaults.events, ...file.events}, so an
// omitted key silently inherits the upstream default — and workflow_end,
// ralph_loop_end and mcp_server_error default to ON.
// ---------------------------------------------------------------------------
const templateRaw = readFileSync(srcTemplate, "utf8");
const templateObj = JSON.parse(templateRaw);
const ENABLED_EVENTS = [
	"agent_end",
	"agent_settled",
	"ask_user_prompt",
	"permission_request",
];
const DISABLED_EVENTS = [
	"workflow_end",
	"ralph_loop_end",
	"mcp_server_error",
	"memory_consolidated",
	"session_shutdown",
];
check("template ends with newline", templateRaw.endsWith("\n"));
check(
	'template defaultPlatforms === ["native"]',
	JSON.stringify(templateObj.defaultPlatforms) === JSON.stringify(["native"]),
	JSON.stringify(templateObj.defaultPlatforms),
);
check(
	"template native.enabled === true",
	templateObj.native?.enabled === true,
	JSON.stringify(templateObj.native),
);
check(
	"template native.suppressWhenFocused === true",
	templateObj.native?.suppressWhenFocused === true,
	JSON.stringify(templateObj.native),
);
check(
	"template pins exactly the nine upstream event keys",
	JSON.stringify(Object.keys(templateObj.events ?? {}).sort()) ===
		JSON.stringify([...ENABLED_EVENTS, ...DISABLED_EVENTS].sort()),
	JSON.stringify(Object.keys(templateObj.events ?? {})),
);
for (const name of ENABLED_EVENTS) {
	check(
		`template events.${name}.enabled === true`,
		templateObj.events?.[name]?.enabled === true,
		JSON.stringify(templateObj.events?.[name]),
	);
}
for (const name of DISABLED_EVENTS) {
	check(
		`template events.${name}.enabled === false`,
		templateObj.events?.[name]?.enabled === false,
		JSON.stringify(templateObj.events?.[name]),
	);
}
check(
	"template event platforms inherit the native-only default",
	Object.values(templateObj.events ?? {}).every(
		(e) => Array.isArray(e.platforms) && e.platforms.length === 0,
	),
	JSON.stringify(templateObj.events),
);
for (const platform of ["gotify", "telegram", "recap"]) {
	check(
		`template ${platform}.enabled === false`,
		templateObj[platform]?.enabled === false,
		JSON.stringify(templateObj[platform]),
	);
}
check(
	"template does not version the separate ntfy channel",
	!Object.hasOwn(templateObj, "ntfy"),
	JSON.stringify(Object.keys(templateObj)),
);
check(
	"template does not version unmanaged upstream defaults (gotify.priority)",
	!Object.hasOwn(templateObj.gotify ?? {}, "priority"),
	JSON.stringify(templateObj.gotify),
);
check(
	"template does not version unmanaged upstream defaults (recap.model)",
	!Object.hasOwn(templateObj.recap ?? {}, "model"),
	JSON.stringify(templateObj.recap),
);
check(
	"template does not version unmanaged upstream defaults (member set)",
	JSON.stringify(Object.keys(templateObj)) ===
		JSON.stringify([
			"defaultPlatforms",
			"events",
			"native",
			"gotify",
			"telegram",
			"recap",
			"silenceAfterInput",
		]),
	JSON.stringify(Object.keys(templateObj)),
);

// ---------------------------------------------------------------------------
// Managed package registration (install ↔ settings halves stay together)
// ---------------------------------------------------------------------------
{
	const agentSettings = JSON.parse(readFileSync(agentSettingsPath, "utf8"));
	const packagesList = Array.isArray(agentSettings.packages)
		? agentSettings.packages.map((entry) =>
				typeof entry === "string" ? entry : entry?.source,
			)
		: [];
	check(
		'agent-settings.json packages include "npm:@pi-unipi/notify"',
		packagesList.includes("npm:@pi-unipi/notify"),
		JSON.stringify(packagesList),
	);
}

// ---------------------------------------------------------------------------
// HOME-isolated install runs
// ---------------------------------------------------------------------------
const savedHome = process.env.HOME;
const savedUserprofile = process.env.USERPROFILE;
const isWin = process.platform === "win32";
async function runInstall(home) {
	process.env.HOME = home;
	// On POSIX os.homedir() honors HOME; on win32 it reads USERPROFILE, so
	// redirect both or the run would write the operator's real ~/.unipi.
	if (isWin) process.env.USERPROFILE = home;
	try {
		return await installPiUnipiNotifyConfig();
	} finally {
		process.env.HOME = savedHome;
		if (isWin) process.env.USERPROFILE = savedUserprofile;
	}
}
function destFor(home) {
	return path.join(home, ".unipi", "config", "notify", "config.json");
}

// ---------------------------------------------------------------------------
// A: cold install writes the template (and creates the missing directory chain)
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "a-home");
	mkdirSync(home, { recursive: true });
	const dest = destFor(home);
	check("A: dest starts absent", !existsSync(dest), dest);
	const ok = await runInstall(home);
	check("A: install returns true", ok === true, String(ok));
	check("A: writes config.json when missing", existsSync(dest), dest);
	check(
		"A: creates ~/.unipi/config/notify when missing",
		existsSync(path.dirname(dest)),
		path.dirname(dest),
	);
	if (process.platform !== "win32") {
		const mode = statSync(dest).mode & 0o777;
		check("A: mode 0600 (may hold gotify/telegram credentials)", mode === 0o600, `mode=${mode.toString(8)}`);
	}
	const seeded = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"A: seeded content deep-equals the repo template",
		JSON.stringify(seeded) === JSON.stringify(templateObj),
		JSON.stringify(seeded),
	);
	check(
		"A: seeded bytes equal the template bytes",
		readFileSync(dest, "utf8") === templateRaw,
	);
}

// ---------------------------------------------------------------------------
// B: an operator-edited config is never overwritten (seed-if-missing only)
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "b-home");
	mkdirSync(path.dirname(destFor(home)), { recursive: true });
	const dest = destFor(home);
	// Simulate what /unipi:notify-settings writes at runtime: the operator
	// enabled a Gotify channel and turned agent_end back off.
	const operatorEdited = {
		...templateObj,
		gotify: { enabled: true, serverUrl: "https://gotify.example", appToken: "operator-token", priority: 7 },
		events: {
			...templateObj.events,
			agent_end: { enabled: false, platforms: [] },
		},
	};
	const operatorRaw = `${JSON.stringify(operatorEdited, null, 2)}\n`;
	writeFileSync(dest, operatorRaw);
	const before = readFileSync(dest, "utf8");
	const ok = await runInstall(home);
	check("B: rerun returns true", ok === true, String(ok));
	check(
		"B: rerun keeps the operator-edited file byte-for-byte",
		readFileSync(dest, "utf8") === before,
		readFileSync(dest, "utf8"),
	);
	check(
		"B: operator gotify enable survives",
		JSON.parse(readFileSync(dest, "utf8")).gotify?.enabled === true,
	);
	check(
		"B: operator event override survives",
		JSON.parse(readFileSync(dest, "utf8")).events?.agent_end?.enabled === false,
	);
	const siblings = readdirSync(path.dirname(dest));
	check(
		"B: seed-if-missing leaves no backup siblings",
		!siblings.some((f) => f.includes(".bak.")),
		JSON.stringify(siblings),
	);
}

// ---------------------------------------------------------------------------
// C: an unreadable/corrupt destination is left untouched (never replaced)
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "c-home");
	mkdirSync(path.dirname(destFor(home)), { recursive: true });
	const dest = destFor(home);
	const corrupt = "{ this is not json";
	writeFileSync(dest, corrupt);
	const ok = await runInstall(home);
	check("C: install still returns true (skips, does not rewrite)", ok === true, String(ok));
	check(
		"C: corrupt operator file is left untouched",
		readFileSync(dest, "utf8") === corrupt,
		readFileSync(dest, "utf8"),
	);
}

await fs.rm(tmpRoot, { recursive: true, force: true });

console.log(`pass: ${pass.length}`);
for (const p of pass) console.log(`  ✓ ${p}`);
if (fail.length) {
	console.error(`fail: ${fail.length}`);
	for (const f of fail) console.error(`  ✗ ${f}`);
	process.exit(1);
}
console.log("pi-unipi-notify-seed: ok");
