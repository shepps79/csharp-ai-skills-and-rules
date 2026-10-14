using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;
using Orders.Application;
using Orders.Domain;

namespace Orders.Infrastructure;

/// <summary>EF Core adapter for <see cref="IOrderRepository"/>.</summary>
/// <param name="db">Orders database context.</param>
public sealed class EfOrderRepository(OrdersDbContext db) : IOrderRepository
{
    /// <inheritdoc />
    public async Task<Maybe<Order>> FindByIdAsync(Guid id, CancellationToken cancellationToken) =>
        Maybe.From(await db.Orders.AsNoTracking().FirstOrDefaultAsync(order => order.Id == id, cancellationToken))
            .Map(ToDomain);

    /// <inheritdoc />
    public async Task AddAsync(Order order, CancellationToken cancellationToken)
    {
        db.Orders.Add(ToEntity(order));
        await db.SaveChangesAsync(cancellationToken);
    }

    private static Order ToDomain(OrderEntity entity) => new()
    {
        Id = entity.Id,
        CustomerId = entity.CustomerId,
        Status = Enum.Parse<OrderStatus>(entity.Status),
        Lines = [.. entity.Lines.Select(line => new OrderLine(line.Sku, line.Quantity, line.UnitPrice))],
    };

    private static OrderEntity ToEntity(Order order) => new()
    {
        Id = order.Id,
        CustomerId = order.CustomerId,
        Status = order.Status.ToString(),
        Lines = [.. order.Lines.Select(line => new OrderLineEntity { Sku = line.Sku, Quantity = line.Quantity, UnitPrice = line.UnitPrice })],
    };
}
