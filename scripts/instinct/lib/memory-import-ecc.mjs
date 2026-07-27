/**
 * One-shot ECC `.ecc/memory` → hkx.memory.v1 import (UM-12 / M4).
 * Distinct from instinct `import --from-ecc` (homunculus instincts).
 *
 * Callers: cli memory import-ecc
 * Plan: .pi/plans/unified-memory-instinct-om-m4.plan.md
 * Auth: user "proceed" on M4
 * Verify: scripts/tests/instinct-memory.mjs
 *
 * GateGuard (create):
 * 1. scripts/instinct/lib; install copies instinct tree.
 * 2. Export planEccMemoryImport, applyEccMemoryImport, resolveEccMemoryRoots.
 * 3. Read-only source walk; writes only via saveMemory when apply.
 * 4. Auth: M4 proceed.
 * 5. Verify: instinct-memory + npm test.
 */
import fs from "node:fs";
import path from "node:path";
import { isValidInstinctId } from "./paths.mjs";
import {
	parseMemoryFile,
	slugMemoryId,
	MEMORY_SCHEMA,
} from "./memory-schema.mjs";
import { getMemory, saveMemory } from "./memory-store.mjs";
import { hasBlockingSecrets, scanMemoryText } from "./memory-secrets.mjs";

/**
 * @param {string} fromPath
 * @returns {{ projectDir?: string, teamDir?: string, userDir?: string, base: string }}
 */
export function resolveEccMemoryRoots(fromPath) {
	const base = path.resolve(fromPath);
	if (!fs.existsSync(base)) {
		return { base };
	}
	const asMemory =
		path.basename(base) === "memory" ||
		fs.existsSync(path.join(base, "project")) ||
		fs.existsSync(path.join(base, "team"));
	const memRoot = asMemory
		? base
		: fs.existsSync(path.join(base, ".ecc", "memory"))
			? path.join(base, ".ecc", "memory")
			: base;

	/** @type {{ projectDir?: string, teamDir?: string, userDir?: string, base: string }} */
	const out = { base: memRoot };
	const projectDir = path.join(memRoot, "project");
	const teamDir = path.join(memRoot, "team");
	if (fs.existsSync(projectDir) && fs.statSync(projectDir).isDirectory()) {
		out.projectDir = projectDir;
	}
	if (fs.existsSync(teamDir) && fs.statSync(teamDir).isDirectory()) {
		out.teamDir = teamDir;
	}
	if (
		!out.projectDir &&
		!out.teamDir &&
		fs.existsSync(memRoot) &&
		fs.statSync(memRoot).isDirectory()
	) {
		out.userDir = memRoot;
	} else if (
		path.basename(path.dirname(memRoot)) === ".ecc" &&
		path.basename(memRoot) === "memory" &&
		!out.projectDir
	) {
		out.userDir = memRoot;
	}
	return out;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listMdFiles(dir) {
	if (!dir || !fs.existsSync(dir)) return [];
	/** @type {string[]} */
	const out = [];
	const walk = (d) => {
		for (const name of fs.readdirSync(d)) {
			if (name.startsWith(".")) continue;
			const full = path.join(d, name);
			const st = fs.statSync(full);
			if (st.isDirectory()) walk(full);
			else if (name.endsWith(".md")) out.push(full);
		}
	};
	walk(dir);
	return out.sort();
}

/**
 * @param {string} raw
 * @param {string} filePath
 * @param {"project"|"user"} targetScope
 * @param {string[]} extraTags
 */
export function mapEccFileToDoc(raw, filePath, targetScope, extraTags = []) {
	const stem = path.basename(filePath, ".md");
	const parsed = parseMemoryFile(raw);
	if (parsed.ok) {
		const tags = [
			...new Set([
				...(parsed.doc.tags || []),
				"imported-from-ecc",
				...extraTags,
			]),
		];
		return {
			ok: true,
			doc: {
				schema: MEMORY_SCHEMA,
				id: isValidInstinctId(parsed.doc.id)
					? parsed.doc.id
					: slugMemoryId(parsed.doc.id || stem),
				scope: targetScope,
				title: parsed.doc.title || stem,
				tags,
				created: parsed.doc.created,
				updated: parsed.doc.updated,
				source: /** @type {const} */ ("import"),
				body: parsed.doc.body ?? "",
			},
		};
	}

	let body = raw;
	/** @type {Record<string, string>} */
	const fm = {};
	if (raw.startsWith("---")) {
		const end = raw.indexOf("\n---", 3);
		if (end !== -1) {
			const block = raw.slice(3, end).trim();
			body = raw.slice(end + 4).replace(/^\n/, "");
			for (const line of block.split("\n")) {
				const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
				if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
			}
		}
	}

	const titleFromH1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
	const idRaw = fm.id || stem;
	const id = isValidInstinctId(idRaw) ? idRaw : slugMemoryId(idRaw);
	const title = fm.title || titleFromH1 || stem;
	const tags = [
		"imported-from-ecc",
		...extraTags,
		...(fm.tags ? fm.tags.split(/[,\s]+/).filter(Boolean) : []),
	];

	return {
		ok: true,
		doc: {
			schema: MEMORY_SCHEMA,
			id,
			scope: targetScope,
			title,
			tags: [...new Set(tags)],
			created: fm.created || new Date().toISOString().slice(0, 10),
			source: /** @type {const} */ ("import"),
			body,
		},
	};
}

/**
 * @param {string} fromPath
 * @param {string} root
 * @param {{ id: string, name?: string }} project
 * @param {{ scope?: "project"|"user"|"all", force?: boolean }} [opts]
 */
export function planEccMemoryImport(fromPath, root, project, opts = {}) {
	const scopeOpt = opts.scope ?? "all";
	const roots = resolveEccMemoryRoots(fromPath);
	if (!fs.existsSync(roots.base)) {
		return {
			ok: false,
			error: `path not found: ${fromPath}`,
			items: [],
			roots,
		};
	}

	/** @type {Array<{ file: string, action: string, id?: string, scope?: string, reason?: string, doc?: object }>} */
	const items = [];

	/**
	 * @param {string} file
	 * @param {"project"|"user"} targetScope
	 * @param {string[]} extraTags
	 */
	const consider = (file, targetScope, extraTags) => {
		if (scopeOpt === "project" && targetScope !== "project") return;
		if (scopeOpt === "user" && targetScope !== "user") return;
		const raw = fs.readFileSync(file, "utf8");
		const mapped = mapEccFileToDoc(raw, file, targetScope, extraTags);
		if (!mapped.ok || !mapped.doc) {
			items.push({ file, action: "skip", reason: "map failed" });
			return;
		}
		const text = `${mapped.doc.title}\n${mapped.doc.body}`;
		if (hasBlockingSecrets(text)) {
			const scan = scanMemoryText(text);
			items.push({
				file,
				action: "skip",
				id: mapped.doc.id,
				scope: targetScope,
				reason: `secret heuristic: ${scan.findings
					.filter((f) => f.severity === "high")
					.map((f) => f.kind)
					.join(",")}`,
			});
			return;
		}
		const existing = getMemory(root, project, mapped.doc.id, targetScope);
		if (existing.ok && !opts.force) {
			items.push({
				file,
				action: "skip",
				id: mapped.doc.id,
				scope: targetScope,
				reason: "id exists (pass --force to overwrite)",
				doc: mapped.doc,
			});
			return;
		}
		items.push({
			file,
			action: existing.ok ? "update" : "add",
			id: mapped.doc.id,
			scope: targetScope,
			doc: mapped.doc,
		});
	};

	if (roots.projectDir) {
		for (const f of listMdFiles(roots.projectDir)) {
			consider(f, "project", []);
		}
	}
	if (roots.teamDir) {
		for (const f of listMdFiles(roots.teamDir)) {
			consider(f, "project", ["imported-from-ecc-team"]);
		}
	}
	if (roots.userDir) {
		const skipNames = new Set(["project", "team"]);
		for (const f of listMdFiles(roots.userDir)) {
			const rel = path.relative(roots.userDir, f);
			const top = rel.split(path.sep)[0];
			if (skipNames.has(top) && (roots.projectDir || roots.teamDir)) continue;
			consider(f, "user", []);
		}
	}

	if (!roots.projectDir && !roots.teamDir && !roots.userDir) {
		for (const f of listMdFiles(roots.base)) {
			consider(f, "project", []);
		}
	}

	return {
		ok: true,
		roots,
		items,
		counts: {
			add: items.filter((i) => i.action === "add").length,
			update: items.filter((i) => i.action === "update").length,
			skip: items.filter((i) => i.action === "skip").length,
		},
	};
}

/**
 * @param {ReturnType<typeof planEccMemoryImport>} plan
 * @param {string} root
 * @param {{ id: string }} project
 * @param {{ apply?: boolean, forceSecrets?: boolean }} [opts]
 */
export function applyEccMemoryImport(plan, root, project, opts = {}) {
	if (!plan.ok) {
		return { ok: false, error: plan.error, written: [], skipped: plan.items };
	}
	const apply = Boolean(opts.apply);
	/** @type {string[]} */
	const written = [];
	/** @type {Array<object>} */
	const results = [];

	for (const item of plan.items) {
		if (item.action === "skip" || !item.doc) {
			results.push(item);
			continue;
		}
		if (!apply) {
			results.push({ ...item, action: `preview-${item.action}` });
			continue;
		}
		const r = saveMemory(
			root,
			project,
			/** @type {any} */ (item.doc),
			{ apply: true, forceSecrets: Boolean(opts.forceSecrets) },
		);
		if (!r.ok) {
			results.push({
				file: item.file,
				action: "skip",
				id: item.id,
				scope: item.scope,
				reason: r.error,
			});
			continue;
		}
		if (r.filePath) written.push(r.filePath);
		results.push({ ...item, filePath: r.filePath });
	}

	return {
		ok: true,
		apply,
		written,
		items: results,
		counts: {
			written: written.length,
			skipped: results.filter((i) => i.action === "skip").length,
		},
	};
}
