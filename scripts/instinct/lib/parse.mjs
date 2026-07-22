/**
 * ECC-compatible instinct frontmatter parser/serializer.
 * Reads LF or CRLF; writes UTF-8 LF only.
 *
 * Callers: store.mjs, cli.mjs, generate.mjs, scripts/tests/instinct-parse.mjs
 * Authorized by: user "开工" for instinct-evolve Phase 1 (docs/instinct-evolve-plan.md)
 * Verify: npm test (instinct-*.mjs) + node scripts/instinct/cli.mjs evolve
 */

/**
 * @typedef {object} Instinct
 * @property {string} id
 * @property {string} [trigger]
 * @property {number} [confidence]
 * @property {string} [domain]
 * @property {string} [source]
 * @property {string} [scope]
 * @property {string} [project_id]
 * @property {string} [project_name]
 * @property {string} [created]
 * @property {string} [updated]
 * @property {string} [content]
 * @property {string} [om_support_ids]
 * @property {string} [_source_file]
 * @property {string} [_source_type]
 * @property {string} [_scope_label]
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
 * Parse one or more instincts from file content.
 * @param {string} content
 * @returns {Instinct[]}
 */
export function parseInstinctFile(content) {
	const text = content.replace(/^\uFEFF/, "");
	const lines = text.split(/\r?\n/);
	/** @type {Instinct[]} */
	const instincts = [];
	/** @type {Record<string, unknown>} */
	let current = {};
	let inFrontmatter = false;
	/** @type {string[]} */
	let contentLines = [];
	let sawAnyFence = false;

	const flush = () => {
		if (!current || Object.keys(current).length === 0) return;
		const id = current.id;
		if (typeof id === "string" && id) {
			/** @type {Instinct} */
			const inst = {
				...current,
				id,
				content: contentLines.join("\n").trim(),
			};
			if (typeof inst.confidence === "string") {
				const n = Number.parseFloat(inst.confidence);
				inst.confidence = Number.isFinite(n) ? n : 0.5;
			}
			instincts.push(inst);
		}
		current = {};
		contentLines = [];
	};

	for (const line of lines) {
		if (line.trim() === "---") {
			if (inFrontmatter) {
				inFrontmatter = false;
			} else {
				if (sawAnyFence) flush();
				inFrontmatter = true;
				sawAnyFence = true;
				current = {};
				contentLines = [];
			}
			continue;
		}
		if (inFrontmatter) {
			const idx = line.indexOf(":");
			if (idx === -1) continue;
			const key = line.slice(0, idx).trim();
			const value = unquote(line.slice(idx + 1));
			if (key === "confidence") {
				const n = Number.parseFloat(value);
				current[key] = Number.isFinite(n) ? n : 0.5;
			} else {
				current[key] = value;
			}
		} else if (sawAnyFence) {
			contentLines.push(line);
		}
	}
	if (sawAnyFence) flush();
	return instincts.filter((i) => i.id);
}

/**
 * @param {string} content
 */
export function extractAction(content) {
	if (!content) return "";
	const m = content.match(/##\s*Action\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
	return m ? m[1].trim() : "";
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
 * Serialize a single instinct to markdown with frontmatter (LF).
 * @param {import('./parse.mjs').Instinct | Instinct} inst
 */
export function serializeInstinct(inst) {
	const keys = [
		"id",
		"trigger",
		"confidence",
		"domain",
		"source",
		"scope",
		"project_id",
		"project_name",
		"created",
		"updated",
		"last_seen",
		"om_support_ids",
	];
	const lines = ["---"];
	for (const k of keys) {
		const v = /** @type {Record<string, unknown>} */ (inst)[k];
		if (v === undefined || v === null || v === "") continue;
		if (k === "confidence") {
			lines.push(`${k}: ${v}`);
		} else {
			lines.push(`${k}: ${quoteYaml(String(v))}`);
		}
	}
	lines.push("---");
	lines.push("");
	const body = String(inst.content ?? "")
		.replace(/\r\n/g, "\n")
		.trimEnd();
	if (body) lines.push(body);
	lines.push("");
	return lines.join("\n");
}
