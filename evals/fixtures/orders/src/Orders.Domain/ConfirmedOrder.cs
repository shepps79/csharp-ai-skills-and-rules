using System.Collections.Immutable;
using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>An order that is confirmed and awaits fulfilment.</summary>
public sealed record ConfirmedOrder : Order
{
    private ConfirmedOrder(OrderId id, CustomerId customerId, ImmutableArray<OrderLine> lines)
        : base(id, customerId, lines)
    {
    }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when there are no lines.</summary>
    public static Result<ConfirmedOrder, Error> Create(OrderId id, CustomerId customerId, ImmutableArray<OrderLine> lines) =>
        lines.IsEmpty ? Error.Validation("An order needs at least one line.") : new ConfirmedOrder(id, customerId, lines);
}
