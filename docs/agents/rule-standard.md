# Rule file standard

How every file in `.claude/rules/` is written. Rule files are for agents only: each line costs tokens in every
session, so a line stays only if it changes what the agent does.

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
- **FUNC-001** MUST apply <named style>'s <named parts>.

## Rules
- **FUNC-002** MUST <behaviour> instead of <style>'s <behaviour> — <one-line reason>.
- **FUNC-003** MUST <behaviour> unless <exception> — <one-line reason>.
- **FUNC-004** SHOULD <behaviour>, unless e.g. <commonest exception> — <one-line reason>.

## Examples
<only for rules whose correct form is not obvious>
```

- Frontmatter: `alwaysApply: true`, or `paths:` when the topic's scope is agreed. Never both, never `globs:` (see
  `AGENTS.md`: Claude Code reads only `paths`, pi-rules and codex-rules load nothing without one of the two).
- `paths:` loads a rule only once the agent touches a matching file, so it never loads on greenfield work. Topics
  that shape a design before any file exists (`DESIGN`, `DDD`, `HEX`) stay on `alwaysApply: true`; `paths:` is only
  for topics that matter solely while editing matching files.
- The RFC keyword line is repeated in every file: Claude Code does not read `AGENTS.md`, and each file must stand alone.
- The style line has its own ID, so it can be ablated like any other rule.

## Rules for rules

1. **Name the style and its parts, don't restate it.** A style the model already knows is selected by name in
   `## Styles`, limited to the parts wanted ("Clean Code's naming and function size", not "Clean Code"). A whole
   style brings along every practice in it, including ones that conflict with other files.
2. **Admission.** A rule other than a style line exists only if it is:
   - a **delta**: it overrides part of the selected style;
   - a **tightening**: it adds a number or threshold the style leaves vague;
   - **observed drift**: evals show the agent getting it wrong with the style selected.
3. **A delta names what it switches off.** Write "X instead of <style>'s Y", so it is clear which part of the style no
   longer applies. Cite a chapter or section only when the behaviour's name alone is ambiguous. Where two selected
   styles, in any files, disagree (Clean Code's exceptions vs railway-oriented `Result`), one file carries the delta
   and the other file's style selection excludes that part.
4. **Removal.** A rule whose ablation shows no effect at `--repeat 5` is removed. The harness ablates whole files
   (`excludeRules`), so until it can ablate single IDs this applies per file.
5. **Keywords.** MUST / MUST NOT for hard constraints; an exception list after `unless` is complete. SHOULD /
   SHOULD NOT for defaults with other valid exceptions; name the commonest one with `unless e.g. …`. No MAY: an
   optional rule changes nothing.
6. **One reason per rule.** One line of *why*, so the agent can handle cases the rule doesn't name.
7. **One home.** Each behaviour is stated once, in its topic. Another file refers to it by ID only if the target file
   is `alwaysApply: true`; a reference into a `paths:` file can arrive without its target, so restate that line instead.
8. **No conflicts.** Rules across all files agree. A conflict is a bug to fix in the rules, never something to settle
   with precedence between rules. A style's own priority order (e.g. Beck's four rules of simple design) is part of
   the style and comes with selecting it.
9. **Examples obey the rules.** An example is followed more closely than prose. A GOOD example complies with all rule
   files; a BAD example breaks only the rule it illustrates. Use a BAD/GOOD pair only when the bad form is what the
   agent tends to write.
10. **Build-enforced rules get one line.** The build is the one `templates/dotnet` sets up (`.editorconfig`,
    `Directory.Build.props`). Anything it fails the build on gets exactly one line: projects without the template
    still need the rule, and a failed build costs the agent turns.
11. **No human scaffolding.** No context, audience, principles, references, TL;DR, waiver process or quality gates.
12. **Size.** Each body under 12,000 characters (the pi-rules and codex-rules per-rule cap); all bodies together under
    40,000 characters, since every session loads them all.
13. **Language.** Write rule text in ASD-STE100 Simplified Technical English: short sentences, active voice, one
    meaning per word, the imperative for instructions. Code identifiers and named styles keep their own names.
