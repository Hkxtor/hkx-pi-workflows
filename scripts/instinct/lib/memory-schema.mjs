/**
 * hkx.memory.v1 frontmatter parse/serialize for the unified memory vault.
 *
 * Callers: memory-store.mjs, cli memory subcommands, scripts/tests/instinct-memory.mjs
 * Plan: .pi/plans/unified-memory-instinct-om.plan.md (M1)
 * Auth: user "proceed" on unified-memory M1
 * Verify: node scripts/tests/instinct-memory.mjs; npm test
 *
 * GateGuard (create):
 * 1. scripts/instinct/lib/* pattern; install.mjs copies scripts/instinct tree.
 * 2. Exports: MEMORY_SCHEMA, parse/serialize/validate, slugMemoryId.
 * 3. Frontmatter schema string hkx.memory.v1; ids via isValidInstinctId.
 * 4. Auth: user proceed M1 plan.
 * 5. Verify: instinct-memory tests + npm test.
 */
import { isValidInstinctId } from "./paths.mjs";

export const MEMORY_SCHEMA = "hkx.memory.v1";
export const MEMORY_SCOPES = /** @type {const} */ (["project", "user", "team"]);

/**
 * @typedef {object} MemoryDoc
 * @property {string} schema
 * @property {string} id
 * @property {"project"|"user"|"team"} scope
 * @property {string} title
 * @property {string[]} tags
 * @property {string} created
 * @property {string} [updated]
 * @property {"manual"|"om"|"session"|"import"} [source]
 * @property {string} [body]
 * @property {string} [_filePath]
 */

/**
 * @param {string} value
 */
function unquote(value) {
	let v = value.trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		const q = v[0];
		v = v.slice(1, -1);
		if (q === '"') v = v.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
		else v = v.replace(/''/g, "'");
	}
	return v;
}

/**
 * @param {string} value
 */
function quoteYaml(value) {
	const s = String(value);
	if (/[:#{}[\],&*?|>!%@`]/.test(s) || s.includes("\n") || s.includes('"')) {
		return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	}
	if (s.includes(" ") || s === "") return `"${s}"`;
	return s;
}

/**
 * Parse YAML-ish list: [a, b] or comma-separated.
 * @param {string} raw
 * @returns {string[]}
 */
export function parseTags(raw) {
	const v = raw.trim();
	if (!v) return [];
	if (v.startsWith("[") && v.endsWith("]")) {
		const inner = v.slice(1, -1).trim();
		if (!inner) return [];
		return inner
			.split(",")
			.map((p) => unquote(p.trim()))
			.filter(Boolean);
	}
	return v
		.split(",")
		.map((p) => unquote(p.trim()))
		.filter(Boolean);
}

/**
 * @param {unknown} doc
 * @returns {{ ok: true, doc: MemoryDoc } | { ok: false, error: string }}
 */
export function validateMemoryDoc(doc) {
	if (!doc || typeof doc !== "object") {
		return { ok: false, error: "memory doc must be an object" };
	}
	const d = /** @type {Record<string, unknown>} */ (doc);
	if (d.schema !== MEMORY_SCHEMA) {
		return {
			ok: false,
			error: `schema must be ${MEMORY_SCHEMA}, got ${String(d.schema)}`,
		};
	}
	if (typeof d.id !== "string" || !isValidInstinctId(d.id)) {
		return {
			ok: false,
			error: `invalid id "${String(d.id)}" (use [a-z0-9][a-z0-9._-]*)`,
		};
	}
	if (d.scope !== "project" && d.scope !== "user" && d.scope !== "team") {
		return {
			ok: false,
			error: `scope must be project|user|team, got ${String(d.scope)}`,
		};
	}
	if (typeof d.title !== "string" || !d.title.trim()) {
		return { ok: false, error: "title is required" };
	}
	const tags = Array.isArray(d.tags)
		? d.tags.map(String)
		: typeof d.tags === "string"
			? parseTags(d.tags)
			: [];
	const source =
		d.source === undefined || d.source === null || d.source === ""
			? "manual"
			: String(d.source);
	if (!["manual", "om", "session", "import"].includes(source)) {
		return {
			ok: false,
			error: `source must be manual|om|session|import, got ${source}`,
		};
	}
	const created =
		typeof d.created === "string" && d.created
			? d.created
			: new Date().toISOString().slice(0, 10);
	/** @type {MemoryDoc} */
	const out = {
		schema: MEMORY_SCHEMA,
		id: d.id,
		scope: d.scope,
		title: d.title.trim(),
		tags,
		created,
		source: /** @type {MemoryDoc["source"]} */ (source),
		body: typeof d.body === "string" ? d.body : "",
	};
	if (typeof d.updated === "string" && d.updated) out.updated = d.updated;
	if (typeof d._filePath === "string") out._filePath = d._filePath;
	return { ok: true, doc: out };
}

/**
 * Parse one memory markdown file (single frontmatter block).
 * @param {string} content
 * @returns {{ ok: true, doc: MemoryDoc } | { ok: false, error: string }}
 */
export function parseMemoryFile(content) {
	const text = String(content ?? "").replace(/^\uFEFF/, "");
	const lines = text.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") {
		return { ok: false, error: "missing opening frontmatter fence ---" };
	}
	/** @type {Record<string, unknown>} */
	const fm = {};
	let i = 1;
	let closed = false;
	for (; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			closed = true;
			i += 1;
			break;
		}
		const line = lines[i];
		const idx = line.indexOf(":");
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		const value = unquote(line.slice(idx + 1));
		if (key === "tags") fm.tags = parseTags(value);
		else fm[key] = value;
	}
	if (!closed) {
		return { ok: false, error: "missing closing frontmatter fence ---" };
	}
	fm.body = lines.slice(i).join("\n").replace(/^\n/, "").trimEnd();
	return validateMemoryDoc(fm);
}

/**
 * @param {MemoryDoc | Record<string, unknown>} doc
 */
export function serializeMemory(doc) {
	const v = validateMemoryDoc(doc);
	if (!v.ok) throw new Error(v.error);
	const d = v.doc;
	const lines = ["---"];
	lines.push(`schema: ${MEMORY_SCHEMA}`);
	lines.push(`id: ${d.id}`);
	lines.push(`scope: ${d.scope}`);
	lines.push(`title: ${quoteYaml(d.title)}`);
	if (d.tags?.length) {
		lines.push(`tags: [${d.tags.map((t) => quoteYaml(t)).join(", ")}]`);
	}
	lines.push(`created: ${quoteYaml(d.created)}`);
	if (d.updated) lines.push(`updated: ${quoteYaml(d.updated)}`);
	if (d.source) lines.push(`source: ${d.source}`);
	lines.push("---");
	lines.push("");
	const body = String(d.body ?? "")
		.replace(/\r\n/g, "\n")
		.trimEnd();
	if (body) lines.push(body);
	lines.push("");
	return lines.join("\n");
}

/**
 * Slug id from title when caller omits --id.
 * @param {string} title
 */
export function slugMemoryId(title) {
	const base = String(title ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	const id = base || "memory";
	if (isValidInstinctId(id)) return id;
	const cleaned =
		id.replace(/[^a-z0-9._-]/g, "").replace(/^[^a-z0-9]+/, "") || "x";
	return `m-${cleaned}`;
}
