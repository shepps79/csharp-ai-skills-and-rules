# Project Context
Backend microservices supporting a kanban task board web application.

## Tech Stack
- dotnet SDK 10
- Aspire, OpenTelemetry
- EFCore, Postgres
- FastEndpoints, FluentValidation, CSharpFunctionalExtensions
- xUnit, Moq, AwesomeAssertions, TestContainers

## Commands
- build: `dotnet build`
- format: `dotnet format`
- test: `dotnet test` (integration tests need Docker for TestContainers; run per-project — e.g. `dotnet test src/TaskBoard.Identity.UnitTests` — if the full-solution run is resource-constrained)
- run (full stack via Aspire): `aspire run` or `dotnet run --project src/TaskBoard.AppHost` — orchestrates Postgres, the one-shot migrator, both APIs, and the Aspire dashboard
- add a migration: `dotnet ef migrations add <Name> --project src/TaskBoard.Identity.Infrastructure --startup-project src/TaskBoard.Identity.Infrastructure --output-dir Migrations` (swap `Identity` for `Tasks` for that service; migrations are applied at run time by `TaskBoard.MigrationService`)
- generate docker-compose: `aspire publish` (renders `compose/docker-compose.yaml`)
- restore local tools (`dotnet-ef`, `aspire`): `dotnet tool install --global dotnet-ef --version 10.0.9` and `dotnet tool install --global aspire.cli`

## Conventions
- Use conventional commits when committing code.
- Solution layout: every project — production and test — is a flat directory directly under `src/`, named exactly as its `.csproj` (e.g. `src/TaskBoard.Identity.Api`, `src/TaskBoard.Identity.UnitTests`). No top-level `tests/` directory, no `src/tests`, and no module-grouping subdirectories (no `src/identity/…`, no short names like `src/AppHost`).

# Behavior Rules
- Ask before assuming. Surface the ambiguity explicitly.
- Write the minimum code that solves the actual problem. No abstraction layers for single-use code. No clever patterns that make future maintenance harder. Nothing speculative.
- Only touch files and functions directly related to the task. If something adjacent looks wrong, flag it — don’t silently fix it.
- Touch only what you must. Clean up only your own mess.
- Say “I’m not sure” when you’re not sure. Don’t invent. Flag uncertainty explicitly.
- Always define success a criteria, and loop until verified.
- Never modify any files that are marked auto-generated.
- When making technical decisions, do not give much weight to development cost. Instead prefer quality, simplicity, robustness, scalability and long term maintainability.
- Apply a high standard to engineering practices and excellence: lint, test failures and test flakiness.

*Remember*: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring.

# Project rules
- [C# / .NET Rules](.claude/rules/dotnet.md)
- [Functional Style C# Rules](.claude/rules/dotnet-functional.md)
- [C# 14 / .NET 10 Idioms](.claude/rules/dotnet-csharp14-idioms.md)
- [Testing Rules](.claude/rules/testing.md)
- [Hexagonal Architecture Rules (C#)](.claude/rules/hexagonal-architecture.md)

# Framework and Library documentation

- ALWAYS use Context7 MCP for library/framework documentation lookups — API usage, imports, configuration, version-specific patterns, and framework-compliance checks.

# Agent Rules

## Backlog
Issues and PRDs live as GitHub issues in `SA-GenAI-Cohort1/12-richard-shephard`, managed via the `gh` CLI. See `docs/agents/backlog.md`.

## Triage labels
Canonical defaults in this repo. See `docs/agents/issue-labels.md`.

## Domain docs
Single-context layout: `CONTEXT.md` at the repo root, ADRs under `docs/adr/`. See `docs/agents/domain.md`.
