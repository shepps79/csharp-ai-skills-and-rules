using Microsoft.EntityFrameworkCore;

namespace Orders.Infrastructure.Persistence;

/// <summary>The PostgreSQL order store.</summary>
public sealed class OrdersDbContext(DbContextOptions<OrdersDbContext> options) : DbContext(options)
{
    /// <summary>The stored orders.</summary>
    public DbSet<OrderRow> Orders => Set<OrderRow>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<OrderRow>(order =>
        {
            order.ToTable("orders");
            order.HasKey(row => row.Id);
            order.ComplexCollection(row => row.Lines, lines => lines.ToJson());
        });
}
