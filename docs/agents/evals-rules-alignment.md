# Evals: graders and tasks against the rules and skills (2026-10-20)

I checked the 9 tasks and rubrics in `evals/promptfooconfig.yaml`, the checks in `evals/graders/checks.js`, the hidden
tests in `evals/acceptance/`, the judge, and the fixtures' `AGENTS.md`, `.editorconfig` and `Directory.Build.targets`
against the 8 files in `.claude/rules/` and the skills in `.claude/skills/`. I ran each suspected false positive and
false negative through the same git-staged harness that `checks.test.js` uses; "confirmed" below means I ran it.
`npm test` passes.

The harness is in good shape. Each task has one intent. The rubrics state where the rules depart from the books they
cite. The acceptance tests fix the HTTP contract each task states. The fixture's `AGENTS.md` names the libraries that
rubrics ask for (AwesomeAssertions, Moq, WireMock.Net, coverlet), so those rubric points have a source. The findings
below are the gaps between the yardstick and the rules.

## Summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | Critical | Three repo skills teach the opposite of the rules, and `rules@WORKTREE` ships them next to the rules. |
| 2 | Major | Five checks fail code that follows the rules (confirmed). Two of them run on every or most tasks. |
| 3 | Major | Checks that cover a global rule are cheap and reliable, but some run on only 1 to 5 of the 9 tasks. |
| 4 | Major | Some rules that the tasks are designed to tempt have no deterministic check (confirmed). |
| 5 | Minor | 5 places where a rubric and a rule disagree, or where the rules pull in two directions. |

## 1. Skills that contradict the rules (Critical)

`rules@WORKTREE` copies all of `.claude/`, skills included. So whenever a conflicting skill loads, the variant measures
rules plus that skill. The `ef-core` skill triggers on "database", "migration" and "EF Core". `delivery-note`,
`cancel-order`, `customer-orders` and `greenfield-inventory` all add a migration, and the fixture's runbook names
`dotnet ef migrations`. The `fast-endpoints` skill triggers on "Creating new API endpoints with request/response DTOs",
which is the work in `get-order-endpoint`, `customer-orders`, `cancel-order` and `greenfield-inventory`. Only
`order-limits` grades `skillsUsed`, so a run where the agent loaded one of these skills and then broke a rule looks
the same as a run where the rules failed.

| Skill | What it teaches | Rules it breaks |
|-------|-----------------|-----------------|
| `ef-core` | "Don't Wrap DbContext in a Repository … use DbContext directly in handlers" | HEX-003 (repository port in Application), HEX-007, FUNC-002 |
| `ef-core` | `Task<Order?>` / `Task<OrderResponse?>` with `FirstOrDefaultAsync` | FUNC-006, FUNC-010 |
| `ef-core` | `PagedList<T>` built from `ToListAsync`; unsealed `public class` | FUNC-014, NET-011 |
| `dependency-injection` | "Register interfaces … `AddScoped<IOrderService, OrderService>()`" | HEX-004 (no interface over the inbound service) |
| `dependency-injection` | `Task<Result<Order>>`; a service that returns the domain `Order` | FUNC-005, HEX-005 |
| `dependency-injection` | `if (result.IsSuccess) … result.Value` without braces | FUNC-008, NET-006 |
| `dependency-injection` | `_ => throw new InvalidOperationException(...)`; `OrderService(AppDbContext db, …)` | CS14-009, HEX-003 |
| `fast-endpoints` | The whole skill: `AddFastEndpoints`, REPR endpoints, FluentValidation `Validator<T>` | HEX-011 (minimal APIs), DDD-006 (parse in the use case) |
| `configuration` | Mostly agrees with NET-022 (good, as it's the one graded skill). Small slips: unsealed options classes, `config["…"]!`, `if` without braces | NET-011, FUNC-011, NET-006 |

**Fix.** Rewrite `ef-core` and `dependency-injection` so they agree with the rules, or delete them. Delete
`fast-endpoints`: the rules have already chosen minimal APIs. Until then, the eval variants keep only the
`configuration` skill (`config.skills` in `promptfooconfig.yaml`); add a skill back to that list once it agrees with the
rules and has a task.

## 2. Checks that fail compliant code (Major, confirmed)

| Check | Runs on | Compliant code it fails | Rule | Fix |
|-------|---------|-------------------------|------|-----|
| `independentExpectations` | every task | `result.Error.Should().Be(Error.NotFound("No order 1."))`. Any `<ProductionType>.<Method>(` in an expected value counts as "computed by production code", including a factory over a literal. | TEST-001 asks for literal expected values. TEST-010 lets helpers read `.Value` of values built from literals. | Allow a call when all of its arguments are literals, or exempt `Error.*`. |
| `noNullForAbsence` | 5 tasks | `static string? ToColumn(Maybe<Note> note)` in Infrastructure, and `=> null` in an Api JSON converter. The `delivery-note` rubric itself asks Infrastructure to map the `Maybe` to a nullable column. | FUNC-010 covers only Application and Domain, and allows `T?` at the edge. | Check only files under `.Domain/` and `.Application/`. |
| `endpointTestsThroughHost` | 3 tasks | `connectionString.Replace("x", "y")` in an IntegrationTests file. `\.Replace\(` matches `string.Replace`. | TEST-007 | Match `services.Replace(`, `ServiceDescriptor` or `RemoveAll<` only. |
| `noNullInTests` | 2 tasks | `body.GetProperty("deliveryNote").GetString().Should().BeNull()`, which checks the wire `null` that the `delivery-note` task asks for. | FUNC-010 allows `null` at the edge. | Leave out `.Should().BeNull()`, or exempt `JsonElement` reads. |
| `noUncheckedResultAccess` | every task | `notes.Count(m => m.HasValue)`. FUNC-008 bans reading `HasValue` and then `.Value`, not reading `HasValue` alone. | FUNC-008 | Low impact. Either accept it as stricter than the rule and say so in the check's comment, or flag only a read that a `.Value`/`.Error` follows. |

`noThrowInDomain` is also stricter than FUNC-004. FUNC-004 allows a throw for a programmer error or a broken
invariant, but the check exempts only `UnreachableException`. A `throw new ArgumentOutOfRangeException` for a broken
invariant fails it. This is low impact.

## 3. Global rules checked on only some tasks (Major)

These checks are cheap and rarely flag compliant code, but each runs on only some tasks:

| Check | Rule | Runs on | Missing from |
|-------|------|---------|--------------|
| `noSystemClock` | HEX-009 | night-review | all others. `cancel-order` (a `CancelledAt`) and `greenfield-inventory` are likely places for `DateTime.UtcNow` to slip in. |
| `noExceptionsInApplication` | FUNC-003, FUNC-004 | reserve-stock, customer-name | the other 7 |
| `noThrowInDomain` | FUNC-004 | 4 tasks | delivery-note, get-order-endpoint, customer-orders, customer-name, night-review |
| `endpointTestsThroughHost` | TEST-007 | 3 tasks | delivery-note, order-limits, customer-name, greenfield (route `/`). Each of these changes an endpoint. |
| `preferRealCollaborators` | TEST-004 | 3 tasks | delivery-note, order-limits, night-review. Each of these touches `IOrderRepository` tests. |
| `noNullForAbsence` (after the scope fix in §2) | FUNC-010 | 5 tasks | the other 4 |

**Fix.** Move them to `defaultTest`. They only look at changed files, so they cost nothing on tasks that don't tempt
them.

## 4. Tempted rules with no deterministic check (Major, confirmed)

Each of these passes every check today, although it breaks a rule that a task is built around:

- **FUNC-007 `catch (Exception)` in an adapter.** This is the trap in `reserve-stock` and `customer-name`, and only the
  judge grades it. `noExceptionsInApplication` looks only at Application. Add an Infrastructure check for
  `catch\s*\(\s*(System\.)?Exception\b` and for a bare `catch\s*\{`.
- **TEST-006, a hand-written `HttpMessageHandler` stub or `Substitute.For<HttpMessageHandler>()`.**
  `mocksOnlyPorts` sees only Moq's `Mock<T>`. This is next-steps #8: fail a test class that derives from
  `HttpMessageHandler`, or any mocking library's double of `HttpClient`, `HttpMessageHandler` or `IHttpClientFactory`.
- **HEX-004, `IOrderService`.** `noUseCaseInterfaces` matches only `I…UseCase`, which misses the
  `I<Aggregate>Service` that the `dependency-injection` skill teaches. Also flag an Application interface that a
  `*Service` class implements.
- **FUNC-011, null-forgiving `!`.** No analyzer catches it. Something like `(?<=[\w)\]])!(?=[.;,)\]])` on production
  code would catch the common cases without matching `!=`.
- **FUNC-014, `List<T>` in a public Application or Domain signature.** `customer-orders` is built to tempt it, and only
  the judge grades it.
- **TEST-005, a fake that is not in `Fakes/InMemory<Port>`.** `reserve-stock` and `customer-name` grade it only in the
  rubric.
- **DDD-010, `is XOrder` / `case XOrder` outside the file that holds `Match`.** `cancel-order` grades it only in the
  rubric.
- **TEST-003, test names.** The `.editorconfig` allows underscores in test names but doesn't enforce the template. A
  regex over `[Fact]`/`[Theory]` method names (`^[A-Z]\w*_[A-Z]\w*(_[A-Z]\w*)?$`) would cover it.

The build already enforces NET-005, NET-006, NET-007, NET-011 (internal classes), NET-012, NET-017, NET-018 (VSTHRD002,
VSTHRD100), CLEAN-005, CS14-004, CS14-009 (IDE0010, IDE0072), CS14-010 and TEST-009 (xUnit1051), so these need no
check. Nothing measures CLEAN-002 (CA1502 limits complexity, not length), CLEAN-003, CLEAN-004 or CLEAN-008. The
next-steps doc already lists these gaps.

## 5. Rubric and rule mismatches (Minor)

- **`customer-orders` accepts `IReadOnlyList`.** The rubric allows `Result<ImmutableArray<OrderSummary>, Error>`
  "(or IReadOnlyList)". FUNC-006 says a use case MUST return `ImmutableArray<T>`. FUNC-014 says a collection may be
  exposed as `IReadOnlyList<T>`. The rules conflict, and the rubric picks FUNC-014. Settle it in the rules (FUNC-006
  is the more specific rule), then make the rubric match.
- **`order-limits` always requires startup validation.** NET-022 requires `.ValidateDataAnnotations().ValidateOnStart()`
  only "when the options class has data annotations". The `configuration` skill says to validate always. Make the
  rule and the rubric agree.
- **Timeout tests vs TEST-008.** The `reserve-stock` and `customer-name` rubrics require an adapter test for a timeout
  against a stub server. With the defaults of `AddStandardResilienceHandler` (a 10 s attempt timeout, a 30 s total
  timeout, retries), that test waits real time, unless the test host shortens the resilience options. TEST-008 bans
  waiting for real time, and no rule says how to test a timeout. Add a line to TEST-006 (for example, "shorten the
  resilience timeouts in the test host"), or drop "timeout" from both rubrics.
- **`customer-name` grades points that no rule states.** "Responses are disposed" and "no HttpClient held in a
  singleton" are good practice, but no rule teaches either of them, so the rules can't move that score. Add them to
  HEX-010, or drop them from the rubric.
- **`night-review` has no HTTP contract.** The task is phrased at `OrderService`, doesn't fix the field names, and
  doesn't say whether to store the placed-at time. The rubric doesn't say either. This contradicts the next-steps claim
  that "each task that changes storage states an HTTP contract", and it is why the task has no acceptance tests.

## Suggested order

1. Fix or remove the conflicting skills (§1). Each later baseline depends on this.
2. Fix the scope of the five checks in §2, with a compliant case for each in `checks.test.js`.
3. Move the checks in §3 to `defaultTest`, and add the checks in §4, starting with FUNC-007 and TEST-006.
4. Settle FUNC-006 vs FUNC-014 and NET-022, then make the rubrics in §5 match. Change the rubrics in a separate commit
   from the rule changes.
5. Re-record the baseline. Grader, rubric and skill changes all make earlier results not comparable.
