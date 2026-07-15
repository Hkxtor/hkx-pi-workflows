#!/usr/bin/env node
/**
 * Day-to-day MCP profile helper for @hkx/pi-workflows.
 *
 * npm entry: npm run mcp:apply-profile -- <profile...>
 *
 * Merges named templates from mcp-configs/templates/ into a pi MCP config:
 * - --scope project (default) -> ./.pi/mcp.json
 * - --scope user              -> ~/.pi/agent/mcp.json
 * - --target <path>           -> explicit mcp.json path
 *
 * Additive merge only: existing servers remain unless overwritten by template keys.
 * Use --list / --dry-run before writing when unsure.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schemaUrl =
	"https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const templateRoot = path.join(repoRoot, "mcp-configs", "templates");
const manifestPath = path.join(templateRoot, "manifest.json");

function expandHome(inputPath) {
	if (inputPath === "~") return os.homedir();
	if (inputPath.startsWith("~/"))
		return path.join(os.homedir(), inputPath.slice(2));
	return inputPath;
}

/**
 * Shared charset for env-var names referenced via ${VAR} in MCP templates.
 * POSIX env-var names allow [A-Za-z_][A-Za-z0-9_]*; MCP configs commonly
 * also use kebab-case (e.g. `x-browser-use-api-key`), so hyphen is allowed
 * after the first char. Digits are allowed after the first char. The first
 * char cannot be a digit (shells reject those names).
 *
 * resolver and detector MUST use this single source of truth so the
 * detector never depends on the resolver having matched a particular name
 * class -- a still-present `${...}` is rejected by the detector regardless
 * of whether the name inside is well-formed (see hasUnresolvedRef).
 */
const ENV_VAR_NAME = "[A-Za-z_][A-Za-z0-9_-]*";
const ENV_VAR_REF = new RegExp(`\\$\{(${ENV_VAR_NAME})}`, "g");
// Pure ${VAR} templates are env substitutions, not placeholder slots.
const PURE_ENV_REF = new RegExp(`^\\$\\{(${ENV_VAR_NAME})\\}$`);

/**
 * Placeholder detection is a property of the TEMPLATE, not of the resolved
 * secret (MF-2 / typescript B2 / tests T8).
 *
 * Whole-string forms (exact slot never filled):
 *   YOUR_TOKEN_HERE, TOKEN_HERE, REPLACE_ME, <redacted>
 * Embedded forms (realistic header/arg values):
 *   Bearer <REPLACE_ME>, prefix YOUR_TOKEN suffix, Authorization: <YOUR_KEY>
 *
 * Pure `${VAR}` templates are never placeholders: after substitution the
 * value is a real env secret (even if that secret happens to equal
 * REPLACE_ME / YOUR_TOKEN_HERE). Detecting post-substitution was the bug.
 */
const PLACEHOLDER_EXACT = /^(YOUR_.*|.*_HERE|REPLACE_ME|<.*>)$/;
const PLACEHOLDER_EMBEDDED =
	/(?:\bYOUR_[A-Za-z0-9_]+\b|\bREPLACE_ME\b|\b[A-Za-z0-9_]+_HERE\b|<[^\s>]+>)/;

function isPlaceholderTemplate(value) {
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
 * could not substitute). This is the structural guard against MF-1: the
 * detector no longer mirrors the resolver's charset, so a name outside the
 * shared class can never silently slip past the missing/unresolved guard.
 */
function hasUnresolvedRef(value) {
	return typeof value === "string" && value.includes("${");
}

/**
 * Resolve ${VAR} references in a server config
 * (env/headers/args/command/url) against the current process environment.
 * Returns { config, missing, placeholders }.
 *
 * `missing` lists the config keys (env/headers/url/command) or arg indices
 * (args[i]) whose resolved value still contains an unresolved ${VAR}
 * reference. `placeholders` lists keys/indices whose TEMPLATE
 * (pre-substitution) matches a placeholder form — never the post-sub secret.
 */
function resolveEnvVarsInServer(server) {
	const resolve = (value) => {
		if (typeof value !== "string") return value;
		return value.replace(ENV_VAR_REF, (match, name) => {
			const envValue = process.env[name];
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
	// HTTP MCP servers may embed ${VAR} in the URL (query tokens, path refs).
	// Guard the url channel the same way as env/headers/args/command (MF-3).
	if (typeof resolved.url === "string") {
		const template = resolved.url;
		const out = resolve(template);
		check("url", template, out);
		resolved.url = out;
	}

	// MF-5: catalog-only metadata keys (requiresEnv, and any other non-schema
	// keys added later in the catalog) must NOT leak into the user's persisted
	// mcp.json at mcpServers[<name>]. Carry catalog metadata out under a
	// separate `requiresEnv` field so the caller can still aggregate required
	// env vars into the pre-write requiredEnv gate, while the persisted config
	// is built from an explicit runtime-key allowlist.
	const catalogRequiresEnv = Array.isArray(resolved.requiresEnv)
		? resolved.requiresEnv
		: [];
	const SCHEMA_KEYS = [
		"command",
		"args",
		"env",
		"headers",
		"type",
		"url",
		"description",
		"disabled",
	];
	const persisted = {};
	for (const k of SCHEMA_KEYS) {
		if (Object.hasOwn(resolved, k)) persisted[k] = resolved[k];
	}

	return {
		config: persisted,
		requiresEnv: catalogRequiresEnv,
		missing: Array.from(missing),
		placeholders: placed,
	};
}

async function readJson(filePath, fallback) {
	try {
		return JSON.parse(await fs.readFile(filePath, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT" && fallback !== undefined) return fallback;
		throw error;
	}
}

function usage(manifest) {
	const profiles = Object.entries(manifest.profiles)
		.map(([name, profile]) => `  - ${name}: ${profile.description}`)
		.join("\n");

	return `Usage: node scripts/apply-mcp-profile.mjs [options] <profile> [profile...]

Options:
  --list                  List available MCP template profiles
  --scope project|user    Write to ./.pi/mcp.json or ~/.pi/agent/mcp.json (default: project)
  --profile <name>        When scope=user, write to ~/.pi/profiles/<name>/agent/mcp.json
  --target <path>         Write to an explicit mcp.json path instead of a derived scope path
  --dry-run               Show the planned merge without writing
  --help                  Show this help

Available profiles:
${profiles}`;
}

function readOptionValue(argv, index, flag) {
	const value = argv[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`${flag} requires a value`);
	}
	return value;
}

function parseArgs(argv) {
	const options = {
		scope: "project",
		list: false,
		dryRun: false,
	};
	const profiles = [];

	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (arg === "--list") {
			options.list = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}
		if (arg === "--scope") {
			options.scope = readOptionValue(argv, index, "--scope");
			index += 1;
			continue;
		}
		if (arg === "--profile") {
			options.profile = readOptionValue(argv, index, "--profile");
			index += 1;
			continue;
		}
		if (arg === "--target") {
			options.target = readOptionValue(argv, index, "--target");
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			throw new Error(`Unknown option: ${arg}`);
		}
		profiles.push(arg);
	}

	if (options.target && (options.scope !== "project" || options.profile)) {
		throw new Error("--target cannot be combined with --scope or --profile");
	}
	if (options.scope !== "project" && options.scope !== "user") {
		throw new Error(`Invalid scope: ${options.scope}`);
	}
	if (options.profile && options.scope !== "user") {
		throw new Error("--profile requires --scope user");
	}

	return { options, profiles };
}

function resolveTargetPath(options) {
	if (options.target) return path.resolve(expandHome(options.target));
	if (options.scope === "user" && options.profile) {
		return path.join(
			os.homedir(),
			".pi",
			"profiles",
			options.profile,
			"agent",
			"mcp.json",
		);
	}
	if (options.scope === "user") {
		return path.join(os.homedir(), ".pi", "agent", "mcp.json");
	}
	return path.resolve(process.cwd(), ".pi", "mcp.json");
}

async function main() {
	const manifest = await readJson(manifestPath);
	const { options, profiles } = parseArgs(process.argv.slice(2));

	if (options.help) {
		console.log(usage(manifest));
		return;
	}
	if (options.list) {
		console.log(usage(manifest));
		return;
	}
	if (profiles.length === 0) {
		throw new Error(
			"At least one MCP template profile is required. Use --list to inspect available profiles.",
		);
	}

	const unknownProfiles = profiles.filter(
		(profile) => !manifest.profiles[profile],
	);
	if (unknownProfiles.length > 0) {
		throw new Error(
			`Unknown MCP template profile(s): ${unknownProfiles.join(", ")}`,
		);
	}

	const targetPath = resolveTargetPath(options);
	const targetConfig = await readJson(targetPath, {
		$schema: schemaUrl,
		mcpServers: {},
	});

	if (
		!targetConfig ||
		typeof targetConfig !== "object" ||
		Array.isArray(targetConfig)
	) {
		throw new Error(`Target file must contain a JSON object: ${targetPath}`);
	}
	if (
		!targetConfig.mcpServers ||
		typeof targetConfig.mcpServers !== "object" ||
		Array.isArray(targetConfig.mcpServers)
	) {
		targetConfig.mcpServers = {};
	}
	if (!targetConfig.$schema) {
		targetConfig.$schema = schemaUrl;
	}

	const addedServers = [];
	const skippedServers = [];
	const placeholderServers = [];
	const unresolvedEnv = new Set();
	const requiredEnv = new Set();

	for (const profileName of profiles) {
		const profile = manifest.profiles[profileName];
		for (const envVar of profile.requiresEnv ?? []) requiredEnv.add(envVar);

		const templatePath = path.join(templateRoot, profile.file);
		const template = await readJson(templatePath);
		for (const [serverName, rawServerConfig] of Object.entries(
			template.mcpServers ?? {},
		)) {
			if (targetConfig.mcpServers[serverName] !== undefined) {
				skippedServers.push(serverName);
				continue;
			}
			const {
				config: serverConfig,
				requiresEnv: serverRequiresEnv,
				missing,
				placeholders,
			} = resolveEnvVarsInServer(rawServerConfig);
			for (const envVar of serverRequiresEnv ?? []) requiredEnv.add(envVar);
			for (const m of missing) unresolvedEnv.add(m);
			if (placeholders.length > 0) {
				placeholderServers.push(`${serverName} (${placeholders.join(", ")})`);
			}
			targetConfig.mcpServers[serverName] = serverConfig;
			addedServers.push(serverName);
		}

		if (
			Array.isArray(template.disabledServers) &&
			template.disabledServers.length > 0
		) {
			const disabled = new Set(targetConfig.disabledServers ?? []);
			for (const serverName of template.disabledServers)
				disabled.add(serverName);
			targetConfig.disabledServers = Array.from(disabled).sort();
		}
	}

	// Validate: required env vars must be present in the runtime environment.
	const missingRequiredEnv = Array.from(requiredEnv).filter(
		(name) => !process.env[name],
	);
	if (missingRequiredEnv.length > 0) {
		const msg =
			`Missing required environment variables: ${missingRequiredEnv.sort().join(", ")}. ` +
			"Export them before applying this profile, or run with --dry-run to preview.";
		if (options.dryRun) {
			console.warn(`Warning: ${msg}`);
		} else {
			throw new Error(msg);
		}
	}

	// Validate: never persist unresolved placeholders or unreplaced ${VAR}
	if (!options.dryRun && placeholderServers.length > 0) {
		throw new Error(
			"Refusing to write placeholder token slots: " +
				`${placeholderServers.join("; ")}. ` +
				"Templates must use ${VAR} references backed by real environment values.",
		);
	}
	if (!options.dryRun && unresolvedEnv.size > 0) {
		throw new Error(
			`Unresolved \${VAR} references in env/headers/args/command/url: ${Array.from(unresolvedEnv).sort().join(", ")}. ` +
				"Set these in your environment before applying, or run with --dry-run.",
		);
	}

	if (options.dryRun) {
		console.log(`Dry run target: ${targetPath}`);
		console.log(`Profiles: ${profiles.join(", ")}`);
		console.log(
			`Would add: ${addedServers.length > 0 ? addedServers.join(", ") : "(none)"}`,
		);
		console.log(
			`Would skip existing: ${skippedServers.length > 0 ? skippedServers.join(", ") : "(none)"}`,
		);
		if (requiredEnv.size > 0) {
			console.log(
				`Required env vars: ${Array.from(requiredEnv).sort().join(", ")}`,
			);
		}
		if (placeholderServers.length > 0) {
			console.warn(
				`Placeholder token slots in: ${placeholderServers.join("; ")} (would be refused on write)`,
			);
		}
		if (unresolvedEnv.size > 0) {
			console.warn(
				`Unresolved \${VAR} refs: ${Array.from(unresolvedEnv).sort().join(", ")} (would be refused on write)`,
			);
		}
		return;
	}

	if (addedServers.length === 0) {
		console.log(
			`No changes needed at ${targetPath}. All requested MCP template servers already exist.`,
		);
		if (requiredEnv.size > 0) {
			console.log(
				`Required env vars: ${Array.from(requiredEnv).sort().join(", ")}`,
			);
		}
		return;
	}

	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.writeFile(
		targetPath,
		`${JSON.stringify(targetConfig, null, 2)}\n`,
		"utf8",
	);

	console.log(`Applied MCP template profiles to ${targetPath}`);
	console.log(`Profiles: ${profiles.join(", ")}`);
	console.log(`Added servers: ${addedServers.join(", ")}`);
	if (skippedServers.length > 0) {
		console.log(`Skipped existing servers: ${skippedServers.join(", ")}`);
	}
	if (requiredEnv.size > 0) {
		console.log(
			`Required env vars: ${Array.from(requiredEnv).sort().join(", ")}`,
		);
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
