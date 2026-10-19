using AwesomeAssertions;
using Orders.Application;
using Orders.Domain;

namespace Orders.UnitTests.Application;

public sealed class OrderSummaryTests
{
    [Fact]
    public void From_ReturnsPendingStatus_WhenOrderIsPending()
    {
        var order = PendingOrder.Create(OrderId.New(), CustomerId.Create("cust-1").Value, [OrderLine.Create("SKU-1", 3, 2m).Value]).Value;

        var summary = OrderSummary.From(order);

        summary.Should().BeEquivalentTo(new { CustomerId = "cust-1", Status = "Pending", Total = 6m });
    }
}
