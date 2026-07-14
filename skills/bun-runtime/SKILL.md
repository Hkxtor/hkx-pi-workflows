---
name: hkx-bun-runtime
description: Pi Bun and TypeScript runtime patterns. Use when editing package scripts, TypeScript, tests, workers, file IO, process execution, builds, or Bun-vs-Node decisions.
origin: HKX-converted-for-Pi
---

# HKX Bun Runtime For Pi

Pi is a Bun-first TypeScript monorepo. Use Bun APIs when they are clearer or
faster, and fall back to `node:*` APIs only where Bun has no equivalent.

## Commands

Use repo scripts:

```bash
bun run check
bun run check:ts
bun run test:ts
bun run fmt:ts
bun run lint:ts
bun run build
```

Do not run `tsc` or `npx tsc`. Do not swap package managers.

## Imports

- Use top-level imports.
- Avoid inline `await import()` unless a real runtime boundary requires it.
- Avoid `import("pkg").Type` type positions.
- Use namespace imports for `node:fs`, `node:path`, and `node:os`.

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { $ } from "bun";
```

## File IO

Prefer Bun for files:

```typescript
const text = await Bun.file(filePath).text();
const data = await Bun.file(filePath).json();
await Bun.write(filePath, text);
```

Use `node:fs/promises` for directory operations:

```typescript
await fs.mkdir(dir, { recursive: true });
await fs.rm(dir, { recursive: true, force: true });
```

Avoid:

- `readFileSync` / `writeFileSync` in async code
- `existsSync` before reads
- `mkdir(dirname(path))` before `Bun.write`
- multiple `Bun.file(path)` handles for the same read path

## Processes

Use Bun Shell for simple commands:

```typescript
const result = await $`git status --short`.cwd(cwd).quiet().nothrow();
if (result.exitCode === 0) {
  const text = result.text();
}
```

Use `Bun.spawn` for long-running processes, streaming protocols, PTYs, LSP/DAP,
or explicit process control.

## Async

- Use `Promise.withResolvers()` instead of hand-written promise constructors.
- Use `await Bun.sleep(ms)` for sleeps.
- Use shared stream helpers when the package already has them.
- Treat abort signals as part of the API contract for tool and provider paths.

## Workers

Compiled binaries need literal worker entry paths in the compiled branch:

```typescript
const worker = isCompiledBinary()
  ? new Worker("./packages/<pkg>/src/<worker>.ts", { type: "module" })
  : new Worker(new URL("./<worker>.ts", import.meta.url).href, { type: "module" });
```

Every new worker entry must also be listed in
`packages/coding-agent/scripts/build-binary.ts` and verified through the relevant
smoke path.

## Tests

- Use `bun:test`.
- Prefer `spyOn` over module-level replacement.
- Never use `mock.module()`.
- Tests must be full-suite safe.
- Assert observable contracts, not implementation wiring.
