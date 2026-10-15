# Testing Rules

## Test Framework Stack

**Applies to**: All backend microservice projects

| Tool | Purpose |
|---|---|
| **xUnit (v3)** | Test framework |
| **AwesomeAssertions** | Readable assertion syntax (`.Should()`) |
| **Moq** | Mocking dependencies (ports/interfaces) |
| **TestContainers** | Real infrastructure in integration tests |
| **WebApplicationFactory** | Integration tests for Presentation-layer (minimal API) endpoints |
| **coverlet.collector** | Line and branch coverage with `dotnet test --collect "XPlat Code Coverage"` |
| **coverlet.msbuild** | Coverage thresholds that fail the test run (`/p:CollectCoverage=true /p:Threshold=80`) |

Every test project references both coverlet packages (versions in `Directory.Packages.props`).

## Test Only Public Interfaces

**Applies to**: All test projects

- Never use `[assembly: InternalsVisibleTo(...)]` (or `<InternalsVisibleTo>` in a `.csproj`) to expose internal types to test projects. Test projects get no access to internal members.
- Tests exercise the public API only. If something feels untestable without reaching internals, that is a design signal — make it public because it's genuinely part of the contract, or test it indirectly through the public surface that uses it. Do not widen visibility for tests.

## Test Naming

**Applies to**: All C# test methods
**Rule**: `MethodBeingTested_ExpectedBehavior_Scenario` — method name, then the outcome, then the condition that produces it. Drop the scenario segment when the test has no branching condition worth naming.

- Example: `PlaceOrderAsync_ReturnsSuccess_WhenRequestIsValid`, `IsValidEmail_ReturnsExpected`, `GetOrderAsync_ReturnsNull_WhenNotFound`

## Test Structure

**Applies to**: All test files

- Test class mirrors production class name with `Tests` suffix (e.g., `OrderServiceTests`), declared `sealed`.
- Constructor-based setup (not `[SetUp]`), mocks as private readonly fields, `_sut` built last in the constructor.
- Use `// Arrange`, `// Act`, `// Assert` comments in non-trivial tests. Simple tests may omit these comments if the structure is clear.
- Do NOT add section separator comments (e.g., `// ── Get ───────...`); group related tests by proximity only.
- Prefer AwesomeAssertions (`.Should().`) for assertions; xUnit `Assert.*` also acceptable.
- Theory data: use `[InlineData]`, `[MemberData]` with `TheoryDataRow<T>`.
- Helper/factory methods for test data are private and placed after public test methods.
- When updating existing code, ensure added private methods appear after all public methods, and new public methods appear before private methods.
- Test private methods indirectly through public methods; don't test implementation details.
- Avoid logic (no `if`, `while`, `switch`) in tests.
- Async test methods must pass `TestContext.Current.CancellationToken` instead of `CancellationToken.None`.
- DO NOT create special constructors just for testing purposes.
- One logical assertion group per test (multiple `Should()` on related properties is fine); don't cram unrelated assertions into one test.
- Use `IClassFixture<T>` for state shared across tests in one class, `ICollectionFixture<T>` for state shared across multiple classes.
- Tests must be independent and able to run in any order — no test should depend on another test's side effects.

## Unit Tests

```csharp
public sealed class OrderServiceTests
{
    private readonly Mock<IOrderRepository> _repository = new();
    private readonly OrderService _sut;

    public OrderServiceTests()
    {
        _sut = new OrderService(_repository.Object);
    }

    [Fact]
    public async Task PlaceOrderAsync_ReturnsConfirmedOrder_WhenRequestIsValid()
    {
        // Arrange
        var request = new CreateOrderRequest("cust-123", [new OrderItem("SKU-001", 2, 29.99m)]);

        // Act
        var result = await _sut.PlaceOrderAsync(request, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(OrderStatus.Confirmed);
        result.CustomerId.Should().Be("cust-123");
    }

    [Fact]
    public async Task PlaceOrderAsync_ReturnsFailure_WhenNoItems()
    {
        // Arrange
        var request = new CreateOrderRequest("cust-123", []);

        // Act
        var result = await _sut.PlaceOrderAsync(request, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("at least one item");
    }
}
```

### Theory / Parameterized Tests

Use `[Theory]` with `[InlineData]` for small boundary/equivalence sets, `[MemberData]` with `TheoryDataRow<T>` for larger or reusable sets:

```csharp
[Theory]
[InlineData(null, false)]
[InlineData("", false)]
[InlineData("user@example.com", true)]
[InlineData("user+tag@example.co.uk", true)]
public void IsValidEmail_ReturnsExpected(string? email, bool expected)
{
    EmailValidator.IsValid(email).Should().Be(expected);
}

public static IEnumerable<TheoryDataRow<CreateOrderRequest, string>> InvalidOrderCases =>
[
    new(new CreateOrderRequest("", [ValidItem()]), "CustomerId"),
    new(new CreateOrderRequest("c1", []), "at least one item"),
];

[Theory]
[MemberData(nameof(InvalidOrderCases))]
public async Task PlaceOrderAsync_ReturnsFailure_WhenRequestIsInvalid(CreateOrderRequest request, string expectedError)
{
    var result = await _sut.PlaceOrderAsync(request, TestContext.Current.CancellationToken);

    result.IsSuccess.Should().BeFalse();
    result.Error.Should().Contain(expectedError);
}
```

## Mocking with Moq

Only mock outbound ports (interfaces crossing a hexagonal boundary) — see [[hexagonal-architecture]]. Never mock the SUT itself, and never assert against a mocked logger.

```csharp
[Fact]
public async Task GetOrderAsync_ReturnsNull_WhenNotFound()
{
    // Arrange
    var orderId = Guid.NewGuid();
    _repository.Setup(r => r.FindByIdAsync(orderId, It.IsAny<CancellationToken>()))
        .ReturnsAsync((Order?)null);

    // Act
    var result = await _sut.GetOrderAsync(orderId, TestContext.Current.CancellationToken);

    // Assert
    result.Should().BeNull();
}

[Fact]
public async Task PlaceOrderAsync_PersistsOrder_WhenRequestIsValid()
{
    // Arrange
    var request = ValidOrderRequest();

    // Act
    await _sut.PlaceOrderAsync(request, TestContext.Current.CancellationToken);

    // Assert — verify the outbound port was called (a boundary, not an internal collaborator)
    _repository.Verify(r => r.AddAsync(
        It.Is<Order>(o => o.CustomerId == request.CustomerId),
        It.IsAny<CancellationToken>()), Times.Once);
}
```

## Integration Tests

**Applies to**: Presentation and Infrastructure adapters (see [[hexagonal-architecture]])

- Presentation-layer endpoints: `WebApplicationFactory<Program>`, one test class per endpoint group
- Infrastructure outbound ports (EFCore repositories, gateways): TestContainers, no mocks, no real external services

```csharp
public sealed class OrderApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrderApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetOrder_Returns404_WhenNotFound()
    {
        var response = await _client.GetAsync($"/api/orders/{Guid.NewGuid()}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
```

```csharp
public sealed class SqlOrderRepositoryTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    private AppDbContext _db = null!;

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        _db = new AppDbContext(options);
        await _db.Database.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_MakesOrderRetrievable()
    {
        var repo = new SqlOrderRepository(_db);
        var order = Order.Create("cust-1", [new OrderItem("SKU-001", 2, 10m)]);

        await repo.AddAsync(order, TestContext.Current.CancellationToken);
        var found = await repo.FindByIdAsync(order.Id, TestContext.Current.CancellationToken);

        found.Should().NotBeNull();
        found!.Items.Should().HaveCount(1);
    }
}
```

## Test Organization

Test projects are ordinary projects: each is a flat directory directly under `src/`, named
exactly as its `.csproj`. There is no top-level `tests/` directory and no grouping subfolders.

```
src/
  MyService.Application/
  MyService.Infrastructure/
  MyService.Api/
  MyService.UnitTests/
    Application/
      OrderServiceTests.cs
    Domain/
      OrderTests.cs
  MyService.IntegrationTests/
    Presentation/
      OrderApiTests.cs
    Infrastructure/
      SqlOrderRepositoryTests.cs
```

- Use `[Trait("Category", "...")]` to group tests for filtering (e.g. `dotnet test --filter Category=Integration`).
- Use `ITestOutputHelper` for test diagnostics; skip tests conditionally with `Skip = "reason"` on `[Fact]`/`[Theory]`.

## Test Data Builders

Reach for a builder when a test needs many variations of the same complex object; don't add one for a type with one or two constructor arguments — a plain call is simpler.

```csharp
public sealed class OrderBuilder
{
    private string _customerId = "cust-default";
    private readonly List<OrderItem> _items = [new("SKU-001", 1, 10m)];

    public OrderBuilder WithCustomer(string customerId)
    {
        _customerId = customerId;
        return this;
    }

    public OrderBuilder WithItem(string sku, int quantity, decimal price)
    {
        _items.Add(new OrderItem(sku, quantity, price));
        return this;
    }

    public Order Build() => Order.Create(_customerId, _items);
}
```

## Good and Bad Tests

### Good Tests

**Behavior-focused**: test through the public interface, assert observable outcomes.

```csharp
// GOOD: tests behavior the caller cares about
[Fact]
public async Task CheckoutAsync_ReturnsConfirmedOrder_WhenCartIsValid()
{
    // Arrange
    var cart = new Cart();
    cart.Add(new Product { Id = "sku-1", Price = 29.99m });
    _paymentGateway
        .Setup(g => g.ChargeAsync(29.99m, It.IsAny<CancellationToken>()))
        .ReturnsAsync(new ChargeResult { Success = true });

    // Act
    var result = await _sut.CheckoutAsync(cart, _validPaymentMethod, TestContext.Current.CancellationToken);

    // Assert
    result.Status.Should().Be(OrderStatus.Confirmed);
    result.OrderId.Should().NotBeEmpty();
}
```

Characteristics:
- Tests behavior callers/users care about
- Uses only the public API of the system under test
- Survives internal refactors (no coupling to private methods)
- Describes WHAT, not HOW

### Bad Tests

**Implementation-detail tests**: break on refactors even when behavior is unchanged.

```csharp
// BAD: verifies a private call count — couples test to implementation
[Fact]
public async Task CheckoutAsync_CallsPaymentServiceProcess()
{
    await _sut.CheckoutAsync(_cart, _payment, TestContext.Current.CancellationToken);

    _paymentGateway.Verify(g => g.ProcessInternalAsync(It.IsAny<decimal>()), Times.Once);
}
```

```csharp
// BAD: asserts on mock logger — couples test to implementation
[Fact]
public async Task CheckoutAsync_LogsPaymentProcessed()
{
    await _sut.CheckoutAsync(_cart, _payment, TestContext.Current.CancellationToken);

    _logger.Verify(/* ... */);
}
```

```csharp
// BAD: bypasses the service interface to verify via DB
[Fact]
public async Task CreateUserAsync_SavesRowToDatabase()
{
    await _sut.CreateUserAsync(new CreateUserRequest { Name = "Alice" }, TestContext.Current.CancellationToken);

    var row = await _dbContext.Users.FirstOrDefaultAsync(u => u.Name == "Alice");
    row.Should().NotBeNull();
}

// GOOD: verifies through the service interface
[Fact]
public async Task CreateUserAsync_MakesUserRetrievable()
{
    var created = await _sut.CreateUserAsync(new CreateUserRequest { Name = "Alice" }, TestContext.Current.CancellationToken);
    var retrieved = await _sut.GetUserAsync(created.Id, TestContext.Current.CancellationToken);

    retrieved.Name.Should().Be("Alice");
}
```

### Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| Mocking internal collaborators (classes you own, not boundary interfaces) | Test through the real collaborator, or extract a port if a genuine second implementation exists |
| Asserting `Times.Once` on internal orchestration calls | Verify only on outbound ports (repositories, gateways) |
| `_sut` is itself a mocked object | Mock only its dependencies |
| Test breaks on rename/refactor without a behavior change | Assert on outcomes, not call sequences |
| Test name describes HOW, not WHAT | Name by behavior: `Method_ExpectedResult_WhenCondition` |
| Asserting on a mock logger or other logging interface | Don't assert on logging at all |
| `Thread.Sleep` in async tests | `Task.Delay` with a timeout, or a polling helper |
| Asserting on `ToString()` output | Assert on typed properties |
| Ignoring `CancellationToken` | Always pass `TestContext.Current.CancellationToken` |

## Running Tests

```bash
# Run all tests
dotnet test

# Run with coverage (Cobertura XML per test project under TestResults/)
dotnet test --collect "XPlat Code Coverage"

# Fail when a test project's line coverage drops below 80%
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line

# Run a specific project
dotnet test tests/MyService.UnitTests/

# Filter by test name
dotnet test --filter "FullyQualifiedName~OrderService"

# Watch mode during development
dotnet watch test --project tests/MyService.UnitTests/
```
