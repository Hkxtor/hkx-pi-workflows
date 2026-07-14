---
name: hkx-frontend-patterns
description: "React/TypeScript frontend implementation patterns for Pi UI: components, state, composition, and practical accessibility hooks. Use when building or reviewing frontend code. Not design direction, design-system generation, micro-polish, full WCAG audits, or post-deploy browser QA."
---

# HKX Frontend Patterns

Use when building or reviewing frontend UI.

## Product Fit

Match the app's domain:

- Operational tools should be dense, calm, scannable, and predictable.
- Creative apps can be more expressive.
- Do not add marketing pages when the user asked for an app or tool.

## Components

- Reuse local components and design tokens.
- Keep state ownership clear.
- Prefer semantic HTML.
- Use icons for familiar tool actions.
- Avoid nested cards and decorative clutter.
- Make fixed-format controls dimensionally stable.

## Accessibility

- Keyboard reachable controls
- Visible focus states
- Labels for form controls
- Sufficient contrast
- No content overlap at supported viewport sizes
- Avoid relying on color alone

## Validation

Run the local checks. For visual work, use browser verification or screenshots when available.
