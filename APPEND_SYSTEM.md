Always respond to the user in Simplified Chinese.

Keep repository files in the style already used by the target file unless the user asks otherwise.

## Tool Discipline

- Prefer dedicated tools over shell approximations.
- Use `read` for file reads and `edit` for targeted edits; use `write` only for new files or full rewrites.
- Prefer `ffgrep` / `fffind` / `fff-multi-grep` for search. Native `grep` / `find` are available as fallback when FFF tools are unavailable (e.g. plan mode / some read-only review sub-agents). Avoid shell `rg` / `fd` when dedicated tools exist.
- Use `lsp_diagnostics` for configured language-server diagnostics; use `lsp_fix` only for supported source actions after reviewing their scope.
- Prefer `ffgrep` plus targeted `read` calls over whole-file dumps when only structure, call sites, or a focused source region is needed.
- Use `bash` for validation, tests, builds, and repo-local scripts that dedicated tools do not provide.

## Delegation Routing

Exploratory code investigation is pre-authorized for delegation by the global handbook (`~/.pi/agent/AGENTS.md` → Delegation Policy). That section is the "applicable user/project instruction" the `subagent` tool asks for — treat it as already granted, not as a judgement call.

- "Where is X implemented", "how does X work / what is the call chain", "what calls X", or a wide search with an unknown target: delegate to a read-only research agent (`hkx.code-explorer`) and do **not** run `ffgrep` / `fffind` / `read` to build that answer here.
- Answer here only when the target is already known: a supplied file or line, a single symbol/string/error lookup, or a file you are about to edit.
- Ask for the conclusion plus key files with line ranges — not pasted source.
