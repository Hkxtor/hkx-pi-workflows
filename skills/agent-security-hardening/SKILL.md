---
name: agent-security-hardening
description: "Harden the boundaries where an agent turns untrusted content into filesystem, network, memory, or tool actions, and audit the pi surfaces that grant those powers (tools allowlist, subagentOnlyExtensions, acceptanceRole, GateGuard, Hookify, MCP). Use when building or reviewing an agent runtime, autonomous worker, tool gateway, memory service, or multi-tenant agent deployment, or when a workflow package adds agents and extensions. Not for ordinary application auth, SQLi, XSS, or CSRF (security-review), repo-wide vulnerability scanning (security-scan), or offensive testing."
origin: ECC-converted-for-Pi
---

# Agent Security Hardening

Harden the boundaries where an agent turns untrusted data into filesystem, network,
memory, or tool actions. Produce concrete controls and tests for the framework under
review — a checklist without enforcement evidence is incomplete.

## The Rules That Govern Everything Else

- Treat model output, retrieved content, tool output, memory, and cross-agent messages as
  **untrusted input**. A model that can be talked into an action is an input channel, not
  a principal.
- Default external integrations to read-only and grant each write capability separately.
- Validate at the action boundary even when an upstream prompt or schema already validated
  the value. Prompt instructions are advisory; code immediately before the side effect is
  not.
- Fail closed before a side effect when identity, destination, ownership, or containment
  cannot be proven.
- Before a delete, publish, credential rotation, or other irreversible action, the real
  tool entry point must authorize the authenticated principal for **that exact operation
  and resource scope**, then require explicit confirmation or a valid scoped pre-approval.
  Missing or invalid evidence blocks the action.
- Use hard bounds from the governing requirement, tightened — never loosened — by
  deployment configuration. When neither defines a value, mark it a required decision and
  test that the implementation rejects an unbounded configuration. Do not invent a
  plausible number.

## When to Activate

- Building an autonomous agent, tool gateway, memory service, or agent-to-agent protocol.
- Reviewing code that maps model output into commands, paths, URLs, credentials, or API
  mutations.
- Isolating tenants, projects, sessions, or workspaces in a long-running agent process.
- Hardening temporary files, logs, tool responses, or external-content ingestion.
- Adding agents, extensions, or MCP servers to a workflow package — the power granted is
  the attack surface, and it grows silently.

## When Not To

- Ordinary application auth, authorization, SQLi, XSS, CSRF, API security →
  `security-review`.
- Repo-wide automated scanning or config inventory → `security-scan`.
- Host, container, firewall, or cloud hardening → the infrastructure's own guidance.
- Penetration testing, exploit development, unauthorized access → not this skill.

## Hardening Workflow

### 1. Map trust boundaries

List every boundary as `source → parser → validator → side effect`. Include direct user
input, model output, retrieved documents, memory, environment variables, tool results, and
messages from other agents.

For each side effect record: the identity and scope authorizing it; the exact validator
running immediately before it; maximum input and output size; audit evidence produced; and
the recovery path if it is interrupted.

Complete when every write, command, network mutation, and credential use has **one named
authorization boundary**. Two boundaries for one action means neither is authoritative.

### 2. Validate identifiers, environment values, and URLs

Allowlist identifiers that become filenames, keys, selectors, or command arguments. Bound
the length from above with a hard maximum the configuration may tighten but not raise:

```python
import re

SAFE_AGENT_ID_CHARS = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_-]*$")
HARD_MAX_AGENT_ID_LENGTH = 64

def require_agent_id(value: object, *, max_length: int) -> str:
    if (
        isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or not 1 <= max_length <= HARD_MAX_AGENT_ID_LENGTH
    ):
        raise RuntimeError("configured agent ID limit must be between 1 and 64")
    if (
        not isinstance(value, str)
        or len(value) > max_length
        or not SAFE_AGENT_ID_CHARS.fullmatch(value)
    ):
        raise ValueError("invalid agent identifier")
    return value
```

When an identifier becomes a CLI argument, pass it through an argv API and place it after
the command's end-of-options marker where supported. **Character validation is not a
substitute for argument separation** — `--` and an argv array are the control, the regex is
defense in depth.

Reject missing and whitespace-only environment values before constructing a client:

```python
def require_env(name: str, environ: dict[str, str]) -> str:
    value = environ.get(name)
    if value is None or not value.strip():
        raise RuntimeError(f"{name} is required")
    return value
```

Parse URLs, allow only the schemes the deployment needs, require a host, reject embedded
credentials, and block private-network destinations when the URL is attacker-controlled.
For every outbound connection **and every redirect hop**, pin the connection to a validated
public address or verify the connected peer address at connection time so DNS rebinding
cannot cross the boundary. A credential-bearing request must use HTTPS with certificate
verification before credentials are attached. Disable automatic cross-origin credential
forwarding; when scheme or origin changes, strip credentials and reauthorize the new
destination or reject the redirect.

Complete when tests reject empty, oversized, malformed, traversal-shaped,
credential-bearing, and unauthorized-destination values **before any side effect**, and
prove that DNS rebinding and cross-origin redirects cannot carry credentials to an
unapproved peer.

### 3. Contain filesystem access

Reject absolute user-controlled paths and traversal components before joining. Reject
Windows-unsafe components on every platform so behavior stays portable: reserved device
names (`CON`, `NUL`, `COM1`, `LPT1`, including with an extension such as `nul.txt`), names
ending in a dot or space (Win32 strips them), and `:` (drive-relative or NTFS alternate
data stream syntax such as `report.txt:ads`). Resolve both workspace and candidate, then
prove containment:

```python
import re
from pathlib import Path

WINDOWS_RESERVED_NAME = re.compile(
    r"(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(\..*)?",
    re.IGNORECASE,
)

def workspace_path(workspace: Path, requested: str) -> Path:
    # Treat both platform separators consistently before checking components.
    relative = Path(requested.replace("\\", "/"))
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("path must be workspace-relative")
    for part in relative.parts:
        if ":" in part or part.endswith((".", " ")) or WINDOWS_RESERVED_NAME.fullmatch(part):
            raise ValueError("path component is not portable")

    root = workspace.resolve(strict=True)
    candidate = (root / relative).resolve(strict=False)
    if not candidate.is_relative_to(root):
        raise ValueError("path escapes workspace")
    return candidate
```

Containment checks do not eliminate symlink races. For sensitive writes, open relative to
a trusted directory handle where the platform supports it, reject symlink targets, create
files exclusively, and verify ownership and permissions after opening.

Complete when tests cover sibling-prefix paths, nested `..`, absolute paths, symlink
escapes, reserved device names, trailing dots or spaces, alternate data stream syntax, and
a valid nested workspace path.

### 4. Protect temporary data and credentials

- Sensitive files `0o600`, private directories `0o700`.
- Prefer a user-private runtime directory over a shared temp directory for credentials or
  tenant data.
- Create unpredictable names atomically; never check-then-create.
- Remove temp data in `finally`, preserving a redacted error record when cleanup fails.
- Keep secrets out of command arguments, model context, logs, traces, exception text, and
  tool responses.
- Pass secrets through the platform's secret store or scoped environment injection, and
  rotate anything that was exposed.
- Zeroization is best effort: mutable byte buffers can be overwritten, immutable language
  strings cannot be reliably erased.

Complete when file-mode checks, forced-error cleanup tests, and log-capture tests show
secret values never persist outside the approved boundary.

### 5. Bound and sanitize tool output

Read tool output with a byte limit rather than collecting an unbounded stream. Preserve
structured fields, strip disallowed control characters, and append an explicit truncation
marker with the original byte count. Keep a content hash when later forensic comparison
matters.

Do not silently turn malformed output into an empty success value. Return a typed failure
naming the producing tool, boundary, and validation reason, without echoing sensitive
content.

Complete when oversized output, invalid encoding, terminal-control sequences, malformed
structured data, and a normal response all have deterministic tests.

## Auditing the pi Surfaces

These are the mechanisms that actually grant power in a pi workflow package. Audit them
before auditing anything the prompt says.

### `tools:` is the permission boundary

An agent's frontmatter `tools:` list is its whole capability set. `scripts/validate.mjs`
holds the authoritative allowlist (`allowedPiTools`) and rejects a declared tool that is
neither a pi core tool nor a known extension provider. Read the list and ask what the agent
could do with each entry — not what the prompt says it will do.

Tools registered by an extension require the agent to load that provider through
`subagentOnlyExtensions` (or `extensions`); foreground children do not inherit the parent's
ambient extensions. A tool the child cannot load fails the whole run, which is the safe
direction, but it also means the child's real surface differs from the parent's.

### `acceptanceRole` does not restrict tools

`acceptanceRole: read-only` influences acceptance inference only. It grants nothing and
revokes nothing. An agent labelled read-only with `bash` and `write` in its `tools:` list
can still write. If an agent must not mutate, remove the tools — the role label is
documentation, not enforcement. This has already caused a wrong conclusion once in this
package, which is why it is written down.

### `inheritProjectContext` / `inheritSkills` widen the input channel

Inherited context is untrusted input arriving with the agent's own authority. A child that
inherits a project's rules also inherits any instruction injected into them. Turn
inheritance off when the child's job does not need it, and treat `AGENTS.md`, rules, and
skill text as inputs to review rather than as trusted configuration.

### GateGuard and Hookify are pattern gates, not a sandbox

`hkx-gateguard` blocks destructive shell commands by pattern, and `hkx-hookify` blocks or
warns on configured shapes (including a shell-parse floor for unparsed subtrees). Both run
in a child's `bash` too.

Neither is a sandbox. A pattern gate is defeated by any shape it does not match — the same
effect through a script, a language runtime, or an unmodelled flag. Treat them as
guardrails against accidents and prompt-injection-driven obvious moves, never as the
control that makes an untrusted agent safe. Real containment is worktree or filesystem
isolation, container separation, and OS permissions.

### MCP servers are third-party code with your environment

A configured MCP server runs with the operator's environment and can reach whatever the
process can. Review the config before trusting the tools it exposes, pin mutable package
references (`mcp-dependency-review`), and grant each server only the scopes it needs.

## Verification Gate

Before calling the framework hardened, verify these through its **real entry point**:

1. Untrusted instructions remain data and cannot trigger a tool or write.
2. An irreversible action without operation-and-resource authorization plus confirmation or
   scoped pre-approval leaves no side effect.
3. Cross-tenant and cross-workspace identifiers are rejected at the action boundary.
4. Traversal and symlink escape attempts leave the filesystem unchanged.
5. Forced failures leave no credential-bearing temp files or logs.
6. Oversized or malformed tool output returns an explicit bounded error.
7. Every agent's `tools:` list matches what its job needs, with no read-only label standing
   in for a missing tool removal.

Report the command used, exit status, rejected input, and the observed absence of the side
effect. **Mock-only tests do not prove** OS permissions, symlink handling, subprocess
isolation, or network egress controls.

## Common Issues

**Validation exists only in the prompt.** Prompt instructions are advisory. Move the same
invariant into deterministic code immediately before the side effect, and test a model
response that violates it.

**A normalized path still escapes.** String prefix checks confuse sibling paths such as
`/work/app` and `/work/application`. Resolve paths, use component-aware containment, then
test symlinks separately.

**Redaction happens after logging.** Redact before values enter the logger, tracer,
exception, or model context. Add a capture test with a sentinel secret and assert the
sentinel is absent from every emitted channel.

**A role label is mistaken for a capability limit.** See `acceptanceRole` above. If the
threat model depends on the agent being read-only, the tool list must prove it.

**A guardrail is mistaken for isolation.** See GateGuard above. Ask what the untrusted
agent could do if it never triggered a single known-bad pattern.

## Related

- `agent-harness-construction` — designing the tool surface this skill audits
- `security-review` — application-level auth, injection, and threat modelling
- `security-scan` — inventory of the config surfaces (MCP, extensions, hooks, secrets)
- `mcp-dependency-review` — vetting MCP configs before they run
- `safety-guard` — operator guardrails for destructive and production actions
- `gateguard` / `hookify-rules` — the pattern gates, and their limits

## Origin

Ported from ECC's `agent-security-hardening`. The trust-boundary workflow and its code
examples are unchanged. Added: a "pi surfaces" section (tools allowlist, the
`acceptanceRole` misconception, inheritance as an input channel, pattern gates vs
sandboxing, MCP trust), verification-gate item 7, and two Common Issues drawn from
mistakes already made in this package.
