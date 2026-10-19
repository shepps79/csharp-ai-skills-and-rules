using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class MoneyTests
{
    [Fact]
    public void Create_ReturnsValidationError_WhenNegative()
    {
        var result = Money.Create(-0.01m);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().BeEquivalentTo(new { Kind = ErrorKind.Validation, Messages = new[] { "Price must not be negative." } });
    }

    [Fact]
    public void Create_ReturnsMoney_WhenZero()
    {
        var result = Money.Create(0m);

        result.IsSuccess.Should().BeTrue();
        result.Value.Amount.Should().Be(0m);
    }
}
