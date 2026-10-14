---
name: conventional-commits
description: >-
  Formats all git commit messages following the Conventional Commits v1.0.0 specification.
  Activates on any git commit task (commit, save changes, write a commit message, etc).
  Enforces structured commit types (feat, fix, docs, style, refactor, perf, test, build, ci,
  chore, revert), scopes, breaking-change notation, English-only messages, and no
  Co-Authored-By/copyright footers.
---

# Conventional Commits — Commit Message Rules

You MUST follow these rules whenever you create, write, or suggest a git commit message. These rules override any other commit message conventions or defaults.

## Commit Message Structure

Every commit message MUST follow this exact structure:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Rules

### 1. Type (REQUIRED)

The commit MUST be prefixed with one of the following types:

| Type       | When to use                                                        |
|------------|--------------------------------------------------------------------|
| `feat`     | A new feature (correlates with MINOR in SemVer)                    |
| `fix`      | A bug fix (correlates with PATCH in SemVer)                        |
| `docs`     | Documentation only changes                                         |
| `style`    | Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.) |
| `refactor` | A code change that neither fixes a bug nor adds a feature          |
| `perf`     | A code change that improves performance                            |
| `test`     | Adding missing tests or correcting existing tests                  |
| `build`    | Changes that affect the build system or external dependencies      |
| `ci`       | Changes to CI configuration files and scripts                      |
| `chore`    | Other changes that don't modify src or test files                  |
| `revert`   | Reverts a previous commit                                          |

### 2. Scope (OPTIONAL)

- A scope MAY be provided after the type, enclosed in parentheses: `feat(parser): add ability to parse arrays`
- The scope provides additional contextual information about what part of the codebase is affected
- Use lowercase for scope names
- Use the most specific and meaningful scope name (e.g., module name, component name, file area)

### 3. Description (REQUIRED)

- MUST immediately follow the colon and space after the type/scope prefix
- Use the imperative, present tense: "add" not "added" nor "adds"
- Do NOT capitalize the first letter
- Do NOT end with a period
- Keep it concise — ideally under 72 characters total for the entire first line
- Describe WHAT changed, not HOW

### 4. Body (OPTIONAL)

- MUST begin one blank line after the description
- Use the imperative, present tense
- Explain the motivation for the change and contrast with previous behavior
- Can consist of multiple paragraphs, each separated by a blank line
- Wrap lines at 72 characters

### 5. Footer(s) (OPTIONAL)

- MUST begin one blank line after the body (or after the description if no body)
- Follow the git trailer format: `token: value` or `token #value`
- A footer's token MUST use `-` in place of whitespace characters (e.g., `Acked-by`, `Reviewed-by`)
- Exception: `BREAKING CHANGE` MUST be written as-is with a space

### 6. Breaking Changes

Breaking changes can be indicated in TWO ways (both are valid):

1. Add `!` after the type/scope, before the colon: `feat!: remove deprecated endpoint`
2. Add a `BREAKING CHANGE:` footer: 
   ```
   feat: allow provided config object to extend other configs
   
   BREAKING CHANGE: `extends` key in config file is now used for extending other config files
   ```
3. Both can be used together for emphasis
4. Breaking changes correlate with MAJOR in SemVer
5. A breaking change can be part of commits of ANY type

### 7. Case Sensitivity

- Types, scopes, and descriptions MUST be lowercase
- `BREAKING CHANGE` in footers MUST be uppercase

### 8. Language (REQUIRED)

- The ENTIRE commit message MUST be written in English — description, body, and footers alike — regardless of the conversation or repository language. Translate any user-provided content into English before committing.

## CRITICAL — Forbidden Patterns

These two are hard guardrails not already covered by the positive rules above:

1. **NEVER add a `Co-Authored-By` line** — do not append any co-author attribution, copyright notice, or model identification footer to commit messages. This includes but is not limited to:
   - `Co-Authored-By: Claude ...`
   - `Co-Authored-By: AI ...`
   - Any variation of AI/model attribution in the commit message

2. **NEVER use vague descriptions** like "update code", "fix stuff", "misc changes" — be specific about what changed

## Examples

### Simple feature
```
feat: add email validation to signup form
```

### Bug fix with scope
```
fix(auth): resolve token expiration race condition
```

### Breaking change with body
```
feat(api)!: change pagination response format

The pagination response now returns `items` instead of `data` and includes
a `cursor` field for efficient pagination. The `total_count` field has been
removed in favor of `has_more`.

BREAKING CHANGE: pagination response structure has changed, clients must update
```

### Chore with footer
```
chore(deps): upgrade eslint to v9

Reviewed-by: Z
Refs: #456
```

## Decision Guide

When multiple types could apply, prefer the first match (definitions in the table above): `fix` > `feat` > breaking-change modifier > `docs` > `test` > `perf` > `refactor` > `style` > `build` > `ci` > `chore`.

## Applying These Rules

When creating a commit:

1. Analyze the staged changes (git diff --cached or equivalent)
2. Determine the primary type based on the decision guide above
3. Identify the scope from the area of code affected (if applicable)
4. Write a concise, imperative description of what changed — always in English
5. Add a body if the "why" is not obvious from the description alone
6. Add footers if there are breaking changes, references, or reviewers
7. Verify the message follows ALL rules above before committing

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/)
- [Git Commit Message Best Practices](https://cbea.ms/git-commit/)
- [Semantic Versioning](https://semver.org/)
