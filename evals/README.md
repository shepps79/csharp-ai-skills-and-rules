# Rule evals

These evals measure whether the rules in `AGENTS.md` and `.claude/rules/` change what an agent writes. Each task is run headless against a small Orders service under a chosen rule-set variant, and the result is graded by scripts.

- `INVENTORY.md`: every rule, its grader type, and the task that covers it.
- `../docs/agents/evals-brief.md`: the original brief.

## Commands

```bash
evals/selftest.sh [task...]            # no LLM: fixture builds clean; every check passes/fails its samples
evals/calibrate.sh [task...]           # LLM: judge verdicts match hand-labelled samples (cheap; run after rubric edits)
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
| `EVAL_JUDGE_MODEL` | `sonnet` | Model for the LLM judge (`rubric.md` tasks) |
| `EVAL_JUDGE_EFFORT` | model default | `--effort` for the judge |

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
4. The task's graders run:
   - `check.sh` greps the lines added since `baseline` for the rule's structural signal, and can also inspect the transcript (e.g. `expect_cmd` for commands run).
   - `rubric.md`, when present, is graded by an LLM judge (`judge.py`). The judge sees the diff and a condensed transcript, but never the variant. Each item gets a yes/no verdict plus a quote from the input, and an item fails if its quote can't be found verbatim in the input.

   A run passes when the gate and every grader present pass.
5. Besides pass/fail, each run records:
   - the resolved model ID and Claude Code CLI version;
   - whether `dotnet build`/`test` ran after the last edit (`verified_after_edit`, counting shell writes as edits);
   - which skills fired.
6. Results go to `results/<stamp>-<variant>/`. `results.csv` and `summary.md` are committed; `runs/` (transcripts, diffs, logs) is gitignored.

## Skeleton (greenfield) tasks

A task folder containing an empty `skeleton` file starts from `templates/` only, with no fixture. This tests whether the rules scaffold a new solution correctly: layout, central package management, project references, test stack and so on. Canned-fixture tasks can't test that, because the agent just copies the structure that's already there. The report lists skeleton tasks in their own table.

The gate is the same, so the agent's solution must build clean under the template analyzers. Integration tests (`Category=Integration`) are built but not run.

## Task types borrowed from addyosmani/agent-skills

- **Pressure cases** (`*-pressure`) repeat a task with urgency in the prompt, without asking to break the rule. They show whether a rule still holds when the user is rushing.
- **Control and precision cases** (`control-*`) are tasks no rule targets. Both variants should pass. A gap between variants means a rule is causing side effects, e.g. unrequested refactors.
- **Judge calibration**: every `rubric.md` has hand-labelled samples under `calibration/`, and `calibrate.sh` must agree with them before judge results are trusted.

`claude plugin eval` was evaluated and not adopted. It runs plugins (skills, commands, MCP), with a built-in no-plugin comparison, but plain `.claude/rules` files aren't a plugin component. Revisit it for skill evals.

## Compiler rules: `templates/`

`templates/.editorconfig` and `templates/Directory.Build.props` are the proposed compiler config. They use built-in SDK analyzers only. Each csproj also sets `TreatWarningsAsErrors`, as `dotnet.md` requires. The self-test only checks that the fixture builds clean with them. It doesn't test the compiler.

`IDE0049` (`String` → `string`) isn't reported by the build, but `dotnet format` catches it.

## Adding a task

1. `tasks/<name>/prompt.md`: word it the way a user would. Never name the rule or hint at the expected shape.
2. `tasks/<name>/rules.txt`: the rule(s) it targets, or `(none yet)`.
3. Graders, at least one of:
   - `tasks/<name>/check.sh <workdir> <rundir>`: source `lib.sh` and use `expect_some` / `expect_none` (PCRE; scope with `added_prod`, `added_tests` or `added_in`), `expect`, `expect_cmd` and `changed_files`. It needs at least one positive check, so an empty diff fails.
   - `tasks/<name>/rubric.md`: numbered yes/no items for the judge, plus `calibration/<sample>/{patch,transcript.jsonl,expected.json}` with at least one all-pass and one failing label.
4. Optional `tasks/<name>/fixture.patch`: setup applied before the run. Or add an empty `tasks/<name>/skeleton` file to start greenfield instead.
5. `tasks/<name>/selftest/{pass,fail}.patch` (or `.sh` for setups such as commits, plus an optional `.transcript.jsonl`): hand-made samples. Then run `evals/selftest.sh <name>`: the pass sample must clear the check and the gate, and the fail sample and an empty diff must fail.
