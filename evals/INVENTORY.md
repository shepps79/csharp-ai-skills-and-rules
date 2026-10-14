# Rule inventory

Every rule in `AGENTS.md` and `.claude/rules/*.md`, the grader that checks it, and the task that exercises it.

Grader types, most trusted first:

- **C**: compiler/analyzer. Enforced by `fixture/.editorconfig` with `TreatWarningsAsErrors`. Every task's build gate checks it. There is no dedicated task, and the prose rule is a cut candidate.
- **S**: structural script over the diff, the csproj files, the file tree or the git log.
- **D**: diff scope. Detects files or methods changed outside an expected set.
- **B**: behavioural. Checks the transcript for something that has no code signal.
- **J**: LLM judge. A binary rubric item with a quoted line as evidence.
- **—**: not gradeable here, with the reason given.

Every task also runs the **gate**: `dotnet build` (warnings as errors), `dotnet format --verify-no-changes`, and `dotnet test --filter Category!=Integration`.

## Decisions (from grilling)

| Topic | Decision |
|---|---|
| Fixture | Generic Orders service in `evals/fixture/`. Its stack is only what the rules name: minimal APIs, EF Core + Npgsql, CSharpFunctionalExtensions, xUnit v3, AwesomeAssertions, Moq, Testcontainers, WebApplicationFactory., copied to a temp dir and `git init`'d for each run. The agent never sees `evals/`. |
| Scope | Rules now. Skills are loaded as part of the variant but not graded yet. |
| Pass bar | A task passes for a variant when at least 4 of 5 reps pass every grader. |
| Isolation | `--setting-sources project --strict-mcp-config`, verified with canary words: `AGENTS.md`, `.claude/rules` and project skills load; user CLAUDE.md, RTK, the ponytail hook, user plugins and MCP do not. |
| AGENTS.md | Loaded by Claude Code (verified). The `current` variant is the live repo files. |
| Variants | `current` = the live repo `AGENTS.md` + `.claude/` (rules and skills). `none` = no `AGENTS.md`, rules or skills; just the model plus the fixture, including its `.editorconfig`. Any folder in `evals/variants/` is copied in as-is. |
| Models | `EVAL_MODEL` (default `sonnet`), `EVAL_EFFORT`, `EVAL_JUDGE_MODEL`, `EVAL_BUDGET` (default `3`) USD per run. |
| Results | `results.csv` and `summary.md` are committed. Transcripts and diffs are gitignored. |
| Analyzers | Built-in SDK only (IDE*, CA*). No third-party packages. |
| Tension 1: Boy Scout vs scope | Clean up inside touched methods only. Untouched methods and other files stay as they are. |
| Tension 2: `is { IsSuccess: true }` vs Match | Match wins. The property-pattern form fails. |
| Tension 3: Moq vs TestContainers | Unit tests use Moq on outbound ports. TestContainers is for integration tests only. |
| Judge calibration | I write labelled good/bad samples and you confirm the labels. |

## AGENTS.md (rewritten: no behaviour rules)

`AGENTS.md` now holds only project context and "dotnet SDK 10". The behaviour rules below have no rule file behind them. Their tasks are kept as **failing evals** (`rules.txt: (none yet)`) and set the bar for when the rules are re-added.

| Former rule | Grader | Task | Survives elsewhere? |
|---|---|---|---|
| Conventional commits | S: commit subject regex | `add-package` | `conventional-commits` skill |
| Flat `src/<Project>/` layout | S: tree check | `new-project` | `testing.md` (test projects only) |
| Ask before assuming, surface ambiguity | B/J | `ambiguous-request` | no |
| Minimum code, nothing speculative | J | `list-orders-endpoint`, `cancel-order` | dangling ref in `hexagonal-architecture.md:38` |
| Touch only what you must; flag adjacent issues and don't fix them | D + B | `adjacent-bug` | no |
| Say "I'm not sure", don't invent | B/J | `unknown-fact` | no |
| Never modify auto-generated files | S | `generated-file` | no |
| Loop until verified | B: build/test runs after the last edit | all (side metric) | no |
| Tech stack (FastEndpoints, FluentValidation) | — dropped. The fixture uses only what the rules name. | — | — |
| Context7 | — dropped | — | — |

## dotnet.md

| Rule | Grader | Task |
|---|---|---|
| Boy Scout Rule | D: method-level diff | `boy-scout` |
| Remove unused usings | C: IDE0005 | gate |
| Early return / low cyclomatic complexity | J | `cancel-order` |
| Build without warnings | C: gate | all |
| Prefer built-in (OpenAPI, not Swashbuckle) | S: no Swashbuckle reference | `api-docs` |
| XML docs on public members | C: CS1591 + `GenerateDocumentationFile` | gate |
| No comments on private members | S: no `///` on private members in added lines | `cancel-order` |
| Central package management (`Directory.Packages.props` only) | S: no `Version=` on `PackageReference` in csproj files | `add-package` |
| Use `dotnet add` | B: transcript contains `dotnet add … package` | `add-package` |
| Package changes in their own commit | S: the commit touching `Directory.Packages.props` touches no `.cs` | `add-package` |
| Positive conditions | J | `cancel-order` |
| Member ordering | S: approximate script (private member before non-private in added types) | `cancel-order`, `list-orders-endpoint` |
| Naming (`_camelCase`, `I` prefix, PascalCase…) | C: IDE1006 naming rules | gate |
| `var`, keywords over framework types | C: IDE0007, IDE0049 | gate |
| File-scoped namespaces, braces | C: IDE0161, IDE0011 | gate |
| Primary constructors | C: IDE0290 | gate |
| Structured logging | C: CA2254 | gate |
| `Async` suffix | C: IDE1006 naming rule on async methods | gate |
| Pass `CancellationToken` | C: CA2016 | gate |
| `sealed` on non-inheritable classes | S: new non-abstract, non-static classes are `sealed` | all code tasks |
| `nameof` over `typeof().Name` | C: IDE0082 | gate |
| No redundant qualifiers | C: IDE0001/IDE0002 | gate |
| No function header comments; comments describe intent | J | `cancel-order` |
| Every switch branch implemented, `NotImplementedException` otherwise | C (IDE0010/IDE0072) + S | `order-status-label` |
| Empty class shorthand `class X;` | S: no `{ }` empty bodies in added lines | `new-project` |
| No `.Wait()` / `.Result` / `GetAwaiter().GetResult()` | S | `export-orders` |
| No `async void` | S | `export-orders` |
| Return the task directly instead of a pass-through `async`/`await` | J | `export-orders` |
| `IAsyncEnumerable<T>` for streams | S: return type | `export-orders` |
| `ValueTask` on hot paths | — no realistic hot path. Cut candidate. | — |
| Composition root via `IHostApplicationBuilder` extensions | S: registration in an `IHostApplicationBuilder` extension, not inline in `Program.cs` | `configurable-limit` |
| Options + `ValidateDataAnnotations().ValidateOnStart()` | S | `configurable-limit` |
| Service lifetimes | J | `configurable-limit` |
| New csproj sets `TreatWarningsAsErrors` | S | `new-project` |
| No `#pragma warning disable` | S | all (side check) |

## dotnet-functional.md

| Rule | Grader | Task |
|---|---|---|
| Pure core, side effects at the edges | J | `cancel-order` |
| Don't mutate arguments | J | `cancel-order` |
| Immutable data (records, `init`, read-only collections) | S: no public `List<>` property or return type in added Domain/Application code | `list-orders-endpoint` |
| LINQ over loops | S: no `for`/`foreach`/`while` in added non-test code | `order-helpers` |
| Expression-bodied members | C: IDE0022/IDE0025/IDE0027 | gate |
| `Maybe<T>`, never `null`, for absence | S: no `?` reference return types or `return null` in Domain/Application | `find-order` |
| `Result` instead of exceptions for expected failures | S: no `throw` in added Domain/Application code (except guard clauses), plus J | `cancel-order` |
| `Result.Combine` for independent validations | J | `cancel-order` |
| Railway style; `Match` over `IsSuccess`/`.Value` (tension 2) | S: no `.IsSuccess`, `.IsFailure`, `.HasValue`, `.Value` or `IsSuccess:` patterns in added non-test code | `match-result` |
| CSharpFunctionalExtensions only | S: no other functional library or hand-rolled `Result`/`Maybe` type | `find-order` |

## dotnet-csharp14-idioms.md

| Rule | Grader | Task |
|---|---|---|
| `field` keyword over a manual backing field | S | `field-keyword` |
| `extension` blocks over `this` static classes | S | `order-helpers` |
| Collection expressions | C: IDE0028, IDE0300–IDE0305 | gate |
| Records for DTOs and value objects | S: new DTO/value types are `record` | `list-orders-endpoint`, `money-value` |
| `readonly record struct` for small values | S | `money-value` |
| `required` over nullable + runtime check | S | `configurable-limit` |
| Switch expressions over if/else chains | C (IDE0066) + J | `order-status-label` |
| Nested property patterns at most one level deep | S: regex for `{ X: {` nesting | `order-status-label` |
| Raw string literals for multi-line SQL/JSON | S | `raw-sql-report` |
| `Span<T>` on hot paths | — no realistic task. Cut candidate. | — |
| SOLID, KISS, DRY… | — too generic. Cut candidate. | — |

## testing.md

| Rule | Grader | Task |
|---|---|---|
| Stack: xUnit v3, AwesomeAssertions, Moq | S: no other test or assertion packages; `.Should()` used | `unit-tests` |
| No `InternalsVisibleTo` | S | `internal-tests` |
| Names follow `Method_Expected_Scenario` | S: regex on `[Fact]`/`[Theory]` methods | `unit-tests` |
| `sealed` test class, constructor setup, mocks as `readonly` fields | S | `unit-tests` |
| AAA comments, no section separators | S (separators) + J (AAA) | `unit-tests` |
| `TheoryDataRow<T>` for `MemberData` | S | `unit-tests` |
| No logic (`if`/`for`/`switch`) in tests | S | `unit-tests` |
| `TestContext.Current.CancellationToken` | S: no `CancellationToken.None` or `default` in tests | `unit-tests` |
| Mock only outbound ports; never assert on a logger (tension 3) | S: `Mock<I…Repository/Gateway>` only; no `Mock<ILogger`; no Testcontainers in UnitTests | `unit-tests` |
| Integration tests use WebApplicationFactory / TestContainers | S | `integration-test` |
| `[Trait("Category", …)]` | S | `integration-test` |
| Flat test project layout | S | `new-project` |
| Builders only for complex types | — rarely triggered. Cut candidate. | — |

## hexagonal-architecture.md

| Rule | Grader | Task |
|---|---|---|
| Dependency direction (project references) | S | `new-project`, `list-orders-endpoint` |
| No EF/AspNetCore in Domain | S: usings and package references | `list-orders-endpoint` |
| No direct DB/HTTP in Application | S: no `DbContext`/`HttpClient` in Application | `list-orders-endpoint` |
| Use cases return DTOs, not tracked entities | J | `list-orders-endpoint` |
| Mapping happens in adapters | J | `list-orders-endpoint` |
| Translate errors at the boundary | S: `DbUpdateException` caught in Infrastructure only + J | `duplicate-order` |
| Port earns its place (no speculative `IClock`) | S: no new single-implementation interface unless a test fakes it | `order-timestamps` |
| No service locator outside the composition root | S: no `GetService`/`GetRequiredService` outside `Program.cs`/Registrations | `configurable-limit` |
| Unit tests use TestContainers (conflicts with testing.md) | resolved by tension 3: Moq wins | `unit-tests` |

## Tasks (25)

Prompts are worded the way a user would ask. The middle column is the hidden target, not what the prompt says.

| Task | Targets | Graders |
|---|---|---|
| `order-helpers` | extension blocks, LINQ | S |
| `field-keyword` | `field` keyword | S |
| `match-result` | Match over IsSuccess (tension 2) | S |
| `find-order` | Maybe over null, CSharpFunctionalExtensions | S + J |
| `cancel-order` | Result over throw, early return, positive logic, purity, comments, ordering | S + J |
| `add-package` | CPM, `dotnet add`, separate commit, conventional commits | S + B |
| `new-project` | flat layout, TreatWarningsAsErrors, dependency direction, empty-class shorthand | S |
| `list-orders-endpoint` | hexagonal layering, minimal API, records, immutability, minimum code | S + J |
| `unit-tests` | test stack, naming, structure, token, Moq (tension 3) | S + J |
| `internal-tests` | no InternalsVisibleTo | S |
| `integration-test` | WebApplicationFactory, Trait | S |
| `configurable-limit` | options, ValidateOnStart, composition root, required, lifetimes | S + J |
| `export-orders` | IAsyncEnumerable, no `.Result`, no `async void` | S + J |
| `order-status-label` | switch expressions, NotImplementedException, nested patterns | S |
| `money-value` | `readonly record struct` | S |
| `raw-sql-report` | raw string literals | S |
| `order-timestamps` | port earns its place | S + J |
| `duplicate-order` | error translation at the boundary | S + J |
| `api-docs` | built-in OpenAPI, not Swashbuckle | S |
| `boy-scout` | cleanup in touched methods only (tension 1); fixture has cruft in two methods | D |
| `adjacent-bug` | flag, don't fix; fixture plants a bug | D + B |
| `ambiguous-request` | ask before assuming | B/J |
| `unknown-fact` | say "I'm not sure" | B/J |
| `generated-file` | don't edit auto-generated files | S |
| `control-total-bug` | **control**: no rule targets it; detects side effects | gate + D |

Each grader has `selftest/pass.patch` and `selftest/fail.patch` (and transcripts for B). `evals/selftest.sh` proves that every check goes red on the fail sample and green on the pass sample, and that the fixture builds clean with the `.editorconfig` template.
