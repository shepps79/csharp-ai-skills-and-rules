# Project Context

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Tech Stack
- .NET 10 SDK, C# 14, target framework `net10.0`.
- HTTP API: ASP.NET Core minimal APIs with the built-in OpenAPI (`Microsoft.AspNetCore.OpenApi`).
- Results and errors: CSharpFunctionalExtensions.
- Outbound HTTP resilience: `Microsoft.Extensions.Http.Resilience`.
- Persistence: PostgreSQL with EF Core (`Npgsql.EntityFrameworkCore.PostgreSQL`) and EF Core migrations.
- Analyzers, as `GlobalPackageReference` items in `Directory.Packages.props`: `StyleCop.Analyzers`,
  `Microsoft.VisualStudio.Threading.Analyzers` and `Meziantou.Analyzer`, with
  `<MeziantouAnalysisMode>None</MeziantouAnalysisMode>` in `Directory.Build.props`; `.editorconfig` turns on only the
  analyzer rules that the project uses.

## Testing
- xUnit v3.
- AwesomeAssertions for all assertions; no xUnit `Assert.*`.
- Moq for mocks.
- Testcontainers for databases, WireMock.Net for HTTP APIs.
- `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`) for time.
- `WebApplicationFactory` (`Microsoft.AspNetCore.Mvc.Testing`) for endpoints.
- Coverage: `coverlet.msbuild`. `Directory.Build.targets` makes `dotnet test` fail below 80% line coverage.

## Structure
```
src/
  <Service>.Domain/              Error.cs, one file for each aggregate or value object
  <Service>.Application/         <Aggregate>Service.cs, I<Capability>.cs, <UseCase>Request.cs, <Aggregate>Dto.cs
  <Service>.Infrastructure/
    Persistence/                     <Service>DbContext.cs, <Entity>Row.cs, Postgres<Capability>.cs, Migrations/
    Clients/                         Http<Capability>.cs: typed HTTP clients, with their wire records
  <Service>.Api/
    Program.cs
    Configuration/Registrations.cs   Add<Service>(): the composition root
    Endpoints/                       <Aggregate>Endpoints.cs, ErrorResults.cs
    Json/                            JSON converters
  <Service>.UnitTests/           Domain/, Application/, Api/, Fakes/
  <Service>.IntegrationTests/    PostgresDatabase.cs, Api/, Infrastructure/Clients/
```
A test class is `<Class under test>Tests`, in the folder of the layer of that class. In IntegrationTests, only HTTP
clients have tests in `Infrastructure/`: the endpoint tests in `Api/` test the repositories.

## Runbook
Run from the repository root, where the solution file is.

| Step | Command |
|------|---------|
| Restore | `dotnet restore` |
| Build (warnings fail the build) | `dotnet build --no-restore` |
| Unit tests and coverage | `dotnet test src/<Service>.UnitTests` |
| All tests and coverage (needs Docker) | `dotnet test` |
| Add a migration | `dotnet tool restore`, then `dotnet ef migrations add <Name> --project src/<Service>.Infrastructure --startup-project src/<Service>.Api --output-dir Persistence/Migrations` |
| Add a package | `dotnet add <project> package <name>` (the version goes in `Directory.Packages.props`) |

Before you finish a change: build, then run all tests. Both must pass; a test run below the coverage threshold fails.
