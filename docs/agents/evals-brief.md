# Task: Build an eval harness for this repo's agent rules

## Context
This repo (`TaskBoard`, .NET 10 / C# 14) steers coding agents with rule files:
`CLAUDE.md` and `.claude/rules/*.md` (dotnet, dotnet-functional, dotnet-csharp14-idioms,
testing, hexagonal-architecture). We want evidence of which rules actually change agent
behaviour, so we can trim, rewrite or add rules and test before and after each change.

Decisions already made (don't revisit):
- We stay on C# 14. No C# 15 or preview features.
- Rules should only hold what the model wouldn't do by default: house preferences between
  valid options, corrections where the model falls back to old idioms, tie-breakers between
  conflicting rules, and bans. Generic "how modern C# works" text is a cut candidate.
- Anything a compiler or analyzer can enforce should move to `.editorconfig` +
  `TreatWarningsAsErrors` (not yet done; the repo has no `.editorconfig`). Its prose rule then
  becomes a cut candidate.
- Agents may later run on a VM with no internet (no Context7, no MS Learn). Rules must stand
  on their own. Local XML API docs exist under the dotnet packs folder and `~/.nuget/packages`.

## Goal
A small, repeatable harness: run the same coding tasks under different rule-set variants,
grade the results, and report pass rates per rule and variant. It must cover ALL rule types,
not just ones the compiler can check.

## Design
**Tasks** — `evals/tasks/<name>/`
- `prompt.md`: phrased the way a real user would ask. Never name the rule or hint at the
  expected shape ("add a helper", not "add an extension block").
- `rules.txt`: which rule(s) the task targets.
- `check.sh` and/or `rubric.md`: the grader(s).
- Optional `fixture.patch`: setup applied before the run (planted defects, ambiguity, etc.).
- Include control tasks that no rule targets, to catch side effects of a rule.

**Variants** — `evals/variants/<name>/` holds the `CLAUDE.md` + `.claude/rules/` to copy in.
At minimum: `none` (baseline: does the model do this anyway?), `current`, and `proposed`.

**Runner** — `evals/run.sh <variant> <reps> [task...]`
- Fresh git worktree per run from a pinned commit; copy the variant's files in.
- Run `claude -p` headless and capture the transcript (JSON output) plus the final diff.
- Isolate from user-level settings, plugins and hooks (e.g. the ponytail hook) so only the
  variant's rules apply. Verify the right CLI flag for this (possibly
  `--setting-sources project`); don't assume.
- 3–5 reps per task × variant. Write results to CSV.
- Run variants in parallel where safe; clean up worktrees.

**Graders, most trusted first.** Pick the cheapest grader that's reliable for each rule:
1. Compiler/analyzer: `dotnet build` (warnings as errors), `dotnet format --verify-no-changes`,
   `dotnet test`.
2. Structural (scripts over the diff, csproj files or file tree):
   - Extension blocks vs `this`-parameter static classes; no null-forgiving `!`.
   - No `InternalsVisibleTo`; `PackageReference` versions only in `Directory.Packages.props`.
   - Flat `src/<ProjectName>/` layout; test names match `Method_Expected_Scenario`.
   - `TestContext.Current.CancellationToken` in async tests.
   - Hexagonal dependency direction, from project references, and no EF/AspNetCore
     `using`s in Domain.
   - Conventional-commit message regex.
3. Diff scope: files changed outside an expected set (tests "touch only what you must").
4. Transcript checks, for behavioural rules with no code signal. Use fixtures:
   - An ambiguous task → did the agent surface the ambiguity or ask, rather than assume?
   - A planted adjacent bug → did it flag it WITHOUT silently fixing it?
   - A task needing an unknown fact → did it say "I'm not sure" rather than invent?
5. LLM judge, last resort, for judgment rules: `Result` vs exceptions for expected failures,
   `Maybe` vs null, "port earns its place", "minimum code, nothing speculative".
   - Binary yes/no per rubric item, with a quoted line from the diff as evidence.
   - Blind to the variant.
   - Calibrate on a few hand-labelled samples before trusting it.

## Known rule tensions worth dedicated tasks
- Boy Scout Rule (`dotnet.md`) vs "only touch what you must" (`CLAUDE.md`).
- The C# 14 idioms file's `is { IsSuccess: true, Value: ... }` example vs `dotnet-functional.md`
  ("prefer Match over IsSuccess/.Value").
- The `hexagonal-architecture.md` line "Unit test use TestContainers implementations" vs the
  "Unit Tests" section of `testing.md`, which mocks outbound ports with Moq.

## Constraints
- Simple tooling: shell scripts + a `tasks/` folder. No framework unless a clear need appears.
  Evaluate whether `claude plugin eval` fits plain rule files, and only adopt it if it's simpler.
- Don't modify production code or the rule files as part of building the harness.
- Cost-aware: prove the harness with 3 tasks × 3 variants × 3 reps before scaling up.
- Treat a difference of one run in five as noise. Only act on consistent gaps.

## Phases
1. Inventory every rule across `CLAUDE.md` + `.claude/rules/`. Classify each as
   compiler-enforceable / structural / diff-scope / behavioural / judgment, and propose a
   grader and one task. Present this table for review BEFORE building anything.
2. Build the runner + 3 tasks (extension blocks, `field` keyword, `Match` over `IsSuccess`).
   Run once against `current` to prove it end to end.
3. Add the `none` baseline and compare. Report which rules show no effect (cut candidates).
4. Expand to the other rule files, including at least one behavioural task with a fixture.

## Success criteria
- `evals/run.sh` runs unattended and produces a CSV + a markdown summary table.
- Every check script has been shown to both pass and fail on hand-made diffs (no
  always-green graders).
- The phase 1 rule inventory exists, with a grader type per rule.
- Results are reproducible enough that two runs of the same variant agree within noise.

## Open questions to ask me (don't assume)
- Can the offline VM reach the model API, or do evals only run on a connected machine?
- Rough budget per full eval run?
- Where results should live (committed under `evals/results/` or gitignored)?
