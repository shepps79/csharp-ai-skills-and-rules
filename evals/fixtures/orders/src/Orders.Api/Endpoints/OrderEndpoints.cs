using CSharpFunctionalExtensions;
using Orders.Application;
using IResult = Microsoft.AspNetCore.Http.IResult;

namespace Orders.Api.Endpoints;

/// <summary>Inbound HTTP adapter for the order use cases.</summary>
public static class OrderEndpoints
{
    extension(IEndpointRouteBuilder endpoints)
    {
        /// <summary>Maps the order routes.</summary>
        public IEndpointRouteBuilder MapOrderEndpoints()
        {
            endpoints.MapPost("/orders", PlaceOrderAsync);
            return endpoints;
        }
    }

    private static async Task<IResult> PlaceOrderAsync(PlaceOrderRequest request, OrderService orders, CancellationToken cancellationToken) =>
        (await orders.PlaceOrderAsync(request, cancellationToken)).Match(
            onSuccess: order => Results.Created($"/orders/{order.Id}", order),
            onFailure: error => Results.BadRequest(error));
}
