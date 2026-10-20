# Evals: next steps

The eval harness in `evals/` (see `evals/README.md`) runs Claude Code headless against a .NET fixture
for each variant (`none`, `rules@WORKTREE`) and grades the result with deterministic
checks, hidden acceptance tests and a local `claude -p` judge. Everything stays local; promptfoo telemetry and sharing are off.

## Current state

- Agent: `claude-sonnet-5-5`. Judge: `claude-opus-5-5`, told to treat the graded diff as untrusted data.
- Two fixtures (`fixtures/orders`, `fixtures/empty`) and nine tasks, each with one intent in its description:
  `delivery-note` (an optional value is a `Maybe`; `string?` trap), `get-order-endpoint` (absence is `NotFound`;
  endpoint tests through the real host), `customer-orders` (a sequence stays on the railway; fakes find by key),
  `cancel-order` (a type per lifecycle state), `reserve-stock` (adapter failures as Results; exception trap),
  `customer-name` (typed `HttpClient` tested against a stub server), `order-limits` (Options pattern; configuration
  skill), `night-review` (`DateTime.UtcNow` trap: the rules should lead to
  `TimeProvider`), `greenfield-inventory` (new service). Each task that changes storage states an HTTP contract, so
  TEST-007's endpoint tests can cover the adapter and the TEST-011 gate can pass.
- 41 deterministic checks in `evals/graders/checks.js` (with their own tests, `npm test`), plus one `llm-rubric` per task.
- Hidden acceptance tests in `evals/acceptance/`: NetArchTest architecture tests on every `orders` task, and an HTTP
  contract tests for every task whose text fixes one: `delivery-note`, `get-order-endpoint`, `customer-orders`,
  `cancel-order`, `customer-name` and `order-limits`. The `customer-name` tests stub every `IHttpClientFactory`
  client's primary handler, so code that creates its own `HttpClient` fails them.
- Coverage: the `orders` test projects reference coverlet.collector and coverlet.msbuild; the `coverage` check scores
  the line coverage of the production files the agent changed.
- Ablation (`config.excludeRules`), pairwise judging (`npm run eval-pairwise`), a cross-eval fingerprint guard
  (`npm run report -- <id> <id>` exits 1 on a mismatch) and per-variant turns, tokens, cost and minutes are in place.
- In the first baseline, all rule files together cost ~21.8k tokens per session.
- `rules@HEAD` is removed while the rules are being reworked; compare `rules@WORKTREE` against the baseline eval.
  `env` (global setup, no repo rules) is removed too; restore it with `{ variant: env }` when needed.
- The tasks, rubrics, checks and judge prompt changed on 2026-10-20 to match the rewritten rules; results graded
  before then aren't comparable.

## Next steps, in order

1. **Re-record the baseline**: `npm run eval-baseline -- --repeat 5`. That is 9 tasks × 2 variants × 5 = 90 agent
   runs; at the last baseline's cost per run, roughly $17 and 1–1.5 hours at concurrency 2.
2. **Run the ablation**: one `rules@WORKTREE` provider per rule file with `excludeRules: [<file>]`, `--repeat 5`.
3. **More skill-triggering tasks.** `order-limits` (configuration) grades on
   `skillsUsed`. Still missing: `ef-core`, `fast-endpoints` and `dependency-injection`. The workflow skills
   (`commit`, `code-review`, `create-pr`, `write-spec`, `write-tickets`, `writing-great-skills`)
   have no tasks either. `none` has no repo skills, so it fails `skillsUsed` by design.
4. **Check the configuration skill's trigger.** In the one `order-limits` smoke run (`rules@WORKTREE`), the agent never
   loaded `configuration` and read the limit with `IConfiguration.GetValue` instead of the Options pattern, failing
   both `skillsUsed` and the judge. One run is a signal, not a result; if the baseline repeats it, the skill's
   description likely misses wording like "configurable per environment".
5. **Skill ablation.** `excludeRules` only drops rule files; `rules@WORKTREE` copies all of `.claude/`, skills included.
   Add an equivalent `excludeSkills` to measure what each skill adds. Until then, skill content is judged only
   indirectly: the `order-limits` rubric grades what the configuration skill teaches, so a low score can't
   tell a skill that wasn't loaded from one that gave poor guidance (read `skillsUsed` alongside the judge score).
6. **More hidden acceptance tests.** `reserve-stock` and `night-review` have only the architecture
   tests: their contracts (a warehouse stub, a summary field) need a fixed contract in the task text first.
7. **Pairwise at scale.** `select-best` was checked against the judge on a toy pair only. Restore `rules@HEAD` once the
   rules settle and run `eval-pairwise` in both orders.
8. **Grade how agents test HTTP clients.** Nothing deterministic does yet: the `customer-name` acceptance tests exercise
   the agent's production code, not its tests, and only one judge-rubric line covers the tests. Add an
   `httpTestDoubles` check for `customer-name` and `reserve-stock` that fails tests which mock `HttpClient` (its
   `GetAsync` family isn't virtual, so the setup never intercepts) or `IHttpClientFactory` (only needed by code calling
   `CreateClient`, which `typedHttpClient` already fails), or that call a real `http(s)://` host. It should pass port
   fakes and mocks for service tests, and a stub HTTP server (e.g. WireMock.Net) for adapter tests (TEST-006 forbids a
   mocked `HttpMessageHandler`).

## Rule problems the evals now surface

The 2026-10-16 rule rewrite (to `rule-standard.md`) settles these, each with the rule that now owns it:

- Unit tests with TestContainers vs Moq, and mock-first vs real collaborators: TEST-001 (Khorikov's classical school)
  and TEST-004 and TEST-005 (in-memory fakes without storage rules, Moq only for a port without a fake or for a failure
  path). Measured by
  `get-order-endpoint`, `customer-orders`, `preferRealCollaborators` and `endpointTestsThroughHost`.
- `(Order?)null` in test examples: FUNC-006 and FUNC-010 (`Result<Maybe<T>, Error>` from lookups, no `null` inside)
  (`delivery-note`, `get-order-endpoint`, `noNullInTests`).
- Application exceptions vs `Result`: FUNC-003, FUNC-004 and FUNC-007 (errors are values; adapters catch only named
  infrastructure exceptions) (`reserve-stock`, `noExceptionsInApplication`).
- `Async` suffix vs test names: NET-009 exempts test methods.
- `IClock` vs `TimeProvider`: HEX-010 (`night-review`, `noSystemClock`, `usesTimeProvider`).
- Outbound HTTP: HEX-011 (typed client, standard resilience handler); adapter tests: TEST-006 (WireMock.Net, no
  mocked `HttpClient`) (`customer-name`, `reserve-stock`, `typedHttpClient`, `httpResilience`).
- Production code as the oracle: TEST-001 (Khorikov's anti-pattern of leaking domain knowledge to tests) (`independentExpectations`).
- `tests/` paths vs flat layout: TEST-002 (`src/<Service>.UnitTests` and `src/<Service>.IntegrationTests`).

Still open:

- No task probes TEST-001's tautological-test anti-pattern since `summary-tests` was removed; `independentExpectations`
  runs on every task but nothing tempts the agent to break it.
- HEX-013, DDD-003 to DDD-012 and TEST-005 are graded only by the judge; no deterministic check covers them.

## Compiler-enforced rules

`templates/dotnet/.editorconfig` + `Directory.Build.props` turn the checkable parts of `.claude/rules` into build
errors; copy both into any .NET repo (the analyzers need central package management). Known gaps, still prose-only:

- `String` vs `string` (IDE0049): configured, but not reported at build by SDK 10.0.301; editor only.
- Function length, parameter count, nesting depth, commented-out code, LINQ over loops, `InternalsVisibleTo`:
  no analyzer here (Sonar covers some). Sealed classes are checked by the `orders` architecture tests, and
  `noInternalsVisibleTo` and similar eval checks cover a few others.
- NET-002 to NET-004 tell the agent to keep the build guards, never suppress diagnostics and set them up on greenfield work.

## Things to keep in mind

- The rubrics in `promptfooconfig.yaml` are the yardstick. Change them in a separate commit from rule changes,
  and re-run the baseline after.
- Single runs are noisy. Use `--repeat 5` or more; differences under about 7–15 points are noise at that size,
  and repeats often produce byte-identical code, so confirm a gain with a second eval.
- The global setup (RTK, ponytail, CLAUDE.md and its imports, skills, agents, commands, plugin contents) is
  deliberately part of the `rules@*` variants (and `env` when restored). If it changes, the fingerprint changes and the baseline must be re-run.
