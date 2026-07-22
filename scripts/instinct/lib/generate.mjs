/**
 * Generate evolved skill/command/agent drafts under evolved/.
 * Never writes into package formal skills/.
 *
 * Callers: cli.mjs
 * Docs: docs/instinct-evolve-plan.md generate caps
 * Public API: generateEvolved(root, project, analysis) -> string[]
 * Caps: 5 skills / 5 commands / 3 agents
 * Auth: user "开工" implement Phase 1 instinct-evolve
 * Verify: node scripts/instinct/cli.mjs evolve --generate; npm test
 */
import path from "node:path";
import { extractAction } from "./parse.mjs";
import { layoutPaths } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";
import { commandSlugFromTrigger } from "./cluster.mjs";

/**
 * @param {string} s
 * @param {number} max
 */
function slugify(s, max = 30) {
	const out = String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, max);
	return out || "evolved";
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {ReturnType<import('./cluster.mjs').analyzeEvolve>} analysis
 * @returns {string[]}
 */
export function generateEvolved(root, project, analysis) {
	if (!analysis.ok) return [];
	const layout = layoutPaths(root, project);
	const evolvedRoot = layout.evolvedRoot;
	/** @type {string[]} */
	const generated = [];

	for (const cand of analysis.skillCandidates.slice(0, 5)) {
		const trigger = (cand.trigger || "").trim();
		if (!trigger) continue;
		const name = slugify(trigger, 30);
		const skillFile = path.join(evolvedRoot, "skills", name, "SKILL.md");
		let content = `# ${name}\n\n`;
		content += `Evolved from ${cand.instincts.length} instincts `;
		content += `(avg confidence: ${Math.round(cand.avgConfidence * 100)}%)\n\n`;
		content += `## When to Apply\n\n`;
		content += `Trigger: ${trigger}\n\n`;
		content += `## Actions\n\n`;
		for (const inst of cand.instincts) {
			const action = extractAction(inst.content ?? "") || inst.id;
			content += `- ${action}\n`;
		}
		content += `\n## Source Instincts\n\n`;
		for (const inst of cand.instincts) {
			content += `- ${inst.id}\n`;
		}
		writeFileAtomic(skillFile, content);
		generated.push(skillFile);
	}

	for (const cand of analysis.commandCandidates.slice(0, 5)) {
		const cmdName =
			cand.slug || commandSlugFromTrigger(cand.instinct.trigger ?? "");
		const cmdFile = path.join(evolvedRoot, "commands", `${cmdName}.md`);
		let content = `# ${cmdName}\n\n`;
		content += `Evolved from instinct: ${cand.instinct.id}\n`;
		content += `Confidence: ${Math.round(cand.confidence * 100)}%\n\n`;
		content += cand.instinct.content ?? "";
		writeFileAtomic(cmdFile, content);
		generated.push(cmdFile);
	}

	for (const cand of analysis.agentCandidates.slice(0, 3)) {
		const trigger = (cand.trigger || "").trim();
		const agentName = slugify(trigger, 20);
		const agentFile = path.join(evolvedRoot, "agents", `${agentName}.md`);
		const domains = cand.domains.join(", ");
		let content = `---\nmodel: sonnet\ntools: read, ffgrep, fffind\n---\n\n`;
		content += `# ${agentName}\n\n`;
		content += `Evolved from ${cand.instincts.length} instincts `;
		content += `(avg confidence: ${Math.round(cand.avgConfidence * 100)}%)\n`;
		content += `Domains: ${domains}\n\n`;
		content += `## Source Instincts\n\n`;
		for (const inst of cand.instincts) {
			content += `- ${inst.id}\n`;
		}
		writeFileAtomic(agentFile, content);
		generated.push(agentFile);
	}

	return generated;
}
