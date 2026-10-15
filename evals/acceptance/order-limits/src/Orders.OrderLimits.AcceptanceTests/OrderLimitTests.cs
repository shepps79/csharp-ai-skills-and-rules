using System.Net;
using System.Net.Http.Json;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Orders.Application;

namespace Orders.OrderLimits.AcceptanceTests;

public sealed class OrderLimitTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private const int DefaultLimit = 50;

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task PlaceOrder_Returns201_WhenLinesAreAtTheDefaultLimit()
    {
        var response = await PlaceOrderWithLinesAsync(DefaultLimit);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task PlaceOrder_Returns400_WhenLinesExceedTheDefaultLimit()
    {
        var response = await PlaceOrderWithLinesAsync(DefaultLimit + 1);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private Task<HttpResponseMessage> PlaceOrderWithLinesAsync(int count)
    {
        var lines = Enumerable.Range(1, count).Select(i => new PlaceOrderLine($"SKU-{i}", 1, 1m)).ToList();
        return _client.PostAsJsonAsync("/orders", new PlaceOrderRequest("cust-1", lines), TestContext.Current.CancellationToken);
    }
}
