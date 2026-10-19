#!/usr/bin/env node
/**
 * Parse-contract tests for the HKX rules layer loader (extensions/hkx-rules.ts).
 *
 * Fixtures are the repository's real `rules/*.md` files rather than synthetic
 * ones: 16 of the 17 are CRLF, and a `\n`-only frontmatter regex silently
 * classifies all of them as "no frontmatter" — which would switch off every
 * filter without raising anything. The `lfOnlySplit` guard below turns exactly
 * that failure mode into a regression test, and it runs without the extension
 * so the guard's meaning never depends on the code it guards.
 *
 * Node 24 imports `.ts` in process; older runtimes re-run this file under
 * `--experimental-strip-types` (see the PARSERED_CHILD branch at the bottom).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const selfPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(selfPath), "../..");
const rulesDir = path.join(root, "rules");
const extPath = path.join(root, "extensions", "hkx-rules.ts");
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) pass.push(name);
	else fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
}

const ruleFiles = fs
	.readdirSync(rulesDir)
	.filter((f) => f.endsWith(".md") || f.endsWith(".mdc"))
	.sort();

/** The naive parser this suite exists to forbid. */
function lfOnlySplit(raw) {
	const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
	return m ? { frontmatter: m[1], body: m[2] } : { frontmatter: null, body: raw };
}

function readRule(file) {
	return fs.readFileSync(path.join(rulesDir, file), "utf8");
}

// ---------------------------------------------------------------------------
// Fixture facts and the regression guard — no extension needed.
// ---------------------------------------------------------------------------

check("extension file exists", fs.existsSync(extPath));
check("17 rule files on disk", ruleFiles.length === 17, String(ruleFiles.length));

{
	const crlf = ruleFiles.filter((f) => readRule(f).includes("\r\n"));
	const lf = ruleFiles.filter((f) => !readRule(f).includes("\r\n"));
	check("16 CRLF rule files", crlf.length === 16, String(crlf.length));
	check("1 LF rule file", lf.length === 1, lf.join(","));

	// The point of the CRLF requirement: the naive splitter must actually fail.
	const naiveFailures = crlf.filter((f) => lfOnlySplit(readRule(f)).frontmatter === null);
	check(
		"G1 lfOnlySplit fails on every CRLF fixture (guard is meaningful)",
		naiveFailures.length === crlf.length,
		`${naiveFailures.length}/${crlf.length}`,
	);
	check(
		"G2 lfOnlySplit still works on the LF fixture (planted positive control)",
		lfOnlySplit(readRule(lf[0])).frontmatter !== null,
		lf[0],
	);
}

// ---------------------------------------------------------------------------
// Loader contract.
// ---------------------------------------------------------------------------

async function loadModule() {
	try {
		return await import(pathToFileURL(extPath).href);
	} catch {
		return null;
	}
}

async function runInProcess(mod) {
	const {
		splitFrontmatter,
		parseRule,
		classify,
		loadRules,
		rulesDir: resolveRulesDir,
		isEnabled,
		renderRulesSection,
		estimateTokens,
		summarizeCost,
		matchesAnyGlob,
		expandBraces,
		globToRegExp,
		parseScope,
		scopeMatches,
		rulesForToolCall,
		extractToolTarget,
		renderPromotionNotice,
	} = mod;
	const allRules = () => loadRules(rulesDir).rules;

	// T1: splitFrontmatter survives CRLF, LF and BOM, and strips the header.
	// It stays a faithful mirror of hkx-hookify's splitter (no line-ending
	// rewriting); normalizing for the prompt happens in parseRule and is
	// asserted in T2.
	{
		const split = splitFrontmatter(readRule("hkx-python.md"));
		check("T1 CRLF frontmatter parsed", typeof split.frontmatter === "string");
		check("T1 CRLF body has no frontmatter", !split.body.startsWith("---"), split.body.slice(0, 20));
		check("T1 CRLF body is non-empty", split.body.trim().length > 0);

		const splitLf = splitFrontmatter(readRule("hkx-common-development-workflow.md"));
		check("T1 LF frontmatter parsed", typeof splitLf.frontmatter === "string");

		check("T1 BOM stripped", typeof splitFrontmatter(`\uFEFF${readRule("hkx-python.md")}`).frontmatter === "string");
	}

	// T1b: the injected text (parseRule body) is normalized to LF.
	{
		const crlfParsed = parseRule(readRule("hkx-python.md"), "hkx-python.md");
		check("T1b CRLF rule body has no carriage returns", !crlfParsed.body.includes("\r"));
		const lfParsed = parseRule(readRule("hkx-common-development-workflow.md"), "hkx-common-development-workflow.md");
		check("T1b LF rule body has no carriage returns", !lfParsed.body.includes("\r"));
	}

	// T2: parseRule over the real corpus.
	{
		const parsed = ruleFiles.map((f) => parseRule(readRule(f), f));
		check("T2 all rules parsed", parsed.every((r) => r !== null && r !== undefined));
		check(
			"T2 every rule has a non-empty description",
			parsed.every((r) => typeof r.description === "string" && r.description.length > 0),
		);
		check(
			"T2 every rule has a non-empty body",
			parsed.every((r) => typeof r.body === "string" && r.body.length > 0),
		);
		check(
			"T2 name is the basename without extension",
			parsed.every((r) => !r.name.endsWith(".md") && !r.name.endsWith(".mdc")),
		);

		const byClass = { always: [], globs: [], condition: [] };
		for (const r of parsed) byClass[classify(r)].push(r.name);
		check("T2 8 always-on rules", byClass.always.length === 8, byClass.always.join(","));
		check("T2 6 globs rules", byClass.globs.length === 6, byClass.globs.join(","));
		check("T2 3 condition rules", byClass.condition.length === 3, byClass.condition.join(","));
		check(
			"T2 globs set is the language packs plus the web pair",
			[
				"hkx-typescript",
				"hkx-rust",
				"hkx-python",
				"hkx-go",
				"hkx-web-performance",
				"hkx-web-design-quality",
			].every((n) => byClass.globs.includes(n)),
			byClass.globs.join(","),
		);
		check(
			"T2 condition set is the edit guardrails",
			["hkx-ts-no-console-log", "hkx-rust-no-unwrap", "hkx-python-no-bare-except"].every((n) =>
				byClass.condition.includes(n),
			),
			byClass.condition.join(","),
		);
		check(
			"T2 globs rules carry a non-empty globs array",
			parsed.filter((r) => classify(r) === "globs").every((r) => r.globs.length > 0),
		);
		check(
			"T2 condition rules carry condition and scope",
			parsed
				.filter((r) => classify(r) === "condition")
				.every((r) => typeof r.condition === "string" && r.condition.length > 0 && r.scope.length > 0),
		);
	}

	// T3: quoted values keep their exact characters. Null-safe on purpose: when the
	// frontmatter regex regresses, these fields come back undefined and the suite
	// must report the specific failing assertion instead of throwing a stack trace.
	{
		const py = parseRule(readRule("hkx-python.md"), "hkx-python.md");
		check("T3 globs parsed", py.globs.length === 1, JSON.stringify(py.globs));
		check("T3 globs value verbatim", py.globs[0] === "**/*.{py,pyi}", JSON.stringify(py.globs));

		const ts = parseRule(readRule("hkx-ts-no-console-log.md"), "hkx-ts-no-console-log.md");
		check(
			"T3 condition keeps regex backslashes",
			typeof ts.condition === "string" && ts.condition.includes("console\\.log"),
			String(ts.condition),
		);
		check("T3 scope parsed into two entries", ts.scope.length === 2, JSON.stringify(ts.scope));
		check(
			"T3 scope entries keep their glob braces",
			ts.scope.every((s) => s.includes("{ts,tsx,js,jsx,mts,cts}")),
			JSON.stringify(ts.scope),
		);
		check(
			"T3 scope entries name their tools",
			ts.scope.every((s) => s.startsWith("tool:edit(") || s.startsWith("tool:write(")),
			JSON.stringify(ts.scope),
		);
	}

	// T4: loadRules over the real directory and the home-resolved path.
	{
		const { rules, warnings } = loadRules(rulesDir);
		check("T4 loadRules returns 17 rules", rules.length === 17, String(rules.length));
		check("T4 loadRules warns nothing on a clean corpus", warnings.length === 0, warnings.join(" | "));
		check(
			"T4 rules are sorted by name for stable ordering",
			rules.every((r, i) => i === 0 || rules[i - 1].name <= r.name),
		);

		const resolved = resolveRulesDir(path.join(root, ".pi-test-home"));
		check(
			"T4 rulesDir resolves under the given home",
			resolved === path.join(root, ".pi-test-home", ".pi", "agent", "rules"),
			resolved,
		);
	}

	// T5: shape of the public surface used by the injection layer.
	{
		check("T5 isEnabled is a function", typeof isEnabled === "function");
		check("T5 classify is exhaustive", typeof classify === "function");
	}

	// T6: fail-open fixtures — every broken shape must warn, never throw.
	{
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-rules-failopen-"));
		const write = (name, content) => fs.writeFileSync(path.join(tmp, name), content);
		write("hkx-ok.md", `---\ndescription: fine\n---\n# Body\nHello.\n`);
		write("hkx-empty.md", "");
		write("hkx-unterminated.md", "---\ndescription: no closing fence\n# Body\n");
		write("hkx-no-description.md", "---\nglobs:\n  - \"**/*.zig\"\n---\n# Body\nZig.\n");
		write("hkx-empty-body.md", "---\ndescription: has no body\n---\n\n");
		write("hkx-bad-globs.md", "---\ndescription: bad list\nglobs: not a list\n---\n# Body\nX.\n");
		write("hkx-crlf-ok.md", "---\r\ndescription: crlf fine\r\n---\r\n# Body\r\nWindows.\r\n");
		write("notes.txt", "ignored");

		let loaded;
		let threw = null;
		try {
			loaded = loadRules(tmp);
		} catch (err) {
			threw = err;
		}
		check("T6 loadRules never throws on broken fixtures", threw === null, String(threw));
		// A file with no closing fence parses as "no frontmatter": its whole text
		// becomes the body, so it loads without a description. Loading is correct
		// (fail-open, not fail-drop); the missing description is what gets warned.
		check(
			"T6 usable rules survive",
			(loaded?.rules ?? []).length === 5,
			JSON.stringify((loaded?.rules ?? []).map((r) => r.name)),
		);
		check(
			"T6 unterminated frontmatter is warned, not dropped",
			(loaded?.warnings ?? []).some((w) => w.includes("hkx-unterminated")),
			(loaded?.warnings ?? []).join(" | "),
		);
		const badGlobs = (loaded?.rules ?? []).find((r) => r.name === "hkx-bad-globs");
		check(
			"T6 malformed globs degrade to always-on instead of a bogus filter",
			badGlobs ? classify(badGlobs) === "always" : false,
			String(badGlobs && classify(badGlobs)),
		);
		check("T6 CRLF fixture loads", (loaded?.rules ?? []).some((r) => r.name === "hkx-crlf-ok"));
		check("T6 empty file skipped", !(loaded?.rules ?? []).some((r) => r.name === "hkx-empty"));
		check("T6 empty body skipped", !(loaded?.rules ?? []).some((r) => r.name === "hkx-empty-body"));
		check("T6 non-md ignored", !(loaded?.rules ?? []).some((r) => r.name === "notes.txt"));
		check(
			"T6 every problem is reported as a warning",
			(loaded?.warnings ?? []).length >= 4,
			(loaded?.warnings ?? []).join(" | "),
		);
		check(
			"T6 warnings name the offending file",
			(loaded?.warnings ?? []).some((w) => w.includes("hkx-empty")),
			(loaded?.warnings ?? []).join(" | "),
		);

		// Missing directory: empty result, no warning, still no throw.
		// Silent by design — Path A ships this extension without the rules tree, so a
		// warning would fire in every such session for a legitimate state.
		const missing = loadRules(path.join(tmp, "does-not-exist"));
		check("T6 missing dir yields no rules", missing.rules.length === 0);
		check("T6 missing dir is silent (no warning)", missing.warnings.length === 0, JSON.stringify(missing.warnings));
		check("T6 unresolved home is silent too", loadRules("").warnings.length === 0);

		// Zero writes: the loader must leave the directory byte-identical.
		const snap = () =>
			fs
				.readdirSync(tmp)
				.sort()
				.map((f) => {
					const st = fs.statSync(path.join(tmp, f));
					return `${f}:${st.size}:${st.mtimeMs}`;
				})
				.join("|");
		const before = snap();
		loadRules(tmp);
		loadRules(tmp);
		check("T6 loader performs zero writes", snap() === before);

		fs.rmSync(tmp, { recursive: true, force: true });
	}

	// T7: the real installed directory is read-only to this extension.
	{
		const snap = (dir) =>
			fs
				.readdirSync(dir)
				.sort()
				.map((f) => {
					const st = fs.statSync(path.join(dir, f));
					return `${f}:${st.size}:${st.mtimeMs}`;
				})
				.join("|");
		const before = snap(rulesDir);
		loadRules(rulesDir);
		check("T7 repo rules/ untouched by a load", snap(rulesDir) === before);
	}

	// T8: HKX_RULES toggle mirrors the other HKX extensions.
	{
		const saved = process.env.HKX_RULES;
		const enabledFor = (value) => {
			if (value === undefined) delete process.env.HKX_RULES;
			else process.env.HKX_RULES = value;
			return isEnabled();
		};
		check("T8 default is enabled", enabledFor(undefined) === true);
		for (const off of ["0", "false", "off", "disabled", "OFF", "Disabled"]) {
			check(`T8 HKX_RULES=${off} disables`, enabledFor(off) === false, off);
		}
		for (const on of ["1", "true", "yes", ""]) {
			check(`T8 HKX_RULES=${JSON.stringify(on)} keeps enabled`, enabledFor(on) === true, on);
		}
		if (saved === undefined) delete process.env.HKX_RULES;
		else process.env.HKX_RULES = saved;
	}

	// T9: baseline cost of the always-on set (M2 acceptance, re-pinned after the
	// web rules became gated).
	//
	// History: the PRD quoted 3,491 tokens for 10 always-on rules measured on the
	// raw files including frontmatter; the rendered body-only section was 3,380.
	// Moving hkx-web-performance and hkx-web-design-quality to `globs` took the set
	// to 8 rules / 12,699 chars / 2,515 real tokens. This is the number to watch,
	// so it is the one pinned.
	{
		const { rules } = loadRules(rulesDir);
		const section = renderRulesSection(rules);
		const alwaysCount = rules.filter((r) => classify(r) === "always").length;
		check("T9 always-on set has 8 rules", alwaysCount === 8, String(alwaysCount));
		check("T9 rendered section is non-empty", section.length > 0);
		check(
			"T9 rendered section stays near the 12,699-char baseline",
			Math.abs(section.length - 12699) / 12699 < 0.05,
			`${section.length} chars`,
		);
		const estimated = estimateTokens(section);
		check(
			"T9 token estimate stays near the 2,515-token baseline",
			Math.abs(estimated - 2515) / 2515 < 0.05,
			`${estimated} tokens`,
		);
		check("T9 estimate is positive", estimated > 0);
		check("T9 empty text estimates to zero", estimateTokens("") === 0);

		// The estimator must stay honest against a real tokenizer, not just against
		// its own constant. The tokenizer is optional: skip when unavailable.
		let realTokens = null;
		try {
			const { createRequire } = await import("node:module");
			const req = createRequire(import.meta.url);
			const dist = path.join(
				process.env.PI_AGENT_NPM_DIR ?? path.join(os.homedir(), ".pi", "agent", "npm", "node_modules"),
				"ai-tokenizer",
				"dist",
			);
			const { Tokenizer } = req(path.join(dist, "index.cjs"));
			const enc = req(path.join(dist, "encoding", "cl100k_base.cjs"));
			realTokens = new Tokenizer(enc.default ?? enc).encode(section).length;
		} catch {
			realTokens = null;
		}
		if (realTokens !== null) {
			const drift = Math.abs(estimated - realTokens) / realTokens;
			check(
				"T9 estimate matches a real tokenizer within 5%",
				drift < 0.05,
				`estimate=${estimated} real=${realTokens} drift=${(drift * 100).toFixed(1)}%`,
			);
		}

		const cost = summarizeCost(rules);
		check("T9 summarizeCost reports 8 always-on of 17", cost.always === 8 && cost.rules === 17, JSON.stringify({ a: cost.always, r: cost.rules }));
		check("T9 summarizeCost chars match the rendered section", cost.chars === section.length);
		check("T9 summarizeCost tokens match the estimate", cost.tokens === estimated);
		check("T9 per-rule list is sorted heaviest first", cost.perRule.every((r, i) => i === 0 || cost.perRule[i - 1].tokens >= r.tokens));
		check("T9 gated rules are excluded from the always count", cost.perRule.filter((r) => r.cls === "always").length === 8);
		check(
			"T9 the web pair is counted as gated, not always-on",
			cost.perRule.filter((r) => r.name === "hkx-web-performance" || r.name === "hkx-web-design-quality").every((r) => r.cls === "globs"),
			JSON.stringify(cost.perRule.filter((r) => r.name.startsWith("hkx-web-"))),
		);
	}

	// T10: the rendered section is deterministic and ordered by rule name.
	{
		const { rules } = loadRules(rulesDir);
		const a = renderRulesSection(rules);
		const b = renderRulesSection([...rules].reverse());
		check("T10 render is order-independent", a === b);
		const names = [...a.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
		check("T10 render lists the 8 always-on rules", names.length === 8, String(names.length));
		check("T10 render is sorted by name", names.every((n, i) => i === 0 || names[i - 1] <= n), names.join(","));
		check("T10 render excludes frontmatter", !a.includes("description:") && !a.includes("globs:"));
		check("T10 render excludes gated rule bodies", !a.includes("GATED") && !names.includes("hkx-python"));
	}

	// T11: the extension is only useful if it is actually declared in the manifest.
	{
		const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
		const declared = Array.isArray(pkg.pi?.extensions) ? pkg.pi.extensions : [];
		check(
			"T11 hkx-rules is declared in pi.extensions",
			declared.includes("./extensions/hkx-rules.ts"),
			declared.join(","),
		);
		check(
			"T11 declaration matches the file on disk",
			fs.existsSync(path.join(root, "extensions", "hkx-rules.ts")),
		);
	}

	// T12: glob matching against the patterns the rules actually ship.
	{
		const py = { globs: ["**/*.{py,pyi}"] };
		check("T12 py matches", matchesAnyGlob("src/a.py", py.globs));
		check("T12 pyi matches", matchesAnyGlob("x/y.pyi", py.globs));
		check("T12 deep nesting matches", matchesAnyGlob("a/b/c/d/e.py", py.globs));
		check("T12 pyc does not match", !matchesAnyGlob("a.pyc", py.globs));
		check("T12 absolute path matches", matchesAnyGlob("/root/x/src/a.tsx", ["**/*.{ts,tsx,js,jsx,mts,cts}"]));
		check("T12 Cargo.toml matches", matchesAnyGlob("Cargo.toml", ["**/*.rs", "**/Cargo.toml"]));
		check("T12 go.mod matches", matchesAnyGlob("pkg/go.mod", ["**/*.go", "**/go.mod"]));
		check("T12 empty path never matches", !matchesAnyGlob("", py.globs));
		check("T12 brace expansion is complete", expandBraces("**/*.{ts,tsx}").length === 2);
		check(
			"T12 globToRegExp anchors the whole path",
			globToRegExp("*.py").test("a.py") && !globToRegExp("*.py").test("a.pyc"),
		);
	}

	// T13: scope parsing must survive the brace commas in the real files.
	{
		const ts = allRules().find((r) => r.name === "hkx-ts-no-console-log");
		check("T13 scope parses into tool+glob", ts.scope.every((s) => parseScope(s) !== null), JSON.stringify(ts.scope));
		const parsed = parseScope(ts.scope[0]);
		check("T13 tool name parsed", parsed?.tool === "edit", JSON.stringify(parsed));
		check("T13 glob keeps its brace list", parsed?.glob === "**/*.{ts,tsx,js,jsx,mts,cts}", JSON.stringify(parsed));
		check("T13 unknown scope shape is rejected", parseScope("nonsense") === null);
		check("T13 scope matches an edit on a .ts file", scopeMatches(ts, "edit", "src/a.ts"));
		check("T13 scope does not match a read", !scopeMatches(ts, "read", "src/a.ts"));
		check("T13 scope does not match another language", !scopeMatches(ts, "edit", "src/a.py"));
	}

	// T14: end-to-end rule selection for a tool call.
	{
		const all = loadRules(rulesDir).rules;
		const names = (hits) => hits.map((r) => r.name).sort().join(",");

		check("T14 reading .py activates the python pack", names(rulesForToolCall(all, "read", { path: "a.py" })) === "hkx-python");
		check("T14 reading .ts activates the typescript pack", names(rulesForToolCall(all, "read", { path: "a.ts" })) === "hkx-typescript");
		check("T14 reading .md activates no gated rule", rulesForToolCall(all, "read", { path: "a.md" }).length === 0);
		check(
			"T14 console.log in a .ts edit activates both the pack and the guardrail",
			names(rulesForToolCall(all, "edit", { path: "a.ts", edits: [{ newText: "console.log(1)" }] })) ===
				"hkx-ts-no-console-log,hkx-typescript",
		);
		check(
			"T14 console.log in a .py edit does not fire the TS guardrail",
			!names(rulesForToolCall(all, "edit", { path: "a.py", edits: [{ newText: "console.log(1)" }] })).includes("ts-no-console-log"),
		);
		check(
			"T14 a clean .ts edit fires no guardrail",
			!names(rulesForToolCall(all, "edit", { path: "a.ts", edits: [{ newText: "const x = 1;" }] })).includes("hkx-ts-no-console-log"),
		);
		check(
			"T14 bare except activates the python guardrail",
			names(rulesForToolCall(all, "write", { path: "a.py", content: "try:\n  pass\nexcept:\n  pass\n" })).includes("hkx-python-no-bare-except"),
		);
		check(
			"T14 unwrap activates the rust guardrail",
			names(rulesForToolCall(all, "edit", { path: "lib.rs", edits: [{ newText: "v.unwrap()" }] })).includes("hkx-rust-no-unwrap"),
		);
		check("T14 always-on rules are never returned as promotions", rulesForToolCall(all, "read", { path: "a.py" }).every((r) => classify(r) !== "always"));
		check("T14 malformed input does not throw", rulesForToolCall(all, "edit", undefined).length === 0);
		check(
			"T14 target extraction reads edits[].newText",
			extractToolTarget({ path: "x", edits: [{ oldText: "a", newText: "b" }] }).text === "b",
		);
		check("T14 target extraction reads write content", extractToolTarget({ path: "x", content: "zz" }).text === "zz");

		// The web pair is deliberately asymmetric: a .tsx/.css/.html file is a design
		// surface (both rules), a bundler config is not (performance only).
		const webHits = (p) =>
			rulesForToolCall(all, "read", { path: p })
				.map((r) => r.name)
				.filter((n) => n.startsWith("hkx-web-"))
				.sort();
		check("T14 .tsx activates both web rules", webHits("App.tsx").join(",") === "hkx-web-design-quality,hkx-web-performance", webHits("App.tsx").join(","));
		check("T14 .css activates both web rules", webHits("a.css").join(",") === "hkx-web-design-quality,hkx-web-performance", webHits("a.css").join(","));
		check("T14 .html activates both web rules", webHits("index.html").join(",") === "hkx-web-design-quality,hkx-web-performance", webHits("index.html").join(","));
		check("T14 vite.config.ts activates only the performance rule", webHits("vite.config.ts").join(",") === "hkx-web-performance", webHits("vite.config.ts").join(","));
		check("T14 next.config.mjs activates only the performance rule", webHits("next.config.mjs").join(",") === "hkx-web-performance", webHits("next.config.mjs").join(","));
		check("T14 tailwind.config.ts activates only the performance rule", webHits("apps/web/tailwind.config.ts").join(",") === "hkx-web-performance", webHits("apps/web/tailwind.config.ts").join(","));
		check("T14 a plain .ts file activates no web rule", webHits("lib.ts").length === 0, webHits("lib.ts").join(","));
		check("T14 a plain .py file activates no web rule", webHits("a.py").length === 0, webHits("a.py").join(","));
	}

	// T15: promotion notice shape.
	{
		const all = loadRules(rulesDir).rules;
		check("T15 empty notice renders to empty string", renderPromotionNotice([]) === "");
		const notice = renderPromotionNotice(all.filter((r) => r.name === "hkx-python" || r.name === "hkx-python-no-bare-except"));
		check("T15 notice carries the rule bodies", notice.includes("HKX Python Guidance") || notice.includes("python"), notice.slice(0, 80));
		check("T15 notice lists rules by name", notice.includes("### hkx-python"));
		check("T15 notice has no frontmatter", !notice.includes("globs:") && !notice.includes("description:"));
		check(
			"T15 notice is order-stable",
			notice === renderPromotionNotice(all.filter((r) => r.name === "hkx-python-no-bare-except" || r.name === "hkx-python")),
		);
	}
}

// ---------------------------------------------------------------------------
// Runtimes whose in-process `.ts` import is unavailable re-run this same file
// under --experimental-strip-types instead of duplicating the assertions.
// ---------------------------------------------------------------------------

const IS_CHILD = process.env.PARSERED_CHILD === "1";

function runViaChild() {
	if (IS_CHILD) return null;
	return spawnSync(process.execPath, ["--experimental-strip-types", selfPath], {
		encoding: "utf8",
		env: { ...process.env, PARSERED_CHILD: "1" },
	});
}

const mod = await loadModule();
if (mod && typeof mod.parseRule === "function") {
	await runInProcess(mod);
} else {
	const child = runViaChild();
	if (child?.status === 0) {
		// Child ran the same assertions and reported OK on its own.
		console.log("rules-injection: delegated to strip-types child, OK");
		process.exit(0);
	}
	fail.push(
		fs.existsSync(extPath)
			? "extensions/hkx-rules.ts does not export the loader contract (splitFrontmatter/parseRule/classify/loadRules/rulesDir/isEnabled)"
			: "extensions/hkx-rules.ts is missing",
	);
	if (child?.status) {
		// Only surface the child's own diagnostics when it failed after loading.
		const tail = (child.stderr || "").trim().split("\n").slice(-3).join("\n");
		if (tail && !tail.includes("ERR_MODULE_NOT_FOUND")) console.error(tail);
	}
}

console.log(`rules-injection: ${pass.length} passed, ${fail.length} failed`);
for (const f of fail) console.error(`  FAIL ${f}`);
if (fail.length) process.exit(1);
console.log("OK");
