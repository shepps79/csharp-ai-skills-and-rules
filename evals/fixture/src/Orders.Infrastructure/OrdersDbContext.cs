using Microsoft.EntityFrameworkCore;

namespace Orders.Infrastructure;

/// <summary>EF Core context for the orders database.</summary>
/// <param name="options">Provider and connection configuration.</param>
public sealed class OrdersDbContext(DbContextOptions<OrdersDbContext> options) : DbContext(options)
{
    /// <summary>Stored orders.</summary>
    public DbSet<OrderEntity> Orders => Set<OrderEntity>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<OrderEntity>().OwnsMany(order => order.Lines, lines => lines.ToJson());
}
