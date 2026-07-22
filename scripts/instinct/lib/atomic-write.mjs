/**
 * Atomic UTF-8 LF file write (cross-platform).
 * Windows may need unlink-before-rename when replacing.
 *
 * Callers: store.mjs, generate.mjs
 * Plan: docs/instinct-evolve-plan.md C4
 * Auth: user "开工" Phase 1 instinct-evolve
 * Verify: scripts/tests/instinct-paths.mjs + evolve --generate
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} filePath
 * @param {string} content
 */
export function writeFileAtomic(filePath, content) {
	const dir = path.dirname(filePath);
	fs.mkdirSync(dir, { recursive: true });
	const tmp = path.join(
		dir,
		`.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
	);
	const body = content.endsWith("\n") ? content : `${content}\n`;
	const normalized = body.replace(/\r\n/g, "\n");
	fs.writeFileSync(tmp, normalized, "utf8");
	try {
		fs.renameSync(tmp, filePath);
	} catch (err) {
		try {
			if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			fs.renameSync(tmp, filePath);
		} catch (err2) {
			try {
				fs.unlinkSync(tmp);
			} catch {
				/* ignore */
			}
			throw err2 ?? err;
		}
	}
}
