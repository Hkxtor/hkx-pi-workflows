#!/usr/bin/env node
/**
 * Instinct store + evolve + OM adapter CLI (cross-platform Node ESM).
 *
 * Usage:
 *   node scripts/instinct/cli.mjs init|status|evolve|from-om|accept|export|import|promote|publish-draft|decay [flags]
 *
 * Imports: lib/paths, store, cluster, generate, om-session, om-map, transfer, promote, publish, decay
 * Docs: docs/instinct-evolve-plan.md, commands/hkx-evolve.md, hkx-instinct-accept.md
 * Public surface: process exit 0/1/2; --json stdout schema
 * Auth: Phase 1-3 + publish-draft + confidence decay
 * Verify: npm test; HKX_HOMUNCULUS_DIR=... node scripts/instinct/cli.mjs from-om|accept
 */
import path from "node:path";
import {
	resolveHomunculusDir,
	detectProject,
	ensureLayout,
} from "./lib/paths.mjs";
import {
	loadAllInstincts,
	writeInstinct,
	listPending,
	acceptPending,
} from "./lib/store.mjs";
import { analyzeEvolve, formatEvolveReport } from "./lib/cluster.mjs";
import { generateEvolved } from "./lib/generate.mjs";
import {
	projectSessionFile,
	resolveSessionPath,
	resolveSessionsRoot,
} from "./lib/om-session.mjs";
import { mapProjectionToCandidates } from "./lib/om-map.mjs";
import {
	collectExportInstincts,
	formatExportBundle,
	importInstinctBundle,
	importFromEccHomunculus,
} from "./lib/transfer.mjs";
import {
	listPromoteCandidates,
	promoteInstinct,
	promoteAuto,
	PROMOTE_CONFIDENCE_THRESHOLD,
	PROMOTE_MIN_PROJECTS,
} from "./lib/promote.mjs";
import {
	listEvolvedDrafts,
	planPublish,
	applyPublish,
	defaultPublishRoot,
	isPackageRepoSkillsRoot,
} from "./lib/publish.mjs";
import {
	planDecay,
	applyDecay,
	DEFAULT_DECAY_PER_WEEK,
	DEFAULT_CONFIDENCE_FLOOR,
} from "./lib/decay.mjs";
import fs from "node:fs";

function configureUtf8() {
	if (process.platform !== "win32") return;
	try {
		process.stdout.setDefaultEncoding?.("utf8");
		process.stderr.setDefaultEncoding?.("utf8");
	} catch {
		/* ignore */
	}
}

function usage() {
	return `hkx instinct CLI

Usage:
  node scripts/instinct/cli.mjs <command> [flags]

Commands:
  init                 Create data layout for current project
  status [--pending]   List instincts (project + global)
  evolve [--generate]  Cluster instincts; optional draft generation
  from-om              Map OM session reflections -> pending instincts
  accept               Move pending instincts to personal
  export               Export instincts to stdout or --output file
  import               Import instincts from file (or --from-ecc dir)
  promote              List/apply project->global promotion candidates
  publish-draft        Publish evolved/ drafts to Pi agent surfaces
  decay                Apply time-based confidence decay (preview default)
  help                 Show this help

Flags:
  --json               Machine-readable stdout
  --pending            Include pending instincts (status)
  --generate           Write evolved/ drafts (evolve only)
  --cwd <path>         Working directory for project detection
  --session <path|id>  Session JSONL path or partial id (from-om)
  --dry-run            Do not write (from-om)
  --min-relevance <l>  low|medium|high|critical (from-om, default medium)
  --all                Accept all pending (accept)
  --force              Overwrite existing personal on accept
  --scope <s>          project|global (accept, default project)
  --id <instinct-id>   Accept/promote specific id (repeatable)
  --output <file>      Export target file (export)
  --domain <name>      Filter by domain (export)
  --min-confidence <n> Min confidence 0-1 (export/import)
  --from-ecc <dir>     Import from ECC homunculus tree (import)
  --apply              Apply promote candidates (promote; else list only)
  --from-project <id>  Promote using version from project id
  --target <dir>       Publish root (default ~/.pi/agent)
  --kind <k>           skill|command|agent (repeatable; publish-draft)
  --name <n>           Draft name filter (repeatable; publish-draft)
  --rate <n>           Decay per inactive week (default 0.02)
  --floor <n>          Confidence floor (default 0.1)
  --as-of <ISO-date>   Evaluate decay as of date (tests/backdate)

Env:
  HKX_HOMUNCULUS_DIR   Absolute data root
  HKX_PROJECT_ID       Force 12-hex project id
  HKX_PI_SESSIONS_DIR  Absolute Pi sessions root override
`;
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	const args = {
		command: "help",
		json: false,
		pending: false,
		generate: false,
		dryRun: false,
		all: false,
		force: false,
		cwd: process.cwd(),
		session: /** @type {string|undefined} */ (undefined),
		minRelevance: "medium",
		scope: "project",
		/** @type {string[]} */
		ids: [],
		output: /** @type {string|undefined} */ (undefined),
		domain: /** @type {string|undefined} */ (undefined),
		minConfidence: /** @type {number|undefined} */ (undefined),
		fromEcc: /** @type {string|undefined} */ (undefined),
		apply: false,
		fromProject: /** @type {string|undefined} */ (undefined),
		source: /** @type {string|undefined} */ (undefined),
		target: /** @type {string|undefined} */ (undefined),
		/** @type {string[]} */
		kinds: [],
		/** @type {string[]} */
		names: [],
		rate: /** @type {number|undefined} */ (undefined),
		floor: /** @type {number|undefined} */ (undefined),
		asOf: /** @type {string|undefined} */ (undefined),
	};
	const rest = argv.slice(2);
	if (rest.length === 0) return args;
	args.command = rest[0];
	for (let i = 1; i < rest.length; i++) {
		const a = rest[i];
		if (a === "--json") args.json = true;
		else if (a === "--pending") args.pending = true;
		else if (a === "--generate") args.generate = true;
		else if (a === "--dry-run") args.dryRun = true;
		else if (a === "--all") args.all = true;
		else if (a === "--force") args.force = true;
		else if (a === "--apply") args.apply = true;
		else if (a === "--cwd") args.cwd = rest[++i] ?? args.cwd;
		else if (a === "--session") args.session = rest[++i];
		else if (a === "--min-relevance")
			args.minRelevance = rest[++i] ?? args.minRelevance;
		else if (a === "--scope") args.scope = rest[++i] ?? args.scope;
		else if (a === "--output") args.output = rest[++i];
		else if (a === "--domain") args.domain = rest[++i];
		else if (a === "--min-confidence") {
			const n = Number.parseFloat(rest[++i] ?? "");
			if (Number.isFinite(n)) args.minConfidence = n;
		} else if (a === "--from-ecc") args.fromEcc = rest[++i];
		else if (a === "--from-project") args.fromProject = rest[++i];
		else if (a === "--target") args.target = rest[++i];
		else if (a === "--kind") {
			const k = rest[++i];
			if (k) args.kinds.push(k);
		} else if (a === "--name") {
			const n = rest[++i];
			if (n) args.names.push(n);
		} else if (a === "--rate") {
			const n = Number.parseFloat(rest[++i] ?? "");
			if (Number.isFinite(n)) args.rate = n;
		} else if (a === "--floor") {
			const n = Number.parseFloat(rest[++i] ?? "");
			if (Number.isFinite(n)) args.floor = n;
		} else if (a === "--as-of") {
			args.asOf = rest[++i];
		} else if (a === "--id") {
			const id = rest[++i];
			if (id) args.ids.push(id);
		} else if (a === "--help" || a === "-h") {
			args.command = "help";
		} else if (!a.startsWith("-") && (args.command === "accept" || args.command === "promote")) {
			args.ids.push(a);
		} else if (!a.startsWith("-") && args.command === "import" && !args.source && !args.fromEcc) {
			args.source = a;
		}
	}
	return args;
}

function cmdInit(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	const layout = ensureLayout(root, project);
	const payload = {
		root,
		source,
		project,
		layout: { base: layout.base, evolvedRoot: layout.evolvedRoot },
	};
	if (args.json) {
		console.log(JSON.stringify(payload, null, 2));
	} else {
		console.log("Initialized instinct store");
		console.log(`  data root: ${root} (${source})`);
		console.log(
			`  project:   ${project.name} (${project.id}) [${project.source}]`,
		);
		console.log(`  base:      ${layout.base}`);
	}
	return 0;
}

function cmdStatus(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);
	const instincts = loadAllInstincts(root, project, {
		includePending: args.pending,
	});
	const projectOnes = instincts.filter((i) => i._scope_label === "project");
	const globalOnes = instincts.filter((i) => i._scope_label === "global");
	const pending = args.pending
		? instincts.filter((i) => i._source_type === "pending")
		: listPending(root, project, "all");

	if (args.json) {
		console.log(
			JSON.stringify(
				{
					root,
					source,
					project,
					counts: {
						total: instincts.length,
						project: projectOnes.length,
						global: globalOnes.length,
						pending: pending.length,
					},
					instincts: instincts.map((i) => ({
						id: i.id,
						trigger: i.trigger,
						confidence: i.confidence,
						domain: i.domain,
						scope: i._scope_label,
						source_type: i._source_type,
						source_file: i._source_file,
					})),
				},
				null,
				2,
			),
		);
		return 0;
	}

	console.log("Instinct status");
	console.log(`  data root: ${root} (${source})`);
	console.log(`  project:   ${project.name} (${project.id})`);
	console.log(
		`  counts:    total=${instincts.length} project=${projectOnes.length} global=${globalOnes.length} pending=${pending.length}`,
	);
	if (!instincts.length && !pending.length) {
		console.log(
			"  (no instincts yet — add *.md under instincts/personal/ or run from-om)",
		);
		return 0;
	}
	/** @type {Map<string, typeof instincts>} */
	const byDomain = new Map();
	const list = args.pending
		? instincts
		: loadAllInstincts(root, project, { includePending: false });
	for (const inst of list) {
		const d = inst.domain || "general";
		if (!byDomain.has(d)) byDomain.set(d, []);
		byDomain.get(d)?.push(inst);
	}
	for (const domain of [...byDomain.keys()].sort()) {
		console.log(`\n  [${domain}]`);
		for (const inst of byDomain.get(domain) ?? []) {
			const conf = Math.round((inst.confidence ?? 0.5) * 100);
			console.log(
				`    - ${inst.id} (${conf}%) scope=${inst._scope_label || "?"} trigger=${JSON.stringify(inst.trigger ?? "")}`,
			);
		}
	}
	if (!args.pending && pending.length) {
		console.log(`\n  [pending] ${pending.length} awaiting accept`);
		for (const inst of pending.slice(0, 10)) {
			console.log(
				`    - ${inst.id} (${Math.round((inst.confidence ?? 0.5) * 100)}%)`,
			);
		}
	}
	console.log("");
	return 0;
}

function cmdEvolve(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);
	const instincts = loadAllInstincts(root, project, { includePending: false });
	const projectCount = instincts.filter(
		(i) => i._scope_label === "project",
	).length;
	const globalCount = instincts.filter(
		(i) => i._scope_label === "global",
	).length;
	const analysis = analyzeEvolve(instincts);

	if (args.json) {
		/** @type {{ root: string, source: string, project: object, counts: object, analysis: object, generated: string[] }} */
		const payload = {
			root,
			source,
			project,
			counts: { project: projectCount, global: globalCount },
			analysis: {
				ok: analysis.ok,
				reason: analysis.reason,
				total: analysis.total,
				highConfidence: analysis.highConfidence.map((i) => i.id),
				skillCandidates: analysis.skillCandidates.map((c) => ({
					trigger: c.trigger,
					avgConfidence: c.avgConfidence,
					instinctIds: c.instincts.map((i) => i.id),
					domains: c.domains,
				})),
				commandCandidates: analysis.commandCandidates.map((c) => ({
					slug: c.slug,
					id: c.instinct.id,
					confidence: c.confidence,
				})),
				agentCandidates: analysis.agentCandidates.map((c) => ({
					trigger: c.trigger,
					avgConfidence: c.avgConfidence,
					instinctIds: c.instincts.map((i) => i.id),
				})),
			},
			generated: [],
		};
		if (args.generate && analysis.ok) {
			payload.generated = generateEvolved(root, project, analysis);
		}
		console.log(JSON.stringify(payload, null, 2));
		return analysis.ok ? 0 : 1;
	}

	console.log(
		formatEvolveReport(analysis, project, { projectCount, globalCount }),
	);
	console.log(`Data root: ${root} (${source})`);

	if (!analysis.ok) return 1;

	if (args.generate) {
		const generated = generateEvolved(root, project, analysis);
		if (generated.length) {
			console.log(`\nGenerated ${generated.length} evolved structures:`);
			for (const p of generated) console.log(`   ${p}`);
		} else {
			console.log(
				"\nNo structures generated (need higher-confidence clusters).",
			);
		}
	} else {
		console.log("\nTip: pass --generate to write drafts under evolved/");
	}
	return 0;
}

function cmdFromOm(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);

	const sessionsRoot = resolveSessionsRoot(process.env);
	const sessionPath = resolveSessionPath({
		session: args.session,
		cwd: args.cwd,
		sessionsRoot,
	});
	if (!sessionPath) {
		const msg = args.session
			? `Session not found: ${args.session}`
			: `No session JSONL under ${sessionsRoot} for cwd ${args.cwd}. Pass --session <path>.`;
		if (args.json) {
			console.log(JSON.stringify({ ok: false, error: msg }));
		} else {
			console.error(`[hkx-instinct] ${msg}`);
		}
		return 1;
	}

	const projection = projectSessionFile(sessionPath);
	const { candidates, skipped } = mapProjectionToCandidates(projection, {
		project,
		minRelevance: args.minRelevance,
	});

	/** @type {string[]} */
	const written = [];
	if (!args.dryRun) {
		for (const inst of candidates) {
			const p = writeInstinct(
				root,
				project,
				/** @type {any} */ (inst),
				"pending",
				"project",
			);
			written.push(p);
		}
	}

	const payload = {
		ok: true,
		dryRun: args.dryRun,
		sessionPath,
		root,
		source,
		project,
		counts: {
			observations: projection.observations.length,
			reflections: projection.reflections.length,
			candidates: candidates.length,
			skipped: skipped.length,
			written: written.length,
		},
		candidates: candidates.map((c) => ({
			id: /** @type {any} */ (c).id,
			trigger: /** @type {any} */ (c).trigger,
			confidence: /** @type {any} */ (c).confidence,
			domain: /** @type {any} */ (c).domain,
		})),
		skipped,
		written,
	};

	if (args.json) {
		console.log(JSON.stringify(payload, null, 2));
	} else {
		console.log("OM -> pending instincts");
		console.log(`  session:     ${sessionPath}`);
		console.log(`  data root:   ${root}`);
		console.log(
			`  projection:  obs=${projection.observations.length} reflections=${projection.reflections.length}`,
		);
		console.log(
			`  candidates:  ${candidates.length}  skipped: ${skipped.length}  dry-run: ${args.dryRun}`,
		);
		for (const c of candidates.slice(0, 20)) {
			const inst = /** @type {any} */ (c);
			console.log(
				`    + ${inst.id} (${Math.round((inst.confidence ?? 0.5) * 100)}%) [${inst.domain}]`,
			);
		}
		if (skipped.length) {
			console.log("  skipped (first 10):");
			for (const s of skipped.slice(0, 10)) {
				console.log(
					`    - ${/** @type {any} */ (s).reflectionId}: ${/** @type {any} */ (s).reason}`,
				);
			}
		}
		if (!args.dryRun) {
			console.log(`  wrote ${written.length} pending files`);
			console.log(
				"  Next: review with status --pending, then accept --all or --id <id>",
			);
		} else {
			console.log("  (dry-run: nothing written)");
		}
	}
	return 0;
}

function cmdAccept(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);

	const scope = args.scope === "global" ? "global" : "project";
	let result;
	try {
		result = acceptPending(root, project, {
			all: args.all,
			ids: args.ids,
			scope,
			force: args.force,
		});
	} catch (err) {
		const msg = /** @type {Error} */ (err).message;
		if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
		else console.error(`[hkx-instinct] ${msg}`);
		return 1;
	}

	if (args.json) {
		console.log(
			JSON.stringify(
				{ ok: true, root, source, project, scope, ...result },
				null,
				2,
			),
		);
	} else {
		console.log("Accept pending -> personal");
		console.log(`  scope:    ${scope}`);
		console.log(`  accepted: ${result.accepted.length}`);
		for (const id of result.accepted) console.log(`    + ${id}`);
		if (result.skipped.length) {
			console.log(`  skipped:  ${result.skipped.length}`);
			for (const s of result.skipped) console.log(`    - ${s.id}: ${s.reason}`);
		}
		if (result.missing.length) {
			console.log(`  missing:  ${result.missing.join(", ")}`);
		}
		console.log("  Next: node scripts/instinct/cli.mjs evolve");
	}
	return result.missing.length && !result.accepted.length ? 1 : 0;
}

function cmdExport(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);
	const scope =
		args.scope === "project" || args.scope === "global" ? args.scope : "all";
	const instincts = collectExportInstincts(root, project, {
		scope,
		domain: args.domain,
		minConfidence: args.minConfidence,
	});
	if (!instincts.length) {
		if (args.json) console.log(JSON.stringify({ ok: false, count: 0 }));
		else console.error("[hkx-instinct] No instincts match export criteria");
		return 1;
	}
	const bundle = formatExportBundle(instincts, { project, scope });
	if (args.output) {
		const out = path.resolve(args.output);
		fs.mkdirSync(path.dirname(out), { recursive: true });
		fs.writeFileSync(out, bundle, "utf8");
		if (args.json) {
			console.log(
				JSON.stringify({
					ok: true,
					count: instincts.length,
					output: out,
					ids: instincts.map((i) => i.id),
				}),
			);
		} else {
			console.log(`Exported ${instincts.length} instincts to ${out}`);
		}
	} else if (args.json) {
		console.log(
			JSON.stringify({
				ok: true,
				count: instincts.length,
				bundle,
				ids: instincts.map((i) => i.id),
			}),
		);
	} else {
		process.stdout.write(bundle);
	}
	return 0;
}

function cmdImport(args) {
	const { root, source: rootSource, warnings } = resolveHomunculusDir(
		process.env,
	);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);
	const scope = args.scope === "global" ? "global" : "project";

	let result;
	if (args.fromEcc) {
		result = importFromEccHomunculus(path.resolve(args.fromEcc), root, project, {
			dryRun: args.dryRun,
			minConfidence: args.minConfidence,
			scope,
		});
	} else {
		const src = args.source;
		if (!src) {
			const msg = "import requires a file path or --from-ecc <dir>";
			if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
			else console.error(`[hkx-instinct] ${msg}`);
			return 1;
		}
		const filePath = path.resolve(src);
		if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
			const msg = `Import file not found: ${filePath}`;
			if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
			else console.error(`[hkx-instinct] ${msg}`);
			return 1;
		}
		const content = fs.readFileSync(filePath, "utf8");
		result = importInstinctBundle(content, root, project, {
			scope,
			minConfidence: args.minConfidence,
			dryRun: args.dryRun,
			bucket: "personal",
		});
	}

	if (args.json) {
		console.log(
			JSON.stringify(
				{
					...result,
					root,
					source: rootSource,
					project,
					counts: {
						add: result.toAdd?.length ?? 0,
						update: result.toUpdate?.length ?? 0,
						skip: result.duplicates?.length ?? 0,
						written: result.written?.length ?? 0,
					},
					toAdd: (result.toAdd || []).map((i) => i.id),
					toUpdate: (result.toUpdate || []).map((i) => i.id),
					duplicates: (result.duplicates || []).map((i) => i.id),
				},
				null,
				2,
			),
		);
	} else {
		if (!result.ok) {
			console.error(`[hkx-instinct] ${result.reason || "import failed"}`);
			return 1;
		}
		console.log("Import instincts");
		console.log(`  target scope: ${result.targetScope}`);
		console.log(`  new: ${result.toAdd.length}  update: ${result.toUpdate.length}  skip: ${result.duplicates.length}`);
		for (const i of result.toAdd.slice(0, 15))
			console.log(`    + ${i.id} (${Math.round((i.confidence ?? 0.5) * 100)}%)`);
		for (const i of result.toUpdate.slice(0, 10))
			console.log(`    ~ ${i.id} (${Math.round((i.confidence ?? 0.5) * 100)}%)`);
		if (args.dryRun) console.log("  (dry-run: nothing written)");
		else console.log(`  wrote ${result.written.length} files`);
	}
	return result.ok ? 0 : 1;
}

function cmdPromote(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);

	// Specific ids
	if (args.ids.length) {
		/** @type {object[]} */
		const results = [];
		for (const id of args.ids) {
			results.push(
				promoteInstinct(root, id, {
					dryRun: args.dryRun || !args.apply,
					force: args.force,
					fromProjectId: args.fromProject,
				}),
			);
		}
		// If --apply not set, treat as dry-run list of those ids
		if (args.json) {
			console.log(
				JSON.stringify(
					{
						ok: true,
						apply: args.apply && !args.dryRun,
						results,
					},
					null,
					2,
				),
			);
		} else {
			console.log(
				args.apply && !args.dryRun
					? "Promote apply"
					: "Promote preview (pass --apply to write)",
			);
			for (const r of results) {
				if (r.ok) {
					console.log(
						`  ${r.id} conf=${Math.round((r.confidence ?? 0.5) * 100)}% from=[${(r.fromProjects || []).join(", ")}]${r.dryRun ? " [dry]" : ` -> ${r.dest}`}`,
					);
				} else {
					console.log(`  ! ${r.reason}`);
				}
			}
		}
		return results.every((r) => r.ok) ? 0 : 1;
	}

	const candidates = listPromoteCandidates(root);
	if (!args.apply || args.dryRun) {
		if (args.json) {
			console.log(
				JSON.stringify(
					{
						ok: true,
						criteria: {
							minProjects: PROMOTE_MIN_PROJECTS,
							minConfidence: PROMOTE_CONFIDENCE_THRESHOLD,
						},
						candidates: candidates.map((c) => ({
							id: c.id,
							avgConfidence: c.avgConfidence,
							projects: c.projects,
						})),
					},
					null,
					2,
				),
			);
		} else {
			console.log("Promotion candidates (project -> global)");
			console.log(
				`  criteria: ${PROMOTE_MIN_PROJECTS}+ projects, avg conf >= ${Math.round(PROMOTE_CONFIDENCE_THRESHOLD * 100)}%`,
			);
			if (!candidates.length) {
				console.log("  (none)");
			} else {
				for (const c of candidates) {
					const names = c.projects.map((p) => p.name).join(", ");
					console.log(
						`  * ${c.id} (avg ${Math.round(c.avgConfidence * 100)}%) in: ${names}`,
					);
				}
				console.log("\n  Run with --apply to write into global personal/");
			}
		}
		return 0;
	}

	const { results } = promoteAuto(root, { dryRun: false, force: args.force });
	if (args.json) {
		console.log(JSON.stringify({ ok: true, apply: true, results }, null, 2));
	} else {
		console.log(`Promoted ${results.filter((r) => r.ok && !r.dryRun).length} instincts`);
		for (const r of results) {
			if (r.ok) console.log(`  + ${r.id} -> ${r.dest}`);
			else console.log(`  ! ${r.reason}`);
		}
	}
	return 0;
}


function cmdPublishDraft(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);

	const publishRoot = args.target
		? path.resolve(args.target)
		: defaultPublishRoot(process.env);

	if (isPackageRepoSkillsRoot(publishRoot) && !args.force) {
		const msg =
			"Refusing to publish into @hkx/pi-workflows package tree without --force. Use default ~/.pi/agent or set --target explicitly.";
		if (args.json) console.log(JSON.stringify({ ok: false, error: msg, publishRoot }));
		else console.error(`[hkx-instinct] ${msg}`);
		return 1;
	}

	/** @type {Array<"skill"|"command"|"agent">|undefined} */
	let kinds;
	if (args.kinds.length) {
		kinds = [];
		for (const k of args.kinds) {
			if (k === "skill" || k === "command" || k === "agent") kinds.push(k);
			else {
				const msg = `Invalid --kind ${k} (use skill|command|agent)`;
				if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
				else console.error(`[hkx-instinct] ${msg}`);
				return 1;
			}
		}
	}

	const drafts = listEvolvedDrafts(root, project, {
		kinds,
		names: args.names.length ? args.names : undefined,
	});
	if (!drafts.length) {
		if (args.json) {
			console.log(
				JSON.stringify({ ok: false, count: 0, publishRoot, drafts: [] }),
			);
		} else {
			console.log("No evolved drafts found. Run: evolve --generate");
			console.log(`  evolved root under data: ${root}`);
		}
		return 1;
	}

	const plan = planPublish(drafts, publishRoot, { force: args.force });
	const willWrite = plan.filter(
		(p) => p.action === "create" || p.action === "update",
	);
	const blocked = plan.filter((p) => p.action === "blocked-exists");
	const identical = plan.filter((p) => p.action === "skip-identical");

	const doApply = args.apply && !args.dryRun;
	const result = doApply
		? applyPublish(plan, { dryRun: false })
		: applyPublish(plan, { dryRun: true });

	if (args.json) {
		console.log(
			JSON.stringify(
				{
					ok: true,
					apply: doApply,
					dryRun: !doApply,
					publishRoot,
					packageGuard: isPackageRepoSkillsRoot(publishRoot),
					counts: {
						drafts: drafts.length,
						createOrUpdate: willWrite.length,
						blocked: blocked.length,
						identical: identical.length,
						written: result.written.length,
						skipped: result.skipped.length,
					},
					plan: plan.map((p) => ({
						kind: p.kind,
						name: p.name,
						dest: p.dest,
						action: p.action,
						sourceHash: p.sourceHash,
						destHash: p.destHash,
						bytes: p.bytes,
					})),
					written: result.written,
					skipped: result.skipped,
				},
				null,
				2,
			),
		);
	} else {
		console.log("Publish evolved drafts");
		console.log(`  data root:    ${root} (${source})`);
		console.log(`  project:      ${project.name} (${project.id})`);
		console.log(`  publish root: ${publishRoot}`);
		console.log(
			`  mode:         ${doApply ? "APPLY" : "preview (pass --apply to write)"}`,
		);
		console.log("");
		for (const p of plan) {
			const mark =
				p.action === "create"
					? "+"
					: p.action === "update"
						? "~"
						: p.action === "skip-identical"
							? "="
							: "!";
			console.log(
				`  ${mark} [${p.kind}] ${p.name} -> ${p.dest} (${p.action}, ${p.bytes}B)`,
			);
		}
		if (blocked.length) {
			console.log(
				`\n  ${blocked.length} blocked (dest exists). Re-run with --force to overwrite.`,
			);
		}
		if (doApply) {
			console.log(`\n  wrote ${result.written.length}, skipped ${result.skipped.length}`);
		} else {
			console.log(
				"\n  No files written. Review paths, then: publish-draft --apply",
			);
		}
	}
	return 0;
}


function cmdDecay(args) {
	const { root, source, warnings } = resolveHomunculusDir(process.env);
	for (const w of warnings) console.error(`[hkx-instinct] ${w}`);
	const project = detectProject(args.cwd);
	ensureLayout(root, project);

	let asOf = new Date();
	if (args.asOf) {
		const d = new Date(
			/^\d{4}-\d{2}-\d{2}$/.test(args.asOf)
				? `${args.asOf}T00:00:00.000Z`
				: args.asOf,
		);
		if (Number.isNaN(d.getTime())) {
			const msg = `Invalid --as-of date: ${args.asOf}`;
			if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
			else console.error(`[hkx-instinct] ${msg}`);
			return 1;
		}
		asOf = d;
	}

	const scope =
		args.scope === "project" || args.scope === "global" ? args.scope : "all";
	const plan = planDecay(root, project, {
		asOf,
		ratePerWeek: args.rate,
		floor: args.floor,
		includePending: args.pending,
		scope,
	});
	const changing = plan.filter((p) => p.changed);
	const doApply = args.apply && !args.dryRun;
	const result = applyDecay(plan, { dryRun: !doApply, asOf });

	if (args.json) {
		console.log(
			JSON.stringify(
				{
					ok: true,
					apply: doApply,
					asOf: asOf.toISOString(),
					ratePerWeek: args.rate ?? DEFAULT_DECAY_PER_WEEK,
					floor: args.floor ?? DEFAULT_CONFIDENCE_FLOOR,
					counts: {
						total: plan.length,
						changing: changing.length,
						written: result.written.length,
						skipped: result.skipped.length,
					},
					plan: plan.map((p) => ({
						id: p.id,
						scope: p.scope,
						oldConfidence: p.oldConfidence,
						newConfidence: p.newConfidence,
						weeks: p.weeks,
						activitySource: p.activitySource,
						lastActive: p.lastActive,
						changed: p.changed,
						blockedMultiInstinctFile: p.blockedMultiInstinctFile || false,
						filePath: p.filePath,
					})),
					written: result.written,
					skipped: result.skipped,
				},
				null,
				2,
			),
		);
	} else {
		console.log("Confidence time decay");
		console.log(`  model:  -${args.rate ?? DEFAULT_DECAY_PER_WEEK}/week inactive (floor ${args.floor ?? DEFAULT_CONFIDENCE_FLOOR})`);
		console.log(`  as-of:  ${asOf.toISOString()}`);
		console.log(`  data:   ${root} (${source})`);
		console.log(`  mode:   ${doApply ? "APPLY" : "preview (pass --apply to write)"}`);
		console.log(
			`  counts: total=${plan.length} changing=${changing.length}`,
		);
		console.log("");
		const show = changing.length ? changing : plan.slice(0, 15);
		for (const p of show.slice(0, 30)) {
			const mark = p.changed ? "~" : p.blockedMultiInstinctFile ? "!" : "=";
			console.log(
				`  ${mark} ${p.id} ${p.oldConfidence} -> ${p.newConfidence} (${p.weeks}w via ${p.activitySource}) [${p.scope}]`,
			);
		}
		if (!changing.length) {
			console.log("  (nothing to decay — all active within a week or at floor)");
		}
		if (result.skipped.length) {
			console.log(`\n  skipped: ${result.skipped.length}`);
			for (const s of result.skipped.slice(0, 10)) {
				console.log(`    ! ${s.id}: ${s.reason}`);
			}
		}
		if (doApply) {
			console.log(`\n  wrote ${result.written.length} files`);
		} else if (changing.length) {
			console.log("\n  No files written. Review, then: decay --apply");
		}
	}
	return 0;
}


function main() {
	configureUtf8();
	const args = parseArgs(process.argv);
	try {
		switch (args.command) {
			case "init":
				return cmdInit(args);
			case "status":
				return cmdStatus(args);
			case "evolve":
				return cmdEvolve(args);
			case "from-om":
				return cmdFromOm(args);
			case "accept":
				return cmdAccept(args);
			case "export":
				return cmdExport(args);
			case "import":
				return cmdImport(args);
			case "promote":
				return cmdPromote(args);
			case "publish-draft":
				return cmdPublishDraft(args);
			case "decay":
				return cmdDecay(args);
			case "help":
			case "--help":
			case "-h":
				console.log(usage());
				return 0;
			default:
				console.error(`Unknown command: ${args.command}\n`);
				console.error(usage());
				return 1;
		}
	} catch (err) {
		console.error(
			`[hkx-instinct] error: ${/** @type {Error} */ (err).stack || err}`,
		);
		return 2;
	}
}

void path;

const code = main();
process.exit(typeof code === "number" ? code : 0);
