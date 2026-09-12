/**
 * Path B managed-overlay contract for configs/magic-context/magic-context.jsonc.
 *
 * Tests the REAL install.mjs::installMagicContextConfig (imported, not mirrored)
 * against a temporary HOME / XDG_CONFIG_HOME so the versioned suite exercises
 * the same code path that `npm run install-global` runs.
 *
 * installMagicContextConfig writes
 *   ${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc  (or ~/.config/...)
 * as an AUTHORITATIVE managed overlay: copied on every install, with the
 * previous destination backed up first (timestamped .bak.* sibling). This
 * differs from rpiv-advisor (seed-if-missing) because Magic Context behavior
 * is package-owned, not operator-picked.
 *
 * Magic Context owns compaction; pi native compaction is disabled in
 * configs/agent-settings.json. This suite also asserts the complementary
 * ownership at the validate layer.
 *
 * Isolation: temp HOME + XDG_CONFIG_HOME; never mutates the real
 * ~/.config/cortexkit. Exercises cold install, rerun overwrite, XDG
 * fallback, backup preservation, permissions, and exact managed values.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const srcTemplate = path.join(
	root,
	"configs",
	"magic-context",
	"magic-context.jsonc",
);
const installSrc = path.join(root, "scripts", "install.mjs");
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-magic-context-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

// Import the REAL installer. install.mjs guards main() behind an isMain check,
// so importing it here does NOT run the full install path.
const installModule = await import(
	`file://${installSrc}?t=${Date.now()}`
);
const installMagicContextConfig = installModule.installMagicContextConfig;
check(
	"install.mjs exports installMagicContextConfig",
	typeof installMagicContextConfig === "function",
	typeof installMagicContextConfig,
);

// ---------------------------------------------------------------------------
// Preconditions on repo template (full contract equality)
// ---------------------------------------------------------------------------
let templateObj = null;
{
	check("template exists", existsSync(srcTemplate), srcTemplate);
	const raw = readFileSync(srcTemplate, "utf8");
	try {
		templateObj = JSON.parse(raw);
		check("template is JSON object", templateObj && typeof templateObj === "object", "");
	} catch (err) {
		check("template is JSON object", false, err.message);
	}
}
if (templateObj) {
	const expected = {
		enabled: true,
		auto_update: true,
		language: "zh",
		cache_ttl: "5m",
		execute_threshold_percentage: 65,
		history_budget_percentage: 0.18,
		protected_tags: 24,
		compaction: { enabled: true },
		smart_drops: false,
		caveman_text_compression: { enabled: false },
		dreamer: { disable: true },
		memory: { enabled: false },
		todowrite: { enabled: false },
		sidekick: { disable: true },
		embedding: { provider: "off" },
	};
	for (const [key, want] of Object.entries(expected)) {
		const got = templateObj[key];
		const ok = JSON.stringify(got) === JSON.stringify(want);
		check(
			`template ${key} === ${JSON.stringify(want)}`,
			ok,
			`got ${JSON.stringify(got)}`,
		);
	}
	// The template must NOT version machine-local fields (historian model).
	check(
		"template omits historian (machine-local)",
		!Object.hasOwn(templateObj, "historian"),
		JSON.stringify(Object.keys(templateObj)),
	);
}

// Run installMagicContextConfig with a controlled env (HOME + XDG_CONFIG_HOME).
// The function reads process.env.XDG_CONFIG_HOME and falls back to os.homedir().
// On POSIX os.homedir() honors HOME; on win32 it reads USERPROFILE instead, so
// to keep the HOME-fallback path (test C) isolated we also redirect USERPROFILE
// on Windows — otherwise the test would back up and overwrite the operator's
// real ~/.config/cortexkit/magic-context.jsonc. Restore the original env after.
const savedHome = process.env.HOME;
const savedXdg = process.env.XDG_CONFIG_HOME;
const savedUserprofile = process.env.USERPROFILE;
const isWin = process.platform === "win32";
async function runInstall(env) {
	process.env.HOME = env.HOME;
	process.env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME;
	if (isWin) process.env.USERPROFILE = env.HOME;
	try {
		return await installMagicContextConfig();
	} finally {
		process.env.HOME = savedHome;
		process.env.XDG_CONFIG_HOME = savedXdg;
		if (isWin) process.env.USERPROFILE = savedUserprofile;
	}
}
function xdgDest(env) {
	const xdg = env.XDG_CONFIG_HOME;
	if (xdg && path.isAbsolute(xdg)) return path.join(xdg, "cortexkit", "magic-context.jsonc");
	return path.join(env.HOME, ".config", "cortexkit", "magic-context.jsonc");
}

// ---------------------------------------------------------------------------
// A: cold install into XDG_CONFIG_HOME
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "a-home");
	const xdg = path.join(tmpRoot, "a-xdg");
	mkdirSync(home, { recursive: true });
	mkdirSync(xdg, { recursive: true });
	const env = { HOME: home, XDG_CONFIG_HOME: xdg };
	const ok = await runInstall(env);
	const dest = xdgDest(env);
	check("A: install returns true", ok === true, String(ok));
	check("A: writes when missing", existsSync(dest), dest);
	check("A: dest under XDG_CONFIG_HOME", dest.startsWith(xdg), dest);
	if (process.platform !== "win32") {
		const mode = (await fs.stat(dest)).mode & 0o777;
		check("A: mode 0600", mode === 0o600, `mode=${mode.toString(8)}`);
	}
	const seeded = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"A: seeded content deep-equals managed template",
		JSON.stringify(seeded) === JSON.stringify(templateObj),
		JSON.stringify(seeded),
	);
}

// ---------------------------------------------------------------------------
// B: rerun overwrites operator-edited file and backs it up
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "b-home");
	const xdg = path.join(tmpRoot, "b-xdg");
	mkdirSync(home, { recursive: true });
	mkdirSync(xdg, { recursive: true });
	const env = { HOME: home, XDG_CONFIG_HOME: xdg };
	await runInstall(env);
	const dest = xdgDest(env);
	// Simulate an operator-edited config drifting from the managed overlay,
	// including a machine-local historian pick that the template does not own.
	const operatorDrift = {
		enabled: false,
		compaction: { enabled: false },
		dreamer: { disable: false },
		sidekick: { disable: false },
		memory: { enabled: true },
		todowrite: { enabled: true },
		embedding: { provider: "local" },
		historian: { pi: { model: "meme/operator-pick" } },
	};
	writeFileSync(dest, `${JSON.stringify(operatorDrift, null, 2)}\n`);
	const destDirBefore = path.dirname(dest);
	const backupsBefore = existsSync(destDirBefore)
		? readdirSync(destDirBefore).filter((f) => f.startsWith("magic-context.jsonc.bak."))
		: [];
	const ok = await runInstall(env);
	check("B: rerun returns true", ok === true, String(ok));
	const destDirAfter = path.dirname(dest);
	const backupsAfter = readdirSync(destDirAfter).filter((f) =>
		f.startsWith("magic-context.jsonc.bak."),
	);
	check(
		"B: rerun creates a new backup",
		backupsAfter.length === backupsBefore.length + 1,
		`before=${backupsBefore.length} after=${backupsAfter.length}`,
	);
	const backupName = backupsAfter.find((b) => !backupsBefore.includes(b));
	const backupPath = path.join(destDirAfter, backupName);
	check("B: backup file exists", existsSync(backupPath), backupPath);
	// Backup preserves the operator-drifted content (recoverable).
	const backupObj = JSON.parse(readFileSync(backupPath, "utf8"));
	check(
		"B: backup preserves operator historian pick",
		backupObj.historian?.pi?.model === "meme/operator-pick",
		JSON.stringify(backupObj),
	);
	check(
		"B: backup preserves drifted enabled === false",
		backupObj.enabled === false,
		JSON.stringify(backupObj),
	);
	// Destination now reflects the managed overlay (drift corrected).
	const after = JSON.parse(readFileSync(dest, "utf8"));
	check(
		"B: dest after rerun deep-equals managed template",
		JSON.stringify(after) === JSON.stringify(templateObj),
		JSON.stringify(after),
	);
	// The operator historian pick is NOT carried into the managed overlay:
	// the template does not version historian, so it is dropped on overwrite.
	check(
		"B: managed dest drops operator historian pick",
		after.historian === undefined,
		JSON.stringify(after),
	);
}

// ---------------------------------------------------------------------------
// C: falls back to $HOME/.config when XDG_CONFIG_HOME unset
// ---------------------------------------------------------------------------
{
	const home = path.join(tmpRoot, "c-home");
	mkdirSync(home, { recursive: true });
	const env = { HOME: home, XDG_CONFIG_HOME: undefined };
	const ok = await runInstall(env);
	const expected = path.join(home, ".config", "cortexkit", "magic-context.jsonc");
	check("C: install returns true", ok === true, String(ok));
	check("C: writes under HOME/.config/cortexkit", existsSync(expected), expected);
	const got = JSON.parse(readFileSync(expected, "utf8"));
	check(
		"C: dest deep-equals managed template",
		JSON.stringify(got) === JSON.stringify(templateObj),
		JSON.stringify(got),
	);
}

// ---------------------------------------------------------------------------
// D: install.mjs guards main() + never symlinks magic-context (source smoke)
// ---------------------------------------------------------------------------
{
	const installSrcText = readFileSync(installSrc, "utf8");
	check(
		"D: install.mjs guards main() behind isMain",
		/path\.resolve\(process\.argv\[1\]\) === fileURLToPath\(import\.meta\.url\)/.test(
			installSrcText,
		),
		"",
	);
	check(
		"D: install.mjs exports installMagicContextConfig",
		/export \{ installMagicContextConfig \}/.test(installSrcText) ||
			/export \{[^}]*installMagicContextConfig[^}]*\}/.test(installSrcText),
		"",
	);
	check(
		"D: install.mjs documents authoritative (backup + overwrite)",
		/backed up before write|authoritative/i.test(installSrcText),
		"",
	);
	check(
		"D: install.mjs never symlinks magic-context (writeFile only)",
		!/linkOrCopy\([^)]*magic-context/.test(installSrcText),
		"linkOrCopy must not be used for magic-context",
	);
}

// ---------------------------------------------------------------------------
// E: validate accepts current template + complementary ownership (subprocess)
// ---------------------------------------------------------------------------
{
	const result = spawnSync(
		process.execPath,
		[path.join(root, "scripts", "validate.mjs")],
		{
			cwd: root,
			encoding: "utf8",
			env: process.env,
		},
	);
	check(
		"E: npm-style validate exits 0 with managed overlay",
		result.status === 0,
		`status=${result.status} stderr=${(result.stderr || "").slice(0, 400)}`,
	);
}

// ---------------------------------------------------------------------------
// F: agent-settings complementary ownership (source-level)
// ---------------------------------------------------------------------------
{
	const agentSettingsPath = path.join(root, "configs", "agent-settings.json");
	const agentSettings = JSON.parse(readFileSync(agentSettingsPath, "utf8"));
	const packagesList = (agentSettings.packages || []).map((entry) =>
		typeof entry === "string" ? entry : entry?.source,
	);
	check(
		"F: @cortexkit/pi-magic-context in managed packages",
		packagesList.some((p) =>
			typeof p === "string" ? p.includes("@cortexkit/pi-magic-context") : false,
		),
		JSON.stringify(packagesList),
	);
	const c = agentSettings.compaction || {};
	check(
		"F: pi native compaction.enabled === false",
		c.enabled === false,
		JSON.stringify(c),
	);
	check(
		"F: pi native compaction.reserveTokens === 65536",
		c.reserveTokens === 65536,
		JSON.stringify(c),
	);
	check(
		"F: pi native compaction.keepRecentTokens === 24000",
		c.keepRecentTokens === 24000,
		JSON.stringify(c),
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
console.log("magic-context-install: ok");
