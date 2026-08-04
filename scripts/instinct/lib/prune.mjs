/**
 * Prune expired pending instincts (ECC continuous-learning-v2 parity).
 *
 * GateGuard notes (first create):
 * 1. Importers/callers: scripts/instinct/cli.mjs (new `prune` subcommand);
 *    docs: commands/instinct-prune.md, docs/conversion-map.md, skills/instinct-evolve.
 * 2. Public exports: DEFAULT_PENDING_TTL_DAYS, ageDays, resolvePendingCreated,
 *    planPrune, applyPrune. Reuses loadRegistry/listProjectIds (promote.mjs),
 *    parseActivityDate (decay.mjs), parseInstinctFile, layoutPaths.
 * 3. Observed formats: pending/*.md with frontmatter created/updated/last_seen
 *    (ISO or YYYY-MM-DD); age_days = floor((asOf-created)/1d); TTL default 30.
 * 4. Auth: user "接按 P0 开实现" — implement hkx-prune + CLI.
 * 5. Verify: scripts/tests/instinct-prune.mjs + npm test + npm run validate.
 *
 * Safety: plan is always non-destructive; applyPrune deletes only when dryRun=false.
 * CLI defaults to preview; require --apply to delete (stricter than ECC default).
 *
 * Callers: cli.mjs prune
 * Public API: DEFAULT_PENDING_TTL_DAYS, planPrune, applyPrune, ageDays, resolvePendingCreated
 * Verify: scripts/tests/instinct-prune.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { parseInstinctFile } from "./parse.mjs";
import { layoutPaths } from "./paths.mjs";
import { loadRegistry, listProjectIds } from "./promote.mjs";
import { parseActivityDate } from "./decay.mjs";

export const DEFAULT_PENDING_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ALLOWED_EXT = /\.(md|ya?ml)$/i;

/**
 * @param {Date} created
 * @param {Date} [asOf]
 */
export function ageDays(created, asOf = new Date()) {
	const delta = asOf.getTime() - created.getTime();
	if (delta <= 0) return 0;
	return Math.floor(delta / MS_PER_DAY);
}

/**
 * Resolve age anchor for a pending file (created → updated → last_seen → mtime).
 * @param {import('./parse.mjs').Instinct | null} inst
 * @param {string} filePath
 * @returns {{ at: Date, source: string } | null}
 */
export function resolvePendingCreated(inst, filePath) {
	if (inst) {
		const rec = /** @type {Record<string, unknown>} */ (inst);
		for (const key of ["created", "updated", "last_seen"]) {
			const d = parseActivityDate(rec[key]);
			if (d) return { at: d, source: key };
		}
	}
	try {
		if (fs.existsSync(filePath)) {
			return { at: fs.statSync(filePath).mtime, source: "mtime" };
		}
	} catch {
		/* ignore */
	}
	return null;
}

/**
 * @typedef {{
 *   id: string,
 *   filePath: string,
 *   scope: string,
 *   projectId: string | null,
 *   projectName: string | null,
 *   ageDays: number,
 *   created: string,
 *   createdSource: string,
 *   confidence: number | null,
 *   expired: boolean,
 * }} PrunePlanItem
 */

/**
 * @param {string} dir
 * @param {string} scopeLabel
 * @param {string | null} projectId
 * @param {string | null} projectName
 * @param {Date} asOf
 * @returns {PrunePlanItem[]}
 */
function scanPendingDir(dir, scopeLabel, projectId, projectName, asOf) {
	/** @type {PrunePlanItem[]} */
	const out = [];
	if (!fs.existsSync(dir)) return out;
	let files;
	try {
		files = fs
			.readdirSync(dir)
			.filter((f) => ALLOWED_EXT.test(f))
			.sort();
	} catch {
		return out;
	}
	for (const file of files) {
		const filePath = path.join(dir, file);
		try {
			if (!fs.statSync(filePath).isFile()) continue;
		} catch {
			continue;
		}
		/** @type {import('./parse.mjs').Instinct | null} */
		let inst = null;
		try {
			const text = fs.readFileSync(filePath, "utf8");
			const parsed = parseInstinctFile(text);
			inst = parsed[0] ?? null;
		} catch {
			inst = null;
		}
		const anchor = resolvePendingCreated(inst, filePath);
		if (!anchor) continue;
		const days = ageDays(anchor.at, asOf);
		const id = inst?.id || path.basename(file, path.extname(file));
		out.push({
			id,
			filePath,
			scope: scopeLabel,
			projectId,
			projectName,
			ageDays: days,
			created: anchor.at.toISOString(),
			createdSource: anchor.source,
			confidence:
				typeof inst?.confidence === "number" && Number.isFinite(inst.confidence)
					? inst.confidence
					: null,
			expired: false,
		});
	}
	return out;
}

/**
 * Plan pending instinct pruning across project and/or global pending dirs.
 *
 * @param {string} root
 * @param {{ id: string, name?: string }} project current project (used when scope=project)
 * @param {{
 *   maxAgeDays?: number,
 *   asOf?: Date,
 *   scope?: "project"|"global"|"all",
 * }} [opts]
 * @returns {{ items: PrunePlanItem[], expired: PrunePlanItem[], remaining: PrunePlanItem[], maxAgeDays: number }}
 */
export function planPrune(root, project, opts = {}) {
	const maxAgeDays =
		typeof opts.maxAgeDays === "number" && Number.isFinite(opts.maxAgeDays)
			? Math.max(0, Math.floor(opts.maxAgeDays))
			: DEFAULT_PENDING_TTL_DAYS;
	const asOf = opts.asOf ?? new Date();
	const scope =
		opts.scope === "project" || opts.scope === "global" ? opts.scope : "all";
	const registry = loadRegistry(root);

	/** @type {PrunePlanItem[]} */
	const items = [];

	if (scope !== "global") {
		if (scope === "project") {
			const layout = layoutPaths(root, project);
			if (layout.projectInstincts?.pending) {
				items.push(
					...scanPendingDir(
						layout.projectInstincts.pending,
						"project",
						project.id,
						project.name ?? registry[project.id]?.name ?? project.id,
						asOf,
					),
				);
			}
		} else {
			for (const pid of listProjectIds(root)) {
				const base = path.join(root, "projects", pid);
				const pending = path.join(base, "instincts", "pending");
				const name = registry[pid]?.name || pid;
				items.push(...scanPendingDir(pending, "project", pid, name, asOf));
			}
		}
	}

	if (scope !== "project") {
		const layout = layoutPaths(root, { id: "global" });
		items.push(
			...scanPendingDir(
				layout.globalInstincts.pending,
				"global",
				null,
				"global",
				asOf,
			),
		);
	}

	for (const item of items) {
		item.expired = item.ageDays >= maxAgeDays;
	}

	items.sort(
		(a, b) => b.ageDays - a.ageDays || a.filePath.localeCompare(b.filePath),
	);

	const expired = items.filter((i) => i.expired);
	const remaining = items.filter((i) => !i.expired);
	return { items, expired, remaining, maxAgeDays };
}

/**
 * @param {PrunePlanItem[]} expired
 * @param {{ dryRun?: boolean }} [opts]
 */
export function applyPrune(expired, opts = {}) {
	/** @type {Array<{ id: string, filePath: string, ageDays: number }>} */
	const deleted = [];
	/** @type {Array<{ id: string, filePath: string, reason: string }>} */
	const failed = [];

	for (const item of expired) {
		if (opts.dryRun) {
			deleted.push({
				id: item.id,
				filePath: item.filePath,
				ageDays: item.ageDays,
			});
			continue;
		}
		try {
			if (!fs.existsSync(item.filePath)) {
				failed.push({
					id: item.id,
					filePath: item.filePath,
					reason: "file already missing",
				});
				continue;
			}
			fs.unlinkSync(item.filePath);
			deleted.push({
				id: item.id,
				filePath: item.filePath,
				ageDays: item.ageDays,
			});
		} catch (err) {
			failed.push({
				id: item.id,
				filePath: item.filePath,
				reason: /** @type {Error} */ (err).message,
			});
		}
	}

	return { deleted, failed };
}
