/**
 * Confidence time decay for instincts (ECC parity).
 *
 * Default model (continuous-learning-v2 observer):
 *   -0.02 confidence per full week without activity
 *
 * Activity timestamp precedence:
 *   last_seen > updated > created > source file mtime
 *
 * Callers: cli decay
 * Docs: docs/instinct-evolve-plan.md + skills/instinct-evolve
 * Public API: weeksInactive, computeDecayedConfidence, planDecay, applyDecay
 * Auth: user "如何做置信度时间衰减"
 * Verify: scripts/tests/instinct-decay.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { parseInstinctFile, serializeInstinct } from "./parse.mjs";
import { layoutPaths } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";

export const DEFAULT_DECAY_PER_WEEK = 0.02;
export const DEFAULT_CONFIDENCE_FLOOR = 0.1;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {string | number | Date | undefined | null} value
 * @returns {Date | null}
 */
export function parseActivityDate(value) {
	if (value == null || value === "") return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const s = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		const d = new Date(`${s}T00:00:00.000Z`);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} lastActive
 * @param {Date} [asOf]
 */
export function weeksInactive(lastActive, asOf = new Date()) {
	const delta = asOf.getTime() - lastActive.getTime();
	if (delta <= 0) return 0;
	return Math.floor(delta / MS_PER_WEEK);
}

/**
 * @param {number} n
 */
function round2(n) {
	return Math.round(n * 100) / 100;
}

/**
 * @param {number} confidence
 * @param {number} weeks
 * @param {{ ratePerWeek?: number, floor?: number }} [opts]
 */
export function computeDecayedConfidence(confidence, weeks, opts = {}) {
	const rate =
		typeof opts.ratePerWeek === "number"
			? opts.ratePerWeek
			: DEFAULT_DECAY_PER_WEEK;
	const floor =
		typeof opts.floor === "number" ? opts.floor : DEFAULT_CONFIDENCE_FLOOR;
	const base = Number.isFinite(confidence) ? confidence : 0.5;
	if (weeks <= 0) return round2(base);
	const next = base - rate * weeks;
	return round2(Math.max(floor, next));
}

/**
 * @param {import('./parse.mjs').Instinct} inst
 * @param {string} [sourceFile]
 * @returns {{ at: Date, source: string }}
 */
export function resolveLastActivity(inst, sourceFile) {
	const rec = /** @type {Record<string, unknown>} */ (inst);
	const candidates = [
		{ key: "last_seen", value: rec.last_seen },
		{ key: "updated", value: inst.updated },
		{ key: "created", value: inst.created },
	];
	for (const c of candidates) {
		const d = parseActivityDate(c.value);
		if (d) return { at: d, source: c.key };
	}
	if (sourceFile && fs.existsSync(sourceFile)) {
		const mtime = fs.statSync(sourceFile).mtime;
		return { at: mtime, source: "mtime" };
	}
	return { at: new Date(0), source: "epoch" };
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ includePending?: boolean, scope?: "project"|"global"|"all" }} [opts]
 */
export function listInstinctFiles(root, project, opts = {}) {
	const scope = opts.scope || "all";
	const layout = layoutPaths(root, project);
	/** @type {Array<{ dir: string, sourceType: string, scopeLabel: string }>} */
	const dirs = [];

	if (scope !== "global" && layout.projectInstincts) {
		dirs.push(
			{
				dir: layout.projectInstincts.personal,
				sourceType: "personal",
				scopeLabel: "project",
			},
			{
				dir: layout.projectInstincts.inherited,
				sourceType: "inherited",
				scopeLabel: "project",
			},
		);
		if (opts.includePending) {
			dirs.push({
				dir: layout.projectInstincts.pending,
				sourceType: "pending",
				scopeLabel: "project",
			});
		}
	}
	if (scope !== "project") {
		dirs.push(
			{
				dir: layout.globalInstincts.personal,
				sourceType: "personal",
				scopeLabel: "global",
			},
			{
				dir: layout.globalInstincts.inherited,
				sourceType: "inherited",
				scopeLabel: "global",
			},
		);
		if (opts.includePending) {
			dirs.push({
				dir: layout.globalInstincts.pending,
				sourceType: "pending",
				scopeLabel: "global",
			});
		}
	}

	/** @type {Array<{ filePath: string, inst: import('./parse.mjs').Instinct, sourceType: string, scopeLabel: string }>} */
	const out = [];
	for (const { dir, sourceType, scopeLabel } of dirs) {
		if (!fs.existsSync(dir)) continue;
		for (const file of fs.readdirSync(dir).sort()) {
			if (!/\.(md|ya?ml)$/i.test(file)) continue;
			const filePath = path.join(dir, file);
			try {
				const text = fs.readFileSync(filePath, "utf8");
				for (const inst of parseInstinctFile(text)) {
					out.push({ filePath, inst, sourceType, scopeLabel });
				}
			} catch {
				/* skip */
			}
		}
	}
	return out;
}

/**
 * @typedef {{
 *   id: string,
 *   filePath: string,
 *   scope: string,
 *   sourceType: string,
 *   oldConfidence: number,
 *   newConfidence: number,
 *   weeks: number,
 *   activitySource: string,
 *   lastActive: string,
 *   changed: boolean,
 *   blockedMultiInstinctFile?: boolean,
 * }} DecayPlanItem
 */

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{
 *   asOf?: Date,
 *   ratePerWeek?: number,
 *   floor?: number,
 *   includePending?: boolean,
 *   scope?: "project"|"global"|"all",
 *   minWeeks?: number,
 * }} [opts]
 * @returns {DecayPlanItem[]}
 */
export function planDecay(root, project, opts = {}) {
	const asOf = opts.asOf ?? new Date();
	const minWeeks = typeof opts.minWeeks === "number" ? opts.minWeeks : 1;
	const files = listInstinctFiles(root, project, {
		includePending: opts.includePending,
		scope: opts.scope,
	});

	/** @type {Map<string, number>} */
	const fileCounts = new Map();
	for (const f of files) {
		fileCounts.set(f.filePath, (fileCounts.get(f.filePath) || 0) + 1);
	}

	/** @type {DecayPlanItem[]} */
	const plan = [];
	for (const { filePath, inst, sourceType, scopeLabel } of files) {
		const { at, source } = resolveLastActivity(inst, filePath);
		const weeks = weeksInactive(at, asOf);
		const oldC =
			typeof inst.confidence === "number" && Number.isFinite(inst.confidence)
				? inst.confidence
				: 0.5;
		const newC = computeDecayedConfidence(oldC, weeks, {
			ratePerWeek: opts.ratePerWeek,
			floor: opts.floor,
		});
		const multi = (fileCounts.get(filePath) || 0) > 1;
		const wouldChange = newC < oldC - 1e-9 && weeks >= minWeeks;
		plan.push({
			id: inst.id,
			filePath,
			scope: scopeLabel,
			sourceType,
			oldConfidence: round2(oldC),
			newConfidence: newC,
			weeks,
			activitySource: source,
			lastActive: at.toISOString(),
			changed: wouldChange && !multi,
			blockedMultiInstinctFile: multi && wouldChange,
		});
	}
	return plan;
}

/**
 * @param {DecayPlanItem[]} plan
 * @param {{ dryRun?: boolean, asOf?: Date }} [opts]
 */
export function applyDecay(plan, opts = {}) {
	const asOf = opts.asOf ?? new Date();
	const asOfDate = asOf.toISOString().slice(0, 10);
	/** @type {Array<{ id: string, filePath: string, oldConfidence: number, newConfidence: number }>} */
	const written = [];
	/** @type {Array<{ id: string, filePath: string, reason: string }>} */
	const skipped = [];

	for (const item of plan) {
		if (!item.changed) {
			if (item.blockedMultiInstinctFile) {
				skipped.push({
					id: item.id,
					filePath: item.filePath,
					reason: "multi-instinct file (split to one id per file first)",
				});
			}
			continue;
		}
		if (opts.dryRun) {
			written.push({
				id: item.id,
				filePath: item.filePath,
				oldConfidence: item.oldConfidence,
				newConfidence: item.newConfidence,
			});
			continue;
		}
		try {
			const text = fs.readFileSync(item.filePath, "utf8");
			const parsed = parseInstinctFile(text);
			if (parsed.length !== 1) {
				skipped.push({
					id: item.id,
					filePath: item.filePath,
					reason: "file no longer single-instinct",
				});
				continue;
			}
			const inst = parsed[0];
			inst.confidence = item.newConfidence;
			inst.updated = asOfDate;
			writeFileAtomic(item.filePath, serializeInstinct(inst));
			written.push({
				id: item.id,
				filePath: item.filePath,
				oldConfidence: item.oldConfidence,
				newConfidence: item.newConfidence,
			});
		} catch (err) {
			skipped.push({
				id: item.id,
				filePath: item.filePath,
				reason: /** @type {Error} */ (err).message,
			});
		}
	}

	return { written, skipped };
}
