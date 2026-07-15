/**
 * MF-6 regression: install.mjs mergeMcpConfig must NOT persist unresolved
 * ${VAR} references or placeholder templates into ~/.pi/agent/mcp.json.
 *
 * Today .mcp.json carries no env/headers, so the bug is latent. The moment
 * someone adds a `${VAR}` or `YOUR_*_HERE` to .mcp.json's env/args/url/
 * headers (which is the natural next step), mergeMcpConfig writes it straight
 * into the user's mcp.json via structuredClone(srcServer) with no resolver,
 * no placeholder refusal, no requiresEnv guard — the "refuse to persist
 * unresolved refs" invariant only holds for the apply-mcp-profile path, not
 * the install path.
 *
 * This test proves the install path leaks the same way; the fix routes both
 * write paths through the same resolver/placeholder/unresolved guards.
 *
 * Contract enforced (channel-agnostic): mergeMcpConfig either throws or
 * refuses by leaving the persisted dest without the offending literal value
 * — a literal `${UNSET_VAR}` landing in dest mcpServers[name].env/args/url /
 * headers is a bug. A `YOUR_*_HERE` placeholder landing likewise is a bug.
 *
 * Isolation: vm-load mergeMcpConfig from install.mjs (same shape as
 * merge-contract.mjs) so the test does not import the running install path.
 */
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { readFileSync } from "node:fs";
import { scanServerForRefusal } from "../lib/mcp-resolver.mjs";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-mf6-"));
const pass = [];
const fail = [];

function check(name, cond, detail) {
	if (cond) {
		pass.push(name);
	} else {
		fail.push(`${name}${detail ? ` :: ${detail}` : ""}`);
	}
}

// vm-load the install helpers spanning isPlainObject .. before runCommand.
const installSrc = readFileSync("scripts/install.mjs", "utf8");
const start = installSrc.indexOf("function isPlainObject");
let end = installSrc.indexOf("function runCommand");
while (end > start) {
	const prev = installSrc.slice(end - 1, end);
	if (/\s/.test(prev)) {
		end--;
		continue;
	}
	break;
}
const helperCode = installSrc.slice(start, end).trimEnd();

const ctx = {
	console: {
		...console,
		error: () => {},
		warn: () => {},
		log: () => {},
	},
	structuredClone,
	Error,
	Date,
	Object,
	Array,
	Boolean,
	JSON,
	Promise,
	Math,
	RegExp,
	fs,
	path,
	// MF-6: install.mjs::mergeMcpServers now calls scanServerForRefusal from
	// the shared module; expose it on the vm ctx so the sliced mergeMcpServers
	// body can resolve the global reference at call time.
	scanServerForRefusal,
	pathExists: async (p) => {
		try {
			await fs.access(p);
			return true;
		} catch {
			return false;
		}
	},
};
vm.createContext(ctx);
vm.runInContext(
	helperCode + "\nthis.__mergeMcpConfig = mergeMcpConfig;\n",
	ctx,
);
const mergeMcpConfig = ctx.__mergeMcpConfig;

async function run(srcContent, initDest = null) {
	const src = path.join(
		tmpDir,
		`src-${Math.random().toString(36).slice(2)}.json`,
	);
	const dest = path.join(
		tmpDir,
		`dest-${Math.random().toString(36).slice(2)}.json`,
	);
	await fs.writeFile(src, JSON.stringify(srcContent));
	if (initDest === null) {
		// dest absent — fresh-install path
	} else {
		await fs.writeFile(dest, JSON.stringify(initDest));
	}
	let threw = false;
	let err = null;
	try {
		await mergeMcpConfig(src, dest);
	} catch (e) {
		threw = true;
		err = e.message;
	}
	let out = null;
	try {
		out = JSON.parse(await fs.readFile(dest, "utf8"));
	} catch {
		// dest may not be written if refused; treat as null config
	}
	return { threw, err, out };
}

function scanForUnresolved(obj, pathPrefix = "") {
	const hits = [];
	if (obj === null || obj === undefined) {
		return hits;
	}
	if (typeof obj === "string") {
		if (/\$\{[^}]+\}/.test(obj)) {
			hits.push({ path: pathPrefix, value: obj });
		}
		return hits;
	}
	if (Array.isArray(obj)) {
		obj.forEach((v, i) => {
			hits.push(...scanForUnresolved(v, `${pathPrefix}[${i}]`));
		});
		return hits;
	}
	if (typeof obj === "object") {
		for (const [k, v] of Object.entries(obj)) {
			hits.push(...scanForUnresolved(v, pathPrefix ? `${pathPrefix}.${k}` : k));
		}
	}
	return hits;
}

function scanForPlaceholders(obj, pathPrefix = "") {
	const hits = [];
	if (obj === null || obj === undefined) {
		return hits;
	}
	if (typeof obj === "string") {
		if (/YOUR_.*_HERE|REPLACE_ME|<[^>]+>/.test(obj)) {
			hits.push({ path: pathPrefix, value: obj });
		}
		return hits;
	}
	if (Array.isArray(obj)) {
		obj.forEach((v, i) => {
			hits.push(...scanForPlaceholders(v, `${pathPrefix}[${i}]`));
		});
		return hits;
	}
	if (typeof obj === "object") {
		for (const [k, v] of Object.entries(obj)) {
			hits.push(
				...scanForPlaceholders(v, pathPrefix ? `${pathPrefix}.${k}` : k),
			);
		}
	}
	return hits;
}

// ---------------------------------------------------------------------------
// Case A (MF-6 red): src env has an unset ${VAR} — install must NOT write
// the literal ${UNSET_VAR} into the user's mcp.json. Pre-fix: it does,
// silently, with no throw.
// ---------------------------------------------------------------------------
{
	const { threw, out } = await run({
		mcpServers: {
			mySrv: {
				command: "npx",
				env: { TOKEN: "${UNSET_VAR}", OTHER: "ok" },
			},
		},
	});
	const leaked = out ? scanForUnresolved(out.mcpServers, "") : [];
	check(
		"A: src env ${VAR} does NOT land in persisted dest mcp.json",
		threw === true || leaked.length === 0,
		`threw=${threw} leaked=${JSON.stringify(leaked)} (MF-6: install path persists literal ${"${."}UNSET_VAR})`,
	);
}

// ---------------------------------------------------------------------------
// Case B (MF-6 red): src args carries ${VAR} — same invariant for args.
// ---------------------------------------------------------------------------
{
	const { threw, out } = await run({
		mcpServers: {
			mySrv: {
				command: "npx",
				args: ["--token", "${ARGS_ONLY}"],
			},
		},
	});
	const leaked = out ? scanForUnresolved(out.mcpServers, "") : [];
	check(
		"B: src args ${VAR} does NOT land in persisted dest mcp.json",
		threw === true || leaked.length === 0,
		`threw=${threw} leaked=${JSON.stringify(leaked)}`,
	);
}

// ---------------------------------------------------------------------------
// Case C (MF-6 red): src url with ${VAR} (HTTP MCP) — same invariant for url.
// ---------------------------------------------------------------------------
{
	const { threw, out } = await run({
		mcpServers: {
			mySrv: {
				type: "http",
				url: "https://example.com/mcp?token=${URL_TOKEN}",
			},
		},
	});
	const leaked = out ? scanForUnresolved(out.mcpServers, "") : [];
	check(
		"C: src url ${VAR} does NOT land in persisted dest mcp.json",
		threw === true || leaked.length === 0,
		`threw=${threw} leaked=${JSON.stringify(leaked)}`,
	);
}

// ---------------------------------------------------------------------------
// Case D (MF-6 red): src headers with placeholder template — install must
// NOT persist `Bearer <REPLACE_ME>` literal into user mcp.json.
// ---------------------------------------------------------------------------
{
	const { threw, out } = await run({
		mcpServers: {
			mySrv: {
				type: "http",
				url: "https://example.com/mcp",
				headers: { Auth: "Bearer <REPLACE_ME>" },
			},
		},
	});
	const leaked = out ? scanForPlaceholders(out.mcpServers, "") : [];
	check(
		"D: src placeholder does NOT land in persisted dest mcp.json",
		threw === true || leaked.length === 0,
		`threw=${threw} leaked=${JSON.stringify(leaked)}`,
	);
}

// ---------------------------------------------------------------------------
// Case E (guard): clean src with real resolved values (no ${VAR}, no
// placeholder) must still merge and write successfully — the install path
// must not over-refuse legitimate clean configs.
// ---------------------------------------------------------------------------
{
	const { threw, out } = await run({
		mcpServers: {
			mySrv: {
				command: "npx",
				args: ["-y", "good-pkg"],
				env: { TOKEN: "real-token-123" },
				description: "clean server",
			},
		},
	});
	const ok =
		threw === false &&
		out !== null &&
		out.mcpServers?.mySrv?.command === "npx" &&
		out.mcpServers?.mySrv?.env?.TOKEN === "real-token-123";
	check(
		"E: clean src still merges and writes successfully",
		ok,
		`threw=${threw} out=${JSON.stringify(out ?? null).slice(0, 120)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} MF-6 CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
