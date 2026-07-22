/**
 * Cross-project promote candidates and apply (project -> global).
 *
 * Callers: cli promote
 * Docs: docs/instinct-evolve-plan.md Phase 3
 * Thresholds: >=2 projects, avg confidence >= 0.8
 * Public API: listPromoteCandidates, promoteInstinct, promoteAuto
 * Auth: user "继续做 Phase 3"
 * Verify: scripts/tests/instinct-transfer.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { parseInstinctFile, serializeInstinct } from "./parse.mjs";
import { layoutPaths, isValidInstinctId } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";

export const PROMOTE_CONFIDENCE_THRESHOLD = 0.8;
export const PROMOTE_MIN_PROJECTS = 2;

/**
 * @param {string} root
 */
export function loadRegistry(root) {
	const file = path.join(root, "projects.json");
	if (!fs.existsSync(file)) return {};
	try {
		const obj = JSON.parse(fs.readFileSync(file, "utf8"));
		return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
	} catch {
		return {};
	}
}

/**
 * @param {string} directory
 * @param {string} sourceType
 */
function loadDir(directory, sourceType) {
	/** @type {import('./parse.mjs').Instinct[]} */
	const out = [];
	if (!fs.existsSync(directory)) return out;
	for (const file of fs.readdirSync(directory).sort()) {
		if (!/\.(md|ya?ml)$/i.test(file)) continue;
		const full = path.join(directory, file);
		try {
			const text = fs.readFileSync(full, "utf8");
			for (const inst of parseInstinctFile(text)) {
				inst._source_file = full;
				inst._source_type = sourceType;
				inst._scope_label = "project";
				if (typeof inst.confidence !== "number") inst.confidence = 0.5;
				out.push(inst);
			}
		} catch {
			/* skip */
		}
	}
	return out;
}

/**
 * @param {string} root
 */
export function listProjectIds(root) {
	const reg = loadRegistry(root);
	const ids = new Set(Object.keys(reg));
	const projectsDir = path.join(root, "projects");
	if (fs.existsSync(projectsDir)) {
		for (const name of fs.readdirSync(projectsDir)) {
			const p = path.join(projectsDir, name);
			try {
				if (fs.statSync(p).isDirectory()) ids.add(name);
			} catch {
				/* ignore */
			}
		}
	}
	return [...ids].sort();
}

/**
 * @param {string} root
 */
export function findCrossProjectInstincts(root) {
	/** @type {Map<string, Array<{ projectId: string, projectName: string, instinct: import('./parse.mjs').Instinct }>>} */
	const cross = new Map();
	const registry = loadRegistry(root);

	for (const pid of listProjectIds(root)) {
		const base = path.join(root, "projects", pid);
		const personal = path.join(base, "instincts", "personal");
		const inherited = path.join(base, "instincts", "inherited");
		const seen = new Set();
		const name = registry[pid]?.name || pid;
		for (const inst of [
			...loadDir(personal, "personal"),
			...loadDir(inherited, "inherited"),
		]) {
			if (!inst.id || seen.has(inst.id)) continue;
			seen.add(inst.id);
			if (!cross.has(inst.id)) cross.set(inst.id, []);
			cross.get(inst.id)?.push({
				projectId: pid,
				projectName: name,
				instinct: inst,
			});
		}
	}

	/** @type {Map<string, Array<{ projectId: string, projectName: string, instinct: import('./parse.mjs').Instinct }>>} */
	const multi = new Map();
	for (const [id, entries] of cross) {
		if (entries.length >= PROMOTE_MIN_PROJECTS) multi.set(id, entries);
	}
	return multi;
}

/**
 * @param {string} root
 */
export function loadGlobalIds(root) {
	const layout = layoutPaths(root, { id: "global" });
	const ids = new Set();
	for (const dir of [
		layout.globalInstincts.personal,
		layout.globalInstincts.inherited,
	]) {
		for (const inst of loadDir(dir, "global")) ids.add(inst.id);
	}
	return ids;
}

/**
 * @param {string} root
 * @param {{ minConfidence?: number, minProjects?: number }} [opts]
 */
export function listPromoteCandidates(root, opts = {}) {
	const minConf =
		typeof opts.minConfidence === "number"
			? opts.minConfidence
			: PROMOTE_CONFIDENCE_THRESHOLD;
	const minProjects =
		typeof opts.minProjects === "number"
			? opts.minProjects
			: PROMOTE_MIN_PROJECTS;
	const cross = findCrossProjectInstincts(root);
	const globalIds = loadGlobalIds(root);

	/** @type {Array<{ id: string, avgConfidence: number, projects: Array<{ id: string, name: string }>, sample: import('./parse.mjs').Instinct, best: import('./parse.mjs').Instinct }>} */
	const candidates = [];
	for (const [id, entries] of cross) {
		if (globalIds.has(id)) continue;
		if (entries.length < minProjects) continue;
		const avg =
			entries.reduce((s, e) => s + (e.instinct.confidence ?? 0.5), 0) /
			entries.length;
		if (avg < minConf) continue;
		const best = entries
			.map((e) => e.instinct)
			.sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))[0];
		candidates.push({
			id,
			avgConfidence: avg,
			projects: entries.map((e) => ({
				id: e.projectId,
				name: e.projectName,
			})),
			sample: entries[0].instinct,
			best,
		});
	}
	candidates.sort((a, b) => b.avgConfidence - a.avgConfidence);
	return candidates;
}

/**
 * @param {string} root
 * @param {string} instinctId
 * @param {{ dryRun?: boolean, force?: boolean, fromProjectId?: string }} [opts]
 */
export function promoteInstinct(root, instinctId, opts = {}) {
	if (!isValidInstinctId(instinctId)) {
		return { ok: false, reason: `Invalid instinct id: ${instinctId}` };
	}
	const globalIds = loadGlobalIds(root);
	if (globalIds.has(instinctId) && !opts.force) {
		return { ok: false, reason: `Already global: ${instinctId}` };
	}

	let entries = findCrossProjectInstincts(root).get(instinctId);
	if (!entries?.length) {
		entries = [];
		for (const pid of listProjectIds(root)) {
			const personal = path.join(
				root,
				"projects",
				pid,
				"instincts",
				"personal",
			);
			const inherited = path.join(
				root,
				"projects",
				pid,
				"instincts",
				"inherited",
			);
			for (const inst of [
				...loadDir(personal, "personal"),
				...loadDir(inherited, "inherited"),
			]) {
				if (inst.id === instinctId) {
					entries.push({
						projectId: pid,
						projectName: pid,
						instinct: inst,
					});
				}
			}
		}
	}
	if (!entries.length) {
		return { ok: false, reason: `Not found in any project: ${instinctId}` };
	}
	if (opts.fromProjectId) {
		entries = entries.filter((e) => e.projectId === opts.fromProjectId);
		if (!entries.length) {
			return {
				ok: false,
				reason: `Not found in project ${opts.fromProjectId}`,
			};
		}
	}
	const best = entries
		.map((e) => e.instinct)
		.sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))[0];

	const layout = layoutPaths(root, { id: "global" });
	const dest = path.join(layout.globalInstincts.personal, `${instinctId}.md`);
	const toWrite = {
		...best,
		scope: "global",
		source: best.source || "promoted",
		updated: new Date().toISOString().slice(0, 10),
	};
	const fromProjects = entries.map((e) => e.projectId);
	delete toWrite._source_file;
	delete toWrite._source_type;
	delete toWrite._scope_label;

	if (opts.dryRun) {
		return {
			ok: true,
			dryRun: true,
			id: instinctId,
			dest,
			confidence: best.confidence,
			fromProjects,
		};
	}

	let content = String(toWrite.content || "");
	if (!content.includes("promoted_from")) {
		content = `${content.trimEnd()}\n\n## Provenance\n- promoted_from: ${fromProjects.join(",")}\n- promoted_date: ${new Date().toISOString()}\n`;
		toWrite.content = content;
	}
	writeFileAtomic(dest, serializeInstinct(toWrite));
	return {
		ok: true,
		dryRun: false,
		id: instinctId,
		dest,
		confidence: best.confidence,
		fromProjects,
	};
}

/**
 * @param {string} root
 * @param {{ dryRun?: boolean, force?: boolean }} [opts]
 */
export function promoteAuto(root, opts = {}) {
	const candidates = listPromoteCandidates(root);
	/** @type {object[]} */
	const results = [];
	for (const cand of candidates) {
		results.push(
			promoteInstinct(root, cand.id, {
				dryRun: opts.dryRun,
				force: opts.force,
			}),
		);
	}
	return { candidates, results };
}
