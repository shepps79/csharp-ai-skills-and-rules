using AwesomeAssertions;
using Orders.Domain;

namespace Orders.UnitTests.Domain;

public sealed class SkuTests
{
    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void Create_ReturnsValidationError_WhenBlank(string value)
    {
        var result = Sku.Create(value);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().BeEquivalentTo(new { Kind = ErrorKind.Validation, Messages = new[] { "SKU is required." } });
    }

    [Fact]
    public void Create_ReturnsSku_WhenNotBlank()
    {
        var result = Sku.Create("SKU-1");

        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be("SKU-1");
    }
}
