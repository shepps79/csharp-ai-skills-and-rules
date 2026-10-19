using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Orders.Application;

namespace Orders.Api.Endpoints;

/// <summary>Inbound HTTP adapter for the order use cases.</summary>
public static class OrderEndpoints
{
    extension(IEndpointRouteBuilder endpoints)
    {
        /// <summary>Maps the order routes.</summary>
        public RouteGroupBuilder MapOrderEndpoints()
        {
            var orders = endpoints.MapGroup("/orders");
            orders.MapPost(string.Empty, PlaceOrderAsync);
            return orders;
        }
    }

    private static async Task<Results<Created<OrderSummary>, ProblemHttpResult>> PlaceOrderAsync(
        PlaceOrderRequest request, OrderService orders, CancellationToken cancellationToken) =>
        (await orders.PlaceOrderAsync(request, cancellationToken)).Match(
            onSuccess: Results<Created<OrderSummary>, ProblemHttpResult> (order) => TypedResults.Created($"/orders/{order.Id}", order),
            onFailure: error => error.ToProblem());
}
