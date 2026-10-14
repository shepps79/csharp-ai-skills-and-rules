---
name: create-pr
description: Open a pull request for a completed ralph loop run, summarizing work that's already implemented and tested — no re-implementing, no re-testing.
disable-model-invocation: true
---

Open the PR for a PRD's ralph-loop run. Takes the PRD ticket number as an argument.

# TASK

Write the title and description for a pull request that closes ticket #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}.

The implementation is already done — commits sit on branch `{{BRANCH}}`. You are NOT implementing anything. You are NOT running tests. You are summarizing work that already exists.

## Process

1. Read `docs/agents/loop/tickets-<prd-number>.json` (seeded by `ralph-prep`) for `branch` and the sub-tickets with `status: "done"`. Stop and flag the user if the cache is missing, or if no sub-ticket is `"done"` yet.
2. Fetch the PRD ticket's title: `gh issue view <prd-number> --json title --jq .title`.
3. Push the branch if it isn't already on the remote: `git push -u origin <branch>`.
4. Write the title and description using this brief:
- PR Title must be a single line, under 70 characters, conventional-commit style (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- PR Description must include `Closes #{{ISSUE_NUMBER}}` so the PR closes the ticket on merge, where the `ISSUE_NUMBER` is the parent PRD ticket.
- PR Description must summarize the work done in this branch, including a list of the sub-tickets that were completed. For each sub-ticket, include its number, title, and a one-line summary of what was implemented to satisfy its acceptance criteria. Use bullet points for clarity.
5. Create the PR: `gh pr create --title "<title>" --body "<description>" --head <branch> --base main`.

## Output

Report the PR URL. Don't merge it, don't request reviewers unless asked — opening it is this skill's only job.
