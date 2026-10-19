using System.Net;
using System.Net.Http.Json;
using AwesomeAssertions;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Orders.Application;
using Orders.Domain;
using Orders.UnitTests.Fakes;

namespace Orders.UnitTests.Api;

public sealed class OrderEndpointsTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly PlaceOrderRequest ValidRequest = new("cust-1", [new PlaceOrderLine("SKU-1", 2, 10m)]);

    [Fact]
    public async Task PlaceOrder_Returns201WithSummary_WhenRequestIsValid()
    {
        var response = await ClientWith(new InMemoryOrderRepository()).PostAsJsonAsync("/orders", ValidRequest, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var summary = await response.Content.ReadFromJsonAsync<OrderSummary>(TestContext.Current.CancellationToken);
        summary.Should().BeEquivalentTo(new { CustomerId = "cust-1", Status = "Confirmed", Total = 20m });
    }

    [Fact]
    public async Task PlaceOrder_Returns400WithEveryMessage_WhenRequestIsInvalid()
    {
        var request = new PlaceOrderRequest(string.Empty, [new PlaceOrderLine("SKU-1", 0, 10m)]);

        var response = await ClientWith(new InMemoryOrderRepository()).PostAsJsonAsync("/orders", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestContext.Current.CancellationToken);
        problem.Should().BeEquivalentTo(new { Detail = "Customer id is required. Quantity must be greater than zero." });
    }

    [Fact]
    public async Task PlaceOrder_Returns409_WhenStoreReportsConflict()
    {
        var response = await ClientWith(FailingRepository(Error.Conflict("exists"))).PostAsJsonAsync("/orders", ValidRequest, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task PlaceOrder_Returns503_WhenStoreIsUnavailable()
    {
        var response = await ClientWith(FailingRepository(Error.Unavailable("down"))).PostAsJsonAsync("/orders", ValidRequest, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    private static IOrderRepository FailingRepository(Error error)
    {
        var repository = new Mock<IOrderRepository>();
        repository.Setup(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>())).ReturnsAsync(UnitResult.Failure(error));
        return repository.Object;
    }

    private HttpClient ClientWith(IOrderRepository repository) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => services.AddSingleton(repository)))
            .CreateClient();
}
