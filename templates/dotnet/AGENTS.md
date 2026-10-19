# Project Context

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Tech Stack
- .NET 10 SDK, C# 14, target framework `net10.0`.
- HTTP API: ASP.NET Core minimal APIs with the built-in OpenAPI (`Microsoft.AspNetCore.OpenApi`).
- Results and errors: CSharpFunctionalExtensions.
- Outbound HTTP resilience: `Microsoft.Extensions.Http.Resilience`.
- Persistence: PostgreSQL with EF Core (`Npgsql.EntityFrameworkCore.PostgreSQL`) and EF Core migrations.

## Testing
- xUnit v3.
- AwesomeAssertions for all assertions; no xUnit `Assert.*`.
- Moq for mocks.
- Testcontainers for databases, WireMock.Net for HTTP APIs.
- `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`) for time.
- `WebApplicationFactory` (`Microsoft.AspNetCore.Mvc.Testing`) for endpoints.
- Coverage: `coverlet.collector` and `coverlet.msbuild`. `Directory.Build.targets` makes `dotnet test` fail below 80%
  line coverage.

## Runbook
Run from the repository root, where the solution file is.

| Step | Command |
|------|---------|
| Restore | `dotnet restore` |
| Build (warnings fail the build) | `dotnet build --no-restore` |
| Unit tests and coverage | `dotnet test src/<Service>.UnitTests` |
| All tests and coverage (needs Docker) | `dotnet test` |
| Add a migration | `dotnet tool restore`, then `dotnet ef migrations add <Name> --project src/<Service>.Infrastructure --startup-project src/<Service>.Api` |
| Add a package | `dotnet add <project> package <name>` (the version goes in `Directory.Packages.props`) |

Before you finish a change: build, then run all tests. Both must pass; a test run below the coverage threshold fails.
