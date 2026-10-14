namespace Orders.Application;

/// <summary>A quantity of one product, as exchanged with callers.</summary>
/// <param name="Sku">Stock-keeping unit of the product.</param>
/// <param name="Quantity">Number of units ordered.</param>
/// <param name="UnitPrice">Price of a single unit.</param>
public sealed record OrderLineDto(string Sku, int Quantity, decimal UnitPrice);
