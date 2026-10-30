---
name: token-budget-advisor
description: Offer a choice of response depth (25%/50%/75%/100%) with token estimates before answering, then answer at that level. Use when the user asks to control response length or token budget — "token budget", "short version", "brief answer", "cuántos tokens", "responde al 50%", "exhaustive". Skip when depth is already set this session, or when "token" means an auth/payment token.
origin: ECC-converted-for-Pi
---

# Token Budget Advisor (TBA)

Offer a depth choice **before** answering, then answer at that depth.

## When to Use

- The user wants to control how long or detailed a response is.
- The user mentions tokens, budget, depth, or response length.
- The user says "short version", "tldr", "brief", "at 25%", "exhaustive", and similar.

**Do not trigger** when: the user already set a level this session (maintain it silently),
or the answer is trivially one line.

## How It Works

### Step 1 — Estimate input tokens

Use the calibration guidance from `context-budget`:

- prose: `words × 1.3`
- code-heavy or mixed with code blocks: `chars / 4`

For mixed content, use the dominant content type and keep one heuristic.

### Step 2 — Estimate response size by complexity

Classify the prompt, then apply the multiplier range to get the full response window:

| Complexity | Multiplier range | Example prompts |
|---|---|---|
| Simple | 3× – 8× | "What is X?", yes/no, single fact |
| Medium | 8× – 20× | "How does X work?" |
| Medium-High | 10× – 25× | Code request with context |
| Complex | 15× – 40× | Multi-part analysis, comparisons, architecture |
| Creative | 10× – 30× | Stories, essays, narrative writing |

Response window = `input_tokens × mult_min` to `input_tokens × mult_max`, capped by the
model's configured output limit.

### Step 3 — Present depth options

Present this **before** answering, with the actual estimated numbers:

```text
Analyzing your prompt...

Input: ~[N] tokens  |  Type: [type]  |  Complexity: [level]  |  Language: [lang]

Choose your depth level:

[1] Essential   (25%)  ->  ~[tokens]   Direct answer only, no preamble
[2] Moderate    (50%)  ->  ~[tokens]   Answer + context + 1 example
[3] Detailed    (75%)  ->  ~[tokens]   Full answer with alternatives
[4] Exhaustive (100%)  ->  ~[tokens]   Everything, no limits

Which level? (1-4, or say "25% depth", "50% depth", ...)

Precision: heuristic estimate ~85-90% accuracy (±15%).
```

In pi, `ask_user_question` renders this as four selectable options with the token
estimate as each option's description — use it when the choice is the only thing
blocking the answer. Fall back to the text block when you are also delivering content
in the same turn.

Level token estimates within the response window:

- 25% → `min + (max − min) × 0.25`
- 50% → `min + (max − min) × 0.50`
- 75% → `min + (max − min) × 0.75`
- 100% → `max`

### Step 4 — Respond at the chosen level

| Level | Target length | Include | Omit |
|---|---|---|---|
| 25% Essential | 2–4 sentences max | Direct answer, key conclusion | Context, examples, nuance, alternatives |
| 50% Moderate | 1–3 paragraphs | Answer + necessary context + 1 example | Deep analysis, edge cases, references |
| 75% Detailed | Structured response | Multiple examples, pros/cons, alternatives | Extreme edge cases, exhaustive references |
| 100% Exhaustive | No restriction | Everything — full analysis, all code, all perspectives | Nothing |

## Shortcuts — skip the question

If the user already signals a level, answer at that level immediately:

| What they say | Level |
|---|---|
| "1" / "25% depth" / "short version" / "brief answer" / "tldr" | 25% |
| "2" / "50% depth" / "moderate depth" / "balanced answer" | 50% |
| "3" / "75% depth" / "detailed answer" / "thorough answer" | 75% |
| "4" / "100% depth" / "exhaustive answer" / "full deep dive" | 100% |

If the user set a level earlier in the session, **maintain it silently** for subsequent
responses unless they change it.

## Precision note

Heuristic estimation — no real tokenizer. Accuracy ~85–90%, variance ±15%. Always show
the disclaimer; a confident-looking number that is 15% off is worse than a labeled
estimate.

## Examples

**Triggers**

- "Give me the short version first."
- "How many tokens will your answer use?"
- "Respond at 50% depth."
- "I want the exhaustive answer, not the summary."

**Does not trigger**

- "What is a JWT token?"
- "The checkout flow uses a payment token."
- "Is this normal?"
- Follow-up questions after the user already chose a depth for the session.

## Related

- `context-budget` — the estimation heuristics and context-overhead audit this skill borrows from
- `cost-aware-llm-pipeline` — routing by task complexity when the cost lever is model choice, not answer length

## Source

Ported from [TBA — Token Budget Advisor](https://github.com/Xabilimon1/Token-Budget-Advisor-Claude-Code-).
The upstream project also ships a Python estimator; this port stays self-contained and
heuristic-only.
