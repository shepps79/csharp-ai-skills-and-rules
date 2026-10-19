using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>A count of items that is always greater than zero.</summary>
public sealed record Quantity
{
    private Quantity(int value) => Value = value;

    /// <summary>The count.</summary>
    public int Value { get; }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when <paramref name="value"/> is not positive.</summary>
    public static Result<Quantity, Error> Create(int value) =>
        value > 0 ? new Quantity(value) : Error.Validation("Quantity must be greater than zero.");
}
