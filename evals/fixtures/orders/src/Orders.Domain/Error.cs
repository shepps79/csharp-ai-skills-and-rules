using System.Collections.Immutable;
using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>A failure value; <see cref="Combine"/> merges validation messages.</summary>
/// <param name="Kind">The kind of failure.</param>
/// <param name="Messages">What went wrong, one message for each broken rule.</param>
public sealed record Error(ErrorKind Kind, ImmutableArray<string> Messages) : ICombine
{
    /// <summary>Creates a validation error.</summary>
    public static Error Validation(string message) => new(ErrorKind.Validation, [message]);

    /// <summary>Creates a not-found error.</summary>
    public static Error NotFound(string message) => new(ErrorKind.NotFound, [message]);

    /// <summary>Creates a conflict error.</summary>
    public static Error Conflict(string message) => new(ErrorKind.Conflict, [message]);

    /// <summary>Creates an unavailable error.</summary>
    public static Error Unavailable(string message) => new(ErrorKind.Unavailable, [message]);

    /// <inheritdoc />
    public ICombine Combine(ICombine value) => this with { Messages = [.. Messages, .. ((Error)value).Messages] };
}
