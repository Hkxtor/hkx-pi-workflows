/**
 * Project registry + per-project instinct statistics.
 *
 * GateGuard notes (first create):
 * 1. Importers/callers: scripts/instinct/cli.mjs (new `projects` subcommand);
 *    docs: commands/hkx-instinct-projects.md, docs/conversion-map.md,
 *    skills/instinct-evolve. Reuses promote.mjs loadRegistry/listProjectIds.
 * 2. Public exports: listProjectStats, formatProjectStats, countInstinctFiles.
 *    Does not mutate store; read-only over projects.json + projects/<id>/.
 * 3. Observed formats: projects.json map id→{name,remote,source,updated};
 *    meta.json optional; instincts/{personal,inherited,pending}/*.md;
 *    optional observations.jsonl line count.
 * 4. Auth: user "接按 P0 开实现" — implement hkx-instinct-projects.
 * 5. Verify: scripts/tests/instinct-prune.mjs (projects section) + npm test.
 *
 * Callers: cli.mjs projects
 * Public API: listProjectStats, formatProjectStats
 * Verify: scripts/tests/instinct-prune.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { layoutPaths } from "./paths.mjs";
import { loadRegistry, listProjectIds } from "./promote.mjs";
import { parseInstinctFile } from "./parse.mjs";

const ALLOWED_EXT = /\.(md|ya?ml)$/i;

/**
 * @param {string} directory
 */
export function countInstinctFiles(directory) {
	if (!fs.existsSync(directory)) return 0;
	try {
		return fs
			.readdirSync(directory)
			.filter((f) => ALLOWED_EXT.test(f))
			.filter((f) => {
				try {
					return fs.statSync(path.join(directory, f)).isFile();
				} catch {
					return false;
				}
			}).length;
	} catch {
		return 0;
	}
}

/**
 * Count parseable instinct ids in a directory (handles multi-instinct files).
 * @param {string} directory
 */
function countInstinctIds(directory) {
	if (!fs.existsSync(directory)) return 0;
	let n = 0;
	try {
		for (const file of fs.readdirSync(directory)) {
			if (!ALLOWED_EXT.test(file)) continue;
			const full = path.join(directory, file);
			try {
				if (!fs.statSync(full).isFile()) continue;
				const text = fs.readFileSync(full, "utf8");
				const parsed = parseInstinctFile(text);
				n += parsed.length || 1;
			} catch {
				n += 1;
			}
		}
	} catch {
		return 0;
	}
	return n;
}

/**
 * @param {string} projectBase
 */
function countObservations(projectBase) {
	const file = path.join(projectBase, "observations.jsonl");
	if (!fs.existsSync(file)) return 0;
	try {
		const text = fs.readFileSync(file, "utf8");
		if (!text.trim()) return 0;
		return text.split(/\r?\n/).filter((l) => l.trim()).length;
	} catch {
		return 0;
	}
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   remote: string | null,
 *   source: string | null,
 *   rootHint: string | null,
 *   updated: string | null,
 *   lastSeen: string | null,
 *   personal: number,
 *   inherited: number,
 *   pending: number,
 *   observations: number,
 *   base: string,
 * }} ProjectStat
 */

/**
 * @param {string} root
 * @returns {{ projects: ProjectStat[], global: { personal: number, inherited: number, pending: number }, registryCount: number }}
 */
export function listProjectStats(root) {
	const registry = loadRegistry(root);
	/** @type {ProjectStat[]} */
	const projects = [];

	for (const pid of listProjectIds(root)) {
		const base = path.join(root, "projects", pid);
		const info =
			registry[pid] && typeof registry[pid] === "object" ? registry[pid] : {};
		const personalDir = path.join(base, "instincts", "personal");
		const inheritedDir = path.join(base, "instincts", "inherited");
		const pendingDir = path.join(base, "instincts", "pending");

		/** @type {Record<string, unknown>} */
		let meta = {};
		const metaPath = path.join(base, "meta.json");
		if (fs.existsSync(metaPath)) {
			try {
				meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
			} catch {
				meta = {};
			}
		}

		const updated =
			(typeof info.updated === "string" && info.updated) ||
			(typeof meta.updated === "string" && meta.updated) ||
			null;
		const lastSeen =
			(typeof info.last_seen === "string" && info.last_seen) ||
			(typeof info.lastSeen === "string" && info.lastSeen) ||
			(typeof meta.last_seen === "string" && meta.last_seen) ||
			updated;

		projects.push({
			id: pid,
			name:
				(typeof info.name === "string" && info.name) ||
				(typeof meta.name === "string" && meta.name) ||
				pid,
			remote:
				(typeof info.remote === "string" && info.remote) ||
				(typeof meta.remote === "string" && meta.remote) ||
				null,
			source:
				(typeof info.source === "string" && info.source) ||
				(typeof meta.source === "string" && meta.source) ||
				null,
			rootHint:
				(typeof info.root === "string" && info.root) ||
				(typeof meta.root === "string" && meta.root) ||
				null,
			updated,
			lastSeen,
			personal: countInstinctIds(personalDir),
			inherited: countInstinctIds(inheritedDir),
			pending: countInstinctIds(pendingDir),
			observations: countObservations(base),
			base,
		});
	}

	projects.sort((a, b) => {
		const ta = a.lastSeen || a.updated || "";
		const tb = b.lastSeen || b.updated || "";
		return tb.localeCompare(ta) || a.name.localeCompare(b.name);
	});

	const globalLayout = layoutPaths(root, { id: "global" });
	const global = {
		personal: countInstinctIds(globalLayout.globalInstincts.personal),
		inherited: countInstinctIds(globalLayout.globalInstincts.inherited),
		pending: countInstinctIds(globalLayout.globalInstincts.pending),
	};

	return {
		projects,
		global,
		registryCount: Object.keys(registry).length,
	};
}

/**
 * Human-readable project stats.
 * @param {{ projects: ProjectStat[], global: { personal: number, inherited: number, pending: number }, registryCount: number }} stats
 * @param {{ root: string, source?: string }} meta
 */
export function formatProjectStats(stats, meta) {
	const lines = [];
	lines.push("Known projects");
	lines.push(
		`  data root: ${meta.root}${meta.source ? ` (${meta.source})` : ""}`,
	);
	lines.push(
		`  projects:  ${stats.projects.length} (registry entries: ${stats.registryCount})`,
	);
	lines.push("");

	if (!stats.projects.length) {
		lines.push("  (no projects registered yet)");
		lines.push("  Projects appear after init / learn / from-om in a git repo.");
	} else {
		for (const p of stats.projects) {
			lines.push(`  ${p.name} [${p.id}]`);
			if (p.rootHint) lines.push(`    Root: ${p.rootHint}`);
			if (p.remote) lines.push(`    Remote: ${p.remote}`);
			if (p.source) lines.push(`    Source: ${p.source}`);
			lines.push(
				`    Instincts: ${p.personal} personal, ${p.inherited} inherited, ${p.pending} pending`,
			);
			if (p.observations > 0) {
				lines.push(`    Observations: ${p.observations} events`);
			}
			if (p.lastSeen) lines.push(`    Last seen: ${p.lastSeen}`);
			lines.push("");
		}
	}

	lines.push("  GLOBAL");
	lines.push(
		`    Instincts: ${stats.global.personal} personal, ${stats.global.inherited} inherited, ${stats.global.pending} pending`,
	);
	return lines.join("\n");
}
