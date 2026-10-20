---
description: Hexagonal architecture with ports, adapters and the composition root
alwaysApply: true
---
# Hexagonal architecture

## Styles
- **HEX-001** MUST apply Alistair Cockburn's hexagonal architecture (ports and adapters) with four projects for each
  service: Domain, Application, Infrastructure and an Api project for Presentation.

## Rules
- **HEX-002** MUST point project references only in these directions: Api → Application, Api → Infrastructure (only
  for the composition root, HEX-016), Infrastructure → Application, Application → Domain, Domain → nothing. MUST NOT
  add a reference against them — a reference that goes back means the design is wrong.
- **HEX-004** MUST put each outbound port, repositories included, in Application, with the name of the capability
  (`IOrderRepository`, not `IEfOrderRepository`) — ports then have one home.
- **HEX-005** MUST write inbound ports as the public methods of a sealed `<Aggregate>Service` class in Application.
  MUST NOT add an `I...UseCase` interface — it has one implementation, and tests use the real service.
- **HEX-006** MUST return Application DTOs from use cases, never a domain type or a row type — domain internals then
  stay off the wire.
- **HEX-007** MUST use only Application types and Domain's `Error` and `ErrorKind` in the Api project, outside the
  composition root (HEX-016) — Presentation does not know the domain model.
- **HEX-008** MUST map wire ↔ DTO in Api, DTO ↔ domain in Application (DDD-006) and row ↔ domain in Infrastructure.
  Infrastructure owns its row types; domain types have no EF attributes and no parameterless constructors — storage
  then cannot change the domain.
- **HEX-009** MUST NOT add a port for a dependency that does no I/O — a port is useful only when tests or a second
  adapter replace it.
- **HEX-010** MUST get the time from an injected `System.TimeProvider` in Application and adapters, and pass the instant
  into Domain as a `DateTimeOffset`. MUST NOT use `DateTime.Now`, `DateTime.UtcNow`, `DateTimeOffset.Now` or
  `DateTimeOffset.UtcNow` — tests then control the time.
- **HEX-011** MUST call an HTTP API through a typed client registered with `AddHttpClient<TClient>()` and
  `AddStandardResilienceHandler()`. MUST NOT create an `HttpClient` with `new` — the factory manages sockets, and the
  handler adds retries and timeouts.
- **HEX-012** MUST write inbound HTTP adapters as ASP.NET Core minimal APIs: one `MapGroup` for each aggregate,
  and `TypedResults`.
- **HEX-013** MUST map `Error` to ProblemDetails in one place: `Validation` 400, `NotFound` 404, `Conflict` 409,
  `Unavailable` 503 — all endpoints then give the same status for the same failure.
- **HEX-014** SHOULD return the Application DTO as the response body, unless e.g. the wire shape must differ — a
  second type that only copies the DTO adds nothing. A `Maybe<T>` field does not make the wire shape differ (FUNC-010).
- **HEX-015** MUST handle each exception that gets to the host in one handler that returns a 500 ProblemDetails
  (`AddProblemDetails` with `UseExceptionHandler`) — exceptions are bugs, not results.
- **HEX-016** MUST bind adapters to ports only in the composition root: extension members on
  `IHostApplicationBuilder` that `Program.cs` calls. MUST NOT resolve services elsewhere — one place shows all bindings.

## Examples
```csharp
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
```
