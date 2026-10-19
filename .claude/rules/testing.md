---
description: Test stack, test doubles, layout and test style
alwaysApply: true
---
# Testing

## Rules
- **TEST-002** MUST put the tests of a service in two projects: `src/<Service>.UnitTests/` (folders `Domain/`,
  `Application/`, `Api/` and `Fakes/`) for each test that runs in memory, and `src/<Service>.IntegrationTests/`
  (folders `Infrastructure/` and `Api/`) for each test that starts a local container or stub server. MUST NOT make a
  `tests/` directory — the fast tests then run without Docker.
- **TEST-004** MUST name a test `Method_ExpectedBehavior_Scenario`. Omit the scenario when there is no condition.
- **TEST-005** MUST get expected values independently of the code under test (literals or values calculated by hand),
  instead of DESIGN-001's no duplication. MUST NOT call the production formula or mapper to make the expected value —
  a test that uses the code as its oracle cannot fail when the code is wrong. Arrange data can use private helpers or
  builders.
- **TEST-006** MUST test only through the public API. MUST NOT use `InternalsVisibleTo` or make a member more visible
  for a test — a member that a test cannot reach is a design signal.
- **TEST-007** MUST use the real class for each dependency that is not an outbound port (domain types, services,
  mappers) — a mock of your own class tests the mock.
- **TEST-008** MUST replace an outbound port with its in-memory fake when one exists. Use a mock only for a port that has
  no fake, or to force a failure path. Add a fake when two or more test classes need the port — a fake lets the
  test read the result back through the port.
- **TEST-009** MUST put fakes in `Fakes/` with the name `InMemory<Port name without I>`, and give each faked port an
  abstract contract test class in `Fakes/`. It runs against the fake in UnitTests and against the real adapter in
  IntegrationTests, which references UnitTests — the contract keeps the fake honest.
- **TEST-010** MUST test Infrastructure adapters against real infrastructure that runs locally, never a cloud service:
  databases in a container, HTTP APIs against a stub HTTP server (success, 404 to `Maybe.None`, 4xx to `Validation` or `Conflict`, 5xx and timeout to
  `Unavailable`). MUST NOT mock `HttpClient`, `HttpMessageHandler` or `IHttpClientFactory` — a mock does not test
  the serialization or the resilience pipeline.
- **TEST-011** MUST test endpoints through `WebApplicationFactory<Program>` with the real host and the real use cases.
  In UnitTests, replace only ports with fakes, in `ConfigureTestServices`, and assert the status code, the typed body
  and one status for each `ErrorKind` that the endpoint returns. In IntegrationTests, replace nothing and point the
  adapters at the local containers — only the full path shows that the wiring and the storage work together.
- **TEST-012** MUST control time with a fake `TimeProvider`. MUST NOT use `Thread.Sleep` or `Task.Delay` to wait for
  time — real time makes tests slow and flaky.
- **TEST-013** MUST pass `TestContext.Current.CancellationToken` to each async call.
- **TEST-014** MUST assert a `Result` with `IsSuccess` or `IsFailure`, and a `Maybe` with `HasValue` or `HasNoValue`,
  before it reads `Value` or `Error`. FUNC-008 does not
  apply in tests — the assertion fails before the access.
- **TEST-015** MUST NOT put `if`, `switch` or loops in a test — logic in a test needs its own test.
- **TEST-016** MUST NOT assert on logging, on `ToString()` output or on calls to your own classes. Use `Verify` only on
  an outbound port that has no state to read — assert outcomes, not steps.
- **TEST-017** MUST keep tests independent of each other and of run order. Share only expensive setup that tests do
  not change (a container) through `IClassFixture<T>` or `ICollectionFixture<T>`.
- **TEST-018** MUST make test classes `sealed` (a contract base is `abstract`), set up in the constructor, and build
  `_sut` last. Put private helpers after the tests.
- **TEST-019** SHOULD mark `// Arrange`, `// Act` and `// Assert` in a test, unless e.g. the test is three lines or
  fewer.
- **TEST-020** MUST keep line coverage at 80% or more: UnitTests over each layer except Infrastructure, IntegrationTests
  over Infrastructure. In a new solution, make `dotnet test` fail below it in `Directory.Build.targets` — a gate that
  the build runs is not skipped.

## Examples
A contract, the fake that runs it in UnitTests and the real adapter that runs it in IntegrationTests. Each call to
`CreateRepository` in one test must reach the same store:

```csharp
// src/Orders.UnitTests/Fakes/OrderRepositoryContract.cs
public abstract class OrderRepositoryContract
{
    [Fact]
    public async Task FindPendingAsync_ReturnsSavedOrder_WhenOrderIsPending()
    {
        // Arrange
        var order = NewPendingOrder();
        await CreateRepository().SaveAsync(order, TestContext.Current.CancellationToken);

        // Act
        var result = await CreateRepository().FindPendingAsync(order.Id, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.HasValue.Should().BeTrue();
        result.Value.Value.Id.Should().Be(order.Id);
    }

    /// <summary>Returns a repository over the one store that all calls in a test share.</summary>
    protected abstract IOrderRepository CreateRepository();

    private static PendingOrder NewPendingOrder() =>
        PendingOrder.Create(OrderId.Create(Guid.NewGuid()).Value, [OrderLine.Create("SKU-001", 2).Value]).Value;
}

// src/Orders.UnitTests/Fakes/InMemoryOrderRepositoryTests.cs
public sealed class InMemoryOrderRepositoryTests : OrderRepositoryContract
{
    private readonly InMemoryOrderRepository _repository = new();

    protected override IOrderRepository CreateRepository() => _repository;
}

// src/Orders.IntegrationTests/Infrastructure/PostgresOrderRepositoryTests.cs
[Collection(nameof(PostgresDatabase))]
public sealed class PostgresOrderRepositoryTests(PostgresDatabase database) : OrderRepositoryContract
{
    protected override IOrderRepository CreateRepository() => new PostgresOrderRepository(database.CreateContext());
}
```
