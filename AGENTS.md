# Project Context
A set of C# dotnet core rules and context files, using evals to test and confirm.

MUST, MUST NOT, SHOULD and SHOULD NOT are used as in RFC 2119 and RFC 8174.

## Tech Stack
- dotnet SDK 10

## Platforms
Rules in `.claude/rules/` must work in Claude Code, pi ([pi-rules](https://github.com/code-yeongyu/pi-rules)) and Codex ([codex-rules](https://github.com/code-yeongyu/codex-rules)): give each rule frontmatter with `alwaysApply: true` or `paths:` (never `globs:`), and keep each rule body under 12,000 characters. Write and edit rules to `docs/agents/rule-standard.md`.

## Domain docs
Agent documentation `docs/agents/`.
