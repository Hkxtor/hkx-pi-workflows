/**
 * Map OM session projection → vault memory docs (opt-in from-om --to vault|both).
 * Isolated from instinct path so default from-om behavior stays unchanged.
 *
 * Callers: cli from-om
 * Plan: .pi/plans/unified-memory-instinct-om-m3.plan.md
 * Auth: user "proceed" on M3
 * Verify: scripts/tests/instinct-om.mjs
 *
 * GateGuard (create):
 * 1. scripts/instinct/lib next to om-map; install copies instinct tree.
 * 2. Export mapProjectionToVaultDocs, vaultIdFromReflection.
 * 3. Produces partial MemoryDoc inputs for saveMemory (source om).
 * 4. Auth: M3 plan proceed.
 * 5. Verify: instinct-om + npm test.
 */
import { createHash } from "node:crypto";
import { isValidInstinctId } from "./paths.mjs";
import { classifyDomain, looksActionable } from "./om-map.mjs";

const DECISION_RE =
	/\b(decided|decision|chose|choose|will use|switched to|agreed|constraint|must not|do not|don't|forbidden|required|prefer|always|never)\b/i;

/**
 * @param {string} reflectionId
 * @param {string} content
 */
export function vaultIdFromReflection(reflectionId, content) {
	const slug = content
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 24);
	const short = (reflectionId || "om").slice(0, 8);
	let id = `mem-om-${short}-${slug}`.replace(/-+/g, "-").replace(/-$/, "");
	if (id.length > 48) id = id.slice(0, 48).replace(/-$/, "");
	if (!isValidInstinctId(id)) {
		const h = createHash("sha256")
			.update(String(reflectionId) + content)
			.digest("hex")
			.slice(0, 10);
		id = `mem-om-${h}`;
	}
	return id;
}

/**
 * Conservative vault candidates: decision/constraint-like reflections.
 *
 * @param {{ reflections?: Array<{ id: string, content?: string, supportingObservationIds?: string[] }>, observations?: Array<{ id: string, relevance?: string }> }} projection
 * @param {{ project?: { id: string, name?: string }, minRelevance?: string }} [opts]
 * @returns {{ docs: Array<{ id: string, title: string, body: string, scope: "project", tags: string[], source: "om" }>, skipped: Array<{ reflectionId: string, reason: string }> }}
 */
export function mapProjectionToVaultDocs(projection, opts = {}) {
	const minRel = opts.minRelevance || "medium";
	const rank = { low: 0, medium: 1, high: 2, critical: 3 };
	const minRank = rank[/** @type {keyof typeof rank} */ (minRel)] ?? 1;

	/** @type {Map<string, { relevance?: string }>} */
	const obsById = new Map();
	for (const o of projection.observations || []) {
		if (o && typeof o === "object" && "id" in o) {
			obsById.set(/** @type {any} */ (o).id, o);
		}
	}

	/** @type {Array<{ id: string, title: string, body: string, scope: "project", tags: string[], source: "om" }>} */
	const docs = [];
	/** @type {Array<{ reflectionId: string, reason: string }>} */
	const skipped = [];

	for (const ref of projection.reflections || []) {
		const content = String(ref.content || "").trim();
		const rid = ref.id || "unknown";
		if (content.length < 16) {
			skipped.push({ reflectionId: rid, reason: "too short" });
			continue;
		}

		const supportIds = Array.isArray(ref.supportingObservationIds)
			? ref.supportingObservationIds
			: [];
		let bestRel = supportIds.length ? 0 : 1;
		for (const sid of supportIds) {
			const o = obsById.get(sid);
			const r =
				rank[/** @type {keyof typeof rank} */ (o?.relevance || "medium")] ?? 1;
			bestRel = Math.max(bestRel, r);
		}
		if (bestRel < minRank) {
			skipped.push({
				reflectionId: rid,
				reason: `below min-relevance ${minRel}`,
			});
			continue;
		}

		const decisionLike = DECISION_RE.test(content);
		const actionable = looksActionable(content);
		if (!decisionLike && !actionable) {
			skipped.push({
				reflectionId: rid,
				reason: "not decision/constraint/actionable for vault",
			});
			continue;
		}

		const domain = classifyDomain(content);
		const title =
			content.split(/[.\n]/)[0]?.trim().slice(0, 80) || `OM reflection ${rid}`;
		docs.push({
			id: vaultIdFromReflection(rid, content),
			title,
			body: content,
			scope: "project",
			tags: ["om", "from-om", domain],
			source: "om",
		});
	}

	return { docs, skipped };
}
