namespace Orders.Infrastructure;

/// <summary>Persistence shape of an order line.</summary>
public sealed class OrderLineEntity
{
    /// <summary>Stock-keeping unit of the product.</summary>
    public required string Sku { get; set; }

    /// <summary>Number of units ordered.</summary>
    public int Quantity { get; set; }

    /// <summary>Price of a single unit.</summary>
    public decimal UnitPrice { get; set; }
}
