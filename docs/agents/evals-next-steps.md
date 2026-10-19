# Evals: next steps

The eval harness in `evals/` (see `evals/README.md`) runs Claude Code headless against a .NET fixture
for each variant (`none`, `rules@WORKTREE`) and grades the result with deterministic
checks, hidden acceptance tests and a local `claude -p` judge. Everything stays local; promptfoo telemetry and sharing are off.

## Current state

- Agent: `claude-sonnet-5-5`. Judge: `claude-opus-5-5`, told to treat the graded diff as untrusted data.
- Two fixtures (`fixtures/orders`, `fixtures/empty`) and twelve tasks: `find-order` (null trap), `place-order-tests`
  (mocks vs TestContainers conflict), `summary-tests` (tautological-test trap, planted mutants), `cancel-order` (realistic feature), `get-order-mocked` (testing.md's `(Order?)null`
  mock vs `Maybe`), `reserve-stock` (adapter errors as exceptions vs Results), `order-limits` (configuration skill,
  hidden HTTP acceptance tests), `add-telemetry` (opentelemetry skill), `night-review` (`DateTime.UtcNow` trap: the
  rules should lead to `TimeProvider`), `customer-name` (typed `HttpClient`, hidden HTTP acceptance tests),
  `get-order-endpoint` (test wiring through the real host, real collaborators over mocks), `greenfield-inventory`
  (new service).
- 37 deterministic checks in `evals/graders/checks.js` (with their own tests, `npm test`), plus one `llm-rubric` per task.
- Hidden acceptance tests in `evals/acceptance/`: NetArchTest architecture tests on every `orders` task, and an HTTP
  contract tests for `order-limits`, `customer-name` and `get-order-endpoint`. The `customer-name` tests stub every `IHttpClientFactory`
  client's primary handler, so code that creates its own `HttpClient` fails them.
- Coverage: the `orders` test projects reference coverlet.collector and coverlet.msbuild; the `coverage` check scores
  the line coverage of the production files the agent changed.
- Ablation (`config.excludeRules`), pairwise judging (`npm run eval-pairwise`), a cross-eval fingerprint guard
  (`npm run report -- <id> <id>` exits 1 on a mismatch) and per-variant turns, tokens, cost and minutes are in place.
- In the first baseline, all rule files together cost ~21.8k tokens per session.
- `rules@HEAD` is removed while the rules are being reworked; compare `rules@WORKTREE` against the baseline eval.
  `env` (global setup, no repo rules) is removed too; restore it with `{ variant: env }` when needed.
- The checks, judge prompt, fixture analyzers and tasks changed on 2026-10-15; results graded before then, including
  baseline `eval-PHZ-2026-10-15T12:05:05`, aren't comparable.

## Next steps, in order

1. **Re-record the baseline**: `npm run eval-baseline -- --repeat 5`. That is 12 tasks × 2 variants × 5 = 120 agent
   runs; at the last baseline's cost per run, roughly $23 and 1–1.5 hours at concurrency 2.
2. **Run the ablation**: one `rules@WORKTREE` provider per rule file with `excludeRules: [<file>]`, `--repeat 5`.
3. **More skill-triggering tasks.** `order-limits` (configuration) and `add-telemetry` (opentelemetry) grade on
   `skillsUsed`; `find-order` and `place-order-tests` grade on `noSkillsUsed`. Still missing: `ef-core` (needs a
   database adapter in `orders`), `fast-endpoints`, `dependency-injection` and `aspire`. The workflow skills
   (`commit`, `code-review`, `create-pr`, `ralph-prep`, `write-spec`, `write-tickets`, `writing-great-skills`)
   have no tasks either. `none` has no repo skills, so it fails `skillsUsed` by design.
4. **Check the configuration skill's trigger.** In the one `order-limits` smoke run (`rules@WORKTREE`), the agent never
   loaded `configuration` and read the limit with `IConfiguration.GetValue` instead of the Options pattern, failing
   both `skillsUsed` and the judge. One run is a signal, not a result; if the baseline repeats it, the skill's
   description likely misses wording like "configurable per environment".
5. **Skill ablation.** `excludeRules` only drops rule files; `rules@WORKTREE` copies all of `.claude/`, skills included.
   Add an equivalent `excludeSkills` to measure what each skill adds. Until then, skill content is judged only
   indirectly: the `order-limits` and `add-telemetry` rubrics grade what those skills teach, so a low score can't
   tell a skill that wasn't loaded from one that gave poor guidance (read `skillsUsed` alongside the judge score).
6. **More hidden acceptance tests.** Only `order-limits`, `customer-name` and `get-order-endpoint` fix a contract in their task text. `find-order`,
   `cancel-order` and `get-order-mocked` leave method names to the agent, so they can't have contract tests without
   changing their task text, which changes the yardstick.
7. **Pairwise at scale.** `select-best` was checked against the judge on a toy pair only. Restore `rules@HEAD` once the
   rules settle and run `eval-pairwise` in both orders.
8. **Grade how agents test HTTP clients.** Nothing deterministic does yet: the `customer-name` acceptance tests exercise
   the agent's production code, not its tests, and only one judge-rubric line covers the tests. Add an
   `httpTestDoubles` check for `customer-name` and `reserve-stock` that fails tests which mock `HttpClient` (its
   `GetAsync` family isn't virtual, so the setup never intercepts) or `IHttpClientFactory` (only needed by code calling
   `CreateClient`, which `typedHttpClient` already fails), or that call a real `http(s)://` host. It should pass port
   mocks (`Mock<ICustomerDirectory>`) for service tests and a stubbed `HttpMessageHandler` (hand-written, or
   `Moq.Protected` on `SendAsync`) for adapter tests.

## Rule problems the evals now surface

The 2026-10-16 rule rewrite (to `rule-standard.md`) settles these, each with the rule that now owns it:

- Unit tests with TestContainers vs Moq, and mock-first vs real collaborators: TEST-001 (Khorikov's classical school)
  and TEST-004 and TEST-005 (in-memory fakes without storage rules, Moq only for a port without a fake or for a failure
  path). Measured by
  `place-order-tests`, `preferRealCollaborators` and `endpointTestsThroughHost`.
- `(Order?)null` in test examples: FUNC-006 and FUNC-010 (`Result<Maybe<T>, Error>` from lookups, no `null` inside)
  (`get-order-mocked`, `noNullInTests`).
- Application exceptions vs `Result`: FUNC-003, FUNC-004 and FUNC-007 (errors are values; adapters catch only named
  infrastructure exceptions) (`reserve-stock`, `noExceptionsInApplication`).
- `Async` suffix vs test names: NET-009 exempts test methods.
- `IClock` vs `TimeProvider`: HEX-010 (`night-review`, `noSystemClock`, `usesTimeProvider`).
- Outbound HTTP: HEX-011 (typed client, standard resilience handler); adapter tests: TEST-006 (WireMock.Net, no
  mocked `HttpClient`) (`customer-name`, `reserve-stock`, `typedHttpClient`, `httpResilience`).
- Production code as the oracle: TEST-001 (Khorikov's anti-pattern of leaking domain knowledge to tests) (`independentExpectations`,
  `killsPlantedMutants`).
- `tests/` paths vs flat layout: TEST-002 (`src/<Service>.UnitTests` and `src/<Service>.IntegrationTests`).

Still open:

- `place-order-tests` can't apply "real collaborators first": `InMemoryOrderRepository` has only `AddAsync`, so a test
  can't observe through it that the order was persisted, short of adding a speculative lookup. Its rubric still accepts
  Moq or the in-memory adapter. Giving the fixture's adapter a lookup would change every `orders` task, so it waits for
  a deliberate yardstick change.
- The rewrite adds stances no check grades yet: `ErrorKind` mapped to ProblemDetails (HEX-013), state-per-type with
  `Match` (DDD-008 to DDD-010), constrained types (DDD-003, DDD-004), fakes without storage rules (TEST-005). Review the
  rubrics against them in a separate commit before the next baseline.

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
