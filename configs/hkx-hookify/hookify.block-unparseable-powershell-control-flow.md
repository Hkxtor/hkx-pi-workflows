---
name: block-unparseable-powershell-control-flow
enabled: true
event: bash
action: block
pattern: "(?:(?:^|[\\r\\n;&|{}]\\s*)(?:(?:if|foreach|while|for|switch)\\s*\\([^\\r\\n]*\\)\\s*\\{|do\\s*\\{|function\\s+[\\w-]+\\s*\\{|(?:[Ff]or[Ee]ach-[Oo]bject|[Ww]here-[Oo]bject|%|\\?)\\s*(?:-[\\w:]+\\s+)*\\{))|(?:\\$\\w+(?:\\.\\w+)+\\s*\\((?!\\.\\.\\.))|(?:\\[[A-Za-z][\\w.]*\\]::[A-Za-z_])|(?:\\$\\w+\\s+-join\\b|\\)\\s*-join\\b)"
---
This command contains PowerShell syntax that tree-sitter-bash cannot parse
(control-flow blocks, script-block cmdlets like `ForEach-Object { ... }` /
`Where-Object { ... }` / `% { ... }` / `? { ... }`, `$var.Method(...)`
calls, `[Type]::` member access, or the `-join` operator). A partial parse
failure makes pi-permission-system fail closed: the whole command is floored
to an operator prompt tagged `<unparsed-bash-subtree>`, even when every unit
would otherwise be allowed. A config `allow` rule cannot suppress this floor —
rewriting the command is the only fix.

Rewrite it instead of re-running it:

- For file inspection prefer the non-shell tools (`read`, `grep`, `ffgrep`,
  `find`, `ls`) — they never touch the shell gate.
- Replace the condition with a shell operator: `cmd || echo "none"` (or `&&`).
- Or split it into separate tool calls and branch on the result yourself.
- Script blocks always need a rewrite. Use the simplified, block-free syntax:
  `Where-Object Name -eq 'foo'`, `ForEach-Object -MemberName Trim`,
  `Select-Object -First 8`, `Sort-Object Length`, or `-ExpandProperty`.
- Keep pipelines free of `(`, `[Type]::`, `-join`, and method calls; push the
  computation into tool arguments instead of inline expressions.
- When working inside an `hkx-pi-workflows` checkout, check a command with:
  `node scripts/shell-command-preflight.mjs --command "<command>"`
  (exit 0 clean, 2 unresolved, 1 dependency/usage error). Other projects do
  not have this repository-relative helper.

The rule matches raw command text, so a message or `echo` that quotes one of
these shapes is blocked too. Pass such text through a file instead of an
inline argument (`git commit -F <file>`, `git commit --amend -F <file>`).

Valid bash control flow is unaffected: `if [ ... ]; then ... fi`,
`if (( ... )); then`, `for ... do ... done`, `while ... do ... done`,
`case ... esac`, and `name() { ... }`.
