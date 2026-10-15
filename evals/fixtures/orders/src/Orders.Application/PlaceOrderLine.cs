namespace Orders.Application;

/// <summary>A product line requested when placing an order.</summary>
public sealed record PlaceOrderLine(string Sku, int Quantity, decimal UnitPrice);
