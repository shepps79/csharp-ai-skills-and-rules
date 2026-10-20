---
description: Domain model design with DDD and type-driven design
alwaysApply: true
---
# Domain-driven design

## Styles
- **DDD-001** MUST apply Eric Evans' ubiquitous language, one bounded context per service, aggregates, entities, value
  objects and domain services. Do not apply context mapping, specifications, domain events, core-domain triage or
  Evans' place for repository interfaces (see HEX-003).
- **DDD-002** MUST apply the type-driven design of Scott Wlaschin's *Domain Modeling Made Functional*: make illegal
  states unrepresentable, parse instead of validate, constrained simple types, one type for each lifecycle state.
  Do not apply its F# workflow structure (HEX-001 gives the structure).

## Rules
- **DDD-003** MUST model a domain value that has a rule (an id, a quantity, an email, money) as a constrained type, not
  as a primitive — after creation, the value is always valid.
- **DDD-004** MUST make each type that has an invariant a `sealed record` with a private constructor, get-only
  properties and a static `Create` that returns `Result<T, Error>`, instead of a positional record or a
  `readonly record struct` — their public `init`, `with` and `default` skip the validation. An entity that DDD-012
  changes with `with` has `private init` properties instead (`private protected init` on a base record).
- **DDD-005** MUST NOT check again what a constrained type already guarantees — the type is the check.
- **DDD-006** MUST parse the primitives of a request into constrained types one time, in the use case, before it calls
  the domain — Presentation cannot see Domain, and the domain then gets only valid values.
- **DDD-007** MUST NOT pass an Application DTO into Domain — Domain must not depend on Application.
- **DDD-008** MUST model each lifecycle state of an entity as its own type, instead of a status field. A transition
  takes the specific state type and returns the next one (`Confirm` takes `PendingOrder` and returns
  `Result<ConfirmedOrder, Error>`) — an invalid transition then does not compile.
- **DDD-009** MUST make each state type a top-level `sealed record` that derives from an abstract base record with a
  `private protected` constructor, and add each state to `Match` — C# cannot close a record hierarchy, so `Match` is
  what makes the build show each caller.
- **DDD-010** MUST, when code must accept any state, use one `Match` method on the base type that has one `Func`
  parameter for each state. MUST NOT use `switch` or `is` on state types outside `Match` — a new state adds a
  parameter, and the build then shows each caller.
- **DDD-011** MUST give each state type a public static `Create` that checks the invariants of that state, not the
  transition rules — adapters use it to rebuild the state from storage; only transitions move between states.
- **DDD-012** MUST change an entity only through its own methods, which use `with` and return a new instance — the
  type must protect its invariants.
- **DDD-013** MUST compare entities by `Id`, never with `==` or `Equals` — record equality compares all fields and
  compares collections by reference.
- **DDD-014** MUST write a domain service only for logic that spans aggregates. It is pure and stateless, uses no
  ports and has the name of the domain activity (`PricingPolicy`) — logic of one aggregate belongs on that aggregate.

## Examples
A constrained type, and a lifecycle with two states:

```csharp
/// <summary>A count of items that is always greater than zero.</summary>
public sealed record Quantity
{
    private Quantity(int value) => Value = value;

    /// <summary>The count.</summary>
    public int Value { get; }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when <paramref name="value"/> is not positive.</summary>
    public static Result<Quantity, Error> Create(int value) =>
        value > 0 ? new Quantity(value) : Error.Validation("Quantity must be greater than zero.");
}

/// <summary>An order in one of its lifecycle states.</summary>
public abstract record Order
{
    private protected Order(OrderId id, ImmutableArray<OrderLine> lines)
    {
        Id = id;
        Lines = lines;
    }

    /// <summary>The identity of the order.</summary>
    public OrderId Id { get; }

    /// <summary>The ordered lines; never empty.</summary>
    public ImmutableArray<OrderLine> Lines { get; }

    /// <summary>Runs the function for the current state.</summary>
    public T Match<T>(Func<PendingOrder, T> pending, Func<ConfirmedOrder, T> confirmed) => this switch
    {
        PendingOrder order => pending(order),
        ConfirmedOrder order => confirmed(order),
        _ => throw new UnreachableException(),
    };
}

/// <summary>An order that is not yet confirmed.</summary>
public sealed record PendingOrder : Order
{
    private PendingOrder(OrderId id, ImmutableArray<OrderLine> lines)
        : base(id, lines)
    {
    }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when there are no lines.</summary>
    public static Result<PendingOrder, Error> Create(OrderId id, ImmutableArray<OrderLine> lines) =>
        lines.IsEmpty ? Error.Validation("An order needs at least one line.") : new PendingOrder(id, lines);

    /// <summary>Confirms the order at <paramref name="confirmedAt"/>.</summary>
    public Result<ConfirmedOrder, Error> Confirm(DateTimeOffset confirmedAt) => ConfirmedOrder.Create(Id, Lines, confirmedAt);
}

/// <summary>An order that is confirmed.</summary>
public sealed record ConfirmedOrder : Order
{
    private ConfirmedOrder(OrderId id, ImmutableArray<OrderLine> lines, DateTimeOffset confirmedAt)
        : base(id, lines) => ConfirmedAt = confirmedAt;

    /// <summary>The instant of confirmation.</summary>
    public DateTimeOffset ConfirmedAt { get; }

    /// <summary>Returns a <see cref="ErrorKind.Validation"/> error when there are no lines.</summary>
    public static Result<ConfirmedOrder, Error> Create(OrderId id, ImmutableArray<OrderLine> lines, DateTimeOffset confirmedAt) =>
        lines.IsEmpty ? Error.Validation("An order needs at least one line.") : new ConfirmedOrder(id, lines, confirmedAt);
}
```
