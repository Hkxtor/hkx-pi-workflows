---
description: "Evolve clustering thresholds for skill, command, and agent candidates."
---

# Evolve thresholds

Parity with ECC `cmd_evolve` (Phase 1).

| Rule | Value |
| --- | --- |
| Min instincts | ≥ 3 |
| Skill cluster | normalized trigger group size ≥ 2 |
| Command | domain == workflow and confidence ≥ 0.7 |
| Agent | cluster size ≥ 3 and avg confidence ≥ 0.75 |
| High-confidence display | ≥ 0.8 |
| Generate caps | 5 skills / 5 commands / 3 agents |

## Trigger normalization

Lowercase; remove stopwords: when, creating, writing, adding, implementing, testing; collapse whitespace.


## Confidence decay

| Parameter | Default | Meaning |
| --- | --- | --- |
| rate / week | 0.02 | Subtracted per full inactive week |
| floor | 0.1 | Minimum confidence after decay |
| activity | last_seen → updated → created → mtime | Timestamp source |

CLI: `decay` (preview), `decay --apply` (write).
