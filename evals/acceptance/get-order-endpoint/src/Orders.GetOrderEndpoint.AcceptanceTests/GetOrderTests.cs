using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Orders.Application;

namespace Orders.GetOrderEndpoint.AcceptanceTests;

public sealed class GetOrderTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task GetOrder_ReturnsThePlacedOrder_WhenItExists()
    {
        var placed = await _client.PostAsJsonAsync("/orders",
            new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 2, 10m)]), TestContext.Current.CancellationToken);
        var id = (await placed.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken)).GetProperty("id").GetGuid();

        var response = await _client.GetAsync($"/orders/{id}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var order = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        order.GetProperty("id").GetGuid().Should().Be(id);
        order.GetProperty("customerId").GetString().Should().Be("cust-1");
    }

    [Fact]
    public async Task GetOrder_Returns404_WhenTheOrderDoesNotExist()
    {
        var response = await _client.GetAsync($"/orders/{Guid.NewGuid()}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
