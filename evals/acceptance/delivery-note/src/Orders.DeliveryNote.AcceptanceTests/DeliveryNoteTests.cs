using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;

namespace Orders.DeliveryNote.AcceptanceTests;

public sealed class DeliveryNoteTests(OrdersApi factory) : IClassFixture<OrdersApi>
{
    private static readonly object[] Lines = [new { sku = "SKU-1", quantity = 1, unitPrice = 10m }];

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task PlaceOrder_ReturnsTheNote_WhenANoteIsGiven()
    {
        var response = await _client.PostAsJsonAsync("/orders",
            new { customerId = "cust-1", lines = Lines, deliveryNote = "Leave it at the door" }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var order = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        order.GetProperty("deliveryNote").GetString().Should().Be("Leave it at the door");
    }

    [Fact]
    public async Task PlaceOrder_ReturnsANullNote_WhenNoNoteIsGiven()
    {
        var response = await _client.PostAsJsonAsync("/orders",
            new { customerId = "cust-1", lines = Lines }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var order = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        order.GetProperty("deliveryNote").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task PlaceOrder_Returns201_WhenTheNoteHas200Characters()
    {
        var response = await _client.PostAsJsonAsync("/orders",
            new { customerId = "cust-1", lines = Lines, deliveryNote = new string('a', 200) }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task PlaceOrder_Returns400_WhenTheNoteHas201Characters()
    {
        var response = await _client.PostAsJsonAsync("/orders",
            new { customerId = "cust-1", lines = Lines, deliveryNote = new string('a', 201) }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
