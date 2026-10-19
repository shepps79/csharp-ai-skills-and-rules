using System.Collections.Immutable;
using CSharpFunctionalExtensions;
using Orders.Application;
using Orders.Domain;

namespace Orders.UnitTests.Fakes;

public sealed class InMemoryOrderRepository : IOrderRepository
{
    private ImmutableDictionary<OrderId, Order> _orders = [];

    public IReadOnlyCollection<Order> Orders => [.. _orders.Values];

    public Task<UnitResult<Error>> AddAsync(Order order, CancellationToken cancellationToken) =>
        Task.FromResult(ImmutableInterlocked.TryAdd(ref _orders, order.Id, order)
            ? UnitResult.Success<Error>()
            : UnitResult.Failure(Error.Conflict($"Order {order.Id.Value} already exists.")));
}
