# Evals: next steps

The eval harness in `evals/` (see `evals/README.md`) runs Claude Code headless against a .NET fixture
for each variant (`none`, `rules@WORKTREE`) and grades the result with deterministic
checks, hidden acceptance tests and a local `claude -p` judge. Everything stays local; promptfoo telemetry and sharing are off.

## Current state (2026-10-20)

- Agent: `claude-sonnet-5-5`. Judge: `claude-opus-5-5`, told to treat the graded diff as untrusted data.
- Two fixtures (`fixtures/orders`, `fixtures/empty`) and nine tasks, each with one intent in its description:
  `delivery-note` (an optional value is a `Maybe`; `string?` trap), `get-order-endpoint` (absence is `NotFound`;
  endpoint tests through the real host), `customer-orders` (a sequence stays on the railway; fakes find by key),
  `cancel-order` (a type per lifecycle state), `reserve-stock` (adapter failures as Results; exception trap),
  `customer-name` (typed `HttpClient` tested against a stub server), `order-limits` (Options pattern), `night-review`
  (`DateTime.UtcNow` trap: the rules should lead to `TimeProvider`), `greenfield-inventory` (new service). Each task
  that changes storage states an HTTP contract, so TEST-007's endpoint tests can cover the adapter and the TEST-011
  gate can pass.
- 40 deterministic checks in `evals/graders/checks.js` (with their own tests, `npm test`), plus one `llm-rubric` per task.
- Hidden acceptance tests in `evals/acceptance/`: NetArchTest architecture tests on every `orders` task, and HTTP
  contract tests for every task whose text fixes one: `delivery-note`, `get-order-endpoint`, `customer-orders`,
  `cancel-order`, `customer-name` and `order-limits`. The `customer-name` tests stub every `IHttpClientFactory`
  client's primary handler, so code that creates its own `HttpClient` fails them.
- Ablation (`config.excludeRules`), pairwise judging (`npm run eval-pairwise`), a cross-eval fingerprint guard
  (`npm run report -- <id> <id>` exits 1 on a mismatch) and per-variant turns, tokens, cost and minutes are in place.
- The repo ships rules only. Every C# skill was removed: each repeated what the model already knows, and most taught
  against the rules. `rules@WORKTREE` keeps the two workflow skills (`commit`, `code-review`) out with `skills: []`.
- The 8 rule files cost ~11.2k tokens per session (`/context`, 2026-10-20).
- No eval has run against the current tasks. The two evals in `evals/.promptfoo` are smoke runs from before the
  2026-10-20 rewrite of the tasks, rubrics, checks and judge prompt, so they aren't comparable.

## Next steps, in order

1. **Record the baseline**: `npm run eval-baseline -- --repeat 5`. That is 9 tasks × 2 variants × 5 = 90 agent
   runs; at the last baseline's cost per run, roughly $17 and 1–1.5 hours at concurrency 2.
2. **Run the ablation**: one `rules@WORKTREE` provider per rule file with `excludeRules: [<file>]`, `--repeat 5`.
   A file whose removal changes nothing is dead weight or ignored.
3. **Grade how agents test HTTP clients.** Nothing deterministic does yet: the `customer-name` acceptance tests exercise
   the agent's production code, not its tests, and only one judge-rubric line covers the tests. Add an
   `httpTestDoubles` check for `customer-name` and `reserve-stock` that fails tests which mock `HttpClient` (its
   `GetAsync` family isn't virtual, so the setup never intercepts) or `IHttpClientFactory` (only needed by code calling
   `CreateClient`, which `typedHttpClient` already fails), or that call a real `http(s)://` host. It should pass port
   fakes and mocks for service tests, and a stub HTTP server (e.g. WireMock.Net) for adapter tests (TEST-006 forbids a
   mocked `HttpMessageHandler`).
4. **More hidden acceptance tests.** `reserve-stock` and `night-review` have only the architecture tests: their
   contracts (a warehouse stub, a summary field) need a fixed contract in the task text first.
5. **Pairwise at scale.** `select-best` was checked against the judge on a toy pair only. Restore `rules@HEAD` once the
   rules settle and run `eval-pairwise` in both orders.

## Known gaps

- No task tempts TEST-001's tautological-test anti-pattern since `summary-tests` was removed; `independentExpectations`
  runs on every task but nothing tempts the agent to break it.
- HEX-012, DDD-003 to DDD-012 and TEST-005 are graded only by the judge; no deterministic check covers them.
- `templates/dotnet/.editorconfig` and `Directory.Build.props` turn the checkable rules into build errors, but some stay
  prose-only:
  - `String` vs `string` (IDE0049): configured, but not reported at build by SDK 10.0.301; editor only.
  - Function length, parameter count, nesting depth, commented-out code, LINQ over loops, `InternalsVisibleTo`: no
    analyzer here (Sonar covers some). Sealed classes are checked by the `orders` architecture tests, and
    `noInternalsVisibleTo` and similar eval checks cover a few others.

## Things to keep in mind

- The rubrics in `promptfooconfig.yaml` are the yardstick. Change them in a separate commit from rule changes,
  and re-run the baseline after.
- Single runs are noisy. Use `--repeat 5` or more; differences under about 7–15 points are noise at that size,
  and repeats often produce byte-identical code, so confirm a gain with a second eval.
- `rules@HEAD` (a same-run control) and `env` (global setup, no repo rules) are commented out of the providers;
  restore them with `{ variant: rules, rulesRef: HEAD }` and `{ variant: env }`.
- The global setup (RTK, ponytail, CLAUDE.md and its imports, skills, agents, commands, plugin contents) is
  deliberately part of the `rules@*` variants (and `env` when restored). If it changes, the fingerprint changes and
  the baseline must be re-run.
