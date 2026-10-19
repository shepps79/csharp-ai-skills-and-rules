using AwesomeAssertions;
using Orders.Application;
using Orders.Domain;

namespace Orders.UnitTests.Fakes;

public abstract class OrderRepositoryContract
{
    [Fact]
    public async Task AddAsync_ReturnsSuccess_WhenOrderIsNew()
    {
        var result = await CreateRepository().AddAsync(NewOrder(), TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task AddAsync_ReturnsConflict_WhenOrderIdExists()
    {
        // Arrange
        var order = NewOrder();
        await CreateRepository().AddAsync(order, TestContext.Current.CancellationToken);

        // Act
        var result = await CreateRepository().AddAsync(order, TestContext.Current.CancellationToken);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Kind.Should().Be(ErrorKind.Conflict);
    }

    /// <summary>Returns a repository over the one store that all calls in a test share.</summary>
    protected abstract IOrderRepository CreateRepository();

    private static ConfirmedOrder NewOrder() =>
        ConfirmedOrder.Create(OrderId.New(), CustomerId.Create("cust-1").Value, [OrderLine.Create("SKU-1", 2, 10m).Value]).Value;
}
