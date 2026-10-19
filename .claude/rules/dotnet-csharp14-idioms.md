---
description: C# 14 and .NET 10 language idioms
alwaysApply: true
---
# C# 14 / .NET 10 idioms

## Styles
- **CS14-001** MUST use the C# 14 and .NET 10 idioms below in the code that you write or change (DESIGN-007).

## Rules
- **CS14-002** MUST use the `field` keyword in a property accessor that only validates, instead of a manual backing
  field, unless more than one member uses the field.
- **CS14-003** MUST write new extension members in `extension(...)` blocks instead of static methods with `this` —
  a block groups the members of one receiver and allows extension properties.
- **CS14-004** MUST use collection expressions (`[a, b]`, `[.. source]`).
- **CS14-005** MUST use a positional `record` for data without an invariant (DTOs, row types), and a
  `readonly record struct` for such data with 2 or 3 fields. A type with an invariant follows DDD-004.
- **CS14-006** MUST use `required` properties instead of a constructor that only forces initialization, in a type that
  is not a record (for example, an options class).
- **CS14-007** MUST use switch expressions and patterns instead of `if`/`else` chains.
- **CS14-008** MUST use an extended property pattern (`{ Customer.Address.Code: "US" }`) instead of nested property
  patterns.
- **CS14-009** MUST handle each enum member in a switch by name, and end a switch that handles all known cases with
  `_ => throw new UnreachableException()`. MUST NOT use `NotImplementedException` — it means unfinished work.
- **CS14-010** MUST use an expression body for a member that is one expression.
- **CS14-011** MUST use raw string literals (`"""`) for multi-line SQL, JSON or XML.
- **CS14-012** SHOULD NOT use `Span<T>` or `ReadOnlySpan<T>`, unless e.g. a parser or hot loop must not allocate — it
  makes code harder to read for no gain elsewhere.
