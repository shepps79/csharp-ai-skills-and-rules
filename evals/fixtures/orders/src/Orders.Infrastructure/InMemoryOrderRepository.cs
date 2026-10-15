using System.Collections.Concurrent;
using Orders.Application;
using Orders.Domain;

namespace Orders.Infrastructure;

/// <summary>Process-local order store.</summary>
public sealed class InMemoryOrderRepository : IOrderRepository
{
    private readonly ConcurrentDictionary<Guid, Order> _orders = new();

    /// <inheritdoc />
    public Task AddAsync(Order order, CancellationToken cancellationToken)
    {
        _orders[order.Id] = order;
        return Task.CompletedTask;
    }
}
