namespace Orders.Application;

/// <summary>Input for placing an order.</summary>
/// <param name="CustomerId">Customer placing the order.</param>
/// <param name="Lines">Products and quantities to order.</param>
public sealed record PlaceOrderRequest(string CustomerId, IReadOnlyList<OrderLineDto> Lines);
