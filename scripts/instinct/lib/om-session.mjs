/**
 * Offline OM V3 session ledger fold (full tip projection semantics).
 *
 * Reads Pi session JSONL custom entries:
 *   om.observations.recorded | om.reflections.recorded | om.observations.dropped
 *
 * Callers: cli from-om, tests
 * Docs: docs/instinct-evolve-plan.md Phase 2 / C6
 * Public API: projectSessionFile, resolveSessionPath, fullProjectionFromEntries
 * Auth: user "做 Phase 2：from-om + accept"
 * Verify: scripts/tests/instinct-om.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const OM_OBSERVATIONS_RECORDED = "om.observations.recorded";
export const OM_REFLECTIONS_RECORDED = "om.reflections.recorded";
export const OM_OBSERVATIONS_DROPPED = "om.observations.dropped";

const RELEVANCE = new Set(["low", "medium", "high", "critical"]);

/**
 * @param {unknown} value
 */
export function isObservation(value) {
	if (!value || typeof value !== "object") return false;
	const o = /** @type {Record<string, unknown>} */ (value);
	return (
		typeof o.id === "string" &&
		typeof o.content === "string" &&
		o.content.length > 0 &&
		typeof o.timestamp === "string" &&
		typeof o.relevance === "string" &&
		RELEVANCE.has(o.relevance) &&
		Array.isArray(o.sourceEntryIds) &&
		typeof o.tokenCount === "number"
	);
}

/**
 * @param {unknown} value
 */
export function isReflection(value) {
	if (!value || typeof value !== "object") return false;
	const r = /** @type {Record<string, unknown>} */ (value);
	return (
		typeof r.id === "string" &&
		typeof r.content === "string" &&
		r.content.length > 0 &&
		!/\r|\n/.test(r.content) &&
		Array.isArray(r.supportingObservationIds) &&
		typeof r.tokenCount === "number"
	);
}

/**
 * @param {string} cwd
 */
export function sessionDirNameForCwd(cwd) {
	let p = path.resolve(cwd).replace(/\\/g, "/");
	p = p.replace(/^\/+/, "");
	p = p.replace(/:/g, "");
	p = p.replace(/[/\\]+/g, "-");
	p = p.replace(/-+/g, "-").replace(/^-|-$/g, "");
	return `--${p}--`;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveSessionsRoot(env = process.env) {
	if (env.HKX_PI_SESSIONS_DIR && path.isAbsolute(env.HKX_PI_SESSIONS_DIR)) {
		return env.HKX_PI_SESSIONS_DIR;
	}
	return path.join(os.homedir(), ".pi", "agent", "sessions");
}

/**
 * @param {string} filePath
 * @returns {Array<Record<string, unknown>>}
 */
export function loadSessionEntries(filePath) {
	const text = fs.readFileSync(filePath, "utf8");
	const lines = text.split(/\r?\n/);
	/** @type {Array<Record<string, unknown>>} */
	const entries = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const obj = JSON.parse(trimmed);
			if (obj && typeof obj === "object" && typeof obj.id === "string") {
				entries.push(obj);
			}
		} catch {
			/* skip */
		}
	}
	return entries;
}

/**
 * @param {Array<Record<string, unknown>>} entries
 */
export function fullProjectionFromEntries(entries) {
	const indexes = new Map();
	for (let i = 0; i < entries.length; i++) {
		const id = entries[i].id;
		if (typeof id === "string") indexes.set(id, i);
	}
	const tip = entries.length - 1;

	/** @type {Map<string, object>} */
	const observationsById = new Map();
	/** @type {Map<string, object>} */
	const reflectionsById = new Map();
	/** @type {Set<string>} */
	const dropped = new Set();

	/**
	 * @param {Record<string, unknown>} entry
	 */
	function covered(entry) {
		const data = entry.data;
		if (!data || typeof data !== "object") return tip >= 0;
		const covers = /** @type {Record<string, unknown>} */ (data).coversUpToId;
		if (typeof covers !== "string") return tip >= 0;
		const idx = indexes.get(covers);
		return idx !== undefined && idx <= tip && tip >= 0;
	}

	for (const entry of entries) {
		if (entry.type !== "custom") continue;
		const ct = entry.customType;
		if (ct === OM_OBSERVATIONS_RECORDED && covered(entry)) {
			const data = /** @type {Record<string, unknown>} */ (entry.data || {});
			const list = Array.isArray(data.observations) ? data.observations : [];
			for (const obs of list) {
				if (!isObservation(obs)) continue;
				if (observationsById.has(obs.id)) continue;
				observationsById.set(obs.id, obs);
			}
		} else if (ct === OM_REFLECTIONS_RECORDED && covered(entry)) {
			const data = /** @type {Record<string, unknown>} */ (entry.data || {});
			const list = Array.isArray(data.reflections) ? data.reflections : [];
			for (const ref of list) {
				if (!isReflection(ref)) continue;
				if (reflectionsById.has(ref.id)) continue;
				reflectionsById.set(ref.id, ref);
			}
		} else if (ct === OM_OBSERVATIONS_DROPPED && covered(entry)) {
			const data = /** @type {Record<string, unknown>} */ (entry.data || {});
			const ids = Array.isArray(data.observationIds) ? data.observationIds : [];
			for (const id of ids) {
				if (typeof id === "string") dropped.add(id);
			}
		}
	}

	const observations = [...observationsById.values()].filter(
		(o) => !dropped.has(/** @type {{ id: string }} */ (o).id),
	);
	return { observations, reflections: [...reflectionsById.values()] };
}

/**
 * @param {string} filePath
 */
export function projectSessionFile(filePath) {
	const entries = loadSessionEntries(filePath);
	const projection = fullProjectionFromEntries(entries);
	return {
		filePath,
		entryCount: entries.length,
		...projection,
	};
}

/**
 * @param {{ session?: string, cwd?: string, sessionsRoot?: string }} opts
 * @returns {string | null}
 */
export function resolveSessionPath(opts = {}) {
	const sessionsRoot = opts.sessionsRoot ?? resolveSessionsRoot();
	const cwd = opts.cwd ?? process.cwd();
	const session = opts.session;

	if (session) {
		if (fs.existsSync(session) && fs.statSync(session).isFile()) {
			return path.resolve(session);
		}
		if (!fs.existsSync(sessionsRoot)) return null;
		/** @type {string[]} */
		const matches = [];
		const walk = (dir, depth) => {
			if (depth > 4) return;
			let ents;
			try {
				ents = fs.readdirSync(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const ent of ents) {
				const full = path.join(dir, ent.name);
				if (ent.isDirectory()) walk(full, depth + 1);
				else if (
					ent.isFile() &&
					ent.name.endsWith(".jsonl") &&
					(ent.name.includes(session) || full.includes(session))
				) {
					matches.push(full);
				}
			}
		};
		walk(sessionsRoot, 0);
		if (!matches.length) return null;
		matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
		return matches[0];
	}

	const dirName = sessionDirNameForCwd(cwd);
	const projectDir = path.join(sessionsRoot, dirName);
	if (!fs.existsSync(projectDir)) return null;
	/** @type {string[]} */
	const files = [];
	for (const name of fs.readdirSync(projectDir)) {
		if (!name.endsWith(".jsonl")) continue;
		const full = path.join(projectDir, name);
		try {
			if (fs.statSync(full).isFile()) files.push(full);
		} catch {
			/* ignore */
		}
	}
	if (!files.length) return null;
	files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	return files[0];
}
