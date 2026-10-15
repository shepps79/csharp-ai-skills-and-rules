using System.Net;
using System.Net.Http.Json;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Orders.Application;

namespace Orders.IntegrationTests.Api;

[Trait("Category", "Integration")]
public sealed class OrderEndpointsTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task PlaceOrder_Returns201WithConfirmedOrder_WhenRequestIsValid()
    {
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 2, 10m)]);

        var response = await _client.PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var order = await response.Content.ReadFromJsonAsync<OrderSummary>(TestContext.Current.CancellationToken);
        order!.Status.Should().Be("Confirmed");
    }

    [Fact]
    public async Task PlaceOrder_Returns400_WhenNoLines()
    {
        var request = new PlaceOrderRequest("cust-1", []);

        var response = await _client.PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
