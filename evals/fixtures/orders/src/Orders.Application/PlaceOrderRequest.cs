namespace Orders.Application;

/// <summary>Input for placing an order.</summary>
public sealed record PlaceOrderRequest(string CustomerId, IReadOnlyList<PlaceOrderLine> Lines);
