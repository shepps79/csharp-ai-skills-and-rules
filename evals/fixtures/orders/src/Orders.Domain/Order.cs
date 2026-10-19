using System.Collections.Immutable;
using System.Diagnostics;

namespace Orders.Domain;

/// <summary>A customer's order in one of its lifecycle states.</summary>
public abstract record Order
{
    private protected Order(OrderId id, CustomerId customerId, ImmutableArray<OrderLine> lines)
    {
        Id = id;
        CustomerId = customerId;
        Lines = lines;
    }

    /// <summary>The identity of the order.</summary>
    public OrderId Id { get; }

    /// <summary>The customer who placed the order.</summary>
    public CustomerId CustomerId { get; }

    /// <summary>The ordered lines; never empty.</summary>
    public ImmutableArray<OrderLine> Lines { get; }

    /// <summary>The sum of all line totals.</summary>
    public decimal Total => Lines.Sum(line => line.LineTotal);

    /// <summary>Runs the function for the current state.</summary>
    public T Match<T>(Func<PendingOrder, T> pending, Func<ConfirmedOrder, T> confirmed) => this switch
    {
        PendingOrder order => pending(order),
        ConfirmedOrder order => confirmed(order),
        _ => throw new UnreachableException(),
    };
}
