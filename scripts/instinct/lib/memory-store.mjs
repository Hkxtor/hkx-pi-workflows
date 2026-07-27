/**
 * Memory vault store under hkx-homunculus (project + user scopes).
 *
 * Callers: cli memory subcommands, scripts/tests/instinct-memory.mjs
 * Plan: .pi/plans/unified-memory-instinct-om.plan.md (M1)
 * Auth: user "proceed" on unified-memory M1
 * Verify: node scripts/tests/instinct-memory.mjs; npm test
 *
 * GateGuard (create):
 * 1. lib next to store.mjs; install copies full scripts/instinct.
 * 2. Exports: memoryDirForScope, recallMemories, saveMemory, validateMemories.
 * 3. Layout via layoutPaths projectMemory/userMemory/teamMemory.
 * 4. Auth: user proceed M1.
 * 5. Verify: instinct-memory + full npm test (from-om unchanged).
 */
import fs from "node:fs";
import path from "node:path";
import { layoutPaths, isValidInstinctId } from "./paths.mjs";
import { writeFileAtomic } from "./atomic-write.mjs";
import { writeInstinct } from "./store.mjs";
import {
	classifyDomain,
	looksActionable,
	triggerFromContent,
} from "./om-map.mjs";
import {
	MEMORY_SCHEMA,
	parseMemoryFile,
	serializeMemory,
	slugMemoryId,
	validateMemoryDoc,
} from "./memory-schema.mjs";
import {
	hasBlockingSecrets,
	scanMemoryText,
} from "./memory-secrets.mjs";

const HANDOFF_TAG = "handoff";
const HANDOFF_STUB = `## Status\n\n## Done\n\n## Do not touch\n\n## Next\n\n## Links\n`;

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {"project"|"user"|"team"} scope
 */
export function memoryDirForScope(root, project, scope) {
	const layout = layoutPaths(root, project);
	if (scope === "project") {
		if (!layout.projectMemory) {
			throw new Error(
				"project memory requires a non-global project (run from a git repo or set HKX_PROJECT_ID)",
			);
		}
		return layout.projectMemory;
	}
	if (scope === "user") return layout.userMemory;
	if (scope === "team") return layout.teamMemory;
	throw new Error(`unknown memory scope: ${scope}`);
}

/**
 * @param {string} dir
 * @param {"project"|"user"|"team"} expectedScope
 * @returns {import('./memory-schema.mjs').MemoryDoc[]}
 */
function loadFromDir(dir, expectedScope) {
	/** @type {import('./memory-schema.mjs').MemoryDoc[]} */
	const out = [];
	if (!dir || !fs.existsSync(dir)) return out;
	const names = fs.readdirSync(dir).filter((n) => n.endsWith(".md"));
	for (const name of names) {
		const base = path.basename(name, ".md");
		if (base.includes("..") || name.includes("/") || name.includes("\\")) {
			continue;
		}
		const filePath = path.join(dir, name);
		let st;
		try {
			st = fs.statSync(filePath);
		} catch {
			continue;
		}
		if (!st.isFile()) continue;
		let raw;
		try {
			raw = fs.readFileSync(filePath, "utf8");
		} catch {
			continue;
		}
		const parsed = parseMemoryFile(raw);
		if (!parsed.ok) continue;
		if (parsed.doc.scope !== expectedScope) continue;
		if (path.basename(filePath, ".md") !== parsed.doc.id) continue;
		out.push({ ...parsed.doc, _filePath: filePath });
	}
	return out;
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ scope?: "project"|"user", tag?: string, id?: string, query?: string }} [opts]
 */
export function recallMemories(root, project, opts = {}) {
	const scope = opts.scope ?? "project";
	if (scope === "team") {
		return {
			ok: true,
			scope,
			items: [],
			note: "team recall not enabled in M1",
		};
	}
	if (scope !== "project" && scope !== "user") {
		throw new Error(`recall scope must be project|user, got ${scope}`);
	}
	const dir = memoryDirForScope(root, project, scope);
	let items = loadFromDir(dir, scope);
	if (opts.id) {
		items = items.filter((d) => d.id === opts.id);
	}
	if (opts.tag) {
		const t = opts.tag.toLowerCase();
		items = items.filter((d) =>
			(d.tags || []).some((x) => String(x).toLowerCase() === t),
		);
	}
	if (opts.query) {
		const q = opts.query.toLowerCase();
		items = items.filter((d) => {
			const hay =
				`${d.title}\n${d.body ?? ""}\n${(d.tags || []).join(" ")}`.toLowerCase();
			return hay.includes(q) || d.id.toLowerCase().includes(q);
		});
	}
	items.sort((a, b) => a.id.localeCompare(b.id));
	return { ok: true, scope, dir, items };
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {Partial<import('./memory-schema.mjs').MemoryDoc> & { title: string }} input
 * @param {{ apply?: boolean, forceSecrets?: boolean }} [opts]
 */
export function saveMemory(root, project, input, opts = {}) {
	const apply = Boolean(opts.apply);
	const forceSecrets = Boolean(opts.forceSecrets);
	const scope = input.scope ?? "project";
	if (scope === "team") {
		return {
			ok: false,
			error: "team scope writes are disabled in M1 (directory stub only)",
			apply: false,
		};
	}
	if (scope !== "project" && scope !== "user") {
		return { ok: false, error: `invalid scope ${scope}`, apply: false };
	}
	const id =
		input.id && isValidInstinctId(input.id)
			? input.id
			: slugMemoryId(input.title);
	const today = new Date().toISOString().slice(0, 10);
	/** @type {import('./memory-schema.mjs').MemoryDoc} */
	const doc = {
		schema: MEMORY_SCHEMA,
		id,
		scope,
		title: input.title,
		tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
		created: input.created || today,
		updated: input.updated || today,
		source: input.source || "manual",
		body: input.body ?? "",
	};
	const checked = validateMemoryDoc(doc);
	if (!checked.ok) {
		return { ok: false, error: checked.error, apply: false };
	}
	const secretScan = scanMemoryText(
		`${checked.doc.title}\n${checked.doc.body ?? ""}`,
	);
	const high = secretScan.findings.filter((f) => f.severity === "high");
	const dir = memoryDirForScope(root, project, scope);
	const filePath = path.join(dir, `${checked.doc.id}.md`);
	const resolved = path.resolve(filePath);
	const resolvedDir = path.resolve(dir);
	if (
		resolved !== resolvedDir &&
		!resolved.startsWith(resolvedDir + path.sep)
	) {
		return { ok: false, error: "path escape rejected", apply: false };
	}
	const content = serializeMemory(checked.doc);
	if (!apply) {
		return {
			ok: true,
			apply: false,
			filePath,
			doc: checked.doc,
			preview: content,
			findings: secretScan.findings.length ? secretScan.findings : undefined,
		};
	}
	if (high.length && !forceSecrets) {
		return {
			ok: false,
			error: `secret heuristic blocked write (${high.map((f) => f.kind).join(", ")}); pass --force to override`,
			apply: false,
			findings: secretScan.findings,
		};
	}
	fs.mkdirSync(dir, { recursive: true });
	writeFileAtomic(filePath, content);
	return {
		ok: true,
		apply: true,
		filePath,
		doc: { ...checked.doc, _filePath: filePath },
	};
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ scope?: "project"|"user"|"all" }} [opts]
 */
export function validateMemories(root, project, opts = {}) {
	const scopeOpt = opts.scope ?? "all";
	/** @type {{ scope: string, dir: string }[]} */
	const targets = [];
	const layout = layoutPaths(root, project);
	if (scopeOpt === "project" || scopeOpt === "all") {
		if (layout.projectMemory) {
			targets.push({ scope: "project", dir: layout.projectMemory });
		}
	}
	if (scopeOpt === "user" || scopeOpt === "all") {
		targets.push({ scope: "user", dir: layout.userMemory });
	}
	if (scopeOpt === "all" && layout.teamMemory) {
		targets.push({ scope: "team", dir: layout.teamMemory });
	}

	/** @type {{ file: string, error: string }[]} */
	const errors = [];
	/** @type {{ file: string, id: string, scope: string, findings?: object[] }[]} */
	const warnings = [];
	/** @type {{ file: string, id: string, scope: string }[]} */
	const okFiles = [];
	let scanned = 0;
	const strict = Boolean(opts.strict);

	for (const t of targets) {
		if (!fs.existsSync(t.dir)) continue;
		for (const name of fs.readdirSync(t.dir)) {
			if (!name.endsWith(".md")) continue;
			scanned += 1;
			const filePath = path.join(t.dir, name);
			if (name.includes("..")) {
				errors.push({ file: filePath, error: "illegal filename" });
				continue;
			}
			let raw;
			try {
				raw = fs.readFileSync(filePath, "utf8");
			} catch (err) {
				errors.push({
					file: filePath,
					error: `read failed: ${/** @type {Error} */ (err).message}`,
				});
				continue;
			}
			const parsed = parseMemoryFile(raw);
			if (!parsed.ok) {
				errors.push({ file: filePath, error: parsed.error });
				continue;
			}
			if (parsed.doc.scope !== t.scope) {
				errors.push({
					file: filePath,
					error: `scope mismatch: doc=${parsed.doc.scope} dir=${t.scope}`,
				});
				continue;
			}
			const stem = path.basename(name, ".md");
			if (stem !== parsed.doc.id) {
				errors.push({
					file: filePath,
					error: `filename stem "${stem}" != id "${parsed.doc.id}"`,
				});
				continue;
			}
			const secretScan = scanMemoryText(
				`${parsed.doc.title}\n${parsed.doc.body ?? ""}`,
			);
			const high = secretScan.findings.filter((f) => f.severity === "high");
			const medium = secretScan.findings.filter(
				(f) => f.severity === "medium",
			);
			if (high.length) {
				errors.push({
					file: filePath,
					error: `secret heuristic (high): ${high.map((f) => f.kind).join(", ")}`,
				});
				continue;
			}
			if (medium.length) {
				warnings.push({
					file: filePath,
					id: parsed.doc.id,
					scope: parsed.doc.scope,
					findings: medium,
				});
				if (strict) {
					errors.push({
						file: filePath,
						error: `secret heuristic (medium, --strict): ${medium.map((f) => f.kind).join(", ")}`,
					});
					continue;
				}
			}
			okFiles.push({
				file: filePath,
				id: parsed.doc.id,
				scope: parsed.doc.scope,
			});
		}
	}

	return {
		ok: errors.length === 0,
		scanned,
		okCount: okFiles.length,
		errors,
		warnings,
		okFiles,
	};
}

/**
 * @param {string} root
 * @param {{ id: string }} project
 * @param {string} id
 * @param {{"project"|"user"}} [scope]
 */
export function getMemory(root, project, id, scope = "project") {
	if (!id || !isValidInstinctId(id)) {
		return { ok: false, error: `invalid memory id "${id}"` };
	}
	if (scope !== "project" && scope !== "user") {
		return { ok: false, error: `getMemory scope must be project|user` };
	}
	const dir = memoryDirForScope(root, project, scope);
	const filePath = path.join(dir, `${id}.md`);
	if (!fs.existsSync(filePath)) {
		return { ok: false, error: `memory not found: ${id} (${scope})` };
	}
	const raw = fs.readFileSync(filePath, "utf8");
	const parsed = parseMemoryFile(raw);
	if (!parsed.ok) return { ok: false, error: parsed.error, filePath };
	if (parsed.doc.scope !== scope) {
		return {
			ok: false,
			error: `scope mismatch in file: ${parsed.doc.scope}`,
			filePath,
		};
	}
	return {
		ok: true,
		doc: { ...parsed.doc, _filePath: filePath },
		filePath,
	};
}

/**
 * Save a handoff note (hkx.memory.v1 + tag handoff).
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ title: string, body?: string, id?: string, scope?: "project"|"user", tags?: string[] }}
 * @param {{ apply?: boolean }} [opts]
 */
export function createHandoff(root, project, input, opts = {}) {
	const bodyRaw = String(input.body ?? "").trim();
	const body =
		bodyRaw.length >= 20
			? bodyRaw
			: `${bodyRaw ? `${bodyRaw}\n\n` : ""}${HANDOFF_STUB}`;
	const tags = Array.isArray(input.tags) ? [...input.tags.map(String)] : [];
	if (!tags.some((t) => t.toLowerCase() === HANDOFF_TAG)) {
		tags.unshift(HANDOFF_TAG);
	}
	return saveMemory(
		root,
		project,
		{
			title: input.title,
			body,
			id: input.id,
			scope: input.scope ?? "project",
			tags,
			source: "session",
		},
		{
			apply: Boolean(opts.apply),
			forceSecrets: Boolean(opts.forceSecrets),
		},
	);
}

/**
 * Explicit vault → pending instinct (no vault delete; no personal write).
 * @param {string} root
 * @param {{ id: string, name?: string }} project
 * @param {{ id: string, scope?: "project"|"user", apply?: boolean, force?: boolean }}
 */
export function promoteMemoryToPending(root, project, opts) {
	const scope = opts.scope === "user" ? "user" : "project";
	const apply = Boolean(opts.apply);
	const force = Boolean(opts.force);
	const loaded = getMemory(root, project, opts.id, scope);
	if (!loaded.ok) {
		return { ok: false, error: loaded.error, apply: false };
	}
	const doc = loaded.doc;
	const text = `${doc.title}\n${doc.body ?? ""}`.trim();
	if (text.length < 12) {
		return {
			ok: false,
			error: "memory body/title too short to promote",
			apply: false,
		};
	}
	if (!looksActionable(text) && !force) {
		return {
			ok: false,
			error:
				"memory does not look like an actionable preference/decision; pass --force to promote anyway",
			apply: false,
			doc,
		};
	}
	const instinctId = isValidInstinctId(doc.id) ? doc.id : slugMemoryId(doc.id);
	const trigger = triggerFromContent(text);
	const domain = classifyDomain(text);
	const content = [
		`# ${doc.title}`,
		"",
		"## Action",
		"",
		String(doc.body ?? "").trim() || doc.title,
		"",
		"## Evidence",
		"",
		`- Promoted from memory vault id \`${doc.id}\` (scope ${doc.scope})`,
		doc.tags?.length ? `- Tags: ${doc.tags.join(", ")}` : null,
		"",
	]
		.filter((l) => l !== null)
		.join("\n");

	/** @type {import('./parse.mjs').Instinct} */
	const inst = {
		id: instinctId,
		trigger,
		confidence: 0.45,
		domain,
		source: "memory-vault",
		scope: "project",
		project_id: project.id,
		project_name: project.name,
		created: new Date().toISOString().slice(0, 10),
		content,
	};

	const layout = layoutPaths(root, project);
	const pendingPath = layout.projectInstincts
		? path.join(layout.projectInstincts.pending, `${instinctId}.md`)
		: null;
	if (!pendingPath) {
		return {
			ok: false,
			error: "cannot resolve project pending dir (global project?)",
			apply: false,
		};
	}
	if (fs.existsSync(pendingPath) && !force) {
		return {
			ok: false,
			error: `pending instinct "${instinctId}" already exists; pass --force to overwrite pending only`,
			apply: false,
			pendingPath,
			instinct: inst,
			memoryId: doc.id,
		};
	}
	if (!apply) {
		return {
			ok: true,
			apply: false,
			pendingPath,
			instinct: inst,
			memoryId: doc.id,
			memoryPath: doc._filePath,
		};
	}
	const written = writeInstinct(root, project, inst, "pending", "project");
	return {
		ok: true,
		apply: true,
		pendingPath: written,
		instinct: inst,
		memoryId: doc.id,
		memoryPath: doc._filePath,
	};
}
