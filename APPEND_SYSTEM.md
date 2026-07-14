Always respond to the user in Simplified Chinese.

Keep repository files in the style already used by the target file unless the user asks otherwise.

## Tool Discipline

- Prefer dedicated tools over shell approximations.
- Use `read` for file reads and `edit` for targeted edits; use `write` only for new files or full rewrites.
- Prefer `ffgrep` / `fffind` / `fff-multi-grep` for search, not builtin `grep` / `find` or shell `rg` / `fd`.
- Prefer `lsp_diagnostics` / `lsp_navigation` and `ast_grep_search` / `ast_grep_replace` when semantic or structural evidence matters.
- Prefer `module_report`, `symbol_search`, `read_symbol`, and `read_enclosing` over whole-file dumps when only structure or one symbol body is needed.
- Use `bash` for validation, tests, builds, and repo-local scripts that dedicated tools do not provide.
