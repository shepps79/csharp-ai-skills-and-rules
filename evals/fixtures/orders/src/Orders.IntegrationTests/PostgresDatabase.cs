using Microsoft.EntityFrameworkCore;
using Orders.Infrastructure;
using Testcontainers.PostgreSql;

namespace Orders.IntegrationTests;

[CollectionDefinition(nameof(PostgresDatabase))]
public sealed class PostgresDatabase : IAsyncLifetime, ICollectionFixture<PostgresDatabase>
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public string ConnectionString => _container.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync(TestContext.Current.CancellationToken);
        await using var context = CreateContext();
        await context.Database.MigrateAsync(TestContext.Current.CancellationToken);
    }

    public OrdersDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<OrdersDbContext>().UseNpgsql(ConnectionString).Options);

    public ValueTask DisposeAsync() => _container.DisposeAsync();
}
