using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class OrderLineTests
{
    [Fact]
    public void Create_ReturnsEveryValidationMessage_WhenAllValuesAreInvalid()
    {
        var result = OrderLine.Create(string.Empty, 0, -1m);

        result.IsFailure.Should().BeTrue();
        result.Error.Messages.Should().Equal("SKU is required.", "Quantity must be greater than zero.", "Price must not be negative.");
    }

    [Fact]
    public void LineTotal_IsQuantityTimesUnitPrice()
    {
        var result = OrderLine.Create("SKU-1", 2, 12.50m);

        result.IsSuccess.Should().BeTrue();
        result.Value.LineTotal.Should().Be(25.00m);
    }
}
