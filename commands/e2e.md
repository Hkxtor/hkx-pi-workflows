---
name: e2e
description: "Generate and run end-to-end tests with Playwright via the hkx.e2e-runner agent (thin pi-native entrance; applies the e2e-testing skill)."
argument-hint: "<user flow or feature to test>"
---

# /e2e — End-to-End Test Runner

> ECC `/e2e`(已迁入 `legacy-command-shims`)的 **pi-native 薄入口**。
> 不复制 `e2e-testing` skill 全文;只做一次性路由到 `hkx.e2e-runner`,agent 内部应用 skill。

## GateGuard (create)

1. Loaded via `package.json` `pi.prompts` → `./commands`;Path B install links `commands/` + `prompts/`.
2. Surfaces: slash router only;delegates to `hkx.e2e-runner` (pi-subagents `package: hkx`) — no new runtime code.
3. Args: free-text user flow / feature;empty → ask before dispatching.
4. Auth: user "移植 ECC `/e2e` 薄命令 + `hkx.e2e-runner` 路由"。
5. Verify: `npm run validate`;prompt-only,无 unit test。

**Input**: `$ARGUMENTS`

---

## Dispatch

1. Announce `[E2E]` and the target flow (one line).
2. Route to agent **`hkx.e2e-runner`** with task = the requested flow.
3. The agent applies the **`e2e-testing`** skill:
   - Generate or update Playwright coverage for the requested user flow.
   - Run **only** the relevant tests unless the user explicitly asks for the entire suite.
   - Capture artifacts and report failures, flake risk, and next fixes — without duplicating the full skill body.
4. If pi-subagents is unavailable, fall back to applying `e2e-testing` in this session read-only and say so.

## Complete

Return:

- Requested flow + coverage added/updated
- Tests run (subset vs full) + pass/fail/flake summary
- Artifacts (reports, traces, screenshots as configured)
- Next fix suggestions

## Related

- `e2e-testing` skill — full authoring/triage guidance (the body this command routes to)
- `/test-coverage` — coverage analysis
- Skills: `browser-qa` (post-deploy smoke/visual), `typescript-workflow` (TS test tooling)