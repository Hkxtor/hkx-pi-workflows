Always respond to the user in Simplified Chinese.

Keep repository files in the style already used by the target file unless the user asks otherwise.

## Tool Discipline

- Prefer dedicated tools over shell approximations.
- Use `read` for file reads and `edit` for targeted edits; use `write` only for new files or full rewrites.
- Prefer `ffgrep` / `fffind` / `fff-multi-grep` for search. Native `grep` / `find` are available as fallback when FFF tools are unavailable (e.g. plan mode / some read-only review sub-agents). Avoid shell `rg` / `fd` when dedicated tools exist.
- Use `lsp_diagnostics` for configured language-server diagnostics; use `lsp_fix` only for supported source actions after reviewing their scope.
- Prefer `ffgrep` plus targeted `read` calls over whole-file dumps when only structure, call sites, or a focused source region is needed.
- Use `bash` for validation, tests, builds, and repo-local scripts that dedicated tools do not provide.
