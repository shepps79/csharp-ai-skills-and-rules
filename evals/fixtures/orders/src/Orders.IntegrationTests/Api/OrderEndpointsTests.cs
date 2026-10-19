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
public sealed class OrderEndpointsTests(PostgresDatabase database)
{
    private const string UnreachableDatabase = "Host=localhost;Port=1;Database=orders;Username=orders;Password=orders;Timeout=1";

    [Fact]
    public async Task PlaceOrder_StoresTheConfirmedOrder_WhenRequestIsValid()
    {
        // Arrange
        await using var factory = CreateFactory(database.ConnectionString);
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 2, 10m)]);

        // Act
        var response = await factory.CreateClient().PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        await using var context = database.CreateContext();
        var row = await context.Orders.SingleAsync(order => order.Id == body.GetProperty("id").GetGuid(), TestContext.Current.CancellationToken);
        row.Should().BeEquivalentTo(new { CustomerId = "cust-1", Status = "Confirmed", Lines = new[] { new OrderLineRow("SKU-1", 2, 10m) } });
    }

    [Fact]
    public async Task PlaceOrder_Returns503_WhenDatabaseIsUnreachable()
    {
        // Arrange
        await using var factory = CreateFactory(UnreachableDatabase);
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 1, 10m)]);

        // Act
        var response = await factory.CreateClient().PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    private static WebApplicationFactory<Program> CreateFactory(string connectionString) =>
        new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseSetting("ConnectionStrings:Orders", connectionString));
}
