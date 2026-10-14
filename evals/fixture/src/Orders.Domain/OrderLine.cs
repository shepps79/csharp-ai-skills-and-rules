namespace Orders.Domain;

/// <summary>A quantity of one product on an order.</summary>
/// <param name="Sku">Stock-keeping unit of the product.</param>
/// <param name="Quantity">Number of units ordered.</param>
/// <param name="UnitPrice">Price of a single unit.</param>
public readonly record struct OrderLine(string Sku, int Quantity, decimal UnitPrice);
