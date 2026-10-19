---
description: Warn when JavaScript or TypeScript edits add console.log.
condition: "console\\.log\\("
scope: "tool:edit(**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}), tool:write(**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs})"
---

# Avoid Console Logging In Product Code

Do not add `console.log` in committed TypeScript or JavaScript code.

Use the project's logger, test assertions, or scoped debug helpers. If a temporary diagnostic is required, remove it before final validation.
