using AwesomeAssertions;
using Microsoft.EntityFrameworkCore;
using Orders.Application;
using Orders.Domain;
using Orders.Infrastructure;
using Orders.UnitTests.Fakes;

namespace Orders.IntegrationTests.Infrastructure;

[Collection(nameof(PostgresDatabase))]
public sealed class PostgresOrderRepositoryTests(PostgresDatabase database) : OrderRepositoryContract
{
    [Fact]
    public async Task AddAsync_ReturnsUnavailable_WhenDatabaseIsUnreachable()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<OrdersDbContext>()
            .UseNpgsql("Host=localhost;Port=1;Database=orders;Username=orders;Password=orders;Timeout=1").Options;
        var repository = new PostgresOrderRepository(new OrdersDbContext(options));
        var order = ConfirmedOrder.Create(OrderId.New(), CustomerId.Create("cust-1").Value, [OrderLine.Create("SKU-1", 1, 10m).Value]).Value;

        // Act
        var result = await repository.AddAsync(order, TestContext.Current.CancellationToken);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Kind.Should().Be(ErrorKind.Unavailable);
    }

    protected override IOrderRepository CreateRepository() => new PostgresOrderRepository(database.CreateContext());
}
