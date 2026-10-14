using Orders.Domain;

namespace Orders.Application;

/// <summary>An order as returned to callers.</summary>
/// <param name="Id">Unique identifier of the order.</param>
/// <param name="CustomerId">Customer who placed the order.</param>
/// <param name="Status">Where the order is in its lifecycle.</param>
/// <param name="Lines">Products and quantities ordered.</param>
public sealed record OrderDto(Guid Id, string CustomerId, OrderStatus Status, IReadOnlyList<OrderLineDto> Lines)
{
    /// <summary>Maps a domain order to its caller-facing shape.</summary>
    /// <param name="order">Order to map.</param>
    public static OrderDto From(Order order) =>
        new(order.Id, order.CustomerId, order.Status, [.. order.Lines.Select(line => new OrderLineDto(line.Sku, line.Quantity, line.UnitPrice))]);
}
