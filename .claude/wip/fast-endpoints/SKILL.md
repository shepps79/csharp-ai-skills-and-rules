---
name: fast-endpoints
description: >- 
  Build performant REST APIs with FastEndpoints in ASP.NET Core.
  Use when:
  (1) Creating new API endpoints with request/response DTOs
  (2) Implementing REPR pattern (Request-Endpoint-Response)
  (3) Adding validation with FluentValidation
  (4) Configuring authentication/authorization (JWT, cookies, policies)
  (5) Setting up Swagger/OpenAPI documentation
  (6) Implementing pre/post processors
  (7) Working with command/event bus patterns
  (8) Handling file uploads
  (9) Creating domain entity mappers.
  FastEndpoints provides minimal-API performance with controller-like organization.
---

# FastEndpoints

High-performance REST API framework for ASP.NET Core using the REPR (Request-Endpoint-Response) pattern.

## Quick Start

```csharp
// Program.cs
var bld = WebApplication.CreateBuilder();
bld.Services.AddFastEndpoints();
var app = bld.Build();
app.UseFastEndpoints();
app.Run();
```

## Endpoint Structure

```csharp
public class CreateUserRequest
{
    public string Name { get; set; }
    public int Age { get; set; }
}

public class CreateUserResponse
{
    public int Id { get; set; }
    public string FullName { get; set; }
}

public class CreateUserEndpoint : Endpoint<CreateUserRequest, CreateUserResponse>
{
    public override void Configure()
    {
        Post("/api/users");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CreateUserRequest req, CancellationToken ct)
    {
        await SendAsync(new CreateUserResponse
        {
            Id = 1,
            FullName = req.Name
        });
    }
}
```

| Base Class | Use Case |
|------------|----------|
| `Endpoint<TRequest>` | Request only |
| `Endpoint<TRequest, TResponse>` | Request + Response |
| `EndpointWithoutRequest` | No DTOs |
| `EndpointWithoutRequest<TResponse>` | Response only |

Fluent alternative: `Ep.Req<TRequest>.Res<TResponse>`. Endpoints can also be configured with attributes (`[HttpPost]`, `[Authorize]`, `[AllowAnonymous]`) instead of overriding `Configure()` — see [api-reference.md](references/api-reference.md#endpoint-configuration-methods) for the full fluent method list.

## Model Binding

Binding priority (highest to lowest): JSON Body → Form → Route → Query → Claims → Headers. Properties bind by name automatically; use attributes like `[FromHeader]`, `[FromClaim]`, `[QueryParam]`, or `[BindFrom("name")]` to override — see [api-reference.md](references/api-reference.md#binding-attributes) for the full attribute list and manual binding (`Route<int>("id")`, `Query<int>("page")`).

## Validation

Uses FluentValidation (included automatically).

```csharp
public class CreateUserValidator : Validator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MinimumLength(3).WithMessage("Name too short");

        RuleFor(x => x.Age)
            .InclusiveBetween(18, 120);
    }
}
```

Validation runs automatically before `HandleAsync` and sends a 400 on failure. For manual validation (`AddError`, `ThrowIfAnyErrors`, `ThrowError`) or disabling auto-validation (`DontThrowIfValidationFails`), see [api-reference.md](references/api-reference.md#validation-methods).

## Dependency Injection

```csharp
// Property injection — auto-injected
public class MyEndpoint : Endpoint<MyRequest>
{
    public IUserService UserService { get; set; }
}

// Constructor injection also works, or resolve manually:
var service = Resolve<IUserService>();     // throws if not found
var service = TryResolve<IUserService>();  // returns null if not found
```

Pre-resolved services: `Config` → `IConfiguration`, `Env` → `IWebHostEnvironment`, `Logger` → `ILogger`.

## Also Covered

The rest of FastEndpoints works as documented upstream — [api-reference.md](references/api-reference.md) is the full reference for each:

- **Responses** — `SendAsync`/`SendOkAsync`/etc., the `Response` property, `Task<Void>` early returns, `ExecuteAsync` with `TypedResults`.
- **Security** — JWT/cookie auth setup, `Roles()`/`Permissions()`/`Policies()` on `Configure()`.
- **Pre/Post Processors** — `IPreProcessor<T>`/`IPostProcessor<T,R>`, global processors.
- **Mappers** — `Mapper<TRequest, TResponse, TEntity>` for entity mapping.
- **Command/Event Bus** — `ICommand`/`ICommandHandler`, `IEventHandler`, `PublishAsync`.
- **File Uploads** — `AllowFileUploads()`, the `Files` collection, streaming large uploads.
- **Swagger/OpenAPI** — `SwaggerDocument()`, `Summary()`, `Description()`.
- **Global Configuration** — route prefixes, serialization, error format, via `UseFastEndpoints(c => ...)`.

## Testing

See [testing.md](references/testing.md) for integration and unit testing patterns.

## API Reference

See [api-reference.md](references/api-reference.md) for complete method reference.
