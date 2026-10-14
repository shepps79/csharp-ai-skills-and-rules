using CSharpFunctionalExtensions;
using Orders.Domain;

namespace Orders.Application;

/// <summary>Outbound port for storing and loading orders.</summary>
public interface IOrderRepository
{
    /// <summary>Finds an order by its identifier.</summary>
    /// <param name="id">Identifier of the order.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    Task<Maybe<Order>> FindByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Stores a new order.</summary>
    /// <param name="order">Order to store.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    Task AddAsync(Order order, CancellationToken cancellationToken);
}
