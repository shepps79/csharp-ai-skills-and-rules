using CSharpFunctionalExtensions;
using Orders.Domain;

namespace Orders.Application;

/// <summary>Use cases for placing and managing orders; its public methods are the inbound port.</summary>
public sealed class OrderService(IOrderRepository repository)
{
    /// <summary>Creates, confirms and stores an order.</summary>
    public async Task<Result<OrderSummary>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken) =>
        await Order.Create(request.CustomerId, [.. request.Lines.Select(line => new OrderItem(line.Sku, line.Quantity, line.UnitPrice))])
            .Check(order => order.Confirm())
            .Tap(order => repository.AddAsync(order, cancellationToken))
            .Map(OrderSummary.From);
}
