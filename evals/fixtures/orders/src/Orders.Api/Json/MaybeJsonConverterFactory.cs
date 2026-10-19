using System.Text.Json;
using System.Text.Json.Serialization;
using CSharpFunctionalExtensions;

namespace Orders.Api.Json;

/// <summary>
/// Maps a <see cref="Maybe{T}"/> field of a DTO to JSON: <c>null</c> or no property reads as
/// <see cref="Maybe{T}.None"/>, and <see cref="Maybe{T}.None"/> writes as <c>null</c>.
/// </summary>
public sealed class MaybeJsonConverterFactory : JsonConverterFactory
{
    /// <inheritdoc />
    public override bool CanConvert(Type typeToConvert) =>
        typeToConvert.IsGenericType && typeToConvert.GetGenericTypeDefinition() == typeof(Maybe<>);

    /// <inheritdoc />
    public override JsonConverter? CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter?)Activator.CreateInstance(typeof(MaybeJsonConverter<>).MakeGenericType(typeToConvert.GetGenericArguments()));

    private sealed class MaybeJsonConverter<T> : JsonConverter<Maybe<T>>
    {
        public override Maybe<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType is not JsonTokenType.Null && JsonSerializer.Deserialize<T>(ref reader, options) is { } value
                ? value
                : Maybe<T>.None;

        public override void Write(Utf8JsonWriter writer, Maybe<T> value, JsonSerializerOptions options) =>
            value.Match(some => JsonSerializer.Serialize(writer, some, options), writer.WriteNullValue);
    }
}
