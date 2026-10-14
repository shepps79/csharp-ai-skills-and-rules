---
name: ralph-prep
description: Seed the disposable ticket cache for a PRD before starting the ralph loop — fetches its sub-tickets and comments, resolves the dependency DAG, orders them into the exact sequence the loop should execute, and writes docs/agents/loop/tickets-<prd-number>.json.
disable-model-invocation: true
---

Seed the cache the [ralph loop](../../../docs/agents/loop/ralph.prompt.md) reads from, so the loop itself never has to touch GitHub just to figure out what's left to do. Also isolate the whole PRD's work on its own branch, so the loop never commits on `main` and its work is ready to become one PR when done.

The issue tracker and triage label vocabulary should have been provided to you — stop here if these are not available, and flag the user. Takes a PRD ticket number as an argument.

## Process

1. **Create the workspace.** If `docs/agents/loop/tickets-<prd-number>.json` already has a `branch` (see below), reuse it — don't create a second branch for the same PRD. Otherwise, create and switch to a new branch with `git switch -c prd-<prd-number>`. Confirm what was actually created with `git branch --show-current` — record that exact value, don't assume a naming scheme.
2. List the PRD's sub-tickets **with comments** (`gh issue list ... --json number,title,body,labels,comments`, or `gh issue view <n> --comments` per ticket — see [docs/agents/backlog.md](../../../docs/agents/backlog.md)).
3. Determine each one's parent/blocker relationships from GitHub's native sub-issue and blocking links, falling back to the `## Parent` / `## Blocked by` sections in the ticket body.
4. **Resolve external blockers once.** For any `blockedBy` number that is not itself a sub-ticket in this PRD, check its live state with one `gh issue view <n>`. If it's still open, mark that dependent ticket `"externallyBlocked": true` in the cache; if it's closed, the blocker is satisfied and needn't be recorded. This is the only place external state is checked — the loop never calls `gh`, so it trusts what you record here.
5. **Order the tickets into the exact sequence the loop will execute** — this is where the selection judgement happens, once, so the loop never has to. Topologically sort so every ticket comes after all of its in-PRD `blockedBy` entries; among tickets that are equally unblocked at any point, order by priority (`priority:high` before `priority:medium` before `priority:low` per [docs/agents/issue-labels.md](../../../docs/agents/issue-labels.md)), and within the same priority put the more foundational slice first (the one others build on). The resulting array order **is** the plan: index 0 runs first.
6. Write `docs/agents/loop/tickets-<prd-number>.json`, with `tickets` in the order from step 5:

   ```json
   {
     "prd": <prd-number>,
     "branch": "<branch from step 1>",
     "tickets": [
       {
         "number": 124,
         "title": "...",
         "body": "...",
         "labels": ["ready-for-agent"],
         "comments": ["..."],
         "blockedBy": [123],
         "externallyBlocked": false,
         "status": "open"
       }
     ]
   }
   ```

   `status` starts as `"open"` for every ticket; `externallyBlocked` is the result of step 4 (omit or `false` when there's no open external blocker). The array order is significant — the loop executes tickets top to bottom, so don't re-sort it later.

This file is gitignored and disposable — it's scoped to one PRD's ralph run and is never re-synced with GitHub once the loop starts, so don't re-run this if `tickets-<prd-number>.json` already exists (delete it first if you want a fresh seed, e.g. sub-tickets changed after the last seed — and delete the stale branch too, with `git branch -D prd-<prd-number>`).

## After seeding

Tell the user: "Cache ready — branch `<branch>`. Start the loop with:"

```
/ralph-loop "$(cat docs/agents/loop/ralph.prompt.md)

PRD ticket: #<number>" --completion-promise COMPLETE --max-iterations <n>
```
