using System.Text.Json;
using AwesomeAssertions;
using CSharpFunctionalExtensions;
using Orders.Api.Json;

namespace Orders.UnitTests.Api;

public sealed class MaybeJsonConverterFactoryTests
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { Converters = { new MaybeJsonConverterFactory() } };

    [Theory]
    [InlineData("""{}""")]
    [InlineData("""{"note":null}""")]
    public void Deserialize_ReturnsNone_WhenPropertyIsMissingOrNull(string json)
    {
        var body = JsonSerializer.Deserialize<Body>(json, Options);

        body.Should().Be(new Body(Maybe<string>.None));
    }

    [Fact]
    public void Deserialize_ReturnsValue_WhenPropertyHasValue()
    {
        var body = JsonSerializer.Deserialize<Body>("""{"note":"Leave at the door"}""", Options);

        body.Should().Be(new Body(Maybe.From("Leave at the door")));
    }

    [Fact]
    public void Serialize_WritesNull_WhenNone()
    {
        var json = JsonSerializer.Serialize(new Body(Maybe<string>.None), Options);

        json.Should().Be("""{"note":null}""");
    }

    [Fact]
    public void Serialize_WritesValue_WhenValue()
    {
        var json = JsonSerializer.Serialize(new Body(Maybe.From("Leave at the door")), Options);

        json.Should().Be("""{"note":"Leave at the door"}""");
    }

    private sealed record Body(Maybe<string> Note);
}
