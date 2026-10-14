---
name: ef-core
description: >
  Entity Framework Core patterns for .NET 10. Covers DbContext configuration,
  migrations workflow, interceptors, compiled queries, ExecuteUpdateAsync,
  ExecuteDeleteAsync, value converters, and query optimization.
  Load this skill when working with databases, writing queries, managing schema
  changes, or when the user mentions "EF Core", "Entity Framework", "DbContext",
  "migration", "LINQ query", "database", "SQL", "N+1", "Include", "split query",
  "value converter", "interceptor", or "compiled query".
---

# EF Core

## Core Principles

1. **EF Core is the default ORM** — Use it unless you have a specific reason not to (extreme perf, legacy DB without FK constraints).
2. **DbContext is a unit of work** — Don't wrap it in another UoW abstraction. EF Core already implements Unit of Work and Repository patterns internally.
3. **Queries should be projections** — Use `.Select()` to project into DTOs instead of loading full entities. This avoids over-fetching and N+1 issues.
4. **Migrations are code** — Treat them like any other source code. Review them, test them, never auto-apply in production.
5. **Use No Tracking on Readonly Queries** — Use `.AsNoTracking()` when the read from EF Core is Readonly and does not require any change tracking. This improves performance and reduces memory usage.

## Patterns

### DbContext Configuration

Use `IEntityTypeConfiguration<T>` to keep entity configs separate and discoverable.

```csharp
// Persistence/AppDbContext.cs
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}

// Persistence/Configurations/OrderConfiguration.cs
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Total)
            .HasPrecision(18, 2);

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(o => o.CustomerId);
        builder.HasIndex(o => o.CreatedAt);
    }
}
```

### Registration

```csharp
// Program.cs
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
```

### Query Projections (Avoid Over-Fetching)

```csharp
// GOOD — project to DTO, only loads needed columns
public async Task<OrderResponse?> GetOrderAsync(Guid id, CancellationToken ct)
{
    return await db.Orders
        .Where(o => o.Id == id)
        .Select(o => new OrderResponse(
            o.Id,
            o.Total,
            o.CreatedAt,
            o.Items.Select(i => new OrderItemResponse(i.ProductName, i.Quantity, i.Price)).ToList()))
        .FirstOrDefaultAsync(ct);
}
```

### Pagination

```csharp
public async Task<PagedList<OrderSummary>> ListOrdersAsync(int page, int pageSize, CancellationToken ct)
{
    var query = db.Orders
        .OrderByDescending(o => o.CreatedAt)
        .Select(o => new OrderSummary(o.Id, o.CustomerName, o.Total, o.Status));

    var totalCount = await query.CountAsync(ct);
    var items = await query
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync(ct);

    return new PagedList<OrderSummary>(items, totalCount, page, pageSize);
}
```

### ExecuteUpdateAsync / ExecuteDeleteAsync

Bulk operations that bypass change tracking for better performance.

```csharp
// Update without loading entities
await db.Orders
    .Where(o => o.Status == OrderStatus.Pending && o.CreatedAt < cutoff)
    .ExecuteUpdateAsync(s => s
        .SetProperty(o => o.Status, OrderStatus.Expired)
        .SetProperty(o => o.UpdatedAt, clock.GetUtcNow()),
        ct);

// Delete without loading entities
await db.Orders
    .Where(o => o.Status == OrderStatus.Cancelled && o.CreatedAt < archiveCutoff)
    .ExecuteDeleteAsync(ct);
```

### Interceptors, Compiled Queries, and Value Converters

For cross-cutting concerns (audit trails, soft deletes), hot-path queries that execute frequently with the same shape, and custom column mappings (enum-as-string, strongly-typed IDs), see [references/advanced-patterns.md](references/advanced-patterns.md).

### Migrations Workflow

```bash
# Create a migration
dotnet ef migrations add AddOrderIndex --project src/MyApp.Infrastructure --startup-project src/MyApp.Api

# Review the generated migration — ALWAYS review before applying
# Check for data loss, index strategy, constraint names

# Apply to development database
dotnet ef database update --project src/MyApp.Infrastructure --startup-project src/MyApp.Api

# Generate SQL script for production
dotnet ef migrations script --idempotent --output migrations.sql
```

### Global Query Filters

```csharp
// Soft delete filter
builder.HasQueryFilter(o => !o.IsDeleted);

// Multi-tenant filter
builder.HasQueryFilter(o => o.TenantId == _tenantProvider.TenantId);

// Bypass when needed
var allOrders = await db.Orders.IgnoreQueryFilters().ToListAsync(ct);
```

## Anti-patterns

### Don't Wrap DbContext in a Repository

```csharp
// BAD — unnecessary abstraction that limits EF Core's power
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id);
    Task AddAsync(Order order);
    Task SaveChangesAsync();
}

// GOOD — use DbContext directly in handlers
public class Handler(AppDbContext db)
{
    public async Task<Order?> Handle(GetOrder.Query query, CancellationToken ct)
    {
        return await db.Orders.FindAsync([query.Id], ct);
    }
}
```

### Don't Use Lazy Loading

```csharp
// BAD — lazy loading causes N+1 queries and hides data access
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseLazyLoadingProxies()); // DON'T

// GOOD — explicit loading with Include or projection
var orders = await db.Orders
    .Include(o => o.Items)
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(ct);
```

### Don't Use .ToListAsync() Then Filter in Memory

```csharp
// BAD — loads ALL orders, filters in C#
var orders = await db.Orders.ToListAsync(ct);
var pending = orders.Where(o => o.Status == OrderStatus.Pending);

// GOOD — filter in the database
var pending = await db.Orders
    .Where(o => o.Status == OrderStatus.Pending)
    .ToListAsync(ct);
```

### Don't Forget to Await Async Methods

```csharp
// BAD — missing await, returns before save completes
public void Handle(CreateOrder.Command command)
{
    db.Orders.Add(order);
    db.SaveChangesAsync(); // Fire-and-forget BUG
}

// GOOD
public async Task Handle(CreateOrder.Command command, CancellationToken ct)
{
    db.Orders.Add(order);
    await db.SaveChangesAsync(ct);
}
```
