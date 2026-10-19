using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class CustomerIdTests
{
    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void Create_ReturnsValidationError_WhenBlank(string value)
    {
        var result = CustomerId.Create(value);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().BeEquivalentTo(new { Kind = ErrorKind.Validation, Messages = new[] { "Customer id is required." } });
    }

    [Fact]
    public void Create_ReturnsCustomerId_WhenNotBlank()
    {
        var result = CustomerId.Create("cust-1");

        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be("cust-1");
    }
}
