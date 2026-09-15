/**
 * Unit + exit-code tests for scripts/shell-command-preflight.mjs.
 *
 * CI-safe by construction: every analysis and exit-code assertion drives the
 * pure `analyzeCommand` entry point or injects a fake parser through
 * `main(..., { parser })`, so the suite never depends on a machine-specific pi
 * install. The real parser is exercised only when it resolves, and a miss is
 * reported as a skip rather than a failure.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const toolPath = path.join(root, "scripts/shell-command-preflight.mjs");
check("preflight tool exists", fs.existsSync(toolPath));

const mod = await import(pathToFileURL(toolPath).href);
const {
	analyzeCommand,
	loadParser,
	main,
	parseArgs,
	parserSearchRoots,
	EXIT_CLEAN,
	EXIT_UNRESOLVED,
	EXIT_USAGE,
} = mod;

// ---------------------------------------------------------------------------
// Fake tree-sitter nodes (the only surface analyzeCommand reads)
// ---------------------------------------------------------------------------

function node(props = {}) {
	const children = props.children ?? [];
	return {
		type: props.type ?? "command",
		text: props.text ?? "",
		isMissing: props.isMissing ?? false,
		hasError: props.hasError ?? false,
		childCount: children.length,
		child: (i) => children[i] ?? null,
	};
}

function fakeParser(rootNode) {
	return { parse: () => ({ rootNode }) };
}

/** Capture stdout/stderr into strings for `main`. */
function capture() {
	const out = { text: "" };
	const err = { text: "" };
	return {
		io: {
			stdout: { write: (s) => (out.text += s) },
			stderr: { write: (s) => (err.text += s) },
		},
		out,
		err,
	};
}

// ---------------------------------------------------------------------------
// analyzeCommand — clean parse
// ---------------------------------------------------------------------------
{
	const p = fakeParser(
		node({
			text: 'cd /repo\nnpm test',
			hasError: false,
			children: [
				node({ text: "cd /repo", hasError: false }),
				node({ text: "npm test", hasError: false }),
			],
		}),
	);
	const r = analyzeCommand("cd /repo\nnpm test", p);
	check("clean: clean flag", r.clean === true);
	check("clean: no error nodes", r.errorNodes.length === 0);
	check("clean: statement count", r.statementCount === 2, String(r.statementCount));
	check("clean: no floored statements", r.flooredStatements === 0);
	check("clean: badStatements empty", r.badStatements.length === 0);
	check("clean: echoes command", r.command === "cd /repo\nnpm test");
}

// ---------------------------------------------------------------------------
// analyzeCommand — partial parse failure (the real footgun shape)
// ---------------------------------------------------------------------------
{
	// `cd ... \n if ($x) { ... } \n echo ...` — one bad statement among three,
	// with the ERROR node nested below the statement, as tree-sitter reports it.
	const badStatement = node({
		text: 'if ($LASTEXITCODE -ne 0) { echo "none" }',
		hasError: true,
		children: [
			node({
				type: "ERROR",
				text: 'if ($LASTEXITCODE -ne 0) { echo "none" }',
				hasError: true,
			}),
			node({ type: "}", text: "", isMissing: true, hasError: true }),
		],
	});
	const p = fakeParser(
		node({
			text: "cd /repo\nif...\necho done",
			hasError: true,
			children: [
				node({ text: "cd /repo", hasError: false }),
				badStatement,
				node({ text: "echo done", hasError: false }),
			],
		}),
	);
	const r = analyzeCommand("cd /repo\nif...\necho done", p);
	check("unresolved: clean flag false", r.clean === false);
	check("unresolved: statement count", r.statementCount === 3, String(r.statementCount));
	check("unresolved: floors exactly one statement", r.flooredStatements === 1, String(r.flooredStatements));
	check("unresolved: bad statement is the control-flow block", r.badStatements[0]?.text.includes("if ($LASTEXITCODE"));
	check("unresolved: ERROR node collected", r.errorNodes.some((n) => n.kind === "ERROR"));
	check("unresolved: MISSING node collected", r.errorNodes.some((n) => n.kind === "MISSING"));
	check(
		"unresolved: leading clean statement is not condemned",
		!r.badStatements.some((s) => s.text === "cd /repo"),
	);
}

// ---------------------------------------------------------------------------
// analyzeCommand — defensive shape handling
// ---------------------------------------------------------------------------
{
	const p = fakeParser(node({ text: "", hasError: false, children: [] }));
	const r = analyzeCommand("", p);
	check("empty program: clean", r.clean === true);
	check("empty program: zero statements", r.statementCount === 0);
}

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------
{
	const a = parseArgs(["--command", "echo hi"]);
	check("args: --command", a.command === "echo hi" && !a.error);
	check("args: -c", parseArgs(["-c", "echo hi"]).command === "echo hi");
	check("args: positional", parseArgs(["echo hi"]).command === "echo hi");
	check("args: --json", parseArgs(["--command", "x", "--json"]).json === true);
	check("args: --help", parseArgs(["--help"]).help === true);
	check("args: missing value", typeof parseArgs(["--command"]).error === "string");
	check("args: unknown option", typeof parseArgs(["--nope"]).error === "string");
	check(
		"args: rejects two commands",
		typeof parseArgs(["a", "b"]).error === "string",
	);
	// A command that itself starts with `-` must be passable by value.
	const dash = parseArgs(["--command", "-n hello"]);
	check("args: dash-leading command survives --command", dash.command === "-n hello" && !dash.error);
}

// ---------------------------------------------------------------------------
// parserSearchRoots
// ---------------------------------------------------------------------------
{
	const roots = parserSearchRoots({});
	check("roots: repo node_modules first", roots[0] === path.join(root, "node_modules"), roots[0]);
	check(
		"roots: defaults under ~/.pi/agent/npm/node_modules",
		roots[1] === path.join(os.homedir(), ".pi", "agent", "npm", "node_modules"),
		roots[1],
	);

	const custom = parserSearchRoots({ PI_AGENT_DIR: path.join("/tmp", "pi-agent") });
	check(
		"roots: honors PI_AGENT_DIR",
		custom[1] === path.join("/tmp", "pi-agent", "npm", "node_modules"),
		custom[1],
	);

	check(
		"roots: empty PI_AGENT_DIR falls back",
		parserSearchRoots({ PI_AGENT_DIR: "" })[1].includes(path.join(".pi", "agent")),
	);
}

// ---------------------------------------------------------------------------
// loadParser failure paths (must be actionable, never a bare stack)
// ---------------------------------------------------------------------------
{
	await loadParser({ searchRoots: [] }).then(
		() => check("loadParser: empty roots rejected", false, "resolved unexpectedly"),
		(err) => check("loadParser: empty roots rejected", err.message.includes("no parser search roots")),
	);

	const missingDir = path.join(os.tmpdir(), `hkx-preflight-absent-${process.pid}`);
	await loadParser({ searchRoots: [missingDir] }).then(
		() => check("loadParser: missing root rejected", false, "resolved unexpectedly"),
		(err) => {
			check(
				"loadParser: missing root reported as absent",
				err.message.includes("directory does not exist"),
				err.message,
			);
			check(
				"loadParser: error lists the searched root",
				err.message.includes(missingDir),
				err.message,
			);
			check(
				"loadParser: error is actionable",
				err.message.includes("npm install") && err.message.includes("PI_AGENT_DIR"),
				err.message,
			);
		},
	);

	// A real directory that simply has no node_modules must not be fatal — the
	// message must explain what was missing, not throw a resolution stack.
	const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), "hkx-preflight-bare-"));
	try {
		await loadParser({ searchRoots: [bareDir] }).then(
			() => check("loadParser: bare dir rejected", false, "resolved unexpectedly"),
			(err) => check(
				"loadParser: bare dir reports resolution failure",
				err.message.includes("could not load the bash parser"),
				err.message,
			),
		);
	} finally {
		fs.rmSync(bareDir, { recursive: true, force: true });
	}
}

// ---------------------------------------------------------------------------
// main() exit codes with an injected parser
// ---------------------------------------------------------------------------
{
	const cleanParser = fakeParser(
		node({ text: "npm test", hasError: false, children: [node({ text: "npm test" })] }),
	);
	const badParser = fakeParser(
		node({
			text: 'if ($LASTEXITCODE -ne 0) { echo "x" }',
			hasError: true,
			children: [
				node({
					text: 'if ($LASTEXITCODE -ne 0) { echo "x" }',
					hasError: true,
					children: [node({ type: "ERROR", text: "if (", hasError: true })],
				}),
			],
		}),
	);

	{
		const c = capture();
		const code = await main(["--command", "npm test"], { ...c.io, parser: cleanParser });
		check("main: clean exit 0", code === EXIT_CLEAN, String(code));
		check("main: clean report says RESOLVED", c.out.text.includes("RESOLVED"), c.out.text);
		check("main: exit constants distinct", EXIT_CLEAN !== EXIT_UNRESOLVED && EXIT_UNRESOLVED !== EXIT_USAGE);
	}

	{
		const c = capture();
		const code = await main(["--command", 'if ($x) { }'], { ...c.io, parser: badParser });
		check("main: unresolved exit 2", code === EXIT_UNRESOLVED, String(code));
		check(
			"main: unresolved report names the sentinel",
			c.out.text.includes("<unparsed-bash-subtree>"),
			c.out.text,
		);
		check(
			"main: unresolved report gives the fix",
			c.out.text.includes("||") && c.out.text.includes("&&"),
			c.out.text,
		);
	}

	{
		const c = capture();
		const code = await main(["--command", 'if ($x) { }', "--json"], { ...c.io, parser: badParser });
		check("main: json exit 2", code === EXIT_UNRESOLVED, String(code));
		let ok = false;
		try {
			const parsed = JSON.parse(c.out.text);
			ok = parsed.clean === false && parsed.flooredStatements === 1;
		} catch {
			ok = false;
		}
		check("main: json body is the analysis", ok, c.out.text);
	}

	{
		const c = capture();
		const code = await main(["--command", "   "], { ...c.io, parser: cleanParser });
		check("main: empty command exit 1", code === EXIT_USAGE, String(code));
		check("main: empty command explains", c.err.text.includes("empty"), c.err.text);
	}

	{
		const c = capture();
		const code = await main(["--bogus"], { ...c.io, parser: cleanParser });
		check("main: bad flag exit 1", code === EXIT_USAGE, String(code));
		check("main: bad flag prints usage", c.err.text.includes("Usage:"), c.err.text);
	}

	{
		const c = capture();
		const code = await main(["--help"], { ...c.io, parser: cleanParser });
		check("main: --help exit 0", code === EXIT_CLEAN, String(code));
		check("main: --help lists exit codes", c.out.text.includes("Exit codes:"), c.out.text);
	}

	{
		// stdin path
		const c = capture();
		const code = await main([], {
			...c.io,
			stdin: Readable.from(["npm test\n"]),
			parser: cleanParser,
		});
		check("main: stdin exit 0", code === EXIT_CLEAN, String(code));
	}

	{
		// no stdin and no --command → usage error, not a hang
		const c = capture();
		const code = await main([], { ...c.io, stdin: null, parser: cleanParser });
		check("main: no command and no stdin exit 1", code === EXIT_USAGE, String(code));
	}

	{
		// parser setup failure surfaces as exit 1 with the actionable message
		const c = capture();
		const code = await main(["--command", "npm test"], {
			...c.io,
			searchRoots: [path.join(os.tmpdir(), `hkx-preflight-none-${process.pid}`)],
		});
		check("main: parser setup failure exit 1", code === EXIT_USAGE, String(code));
		check(
			"main: parser setup failure is actionable",
			c.err.text.includes("could not load the bash parser"),
			c.err.text,
		);
	}
}

// ---------------------------------------------------------------------------
// Real parser end-to-end (skipped when the runtime deps are absent)
// ---------------------------------------------------------------------------
{
	let loaded = null;
	try {
		loaded = await loadParser();
	} catch (err) {
		console.log(
			`note: skipping real-parser checks — ${err.message.split("\n")[0]}`,
		);
	}

	if (loaded) {
		check("real parser: resolved a search root", typeof loaded.root === "string");

		const bad = analyzeCommand(
			'cd D:\\repo\necho "=== 1 ==="\ngit grep -n "a" -- . ; if ($LASTEXITCODE -ne 0) { echo "none" }',
			loaded.parser,
		);
		check("real parser: PowerShell if-block is unresolved", bad.clean === false);
		check("real parser: floors the whole statement", bad.flooredStatements >= 1, String(bad.flooredStatements));

		const good = analyzeCommand(
			'cd /repo\necho "=== 1 ==="\ngit grep -n "a" -- . || echo "none"',
			loaded.parser,
		);
		check("real parser: || rewrite is clean", good.clean === true, JSON.stringify(good.errorNodes));
		check("real parser: || rewrite keeps statements separate", good.statementCount >= 3, String(good.statementCount));

		// Valid bash control flow must stay clean — the guard is about the
		// bash grammar, not about the word `if`.
		for (const cmd of [
			'if [ "$x" != "0" ]; then echo hi; fi',
			"if (( x > 0 )); then echo hi; fi",
			'for f in *.txt; do echo "$f"; done',
			'while read -r l; do echo "$l"; done',
			'switch_case() { echo hi; }',
			"awk 'if ($1 > 2) { print $1 }' file.txt",
		]) {
			const r = analyzeCommand(cmd, loaded.parser);
			check(`real parser: valid bash stays clean ${JSON.stringify(cmd.slice(0, 34))}`, r.clean === true, JSON.stringify(r.errorNodes));
		}
	}

	// Our own hooks must not be tripped by the doc examples we ship, and the
	// preflight must be usable on the exact command shape that caused #840.
	const selfCheck = analyzeCommand("npm run validate", fakeParser(node({ text: "npm run validate" })));
	check("analyzeCommand: trivial command is clean", selfCheck.clean === true);
}

console.log(`shell-command-preflight: ${pass.length} passed, ${fail.length} failed`);
for (const f of fail) console.error(`  FAIL ${f}`);
if (fail.length) process.exit(1);
console.log("OK");
