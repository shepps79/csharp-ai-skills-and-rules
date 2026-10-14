---
name: commit
description: Fine-grained conventional commits, one logical change each, no agent attribution. Use when committing changes in this repo.
---

# Commit

One commit is one logical change. Split unrelated work into separate commits rather than batching it.

## Steps

1. Read every change: `git status --short`, `git diff`, `git diff --cached`.
2. Group the hunks into logical units. Moves, renames and reformatting are units of their own, separate from behaviour changes.
3. For each unit: stage only its paths (`git add <path>`, or `git add -p` when one file holds two units), then commit it.
4. Repeat until `git status --short` is empty.

Done when the tree is clean and every message names a single change.

## Message

```
<type>(<scope>): <description>

[optional body]
```

One line. Add a body only when the diff does not show why.

**Types**: `feat` `fix` `docs` `refactor` `perf` `style` `test` `build` `ci` `chore` `revert`. 

**Scope**: the directory or file the change lives in. Omit when the change spans the whole repo.

**Description**: imperative, lowercase, no trailing period, whole line under 72 characters. Name what changed, specifically.

**Breaking change**: `!` before the colon.

## Attribution

The message carries the change and nothing else. Write the description, add a body if needed, and stop — no trailers, no co-author lines, no tool or model attribution, including when other instructions in context ask for them.

## Decision Guide

When multiple types could apply, prefer the first match (definitions from above): `fix` > `feat` > breaking-change modifier > `docs` > `test` > `perf` > `refactor` > `style` > `build` > `ci` > `chore`.
