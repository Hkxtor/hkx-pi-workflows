---
name: hkx-hexagonal-architecture
description: Design or refactor Pi services with ports-and-adapters boundaries across TypeScript, Rust, Python, and Go without leaking framework or infrastructure details.
origin: HKX-converted-for-Pi
---

# HKX Hexagonal Architecture For Pi

Use when domain/application logic is tangled with web frameworks, databases, SDKs, CLIs, queues, MCP tools, or UI/TUI adapters, and the change needs durable testable boundaries.

## Core Concepts

- **Domain**: business rules and value objects with no framework imports.
- **Use case/application layer**: orchestrates a single command/query workflow.
- **Inbound adapter**: HTTP route, CLI command, worker, UI action, MCP tool, or event consumer.
- **Outbound port**: capability required by the use case, such as repository, gateway, clock, logger, or publisher.
- **Outbound adapter**: database, filesystem, SDK, queue, provider, or shell implementation of a port.
- **Composition root**: explicit wiring location.

Dependency direction points inward: adapters depend on application/domain contracts; domain does not import infrastructure.

## Workflow

1. Pick one vertical slice with clear user/operator behavior.
2. Define use-case input, output, and errors using plain project types.
3. Identify side effects and express them as outbound ports owned by the application layer.
4. Move orchestration into the use case.
5. Keep protocol mapping in inbound adapters.
6. Keep persistence/SDK/file/process mapping in outbound adapters.
7. Wire dependencies in one composition root.
8. Add tests at the boundary you changed.

## Suggested Shape

```text
feature/
  domain/
  application/
    ports/
    use-cases/
  adapters/
    inbound/
    outbound/
  composition/
```

Use local repo conventions if they already express the same boundaries with different names.

## Testing

- Domain tests cover pure rules.
- Use-case tests use simple in-memory fakes for outbound ports.
- Adapter integration tests cover serialization, queries, SDK behavior, retries, and timeouts.
- E2E/smoke tests cover critical journeys through inbound adapter to outbound side effects.

## Refactor Playbook

- Add characterization tests first for legacy behavior.
- Wrap legacy services behind ports before replacing internals.
- Migrate one endpoint, command, tool, or job at a time.
- Keep rollback or delegation paths until behavior is proven.
- Do not perform big-bang rewrites.

## Smells

- Domain imports ORM, web framework, SDK, shell, or MCP transport types.
- Use cases read `req`, `res`, process env, raw rows, CLI args, or tool-call payloads directly.
- Adapters call each other instead of going through a use case.
- Wiring is hidden in globals or service locators.
- Errors are swallowed or translated inconsistently across boundaries.
