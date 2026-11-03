---
name: knowledge-ops
description: "Route information to the right storage layer in a pi workspace, then keep it deduplicated, indexed, and redacted. Use when saving a decision, constraint, or reference; ingesting documents or sessions; asking where something should live; or when the same fact has started appearing in several places. Not the mechanics of any one layer (unified-memory, living-docs-governance, ctx_* tools) and not secrets storage."
origin: ECC-converted-for-Pi
---

# Knowledge Operations

A pi workspace has **six places a fact can live**, and choosing wrong is how the same
decision ends up in three of them, each slightly different. This skill owns the routing
decision and the hygiene around it; each layer keeps its own how-to.

## When to Activate

- Saving a decision, constraint, reference, or piece of research.
- Ingesting a document, a session, or a large tool output.
- "Where should this go?", "save this", "what do I know about X".
- The same fact is now in two places and you need to pick the canonical one.

## When Not To

- Writing to the memory vault specifically → `unified-memory` (schema, CLI, scopes).
- Deciding a document's governance role → `living-docs-governance`.
- Capturing a reusable behavior rule → `instinct-evolve`.
- Storing credentials or tokens → never in a knowledge layer; use a secret store.

## The Six Layers

| Layer | Holds | Does not hold | Write via |
|---|---|---|---|
| **1. Execution truth** | GitHub issues/PRs/discussions, code, tests, CI state | Narrative, plans that are not tracked work | the tracker / the repo |
| **2. Conventions** | `AGENTS.md`, `rules/`, `CONTEXT.md`, codemap | History, status, long explanation | edit the file |
| **3. Memory vault** | Cross-session decisions, constraints, project facts | Large corpora, versioned docs, secrets | `unified-memory` (`memory save --apply`) |
| **4. Indexed corpus** | Docs, fetched pages, large tool output you need to search by topic | Anything a human must edit or review | `ctx_index` / `ctx_fetch_and_index` / `ctx_batch_execute` |
| **5. Project docs** | `docs/`, ADRs, `TESTS.md`, codemaps, runbooks | Live status, duplicated policy | edit the file, review in the diff |
| **6. Instinct store** | Triggerable behaviors that change future agent action | Facts, decisions, notes | `instinct-evolve` |

Two ephemeral layers sit above these and are not knowledge stores: `ctx_note` for pending
intentions (they go stale and are meant to be dismissed) and the todo list for active work.

**pi has no knowledge-graph layer.** `ctx_search` is FTS5 text ranking, not entities and
relations. If a task genuinely needs relationship queries, that is an MCP server decision,
not something to pretend the local tools do.

## The Rule That Prevents Parallel Copies

**One canonical home per fact set.** Everything else links to it.

If a fact needs to appear twice — a decision recorded in the vault and mentioned in an ADR —
the vault holds the record and the ADR links to it. Two full statements of the same decision
will drift, and the drift is invisible until someone acts on the stale one.

Ask of any duplicate: *which copy would I delete if I had to?* That one is not the home.

## Ingestion Workflow

### 1. Classify — which layer

| The information is… | Layer | Why |
|---|---|---|
| A decision or constraint future sessions must recall | 3. Vault | Durable, project-scoped, cheap to recall |
| Something that changes active tracked work | 1. Execution truth | The tracker is the truth for in-flight work |
| A rule every session must obey | 2. Conventions | Loaded automatically; survives session loss |
| A doc a human will read and review | 5. Project docs | Versioned, reviewed, diffable |
| A large corpus to search by topic | 4. Indexed corpus | Built for retrieval, not for editing |
| A pattern that should change future behavior | 6. Instinct store | Triggers, not recall |
| A reminder for this session only | `ctx_note` / todo | Ephemeral by design |

When a fact belongs to two layers, pick the one that answers "who edits this?" — and link
from the other.

### 2. Deduplicate before writing

- `ctx_search` for prior capture of the same topic.
- `unified-memory` recall for prior decisions.
- `grep`/`ffgrep` the repo for an existing rule or doc stating the same thing.
- Check the tracker before writing a local note about in-flight work.

**Update the existing entry rather than adding a second one.** A near-duplicate is worse than
a stale entry, because both look authoritative.

### 3. Store at the layer's own entry point

Use the layer's mechanism, not a generic file write: the vault CLI for the vault, the tracker
for tracked work, `ctx_index` for corpora. Writing markdown into a vault directory by hand
skips schema validation and produces a file `recall` cannot find.

### 4. Index and cross-reference

- Add the entry to whatever index or summary the layer maintains.
- Add cross-references in both directions where the fact spans layers.
- For the vault, run `memory validate` after writing.

## Promotion and Demotion

Facts move. These are the real transitions, and doing them explicitly is what keeps the
layers from rotting:

| From → To | When |
|---|---|
| Session note → vault | The intention became a decision worth recalling |
| Vault → project docs | Others need to review it, or it must be versioned |
| Vault → conventions | It stopped being a fact and became a rule |
| Project docs → conventions | The rule is short enough to load every session |
| Conventions → project docs | It grew detail that does not belong in every prompt |
| Any → instinct store | It describes an action to take, not a thing to know |

Demotion matters too: a rule that no longer applies should be deleted from conventions, not
left as noise every session pays for.

## Sync Operations

**Session → vault.** At the end of substantial work, save the decisions and constraints that
a future session would otherwise rediscover. Use `hkx-session-summary` for the narrative;
save only the durable facts.

**Repo → indexed corpus.** For a body of external docs or a large reference dump, index it
once (`ctx_index`) and query by topic later instead of re-reading it.

**Docs ↔ vault.** When a vault fact is promoted into a reviewed doc, the doc becomes the
home and the vault entry is replaced by a pointer — or deleted.

**Tracker → local.** Never mirror tracker state into a local note and then edit the note.
Link to the issue.

## Best Practices

- Keep entries short. Archive rather than letting one file grow unbounded.
- Frontmatter on every knowledge file; the vault enforces `hkx.memory.v1`.
- Search before writing. Every time — this is the step that gets skipped.
- Redact before the value enters any Git-tracked file, log, or model context.
- lowercase-kebab-case for knowledge file names; tags for retrieval.
- Prefer linking over copying when the same fact must appear twice.

## Quality Gate

Before calling a knowledge operation done:

- no duplicate entry was created (a search proves it)
- sensitive values are absent from anything Git-tracked or indexed
- the layer choice survives the question "who edits this?"
- indexes, summaries, and cross-references are updated
- the canonical home is named, and any second copy links to it

## Related

- `unified-memory` — the vault layer's schema, CLI, scopes, and validation
- `living-docs-governance` — assigning docs their constitution/map/status/history roles
- `instinct-evolve` — the triggerable-behavior layer
- `architecture-decision-records` — the durable-record form a decision takes in layer 5
- `test-collaboration` — the `TESTS.md` registry as a governed doc, not a memory
- `context-budget` — how much of this each session actually pays to load
- `hkx-session-summary` — narrative session output; this skill saves only durable facts

## Origin

Ported from ECC's `knowledge-ops`. The layer-routing idea, ingestion workflow, dedup-first
discipline, and quality gate come across. The layer table was **rewritten for pi**: ECC's
`~/.claude/projects/*/memory/`, MCP memory graph, and Supabase layers do not exist here, and
the real local layers are the vault, `ctx_*` indexed corpus, project docs, conventions, and
the instinct store. Added: the promotion/demotion table and the "which copy would I delete"
test, both of which the original left implicit.
