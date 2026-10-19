using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Orders.Application;
using Orders.Infrastructure;

namespace Orders.IntegrationTests.Api;

[Collection(nameof(PostgresDatabase))]
public sealed class OrderEndpointsTests : IAsyncDisposable
{
    private readonly PostgresDatabase _database;
    private readonly WebApplicationFactory<Program> _factory;

    public OrderEndpointsTests(PostgresDatabase database)
    {
        _database = database;
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseSetting("ConnectionStrings:Orders", database.ConnectionString));
    }

    [Fact]
    public async Task PlaceOrder_StoresTheConfirmedOrder_WhenRequestIsValid()
    {
        // Arrange
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 2, 10m)]);

        // Act
        var response = await _factory.CreateClient().PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        await using var context = _database.CreateContext();
        var row = await context.Orders.SingleAsync(order => order.Id == body.GetProperty("id").GetGuid(), TestContext.Current.CancellationToken);
        row.Should().BeEquivalentTo(new { CustomerId = "cust-1", Status = "Confirmed", Lines = new[] { new OrderLineRow("SKU-1", 2, 10m) } });
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();
}
