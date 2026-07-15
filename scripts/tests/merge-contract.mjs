import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { readFileSync } from "node:fs";

import { scanServerForRefusal } from "../lib/mcp-resolver.mjs";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hkx-merge-smoke-"));
const installSrc = readFileSync("scripts/install.mjs", "utf8");
const start = installSrc.indexOf("function isPlainObject");
const end = installSrc.indexOf("/** Deep-merge");
const helperCode = installSrc.slice(start, end);
const ctx = {
	console,
	structuredClone,
	pathExists: async (p) => {
		try {
			await fs.access(p);
			return true;
		} catch {
			return false;
		}
	},
	// MF-6: install.mjs::mergeMcpServers now calls scanServerForRefusal from
	// the shared module; expose it on the vm ctx so the sliced mergeMcpServers
	// body can resolve the global reference at call time.
	scanServerForRefusal,
	fs,
	Error,
	Date,
	Object,
	Array,
	Boolean,
	JSON,
	Promise,
};
vm.createContext(ctx);
vm.runInContext(
	helperCode + "\nthis.__mergeMcpConfig = mergeMcpConfig;\n",
	ctx,
);
const mergeMcpConfig = ctx.__mergeMcpConfig;

const src = path.join(tmpDir, "src.json");
const dest = path.join(tmpDir, "dest.json");

await fs.writeFile(
	src,
	JSON.stringify({
		mcpServers: { a: { command: "npx", env: { T: "PLACEHOLDER" } } },
	}),
);
await mergeMcpConfig(src, dest);
console.log("ok: new dest merge");

await fs.writeFile(
	dest,
	JSON.stringify(
		{ mcpServers: { a: { command: "npx", env: { T: "REAL_TOKEN", X: "1" } } } },
		null,
		2,
	),
);
await fs.writeFile(
	src,
	JSON.stringify(
		{
			mcpServers: {
				a: { command: "npx-new", env: { T: "pkg", X: "pkg", Y: "new" } },
			},
		},
		null,
		2,
	),
);
await mergeMcpConfig(src, dest);
let out;
try {
	out = JSON.parse(await fs.readFile(dest, "utf8"));
} catch (err) {
	console.error("FAIL: dest JSON parse after merge:", err.message);
	process.exit(1);
}
if (!out || !out.mcpServers || !out.mcpServers.a || !out.mcpServers.a.env)
	throw new Error("merged dest missing expected server/env");
if (out.mcpServers.a.env.T !== "REAL_TOKEN")
	throw new Error("dest token must win, got " + out.mcpServers.a.env.T);
if (out.mcpServers.a.env.X !== "1")
	throw new Error("dest env X must win, got " + out.mcpServers.a.env.X);
if (out.mcpServers.a.env.Y !== "new")
	throw new Error("src only fills missing Y");
console.log("ok: merge preserves tokens");

const bad = path.join(tmpDir, "bad.json");
await fs.writeFile(bad, "{ not-json");
let failed = false;
try {
	await mergeMcpConfig(src, bad);
} catch {
	failed = true;
}
if (!failed) throw new Error("corrupt dest must throw");
const stillBad = await fs.readFile(bad, "utf8");
if (stillBad !== "{ not-json")
	throw new Error("corrupt dest must not be rewritten");
console.log("ok: corrupt dest hard-fails without rewrite");
console.log("ALL MERGE CONTRACTS STILL PASS");
