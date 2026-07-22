/**
 * Publish evolved/ drafts to user Pi surfaces with explicit --apply.
 *
 * Default: list only. Never silent. Default target ~/.pi/agent (not package skills/).
 *
 * Callers: cli publish-draft
 * Docs: docs/instinct-evolve-plan.md publish-draft
 * Public API: listEvolvedDrafts, planPublish, applyPublish, defaultPublishRoot
 * Auth: user "要 publish-draft"
 * Verify: scripts/tests/instinct-publish.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { layoutPaths } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function defaultPublishRoot(env = process.env) {
	if (env.HKX_PUBLISH_ROOT && path.isAbsolute(env.HKX_PUBLISH_ROOT)) {
		return env.HKX_PUBLISH_ROOT;
	}
	return path.join(os.homedir(), ".pi", "agent");
}

/**
 * @param {string} content
 */
function sha12(content) {
	return crypto
		.createHash("sha256")
		.update(content, "utf8")
		.digest("hex")
		.slice(0, 12);
}

/**
 * @param {string} name
 * @param {string} content
 */
export function ensureSkillFrontmatter(name, content) {
	const text = content.replace(/\r\n/g, "\n");
	if (/^---\r?\n[\s\S]*?\r?\n---/.test(text)) {
		if (/^name:\s*/m.test(text))
			return text.endsWith("\n") ? text : `${text}\n`;
		return text.replace(/^---\n/, `---\nname: ${name}\n`);
	}
	const firstLine = text.split("\n").find((l) => l.trim()) || name;
	const title = firstLine.replace(/^#\s*/, "").trim() || name;
	const desc = `Evolved skill draft published from instinct-evolve (${name}).`;
	const body = text.replace(/^#\s+.+\n+/, "");
	return `---\nname: ${name}\ndescription: "${desc.replace(/"/g, '\\"')}"\norigin: instinct-evolve\n---\n\n# ${title}\n\n${body}`.replace(
		/\r\n/g,
		"\n",
	);
}

/**
 * @param {string} name
 * @param {string} content
 * @param {"command"|"agent"} kind
 */
export function ensureNamedFrontmatter(name, content, kind) {
	const text = content.replace(/\r\n/g, "\n");
	if (/^---\r?\n[\s\S]*?\r?\n---/.test(text)) {
		if (/^name:\s*/m.test(text))
			return text.endsWith("\n") ? text : `${text}\n`;
		return text.replace(/^---\n/, `---\nname: ${name}\n`);
	}
	if (kind === "agent") {
		return `---\nname: ${name}\ndescription: "Evolved agent from instinct-evolve"\ntools: read, ffgrep, fffind\n---\n\n${text}`.replace(
			/\r\n/g,
			"\n",
		);
	}
	return `---\nname: ${name}\ndescription: "Evolved command from instinct-evolve"\n---\n\n${text}`.replace(
		/\r\n/g,
		"\n",
	);
}

/**
 * @typedef {{ kind: "skill"|"command"|"agent", name: string, sourcePath: string, content: string, hash: string }} Draft
 */

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ kinds?: Array<"skill"|"command"|"agent">, names?: string[] }} [opts]
 * @returns {Draft[]}
 */
export function listEvolvedDrafts(root, project, opts = {}) {
	const layout = layoutPaths(root, project);
	const evolvedRoot = layout.evolvedRoot;
	const wantKinds = new Set(
		opts.kinds?.length ? opts.kinds : ["skill", "command", "agent"],
	);
	const wantNames = opts.names?.length ? new Set(opts.names) : null;
	/** @type {Draft[]} */
	const drafts = [];

	const skillsDir = path.join(evolvedRoot, "skills");
	if (wantKinds.has("skill") && fs.existsSync(skillsDir)) {
		for (const name of fs.readdirSync(skillsDir).sort()) {
			if (wantNames && !wantNames.has(name)) continue;
			const skillFile = path.join(skillsDir, name, "SKILL.md");
			if (!fs.existsSync(skillFile)) continue;
			const content = fs.readFileSync(skillFile, "utf8");
			drafts.push({
				kind: "skill",
				name,
				sourcePath: skillFile,
				content,
				hash: sha12(content),
			});
		}
	}

	const commandsDir = path.join(evolvedRoot, "commands");
	if (wantKinds.has("command") && fs.existsSync(commandsDir)) {
		for (const file of fs.readdirSync(commandsDir).sort()) {
			if (!file.endsWith(".md")) continue;
			const name = file.replace(/\.md$/i, "");
			if (wantNames && !wantNames.has(name)) continue;
			const sourcePath = path.join(commandsDir, file);
			const content = fs.readFileSync(sourcePath, "utf8");
			drafts.push({
				kind: "command",
				name,
				sourcePath,
				content,
				hash: sha12(content),
			});
		}
	}

	const agentsDir = path.join(evolvedRoot, "agents");
	if (wantKinds.has("agent") && fs.existsSync(agentsDir)) {
		for (const file of fs.readdirSync(agentsDir).sort()) {
			if (!file.endsWith(".md")) continue;
			const name = file.replace(/\.md$/i, "");
			if (wantNames && !wantNames.has(name)) continue;
			const sourcePath = path.join(agentsDir, file);
			const content = fs.readFileSync(sourcePath, "utf8");
			drafts.push({
				kind: "agent",
				name,
				sourcePath,
				content,
				hash: sha12(content),
			});
		}
	}

	return drafts;
}

/**
 * @param {Draft} draft
 * @param {string} publishRoot
 */
export function destinationForDraft(draft, publishRoot) {
	if (draft.kind === "skill") {
		return path.join(publishRoot, "skills", draft.name, "SKILL.md");
	}
	if (draft.kind === "command") {
		return path.join(publishRoot, "prompts", `${draft.name}.md`);
	}
	return path.join(publishRoot, "agents", "hkx", `${draft.name}.md`);
}

/**
 * @param {Draft} draft
 */
export function preparePublishContent(draft) {
	if (draft.kind === "skill")
		return ensureSkillFrontmatter(draft.name, draft.content);
	if (draft.kind === "command")
		return ensureNamedFrontmatter(draft.name, draft.content, "command");
	return ensureNamedFrontmatter(draft.name, draft.content, "agent");
}

/**
 * @param {Draft[]} drafts
 * @param {string} publishRoot
 * @param {{ force?: boolean }} [opts]
 */
export function planPublish(drafts, publishRoot, opts = {}) {
	return drafts.map((draft) => {
		const dest = destinationForDraft(draft, publishRoot);
		const prepared = preparePublishContent(draft);
		const exists = fs.existsSync(dest);
		let destHash = null;
		let identical = false;
		if (exists) {
			const existing = fs.readFileSync(dest, "utf8");
			destHash = sha12(existing);
			identical =
				existing.replace(/\r\n/g, "\n") === prepared.replace(/\r\n/g, "\n");
		}
		/** @type {"create"|"update"|"skip-identical"|"blocked-exists"} */
		let action = "create";
		if (identical) action = "skip-identical";
		else if (exists && !opts.force) action = "blocked-exists";
		else if (exists) action = "update";

		return {
			kind: draft.kind,
			name: draft.name,
			sourcePath: draft.sourcePath,
			dest,
			sourceHash: draft.hash,
			destHash,
			action,
			bytes: Buffer.byteLength(prepared, "utf8"),
			prepared,
		};
	});
}

/**
 * @param {ReturnType<typeof planPublish>} plan
 * @param {{ dryRun?: boolean }} [opts]
 */
export function applyPublish(plan, opts = {}) {
	/** @type {Array<{ name: string, dest: string, action: string }>} */
	const written = [];
	/** @type {Array<{ name: string, dest: string, action: string, reason: string }>} */
	const skipped = [];

	for (const item of plan) {
		if (item.action === "skip-identical" || item.action === "blocked-exists") {
			skipped.push({
				name: item.name,
				dest: item.dest,
				action: item.action,
				reason:
					item.action === "skip-identical"
						? "identical content"
						: "dest exists (pass --force to overwrite)",
			});
			continue;
		}
		if (opts.dryRun) {
			written.push({
				name: item.name,
				dest: item.dest,
				action: `dry-${item.action}`,
			});
			continue;
		}
		writeFileAtomic(item.dest, item.prepared);
		if (item.kind === "command") {
			const mirror = item.dest.includes(`${path.sep}prompts${path.sep}`)
				? item.dest.replace(
						`${path.sep}prompts${path.sep}`,
						`${path.sep}commands${path.sep}`,
					)
				: item.dest.replace("/prompts/", "/commands/");
			if (mirror !== item.dest) writeFileAtomic(mirror, item.prepared);
		}
		written.push({ name: item.name, dest: item.dest, action: item.action });
	}

	return { written, skipped };
}

/**
 * @param {string} publishRoot
 */
export function isPackageRepoSkillsRoot(publishRoot) {
	const normalized = path.resolve(publishRoot);
	const candidates = [
		path.join(normalized, "package.json"),
		path.join(normalized, "..", "package.json"),
	];
	if (
		normalized.endsWith(`${path.sep}skills`) ||
		normalized.endsWith("/skills")
	) {
		candidates.push(path.join(normalized, "..", "package.json"));
	}
	for (const p of candidates) {
		try {
			if (!fs.existsSync(p)) continue;
			const j = JSON.parse(fs.readFileSync(p, "utf8"));
			if (j.name === "@hkx/pi-workflows") return true;
		} catch {
			/* ignore */
		}
	}
	return false;
}
