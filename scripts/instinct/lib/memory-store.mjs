/**
 * Memory vault store under hkx-homunculus (project + user scopes).
 *
 * Callers: cli memory subcommands, scripts/tests/instinct-memory.mjs
 * Plan: .pi/plans/unified-memory-instinct-om.plan.md (M1)
 * Auth: user "proceed" on unified-memory M1
 * Verify: node scripts/tests/instinct-memory.mjs; npm test
 *
 * GateGuard (create):
 * 1. lib next to store.mjs; install copies full scripts/instinct.
 * 2. Exports: memoryDirForScope, recallMemories, saveMemory, validateMemories.
 * 3. Layout via layoutPaths projectMemory/userMemory/teamMemory.
 * 4. Auth: user proceed M1.
 * 5. Verify: instinct-memory + full npm test (from-om unchanged).
 */
import fs from "node:fs";
import path from "node:path";
import { layoutPaths, isValidInstinctId } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";
import {
	MEMORY_SCHEMA,
	parseMemoryFile,
	serializeMemory,
	slugMemoryId,
	validateMemoryDoc,
} from "./memory-schema.mjs";

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {"project"|"user"|"team"} scope
 */
export function memoryDirForScope(root, project, scope) {
	const layout = layoutPaths(root, project);
	if (scope === "project") {
		if (!layout.projectMemory) {
			throw new Error(
				"project memory requires a non-global project (run from a git repo or set HKX_PROJECT_ID)",
			);
		}
		return layout.projectMemory;
	}
	if (scope === "user") return layout.userMemory;
	if (scope === "team") return layout.teamMemory;
	throw new Error(`unknown memory scope: ${scope}`);
}

/**
 * @param {string} dir
 * @param {"project"|"user"|"team"} expectedScope
 * @returns {import('./memory-schema.mjs').MemoryDoc[]}
 */
function loadFromDir(dir, expectedScope) {
	/** @type {import('./memory-schema.mjs').MemoryDoc[]} */
	const out = [];
	if (!dir || !fs.existsSync(dir)) return out;
	const names = fs.readdirSync(dir).filter((n) => n.endsWith(".md"));
	for (const name of names) {
		const base = path.basename(name, ".md");
		if (base.includes("..") || name.includes("/") || name.includes("\\")) {
			continue;
		}
		const filePath = path.join(dir, name);
		let st;
		try {
			st = fs.statSync(filePath);
		} catch {
			continue;
		}
		if (!st.isFile()) continue;
		let raw;
		try {
			raw = fs.readFileSync(filePath, "utf8");
		} catch {
			continue;
		}
		const parsed = parseMemoryFile(raw);
		if (!parsed.ok) continue;
		if (parsed.doc.scope !== expectedScope) continue;
		if (path.basename(filePath, ".md") !== parsed.doc.id) continue;
		out.push({ ...parsed.doc, _filePath: filePath });
	}
	return out;
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ scope?: "project"|"user", tag?: string, id?: string, query?: string }} [opts]
 */
export function recallMemories(root, project, opts = {}) {
	const scope = opts.scope ?? "project";
	if (scope === "team") {
		return {
			ok: true,
			scope,
			items: [],
			note: "team recall not enabled in M1",
		};
	}
	if (scope !== "project" && scope !== "user") {
		throw new Error(`recall scope must be project|user, got ${scope}`);
	}
	const dir = memoryDirForScope(root, project, scope);
	let items = loadFromDir(dir, scope);
	if (opts.id) {
		items = items.filter((d) => d.id === opts.id);
	}
	if (opts.tag) {
		const t = opts.tag.toLowerCase();
		items = items.filter((d) =>
			(d.tags || []).some((x) => String(x).toLowerCase() === t),
		);
	}
	if (opts.query) {
		const q = opts.query.toLowerCase();
		items = items.filter((d) => {
			const hay =
				`${d.title}\n${d.body ?? ""}\n${(d.tags || []).join(" ")}`.toLowerCase();
			return hay.includes(q) || d.id.toLowerCase().includes(q);
		});
	}
	items.sort((a, b) => a.id.localeCompare(b.id));
	return { ok: true, scope, dir, items };
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {Partial<import('./memory-schema.mjs').MemoryDoc> & { title: string }} input
 * @param {{ apply?: boolean }} [opts]
 */
export function saveMemory(root, project, input, opts = {}) {
	const apply = Boolean(opts.apply);
	const scope = input.scope ?? "project";
	if (scope === "team") {
		return {
			ok: false,
			error: "team scope writes are disabled in M1 (directory stub only)",
			apply: false,
		};
	}
	if (scope !== "project" && scope !== "user") {
		return { ok: false, error: `invalid scope ${scope}`, apply: false };
	}
	const id =
		input.id && isValidInstinctId(input.id)
			? input.id
			: slugMemoryId(input.title);
	const today = new Date().toISOString().slice(0, 10);
	/** @type {import('./memory-schema.mjs').MemoryDoc} */
	const doc = {
		schema: MEMORY_SCHEMA,
		id,
		scope,
		title: input.title,
		tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
		created: input.created || today,
		updated: input.updated || today,
		source: input.source || "manual",
		body: input.body ?? "",
	};
	const checked = validateMemoryDoc(doc);
	if (!checked.ok) {
		return { ok: false, error: checked.error, apply: false };
	}
	const dir = memoryDirForScope(root, project, scope);
	const filePath = path.join(dir, `${checked.doc.id}.md`);
	const resolved = path.resolve(filePath);
	const resolvedDir = path.resolve(dir);
	if (
		resolved !== resolvedDir &&
		!resolved.startsWith(resolvedDir + path.sep)
	) {
		return { ok: false, error: "path escape rejected", apply: false };
	}
	const content = serializeMemory(checked.doc);
	if (!apply) {
		return {
			ok: true,
			apply: false,
			filePath,
			doc: checked.doc,
			preview: content,
		};
	}
	fs.mkdirSync(dir, { recursive: true });
	writeFileAtomic(filePath, content);
	return {
		ok: true,
		apply: true,
		filePath,
		doc: { ...checked.doc, _filePath: filePath },
	};
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ scope?: "project"|"user"|"all" }} [opts]
 */
export function validateMemories(root, project, opts = {}) {
	const scopeOpt = opts.scope ?? "all";
	/** @type {{ scope: string, dir: string }[]} */
	const targets = [];
	const layout = layoutPaths(root, project);
	if (scopeOpt === "project" || scopeOpt === "all") {
		if (layout.projectMemory) {
			targets.push({ scope: "project", dir: layout.projectMemory });
		}
	}
	if (scopeOpt === "user" || scopeOpt === "all") {
		targets.push({ scope: "user", dir: layout.userMemory });
	}
	if (scopeOpt === "all" && layout.teamMemory) {
		targets.push({ scope: "team", dir: layout.teamMemory });
	}

	/** @type {{ file: string, error: string }[]} */
	const errors = [];
	/** @type {{ file: string, id: string, scope: string }[]} */
	const okFiles = [];
	let scanned = 0;

	for (const t of targets) {
		if (!fs.existsSync(t.dir)) continue;
		for (const name of fs.readdirSync(t.dir)) {
			if (!name.endsWith(".md")) continue;
			scanned += 1;
			const filePath = path.join(t.dir, name);
			if (name.includes("..")) {
				errors.push({ file: filePath, error: "illegal filename" });
				continue;
			}
			let raw;
			try {
				raw = fs.readFileSync(filePath, "utf8");
			} catch (err) {
				errors.push({
					file: filePath,
					error: `read failed: ${/** @type {Error} */ (err).message}`,
				});
				continue;
			}
			const parsed = parseMemoryFile(raw);
			if (!parsed.ok) {
				errors.push({ file: filePath, error: parsed.error });
				continue;
			}
			if (parsed.doc.scope !== t.scope) {
				errors.push({
					file: filePath,
					error: `scope mismatch: doc=${parsed.doc.scope} dir=${t.scope}`,
				});
				continue;
			}
			const stem = path.basename(name, ".md");
			if (stem !== parsed.doc.id) {
				errors.push({
					file: filePath,
					error: `filename stem "${stem}" != id "${parsed.doc.id}"`,
				});
				continue;
			}
			okFiles.push({
				file: filePath,
				id: parsed.doc.id,
				scope: parsed.doc.scope,
			});
		}
	}

	return {
		ok: errors.length === 0,
		scanned,
		okCount: okFiles.length,
		errors,
		okFiles,
	};
}
