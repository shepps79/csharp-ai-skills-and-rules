# Hexagonal Architecture Rules (C#)

**Applies to**: All backend microservice projects (Ports & Adapters)

Hexagonal architecture (Ports and Adapters) keeps business logic independent from frameworks, transport, and persistence. The core app depends on abstract ports; adapters implement those ports at the edges.

## Layers

- **Domain**: Entities, value objects, domain services, domain events. Pure C#, no framework/NuGet infra references (no EFCore, no ASP.NET, no HTTP clients).
- **Application**: Use cases that orchestrate domain logic via ports. Defines the inbound port (use-case services) and outbound port interfaces (`I...Repository`, `I...Gateway`). May depend on Domain only.
- **Infrastructure**: Implements outbound ports (EFCore repositories, HTTP gateways, message bus publishers, `IClock`, etc.). Depends on Application (for port interfaces) and Domain.
- **Presentation**: Implements inbound adapters (minimal API endpoints/controllers). Depends on Application (for use cases/DTOs), not on Infrastructure or Domain internals directly.

## Dependency Direction

Adapters (Infrastructure, Presentation) → Application → Domain → nothing external.

- Domain has zero references to Application, Infrastructure, or Presentation projects.
- Application references Domain only.
- Infrastructure references Application (to implement its outbound ports) and Domain.
- Presentation references Application (to invoke use cases and bind DTOs).
- Enforce this with project references: a lower layer must not reference a project that references it back. If a `.csproj` reference would violate this direction, the design is wrong — don't add the reference to make it compile.

## Ports & Adapters

- **Inbound ports**: The public methods of a `sealed` use-case service in Application (e.g. `OrderService.PlaceOrderAsync`), taking and returning DTOs, not domain entities. Don't wrap the service in an `I...UseCase` interface: inbound adapters are tested against the real service, so the interface would have one implementation (see "Ports earn their place" below). Add one only when a second implementation genuinely exists.
- **Outbound ports**: Interfaces in Application describing dependencies the use case needs (e.g. `ITaskRepository`, `IClock`). Model capabilities, not technologies — `ITaskRepository`, not `IEfCoreTaskRepository`.
- **Adapters**: Concrete implementations of ports, living in Infrastructure (outbound: EFCore repository, external gateway) or Presentation (inbound: minimal API endpoint mapping HTTP request → use-case input).
- Mapping between wire/DB shapes and domain/application DTOs happens in the adapter, never inside the use case.
- The composition root (`Program.cs` / `Configuration/Registrations.cs`) is the single place adapters are bound to ports via DI. No service-locator lookups elsewhere.

## Rules

- No framework imports in Domain (no `Microsoft.EntityFrameworkCore`, no `Microsoft.AspNetCore.*` in Domain projects).
- No direct DB or HTTP calls in Application — all side effects go through outbound ports.
- Use cases return plain DTOs, not `DbContext` entities or EFCore-tracked types.
- Errors crossing a boundary are translated (e.g. `DbUpdateException` → an application/domain exception), not leaked upward.
- Don't introduce a port for a dependency that has exactly one call site and no plausible second implementation (e.g. a static `DateTime.UtcNow` doesn't need `IClock` unless tests need to control it) — see CLAUDE.md's "nothing speculative" rule. Ports earn their place by actually being swapped (real vs. fake in tests, or a genuine second adapter).

## Testing

- Unit test use TestContainers implementations of outbound ports — no real DB, no HTTP.
- Integration test adapters (EFCore repositories, gateways) against TestContainers infrastructure.
- Domain entities/value objects are tested directly with no mocks.
