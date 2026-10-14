using CSharpFunctionalExtensions;
using Orders.Domain;

namespace Orders.Application;

/// <summary>Places a new order for a customer.</summary>
/// <param name="repository">Where placed orders are stored.</param>
public sealed class PlaceOrderUseCase(IOrderRepository repository)
{
    /// <summary>Validates and stores the order.</summary>
    /// <param name="request">Order to place.</param>
    /// <param name="cancellationToken">Cancels the operation.</param>
    /// <returns>The placed order, or the validation errors.</returns>
    public Task<Result<OrderDto>> ExecuteAsync(PlaceOrderRequest request, CancellationToken cancellationToken) =>
        Order.Create(request.CustomerId, [.. request.Lines.Select(line => new OrderLine(line.Sku, line.Quantity, line.UnitPrice))])
            .Tap(order => repository.AddAsync(order, cancellationToken))
            .Map(OrderDto.From);
}
