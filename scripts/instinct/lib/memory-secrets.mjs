/**
 * Best-effort secret heuristics for memory vault (UM-11 / M4).
 * Not a compliance scanner — high-confidence patterns only.
 *
 * Callers: memory-store save/validate, memory-import-ecc
 * Plan: .pi/plans/unified-memory-instinct-om-m4.plan.md
 * Auth: user "proceed" on M4
 * Verify: scripts/tests/instinct-memory.mjs
 *
 * GateGuard (create):
 * 1. scripts/instinct/lib next to memory-store.
 * 2. Export scanMemoryText, hasBlockingSecrets, redactSnippet.
 * 3. Pure text scan; no I/O.
 * 4. Auth: M4 proceed.
 * 5. Verify: instinct-memory + npm test.
 */

/** @typedef {{ kind: string, severity: "high"|"medium", snippet: string }} SecretFinding */

const PLACEHOLDER_RE =
	/(?:\bYOUR_[A-Za-z0-9_]+\b|\bREPLACE_ME\b|\b[A-Za-z0-9_]+_HERE\b|\$\{[A-Za-z_][A-Za-z0-9_]*\}|<[A-Z_][A-Z0-9_]*>)/;

/**
 * @param {string} text
 * @param {number} [max=48]
 */
export function redactSnippet(text, max = 48) {
	const s = String(text || "")
		.replace(/\s+/g, " ")
		.trim();
	if (s.length <= max) {
		if (s.length <= 8) return "***";
		return `${s.slice(0, 4)}…${s.slice(-2)}`;
	}
	return `${s.slice(0, 6)}…(${s.length} chars)…${s.slice(-2)}`;
}

/**
 * @param {string} matched
 */
function isPlaceholderish(matched) {
	return (
		PLACEHOLDER_RE.test(matched) ||
		/^(YOUR_|<.*>$|.*_HERE$)/.test(matched.trim())
	);
}

/**
 * @param {string} text
 * @returns {{ findings: SecretFinding[] }}
 */
export function scanMemoryText(text) {
	const raw = String(text ?? "");
	/** @type {SecretFinding[]} */
	const findings = [];

	/**
	 * @param {RegExp} re
	 * @param {string} kind
	 * @param {"high"|"medium"} severity
	 */
	const collect = (re, kind, severity) => {
		const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
		const g = new RegExp(re.source, flags);
		let m;
		while ((m = g.exec(raw)) !== null) {
			const hit = m[0];
			if (isPlaceholderish(hit)) continue;
			if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(hit.trim())) continue;
			findings.push({
				kind,
				severity,
				snippet: redactSnippet(hit),
			});
			if (findings.length >= 20) break;
		}
	};

	collect(
		/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
		"private_key",
		"high",
	);
	collect(/\bAKIA[0-9A-Z]{16}\b/, "aws_access_key", "high");
	collect(/\bsk-[A-Za-z0-9]{20,}\b/, "openai_sk", "high");
	collect(/\bghp_[A-Za-z0-9]{36}\b/, "github_pat", "high");
	collect(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/, "github_pat", "high");
	collect(/\bBearer\s+[A-Za-z0-9._-]{20,}\b/i, "bearer_token", "medium");
	collect(
		/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
		"assignment_secret",
		"medium",
	);

	return { findings };
}

/**
 * @param {string} text
 */
export function hasBlockingSecrets(text) {
	return scanMemoryText(text).findings.some((f) => f.severity === "high");
}
