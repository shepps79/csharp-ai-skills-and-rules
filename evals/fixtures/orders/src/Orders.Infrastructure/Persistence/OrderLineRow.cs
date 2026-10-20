namespace Orders.Infrastructure.Persistence;

/// <summary>The stored form of an order line.</summary>
/// <param name="Sku">The product code.</param>
/// <param name="Quantity">The number of items.</param>
/// <param name="UnitPrice">The price of one item.</param>
public sealed record OrderLineRow(string Sku, int Quantity, decimal UnitPrice);
