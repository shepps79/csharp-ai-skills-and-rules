---
description: Test stack, test doubles, layout and test style
alwaysApply: true
---
# Testing

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Styles
- **TEST-001** MUST use xUnit v3, AwesomeAssertions, Moq, Testcontainers, WireMock.Net, `FakeTimeProvider`,
  `WebApplicationFactory` and coverlet. MUST NOT use xUnit `Assert.*` — one assertion style for all tests.

## Rules
- **TEST-002** MUST put all tests of a service in one project, `src/<Service>.Tests/`, with the folders `Domain/`,
  `Application/`, `Infrastructure/`, `Presentation/` and `Fakes/`. MUST NOT make a `tests/` directory — fakes and
  contract tests then share one project.
- **TEST-003** MUST mark each test that starts a container or a WireMock server with
  `[Trait("Category", "Integration")]` — `dotnet test --filter` can then run the fast tests alone.
- **TEST-004** MUST name a test `Method_ExpectedBehavior_Scenario`. Omit the scenario when there is no condition.
- **TEST-005** MUST get expected values independently of the code under test (literals or values calculated by hand),
  instead of DESIGN-001's no duplication. MUST NOT call the production formula or mapper to make the expected value —
  a test that uses the code as its oracle cannot fail when the code is wrong. Arrange data can use private helpers or
  builders.
- **TEST-006** MUST test only through the public API. MUST NOT use `InternalsVisibleTo` or make a member more visible
  for a test — a member that a test cannot reach is a design signal.
- **TEST-007** MUST use the real class for each dependency that is not an outbound port (domain types, services,
  mappers) — a mock of your own class tests the mock.
- **TEST-008** MUST replace an outbound port with its in-memory fake when one exists. Use Moq only for a port that has
  no fake, or to force a failure path. Add a fake when two or more test classes need the port — a fake lets the
  test read the result back through the port.
- **TEST-009** MUST put fakes in `Fakes/` with the name `InMemory<Port name without I>`, and give each faked port an
  abstract contract test class that runs against the fake and the real adapter — the contract keeps the fake honest.
- **TEST-010** MUST test Infrastructure adapters against real infrastructure: databases with Testcontainers, HTTP APIs
  with WireMock.Net (success, 404 to `Maybe.None`, 4xx to `Validation` or `Conflict`, 5xx and timeout to
  `Unavailable`). MUST NOT mock `HttpClient`, `HttpMessageHandler` or `IHttpClientFactory` — a mock does not test
  the serialization or the resilience pipeline.
- **TEST-011** MUST test endpoints through `WebApplicationFactory<Program>` with the real host and the real use cases.
  Replace only ports with fakes, in `ConfigureTestServices`. Assert the status code and the typed body, and one
  status for each `ErrorKind` that the endpoint returns.
- **TEST-012** MUST control time with `FakeTimeProvider`. MUST NOT use `Thread.Sleep` or `Task.Delay` to wait for
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
- **TEST-020** MUST reference `coverlet.collector` and `coverlet.msbuild`, and keep line coverage at 80% or more
  (`dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line`).

## Examples
A fake and its contract (the Testcontainers adapter test also derives from `OrderRepositoryContract`):

```csharp
public abstract class OrderRepositoryContract
{
    [Fact]
    public async Task FindPendingAsync_ReturnsSavedOrder_WhenOrderIsPending()
    {
        // Arrange
        var repository = CreateRepository();
        var order = NewPendingOrder();
        await repository.SaveAsync(order, TestContext.Current.CancellationToken);

        // Act
        var result = await repository.FindPendingAsync(order.Id, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.HasValue.Should().BeTrue();
        result.Value.Value.Id.Should().Be(order.Id);
    }

    protected abstract IOrderRepository CreateRepository();

    private static PendingOrder NewPendingOrder() =>
        PendingOrder.Create(OrderId.Create(Guid.NewGuid()).Value, [OrderLine.Create("SKU-001", 2).Value]).Value;
}

public sealed class InMemoryOrderRepositoryTests : OrderRepositoryContract
{
    protected override IOrderRepository CreateRepository() => new InMemoryOrderRepository();
}
```
