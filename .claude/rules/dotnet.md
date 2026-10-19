---
description: C# and .NET conventions, build guards, packages, async and DI
alwaysApply: true
---
# C# / .NET conventions

## Styles
- **NET-001** MUST apply Microsoft's C# coding conventions and the .NET Runtime coding style.

## Rules
- **NET-002** MUST NOT change the analyzer or build settings in `.editorconfig`, `Directory.Build.props`,
  `Directory.Build.targets` or `Directory.Packages.props`, and MUST NOT suppress a diagnostic (`#pragma warning disable`, `<NoWarn>`,
  `[SuppressMessage]`, `severity = none`, `<Nullable>disable`). Change the code — the build is the quality gate.
- **NET-003** MUST, in a new solution, create a `Directory.Build.props` that sets `TargetFramework`, `Nullable` enable,
  `TreatWarningsAsErrors`, `EnforceCodeStyleInBuild` and `GenerateDocumentationFile` — without them the build does
  not enforce the rules.
- **NET-004** MUST use central package management: versions only in `Directory.Packages.props`, `PackageReference`
  without `Version` in projects, added with `dotnet add package` — one place holds all versions.
- **NET-005** MUST use file-scoped namespaces.
- **NET-006** MUST use braces on each control-flow block.
- **NET-007** MUST use `var` when the type is apparent, and language keywords (`string`, `int`) instead of framework
  type names.
- **NET-008** MUST name private fields `_camelCase`; constants and static readonly fields `PascalCase`; interfaces
  `IPascalCase`; locals and parameters `camelCase`.
- **NET-009** MUST end the name of an async method with `Async`, except a test method.
- **NET-010** MUST order members: constants and static readonly fields, instance fields, constructors, properties,
  public methods, internal and protected methods, private methods.
- **NET-011** MUST make a class `sealed`, unless it is designed for inheritance — the build checks only internal classes.
- **NET-012** MUST remove unused `using` directives, parameters, private members and assignments.
- **NET-013** MUST use `nameof` instead of a string literal or `typeof(...).Name`, and a `using` directive instead of
  a fully qualified name.
- **NET-014** MUST use `ArgumentNullException.ThrowIfNull` for a null guard.
- **NET-015** SHOULD use a primary constructor, unless e.g. the constructor must validate an argument.
- **NET-016** MUST use a built-in .NET feature instead of a package or custom code when one exists — built-ins are
  maintained with the runtime.
- **NET-017** MUST log through `ILogger<T>` with message templates (`"Processing {Count} orders"`), never with string
  interpolation.
- **NET-018** MUST NOT block on a task (`.Wait()`, `.Result`, `.GetAwaiter().GetResult()`), and MUST NOT write
  `async void` except for an event handler — blocking causes deadlocks.
- **NET-019** MUST pass the `CancellationToken` through each async call; each public async method takes one as its
  last parameter.
- **NET-020** MUST return the inner task directly when a method only awaits one call, unless the call is in a `using`
  or `try` block — the extra state machine does nothing.
- **NET-021** MUST return `IAsyncEnumerable<T>` for an async sequence outside the railway (for example, a streaming
  endpoint) instead of `Task<List<T>>` — the caller can stream it. A port or a use case follows FUNC-006.
- **NET-022** MUST bind configuration with `AddOptions<T>().BindConfiguration(...)`, and add
  `.ValidateDataAnnotations().ValidateOnStart()` when the options class has data annotations — bad configuration then
  fails at startup.
- **NET-023** MUST register stateless services as transient, configuration and telemetry as singleton, and services
  that use a `DbContext` as scoped.
