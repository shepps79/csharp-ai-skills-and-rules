# C# 14 / .NET 10 Idioms

**Applies to**: All C# code on `net10.0` (not raw SQL).

The codebase is on .NET 10 and C# 14. Prefer the new idioms below; do not refactor purely for the sake of style, but adopt them in any file you are already editing (Boy Scout Rule). Apply SOLID principles, KISS, DRY, WET, and strong typing.

## Backing-field properties — use the `field` keyword

C# 14 introduces a contextual `field` keyword in property accessors that exposes the auto-generated backing field directly. Use it whenever a property's setter only needs validation or a null check.

```csharp
// BAD : Manual backing field
private string _message = string.Empty;
public string Message
{
    get => _message;
    set => _message = value ?? throw new ArgumentNullException(nameof(value));
}

// GOOD : C# 14 field keyword
public string Message
{
    get;
    set => field = value ?? throw new ArgumentNullException(nameof(value));
}
```

Reach for a manual backing field only when more than one property shares the same field, or when the field is read by code outside the property accessors.

## Extension members — `extension<T>(...)` blocks

For new helper utilities, prefer C# 14 extension blocks over the legacy `public static class XxxExtensions { public static ... }` pattern. Group multiple members for the same receiver type into a single `extension` block; this also enables extension properties (which the static-class form cannot express).

```csharp
// BAD : Legacy static-class pattern (still acceptable, but not preferred for new code)
public static class EnumerableExtensions
{
    public static bool IsEmpty<T>(this IEnumerable<T> source) => !source.Any();
    public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T?> source) where T : class
        => source.Where(item => item is not null)!;
}

// GOOD : C# 14 extension block
public static class EnumerableExtensions
{
    extension<T>(IEnumerable<T> source)
    {
        public bool IsEmpty => !source.Any();
    }

    extension<T>(IEnumerable<T?> source) where T : class
    {
        public IEnumerable<T> WhereNotNull() => source.Where(item => item is not null)!;
    }
}
```

## Collection expressions — `[..source]`, `[a, b, c]`

Prefer the C# 12+ collection-expression syntax. It works for arrays, `List<T>`, spans, and any `[CollectionBuilder]` type.

```csharp
// BAD
string[] array = new[] { "a", "b", "c" };
List<string> list = new List<string> { "a", "b", "c" };

// GOOD
string[] array = ["a", "b", "c"];
List<string> list = ["a", "b", "c"];
List<string> combined = [..array, ..list];
```

## Records and value types — model data with intent

Use `record` for DTOs, value objects, and other immutable data instead of a class with a hand-rolled constructor and `Equals`/`GetHashCode`. Use `readonly record struct` for small (2-3 field) value types that don't need heap allocation.

```csharp
// BAD : mutable class with hand-rolled equality
public class Money
{
    public decimal Amount { get; set; }
    public string Currency { get; set; }
}

// GOOD
public readonly record struct Money(decimal Amount, string Currency);
public record CreateTaskRequest(string Title, string? Description, Guid BoardId);
```

Use `required` on properties that must be initialized instead of a constructor written purely for validation, or a nullable property with a runtime null check.

```csharp
// BAD : nullable + runtime check
public class TaskOptions
{
    public string? ConnectionString { get; init; }
}
if (options.ConnectionString is null) throw new InvalidOperationException();

// GOOD : compiler-enforced initialization
public class TaskOptions
{
    public required string ConnectionString { get; init; }
}
```

## Pattern matching — switch expressions and property patterns over if/else chains

```csharp
// BAD
string Describe(Order order)
{
    if (order.Total > 1000) return "Premium";
    if (order.Items.Count == 0) return "Empty";
    return "Standard";
}

// GOOD
string Describe(Order order) => order switch
{
    { Total: > 1000 } => "Premium",
    { Items.Count: 0 } => "Empty",
    _ => "Standard",
};
```

List patterns deconstruct arrays/lists directly, and `is` patterns extract while checking:

```csharp
string Summarize(int[] items) => items switch
{
    [] => "Empty",
    [var only] => $"One: {only}",
    [var first, .., var last] => $"{first}..{last}",
};

if (result is { IsSuccess: true, Value: var order }) { /* use order */ }
```

Do not nest property patterns more than one level deep — extract to a method or sequential checks instead:

```csharp
// BAD : hard to read
if (order is { Customer: { Address: { Country: { Code: "US" } } } }) { }

// GOOD
if (order.Customer.Address.Country.Code == "US") { }
```

## Raw string literals — multi-line SQL, JSON, or XML

```csharp
// BAD : escaped verbatim string
var sql = "SELECT Id, Title\nFROM Tasks\nWHERE BoardId = @boardId";

// GOOD
var sql = """
    SELECT Id, Title
    FROM Tasks
    WHERE BoardId = @boardId
    """;
```

## `Span<T>` — zero-allocation slicing on hot paths

Reach for `Span<T>`/`ReadOnlySpan<T>` when slicing strings or arrays in code that already needs to avoid allocations (parsing, hot loops). Don't retrofit straightforward existing code purely for style.

```csharp
ReadOnlySpan<char> trimmed = input.Trim();
int.TryParse(trimmed[4..], out var id);
```
