---
name: hkx-security-review
description: Threat-model security review of Pi auth, secrets in code, tool permissions, extensions/MCP trust boundaries, browser/eval/bash/ssh tools, internal URLs, provider APIs, and release/install paths. Use when reviewing code or architecture for security risk. Not a config inventory scan (use security-scan).
origin: HKX-converted-for-Pi
---

# HKX Security Review For Pi

Use this when a change touches user input, credentials, auth, permissions,
external processes, network calls, plugin/extension loading, MCP, browser, eval,
ssh, file writes, or release/install behavior.

## Pi Trust Boundaries

- model provider APIs and auth storage
- OAuth and API key login flows
- `.pi/secrets.yml`, env vars, debug bundles, logs
- bash, eval, browser, ssh, debug, write, edit, and ast-edit tools
- ACP/editor permission bridge
- MCP stdio/http servers
- extension, plugin, marketplace, and command loading
- internal URL schemes (`skill://`, `pr://`, `issue://`, `memory://`, etc.)
- session persistence, SQLite storage, and artifacts
- install scripts, binary packaging, native `.node` files

## Checklist

### Secrets

- No hardcoded tokens, API keys, bearer tokens, or test credentials.
- Secrets are read from env, config, auth storage, or secret files.
- Debug bundles and logs redact sensitive env/config values.
- Obfuscated placeholders are not deobfuscated into model-visible context.

### Input Validation

- Validate tool, command, extension, and MCP inputs before side effects.
- Reject path traversal and absolute paths where a scheme must stay scoped.
- Normalize user paths only through existing path helpers.
- Validate JSON/YAML/TOML with structured parsers, not string slicing.

### Permissions

- Dangerous tools require permission in ACP/editor contexts.
- Permission cache keys include the real operation and target paths.
- Preview and final operation cannot diverge.
- Rejected operations do not partially mutate state.

### External Execution

- Prefer structured APIs over shelling out.
- If spawning is required, pass argv arrays or Bun Shell interpolation safely.
- Do not pipe secrets into logs, previews, or error messages.
- Long-running external processes need cancellation and cleanup.

### Extensions and MCP

- Treat installed plugins and extension modules as trusted code only after user install/enable.
- Surface load errors without crashing the session.
- Do not allow MCP resource or tool output to bypass sanitization.
- Remote MCP/auth config must not leak credentials into prompts.

### Browser and Network

- Avoid credentialed actions unless the user explicitly requested them.
- Keep scraping/search tools read-only unless the tool contract says otherwise.
- Redact cookies, auth headers, and private URLs from logs and model output.

## Findings Format

Lead with ranked findings:

```text
P1 path/to/file.ts:123 - Permission bypass on write tool
Risk: what attacker or model could do.
Evidence: exact code path.
Fix: smallest secure change.
Verification: focused test or command.
```

If no findings, state inspected boundaries and residual risk.
