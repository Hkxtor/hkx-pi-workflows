# Instinct Evolve — Implementation Plan (Pi-native)

Status: **Full loop implemented** (store → OM → transfer → promote → evolve → publish-draft → **confidence decay**)
Scope: instincts store + cluster evolve; observational-memory adapter  
Platforms: **Linux and Windows first-class** (macOS best-effort same as Linux paths)

## Goal

Ship a Pi-native **instinct inventory + evolve-to-draft** loop inside `hkx-pi-workflows`, reusing **`pi-observational-memory` (OM V3)** as the observation source—not a Claude Code continuous-learning-v2 port.

## Non-goals

- Claude Code hooks / bash observer-loop / session-guardian
- Silent install of evolved drafts into formal package `skills/`
- Competing with OM for session compaction memory
- Default-on automatic capture or promote
- Shell-only entrypoints that break on Windows (`.sh` as the only CLI)

---

## Architecture (locked)

```
OM session ledger  ──(adapter + human accept)──►  Instinct store  ──(/hkx-evolve)──►  evolved/ drafts
 (per-session JSONL)                              (cross-session XDG/LocalAppData)     (review before formal skills)
```

| Layer | Owner | Persist where |
| --- | --- | --- |
| Session memory | `pi-observational-memory` | Session JSONL under Pi sessions dir (`om.*` custom entries) |
| Instinct store | this feature | Independent data root (see platform paths below) |
| Evolve | this feature | `evolved/{skills,commands,agents}/` drafts only |
| Formal skills | package + `/hkx-skill-create` | package / user skill dirs after human review |

### Runtime choice (cross-platform)

| Decision | Choice | Why |
| --- | --- | --- |
| Implementation language | **Node ESM (`.mjs`)** only | Matches `hkx-pi-workflows/scripts/*`; same runtime as Pi on Linux/Windows; avoids Windows App Execution Alias Python stubs that broke ECC `observe.sh` |
| No required shell | CLI via `node scripts/instinct/cli.mjs` | Commands document `node …`, not `bash …` |
| Path API | `node:path` + `node:os` + `node:fs/promises` | Never hand-concatenate `/` or `\` |
| Process spawn | `node:child_process` with `shell: false` | Git detection without shell quoting pitfalls |
| Line endings | Read tolerant of `\n` / `\r\n`; write UTF-8 **LF** | Instinct YAML portable across OS checkouts |
| Console encoding | Force UTF-8 on Windows stdio when possible | Avoid cp1252 glyph/crash issues ECC hit with progress bars |
| File locking | Optional; degrade on Windows | ECC used `fcntl` only on POSIX—do not require exclusive locks for MVP |

---

## Cross-platform compatibility requirements

These are **acceptance gates**, not nice-to-haves. Every phase must keep them green.

### C1. Data root resolution

Precedence (absolute paths only for overrides):

1. `HKX_HOMUNCULUS_DIR` if absolute  
   - Linux: `/home/u/…`  
   - Windows: `C:\…` or `\\server\share\…` (accept drive-letter and UNC)
2. Else platform default:

| OS | Default data root |
| --- | --- |
| Linux | `$XDG_DATA_HOME/hkx-homunculus` if absolute, else `~/.local/share/hkx-homunculus` |
| Windows | `%LOCALAPPDATA%\hkx-homunculus` (fallback: `path.join(os.homedir(), "AppData", "Local", "hkx-homunculus")`) |
| macOS (best-effort) | same as Linux XDG fallback |

**Rules:**

- Use `path.resolve` / `path.isAbsolute` (Node treats `C:\foo` absolute on win32).
- Reject relative overrides with a clear stderr message (mirror ECC `CLV2_HOMUNCULUS_DIR` behavior).
- Never assume `HOME` is set on Windows; use `os.homedir()`.
- Document both env vars in skill + commands (Linux XDG + Windows LocalAppData).

### C2. Path hygiene

| Rule | Detail |
| --- | --- |
| Always `path.join` / `path.resolve` | No template strings with `/instincts/` |
| Normalize for compare | `path.normalize` + optional case-fold **only when `process.platform === "win32"`** for path equality (do not case-fold instinct **ids**) |
| Display paths | Prefer `path.resolve` output as Node formats it; do not force POSIX display on Windows |
| Repo-relative in docs | Commands show `node scripts/instinct/cli.mjs` from package root; also support absolute path to installed copy under `~/.pi/agent/hkx-pi-workflows/scripts/…` |
| Temp dirs | `os.tmpdir()` only—never hardcode `/tmp` |
| Symlinks | Prefer realpath when resolving session files; Windows junctions OK if Node can open them |

### C3. Project detection (git)

Order:

1. `HKX_PROJECT_ID` (explicit)
2. `git remote get-url origin` → credential-stripped → SHA-256 hex prefix 12
3. `git rev-parse --show-toplevel` → normalize path → hash 12
4. `global`

**Cross-platform details:**

- Spawn `git` with `shell: false`, args array; on failure treat as no-git.
- **Path hash input:** normalize to a stable form before hashing:
  - resolve absolute
  - on win32: replace `\` → `/`, lower-case drive letter, optional lower-case full path for id stability across `C:\Work` vs `c:\work`
  - strip trailing slashes
- **Remote URL strip:** remove `user:pass@` from HTTPS remotes; normalize `.git` suffix.
- Same remote on Linux and Windows **must** yield the same 12-char project id (test with fixture URLs).

### C4. Text I/O

| Concern | Policy |
| --- | --- |
| Encoding | UTF-8 always (`fs.readFile/writeFile` with `"utf8"`) |
| Newlines on write | LF (`\n`) for instinct YAML and generated markdown |
| Newlines on read | Accept `\r\n` and `\n` in parse (split on `/\r?\n/`) |
| Atomic write | Write `*.tmp` then `fs.rename`; on Windows, rename-over-existing may need unlink-first—use a small `writeFileAtomic` helper tested on both |
| Concurrent writers | MVP: last-write-wins; no `fcntl` requirement |
| Invalid filename chars | Instinct file names from ids: allow `[a-z0-9][a-z0-9._-]*` only; reject `<>:"/\\ | ?*` and control chars (Windows-safe) |

### C5. CLI / command UX

| Concern | Policy |
| --- | --- |
| Entry | `node path/to/cli.mjs <subcommand>` — works in PowerShell, cmd, Git Bash, bash |
| Exit codes | `0` ok, `1` usage/business fail, `2` unexpected—document for CI |
| `--json` | stdout machine-readable JSON (UTF-8); diagnostics on stderr |
| Progress / boxes | ASCII-only UI in CLI (no Unicode block chars that break Windows cp1252) unless UTF-8 reconfigured successfully |
| Command markdown | `/hkx-evolve` runbook must show **both** Linux and Windows invocation examples |
| No bash-only scripts in critical path | Optional `.sh` helpers are non-blocking; Windows users never need them |

### C6. OM adapter (Phase 2) paths

| Concern | Policy |
| --- | --- |
| Session root | Discover via Pi conventions under `path.join(os.homedir(), ".pi", "agent", "sessions")` unless env override exists |
| Session file args | Accept absolute paths with either separator; normalize before open |
| WSL note | If user runs Pi on Windows but sessions live in WSL, document that adapter runs **in the same environment as Pi** (no silent cross-OS path magic) |
| `/om:view full` fallback | Command can instruct model to paste/export when file path unknown—path-independent |

### C7. Testing matrix

| Matrix cell | Required |
| --- | --- |
| Unit tests on Linux CI | Yes (existing `npm test`) |
| Path unit tests with injected `platform` / sample paths | Yes—simulate win32 path cases **without** requiring Windows CI for MVP |
| Optional Windows CI / manual checklist | Phase 1 exit criteria include manual checklist (below) |
| Fixture instincts | LF in git; parser tests include CRLF buffer |

**Simulated Windows cases in unit tests (run on Linux):**

- `path.win32.join` style expected roots when `process.env.LOCALAPPDATA` set and `platform` stubbed
- Absolute override `D:\\data\\hkx-homunculus`
- UNC `\\\\nas\\share\\hkx-homunculus`
- Project path hash stability for `C:\\Repos\\app` vs `c:/Repos/app`
- Atomic write rename-replace behavior under a temp dir (OS-real)

**Manual Windows checklist (Phase 1):**

- [ ] `node scripts/instinct/cli.mjs init` creates dirs under `%LOCALAPPDATA%\hkx-homunculus`
- [ ] `status` / `evolve` with 3 fixture instincts
- [ ] `--generate` writes drafts
- [ ] PowerShell and cmd both work
- [ ] Git repo with `origin` yields stable project id matching Linux for same remote URL

### C8. Lessons borrowed from ECC (do not regress)

| ECC issue | Our mitigation |
| --- | --- |
| Windows Store Python stub hangs | **No Python** |
| MSYS `mktemp` absolute paths confuse tools | No shell temp paths; Node `os.tmpdir()` |
| Observer hang on Windows non-interactive | No background observer loop |
| `fcntl` missing on Windows | No hard dependency on file locks |
| cp1252 vs block glyphs | ASCII CLI + UTF-8 stdout reconfigure attempt |
| Backslash breaks `basename` in bash | Node `path.basename` / `path.parse` |

---

## Data layout

```
${resolved HKX_HOMUNCULUS_DIR}
  projects.json
  instincts/
    personal/
    inherited/
    pending/
  evolved/
    skills/  commands/  agents/
  projects/<12-hex-id>/
    meta.json
    instincts/{personal,inherited,pending}/
    evolved/{skills,commands,agents}/
```

### Instinct schema (ECC-compatible frontmatter)

Required: `id`, body with `## Action` recommended.  
Fields: `trigger`, `confidence` (0–1), `domain`, `source`, `scope` (`project`|`global`), `project_id`, `project_name`, `created`, `updated`, `om_support_ids` (optional).

Body must not use bare `---` (frontmatter delimiter).

### Evolve thresholds (Phase 1 = ECC parity)

| Rule | Value |
| --- | --- |
| Min instincts to analyze | ≥ 3 |
| Skill cluster | normalized trigger group size ≥ 2 |
| Command | `domain == workflow` and confidence ≥ 0.7 |
| Agent | cluster size ≥ 3 and avg confidence ≥ 0.75 |
| High-confidence display | ≥ 0.8 |
| Promote (Phase 3) | same id in ≥ 2 projects, avg ≥ 0.8 |
| Generate caps | 5 skills / 5 commands / 3 agents |

---

## Package layout

```
hkx-pi-workflows/
  commands/
    hkx-evolve.md
    hkx-instinct-status.md          # Phase 1
    hkx-instinct-accept.md          # Phase 2
    hkx-instinct-import.md          # Phase 3
    hkx-instinct-export.md          # Phase 3
    hkx-instinct-promote.md         # Phase 3
  skills/instinct-evolve/
    SKILL.md
    references/
      schema.md
      thresholds.md
      om-adapter.md
      platforms.md                  # Linux/Windows paths & invocation
  scripts/instinct/
    cli.mjs
    lib/
      paths.mjs                     # data root + project detect (platform-aware)
      parse.mjs
      store.mjs
      cluster.mjs
      generate.mjs
      atomic-write.mjs
      om-session.mjs                # Phase 2
      om-map.mjs                    # Phase 2
      promote.mjs                   # Phase 3
    fixtures/
  scripts/tests/instinct-*.mjs
  docs/
    instinct-evolve-plan.md         # this file
    conversion-map.md               # update intentionally-not → optional surface
```

Optional `package.json` script:

```json
"instinct": "node scripts/instinct/cli.mjs"
```

---

## Phased delivery

### Phase 0 — Contract & scaffolding (0.5–1 day)

- [ ] Update `docs/conversion-map.md` (optional knowledge surface + OS note)
- [ ] Add `skills/instinct-evolve/` + `references/{schema,thresholds,platforms}.md`
- [ ] Stub `paths.mjs`: `resolveHomunculusDir()`, `detectProject()`, `ensureLayout()`
- [ ] Fixture instincts (LF) + one CRLF parse fixture
- [ ] Platform matrix section in skill docs

**Exit:** empty `status` works; prints resolved root on Linux; unit test asserts Windows default when `LOCALAPPDATA` + platform stubbed.

### Phase 1 — Store + evolve MVP (1.5–2.5 days) — **main delivery**

| ID | Work |
| --- | --- |
| P1-1 | `parse.mjs` — ECC-compatible; CRLF-safe |
| P1-2 | `store.mjs` — project wins on id conflict |
| P1-3 | `cluster.mjs` — evolve rules |
| P1-4 | `generate.mjs` + `atomic-write.mjs` |
| P1-5 | `cli.mjs` — `init` / `status` / `evolve [--generate] [--json]` |
| P1-6 | `commands/hkx-evolve.md` — **Linux + Windows** runbooks |
| P1-7 | `commands/hkx-instinct-status.md` |
| P1-8 | Unit + integration tests including path simulation |
| P1-9 | Manual Windows checklist (or documented deferral with owner) |

**CLI:**

```bash
# Linux / macOS / Git Bash
node scripts/instinct/cli.mjs init
node scripts/instinct/cli.mjs status
node scripts/instinct/cli.mjs evolve
node scripts/instinct/cli.mjs evolve --generate

# Windows PowerShell (from package root)
node .\scripts\instinct\cli.mjs init
node .\scripts\instinct\cli.mjs evolve --generate

# Override data root (both OS)
# Linux:  HKX_HOMUNCULUS_DIR=/tmp/hkx-h node scripts/instinct/cli.mjs status
# Windows: $env:HKX_HOMUNCULUS_DIR="D:\data\hkx-h"; node scripts/instinct/cli.mjs status
```

**Exit:**

- [ ] ≥3 fixtures → evolve prints skill/command/agent sections
- [ ] `<3` → non-zero exit + clear message
- [ ] `--generate` only under data root `evolved/`, never package `skills/`
- [ ] Path/unit tests cover C1–C4 simulated Windows cases
- [ ] Commands document both OS invocations

### Phase 2 — OM adapter (1.5–2.5 days)

| ID | Work |
| --- | --- |
| P2-1 | `om-session.mjs` — fold session JSONL → reflections/observations |
| P2-2 | Session discovery under `~/.pi/agent/sessions` (homedir-based) |
| P2-3 | `om-map.mjs` — reflection → **pending** instinct (conservative heuristics) |
| P2-4 | `from-om [--session] [--dry-run] [--min-relevance]` |
| P2-5 | `accept` pending → personal |
| P2-6 | Prefer command-only (no new extension) for MVP |
| P2-7 | Docs: WSL vs native Windows session location |
| P2-8 | Synthetic session fixtures (path-agnostic content) |

**Exit:** dry-run no writes; accept feeds evolve; default never auto-personal.

### Phase 3 — Loop ops (2–3 days, scheduled)

- import/export bundles (UTF-8 LF)
- promote cross-project
- optional ECC homunculus import
- skill-health cross-links
- ~~optional `publish-draft` with explicit confirm~~ **done**: `publish-draft` CLI (preview default, `--apply` writes to `~/.pi/agent`)

---

## Security & product defaults

- Pending by default for OM-sourced instincts
- No auto-promote; no auto formal skill install
- No secrets or full source dumps in Evidence
- Windows + Linux same confidence thresholds

---

## Risks (platform-focused)

| Risk | Level | Mitigation |
| --- | --- | --- |
| Windows default path wrong if only XDG copied | High | Explicit LocalAppData branch (C1) |
| Project id drift across OS for path-only repos | Medium | Prefer remote URL; normalize path hash on win32 |
| Atomic replace failures on Windows | Medium | `atomic-write` helper + tests |
| Session path unknown on Windows installs | Medium | `--session` flag; `/om:view` paste fallback |
| CI is Linux-only | Medium | Simulated win32 path tests + manual checklist |
| Docs show only bash | High | Dual examples in every command |

---

## Definition of Done

**Phase 1 MVP**

1. Instincts can be stored and evolved on Linux with default XDG path  
2. Same CLI works on Windows Node with LocalAppData default (manual or CI)  
3. Cross-platform path rules C1–C5 implemented and unit-tested where possible  
4. `/hkx-evolve` runbook dual-OS  
5. `npm test` + `npm run validate` pass  

**Phase 2**

1. OM session → pending → accept → evolve on both OS (same-env as Pi)  
2. Platform notes for sessions + WSL documented  

---

## Implementation backlog (start order)

1. T0 — skill docs + `platforms.md`  
2. T1 — `paths.mjs` + `init` + platform unit tests  
3. T2 — `parse.mjs` (CRLF + LF)  
4. T3 — `store.mjs`  
5. T4 — `cluster.mjs`  
6. T5 — `atomic-write` + `generate` + `evolve` CLI  
7. T6 — dual-OS commands  
8. T7 — wire `scripts/tests`  
9. T8 — conversion-map + README one-liners  
10. T9 — Phase 2 OM adapter  

---

## Open decisions (defaults)

| Item | Default |
| --- | --- |
| Data root Linux | `~/.local/share/hkx-homunculus` |
| Data root Windows | `%LOCALAPPDATA%\hkx-homunculus` |
| Phase 1 ECC import | No |
| Phase 2 extension | No (CLI + command) |
| Generate default | Off (`--generate`) |
| OM map LLM | No (rules only) |
| Windows CI | Optional; simulated tests required |

---

## Related

- ECC reference (algorithm only): `ECC/skills/continuous-learning-v2/scripts/instinct-cli.py` (`cmd_evolve`)
- OM V3 types: `pi-observational-memory` session ledger (`om.reflections.recorded`, etc.)
- Package install path patterns: `scripts/install.mjs` (`os.homedir()`, `path.join`)
