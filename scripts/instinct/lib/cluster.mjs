/**
 * Evolve clustering (ECC cmd_evolve parity).
 *
 * Callers: cli.mjs
 * Docs: docs/instinct-evolve-plan.md thresholds
 * Public API: normalizeTrigger, commandSlugFromTrigger, analyzeEvolve, formatEvolveReport
 * Auth: user "开工" implement instinct-evolve Phase 1
 * Verify: scripts/tests/instinct-cluster.mjs
 */

const TRIGGER_STOPWORDS = [
	"when",
	"creating",
	"writing",
	"adding",
	"implementing",
	"testing",
];

/**
 * @param {string} trigger
 */
export function normalizeTrigger(trigger) {
	let key = String(trigger ?? "")
		.toLowerCase()
		.trim();
	for (const word of TRIGGER_STOPWORDS) {
		key = key.replaceAll(word, " ");
	}
	return key.replace(/\s+/g, " ").trim();
}

/**
 * @param {string} trigger
 */
export function commandSlugFromTrigger(trigger) {
	let s = String(trigger ?? "").toLowerCase();
	s = s.replace(/\bwhen\b/g, " ");
	s = s.replace(/\bimplementing\b/g, " ");
	s = s.replace(/\ba\b/g, " ");
	s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	return s.slice(0, 20) || "workflow";
}

/**
 * @param {import('./parse.mjs').Instinct[]} instincts
 */
export function analyzeEvolve(instincts) {
	const total = instincts.length;
	if (total < 3) {
		return {
			ok: false,
			reason: `Need at least 3 instincts to analyze patterns (have ${total})`,
			total,
			highConfidence: [],
			skillCandidates: [],
			commandCandidates: [],
			agentCandidates: [],
		};
	}

	const highConfidence = instincts.filter((i) => (i.confidence ?? 0.5) >= 0.8);

	/** @type {Map<string, import('./parse.mjs').Instinct[]>} */
	const triggerClusters = new Map();
	for (const inst of instincts) {
		const key = normalizeTrigger(inst.trigger ?? "");
		if (!triggerClusters.has(key)) triggerClusters.set(key, []);
		triggerClusters.get(key)?.push(inst);
	}

	/** @type {Array<{ trigger: string, instincts: import('./parse.mjs').Instinct[], avgConfidence: number, domains: string[], scopes: string[] }>} */
	const skillCandidates = [];
	for (const [trigger, cluster] of triggerClusters) {
		if (cluster.length < 2) continue;
		const avg =
			cluster.reduce((s, i) => s + (i.confidence ?? 0.5), 0) / cluster.length;
		skillCandidates.push({
			trigger,
			instincts: cluster,
			avgConfidence: avg,
			domains: [...new Set(cluster.map((i) => i.domain || "general"))],
			scopes: [
				...new Set(cluster.map((i) => i._scope_label || i.scope || "project")),
			],
		});
	}
	skillCandidates.sort(
		(a, b) =>
			b.instincts.length - a.instincts.length ||
			b.avgConfidence - a.avgConfidence,
	);

	const commandCandidates = instincts
		.filter((i) => i.domain === "workflow" && (i.confidence ?? 0.5) >= 0.7)
		.map((i) => ({
			slug: commandSlugFromTrigger(i.trigger ?? i.id),
			instinct: i,
			confidence: i.confidence ?? 0.5,
		}));

	const agentCandidates = skillCandidates.filter(
		(c) => c.instincts.length >= 3 && c.avgConfidence >= 0.75,
	);

	return {
		ok: true,
		reason: null,
		total,
		highConfidence,
		skillCandidates,
		commandCandidates,
		agentCandidates,
	};
}

/**
 * Human-readable evolve report (ASCII-safe).
 * @param {ReturnType<typeof analyzeEvolve>} analysis
 * @param {{ name: string, id: string }} project
 * @param {{ projectCount: number, globalCount: number }} counts
 */
export function formatEvolveReport(analysis, project, counts) {
	const lines = [];
	const bar = "=".repeat(60);
	lines.push("");
	lines.push(bar);
	lines.push(`  EVOLVE ANALYSIS - ${analysis.total} instincts`);
	lines.push(`  Project: ${project.name} (${project.id})`);
	lines.push(
		`  Project-scoped: ${counts.projectCount} | Global: ${counts.globalCount}`,
	);
	lines.push(bar);
	lines.push("");

	if (!analysis.ok) {
		lines.push(analysis.reason ?? "Analysis failed");
		lines.push("");
		return lines.join("\n");
	}

	lines.push(
		`High confidence instincts (>=80%): ${analysis.highConfidence.length}`,
	);
	lines.push(
		`Potential skill clusters found: ${analysis.skillCandidates.length}`,
	);

	if (analysis.skillCandidates.length) {
		lines.push("");
		lines.push("## SKILL CANDIDATES");
		lines.push("");
		for (const [i, cand] of analysis.skillCandidates.slice(0, 5).entries()) {
			lines.push(`${i + 1}. Cluster: "${cand.trigger || "(empty)"}"`);
			lines.push(`   Instincts: ${cand.instincts.length}`);
			lines.push(`   Avg confidence: ${Math.round(cand.avgConfidence * 100)}%`);
			lines.push(`   Domains: ${cand.domains.join(", ")}`);
			lines.push(`   Scopes: ${cand.scopes.join(", ")}`);
			lines.push("   Instincts:");
			for (const inst of cand.instincts.slice(0, 3)) {
				lines.push(
					`     - ${inst.id} [${inst._scope_label || inst.scope || "?"}]`,
				);
			}
			lines.push("");
		}
	}

	if (analysis.commandCandidates.length) {
		lines.push(`## COMMAND CANDIDATES (${analysis.commandCandidates.length})`);
		lines.push("");
		for (const cand of analysis.commandCandidates.slice(0, 5)) {
			lines.push(`  /${cand.slug}`);
			lines.push(
				`    From: ${cand.instinct.id} [${cand.instinct._scope_label || cand.instinct.scope || "?"}]`,
			);
			lines.push(`    Confidence: ${Math.round(cand.confidence * 100)}%`);
			lines.push("");
		}
	}

	if (analysis.agentCandidates.length) {
		lines.push(`## AGENT CANDIDATES (${analysis.agentCandidates.length})`);
		lines.push("");
		for (const cand of analysis.agentCandidates.slice(0, 3)) {
			const name =
				(cand.trigger || "cluster").replace(/\s+/g, "-").slice(0, 20) +
				"-agent";
			lines.push(`  ${name}`);
			lines.push(`    Covers ${cand.instincts.length} instincts`);
			lines.push(
				`    Avg confidence: ${Math.round(cand.avgConfidence * 100)}%`,
			);
			lines.push("");
		}
	}

	lines.push(bar);
	lines.push("");
	return lines.join("\n");
}
