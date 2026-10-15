using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Orders.Application;

namespace Orders.CustomerName.AcceptanceTests;

// Stubs the primary handler of every IHttpClientFactory client, so code that news up its own HttpClient
// reaches for the network and fails.
public sealed class CustomerNameTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private const string CustomerServiceUrl = "http://customers.test/";

    [Fact]
    public async Task PlaceOrder_ReturnsCustomerName_FromTheCustomerService()
    {
        var customerService = new StubCustomerService(HttpStatusCode.OK, """{ "name": "Ada Lovelace" }""");

        var response = await PlaceOrderAsync(customerService);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var order = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        order.GetProperty("customerName").GetString().Should().Be("Ada Lovelace");
        customerService.RequestedUris.Should().ContainSingle().Which.Should().Be(new Uri($"{CustomerServiceUrl}customers/cust-1"));
    }

    [Fact]
    public async Task PlaceOrder_Returns400_WhenTheCustomerIsUnknown()
    {
        var response = await PlaceOrderAsync(new StubCustomerService(HttpStatusCode.NotFound, ""));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private Task<HttpResponseMessage> PlaceOrderAsync(StubCustomerService customerService)
    {
        var client = factory.WithWebHostBuilder(builder => builder
                .UseSetting("Customers:BaseUrl", CustomerServiceUrl)
                .ConfigureTestServices(services => services.ConfigureHttpClientDefaults(http =>
                    http.ConfigurePrimaryHttpMessageHandler(() => customerService))))
            .CreateClient();
        var request = new PlaceOrderRequest("cust-1", [new PlaceOrderLine("SKU-1", 1, 10m)]);
        return client.PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);
    }

    private sealed class StubCustomerService(HttpStatusCode status, string json) : HttpMessageHandler
    {
        public List<Uri> RequestedUris { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestedUris.Add(request.RequestUri!);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
