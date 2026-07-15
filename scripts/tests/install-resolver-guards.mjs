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

// ---------------------------------------------------------------------------
// Case F (M2 red): preserved server carries operator's OWN unresolved
// ${VAR} in dest. The preserved-branch re-scan must NOT throw and block
// forward progress — the operator's dest-owned value predates this install.
//
// Pre-fix: scanServerForRefusal(name, merged) runs over the FULL merged
// server (dest keys win). If operator's dest has ${UNSET_VAR} on a field
// the src doesn't set, the re-scan throws, blocking ALL MCP-config upgrades
// indefinitely. main() catches it as a non-fatal issue, so the repo's
// .mcp.json updates are silently skipped every subsequent install.
//
// Fix: scan only the keys the merge NEWLY added from the source. dest-owned
// values that already existed must NOT be passed through the refuse guard.
// ---------------------------------------------------------------------------
{
	const srcContent = {
		mcpServers: {
			mysrv: {
				command: "npx",
				args: ["--new-arg"],
			},
		},
	};
	const initDest = {
		mcpServers: {
			mysrv: {
				command: "npx",
				env: { TOKEN: "${UNSET_PRESERVED}" },
			},
		},
	};
	const { threw, err } = await run(srcContent, initDest);

	// The merge must NOT throw on the operator's own unresolved dest ref.
	check(
		"F: preserved server with operator ${VAR} does NOT throw",
		threw === false,
		`threw=${threw} err=${JSON.stringify(err)} (M2: preserved-server forward-progress blocker)`,
	);
}

// ---------------------------------------------------------------------------
// Case G (M2 red): preserved server — source adds a NEW unresolved ${VAR}
// on a field the dest does NOT own. This MUST still throw (the refuse guard
// applies to source-new additions, which the install path introduced).
// ---------------------------------------------------------------------------
{
	const srcContent = {
		mcpServers: {
			mysrv: {
				command: "npx",
				env: { NEW_KEY: "${SRC_UNSET_VAR}" },
			},
		},
	};
	const initDest = {
		mcpServers: {
			mysrv: {
				command: "npx",
				env: { EXISTING: "real-value" },
			},
		},
	};
	const { threw, out } = await run(srcContent, initDest);
	const leaked = out ? scanForUnresolved(out.mcpServers, "") : [];

	// Source-new unresolved ${VAR} must still be refused.
	check(
		"G: src-new ${VAR} on preserved server IS refused",
		threw === true || leaked.length === 0,
		`threw=${threw} leaked=${JSON.stringify(leaked)}`,
	);
}

// ---------------------------------------------------------------------------
// Case H (guard): preserved server with clean dest-owned + clean src-added
// values must merge successfully without throwing.
// ---------------------------------------------------------------------------
{
	const srcContent = {
		mcpServers: {
			mysrv: {
				command: "npx",
				args: ["--extra"],
				env: { NEW_K: "new-real-value" },
			},
		},
	};
	const initDest = {
		mcpServers: {
			mysrv: {
				command: "npx",
				env: { EXISTING: "dest-real-value" },
			},
		},
	};
	const { threw, out } = await run(srcContent, initDest);
	const ok =
		threw === false &&
		out !== null &&
		out.mcpServers?.mysrv?.env?.EXISTING === "dest-real-value" &&
		out.mcpServers?.mysrv?.env?.NEW_K === "new-real-value" &&
		out.mcpServers?.mysrv?.args?.includes("--extra");
	check(
		"H: clean preserved + clean src-added merges successfully",
		ok,
		`threw=${threw} out=${JSON.stringify(out ?? null).slice(0, 150)}`,
	);
}

// ---------------------------------------------------------------------------
// Case I (M2 red): error message must distinguish source vs dest surface
// when a source-new ${VAR} IS the offender. The throw message should NOT
// hardcode `.mcp.json` regardless of which surface contributed the value.
// We assert the error message names the source file path (srcPath) rather
// than a hardcoded `.mcp.json` literal, OR at least does not falsely claim
// `.mcp.json` when the source is a temp file.
// ---------------------------------------------------------------------------
{
	const srcContent = {
		mcpServers: {
			badsrc: {
				command: "npx",
				env: { T: "${SRC_ONLY_UNSET}" },
			},
		},
	};
	const { threw, err } = await run(srcContent, {
		mcpServers: { other: { command: "npx" } },
	});

	check(
		"I: src-new ${VAR} refusal message does not hardcode .mcp.json",
		threw === true && err !== null && !/in \.mcp\.json/.test(err),
		`threw=${threw} err=${JSON.stringify(err)}`,
	);
}

for (const p of pass) console.log("ok:", p);
if (fail.length === 0) {
	console.log(`ALL ${pass.length} MF-6 CHECKS PASS`);
} else {
	for (const f of fail) console.error("FAIL:", f);
	process.exit(1);
}
