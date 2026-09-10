---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
origin: mattpocock-ported
---

# Grill With Docs

A thin orchestrator. Load and follow two skills together:

1. **`grilling`** — run the relentless one-question-at-a-time interview. Walk each branch of the decision tree, resolve dependencies one-by-one, recommend an answer for each, and wait for the user's answer before moving on. The decisions are the user's; do not act until they confirm a shared understanding.
2. **`domain-modeling`** — while grilling, capture what crystallises: resolve a term, write it into `CONTEXT.md` inline (not batched); when a decision clears all three ADR gates, offer an ADR lazily. Facts live in `CONTEXT.md` (glossary only); decisions live in `docs/adr/`.

Grilling drives the pace; domain-modeling records the output as it happens. Load both skills (read their `SKILL.md`, or invoke `/skill:grilling` and `/skill:domain-modeling`) before starting, so the interview and the doc capture stay in lockstep rather than the model trying to reconstruct terms from memory afterward.

Do not act on the plan until the user confirms a shared understanding.
