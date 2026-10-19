using System.Collections.Immutable;
using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>An order that is not yet confirmed.</summary>
public sealed record PendingOrder : Order
{
    private PendingOrder(OrderId id, CustomerId customerId, ImmutableArray<OrderLine> lines)
        : base(id, customerId, lines)
    {
    }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when there are no lines.</summary>
    public static Result<PendingOrder, Error> Create(OrderId id, CustomerId customerId, ImmutableArray<OrderLine> lines) =>
        lines.IsEmpty ? Error.Validation("An order needs at least one line.") : new PendingOrder(id, customerId, lines);

    /// <summary>Confirms the order.</summary>
    public Result<ConfirmedOrder, Error> Confirm() => ConfirmedOrder.Create(Id, CustomerId, Lines);
}
