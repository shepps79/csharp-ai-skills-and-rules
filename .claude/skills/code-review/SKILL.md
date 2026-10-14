---
name: code-review
description: Review an open pull request against this repo's dotnet, hexagonal-architecture, and testing rules; report only blocking findings that must be fixed before it can merge.
disable-model-invocation: true
---

Review a pull request and report **blocking** findings only. Run this after `create-pr` has opened the PR for a completed ralph-loop run — it's a separate, independent pass, not part of the loop itself.

The PR number (or URL) should have been provided to you — stop here if it wasn't, and flag the user.

## Process

1. **Scope the diff** to the PR: `gh pr diff <pr-number>` for the changes, `gh pr view <pr-number> --json title,body,closingIssuesReferences` for what it claims to close.

2. **Check the diff against**:
   - [.claude/rules/dotnet.md](../../rules/dotnet.md) — member ordering, naming, async rules, no build warnings
   - [.claude/rules/hexagonal-architecture.md](../../rules/hexagonal-architecture.md) — dependency direction, port/adapter boundaries
   - [.claude/rules/testing.md](../../rules/testing.md) — naming, mocking discipline, no implementation-detail tests
   - Every closed issue's acceptance criteria (fetch each via `gh issue view`) — does the diff actually satisfy all of them?
   - Correctness: bugs, unhandled edge cases, security issues

3. **Run the build and tests** on the PR's branch (`gh pr checkout <pr-number>`, or the ralph-prep worktree if it's still around) with `dotnet build`, `dotnet test`. A failing build or test is always blocking.

4. **Classify each finding**:
   - **Blocking**: correctness bug, dependency-direction/layering violation, missing or failing test for changed behavior, build warning/error, security issue, unmet acceptance criterion.
   - **Non-blocking**: style nits, speculative refactors, anything not required by a rule above. Drop these — don't report them.

## Output

A short list of blocking findings, each as `file:line — defect — one-line fix`. If there are none, output exactly: `No blocking findings.`

Do not fix anything yourself — reporting is this skill's only job.

## Code Review Checklist

Review the code systematically across these dimensions:

### Correctness & Functionality

- Does the code achieve the stated goal?
- Are there logical errors or edge cases not handled?
- Are null/undefined checks in place where needed?
- Are error conditions properly handled?
- Proper exception handling, null-checking patterns

### Security

- **CRITICAL**: Check for secrets, API keys, credentials in code or config
- Are user inputs properly validated and sanitized?
- Are SQL queries parameterized (no SQL injection)?
- Are file paths properly validated (no path traversal)?
- Are authentication/authorization checks in place?
- Is sensitive data logged or exposed?

### Testing

- Are unit tests included for new functionality?
- Are edge cases covered by tests?
- Do existing tests still pass?
- For bug fixes: is there a regression test?
- Are integration tests needed?

### Code Quality & Maintainability

- Is the code readable and well-structured?
- Are variable/function names descriptive?
- Is there unnecessary code duplication?
- Are functions/methods appropriately sized?
- Are comments present where needed (complex logic)?
- Does it follow existing project patterns and conventions?

### Code Smells

**Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.
