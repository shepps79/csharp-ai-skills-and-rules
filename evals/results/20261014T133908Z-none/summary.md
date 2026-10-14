# Eval summary

- `none`: model sonnet, effort default, 9 runs, $0.65 total

| Task | none |
|---|---|
| field-keyword | 3/3 ✅ |
| match-result | 0/3 ❌ |
| order-helpers | 0/3 ❌ |

## Failed checks

- match-result / `none`: resolves the Result with Match (no added line matches /\bMatch\s*\(/) ×3; no IsSuccess/IsFailure/HasValue checks ×3
- order-helpers / `none`: uses an extension block (no added line matches /\bextension\s*(<[^>]*>)?\s*\(/) ×3; no this-parameter extension methods ×3
