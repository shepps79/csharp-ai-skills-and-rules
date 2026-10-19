using CSharpFunctionalExtensions;
using Orders.Domain;

namespace Orders.Application;

/// <summary>Outbound port for persisting orders.</summary>
public interface IOrderRepository
{
    /// <summary>Stores a new order. Returns <see cref="ErrorKind.Unavailable"/> when the store cannot be reached.</summary>
    Task<UnitResult<Error>> AddAsync(Order order, CancellationToken cancellationToken);
}
