using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;

namespace Orders.CancelOrder.AcceptanceTests;

public sealed class CancelOrderTests(OrdersApi factory) : IClassFixture<OrdersApi>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CancelOrder_ReturnsTheCancelledOrder_WhenTheOrderIsConfirmed()
    {
        var id = await PlaceOrderAsync();

        var response = await CancelAsync(id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var order = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        order.GetProperty("id").GetGuid().Should().Be(id);
        order.GetProperty("status").GetString().Should().Be("Cancelled");
    }

    [Fact]
    public async Task CancelOrder_Returns409_WhenTheOrderIsAlreadyCancelled()
    {
        var id = await PlaceOrderAsync();
        await CancelAsync(id);

        var response = await CancelAsync(id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CancelOrder_Returns404_WhenTheOrderDoesNotExist()
    {
        var response = await CancelAsync(Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private Task<HttpResponseMessage> CancelAsync(Guid id) =>
        _client.PostAsync($"/orders/{id}/cancellation", content: null, TestContext.Current.CancellationToken);

    private async Task<Guid> PlaceOrderAsync()
    {
        var response = await _client.PostAsJsonAsync("/orders",
            new { customerId = "cust-1", lines = new[] { new { sku = "SKU-1", quantity = 1, unitPrice = 10m } } }, TestContext.Current.CancellationToken);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken)).GetProperty("id").GetGuid();
    }
}
