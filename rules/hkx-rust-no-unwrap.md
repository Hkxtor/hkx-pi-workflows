---
description: Warn when Rust edits add unwrap or expect in production paths.
condition: "\\.(unwrap|expect)\\("
scope: "tool:edit(**/*.rs), tool:write(**/*.rs)"
---

# Avoid Rust Panics In Production Paths

Do not add `unwrap()` or `expect()` in production Rust code unless the invariant is truly impossible and documented.

Prefer `?`, typed errors, or explicit fallback behavior. Tests may use `unwrap()` sparingly when failure would make the test setup invalid.
