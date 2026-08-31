---
description: Guided feature development with codebase understanding and architecture focus. Ported from ECC, running on hkx agents.
argument-hint: "[feature description]"
---

# HKX Feature Dev For Pi

Feature request: `$ARGUMENTS`

A structured feature-development workflow that emphasizes understanding existing
code before writing new code. Default to read-only until the user approves the
design; make no commits or external mutations without explicit approval.

If `$ARGUMENTS` is empty, ask the user what feature should be built.

## Phases

### 1. Discovery

- read the feature request carefully;
- identify requirements, constraints, and acceptance criteria;
- ask clarifying questions if the request is ambiguous.

### 2. Codebase Exploration

- use the `hkx.code-explorer` subagent to analyze the relevant existing code;
- trace execution paths and architecture layers;
- understand integration points and conventions.

### 3. Clarifying Questions

- present findings from exploration;
- ask targeted design and edge-case questions;
- wait for the user's response before proceeding.

### 4. Architecture Design

- use the `hkx.code-architect` subagent to design the feature;
- provide the implementation blueprint with concrete files, interfaces, and build order;
- wait for the user's approval before implementing.

### 5. Implementation

- implement the feature following the approved design;
- prefer TDD where appropriate;
- keep commits small and focused.

### 6. Quality Review

- use the `hkx.code-reviewer` subagent to review the implementation;
- add `hkx.security-reviewer` when the change touches auth, secrets, or external input;
- address critical and important issues;
- verify test coverage.

### 7. Summary

- summarize what was built;
- list follow-up items or limitations;
- provide testing instructions.

## Notes

- For end-to-end orchestration with gated commits, prefer `/orch-add-feature`;
  `/feature-dev` is the lighter, conversation-driven variant.
- Agents are read-only; all file edits and commits stay in the main session
  and require user approval at the design gate (Phase 4) and before any commit.
