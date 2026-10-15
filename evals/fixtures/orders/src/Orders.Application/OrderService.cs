using CSharpFunctionalExtensions;
using Orders.Domain;

namespace Orders.Application;

/// <summary>Use cases for placing and managing orders.</summary>
public sealed class OrderService(IOrderRepository repository)
{
    /// <summary>Creates, confirms and stores an order.</summary>
    public async Task<Result<Order>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken) =>
        await Order.Create(request.CustomerId, request.Items)
            .Check(order => order.Confirm())
            .Tap(order => repository.AddAsync(order, cancellationToken));
}
