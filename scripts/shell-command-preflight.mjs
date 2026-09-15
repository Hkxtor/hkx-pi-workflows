#!/usr/bin/env node
/**
 * Shell command parse preflight for @hkx/pi-workflows.
 *
 * Direct invocation only (maintenance helper — not an npm script):
 *
 *   node scripts/shell-command-preflight.mjs --command "<command>"
 *   node scripts/shell-command-preflight.mjs --command "<command>" --json
 *   echo "<command>" | node scripts/shell-command-preflight.mjs
 *
 * Why this exists: pi-permission-system parses every shell tool command with
 * tree-sitter-bash, even on Windows where the tool is `powershell`. When the
 * parse only partially resolves, the gate fails closed — the whole command is
 * floored to a prompt tagged `<unparsed-bash-subtree>` (ADR 0013 §10, #840),
 * so a command that the policy allows still stops to ask the operator, and the
 * prompt names the entire command rather than the fragment that broke.
 *
 * The highest-frequency trigger is PowerShell control flow: `if (...) { ... }`,
 * `foreach/while/for/switch (...) { ... }`, `do { ... } while (...)`, and
 * `function Name { ... }` have no bash grammar. Rewriting them as `||` / `&&`
 * or as separate tool calls keeps the command out of the fail-closed path.
 *
 * Exits: 0 clean parse, 2 unresolved parse, 1 usage or parser-setup failure.
 *
 * Origin: HKX Pi Workflows. Parser dependencies are resolved at runtime — see
 * {@link parserSearchRoots} — so this file carries no machine-specific path.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

export const EXIT_CLEAN = 0;
export const EXIT_USAGE = 1;
export const EXIT_UNRESOLVED = 2;

const HINT =
	"PowerShell control flow has no bash grammar. Rewrite `if (...) { ... }`,\n" +
	"  `foreach/while/for/switch (...) { ... }`, `do { ... } while (...)`, and\n" +
	"  `function Name { ... }` as `||` / `&&` chains or separate tool calls.";

// ---------------------------------------------------------------------------
// Pure analysis (no parser dependency — testable in isolation)
// ---------------------------------------------------------------------------

/**
 * Collect every ERROR / missing node in a tree-sitter subtree.
 *
 * `isMissing` is a distinct tree-sitter signal from `type === "ERROR"`:
 * recovery can insert a zero-width missing token instead of an error node, and
 * both mean the grammar did not accept the input.
 */
function collectErrorNodes(node, out) {
	if (!node || out.length >= 50) return out;
	if (node.type === "ERROR" || node.isMissing === true) {
		out.push({
			kind: node.isMissing === true ? "MISSING" : "ERROR",
			text: typeof node.text === "string" ? node.text : "",
		});
	}
	for (let i = 0; i < node.childCount; i++) {
		collectErrorNodes(node.child(i), out);
	}
	return out;
}

/**
 * Analyze one shell command string against a tree-sitter parser.
 *
 * Pure and synchronous: the caller supplies the (already initialized) parser,
 * so this is fully testable without web-tree-sitter or a WASM load.
 *
 * `hasError` on a top-level statement mirrors pi-permission-system's
 * `parseUnresolvedWithin(node) { return node.hasError }`: a statement holding
 * an unresolved region is one whose recovered shape was invented, so every
 * command unit beneath it is marked `parseUnresolved` and floored to `ask`.
 */
export function analyzeCommand(command, parser) {
	const tree = parser.parse(command);
	const root = tree.rootNode;

	const statements = [];
	for (let i = 0; i < root.childCount; i++) {
		const stmt = root.child(i);
		statements.push({
			text: typeof stmt.text === "string" ? stmt.text : "",
			hasError: stmt.hasError === true,
		});
	}
	const badStatements = statements.filter((s) => s.hasError);

	return {
		command,
		clean: root.hasError !== true,
		errorNodes: collectErrorNodes(root, []),
		statementCount: statements.length,
		flooredStatements: badStatements.length,
		badStatements,
	};
}

// ---------------------------------------------------------------------------
// Parser resolution
// ---------------------------------------------------------------------------

/**
 * Directories searched for `web-tree-sitter` + `tree-sitter-bash`, in order.
 *
 * 1. this repo's own `node_modules` (when the packages are installed locally),
 * 2. `<PI_AGENT_DIR or ~/.pi/agent>/npm/node_modules`, which is where a pi
 *    install keeps extensions such as pi-permission-system and their deps.
 *
 * The pi fallback is what makes the tool useful inside a session without
 * vendoring the WASM into this package.
 */
export function parserSearchRoots(env = process.env) {
	const roots = [path.join(repoRoot, "node_modules")];
	const agentDir =
		typeof env?.PI_AGENT_DIR === "string" && env.PI_AGENT_DIR
			? env.PI_AGENT_DIR
			: path.join(os.homedir(), ".pi", "agent");
	roots.push(path.join(agentDir, "npm", "node_modules"));
	return roots;
}

/**
 * Load an initialized `tree-sitter-bash` parser.
 *
 * Throws an actionable error when neither search root can supply the packages,
 * rather than crashing with a bare module-resolution stack.
 */
export async function loadParser(options = {}) {
	const roots = options.searchRoots ?? parserSearchRoots(options.env);
	const tried = [];

	if (roots.length === 0) {
		throw new Error("no parser search roots configured (internal error)");
	}

	for (const root of roots) {
		if (!fs.existsSync(root)) {
			tried.push(`${root} — directory does not exist`);
			continue;
		}
		try {
			// The anchor file need not exist; createRequire only uses its
			// directory to anchor node_modules resolution.
			const req = createRequire(path.join(root, "resolve-anchor.cjs"));
			const webEntry = req.resolve("web-tree-sitter");
			const tsWasm = req.resolve("web-tree-sitter/web-tree-sitter.wasm");
			const bashWasm = req.resolve("tree-sitter-bash/tree-sitter-bash.wasm");

			const mod = await import(pathToFileURL(webEntry).href);
			const Parser = mod.Parser ?? mod.default?.Parser;
			const Language = mod.Language ?? mod.default?.Language;
			if (typeof Parser !== "function" || typeof Language !== "function") {
				throw new Error(
					"web-tree-sitter entry does not export Parser/Language",
				);
			}

			await Parser.init({ locateFile: () => tsWasm });
			const parser = new Parser();
			parser.setLanguage(await Language.load(bashWasm));
			return { parser, root, webEntry, tsWasm, bashWasm };
		} catch (err) {
			tried.push(`${root} — ${err.message}`);
		}
	}

	throw new Error(
		[
			"could not load the bash parser (web-tree-sitter + tree-sitter-bash).",
			"Searched:",
			...tried.map((t) => `  - ${t}`),
			"Fix: run `npm install` in this repo, or set PI_AGENT_DIR to a pi agent",
			"directory whose npm/node_modules already has both packages.",
		].join("\n"),
	);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
	const out = { command: undefined, json: false, help: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			out.help = true;
		} else if (arg === "--json") {
			out.json = true;
		} else if (arg === "--command" || arg === "-c") {
			if (i + 1 >= argv.length) {
				return { error: `${arg} requires a value` };
			}
			out.command = argv[++i];
		} else if (arg.startsWith("-")) {
			return { error: `unrecognized option: ${arg}` };
		} else if (out.command === undefined) {
			out.command = arg;
		} else {
			return { error: "unexpected extra argument; pass one command string" };
		}
	}
	return out;
}

function readStream(stream) {
	return new Promise((resolve, reject) => {
		let data = "";
		stream.setEncoding("utf8");
		stream.on("data", (chunk) => {
			data += chunk;
		});
		stream.on("end", () => resolve(data));
		stream.on("error", reject);
	});
}

function snippet(text, max = 120) {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function formatReport(result) {
	const lines = [];
	if (result.clean) {
		lines.push(
			"shell-command-preflight: RESOLVED — the bash parser accepted this command.",
		);
		lines.push(
			`  statements: ${result.statementCount}   error nodes: ${result.errorNodes.length}`,
		);
		lines.push(
			"  no pi-permission-system floor expected from parsing (policy may still ask).",
		);
		return lines.join("\n");
	}

	lines.push(
		"shell-command-preflight: UNRESOLVED — pi-permission-system will floor this",
	);
	lines.push(
		"  command to a prompt tagged <unparsed-bash-subtree> (ADR 0013 §10, #840).",
	);
	lines.push(`  statements: ${result.statementCount}`);
	lines.push(`  error nodes: ${result.errorNodes.length}`);
	for (const node of result.errorNodes.slice(0, 5)) {
		lines.push(`    ${node.kind}: ${JSON.stringify(snippet(node.text, 90))}`);
	}
	lines.push(
		`  statements carrying a parse error: ${result.flooredStatements}/${result.statementCount}`,
	);
	for (const stmt of result.badStatements.slice(0, 3)) {
		lines.push(`    x ${JSON.stringify(snippet(stmt.text, 90))}`);
	}
	lines.push(`  fix: ${HINT}`);
	return lines.join("\n");
}

const USAGE = [
	"Usage: node scripts/shell-command-preflight.mjs [options] [command]",
	"",
	"  --command <text>, -c <text>  command string to check",
	"  (no --command)               read the command from stdin",
	"  --json                       emit the analysis as JSON",
	"  --help, -h                   show this help",
	"",
	"Exit codes: 0 clean, 2 unresolved parse, 1 usage or parser-setup error.",
].join("\n");

/**
 * Run the CLI. Returns the process exit code instead of calling
 * `process.exit`, so tests can drive it in-process.
 */
export async function main(argv, io = {}) {
	const stdout = io.stdout ?? process.stdout;
	const stderr = io.stderr ?? process.stderr;

	const parsed = parseArgs(argv);
	if (parsed.error) {
		stderr.write(`shell-command-preflight: ${parsed.error}\n\n${USAGE}\n`);
		return EXIT_USAGE;
	}
	if (parsed.help) {
		stdout.write(`${USAGE}\n`);
		return EXIT_CLEAN;
	}

	let command = parsed.command;
	if (command === undefined) {
		if (io.stdin === null || (io.stdin === undefined && process.stdin.isTTY)) {
			stderr.write(
				`shell-command-preflight: no command given (pass --command or pipe via stdin)\n\n${USAGE}\n`,
			);
			return EXIT_USAGE;
		}
		command = await readStream(io.stdin ?? process.stdin);
	}

	if (typeof command !== "string" || command.trim() === "") {
		stderr.write("shell-command-preflight: command is empty\n");
		return EXIT_USAGE;
	}

	let parser;
	try {
		({ parser } = io.parser
			? { parser: io.parser }
			: await loadParser({ searchRoots: io.searchRoots }));
	} catch (err) {
		stderr.write(`shell-command-preflight: ${err.message}\n`);
		return EXIT_USAGE;
	}

	const result = analyzeCommand(command, parser);
	if (parsed.json) {
		stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		stdout.write(`${formatReport(result)}\n`);
	}
	return result.clean ? EXIT_CLEAN : EXIT_UNRESOLVED;
}

const invokedDirectly =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
	main(process.argv.slice(2))
		.then((code) => {
			process.exitCode = code;
		})
		.catch((err) => {
			process.stderr.write(
				`shell-command-preflight: unexpected failure: ${err?.stack ?? err}\n`,
			);
			process.exitCode = EXIT_USAGE;
		});
}
