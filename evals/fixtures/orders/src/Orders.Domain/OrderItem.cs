namespace Orders.Domain;

/// <summary>A single product line on an order.</summary>
public sealed record OrderItem(string Sku, int Quantity, decimal UnitPrice)
{
    /// <summary>Price of the line: quantity multiplied by unit price.</summary>
    public decimal LineTotal => Quantity * UnitPrice;
}
