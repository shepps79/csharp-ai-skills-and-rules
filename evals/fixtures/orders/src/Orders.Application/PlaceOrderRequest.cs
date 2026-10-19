using System.Collections.Immutable;

namespace Orders.Application;

/// <summary>Input for placing an order.</summary>
public sealed record PlaceOrderRequest(string CustomerId, ImmutableArray<PlaceOrderLine> Lines);
