---
name: hkx-go-workflow
description: Go development workflow for idiomatic implementation, tests, and validation on Pi projects. Use when editing Go code. Not other language workflows or architecture-only hexagonal guidance.
---

# HKX Go Workflow

Use when implementing or reviewing Go changes.

## Read First

- Inspect `go.mod`, package boundaries, generated files, and existing test style.
- Mirror local context, logging, and error wrapping patterns.
- Check whether interfaces are owned by consumers or providers in this repo.

## Implementation

- Let `gofmt` and `goimports` own formatting.
- Keep interfaces small.
- Check errors immediately and wrap with useful context.
- Avoid panics in libraries, request handlers, and long-running services.
- Use context cancellation for network and process boundaries.

## Testing

- Prefer table-driven tests for input/output matrices.
- Cover boundary values and error paths.
- Avoid sleeps; use synchronization or controllable clocks.

## Validation

Prefer repo scripts. Common targets:

```bash
gofmt -w path/to/file.go
go test ./...
go vet ./...
```
