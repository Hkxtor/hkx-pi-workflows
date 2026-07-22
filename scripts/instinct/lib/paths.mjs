/**
 * Cross-platform data-root and project detection for instinct store.
 *
 * Data root precedence:
 *   1. HKX_HOMUNCULUS_DIR (absolute)
 *   2. win32 → LOCALAPPDATA/hkx-homunculus (or ~/AppData/Local/...)
 *   3. XDG_DATA_HOME/hkx-homunculus (absolute) else ~/.local/share/hkx-homunculus
 *
 * Callers: cli.mjs, store.mjs, generate.mjs, scripts/tests/instinct-*.mjs
 * Plan: docs/instinct-evolve-plan.md (C1–C3)
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR_NAME = "hkx-homunculus";

/**
 * @typedef {object} PathEnv
 * @property {string} [HKX_HOMUNCULUS_DIR]
 * @property {string} [HKX_PROJECT_ID]
 * @property {string} [XDG_DATA_HOME]
 * @property {string} [LOCALAPPDATA]
 * @property {string} [HOME]
 * @property {NodeJS.Platform} [platform]
 * @property {() => string} [homedir]
 */

/**
 * @param {PathEnv} [env]
 * @returns {NodeJS.Platform}
 */
export function resolvePlatform(env = process.env) {
	return /** @type {NodeJS.Platform} */ (env.platform ?? process.platform);
}

/**
 * @param {PathEnv} [env]
 * @returns {string}
 */
export function resolveHomedir(env = process.env) {
	if (typeof env.homedir === "function") return env.homedir();
	return os.homedir();
}

/**
 * @param {string | undefined} value
 * @param {NodeJS.Platform} platform
 * @returns {boolean}
 */
export function isAbsolutePath(value, platform = process.platform) {
	if (!value) return false;
	const impl = platform === "win32" ? path.win32 : path.posix;
	return impl.isAbsolute(value);
}

/**
 * Resolve instinct data root. Injectable env for unit tests.
 * @param {PathEnv} [env]
 * @returns {{ root: string, source: string, warnings: string[] }}
 */
export function resolveHomunculusDir(env = process.env) {
	const platform = resolvePlatform(env);
	const warnings = [];
	const join = platform === "win32" ? path.win32.join : path.posix.join;
	const home = resolveHomedir(env);

	const override = env.HKX_HOMUNCULUS_DIR;
	if (override) {
		if (isAbsolutePath(override, platform)) {
			return { root: override, source: "HKX_HOMUNCULUS_DIR", warnings };
		}
		warnings.push(
			`HKX_HOMUNCULUS_DIR=${JSON.stringify(override)} is not absolute; ignoring`,
		);
	}

	if (platform === "win32") {
		const local = env.LOCALAPPDATA || join(home, "AppData", "Local");
		const root = join(local, DIR_NAME);
		return {
			root,
			source: env.LOCALAPPDATA ? "LOCALAPPDATA" : "AppData/Local",
			warnings,
		};
	}

	const xdg = env.XDG_DATA_HOME;
	if (xdg) {
		if (isAbsolutePath(xdg, platform)) {
			return {
				root: join(xdg, DIR_NAME),
				source: "XDG_DATA_HOME",
				warnings,
			};
		}
		warnings.push(
			`XDG_DATA_HOME=${JSON.stringify(xdg)} is not absolute; ignoring`,
		);
	}

	return {
		root: join(home, ".local", "share", DIR_NAME),
		source: "default-xdg",
		warnings,
	};
}

/**
 * Normalize a filesystem path for stable hashing across OS path spellings.
 * @param {string} input
 * @param {NodeJS.Platform} [platform]
 */
export function normalizePathForHash(input, platform = process.platform) {
	let p = input.trim();
	if (!p) return "";
	p = p.replace(/\\/g, "/");
	while (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
	if (platform === "win32" || /^[A-Za-z]:\//.test(p) || p.startsWith("//")) {
		if (/^[A-Za-z]:\//.test(p)) {
			p = p[0].toLowerCase() + p.slice(1);
		}
		p = p.toLowerCase();
	}
	return p;
}

/**
 * Strip credentials and normalize git remote URLs for hashing.
 * @param {string} remoteUrl
 */
export function stripRemoteCredentials(remoteUrl) {
	let url = remoteUrl.trim();
	url = url.replace(/^(https?:\/\/)([^/@]+)@/i, "$1");
	url = url.replace(/^(ssh:\/\/)([^/@]+)@/i, "$1");
	url = url.replace(/\.git$/i, "");
	while (url.endsWith("/")) url = url.slice(0, -1);
	return url;
}

/**
 * @param {string} value
 * @returns {string} 12-char hex
 */
export function hash12(value) {
	return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

/**
 * @param {string} id
 */
export function isValidInstinctId(id) {
	return typeof id === "string" && /^[a-z0-9][a-z0-9._-]*$/.test(id);
}

/**
 * @param {string} cwd
 * @param {{ env?: PathEnv, git?: (args: string[], cwd: string) => { status: number, stdout: string, stderr: string } }} [opts]
 */
export function detectProject(cwd = process.cwd(), opts = {}) {
	const env = opts.env ?? process.env;
	const platform = resolvePlatform(env);
	const runGit =
		opts.git ??
		((args, gitCwd) => {
			const r = spawnSync("git", args, {
				cwd: gitCwd,
				encoding: "utf8",
				shell: false,
				windowsHide: true,
			});
			return {
				status: r.status ?? 1,
				stdout: (r.stdout ?? "").toString(),
				stderr: (r.stderr ?? "").toString(),
			};
		});

	const explicit = env.HKX_PROJECT_ID;
	if (explicit && /^[a-f0-9]{12}$/i.test(explicit)) {
		return {
			id: explicit.toLowerCase(),
			name: path.basename(cwd) || "project",
			source: "HKX_PROJECT_ID",
			remote: null,
			root: cwd,
		};
	}

	const remoteRes = runGit(["remote", "get-url", "origin"], cwd);
	if (remoteRes.status === 0) {
		const remote = remoteRes.stdout.trim();
		if (remote) {
			const stripped = stripRemoteCredentials(remote);
			const id = hash12(stripped);
			let name = path.basename(stripped.replace(/\/$/, ""));
			name = name.replace(/\.git$/i, "") || "project";
			return {
				id,
				name,
				source: "git-remote",
				remote: stripped,
				root: cwd,
			};
		}
	}

	const topRes = runGit(["rev-parse", "--show-toplevel"], cwd);
	if (topRes.status === 0) {
		const top = topRes.stdout.trim();
		if (top) {
			const norm = normalizePathForHash(top, platform);
			const id = hash12(norm);
			return {
				id,
				name: path.basename(top.replace(/\\/g, "/")) || "project",
				source: "git-toplevel",
				remote: null,
				root: top,
			};
		}
	}

	return {
		id: "global",
		name: "global",
		source: "global-fallback",
		remote: null,
		root: cwd,
	};
}

/**
 * Layout paths under a homunculus root for a project.
 * @param {string} root
 * @param {{ id: string }} project
 * @param {NodeJS.Platform} [platform]
 */
export function layoutPaths(root, project, platform = process.platform) {
	const join = platform === "win32" ? path.win32.join : path.join;
	const isGlobal = project.id === "global";
	const base = isGlobal ? root : join(root, "projects", project.id);

	return {
		root,
		base,
		isGlobal,
		projectsJson: join(root, "projects.json"),
		globalInstincts: {
			personal: join(root, "instincts", "personal"),
			inherited: join(root, "instincts", "inherited"),
			pending: join(root, "instincts", "pending"),
		},
		globalEvolved: {
			skills: join(root, "evolved", "skills"),
			commands: join(root, "evolved", "commands"),
			agents: join(root, "evolved", "agents"),
		},
		projectInstincts: isGlobal
			? null
			: {
					personal: join(base, "instincts", "personal"),
					inherited: join(base, "instincts", "inherited"),
					pending: join(base, "instincts", "pending"),
				},
		projectEvolved: isGlobal
			? null
			: {
					skills: join(base, "evolved", "skills"),
					commands: join(base, "evolved", "commands"),
					agents: join(base, "evolved", "agents"),
				},
		metaJson: isGlobal ? null : join(base, "meta.json"),
		evolvedRoot: isGlobal ? join(root, "evolved") : join(base, "evolved"),
	};
}

/**
 * Ensure directory tree exists for store + evolve drafts.
 * @param {string} root
 * @param {{ id: string, name?: string, remote?: string | null, source?: string }} project
 */
export function ensureLayout(root, project) {
	const layout = layoutPaths(root, project);
	const dirs = [
		layout.globalInstincts.personal,
		layout.globalInstincts.inherited,
		layout.globalInstincts.pending,
		layout.globalEvolved.skills,
		layout.globalEvolved.commands,
		layout.globalEvolved.agents,
	];
	if (layout.projectInstincts) {
		dirs.push(
			layout.projectInstincts.personal,
			layout.projectInstincts.inherited,
			layout.projectInstincts.pending,
			layout.projectEvolved.skills,
			layout.projectEvolved.commands,
			layout.projectEvolved.agents,
		);
	}
	for (const d of dirs) {
		fs.mkdirSync(d, { recursive: true });
	}

	if (layout.metaJson) {
		const meta = {
			id: project.id,
			name: project.name ?? project.id,
			remote: project.remote ?? null,
			source: project.source ?? null,
			updated: new Date().toISOString(),
		};
		fs.writeFileSync(
			layout.metaJson,
			`${JSON.stringify(meta, null, 2)}\n`,
			"utf8",
		);
	}

	let registry = {};
	if (fs.existsSync(layout.projectsJson)) {
		try {
			registry = JSON.parse(fs.readFileSync(layout.projectsJson, "utf8"));
		} catch {
			registry = {};
		}
	}
	if (project.id !== "global") {
		registry[project.id] = {
			name: project.name ?? project.id,
			remote: project.remote ?? null,
			source: project.source ?? null,
			updated: new Date().toISOString(),
		};
		fs.writeFileSync(
			layout.projectsJson,
			`${JSON.stringify(registry, null, 2)}\n`,
			"utf8",
		);
	}

	return layout;
}
