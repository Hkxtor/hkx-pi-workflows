---
name: hkx-research-ops
description: Primary entry for evidence-first current-state research on Pi projects. Use when the user wants fresh facts, comparisons, enrichment, or a recommendation from public evidence plus local context. Route specialized depth to deep-research, Exa tool calls to exa-search, business diligence to market-research, and library/API docs to documentation-lookup. Not for pre-coding "should we build or reuse" checks (use search-first).
origin: HKX-converted-for-Pi
---

# HKX Research Ops For Pi

Use when the user asks to research something current, compare options, enrich
people or companies, or turn repeated lookups into a monitored workflow.

This is the operator wrapper around the research stack. It is not a replacement
for `hkx-deep-research` or `hkx-exa-search`; it tells you when and how to use
them together.

## Skill Stack

Pull these skills into the workflow when relevant:

- `hkx-exa-search` for fast current-web discovery via Exa MCP
- `hkx-deep-research` for multi-source synthesis with citations

## When to Use

- User says "research", "look up", "compare", "who should I talk to", or
  "what's the latest"
- The answer depends on current public information
- The user already supplied evidence and wants it factored into a fresh
  recommendation
- The task may be recurring enough that it should become a monitor instead of a
  one-off lookup

## Guardrails

- Do not answer current questions from stale memory when fresh search is cheap
- Separate:
  - sourced fact
  - user-provided evidence
  - inference
  - recommendation
- Do not spin up a heavyweight research pass if the answer is already in local
  code or docs

## Workflow

### 1. Start from what the user already gave you

Normalize any supplied material into:

- already-evidenced facts
- needs verification
- open questions

Do not restart the analysis from zero if the user already built part of the
model.

### 2. Classify the ask

Choose the right lane before searching:

- quick factual answer
- comparison or decision memo
- recurring monitoring candidate

### 3. Take the lightest useful evidence path first

- Use `hkx-exa-search` for fast discovery
- Escalate to `hkx-deep-research` when synthesis or multiple sources matter

### 4. Report with explicit evidence boundaries

For important claims, say whether they are:

- sourced facts
- user-supplied context
- inference
- recommendation

Freshness-sensitive answers should include concrete dates.

### 5. Decide whether the task should stay manual

If the user is likely to ask the same research question repeatedly, say so
explicitly and recommend a monitoring or workflow layer instead of repeating the
same manual search forever.

## Output Format

```text
QUESTION TYPE
- factual / comparison / monitoring

EVIDENCE
- sourced facts
- user-provided context

INFERENCE
- what follows from the evidence

RECOMMENDATION
- answer or next move
- whether this should become a monitor
```

## Pitfalls

- Do not mix inference into sourced facts without labeling it
- Do not ignore user-provided evidence
- Do not use a heavy research lane for a question local repo context can answer
- Do not give freshness-sensitive answers without dates

## Verification

- Important claims are labeled by evidence type
- Freshness-sensitive outputs include dates
- The final recommendation matches the actual research mode used
