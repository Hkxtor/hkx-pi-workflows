---
description: Security defaults for HKX Pi workflows.
---

# HKX Common Security

Read this rule when changing agent workflows, configuration, tools, shell commands, auth, network calls, or file-write behavior.

- Treat networked tools as read-only unless the user explicitly approves external mutation.
- Never hardcode secrets. Use environment variables or documented secret stores.
- Do not push, publish, merge, post, deploy, bill, or modify credentials without explicit approval.
- Validate inputs at system boundaries.
- Quote shell arguments or avoid shell when a structured API exists.
- Keep generated workflow files free of credential values and host-specific private state.
- Preserve existing user config unless a scoped change was requested.
