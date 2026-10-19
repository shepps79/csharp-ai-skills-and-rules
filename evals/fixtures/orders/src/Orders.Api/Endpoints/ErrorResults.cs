using System.Diagnostics;
using Microsoft.AspNetCore.Http.HttpResults;
using Orders.Domain;

namespace Orders.Api.Endpoints;

/// <summary>Maps failures to HTTP responses.</summary>
public static class ErrorResults
{
    extension(Error error)
    {
        /// <summary>The ProblemDetails response for this error.</summary>
        public ProblemHttpResult ToProblem() => TypedResults.Problem(
            detail: string.Join(" ", error.Messages),
            statusCode: error.Kind switch
            {
                ErrorKind.Validation => StatusCodes.Status400BadRequest,
                ErrorKind.NotFound => StatusCodes.Status404NotFound,
                ErrorKind.Conflict => StatusCodes.Status409Conflict,
                ErrorKind.Unavailable => StatusCodes.Status503ServiceUnavailable,
                _ => throw new UnreachableException(),
            });
    }
}
