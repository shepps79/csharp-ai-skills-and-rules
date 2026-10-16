# Rule file standard

How every file in `.claude/rules/` is written. Rule files are for agents only: each line costs tokens in every
session (all rules together cost ~21.8k tokens per session in the first baseline), so a line stays only if it changes what the agent does.

## Structure

One file per topic. Each topic owns an ID namespace:

| Namespace | Topic |
|-----------|-------|
| `CLEAN`   | Clean code |
| `DESIGN`  | Simple design |
| `DDD`     | Domain-driven design |
| `NET`     | C# / .NET conventions |
| `CS14`    | C# 14 / .NET 10 idioms |
| `FUNC`    | Functional style |
| `HEX`     | Hexagonal architecture |
| `TEST`    | Testing |

```markdown
---
description: <topic in a few words>
alwaysApply: true
---
# <Topic>

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Styles
- **FUNC-001** MUST apply <named style>.

## Rules
- **FUNC-002** MUST <behaviour> instead of <style>'s <behaviour> — <one-line reason>.
- **FUNC-003** SHOULD <behaviour> unless <named exception> — <one-line reason>.

## Examples
<only for rules whose correct form is not obvious>
```

- Frontmatter: `alwaysApply: true`, or `paths:` when the topic's scope is agreed. Never both, never `globs:` (see
  `AGENTS.md`: Claude Code reads only `paths`, pi-rules and codex-rules load nothing without one of the two).
- The RFC keyword line is repeated in every file: Claude Code does not read `AGENTS.md`, and each file must stand alone.
- The style line has its own ID, so it can be ablated like any other rule.

## Rules for rules

1. **Name the style, don't restate it.** A style the model already knows (Clean Code, railway-oriented programming)
   is selected by name in `## Styles`.
2. **Admission.** A rule other than a style line exists only if it is:
   - a **delta**: it overrides part of the selected style;
   - a **tightening**: it adds a number or threshold the style leaves vague;
   - **observed drift**: evals show the agent getting it wrong with the style selected.
3. **A delta names what it switches off.** Write "X instead of <style>'s Y", so it is clear which part of the style no
   longer applies. Cite a chapter or section only when the behaviour's name alone is ambiguous.
4. **RFC 2119 keywords only.** MUST / MUST NOT for hard constraints; SHOULD / SHOULD NOT for defaults, with the
   exception named (`unless …`). No MAY: an optional rule changes nothing.
5. **One reason per rule.** One line of *why*, so the agent can handle cases the rule doesn't name.
6. **One home.** Each behaviour is stated once, in its topic. Other files refer to it by ID, never restate it.
7. **No conflicts.** Rules across all files agree. A conflict is a bug to fix in the rules, never something to settle
   with precedence.
8. **Permanent IDs.** IDs are never renumbered; a retired ID is never reused, so eval history keeps its meaning.
9. **Examples obey every rule.** An example is followed more closely than prose, so it must comply with all rule
   files. Use a BAD/GOOD pair only when the bad form is what the agent tends to write.
10. **Build-enforced rules get at most a pointer.** Anything `.editorconfig`, StyleCop or the analyzers fail the
    build on needs one line at most.
11. **No human scaffolding.** No context, audience, principles, references, TL;DR, waiver process or quality gates.
12. **Size.** Body under 12,000 characters (the pi-rules and codex-rules per-rule cap).
