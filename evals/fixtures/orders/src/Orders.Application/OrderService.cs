using CSharpFunctionalExtensions;
using Orders.Domain;

namespace Orders.Application;

/// <summary>Use cases for placing and managing orders; its public methods are the inbound port.</summary>
public sealed class OrderService(IOrderRepository repository)
{
    /// <summary>
    /// Creates, confirms and stores an order. Returns <see cref="ErrorKind.Validation"/> with all broken rules of the
    /// request, or the <see cref="ErrorKind.Conflict"/> and <see cref="ErrorKind.Unavailable"/> errors of the store.
    /// </summary>
    public Task<Result<OrderSummary, Error>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken) =>
        NewOrder(request)
            .Bind(pending => pending.Confirm())
            .Bind(confirmed => repository.AddAsync(confirmed, cancellationToken).Map(() => OrderSummary.From(confirmed)));

    private static Result<PendingOrder, Error> NewOrder(PlaceOrderRequest request)
    {
        var customerId = CustomerId.Create(request.CustomerId);
        var lines = request.Lines.Select(line => OrderLine.Create(line.Sku, line.Quantity, line.UnitPrice)).Combine();
        return Result.Combine<Error>(customerId, lines)
            .Bind(() => customerId.Bind(customer => lines.Bind(valid => PendingOrder.Create(OrderId.New(), customer, [.. valid]))));
    }
}
