/**
 * Export / import instinct bundles (UTF-8 LF).
 *
 * Callers: cli export|import
 * Docs: docs/instinct-evolve-plan.md Phase 3
 * Public API: formatExportBundle, collectExportInstincts, importInstinctBundle, importFromEccHomunculus
 * Auth: user "继续做 Phase 3"
 * Verify: scripts/tests/instinct-transfer.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { parseInstinctFile, serializeInstinct } from "./parse.mjs";
import { layoutPaths, isValidInstinctId } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";
import { loadAllInstincts, writeInstinct } from "./store.mjs";

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
		.filter((f) =>
			[".md", ".yaml", ".yml"].includes(path.extname(f).toLowerCase()),
		)
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
 */
export function loadProjectOnlyInstincts(root, project) {
	const layout = layoutPaths(root, project);
	if (!layout.projectInstincts) return [];
	return [
		...loadFromDir(layout.projectInstincts.personal, "personal", "project"),
		...loadFromDir(layout.projectInstincts.inherited, "inherited", "project"),
	];
}

/**
 * @param {string} root
 */
export function loadGlobalOnlyInstincts(root) {
	const layout = layoutPaths(root, { id: "global" });
	return [
		...loadFromDir(layout.globalInstincts.personal, "personal", "global"),
		...loadFromDir(layout.globalInstincts.inherited, "inherited", "global"),
	];
}

/**
 * @param {import('./parse.mjs').Instinct[]} instincts
 * @param {{ project?: { id: string, name?: string }, scope?: string }} meta
 */
export function formatExportBundle(instincts, meta = {}) {
	const lines = [
		`# Instincts export`,
		`# Date: ${new Date().toISOString()}`,
		`# Total: ${instincts.length}`,
	];
	if (meta.scope) lines.push(`# Scope: ${meta.scope}`);
	if (meta.project && meta.project.id !== "global") {
		lines.push(
			`# Project: ${meta.project.name ?? meta.project.id} (${meta.project.id})`,
		);
	}
	lines.push("");
	for (const inst of instincts) {
		const clean = { ...inst };
		delete clean._source_file;
		delete clean._source_type;
		delete clean._scope_label;
		lines.push(serializeInstinct(clean).trimEnd());
		lines.push("");
	}
	return `${lines.join("\n").replace(/\r\n/g, "\n")}\n`;
}

/**
 * @param {string} root
 * @param {{ id: string, name?: string }} project
 * @param {{ scope?: "project"|"global"|"all", domain?: string, minConfidence?: number }} [opts]
 */
export function collectExportInstincts(root, project, opts = {}) {
	const scope = opts.scope || "all";
	/** @type {import('./parse.mjs').Instinct[]} */
	let instincts;
	if (scope === "project") instincts = loadProjectOnlyInstincts(root, project);
	else if (scope === "global") instincts = loadGlobalOnlyInstincts(root);
	else instincts = loadAllInstincts(root, project, { includePending: false });

	if (opts.domain) {
		instincts = instincts.filter(
			(i) => (i.domain || "general") === opts.domain,
		);
	}
	if (typeof opts.minConfidence === "number") {
		instincts = instincts.filter(
			(i) => (i.confidence ?? 0.5) >= opts.minConfidence,
		);
	}
	return instincts;
}

/**
 * @param {string} content
 * @param {string} root
 * @param {{ id: string, name?: string }} project
 * @param {{ scope?: "project"|"global", minConfidence?: number, dryRun?: boolean, bucket?: "personal"|"inherited" }} [opts]
 */
export function importInstinctBundle(content, root, project, opts = {}) {
	const targetScope =
		opts.scope === "global" || project.id === "global" ? "global" : "project";
	const minConf =
		typeof opts.minConfidence === "number" ? opts.minConfidence : 0;
	const bucket = opts.bucket === "inherited" ? "inherited" : "personal";

	const parsed = parseInstinctFile(content);
	if (!parsed.length) {
		return {
			ok: false,
			reason: "No valid instincts found in source",
			toAdd: [],
			toUpdate: [],
			duplicates: [],
			written: [],
		};
	}

	/** @type {Map<string, import('./parse.mjs').Instinct>} */
	const best = new Map();
	for (const inst of parsed) {
		if (!inst.id || !isValidInstinctId(inst.id)) continue;
		const prev = best.get(inst.id);
		if (!prev || (inst.confidence ?? 0.5) > (prev.confidence ?? 0.5)) {
			best.set(inst.id, inst);
		}
	}
	const incoming = [...best.values()].filter(
		(i) => (i.confidence ?? 0.5) >= minConf,
	);

	const existing =
		targetScope === "global"
			? loadGlobalOnlyInstincts(root)
			: loadProjectOnlyInstincts(root, project);
	const existingById = new Map(existing.map((e) => [e.id, e]));

	/** @type {import('./parse.mjs').Instinct[]} */
	const toAdd = [];
	/** @type {import('./parse.mjs').Instinct[]} */
	const toUpdate = [];
	/** @type {import('./parse.mjs').Instinct[]} */
	const duplicates = [];

	for (const inst of incoming) {
		const cur = existingById.get(inst.id);
		if (!cur) toAdd.push(inst);
		else if ((inst.confidence ?? 0.5) > (cur.confidence ?? 0.5))
			toUpdate.push(inst);
		else duplicates.push(inst);
	}

	/** @type {string[]} */
	const written = [];
	if (!opts.dryRun) {
		const layout = layoutPaths(root, project);
		for (const inst of [...toAdd, ...toUpdate]) {
			const toWrite = {
				...inst,
				scope: targetScope,
				source: inst.source || "import",
			};
			delete toWrite._source_file;
			delete toWrite._source_type;
			delete toWrite._scope_label;

			if (bucket === "inherited") {
				const dir =
					targetScope === "global"
						? layout.globalInstincts.inherited
						: layout.projectInstincts?.inherited;
				if (!dir) throw new Error("Cannot resolve inherited dir");
				const filePath = path.join(dir, `${inst.id}.md`);
				writeFileAtomic(filePath, serializeInstinct(toWrite));
				written.push(filePath);
			} else {
				written.push(
					writeInstinct(root, project, toWrite, "personal", targetScope),
				);
			}
		}
	}

	return {
		ok: true,
		targetScope,
		toAdd,
		toUpdate,
		duplicates,
		written,
		dryRun: !!opts.dryRun,
	};
}

/**
 * @param {string} eccRoot
 * @param {string} root
 * @param {{ id: string, name?: string }} project
 * @param {{ dryRun?: boolean, minConfidence?: number, scope?: "project"|"global" }} [opts]
 */
export function importFromEccHomunculus(eccRoot, root, project, opts = {}) {
	if (!fs.existsSync(eccRoot) || !fs.statSync(eccRoot).isDirectory()) {
		return {
			ok: false,
			reason: `ECC path not a directory: ${eccRoot}`,
			toAdd: [],
			toUpdate: [],
			duplicates: [],
			written: [],
		};
	}
	/** @type {string[]} */
	const chunks = [];
	const collect = (dir) => {
		if (!fs.existsSync(dir)) return;
		for (const f of fs.readdirSync(dir)) {
			const full = path.join(dir, f);
			if (fs.statSync(full).isFile() && /\.(md|ya?ml)$/i.test(f)) {
				chunks.push(fs.readFileSync(full, "utf8"));
			}
		}
	};
	collect(path.join(eccRoot, "instincts", "personal"));
	collect(path.join(eccRoot, "instincts", "inherited"));
	const projectsDir = path.join(eccRoot, "projects");
	if (fs.existsSync(projectsDir)) {
		for (const pid of fs.readdirSync(projectsDir)) {
			const pdir = path.join(projectsDir, pid);
			if (!fs.statSync(pdir).isDirectory()) continue;
			collect(path.join(pdir, "instincts", "personal"));
			collect(path.join(pdir, "instincts", "inherited"));
		}
	}
	if (!chunks.length) {
		return {
			ok: false,
			reason: "No instinct files found under ECC homunculus tree",
			toAdd: [],
			toUpdate: [],
			duplicates: [],
			written: [],
		};
	}
	return importInstinctBundle(chunks.join("\n"), root, project, {
		scope: opts.scope,
		minConfidence: opts.minConfidence,
		dryRun: opts.dryRun,
		bucket: "inherited",
	});
}
