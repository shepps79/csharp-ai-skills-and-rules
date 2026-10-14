namespace Orders.Infrastructure;

/// <summary>Persistence shape of an order.</summary>
public sealed class OrderEntity
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>Customer who placed the order.</summary>
    public required string CustomerId { get; set; }

    /// <summary>Order status name.</summary>
    public required string Status { get; set; }

    /// <summary>Order lines, stored as JSON.</summary>
    public required ICollection<OrderLineEntity> Lines { get; set; }
}
