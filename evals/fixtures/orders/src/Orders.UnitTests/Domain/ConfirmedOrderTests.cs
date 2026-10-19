using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class ConfirmedOrderTests
{
    [Fact]
    public void Create_ReturnsValidationError_WhenNoLines()
    {
        var result = ConfirmedOrder.Create(OrderId.New(), CustomerId.Create("cust-1").Value, []);

        result.IsFailure.Should().BeTrue();
        result.Error.Messages.Should().Equal("An order needs at least one line.");
    }
}
