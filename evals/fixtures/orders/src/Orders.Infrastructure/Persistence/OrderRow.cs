namespace Orders.Infrastructure.Persistence;

/// <summary>The stored form of an order.</summary>
/// <param name="Id">The order id.</param>
/// <param name="CustomerId">The customer id.</param>
/// <param name="Status">The lifecycle state.</param>
public sealed record OrderRow(Guid Id, string CustomerId, string Status)
{
    /// <summary>The ordered lines, stored as JSON.</summary>
    // IList: EF Core maps a complex collection only through IList<T>.
    public required IList<OrderLineRow> Lines { get; init; }
}
