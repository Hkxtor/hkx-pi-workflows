---
description: TypeScript and JavaScript coding, testing, and security guidance.
globs:
  - "**/*.{ts,tsx,js,jsx,mts,cts}"
---

# HKX TypeScript Guidance

Use this rule when editing TypeScript or JavaScript.

## Style

- Prefer precise types over broad object shapes.
- Avoid `any`; use unknown plus narrowing when the value is untrusted.
- Keep imports static and top-level unless runtime loading is genuinely required.
- Prefer existing project helpers for logging, filesystem, process execution, and path handling.
- Keep React hooks pure and dependency arrays accurate.

## Testing

- Test observable behavior, parser boundaries, state transitions, and error mapping.
- Do not mutate globals across tests. Restore spies and environment changes in cleanup.
- Avoid placeholder assertions such as "does not throw" without checking the contract.

## Security

- Validate untrusted JSON, URL, form, CLI, and file inputs.
- Do not interpolate untrusted strings into shell commands.
- Do not log credentials, cookies, tokens, or raw authorization headers.
- For browser or markdown output, account for XSS and unsafe links.

## Validation

Use the repository's package manager and scripts. In the pi codebase itself, prefer `bun check` over direct TypeScript compiler calls.
