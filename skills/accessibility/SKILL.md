---
name: hkx-accessibility
description: "Accessibility implementation and audit for Pi UI: keyboard, focus, ARIA, semantics, and WCAG 2.2 AA. Use when building or reviewing interactive UI for a11y. Not visual polish-only passes, design-system tokens, or full post-deploy browser QA suites (browser-qa may cover a11y as one phase)."
origin: HKX-converted-for-Pi
---

# HKX Accessibility For Pi

Use when building or reviewing interactive UI, forms, dashboards, browser flows,
or design-system components.

## Principles

- Prefer semantic native elements before ARIA.
- Every control needs a name, role, value, and state.
- Keyboard users must reach and operate every interactive element.
- Focus must be visible, ordered, contained when modal, and restored on close.
- Do not encode meaning with color alone.
- Dynamic updates need explicit status/live-region behavior when important.

## Web Checklist

### Semantics

- Buttons are `<button>`, links are `<a href>`, fields are native inputs.
- Icon-only buttons have accessible labels.
- Form labels are connected to fields.
- Errors are linked with `aria-describedby` and surfaced with clear text.

### Keyboard

- Tab order follows visual/task order.
- Escape closes dismissible modals/menus.
- Enter/Space activate custom controls if native controls are impossible.
- Focus stays inside modal dialogs and returns to trigger on close.

### Visual

- Text contrast meets WCAG AA.
- Focus indicator is visible and not clipped.
- Target size is at least 24x24 CSS pixels where practical.
- Content reflows at zoom and narrow widths.

### Motion and Updates

- Avoid essential information only in animation.
- Respect reduced motion where animations are significant.
- Announce async success/error states when the user needs feedback.

## Testing

Use the cheapest relevant checks:

- inspect semantic HTML and roles
- keyboard-only walkthrough
- screen reader smoke for critical flow
- browser automation for focus order and visible states
- axe or equivalent if configured in the project

## Common Anti-Patterns

- `div` with `onClick` and no keyboard support
- placeholder used as the only label
- invisible focus ring
- modal that allows background tabbing
- disabled submit with no explanation
- toast as the only error message
- color-only status indicators

## Output

```text
Accessibility review:
- Blockers:
- Fixes:
- Keyboard path:
- Screen reader semantics:
- Verification:
```
