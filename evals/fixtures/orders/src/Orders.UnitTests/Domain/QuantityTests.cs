using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class QuantityTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Create_ReturnsValidationError_WhenNotPositive(int value)
    {
        var result = Quantity.Create(value);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().BeEquivalentTo(new { Kind = ErrorKind.Validation, Messages = new[] { "Quantity must be greater than zero." } });
    }

    [Fact]
    public void Create_ReturnsQuantity_WhenPositive()
    {
        var result = Quantity.Create(1);

        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be(1);
    }
}
