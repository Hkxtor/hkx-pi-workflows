/**
 * Map OM reflections (+ supporting observations) to pending instincts.
 * Conservative rule-based heuristics — no LLM.
 *
 * Callers: cli from-om
 * Docs: docs/instinct-evolve-plan.md Phase 2 mapping table
 * Public API: mapProjectionToCandidates, reflectionToInstinct, scoreConfidence
 * Auth: user "做 Phase 2：from-om + accept"
 * Verify: scripts/tests/instinct-om.mjs
 */
import { createHash } from "node:crypto";
import { isValidInstinctId } from "./paths.mjs";

const DOMAIN_RULES = [
	{ domain: "testing", re: /\b(test|pytest|unittest|coverage|tdd|spec)\b/i },
	{ domain: "git", re: /\b(git|commit|branch|pr\b|pull request|merge)\b/i },
	{
		domain: "security",
		re: /\b(security|auth|token|secret|xss|csrf|inject|permission)\b/i,
	},
	{
		domain: "debugging",
		re: /\b(debug|bug|fix|root cause|regress|error|stack)\b/i,
	},
	{
		domain: "workflow",
		re: /\b(workflow|pipeline|orchestrat|when implementing|process)\b/i,
	},
	{
		domain: "code-style",
		re: /\b(style|functional|immutable|prefer|lint|format|pattern)\b/i,
	},
];

const PREFERENCE_RE =
	/\b(prefer|always|never|must|should|default to|use |avoid |require)\b/i;
const DECISION_RE =
	/\b(decided|decision|chose|choose|will use|switched to|agreed)\b/i;
const CONSTRAINT_RE =
	/\b(constraint|must not|do not|don't|forbidden|required|deadline)\b/i;

/**
 * @param {string} content
 */
export function classifyDomain(content) {
	for (const rule of DOMAIN_RULES) {
		if (rule.re.test(content)) return rule.domain;
	}
	return "general";
}

/**
 * @param {string} content
 * @param {Array<{ relevance?: string }>} supportObs
 */
export function scoreConfidence(content, supportObs = []) {
	const n = supportObs.length;
	let base = 0.4;
	if (n >= 6) base = 0.7;
	else if (n >= 3) base = 0.55;
	else if (n >= 1) base = 0.4;
	else base = 0.35;

	const ranks = { critical: 0.15, high: 0.1, medium: 0, low: -0.05 };
	let boost = 0;
	for (const o of supportObs) {
		const r = o.relevance || "medium";
		boost = Math.max(boost, ranks[/** @type {keyof typeof ranks} */ (r)] ?? 0);
	}
	if (PREFERENCE_RE.test(content) || DECISION_RE.test(content)) {
		boost += 0.05;
	}
	const conf = Math.min(0.9, Math.max(0.3, base + boost));
	return Math.round(conf * 100) / 100;
}

/**
 * @param {string} content
 */
export function looksActionable(content) {
	const c = content.trim();
	if (c.length < 24) return false;
	if (PREFERENCE_RE.test(c) || DECISION_RE.test(c) || CONSTRAINT_RE.test(c)) {
		return true;
	}
	if (
		/\b(is|are|uses|use|requires|prefers|avoids)\b/i.test(c) &&
		c.length >= 40
	) {
		return true;
	}
	return false;
}

/**
 * @param {string} reflectionId
 * @param {string} content
 */
export function instinctIdFromReflection(reflectionId, content) {
	const slug = content
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 28);
	const short = (reflectionId || "om").slice(0, 8);
	let id = `om-${short}-${slug}`.replace(/-+/g, "-").replace(/-$/, "");
	if (id.length > 48) id = id.slice(0, 48).replace(/-$/, "");
	if (!isValidInstinctId(id)) {
		const h = createHash("sha256")
			.update(reflectionId + content)
			.digest("hex")
			.slice(0, 10);
		id = `om-${h}`;
	}
	return id;
}

/**
 * @param {string} content
 */
export function triggerFromContent(content) {
	const c = content.trim();
	const clause = c.split(/[.;]/)[0]?.trim() || c;
	if (/^when\b/i.test(clause)) return clause.slice(0, 160);
	return `when applying learned pattern: ${clause.slice(0, 120)}`;
}

/**
 * @param {{ id: string, content: string, supportingObservationIds?: string[] }} reflection
 * @param {Map<string, { id: string, content: string, relevance?: string }>} obsById
 * @param {{ project?: { id: string, name?: string }, minRelevance?: string }} [opts]
 */
export function reflectionToInstinct(reflection, obsById, opts = {}) {
	const content = String(reflection.content || "").trim();
	const supportIds = Array.isArray(reflection.supportingObservationIds)
		? reflection.supportingObservationIds
		: [];
	/** @type {Array<{ id: string, content: string, relevance?: string }>} */
	const supportObs = [];
	for (const id of supportIds) {
		const o = obsById.get(id);
		if (o) supportObs.push(o);
	}

	const minRel = opts.minRelevance || "medium";
	const rank = { low: 0, medium: 1, high: 2, critical: 3 };
	const minRank = rank[/** @type {keyof typeof rank} */ (minRel)] ?? 1;
	const bestRel = supportObs.reduce(
		(best, o) => {
			const r =
				rank[/** @type {keyof typeof rank} */ (o.relevance || "medium")] ?? 1;
			return Math.max(best, r);
		},
		supportObs.length ? 0 : 1,
	);
	const effectiveRel = supportObs.length ? bestRel : 1;
	if (effectiveRel < minRank) {
		return {
			skipped: true,
			reason: `below min-relevance ${minRel}`,
			reflectionId: reflection.id,
		};
	}

	if (!looksActionable(content)) {
		return {
			skipped: true,
			reason: "not actionable preference/decision/constraint",
			reflectionId: reflection.id,
		};
	}

	const domain = classifyDomain(content);
	const confidence = scoreConfidence(content, supportObs);
	const id = instinctIdFromReflection(reflection.id, content);
	const trigger = triggerFromContent(content);
	const project = opts.project;

	const evidenceLines = [
		`- OM reflection ${reflection.id}`,
		...supportObs
			.slice(0, 5)
			.map(
				(o) =>
					`- obs ${o.id} (${o.relevance || "?"}): ${String(o.content).slice(0, 120)}`,
			),
	];

	const instinct = {
		id,
		trigger,
		confidence,
		domain,
		source: "om-reflection",
		scope: "project",
		project_id: project?.id !== "global" ? project?.id : undefined,
		project_name: project?.name,
		om_support_ids: [reflection.id, ...supportIds].join(","),
		created: new Date().toISOString().slice(0, 10),
		content: [
			`# ${id}`,
			"",
			"## Action",
			content,
			"",
			"## Evidence",
			...evidenceLines,
			"",
		].join("\n"),
	};

	return { instinct };
}

/**
 * @param {{ reflections: object[], observations: object[] }} projection
 * @param {{ project?: object, minRelevance?: string }} [opts]
 */
export function mapProjectionToCandidates(projection, opts = {}) {
	/** @type {Map<string, any>} */
	const obsById = new Map();
	for (const o of projection.observations || []) {
		if (o && typeof o === "object" && "id" in o) {
			obsById.set(/** @type {any} */ (o).id, o);
		}
	}

	/** @type {object[]} */
	const candidates = [];
	/** @type {object[]} */
	const skipped = [];

	for (const ref of projection.reflections || []) {
		const result = reflectionToInstinct(
			/** @type {any} */ (ref),
			obsById,
			opts,
		);
		if ("skipped" in result && result.skipped) {
			skipped.push(result);
		} else if ("instinct" in result) {
			candidates.push(result.instinct);
		}
	}

	return { candidates, skipped };
}
