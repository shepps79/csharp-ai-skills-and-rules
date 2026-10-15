using Orders.Domain;

namespace Orders.Application;

/// <summary>Outbound port for persisting orders.</summary>
public interface IOrderRepository
{
    /// <summary>Stores a new order.</summary>
    Task AddAsync(Order order, CancellationToken cancellationToken);
}
