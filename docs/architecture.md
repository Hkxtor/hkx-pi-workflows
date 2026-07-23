# HKX Pi Workflows Architecture

This document explains how the package is structured today and where each kind of workflow logic belongs.

Use it when deciding:

- where a new capability should live
- whether something should be a command, skill, rule, agent, chain, or extension
- how the global context files relate to repository-local guidance

## One-line model

`hkx-pi-workflows` is a layered pi workflow pack:

- **commands** expose operator-facing entry points
- **skills** provide reusable guidance
- **rules** provide lightweight reminders
- **agents** provide executable specialists
- **chains** orchestrate multiple agents into repeatable flows
- **extensions** enforce or surface runtime behavior
- **global context files** shape the default agent behavior outside this repo

## Surface Map

| Surface | Primary job | Typical consumer | Should it mutate files? |
| --- | --- | --- | --- |
| `commands/` | give operators a named workflow entry point | human user | indirectly, via the workflow it describes |
| `skills/` | provide reusable guidance and decision frameworks | model / agent | no |
| `rules/` | provide short reminders and guardrails | model / agent | no |
| `agents/` | execute a narrow specialist role | pi-subagents | some yes, some no |
| `chains/` | orchestrate multiple agents in a stable sequence | pi-subagents runner | depends on included agents |
| `extensions/` | runtime hooks, notifications, or gatekeeping | pi runtime | should stay narrow and explicit |
| `GLOBAL_AGENTS.md` | generic global dev handbook | global pi sessions | no |
| `APPEND_SYSTEM.md` | short system-level tool discipline | global pi sessions | no |
| root `AGENTS.md` | repository maintenance rules for this package | work inside this repo | no |

## Layer Responsibilities

### 1. Commands: operator entry points

Commands are the top-level entry points a user chooses intentionally.

Use a command when you want:

- a named workflow a human can invoke directly
- a stable runbook for a repeated task
- a compact operator-facing description of what to do next

Examples:

- `hkx-review-pr`
- `hkx-build-fix`
- `hkx-update-docs`
- `hkx-quality-gate`

A command should **not** become a giant knowledge base. If the content is reusable beyond one command, move the detailed reasoning into a skill and keep the command as the entry wrapper.

### 2. Skills: reusable guidance

Skills are the broadest reusable knowledge layer.

Use a skill when you need:

- a reusable workflow pattern
- language- or domain-guidance that many tasks may reference
- decision support without forcing a specific executable role

Examples:

- `tdd-workflow`
- `typescript-workflow`
- `search-first`
- `verification-loop`

A skill should explain **how to think and work**, not define a specific runtime persona.

### 3. Rules: short reminders

Rules are the smallest and lightest layer.

Use a rule when you need:

- a short reminder
- a narrow safety or style constraint
- lightweight reinforcement that should stay low-noise

Examples:

- `hkx-ts-no-console-log`
- `hkx-rust-no-unwrap`
- `hkx-common-security`

If a file grows into a long tutorial or multi-step framework, it probably belongs in `skills/`, not `rules/`.

### 4. Agents: executable specialists

Agents are the role-based execution layer.

Use an agent when you need:

- a stable specialist persona
- a narrow tool budget and responsibility boundary
- a repeatable subagent target for orchestration

Current agent families:

- **planning / architecture** — `planner`, `architect`, `code-architect`, `code-explorer`
- **review / analysis** — `code-reviewer`, `security-reviewer`, `pr-test-analyzer`, `silent-failure-hunter`, `agent-evaluator`, `docs-lookup`
- **implementation / repair** — `tdd-guide`, `build-error-resolver`, `go-build-resolver`, `rust-build-resolver`, `refactor-cleaner`, `doc-updater`, `database-reviewer`, `e2e-runner`, `harness-optimizer`, `loop-operator`
- **language reviewers** — `typescript-reviewer`, `python-reviewer`, `go-reviewer`, `rust-reviewer`

### 5. Chains: orchestration

Chains are the stable multi-agent workflow layer.

Use a chain when you need:

- repeated orchestration across several agents
- a known review / plan / implement / verify sequence
- a reusable automation path that is broader than one specialist role

Current chain families:

- **review** — `hkx-pr-review`, `hkx-adversarial-review`, `hkx-security-scan`, language review chains
- **build fix** — generic and language-specific build-fix chains
- **delivery / implementation** — `hkx-feature-flow`, `hkx-fix-defect`, `hkx-refactor-flow`, `hkx-docs-update`

A chain should own the **sequence**, not the deep specialist knowledge. The specialist knowledge belongs in the agents and skills it composes.

### 6. Extensions: runtime behavior

Extensions are the runtime hook layer.

Use an extension when the behavior must happen at runtime, for example:

- gating risky edits or commands
- surfacing low-noise quality notifications
- integrating with runtime events

Current extensions:

- `hkx-gateguard.ts` — fact-forcing gate; pre-authorizes `.pi-subagents/` chain artifact writes
- `hkx-language-quality.ts` — post-mutation validation notifications
- `hkx-subagent-supervisor-auto-reply.ts` — auto-replies to artifact-write intercom asks so review chains do not detach

Extensions should stay explicit, local, and low-noise. They should not silently replace ordinary workflow logic that belongs in commands, skills, or agents.

### External extension config overlays

Some third-party extensions are installed outside this package, but their operator config is versioned here.

Current overlays:

- `pi-permission-system`
  - source: `configs/pi-permission-system/config.json`
  - install target: `~/.pi/agent/extensions/pi-permission-system/config.json`
  - install order: after `pi update --extensions`
  - install behavior: create the extension dir when missing, then write/link the managed config (cold install often has no config yet)
- `rpiv-advisor`
  - source: `configs/rpiv-advisor/advisor.json`
  - install target: `~/.config/rpiv-advisor/advisor.json` (or `$XDG_CONFIG_HOME/rpiv-advisor/advisor.json`)
  - install behavior: **seed if missing only** — never overwrite operator `/advisor` selections; template omits machine-local `modelKey`

This package manages the **config**, not the third-party extension packages themselves.

### Global agent settings

Portable global pi settings are versioned here and deep-merged on install:

- source: `configs/agent-settings.json`
- install target: deep-merge into `~/.pi/agent/settings.json`
- managed keys: `packages` (authoritative list), plus portable defaults such as `compaction` and `observational-memory`
- not managed here: machine-local keys (`shellPath`, `defaultProvider`, `defaultModel`, `defaultThinkingLevel`, `lastChangelogVersion`, …)
- after merge: `pi update --extensions` installs/updates packages declared in settings

## Context Layering

There are three different context layers on purpose.

### Global development layer

- source file: `GLOBAL_AGENTS.md`
- installed target: `~/.pi/agent/AGENTS.md`

This is the generic development handbook for pi sessions in general.

### Global system append layer

- source file: `APPEND_SYSTEM.md`
- installed target: `~/.pi/agent/APPEND_SYSTEM.md`

This should stay short and system-level: tool preference, tool discipline, and similar high-priority behavior.

### Repository maintenance layer

- source file: root `AGENTS.md`

This is **only** for maintaining this package itself.

## Discovery and Install Model

### In-repo layout

The repository is the source of truth for all package surfaces:

- `agents/`
- `chains/`
- `commands/` (slash prompt templates; mapped as `pi.prompts`)
- `skills/`
- `rules/`
- `extensions/`
- `configs/` (external extension config overlays + `agent-settings.json`)
- `GLOBAL_AGENTS.md`
- `APPEND_SYSTEM.md`
- `.mcp.json` and `mcp-configs/`
- `package.json` dual-path manifest (`pi` + `pi-subagents`)

### Dual install paths

This package supports two complementary install modes:

| Path | Entry | What it does |
| --- | --- | --- |
| **A — Official Pi Package** | `pi install git:git@github.com:Hkxtor/hkx-pi-workflows` (or HTTPS / local path) | Registers the package in settings and loads **native package resources** only |
| **B — Full operator install** | `npm run install-global` from a checkout | Syncs every surface into `~/.pi/agent/`, including overlays pi package install cannot express |

#### Path A — package-native resources

Declared in `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/..."],
    "skills": ["./skills"],
    "prompts": ["./commands"]
  },
  "pi-subagents": {
    "agents": ["./agents"],
    "chains": ["./chains"]
  }
}
```

- Pi loads `extensions` / `skills` / `prompts` from the `pi` block.
- `pi-subagents` discovers package agents/chains from installed package roots via `pi-subagents` or `pi.subagents` (this package uses the top-level `pi-subagents` key).
- Agents/chains require **pi-subagents** to already be installed.
- Path A does **not** install rules, GLOBAL_AGENTS, APPEND_SYSTEM, MCP merges, agent-settings overlays, or permission config overlays.

#### Path B — global operator layout

`npm run install-global` installs or syncs surfaces into `~/.pi/agent/`.

Important mappings:

- `agents/*.md` → `~/.pi/agent/agents/hkx/*.md`
- `chains/*.chain.json` → `~/.pi/agent/chains/`
- `commands/*.md` → `~/.pi/agent/commands/` **and** `~/.pi/agent/prompts/`
- `configs/agent-settings.json` → deep-merge into `~/.pi/agent/settings.json`
- then: `pi update --extensions` for packages listed in settings
- then: `configs/pi-permission-system/config.json` → `~/.pi/agent/extensions/pi-permission-system/config.json` (creates dir if missing)
- then: `configs/rpiv-advisor/advisor.json` → seed `~/.config/rpiv-advisor/advisor.json` if missing (never overwrite)
- `GLOBAL_AGENTS.md` → `~/.pi/agent/AGENTS.md`
- `APPEND_SYSTEM.md` → `~/.pi/agent/APPEND_SYSTEM.md`

### Scripts model

Package scripts fall into two buckets:

1. **Day-to-day npm scripts**
   - `npm run install-global` — Path B: sync package surfaces + merge agent settings + update pi packages
   - `npm run validate` — enforce package surface contracts **and** dual-path manifest shape
   - `npm test` — versioned smoke under `scripts/tests/` (MCP merge + env-resolver guards)
   - `npm run mcp:apply-profile` — merge MCP templates into a pi MCP config

2. **Maintenance-only helpers**
   - direct `node scripts/...` tools used by maintainers
   - currently: `scripts/convert-agents-to-pi.mjs` for bulk-importing older agent definitions
   - not part of install/runtime and intentionally not exposed as npm scripts

Prefer authoring new package surfaces in the current pi-native shape. Use conversion helpers only when importing older definitions. Keep Path A and Path B documentation in sync whenever install behavior changes.

## Tooling Architecture

This package assumes a pi tool stack centered on:

- **pi-fff** for search: `fffind`, `ffgrep`, `fff-multi-grep`
- **pi-lens** for code intelligence: `lsp_diagnostics`, `lsp_navigation`, `ast_grep_search`, `ast_grep_replace`, `module_report`, `symbol_search`, `read_symbol`, `read_enclosing`
- core file / shell tools: `read`, `edit`, `write`, `ls`, `bash`

That means the intended workflow is:

1. discover with pi-fff
2. inspect semantically with pi-lens
3. mutate narrowly with edit/write
4. validate with bash and repo-local scripts

## Where New Work Should Go

Use this decision guide.

### Add a command when

- the user needs a named operator entry point
- the workflow is something a human will invoke intentionally
- the guidance can stay compact

### Add a skill when

- the guidance should be reusable across many commands or agents
- it explains a method rather than a role
- it does not need to be an executable persona

### Add a rule when

- the content is short, narrow, and reminder-like
- it should stay low-noise

### Add an agent when

- a specialist role should be callable directly
- the role needs a clear tool boundary
- the same responsibility will be orchestrated repeatedly

### Add a chain when

- the stable value is the sequence of multiple agents
- the flow has a recurring plan / implement / review structure

### Add an extension when

- the behavior must happen at runtime through hooks or events
- it cannot be expressed as ordinary operator guidance

## Mutation Model

The package follows a simple mutation discipline:

- reviewers should stay read-only
- implementation agents should mutate narrowly
- chains should keep a single writer for the active mutation step
- extensions should not silently do broad project mutation

## Design Principles

The package aims to be:

- **pi-native** — prefer pi concepts, tool names, and install surfaces
- **compact** — keep the core package small and readable
- **composable** — commands, skills, agents, and chains should reinforce each other instead of duplicating each other
- **explicit** — runtime gates and install behavior should be easy to explain
- **maintainable** — repo-level rules and global guidance should stay clearly separated

## Related Docs

- `README.md` — package homepage and installation guide (English)
- `README.zh-CN.md` — package homepage and installation guide (Chinese)
- `docs/README.md` — documentation index and routing guide
- `docs/conversion-map.md` — current package surface map
- `docs/skill-routing.md` — primary skill choice when families overlap
- `docs/language-hooks.md` — narrower rule vs extension guidance for language/runtime behavior
- `AGENTS.md` — repository maintenance rules
- `GLOBAL_AGENTS.md` — source of the global development handbook
- `APPEND_SYSTEM.md` — source of the global system-level tool discipline
