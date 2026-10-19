using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>The identity of the customer who places an order; never blank.</summary>
public sealed record CustomerId
{
    private CustomerId(string value) => Value = value;

    /// <summary>The identifier.</summary>
    public string Value { get; }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when <paramref name="value"/> is blank.</summary>
    public static Result<CustomerId, Error> Create(string value) =>
        string.IsNullOrWhiteSpace(value) ? Error.Validation("Customer id is required.") : new CustomerId(value);
}
