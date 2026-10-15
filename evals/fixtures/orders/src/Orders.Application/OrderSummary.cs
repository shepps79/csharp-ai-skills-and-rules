using Orders.Domain;

namespace Orders.Application;

/// <summary>An order as seen by callers of the use cases.</summary>
public sealed record OrderSummary(Guid Id, string CustomerId, string Status, decimal Total)
{
    /// <summary>Describes an order without exposing the aggregate.</summary>
    public static OrderSummary From(Order order) => new(order.Id, order.CustomerId, order.Status.ToString(), order.Total);
}
