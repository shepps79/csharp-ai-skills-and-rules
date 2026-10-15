# Evals: next steps

The eval harness in `evals/` (see `evals/README.md`) runs Claude Code headless against a .NET fixture
for each variant (`none`, `rules@WORKTREE`) and grades the result with deterministic
checks, hidden acceptance tests and a local `claude -p` judge. Everything stays local; promptfoo telemetry and sharing are off.

## Current state

- Agent: `claude-sonnet-5-5`. Judge: `claude-opus-5-5`, told to treat the graded diff as untrusted data.
- Two fixtures (`fixtures/orders`, `fixtures/empty`) and eight tasks: `find-order` (null trap), `place-order-tests`
  (mocks vs TestContainers conflict), `cancel-order` (realistic feature), `get-order-mocked` (testing.md's `(Order?)null`
  mock vs `Maybe`), `reserve-stock` (adapter errors as exceptions vs Results), `order-limits` (configuration skill,
  hidden HTTP acceptance tests), `add-telemetry` (opentelemetry skill), `greenfield-inventory` (new service).
- 25 deterministic checks in `evals/graders/checks.js` (with their own tests, `npm test`), plus one `llm-rubric` per task.
- Hidden acceptance tests in `evals/acceptance/`: NetArchTest architecture tests on every `orders` task, and an HTTP
  contract test for `order-limits`.
- Coverage: the `orders` test projects reference coverlet.collector and coverlet.msbuild; the `coverage` check scores
  the line coverage of the production files the agent changed.
- Ablation (`config.excludeRules`), pairwise judging (`npm run eval-pairwise`), a cross-eval fingerprint guard
  (`npm run report -- <id> <id>` exits 1 on a mismatch) and per-variant turns, tokens, cost and minutes are in place.
- `rules@HEAD` is removed while the rules are being reworked; compare `rules@WORKTREE` against the baseline eval.
  `env` (global setup, no repo rules) is removed too; restore it with `{ variant: env }` when needed.
- The checks, judge prompt, fixture analyzers and tasks changed on 2026-10-15; results graded before then, including
  baseline `eval-PHZ-2026-10-15T12:05:05`, aren't comparable.

## Next steps, in order

1. **Re-record the baseline**: `npm run eval-baseline -- --repeat 5`. That is 8 tasks × 2 variants × 5 = 80 agent
   runs; at the last baseline's cost per run, roughly $15 and 1–1.5 hours at concurrency 2.
2. **Run the ablation**: one `rules@WORKTREE` provider per rule file with `excludeRules: [<file>]`, `--repeat 5`.
3. **More skill-triggering tasks.** `order-limits` (configuration) and `add-telemetry` (opentelemetry) grade on
   `skillsUsed`; `find-order` and `place-order-tests` grade on `noSkillsUsed`. Still missing: `ef-core` (needs a
   database adapter in `orders`), `fast-endpoints`, `dependency-injection` and `aspire`.
4. **More hidden acceptance tests.** Only `order-limits` fixes a contract in its task text. `find-order`,
   `cancel-order` and `get-order-mocked` leave method names to the agent, so they can't have contract tests without
   changing their task text, which changes the yardstick.
5. **Pairwise at scale.** `select-best` was checked against the judge on a toy pair only. Restore `rules@HEAD` once the
   rules settle and run `eval-pairwise` in both orders.

## Rule problems the evals now surface

These are measured, not fixed; they are inputs for the next round of rule changes.

- `hexagonal-architecture.md` "Unit test use TestContainers" vs `testing.md` Moq for ports (`place-order-tests`).
- `testing.md`'s mocking example stubs `(Order?)null` and asserts `BeNull()`, which `dotnet-functional.md` bans
  (`get-order-mocked`, check `noNullInTests`).
- `hexagonal-architecture.md` "translate to an application exception" vs `dotnet-functional.md` "translate to a
  Result" (`reserve-stock`, check `noExceptionsInApplication`). Its rubric takes the `dotnet-functional.md` side.
- `dotnet.md` "Async methods must have the Async suffix" vs `testing.md` test names (`PlaceOrder_Returns201_…`).
  The template exempts test projects, so the build doesn't flag it, but the rules still say both.
- `testing.md` "Running Tests" uses `tests/MyService.UnitTests/` paths while its "Test Organization" bans a `tests/` directory.

## Compiler-enforced rules

`templates/dotnet/.editorconfig` + `Directory.Build.props` turn the checkable parts of `.claude/rules` into build
errors; copy both into any .NET repo (the analyzers need central package management). Known gaps, still prose-only:

- `String` vs `string` (IDE0049): configured, but not reported at build by SDK 10.0.301; editor only.
- Function length, parameter count, nesting depth, commented-out code, LINQ over loops, `InternalsVisibleTo`:
  no analyzer here (Sonar covers some). Sealed classes are checked by the `orders` architecture tests, and
  `noInternalsVisibleTo` and similar eval checks cover a few others.
- The rules themselves don't yet tell the agent to use the template; worth adding to `dotnet.md`.

## Things to keep in mind

- The rubrics in `promptfooconfig.yaml` are the yardstick. Change them in a separate commit from rule changes,
  and re-run the baseline after.
- Single runs are noisy. Use `--repeat 5` or more; differences under about 7–15 points are noise at that size,
  and repeats often produce byte-identical code, so confirm a gain with a second eval.
- The global setup (RTK, ponytail, CLAUDE.md and its imports, skills, agents, commands, plugin contents) is
  deliberately part of the `rules@*` variants (and `env` when restored). If it changes, the fingerprint changes and the baseline must be re-run.
