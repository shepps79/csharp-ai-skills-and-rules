# Project Context

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Tech Stack
- .NET 10 SDK, C# 14, target framework `net10.0`.
- HTTP API: ASP.NET Core minimal APIs with the built-in OpenAPI (`Microsoft.AspNetCore.OpenApi`).
- Results and errors: CSharpFunctionalExtensions.
- Outbound HTTP resilience: `Microsoft.Extensions.Http.Resilience`.

## Testing
- xUnit v3.
- AwesomeAssertions for all assertions; no xUnit `Assert.*`.
- Moq for mocks.
- Testcontainers for databases, WireMock.Net for HTTP APIs.
- `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`) for time.
- `WebApplicationFactory` (`Microsoft.AspNetCore.Mvc.Testing`) for endpoints.
- Coverage: `coverlet.collector` and `coverlet.msbuild`.

