# C# / .NET Rules

## General Principles

**Applies to**: All C# code

- **Boy Scout Rule**: "Leave the code cleaner than you found it." When touching a file, make small incremental improvements -- remove unused parameters, fix naming, clean up dead code. This reduces technical debt at the source of every commit.
- Remove unused using statements, perform a final pass through the generated code to confirm all using statements are applicable after refactors.
- Implement early return checks from `if` statements.
- Apply low cyclomatic-complexity where possible.
- Build must complete without warnings or errors.
- When appropriate, prefer built in solutions over custom implementations. For example use built-in OpenAI, not Swashbuckle.
- Use XMLDOC comments for all public methods and classes. Use `<inheritdoc />` where appropriate to avoid duplication. DO NOT comment on private functions.
- Use central package management for NuGet packages. Do not add package references to individual projects. Only add package references to the `Directory.Packages.props` file in the root of the repo. If a package is not already referenced, add it to the `Directory.Packages.props` file and run `dotnet restore` to update all projects. Commit package additions/removals as a separate commit from any code changes.
- Use `dotnet add` for package management - do not add packages manually.
- Implement positive logic conditions rather than negative condition.
```csharp
// BAD : Negative check
if (!container.ContainsKey(key))
{
    container.CreateKey(key);
}
return container;

// GOOD : Positive check
if (container.ContainsKey(key))
{
    return container;
}
container.CreateKey(key);
return container;
```

## Member Ordering

**Applies to**: All classes and structs
**Rule**: Order members within a class/struct as follows:

1. Constants and static readonly fields.
2. Instance fields (private `_camelCase`).
3. Constructors.
4. Public properties.
5. Public methods.
6. Internal/protected methods.
7. Private methods.

Hard requirement: never place a private method above a public/internal/protected method in the same type. If a private helper is introduced while editing, move it to the private-method section at the end before finishing.

## Naming

**Applies to**: All C# code
**Rule**: Follow [Microsoft C# coding conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions) and the [.NET Runtime coding style](https://github.com/dotnet/runtime/blob/main/docs/coding-guidelines/coding-style.md).

- Private fields: `_camelCase` (underscore prefix).
- Constants: `PascalCase`.
- Local variables and parameters: `camelCase`.
- Methods, properties, classes, interfaces: `PascalCase`.
- Interfaces: `IPascalCase` (prefix with `I`).
- Always use `var` when the type is apparent.
- Use language keywords (`string`, `int`) not framework types (`String`, `Int32`).

## Code Style

- File-scoped namespaces (enforced at warning level): `namespace X.Y.Z;`.
- Braces required for all control flow statements.
- Prefer primary constructors for new code; traditional constructors with `?? throw new ArgumentNullException(nameof(...))` or `ArgumentNullException.ThrowIfNull(...)` also acceptable.
- Use structured logging with `ILogger<T>` -- never string interpolation in log calls: `_logger.LogInformation("Processing {Count} forms", count)`.
- Async methods must have the `Async` suffix.
- Pass `CancellationToken` through async chains.
- Use `sealed` on classes that are not designed for inheritance.
- Nullable reference types: use `string?` for nullable, null-conditional `?.`, null-coalescing `??`.
- Use `nameof` for types not `typeof(...).Name`.
- Do not use redundant qualifiers with fully qualified names that can be imported - `using System.Data;` should be used instead of `System.Data.ConnectionState.Open`.
- Do not add function comment headers, Function names should be descriptive and well formed for the functional intent. Only add comment headers if there is significant complexity that needs to be described.
- When adding comments, describe the intent of the code, not what the code is doing. The code should be self-descriptive.
- Always implement every branch of a switch statement, using `NotImplementedException` for branches not covered by implementation.
- When creating empty classes, especially option classes, use the shorthand without `{}` for class creation and inheritance `public class SomeOption : BaseOption;`.

## Async

**Applies to**: All async C# code

- Never use `.Wait()`, `.Result`, or `.GetAwaiter().GetResult()` on a `Task` — blocks the thread and risks deadlocks. Always `await`.
- Don't create `async void` methods except event handlers; a method with nothing to return should return `Task`, not `void`.
- Avoid wrapping a call in `async`/`await` when it does nothing but return the inner task — return the task directly.
- Use `IAsyncEnumerable<T>` for asynchronous sequences instead of returning `Task<List<T>>` and materializing everything up front.
- Consider `ValueTask<T>` on hot paths to reduce allocations (same threshold as `Span<T>` above — don't retrofit for style).

## DI and Configuration

**Applies to**: Service registration and configuration binding

- Register services in a dedicated composition-root file using extension methods on `IHostApplicationBuilder`
- Use the Options pattern: `services.AddOptions<T>().Configure<IConfiguration>(...)`
- When using the Options pattern with data annotations on the options class, always call `.ValidateDataAnnotations().ValidateOnStart()` to ensure validation errors are surfaced at startup rather than at runtime
- Service lifetimes: `AddTransient` for stateless services, `AddSingleton` for config/telemetry, `AddScoped` for DB services

## Build

**Applies to**: New projects added to the solution

- Projects must explicitly set `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` in the `.csproj`
- Warnings should not be suppressed with `#pragma warning disable` without asking the user
