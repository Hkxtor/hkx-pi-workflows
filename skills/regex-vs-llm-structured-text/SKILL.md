---
name: hkx-regex-vs-llm-structured-text
description: Choose regex or LLM for structured-text parsing using a hybrid default: start with deterministic parsing for the common case, then escalate only low-confidence edge cases.
origin: ECC-converted-for-OMP
---

# Regex vs LLM for Structured Text

Use this skill when parsing documents, forms, tables, quizzes, receipts, or
other text that has **some** structure but not perfect regularity.

## Default Decision Rule

If more than roughly 90% of the input follows a repeating structure, start with
regex or deterministic parsing.

- regex handles >=95% well -> stay deterministic
- regex handles most cases but not edge cases -> add LLM validation only for flagged items
- format is truly free-form and unstable -> use LLM first

## Recommended Architecture

1. deterministic parser for the common shape
2. cleanup / normalization stage
3. confidence scoring
4. LLM validation or repair for only low-confidence items

This keeps cost and latency low while preserving determinism where it matters.

## Confidence Signals

Flag items for LLM review when they show signs like:

- missing required fields
- too few extracted sections
- malformed numbering or labels
- unusually short or noisy text
- parse leftovers that should not remain

## Use Regex First When

- structure repeats across many items
- correctness should be reproducible
- the pipeline runs at scale
- most errors are edge-case formatting, not deep semantic ambiguity

## Use LLM First When

- the text is free-form
- meaning matters more than fixed labels
- layout varies too much for practical deterministic rules
- the parse target is semantic rather than syntactic

## Anti-Patterns

- sending every item to an LLM when a parser handles the majority
- trusting regex with no confidence scoring
- mutating parsed objects in-place across cleanup and repair steps
- optimizing for "AI magic" instead of measurable extraction quality

## Related Skills

- `hkx-content-hash-cache-pattern` for caching repeated document processing
- `hkx-cost-aware-llm-pipeline` for controlled LLM escalation
