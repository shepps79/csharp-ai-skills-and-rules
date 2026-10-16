---
description: Clean Code naming, functions, formatting and comments
alwaysApply: true
---
# Clean code

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Styles
- **CLEAN-001** MUST apply Robert C. Martin's *Clean Code* chapters on meaningful names, functions and formatting.
  Do not apply its chapters on comments, error handling, classes and unit tests, or its Law of Demeter.

## Rules
- **CLEAN-002** MUST keep a function at 20 lines or fewer — a longer function usually does more than one thing.
- **CLEAN-003** MUST give a function 3 parameters or fewer, not counting a `CancellationToken`. Use a parameter
  `record` for more — a long parameter list hides which values belong together.
- **CLEAN-004** MUST NOT nest blocks more than 3 levels deep. Use a guard clause or extract a method — deep nesting
  hides the main path.
- **CLEAN-005** MUST write an XML documentation comment on each public type and member in production projects (the
  build fails without it). Tell what the signature cannot tell: the `ErrorKind` values it returns, units, invariants.
  Use `<inheritdoc />` on an implementation of an interface member — the name and the types already tell the rest.
- **CLEAN-006** MUST NOT write a comment that tells what the code does in other words. Write an inline comment only to
  explain unexpected behaviour or the reason for a decision that the code cannot show — a comment that repeats the
  code becomes wrong when the code changes.
- **CLEAN-007** MUST NOT write a comment on a private member. Make its name tell its purpose.
- **CLEAN-008** MUST NOT keep commented-out code or dead code — git keeps the history.
