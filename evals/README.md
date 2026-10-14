# Rule evals

These evals measure whether the rules in `AGENTS.md` and `.claude/rules/` change what an agent writes. Each task is run headless against a small Orders service under a chosen rule-set variant, and the result is graded by scripts.

- `INVENTORY.md`: every rule, its grader type, and the task that covers it.
- `../docs/agents/evals-brief.md`: the original brief.

## Commands

```bash
evals/selftest.sh [task...]            # no LLM: fixture builds clean; every check passes/fails its samples
evals/run.sh <variant> <reps> [task...]
evals/report.sh evals/results/*/results.csv   # compare runs side by side
```

| Env var | Default | Meaning |
|---|---|---|
| `EVAL_MODEL` | `sonnet` | Model under test |
| `EVAL_EFFORT` | model default | `--effort` level |
| `EVAL_BUDGET` | `3` | `--max-budget-usd` per agent run |
| `EVAL_JOBS` | `3` | Parallel runs |
| `EVAL_KEEP` | `0` | `1` keeps the temp workdirs |

A task **passes** for a variant when at least 80% of its reps clear both the gate and the check (4/5, or 3/3). Treat a difference of one run in five as noise.

## Variants

| Variant | Rules copied into the workdir |
|---|---|
| `none` | Nothing. Just the model plus the fixture (which includes `templates/`). |
| `current` | The live `AGENTS.md`, `CLAUDE.md`, `.claude/rules/` and `.claude/skills/`, so the evals go green as the rules improve. |
| `<name>` | The contents of `variants/<name>/`, copied in as-is. |

Runs use `--setting-sources project --strict-mcp-config`, so user-level `CLAUDE.md`, hooks, plugins and MCP servers don't leak in. Only Claude Code's built-in plugins and skills remain.

## How a run works

1. `prepare` copies `fixture/` + `templates/` + the variant into a temp dir, applies the task's `fixture.patch`, then commits and tags `baseline`. The agent never sees `evals/`.
2. `claude -p` runs the task's `prompt.md`. The agent can edit files and run `dotnet`, `git` and read-only shell commands.
3. The **gate** checks four things:
   - `dotnet build -warnaserror` passes;
   - `dotnet format --verify-no-changes` passes;
   - unit tests pass;
   - the compiler config is untouched.

   This is where every compiler-enforceable rule is checked.
4. The task's `check.sh` greps the lines added since `baseline` for the rule's structural signal.
5. Results go to `results/<stamp>-<variant>/`. `results.csv` and `summary.md` are committed; `runs/` (transcripts, diffs, logs) is gitignored.

## Compiler rules: `templates/`

`templates/.editorconfig` and `templates/Directory.Build.props` are the proposed compiler config. They use built-in SDK analyzers only. Each csproj also sets `TreatWarningsAsErrors`, as `dotnet.md` requires. The self-test only checks that the fixture builds clean with them. It doesn't test the compiler.

`IDE0049` (`String` → `string`) isn't reported by the build, but `dotnet format` catches it.

## Adding a task

1. `tasks/<name>/prompt.md`: word it the way a user would. Never name the rule or hint at the expected shape.
2. `tasks/<name>/rules.txt`: the rule(s) it targets, or `(none yet)`.
3. `tasks/<name>/check.sh`: source `lib.sh` and use `expect_some` / `expect_none` over added production lines. Every check needs at least one `expect_some`, so an empty diff fails.
4. Optional `tasks/<name>/fixture.patch`: setup applied before the run.
5. `tasks/<name>/selftest/{pass,fail}.patch`: hand-made diffs. Then run `evals/selftest.sh <name>`: the pass sample must clear the check and the gate, and the fail sample and an empty diff must fail.
