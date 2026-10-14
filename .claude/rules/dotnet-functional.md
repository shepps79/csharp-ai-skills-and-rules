# Functional Style C# Rules

**Applies to**: All C# code

Use functional patterns whenever possible, especially for data transformation and validation. Prefer pure functions, immutability, and explicit types for absence and failure over `null` and exceptions. Functional patterns are preferred over imperative patterns.

## Pure functions and no side effects

- A function's output must depend only on its inputs. Given the same arguments it returns the same result, and it mutates nothing observable (no field writes, no static state, no I/O interleaved with computation).
- Keep side effects (DB writes, HTTP calls, logging) at the edges — the adapters — and keep the domain/application core pure. This is the same boundary the [[hexagonal-architecture]] rules draw; functional purity is how the core stays testable without mocks.
- Do not mutate arguments. Return a new value instead of writing back into a parameter or a captured variable.

## Immutability

- Use `readonly record struct` / `record` for data (see the Records idiom in [[dotnet-csharp14-idioms]]), `init`-only properties, and `readonly` fields. Model data as immutable by default; make mutability the deliberate exception.
- Prefer immutable collections (`ImmutableArray<T>`, `ImmutableList<T>`, `FrozenDictionary<TKey,TValue>` for read-heavy lookups) or return `IReadOnlyList<T>` / `IReadOnlyDictionary<,>` from public APIs. Never expose a mutable `List<T>` you intend callers not to change.
- Build new collections with LINQ and collection expressions rather than allocating then mutating.

## Prefer LINQ over loops

Avoid `for` / `while` / `foreach` where a LINQ pipeline expresses the same transformation. Prefer `Select`, `Where`, `Aggregate`, `SelectMany`, `Zip`, `GroupBy`.

```csharp
// BAD : imperative accumulation
var totals = new List<decimal>();
foreach (var order in orders)
{
    if (order.IsPaid)
    {
        totals.Add(order.Total);
    }
}

// GOOD : declarative pipeline
var totals = orders.Where(o => o.IsPaid).Select(o => o.Total).ToList();
```

Keep a loop only when it is genuinely clearer (complex short-circuiting, `Span<T>` hot paths, or when LINQ would force multiple enumerations of an expensive source).

## Expression-bodied members

For members with a single expression, prefer expression-bodied over block-bodied.

```csharp
// BAD
public int Add(int a, int b)
{
    return a + b;
}

// GOOD
public int Add(int a, int b) => a + b;
```

## Never use `null` to model absence — use `Maybe<T>`

`null` is not a value the caller is forced to handle; it is a landmine. Model "there might be nothing here" with `Maybe<T>` (`Some`/`None`) so absence is part of the type and the compiler makes the caller deal with it.

```csharp
// BAD : caller can forget the null check; NRE at runtime
public Task<Order?> FindByIdAsync(Guid id, CancellationToken ct);

// GOOD : absence is explicit and must be handled
public Task<Maybe<Order>> FindByIdAsync(Guid id, CancellationToken ct);

// consume by matching, not by null-checking
var label = order.Match(
    Some: o => o.CustomerId,
    None: () => "unknown");
```

- Do not return `null`, and do not accept `null` as a meaningful argument. If a parameter is optional, take `Maybe<T>` (or provide an overload), not a nullable you special-case.
- Nullable reference types (`string?`) stay on **only** for interop at the boundary with framework/third-party APIs that hand you `null` (EF Core, `TryGet…`, config binding). Convert that `null` into `Maybe<T>` in the adapter immediately (`Maybe.From(value)`), then work with `Maybe<T>` inward. Never let a raw `null` propagate past the adapter into the domain.
- Never "unwrap" carelessly (`.Value` on a `Maybe` without a `HasValue` guard, `!`). Resolve a `Maybe` with `Match`, `GetValueOrDefault`, `Map`, or `Bind`.

## Model failure with `Result`, not exceptions

Expected, recoverable failures (validation, not-found-that-matters, business-rule violations) are return values, not control flow. Use `Result` (success/failure, no value), `Result<T>` (a value or an error message), or `Result<T, TError>` (a value or a typed error).

```csharp
// BAD : exceptions for expected validation failure
public Order Place(CreateOrderRequest request)
{
    if (request.Items.Count == 0)
    {
        throw new ValidationException("at least one item");
    }
    // ...
}

// GOOD : failure is a value the caller must handle
public Result<Order> Place(CreateOrderRequest request) =>
    request.Items.Count == 0
        ? Result.Failure<Order>("at least one item required")
        : Result.Success(Order.Create(request));
```

- Reserve `throw` for genuinely exceptional, non-recoverable conditions (programmer error, corrupt state, infrastructure that is down). Business outcomes are not exceptions.
- Translate exceptions from adapters (e.g. `DbUpdateException`) into a `Result` failure at the boundary — do not leak infrastructure exceptions upward (matches [[hexagonal-architecture]]).
- Aggregate independent validations with `Result.Combine(...)` so the caller gets **all** failures at once, not just the first.

## Compose, don't branch — railway-oriented style

Chain `Maybe`/`Result`-returning steps with `Map` (transform the success value) and `Bind` (sequence the next fallible step), collapsing to a concrete value only at the edge with `Match`. This replaces nested `if`/`null`-check pyramids.

```csharp
// GOOD : each step short-circuits on failure; one place resolves the outcome
public async Task<IResult> Handle(CreateOrderRequest request, CancellationToken ct) =>
    (await ValidateRequest(request)
        .Bind(LoadCustomer)
        .Bind(customer => PlaceOrder(customer, request)))
    .Match(
        onSuccess: order => Results.Created($"/orders/{order.Id}", order),
        onFailure: error => Results.BadRequest(error));
```

- Avoid mixing paradigms: once a value is a `Maybe`/`Result`, keep it in the monad until the final `Match`; don't unwrap early to run imperative branches.
- Prefer `Match` over `IsSuccess`/`HasValue` boolean checks followed by `.Value` — the boolean-then-access pattern reintroduces the very foot-gun these types remove.

## Library

These types are not in the BCL. This solution uses **CSharpFunctionalExtensions** (`Maybe<T>`, `Result`, `Result<T>`, `Result<T, TError>`, plus `Map`/`Bind`/`Match`/`Tap`/`Ensure`/`Combine`). Use it solution-wide rather than hand-rolling these types or mixing in a second functional library. Add it via central package management in `Directory.Packages.props`.
