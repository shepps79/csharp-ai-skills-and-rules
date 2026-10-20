using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;

namespace Orders.CustomerOrders.AcceptanceTests;

public sealed class CustomerOrdersTests(OrdersApi factory) : IClassFixture<OrdersApi>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task ListOrders_ReturnsTheCustomersOrders_WhenTheCustomerHasOrders()
    {
        var first = await PlaceOrderAsync("cust-with-orders");
        var second = await PlaceOrderAsync("cust-with-orders");
        await PlaceOrderAsync("cust-other");

        var response = await _client.GetAsync("/customers/cust-with-orders/orders", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var orders = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        orders.EnumerateArray().Select(order => order.GetProperty("id").GetGuid()).Should().BeEquivalentTo([first, second]);
    }

    [Fact]
    public async Task ListOrders_ReturnsAnEmptyList_WhenTheCustomerHasNoOrders()
    {
        var response = await _client.GetAsync("/customers/cust-without-orders/orders", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var orders = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        orders.GetArrayLength().Should().Be(0);
    }

    private async Task<Guid> PlaceOrderAsync(string customerId)
    {
        var response = await _client.PostAsJsonAsync("/orders",
            new { customerId, lines = new[] { new { sku = "SKU-1", quantity = 1, unitPrice = 10m } } }, TestContext.Current.CancellationToken);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken)).GetProperty("id").GetGuid();
    }
}
