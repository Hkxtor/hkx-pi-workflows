---
name: hkx-skill-create
description: Analyze local git history to extract coding patterns and generate SKILL.md files.
argument-hint: [--commits N]
---

# /hkx-skill-create - Local Skill Generation

Analyze your repository's git history to extract coding patterns and generate SKILL.md files that teach Claude your team's practices.

## Usage

Use `Bash` to run `git log` to gather commit data:

```bash
/hkx-skill-create                    # Analyze current repo
/hkx-skill-create --commits 100      # Analyze last 100 commits
/hkx-skill-create --output ./skills  # Custom output directory
```

## What It Does

1. **Parses Git History** — Analyzes commits, file changes, and patterns
2. **Detects Patterns** — Identifies recurring workflows and conventions
3. **Generates SKILL.md** — Creates valid skill files

## Analysis Steps

### Step 1: Gather Git Data

Use `Bash` to run `git log` commands:

```bash
# Get recent commits with file changes
git log --oneline -n ${COMMITS:-200} --name-only --pretty=format:"%H|%s|%ad" --date=short

# Get commit frequency by file
git log --oneline -n 200 --name-only | grep -v "^$" | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -20

# Get commit message patterns
git log --oneline -n 200 | cut -d' ' -f2- | head -50
```

### Step 2: Detect Patterns

Look for these pattern types:

| Pattern | Detection Method |
|---------|-----------------|
| **Commit conventions** | Regex on commit messages (feat:, fix:, chore:) |
| **File co-changes** | Files that always change together |
| **Workflow sequences** | Repeated file change patterns |
| **Architecture** | Folder structure and naming conventions |
| **Testing patterns** | Test file locations, naming, coverage |

### Step 3: Generate SKILL.md

Output format:

```markdown
---
name: {repo-name}-patterns
description: Coding patterns extracted from {repo-name}
version: 1.0.0
source: local-git-analysis
analyzed_commits: {count}
---

# {Repo Name} Patterns

## Commit Conventions
{detected commit message patterns}

## Code Architecture
{detected folder structure and organization}

## Workflows
{detected repeating file change patterns}

## Testing Patterns
{detected test conventions}
```

## Related Commands

- `/hkx-skill-health` — Audit skill portfolio health

---

*Part of HKX Pi Workflows*