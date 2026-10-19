using Orders.Domain;

namespace Orders.Application;

/// <summary>An order as seen by callers of the use cases.</summary>
/// <param name="Id">The identity of the order.</param>
/// <param name="CustomerId">The customer who placed the order.</param>
/// <param name="Status">The lifecycle state: <c>Pending</c> or <c>Confirmed</c>.</param>
/// <param name="Total">The sum of all line totals.</param>
public sealed record OrderSummary(Guid Id, string CustomerId, string Status, decimal Total)
{
    /// <summary>Describes an order without exposing the aggregate.</summary>
    public static OrderSummary From(Order order) => new(
        order.Id.Value,
        order.CustomerId.Value,
        order.Match(pending: _ => "Pending", confirmed: _ => "Confirmed"),
        order.Total);
}
