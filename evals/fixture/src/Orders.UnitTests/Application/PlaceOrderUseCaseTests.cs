using AwesomeAssertions;
using Moq;
using Orders.Application;
using Orders.Domain;

namespace Orders.UnitTests.Application;

public sealed class PlaceOrderUseCaseTests
{
    private readonly Mock<IOrderRepository> _repository = new();
    private readonly PlaceOrderUseCase _sut;

    public PlaceOrderUseCaseTests()
    {
        _sut = new PlaceOrderUseCase(_repository.Object);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsPendingOrder_WhenRequestIsValid()
    {
        var result = await _sut.ExecuteAsync(ValidRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public async Task ExecuteAsync_StoresOrder_WhenRequestIsValid()
    {
        var request = ValidRequest();

        await _sut.ExecuteAsync(request, TestContext.Current.CancellationToken);

        _repository.Verify(r => r.AddAsync(
            It.Is<Order>(o => o.CustomerId == request.CustomerId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    public static IEnumerable<TheoryDataRow<PlaceOrderRequest, string>> InvalidRequests =>
    [
        new(new PlaceOrderRequest("", [new OrderLineDto("SKU-1", 1, 5m)]), "Customer id is required."),
        new(new PlaceOrderRequest("cust-1", []), "An order needs at least one line."),
        new(new PlaceOrderRequest("cust-1", [new OrderLineDto("SKU-1", 0, 5m)]), "Every line needs a positive quantity."),
    ];

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task ExecuteAsync_ReturnsFailure_WhenRequestIsInvalid(PlaceOrderRequest request, string expectedError)
    {
        var result = await _sut.ExecuteAsync(request, TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain(expectedError);
    }

    [Fact]
    public async Task ExecuteAsync_DoesNotStoreOrder_WhenRequestIsInvalid()
    {
        await _sut.ExecuteAsync(new PlaceOrderRequest("cust-1", []), TestContext.Current.CancellationToken);

        _repository.Verify(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static PlaceOrderRequest ValidRequest() =>
        new("cust-1", [new OrderLineDto("SKU-1", 2, 9.99m), new OrderLineDto("SKU-2", 1, 25m)]);
}
