---
description: Test stack, test doubles, layout and test style
alwaysApply: true
---
# Testing

## Styles
- **TEST-001** MUST apply Vladimir Khorikov's *Unit Testing Principles, Practices, and Patterns*: the four pillars of
  a good test, the classical school, tests of observable behaviour instead of implementation details, output-based
  over state-based over communication-based tests, mocks only for unmanaged dependencies, the AAA pattern with its
  sections separated by blank lines, private factory methods for arrange code that more than one test repeats, and its
  unit testing anti-patterns. Write expected values as literals, instead of DESIGN-001's no duplication — a test that
  gets its expected value from the production code leaks domain knowledge and cannot fail when the code is wrong.

## Rules
- **TEST-002** MUST put the tests of a service in two projects: `src/<Service>.UnitTests/` (folders `Domain/`,
  `Application/`, `Api/` and `Fakes/`) for each test that runs in memory, and `src/<Service>.IntegrationTests/`
  (folders `Infrastructure/` and `Api/`) for each test that starts a local container or stub server. MUST NOT make a
  `tests/` directory — the fast tests then run without Docker.
- **TEST-003** MUST name a test `Method_ExpectedBehavior_Scenario` instead of Khorikov's plain-English sentences. Omit
  the scenario when there is no condition — one template is easy to check.
- **TEST-004** MUST replace an outbound port with its in-memory fake when one exists, instead of Khorikov's real
  database for a managed dependency. Use a mock for a port that has no fake, or to force a failure path, instead of
  Khorikov's mocks only for unmanaged dependencies. Add a fake when two or more test classes need the port — the unit
  tests then run without Docker.
- **TEST-005** MUST put each fake, of any port (HTTP client ports too), in `Fakes/` with the name
  `InMemory<Port name without I>`. A fake does only what each method's signature names: store, find by the key that
  it takes (`FindByCustomerAsync` finds by customer), and select the state type that a method returns through `Match`
  (DDD-010). MUST NOT give a fake the storage rules that only real storage shows (unique keys, ordering, global query
  filters) — IntegrationTests check storage.
- **TEST-006** MUST test an HTTP client adapter in `Infrastructure/` against a stub HTTP server: success, 404 to
  `Maybe.None`, 4xx to `Validation` or `Conflict`, 5xx and timeout to `Unavailable`. MUST NOT mock `HttpClient`,
  `HttpMessageHandler` or `IHttpClientFactory` — a mock does not test the serialization or the resilience pipeline.
- **TEST-007** MUST test endpoints through `WebApplicationFactory<Program>` with the real host and the real use cases.
  In UnitTests, replace only ports with fakes, as singletons in `ConfigureTestServices` (a fake keeps its state across
  requests), and assert the status code, the typed body and one status for each `ErrorKind` that the endpoint
  returns. In IntegrationTests, replace nothing, point the adapters at local containers and stub servers (never a
  cloud service), and test one happy path for each endpoint plus each case that only real infrastructure shows. Test a
  repository only through these endpoint tests — cases that the fakes already cover give no new signal.
- **TEST-008** MUST control time with a fake `TimeProvider`. MUST NOT use `Thread.Sleep` or `Task.Delay` to wait for
  time — real time makes tests slow and flaky.
- **TEST-009** MUST pass `TestContext.Current.CancellationToken` to each async call.
- **TEST-010** MUST assert a `Result` with `IsSuccess` or `IsFailure`, and a `Maybe` with `HasValue` or `HasNoValue`,
  before it reads `Value` or `Error` — the assertion fails before the access. Arrange helpers can read `.Value` of
  values built from valid literals.
- **TEST-011** MUST keep line coverage at 80% or more, instead of Khorikov's use of coverage only as an indicator:
  UnitTests over each layer except Infrastructure, IntegrationTests over Infrastructure. In a new solution, make
  `dotnet test` fail below it in `Directory.Build.targets` — a gate that the build runs is not skipped.
