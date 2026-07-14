---
description: Warn when Python edits add bare except blocks.
condition: "except\\s*:"
scope: "tool:edit(**/*.{py,pyi}), tool:write(**/*.{py,pyi})"
---

# Avoid Bare Except

Do not add bare `except:` blocks.

Catch specific exception types, preserve context, and avoid swallowing cancellation, keyboard interrupts, or system-exit signals.
