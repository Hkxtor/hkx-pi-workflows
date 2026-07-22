/**
 * Load / merge project + global instincts.
 * Project-scoped wins on id conflict.
 *
 * Callers: cli.mjs
 * Docs: docs/instinct-evolve-plan.md Phase 1 store
 * Public API: loadAllInstincts, writeInstinct, listPending, acceptPending
 * Auth: user "开工" Phase 1 + Phase 2 accept
 * Verify: npm test; node scripts/instinct/cli.mjs status|evolve|accept
 */
import fs from "node:fs";
import path from "node:path";
import { parseInstinctFile, serializeInstinct } from "./parse.mjs";
import { layoutPaths, isValidInstinctId } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";

const ALLOWED_EXT = new Set([".md", ".yaml", ".yml"]);

/**
 * @param {string} directory
 * @param {string} sourceType
 * @param {string} scopeLabel
 */
function loadFromDir(directory, sourceType, scopeLabel) {
	/** @type {import('./parse.mjs').Instinct[]} */
	const out = [];
	if (!fs.existsSync(directory)) return out;
	const files = fs
		.readdirSync(directory)
		.filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
		.sort();
	for (const file of files) {
		const full = path.join(directory, file);
		try {
			const text = fs.readFileSync(full, "utf8");
			for (const inst of parseInstinctFile(text)) {
				inst._source_file = full;
				inst._source_type = sourceType;
				inst._scope_label = scopeLabel;
				if (!inst.scope) inst.scope = scopeLabel;
				if (typeof inst.confidence !== "number") inst.confidence = 0.5;
				out.push(inst);
			}
		} catch (err) {
			console.error(
				`Warning: failed to parse ${full}: ${/** @type {Error} */ (err).message}`,
			);
		}
	}
	return out;
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ includeGlobal?: boolean, includePending?: boolean }} [opts]
 */
export function loadAllInstincts(root, project, opts = {}) {
	const includeGlobal = opts.includeGlobal !== false;
	const includePending = opts.includePending === true;
	const layout = layoutPaths(root, project);

	/** @type {import('./parse.mjs').Instinct[]} */
	let projectInstincts = [];
	if (layout.projectInstincts) {
		projectInstincts = [
			...loadFromDir(layout.projectInstincts.personal, "personal", "project"),
			...loadFromDir(layout.projectInstincts.inherited, "inherited", "project"),
		];
		if (includePending) {
			projectInstincts.push(
				...loadFromDir(layout.projectInstincts.pending, "pending", "project"),
			);
		}
	}

	/** @type {import('./parse.mjs').Instinct[]} */
	let globalInstincts = [];
	if (includeGlobal) {
		globalInstincts = [
			...loadFromDir(layout.globalInstincts.personal, "personal", "global"),
			...loadFromDir(layout.globalInstincts.inherited, "inherited", "global"),
		];
		if (includePending) {
			globalInstincts.push(
				...loadFromDir(layout.globalInstincts.pending, "pending", "global"),
			);
		}
	}

	const byId = new Map();
	for (const inst of globalInstincts) byId.set(inst.id, inst);
	for (const inst of projectInstincts) byId.set(inst.id, inst);
	return [...byId.values()];
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {import('./parse.mjs').Instinct} inst
 * @param {"personal"|"pending"} bucket
 * @param {"project"|"global"} scope
 */
export function writeInstinct(
	root,
	project,
	inst,
	bucket = "personal",
	scope = "project",
) {
	if (!isValidInstinctId(inst.id)) {
		throw new Error(
			`Invalid instinct id "${inst.id}" (use [a-z0-9][a-z0-9._-]*)`,
		);
	}
	const layout = layoutPaths(root, project);
	let dir;
	if (scope === "global" || project.id === "global") {
		dir = layout.globalInstincts[bucket];
	} else {
		dir = layout.projectInstincts?.[bucket];
	}
	if (!dir) throw new Error("Cannot resolve instinct directory");
	const filePath = path.join(dir, `${inst.id}.md`);
	writeFileAtomic(filePath, serializeInstinct(inst));
	return filePath;
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{"project"|"global"|"all"}} [scope]
 */
export function listPending(root, project, scope = "project") {
	const layout = layoutPaths(root, project);
	/** @type {import('./parse.mjs').Instinct[]} */
	const out = [];
	if (scope !== "global" && layout.projectInstincts) {
		out.push(
			...loadFromDir(layout.projectInstincts.pending, "pending", "project"),
		);
	}
	if (scope !== "project") {
		out.push(
			...loadFromDir(layout.globalInstincts.pending, "pending", "global"),
		);
	}
	return out;
}

/**
 * Move pending instincts to personal. Default conflict: skip existing personal id.
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ ids?: string[], all?: boolean, scope?: "project"|"global", force?: boolean }}
 * @returns {{ accepted: string[], skipped: Array<{ id: string, reason: string }>, missing: string[] }}
 */
export function acceptPending(root, project, opts = {}) {
	const scope = opts.scope === "global" ? "global" : "project";
	const layout = layoutPaths(root, project);
	const pendingDir =
		scope === "global"
			? layout.globalInstincts.pending
			: layout.projectInstincts?.pending;
	const personalDir =
		scope === "global"
			? layout.globalInstincts.personal
			: layout.projectInstincts?.personal;
	if (!pendingDir || !personalDir) {
		throw new Error("Cannot resolve pending/personal directories for scope");
	}

	const pending = loadFromDir(pendingDir, "pending", scope);
	/** @type {import('./parse.mjs').Instinct[]} */
	let selected = [];
	/** @type {string[]} */
	const missing = [];

	if (opts.all) {
		selected = pending;
	} else if (opts.ids?.length) {
		const byId = new Map(pending.map((p) => [p.id, p]));
		for (const id of opts.ids) {
			const inst = byId.get(id);
			if (inst) selected.push(inst);
			else missing.push(id);
		}
	} else {
		throw new Error("accept requires --all or one or more instinct ids");
	}

	/** @type {string[]} */
	const accepted = [];
	/** @type {Array<{ id: string, reason: string }>} */
	const skipped = [];

	for (const inst of selected) {
		const dest = path.join(personalDir, `${inst.id}.md`);
		const src = inst._source_file || path.join(pendingDir, `${inst.id}.md`);
		if (fs.existsSync(dest) && !opts.force) {
			skipped.push({ id: inst.id, reason: "personal already exists" });
			continue;
		}
		const toWrite = { ...inst, scope, source: inst.source || "om-reflection" };
		delete toWrite._source_file;
		delete toWrite._source_type;
		delete toWrite._scope_label;
		writeFileAtomic(dest, serializeInstinct(toWrite));
		try {
			if (
				src &&
				fs.existsSync(src) &&
				path.resolve(src) !== path.resolve(dest)
			) {
				fs.unlinkSync(src);
			}
		} catch {
			/* keep personal even if pending delete fails */
		}
		accepted.push(inst.id);
	}

	return { accepted, skipped, missing };
}
