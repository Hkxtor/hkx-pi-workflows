---
name: hkx-cost-aware-llm-pipeline
description: Cost-control patterns for LLM-backed systems: route by task complexity, enforce budgets, retry only transient failures, and avoid resending stable prompt context.
origin: ECC-converted-for-OMP
---

# Cost-Aware LLM Pipeline

Use this skill when building a product or workflow that calls LLM APIs at
meaningful scale and needs explicit cost guardrails.

## Core Moves

### 1. Route by complexity

Do not send every request to the most expensive model.

- simple classification, extraction, or normalization -> cheap model
- normal implementation or analysis -> default model
- ambiguous reasoning, architecture, or judge work -> slower / stronger model

Define the routing rule with observable signals such as input length, item
count, required accuracy, or risk level.

### 2. Track cost immutably

Keep a durable record of:

- model used
- input and output token counts
- estimated or billed cost
- cumulative spend against a budget

Prefer append-only records over hidden mutable counters.

### 3. Retry narrowly

Retry only transient failures:

- network errors
- rate limits
- temporary server failures

Do **not** retry bad requests, auth failures, or invalid schemas forever. Those
burn budget without improving outcomes.

### 4. Cache stable prompt context

When system instructions or long static context are reused, avoid resending the
same large payload on every call if the provider or harness supports prompt
caching or reusable context.

## Pipeline Contract

Before shipping, make these explicit:

- budget limit per run / batch / user / day
- routing thresholds
- fallback model when the preferred tier fails
- what happens when the budget is exceeded
- which metrics are logged and reviewed

## Anti-Patterns

- one model for everything
- no budget ceiling
- retries on permanent failures
- hidden cost accounting
- large static prompts resent every time

## Related Skills

- `hkx-model-route` for interactive task-level model recommendations
- `hkx-eval-harness` when quality must be measured against the cheaper route
