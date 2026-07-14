---
name: hkx-deep-research
description: Multi-source deep research with cited synthesis for thorough topic reports. Use when the user wants exhaustive evidence and source attribution after research-ops has framed the question, or explicitly asks for a deep/cited report. Not for quick lookups, library docs, Exa tool how-to, market/investor diligence, or pre-coding search-first decisions.
origin: HKX-converted-for-Pi
---

# HKX Deep Research For Pi

Produce thorough, cited research reports from multiple web sources using
available MCP search tools.

## When to Activate

- User asks to research any topic in depth
- Competitive analysis, technology evaluation, or market sizing
- Due diligence on companies, investors, or technologies
- Any question requiring synthesis from multiple sources
- User says "research", "deep dive", "investigate", or "what's the current
  state of"

## MCP Requirements

At least one search-capable MCP server must be configured. Common options:

- **exa** — `web_search_exa`, `get_code_context_exa`
- **firecrawl** — `firecrawl_search`, `firecrawl_scrape`
- **context7** — documentation lookup for library/framework specifics

Configure MCP servers in `.mcp.json` at project root or `~/.pi/.mcp.json` for
global availability. Verify the exposed tool names before relying on them.

## Workflow

### Step 1: Understand the Goal

Ask 1-2 quick clarifying questions:

- "What's your goal — learning, making a decision, or writing something?"
- "Any specific angle or depth you want?"

If the user says "just research it" — skip ahead with reasonable defaults.

### Step 2: Plan the Research

Break the topic into 3-5 research sub-questions. Example:

- Topic: "Impact of AI on healthcare"
  - What are the main AI applications in healthcare today?
  - What clinical outcomes have been measured?
  - What are the regulatory challenges?
  - What companies are leading this space?
  - What's the market size and growth trajectory?

### Step 3: Execute Multi-Source Search

For EACH sub-question, search using available MCP tools. Use 2-3 different
keyword variations per sub-question. Mix general and news-focused queries. Aim
for 15-30 unique sources total.

Priority: academic, official, reputable news > blogs > forums.

If no search MCP is available, use the built-in `web_search` tool as a fallback.

### Step 4: Deep-Read Key Sources

For the most promising URLs, fetch full content using `read` tool or MCP scrape
tools. Read 3-5 key sources in full for depth. Do not rely only on search
snippets.

### Step 5: Synthesize and Write Report

Structure the report:

```markdown
# [Topic]: Research Report
*Generated: [date] | Sources: [N] | Confidence: [High/Medium/Low]*

## Executive Summary
[3-5 sentence overview of key findings]

## 1. [First Major Theme]
[Findings with inline citations]
- Key point ([Source Name](url))
- Supporting data ([Source Name](url))

## 2. [Second Major Theme]
...

## 3. [Third Major Theme]
...

## Key Takeaways
- [Actionable insight 1]
- [Actionable insight 2]
- [Actionable insight 3]

## Sources
1. [Title](url) — [one-line summary]
2. ...

## Methodology
Searched [N] queries across web and news. Analyzed [M] sources.
Sub-questions investigated: [list]
```

### Step 6: Deliver

- **Short topics**: Post the full report in chat
- **Long reports**: Post the executive summary + key takeaways, save full report
  to a file using `write` tool

## Parallel Research with Subagents

For broad topics, use Pi `task` tool to parallelize:

```
Launch 3 research agents in parallel:
1. Agent 1: Research sub-questions 1-2
2. Agent 2: Research sub-questions 3-4
3. Agent 3: Research sub-question 5 + cross-cutting themes
```

Each agent searches, reads sources, and returns findings. The main session
synthesizes into the final report.

## Quality Rules

1. **Every claim needs a source.** No unsourced assertions.
2. **Cross-reference.** If only one source says it, flag it as unverified.
3. **Recency matters.** Prefer sources from the last 12 months.
4. **Acknowledge gaps.** If you couldn't find good info on a sub-question, say
   so.
5. **No hallucination.** If you don't know, say "insufficient data found."
6. **Separate fact from inference.** Label estimates, projections, and opinions
   clearly.

## Examples

```
"Research the current state of nuclear fusion energy"
"Deep dive into Rust vs Go for backend services in 2026"
"Research the best strategies for bootstrapping a SaaS business"
"What's happening with the US housing market right now?"
"Investigate the competitive landscape for AI code editors"
```
