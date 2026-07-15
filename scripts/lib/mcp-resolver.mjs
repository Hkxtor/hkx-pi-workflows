/**
 * Shared MCP server resolver / placeholder / unresolved-ref guards.
 *
 * SSOT for env-var substitution charset + placeholder detection + unresolved
 * detection, so the TWO write paths (`scripts/apply-mcp-profile.mjs` and
 * `scripts/install.mjs::mergeMcpConfig`) enforce the same invariants
 * (MF-1/2/3/5/6). Removing a guard here is a single fix; duplicating it
 * across the two writers was the MF-1 root cause (resolver charset diverged
 * from detector charset and the install path had no resolver at all).
 *
 * Exports:
 *   ENV_VAR_NAME                      — charset regex fragment
 *   ENV_VAR_REF                       — substitution regex (global)
 *   PURE_ENV_REF                      — exact ${VAR} form (env-only)
 *   PLACEHOLDER_EXACT                 — whole-string placeholder form
 *   PLACEHOLDER_EMBEDDED              — embedded placeholder form
 *   isPlaceholderTemplate(value)      — true iff TEMPLATE looks like a slot
 *   hasUnresolvedRef(value)           — true iff output still has ${ after resolve
 *   resolveEnvVarsInServer(server, { env }) — returns { config, requiresEnv, missing, placeholders }
 *   persistableMcpServer(resolved)    — strip catalog metadata (allowlist)
 *   scanServerForRefusal(name, server, { env }) — throws on unresolved/placeholder
 */
export const ENV_VAR_NAME = "[A-Za-z_][A-Za-z0-9_-]*";
export const ENV_VAR_REF = new RegExp(`\\$\{(${ENV_VAR_NAME})}`, "g");
export const PURE_ENV_REF = new RegExp(`^\\$\\{(${ENV_VAR_NAME})\\}$`);

export const PLACEHOLDER_EXACT = /^(YOUR_.*|.*_HERE|REPLACE_ME|<.*>)$/;
export const PLACEHOLDER_EMBEDDED =
	/(?:\bYOUR_[A-Za-z0-9_]+\b|\bREPLACE_ME\b|\b[A-Za-z0-9_]+_HERE\b|<[^\s>]+>)/;

/**
 * Placeholder detection is a property of the TEMPLATE, not of the resolved
 * secret (MF-2 / typescript B2 / tests T8). Pure ${VAR} templates are never
 * placeholders: after substitution the value is a real env secret (even if
 * that secret happens to equal REPLACE_ME / YOUR_TOKEN_HERE).
 */
export function isPlaceholderTemplate(value) {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	if (PURE_ENV_REF.test(trimmed)) return false;
	if (PLACEHOLDER_EXACT.test(trimmed)) return true;
	return PLACEHOLDER_EMBEDDED.test(value);
}

/**
 * True iff `value` still contains an unresolved ${VAR} reference after
 * resolution. Charset-independent: catches BOTH well-formed names the
 * resolver left (because the env var was unset) AND anything else still
 * shaped like ${...} (e.g. names outside the charset that the resolver
 * could not substitute). This is the structural guard against MF-1.
 */
export function hasUnresolvedRef(value) {
	return typeof value === "string" && value.includes("${");
}

/**
 * Fields a runtime MCP server entry may carry per the MCP schema + package
 * convention. Catalog-only metadata (requiresEnv, future catalog keys) is
 * NOT in this allowlist and will not be carried into the persisted config (MF-5).
 */
export const MCP_SCHEMA_KEYS = [
	"command",
	"args",
	"env",
	"headers",
	"type",
	"url",
	"description",
	"disabled",
];

export function persistableMcpServer(resolved) {
	const persisted = {};
	for (const k of MCP_SCHEMA_KEYS) {
		if (Object.hasOwn(resolved, k)) persisted[k] = resolved[k];
	}
	return persisted;
}

function isPlainObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolve ${VAR} references in a server config
 * (env/headers/args/command/url) against the supplied env object
 * (defaults to process.env). Returns { config, requiresEnv, missing,
 * placeholders }.
 *
 * `config` is the persisted-runtime-fields shape (catalog metadata stripped
 * via an allowlist — MF-5). `requiresEnv` is the catalog `requiresEnv`
 * carried separately so the caller can aggregate it into a requiredEnv gate
 * without leaking it into mcp.json. `missing` lists keys (env/headers/url/
 * command) or arg indices (args[i]) whose resolved value still contains an
 * unresolved ${VAR} reference. `placeholders` lists keys/indices whose
 * TEMPLATE matches a placeholder form — never the post-sub secret.
 *
 * Optional env source: install.mjs merges .mcp.json (whose env values come
 * from the operator's current process environment when install-global runs),
 * while apply-mcp-profile reads process.env by default. Both accept the same
 * shape: an object keyed by env-var name. Defaults to process.env when
 * omitted so apply-mcp-profile keeps its existing behavior.
 */
export function resolveEnvVarsInServer(server, { env } = {}) {
	const source = env ?? process.env;
	const resolve = (value) => {
		if (typeof value !== "string") return value;
		return value.replace(ENV_VAR_REF, (match, name) => {
			const envValue = source[name];
			return envValue === undefined ? match : envValue;
		});
	};

	const resolved = structuredClone(server);
	const placed = [];
	const missing = new Set();

	// Placeholder check uses the template; unresolved check uses the output.
	const check = (key, template, out) => {
		if (isPlaceholderTemplate(template)) placed.push(key);
		if (hasUnresolvedRef(out)) missing.add(key);
	};

	if (resolved.env) {
		for (const [key, value] of Object.entries(resolved.env)) {
			const out = resolve(value);
			check(key, value, out);
			resolved.env[key] = out;
		}
	}
	if (resolved.headers) {
		for (const [key, value] of Object.entries(resolved.headers)) {
			const out = resolve(value);
			check(key, value, out);
			resolved.headers[key] = out;
		}
	}
	if (Array.isArray(resolved.args)) {
		resolved.args = resolved.args.map((arg, i) => {
			const out = resolve(arg);
			check(`args[${i}]`, arg, out);
			return out;
		});
	}
	if (typeof resolved.command === "string") {
		const template = resolved.command;
		const out = resolve(template);
		check("command", template, out);
		resolved.command = out;
	}
	if (typeof resolved.url === "string") {
		const template = resolved.url;
		const out = resolve(template);
		check("url", template, out);
		resolved.url = out;
	}

	return {
		config: persistableMcpServer(resolved),
		requiresEnv: Array.isArray(resolved.requiresEnv)
			? resolved.requiresEnv
			: [],
		missing: Array.from(missing),
		placeholders: placed,
	};
}

/**
 * Synchronous scan + refusal for the install-merge write path. install.mjs
 * merges a SHIPPED .mcp.json (whose env should be resolved from the current
 * process environment when install-global runs; refs that stay literal here
 * are refused so they never persist into ~/.pi/agent/mcp.json).
 *
 * Throws on unresolved `${VAR}` references OR placeholder templates anywhere
 * in env/headers/args/command/url. Throwing means install-global's
 * mergeMcpConfig rejects the bad source — same invariant as apply-mcp-profile
 * (MF-6: route both write paths through the same guards).
 *
 * Returns the persisted-runtime-fields server object (catalog metadata
 * stripped via allowlist) for direct assignment into mcpServers[name].
 */
export function scanServerForRefusal(serverName, server, { env, sourceLabel } = {}) {
	const source = env ?? process.env;
	const label = sourceLabel || ".mcp.json";
	const resolve = (value) => {
		if (typeof value !== "string") return value;
		return value.replace(ENV_VAR_REF, (match, name) => {
			const v = source[name];
			return v === undefined ? match : v;
		});
	};

	const failField = (channel, key, template, out) => {
		if (isPlaceholderTemplate(template)) {
			throw new Error(
				`Refusing to write MCP server ${JSON.stringify(serverName)}: ${channel}${key ? ` ${JSON.stringify(key)}` : ""} placeholder template in ${label}. Replace ${JSON.stringify(template)} with a real \${VAR} reference backed by the operator's environment.`,
			);
		}
		if (hasUnresolvedRef(out)) {
			const names = [...out.matchAll(/\$\{([^}]+)\}/g)]
				.map((m) => m[1])
				.join(", ");
			throw new Error(
				`Refusing to write MCP server ${JSON.stringify(serverName)}: ${channel}${key ? ` ${JSON.stringify(key)}` : ""} has unresolved ${JSON.stringify(out)} in ${label}. Export ${JSON.stringify(names)} before running install-global.`,
			);
		}
	};

	if (isPlainObject(server.env)) {
		for (const [k, v] of Object.entries(server.env)) {
			if (typeof v !== "string") continue;
			const out = resolve(v);
			failField("env", k, v, out);
			server.env[k] = out;
		}
	}
	if (isPlainObject(server.headers)) {
		for (const [k, v] of Object.entries(server.headers)) {
			if (typeof v !== "string") continue;
			const out = resolve(v);
			failField("headers", k, v, out);
			server.headers[k] = out;
		}
	}
	if (Array.isArray(server.args)) {
		for (let i = 0; i < server.args.length; i++) {
			const original = server.args[i];
			if (typeof original !== "string") continue;
			const out = resolve(original);
			failField(`args[${i}]`, null, original, out);
			server.args[i] = out;
		}
	}
	if (typeof server.command === "string") {
		const out = resolve(server.command);
		failField("command", null, server.command, out);
		server.command = out;
	}
	if (typeof server.url === "string") {
		const out = resolve(server.url);
		failField("url", null, server.url, out);
		server.url = out;
	}

	return persistableMcpServer(server);
}
