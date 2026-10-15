using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class OrderTests
{
    [Fact]
    public void Create_ReturnsFailure_WhenNoItems()
    {
        var result = Order.Create("cust-1", []);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("at least one item");
    }

    [Fact]
    public void Confirm_ReturnsFailure_WhenAlreadyConfirmed()
    {
        var order = Order.Create("cust-1", [new OrderItem("SKU-1", 1, 10m)]).Value;
        order.Confirm();

        var result = order.Confirm();

        result.IsFailure.Should().BeTrue();
    }
}
