using AwesomeAssertions;
using CSharpFunctionalExtensions;
using Moq;
using Orders.Application;
using Orders.Domain;
using Orders.UnitTests.Fakes;

namespace Orders.UnitTests.Application;

public sealed class OrderServiceTests
{
    [Fact]
    public async Task PlaceOrderAsync_ReturnsConfirmedSummary_WhenRequestIsValid()
    {
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 2, 12.50m), new PlaceOrderLine("SKU-2", 1, 5m)]);

        var result = await new OrderService(new InMemoryOrderRepository()).PlaceOrderAsync(request, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo(new { CustomerId = "cust-1", Status = "Confirmed", Total = 30.00m });
    }

    [Fact]
    public async Task PlaceOrderAsync_StoresTheOrder_WhenRequestIsValid()
    {
        var repository = new InMemoryOrderRepository();
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 1, 10m)]);

        var result = await new OrderService(repository).PlaceOrderAsync(request, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        repository.Orders.Should().ContainSingle().Which.Id.Value.Should().Be(result.Value.Id);
    }

    [Fact]
    public async Task PlaceOrderAsync_ReturnsEveryValidationMessage_WhenCustomerAndLineAreInvalid()
    {
        var repository = new InMemoryOrderRepository();
        var request = new PlaceOrderRequest(string.Empty, [new PlaceOrderLine(string.Empty, 0, -1m)]);

        var result = await new OrderService(repository).PlaceOrderAsync(request, TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Error.Messages.Should().Equal(
            "Customer id is required.", "SKU is required.", "Quantity must be greater than zero.", "Price must not be negative.");
        repository.Orders.Should().BeEmpty();
    }

    [Fact]
    public async Task PlaceOrderAsync_ReturnsValidationError_WhenNoLines()
    {
        var result = await new OrderService(new InMemoryOrderRepository()).PlaceOrderAsync(new PlaceOrderRequest("cust-1", []), TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().BeEquivalentTo(new { Kind = ErrorKind.Validation, Messages = new[] { "An order needs at least one line." } });
    }

    [Fact]
    public async Task PlaceOrderAsync_ReturnsUnavailable_WhenStoreIsUnavailable()
    {
        // Arrange
        var repository = new Mock<IOrderRepository>();
        repository.Setup(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(UnitResult.Failure(Error.Unavailable("down")));
        var service = new OrderService(repository.Object);

        // Act
        var result = await service.PlaceOrderAsync(
            new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 1, 10m)]), TestContext.Current.CancellationToken);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Kind.Should().Be(ErrorKind.Unavailable);
    }
}
