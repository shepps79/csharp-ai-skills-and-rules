using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>A stock keeping unit that identifies a product; never blank.</summary>
public sealed record Sku
{
    private Sku(string value) => Value = value;

    /// <summary>The code.</summary>
    public string Value { get; }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when <paramref name="value"/> is blank.</summary>
    public static Result<Sku, Error> Create(string value) =>
        string.IsNullOrWhiteSpace(value) ? Error.Validation("SKU is required.") : new Sku(value);
}
