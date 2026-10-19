using System.Collections.Immutable;
using CSharpFunctionalExtensions;
using Orders.Application;
using Orders.Domain;

namespace Orders.UnitTests.Fakes;

public sealed class InMemoryOrderRepository : IOrderRepository
{
    private ImmutableDictionary<OrderId, Order> _orders = [];

    public IReadOnlyCollection<Order> Orders => [.. _orders.Values];

    public Task<UnitResult<Error>> AddAsync(Order order, CancellationToken cancellationToken)
    {
        ImmutableInterlocked.AddOrUpdate(ref _orders, order.Id, order, (_, _) => order);
        return Task.FromResult(UnitResult.Success<Error>());
    }
}
