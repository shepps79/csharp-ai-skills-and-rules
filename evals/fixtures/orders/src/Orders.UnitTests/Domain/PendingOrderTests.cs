using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class PendingOrderTests
{
    [Fact]
    public void Create_ReturnsValidationError_WhenNoLines()
    {
        var result = PendingOrder.Create(OrderId.New(), Customer(), []);

        result.IsFailure.Should().BeTrue();
        result.Error.Messages.Should().Equal("An order needs at least one line.");
    }

    [Fact]
    public void Total_IsSumOfLineTotals()
    {
        var result = PendingOrder.Create(OrderId.New(), Customer(), [Line("SKU-1", 2, 12.50m), Line("SKU-2", 1, 5m)]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Total.Should().Be(30.00m);
    }

    [Fact]
    public void Confirm_ReturnsConfirmedOrderWithTheSameIdAndLines()
    {
        // Arrange
        var id = OrderId.New();
        var line = Line("SKU-1", 2, 10m);
        var pending = PendingOrder.Create(id, Customer(), [line]).Value;

        // Act
        var result = pending.Confirm();

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Id.Should().Be(id);
        result.Value.Lines.Should().Equal(line);
    }

    private static CustomerId Customer() => CustomerId.Create("cust-1").Value;

    private static OrderLine Line(string sku, int quantity, decimal unitPrice) => OrderLine.Create(sku, quantity, unitPrice).Value;
}
