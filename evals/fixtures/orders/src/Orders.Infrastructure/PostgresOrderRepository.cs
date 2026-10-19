using System.Data.Common;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orders.Application;
using Orders.Domain;

namespace Orders.Infrastructure;

/// <summary>Stores orders in PostgreSQL.</summary>
public sealed class PostgresOrderRepository(OrdersDbContext database) : IOrderRepository
{
    /// <inheritdoc />
    public async Task<UnitResult<Error>> AddAsync(Order order, CancellationToken cancellationToken)
    {
        database.Orders.Add(ToRow(order));
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return UnitResult.Success<Error>();
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Error.Conflict($"Order {order.Id.Value} already exists.");
        }
        // EF Core wraps a connection failure in this "transient failure" exception.
        catch (InvalidOperationException exception) when (exception.InnerException is DbException)
        {
            return Error.Unavailable("The order store is unavailable.");
        }
    }

    private static OrderRow ToRow(Order order) =>
        new(order.Id.Value, order.CustomerId.Value, order.Match(pending: _ => "Pending", confirmed: _ => "Confirmed"))
        {
            Lines = [.. order.Lines.Select(line => new OrderLineRow(line.Sku.Value, line.Quantity.Value, line.UnitPrice.Amount))],
        };
}
