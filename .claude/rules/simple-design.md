---
description: Simple design, deep modules and the scope of a change
alwaysApply: true
---
# Simple design

## Styles
- **DESIGN-001** MUST apply Kent Beck's four rules of simple design in Beck and Fowler's order: passes the tests,
  reveals intention, has no duplication, has the fewest elements.
- **DESIGN-002** MUST apply John Ousterhout's deep modules from *A Philosophy of Software Design*: a small interface
  over a large implementation. Do not apply the other parts of that book.

## Rules
- **DESIGN-003** MUST NOT add an element for a need that no current task has (a parameter, interface, base class,
  configuration value or extension point) — speculative flexibility breaks "fewest elements"; add it when a caller needs it.
- **DESIGN-004** MUST NOT add a pass-through method or a wrapper class that only forwards a call to one collaborator
  — it makes the interface larger and adds no behaviour.
- **DESIGN-005** MUST NOT add a member to a domain type that only exposes a member of another object (`order.CustomerName()`
  for `order.Customer.Name`) — a proxy makes the domain interface wider and not deeper.
- **DESIGN-006** MUST size a class by one responsibility, not by its line count — many small classes for one concept
  make each class shallow.
- **DESIGN-007** MUST bring only the code that you change into line with the rules, plus all that the build then
  reports. MUST NOT restyle unchanged code in the same file — small diffs are easier to review; do a cleanup as a separate task.
- **DESIGN-008** SHOULD delete code instead of extracting an abstraction, unless e.g. the concept that the duplicates
  share is already clear — a wrong abstraction costs more to remove than duplication.
