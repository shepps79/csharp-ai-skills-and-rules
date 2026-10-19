using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>An amount of money in the order currency; never negative.</summary>
public sealed record Money
{
    private Money(decimal amount) => Amount = amount;

    /// <summary>The amount.</summary>
    public decimal Amount { get; }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when <paramref name="amount"/> is negative.</summary>
    public static Result<Money, Error> Create(decimal amount) =>
        amount >= 0 ? new Money(amount) : Error.Validation("Price must not be negative.");
}
