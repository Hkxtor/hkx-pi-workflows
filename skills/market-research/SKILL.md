---
name: hkx-market-research
description: "Business market research: competitive analysis, market sizing, investor/fund diligence, and decision-oriented industry intelligence with sources. Use only for commercial/competitive/business questions. Not for general technical research (research-ops/deep-research), library docs (documentation-lookup), or pre-coding reuse checks (search-first)."
origin: HKX-converted-for-Pi
---

# HKX Market Research For Pi

Produce research that supports decisions, not research theater.

## When to Activate

- Researching a market, category, company, investor, or technology trend
- Building TAM/SAM/SOM estimates
- Comparing competitors or adjacent products
- Preparing investor dossiers before outreach
- Pressure-testing a thesis before building, funding, or entering a market

## Research Standards

1. Every important claim needs a source.
2. Prefer recent data and call out stale data.
3. Include contrarian evidence and downside cases.
4. Translate findings into a decision, not just a summary.
5. Separate fact, inference, and recommendation clearly.

## Common Research Modes

### Investor / Fund Diligence

Collect:

- fund size, stage, and typical check size
- relevant portfolio companies
- public thesis and recent activity
- reasons the fund is or is not a fit
- any obvious red flags or mismatches

### Competitive Analysis

Collect:

- product reality, not marketing copy
- funding and investor history if public
- traction metrics if public
- distribution and pricing clues
- strengths, weaknesses, and positioning gaps

### Market Sizing

Use:

- top-down estimates from reports or public datasets
- bottom-up sanity checks from realistic customer acquisition assumptions
- explicit assumptions for every leap in logic

### Technology / Vendor Research

Collect:

- how it works
- trade-offs and adoption signals
- integration complexity
- lock-in, security, compliance, and operational risk

## Output Format

Default structure:

1. executive summary
2. key findings
3. implications
4. risks and caveats
5. recommendation
6. sources

## Quality Gate

Before delivering:

- All numbers are sourced or labeled as estimates
- Old data is flagged
- The recommendation follows from the evidence
- Risks and counterarguments are included
- The output makes a decision easier

## Tools

Use Pi tools for research:

- `web_search` — built-in web search for quick fact-checking
- `read` — fetch full content from promising URLs
- MCP search tools (exa, firecrawl) — when configured for deeper research
- `task` — parallelize research across subagents for broad topics
- `write` — save research reports to files

## Related Skills

- `hkx-research-ops` — orchestrates when to use which research lane
- `hkx-deep-research` — multi-source synthesis with citations
