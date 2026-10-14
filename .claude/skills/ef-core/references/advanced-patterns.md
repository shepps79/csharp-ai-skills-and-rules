# EF Core Advanced Patterns

## Interceptors

Use interceptors for cross-cutting concerns like audit trails and soft deletes.

```csharp
public class AuditInterceptor(TimeProvider clock) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken ct = default)
    {
        var context = eventData.Context;
        if (context is null) return ValueTask.FromResult(result);

        var now = clock.GetUtcNow();

        foreach (var entry in context.ChangeTracker.Entries<IAuditable>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
            }
        }

        return ValueTask.FromResult(result);
    }
}

// Registration
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
    options
        .UseNpgsql(connectionString)
        .AddInterceptors(sp.GetRequiredService<AuditInterceptor>()));
```

## Compiled Queries

Use for hot-path queries that execute frequently with the same shape.

```csharp
public class OrderQueries
{
    public static readonly Func<AppDbContext, Guid, CancellationToken, Task<Order?>> GetById =
        EF.CompileAsyncQuery((AppDbContext db, Guid id, CancellationToken ct) =>
            db.Orders
                .Include(o => o.Items)
                .FirstOrDefault(o => o.Id == id));
}

// Usage
var order = await OrderQueries.GetById(db, orderId, ct);
```

## Value Converters

```csharp
// Store enum as string
builder.Property(o => o.Status)
    .HasConversion<string>()
    .HasMaxLength(50);

// Strongly-typed IDs
public readonly record struct OrderId(Guid Value);

builder.Property(o => o.Id)
    .HasConversion(id => id.Value, value => new OrderId(value));
```
