---
name: click-path-audit
description: "Trace every user-facing touchpoint through its full state-change sequence to find bugs where each function works alone but the combination cancels out, lands on the wrong final state, or leaves shared state inconsistent. Use when systematic debugging finds nothing yet users report a button that does nothing, after any refactor touching a shared store, or before release on critical flows. Not for API contract bugs (change-impact), styling (make-interfaces-feel-better), performance (benchmark), or authoring the regression test (tdd-workflow)."
origin: ECC-converted-for-Pi
---

# Click-Path Audit — Behavioural Flow Audit

Find the bugs that static reading and ordinary debugging both miss: handlers whose
calls silently undo each other, races between sequential awaits, and state resets
nobody declared.

## The Gap This Fills

Normal debugging asks:

- Does the handler exist? (missing wiring)
- Does it crash? (runtime error)
- Does it return the right type? (data flow)

It does **not** ask:

- Does the final state match what the button label promises?
- Does call 2 silently undo what call 1 just did?
- Does a shared store action reset fields it does not own?

The canonical case: a "New Email" button called `setComposeMode(true)` and then
`selectThread(null)`. Both worked in isolation. But `selectThread` had an undeclared side
effect resetting `composeMode: false`. The button did nothing. A systematic sweep had
already found 54 bugs in that codebase and missed this one — because nothing was broken
except the interaction between two correct functions.

## When to Activate

- A button "does nothing", or does something other than its label says.
- Debugging concluded "no bugs" but users still report broken flows.
- A shared store action was modified — audit its consumers.
- After a refactor touching shared state, before release, on critical flows.
- A multi-step form lands in a state no single step would produce.

## When Not To

- Wrong response shape or a missing endpoint → `change-impact` to find the blast radius,
  then the normal fix loop.
- Styling and layout → `make-interfaces-feel-better`.
- Slowness → `benchmark` / `benchmark-optimization-loop`.
- Writing the regression test for a bug you already found → `tdd-workflow`.

## Step 1 — Map the state containers (main session, do not delegate)

Before auditing any touchpoint, build a side-effect map. This is the reference the whole
audit depends on, and it must exist once, not once per auditor.

For every store / context / provider in scope, for every action or setter:

- which fields does it **set**?
- which fields does it **reset or clear as a side effect**?
- does it read anything it does not own?

```text
STORE: emailStore
  setComposeMode(bool)      → sets {composeMode}
  selectThread(thread|null) → sets  {selectedThread, selectedThreadId, messages, drafts,
                                     selectedDraft, summary}
                              RESETS {composeMode: false, composeData: null, redraftOpen: false}
  setDraftGenerating(bool)  → sets {draftGenerating}

DANGEROUS RESETS (actions clearing state they do not own):
  selectThread → resets composeMode (owned by setComposeMode)
  reset        → resets everything
```

Read the actions, not just their names. A setter called `selectThread` that also clears
`composeMode` is invisible from the call site and obvious from the body — the whole audit
rests on this step being honest.

## Step 2 — Audit each touchpoint

For every button, toggle, form submit, menu item, keyboard shortcut, and row action in
scope:

```text
TOUCHPOINT: [label] in [Component:line]
  HANDLER: onClick → {
    call 1: functionA() → sets {X: true}
    call 2: functionB() → sets {Y: null} RESETS {X: false}   ← CONFLICT
  }
  EXPECTED: [what the label promises the user]
  ACTUAL:   X is false because functionB reset it
  VERDICT:  BUG — [one line]
```

Trace the calls **in source order** and check the six patterns below against each one.

## The Six Patterns

**1. Sequential undo** — a later call resets what an earlier call set.

```js
handler() {
  setState_A(true)   // X = true
  setState_B(null)   // side effect: X = false
}
// X is false. The first call was decorative.
```

**2. Async race** — the final state depends on resolution order.

```js
handler() {
  fetchA().then(() => setState({ loading: false }))
  fetchB().then(() => setState({ loading: true }))
}
```

**3. Stale closure** — the handler captures a value that has already moved.

```js
const handler = useCallback(() => {
  setCount(count + 1)  // captures stale count
  setCount(count + 1)  // same stale count — +1 total, not +2
}, [count])
```

**4. Missing transition** — the handler validates but never performs the action the label
promises. "Save" that only validates, "Delete" that sets a flag without calling the API,
"Send" pointing at an endpoint that no longer exists.

**5. Conditional dead path** — the branch that does the real work is unreachable because
its condition is already false at that point in the sequence.

**6. Effect interference** — the handler sets state, and a watcher/effect immediately
resets it. The user sees nothing happen. Includes `useEffect`, `watch`, subscriptions, and
middleware that rewrites the action.

## Step 3 — Confirm against the running UI

Static tracing tells you what the code does; it does not prove what the user sees. When
the app runs, confirm each suspected bug with the Pi `browser` tool: `open` the page,
drive the touchpoint, and read the resulting state with `tab.evaluate` rather than
inferring it.

A trace that predicts a bug and a browser check that confirms it are two different
findings. Report which one you have — a suspected bug that the live UI contradicts was
probably a misread store map, and that is worth knowing too.

When the app cannot run, say so and label every finding `static-only`. Do not present a
static trace as an observed failure.

## Report

```text
CLICK-PATH-NNN: [CRITICAL / HIGH / MEDIUM / LOW]
  Touchpoint: [label] in [file:line]
  Pattern:    [Sequential Undo / Async Race / Stale Closure / Missing Transition /
               Dead Path / Effect Interference]
  Handler:    [function or inline]
  Trace:
    1. [call] → sets {field: value}
    2. [call] → RESETS {field: value}   ← CONFLICT
  Expected:   [what the user expects]
  Actual:     [what happens]
  Evidence:   [live | static-only]
  Fix:        [the specific change]
```

Severity is about user impact, not code smell: a dead primary action is CRITICAL even
though it is a two-line fix.

## Scope Control

This audit is expensive — it reads every handler and every store action. Pick the
smallest scope that answers the question:

| Scope | Use when |
| --- | --- |
| Single touchpoint | A user reported one broken button |
| Single page | A new page landed, or one flow is suspect |
| Store-focused | A shared store action changed — audit all its consumers |
| Full app | Launch, or after a refactor that touched shared state |

### Splitting a full-app audit

Step 1 (the store map) runs **once, in the main session**, and its output is the shared
input for every page auditor. Do not let each auditor build its own map — two maps drift
and the audit stops being comparable.

Only then fan out per page or per module, one read-only auditor each. In pi that is
`hkx.code-explorer` dispatched per page with the store map attached, or the main session
walking the pages itself when the count is small. Prefer the second: a page audit is
usually a handful of handlers, and a child costs more than the read.

## Related

- `agent-introspection-debugging` — loops and failures that do reproduce; run it first
- `browser-qa` — driving a live page for smoke, interaction, and visual checks
- `e2e-testing` — turning a confirmed click-path bug into a permanent test
- `change-impact` — deciding what a shared-store change can break before you make it
- `make-interfaces-feel-better` — the states the audit finds unreachable still need designing
- `tdd-workflow` — every bug found here earns a regression test

## Origin

Ported from the ECC community skill `click-path-audit`. Two changes from the original:
the store map is explicitly main-session-only (the original left the split implicit), and
Step 3 verifies against a live page with the Pi `browser` tool instead of reasoning about
state from source alone.
