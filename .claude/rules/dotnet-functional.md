---
description: Functional C# with errors as values, Maybe and immutability
alwaysApply: true
---
# Functional style

## Styles
- **FUNC-001** MUST apply Scott Wlaschin's railway-oriented programming with CSharpFunctionalExtensions
  (`Result<T, E>`, `UnitResult<E>`, `Maybe<T>`, `Bind`, `Map`, `Ensure`, `Tap`, `Match`).
- **FUNC-002** MUST apply Gary Bernhardt's functional core, imperative shell: Domain is pure, and side effects occur
  only in adapters and in log calls.

## Rules
- **FUNC-003** MUST return each expected failure as a value (`Result<T, Error>` or `UnitResult<Error>`): validation,
  business rules, not found and infrastructure failures — the signature then makes the caller handle it.
- **FUNC-004** MUST NOT throw, unless for a programmer error (`ArgumentNullException.ThrowIfNull`,
  `UnreachableException`), a broken invariant or stored data that fails a domain `Create` — an exception does not
  show in the signature.
- **FUNC-005** MUST use the `Error` record and the `ErrorKind` enum below, one time per service, in Domain. MUST NOT
  use string errors (`Result<T>`) — a caller maps the kind to a response without parsing text.
- **FUNC-006** MUST return `Result<Maybe<T>, Error>` from a port lookup that can find nothing. The use case changes
  absence into `Error.NotFound(...)` when absence is a failure for its caller. Use cases MUST return `Result<T, Error>`
  or `UnitResult<Error>`, never `Maybe<T>`. A port or a use case MUST return a sequence as
  `Task<Result<ImmutableArray<T>, Error>>` (FUNC-014) — an `IAsyncEnumerable<T>` cannot carry a failure (FUNC-003),
  and an adapter cannot catch an exception around a `yield` (FUNC-007).
- **FUNC-007** MUST, in an adapter, catch only the named exceptions of the technology that it wraps (`DbException`,
  `DbUpdateException`, `HttpRequestException`, `TimeoutRejectedException`, `BrokenCircuitException`) and return an
  `Error` (a unique-key violation is `Conflict`, an outage is `Unavailable`). MUST NOT catch `Exception`. MUST let
  `OperationCanceledException` go up — other exceptions are bugs and go to the global 500 handler (HEX-015).
- **FUNC-008** MUST chain fallible steps with `Bind`, `Map`, `Ensure` and `Tap`, and resolve the result with `Match` at
  the edge. In production code, MUST NOT read `IsSuccess` or `HasValue` and then `.Value` or `.Error` — that brings
  back the unchecked access that the types remove.
- **FUNC-009** MUST combine independent `Validation` results with `Result.Combine` — the caller then gets all
  validation messages at once. Combine only `Validation` errors.
- **FUNC-010** MUST NOT use `null` or `T?` for absence in Application or Domain — the compiler does not make a caller
  handle `null`. Use `T?` only at the edge, where a framework API gives `null`, and change it into `Maybe<T>`
  immediately (`Maybe.From`). Give an optional DTO field the type `Maybe<T>`, and register one System.Text.Json
  converter for `Maybe<T>` in the composition root (HEX-016): JSON `null` or no property ↔ `Maybe.None`, a value ↔
  `Maybe.From`.
- **FUNC-011** MUST NOT use the null-forgiving operator `!` — it hides a possible `null`.
- **FUNC-012** MUST keep Domain functions pure: the result depends only on the arguments, with no I/O, no field writes
  and no static state — pure code is testable without doubles. Application does I/O only through ports and an injected
  `ILogger<T>` (NET-017), which, like `TimeProvider` (HEX-010), is not a port.
- **FUNC-013** MUST NOT change an argument or a captured variable. Return a new value.
- **FUNC-014** MUST hold collections in immutable types (`ImmutableArray<T>`, `FrozenDictionary<TKey, TValue>`) and
  expose them as they are or as `IReadOnlyList<T>` or `IReadOnlyDictionary<TKey, TValue>`, never `List<T>` — a caller
  must not change the state.
- **FUNC-015** SHOULD use LINQ instead of `for`, `foreach` or `while`, unless e.g. a `Span<T>` hot path needs a loop —
  a pipeline tells what the code does, not how.

## Examples
The error type (in Domain), and a use case that is one railway:

```csharp
/// <summary>The kind of failure, which the inbound adapter maps to a response.</summary>
public enum ErrorKind
{
    /// <summary>The input breaks a rule.</summary>
    Validation,
    /// <summary>The requested item does not exist.</summary>
    NotFound,
    /// <summary>The change conflicts with the current state.</summary>
    Conflict,
    /// <summary>A dependency failed or did not respond.</summary>
    Unavailable,
}

/// <summary>A failure value; <see cref="Combine"/> merges validation messages.</summary>
/// <param name="Kind">The kind of failure.</param>
/// <param name="Messages">What went wrong, one message for each broken rule.</param>
public sealed record Error(ErrorKind Kind, ImmutableArray<string> Messages) : ICombine
{
    /// <summary>Creates a validation error.</summary>
    public static Error Validation(string message) => new(ErrorKind.Validation, [message]);

    /// <summary>Creates a not-found error.</summary>
    public static Error NotFound(string message) => new(ErrorKind.NotFound, [message]);

    /// <summary>Creates a conflict error.</summary>
    public static Error Conflict(string message) => new(ErrorKind.Conflict, [message]);

    /// <summary>Creates an unavailable error.</summary>
    public static Error Unavailable(string message) => new(ErrorKind.Unavailable, [message]);

    /// <inheritdoc />
    public ICombine Combine(ICombine value) => this with { Messages = [.. Messages, .. ((Error)value).Messages] };
}

/// <summary>Confirms a pending order. Returns Validation, NotFound or Unavailable.</summary>
public Task<Result<OrderDto, Error>> ConfirmAsync(Guid orderId, CancellationToken cancellationToken) =>
    OrderId.Create(orderId)
        .Bind(id => orders.FindPendingAsync(id, cancellationToken))
        .Bind(found => found.ToResult(Error.NotFound($"No pending order {orderId}.")))
        .Bind(pending => pending.Confirm(timeProvider.GetUtcNow()))
        .Bind(confirmed => orders.SaveAsync(confirmed, cancellationToken).Map(() => OrderDto.From(confirmed)));
```
