namespace Orders.Application;

/// <summary>A product line requested when placing an order.</summary>
public readonly record struct PlaceOrderLine(string Sku, int Quantity, decimal UnitPrice);
