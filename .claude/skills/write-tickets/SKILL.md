---
name: write-tickets
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices.
disable-model-invocation: true
---

Break a plan into independent issues using vertical slices (tracer bullets).

The issue tracker and triage label vocabulary should have been provided to you — stop here if these are not available, and flag the user.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments. Read the PRD carefully. The PRD is the spec. Don't add scope; don't redesign. If the PRD is ambiguous, ask the user to clarify before drafting slices — the slices should reflect the PRD as-is, not your interpretation.

### 2. Confirm there are no existing sub-issues

Confirm the number of sub-issues already present. If there are any, ask the user if they want to continue with the existing sub-issues or start fresh. If starting fresh, delete all existing sub-issues first.

### 3. Explore the codebase (optional)

If you haven't already, explore the repo to understand the area you're touching. Use the project's domain glossary (`CONTEXT.md`) and respect ADRs under `docs/adr/`. Sub-issue titles and bodies should use the project's vocabulary.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 4. Draft the issues

Break the plan into **tracer bullet** issues, following the **Vertical slice rules**. A **wide refactor** is the exception to that rule — slice it by **expand–contract** instead (see **Wide refactors**).

### 5. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Blocked by**: which other slices (if any) must complete first (there may be multiple blockers)
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?

Iterate until the user approves the breakdown.

### 6. Publish the issues to the issue tracker

For each approved slice, publish a new issue to the issue tracker using the **Issue body template**. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order (blockers first) so you can reference real issue identifiers. Where the tracker supports it, link each slice to its parent as a native **sub-issue** and wire each blocker as a native **blocking edge** (mechanics in the issue-tracker doc); the `## Parent` and `## Blocked by` body sections are the fallback otherwise.

Do NOT close or modify any parent issue.

#### Publishing mechanics — avoid these footguns

- **One explicit create call per slice.** Do NOT loop over a shell array of titles paired positionally with an array of bodies. Shell array indexing is a portability trap — the session shell may be `zsh` (1-based) rather than `bash` (0-based), so `arr[$((k-1))]` silently shifts every title/body pairing by one. Instead, issue a separate create command per slice with that slice's title and body-file named together on the same line, so title and body cannot drift apart. If you must script a loop, don't derive the pairing from an index; and never assume the shell is bash.
- **Create one at a time and capture each real identifier before the next.** You need blockers' real numbers to fill later `## Blocked by` sections, so publish sequentially, read back each new issue's number/id, then substitute it into the dependent bodies before creating them.
- **Deletion is often denied.** On many trackers (e.g. org-owned GitHub repos) the agent lacks permission to delete issues, so a botched batch cannot simply be removed — you must fix it in place (retitle, edit bodies). Get it right the first time; verify before moving on.
- **Verify after publishing, before reporting done.** Read back every published issue and confirm: title matches its body, each `## Blocked by` reference resolves to the intended issue, the triage label is applied, and native sub-issue/parent links are present. Reconcile any mismatch before telling the user it's complete.

## Reference

### Vertical slice rules

Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Any prefactoring should be done first

### Wide refactors

A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own issue blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in an issue blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify issue — green is promised only there.

### Issue body template

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if the `/prototype` skill produced code that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), add a context pointer to where that prototype code lives rather than inlining it.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking ticket (if any)

Or "None - can start immediately" if no blockers.
</issue-template>
