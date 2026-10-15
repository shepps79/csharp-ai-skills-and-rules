# Evals

Measures how changes to `.claude/rules` and `.claude/skills` affect the code Claude Code writes.
Everything runs locally with your own `claude` login. promptfoo telemetry, update checks, sharing and
remote generation are switched off in `package.json`, and results stay in `evals/.promptfoo/`.

## Run

Runs use whichever Claude Code config the shell points at. If you log in through a non-default config dir, export it
first, or every run errors with "Not logged in":

```bash
export CLAUDE_CONFIG_DIR=~/.claude-<profile>
```

```bash
npm ci --ignore-scripts
npm run eval -- --repeat 5                                   # every task × every variant
npm run eval -- --filter-providers 'rules@' --repeat 5       # committed rules vs your uncommitted edits
npm run eval -- --filter-pattern cancel-order                # one task
npm run view                                                 # local results UI
```

Label runs so they're easy to find and compare in the UI:

```bash
npm run eval -- --filter-providers 'rules@' --repeat 5 --description "testing.md: drop TestContainers line"
```

In `npm run view`, each provider column shows its pass rate and a score per named metric (`build`, `uses-maybe`,
`judge`, …). Use the eval picker to open an earlier run, and "Compare" to show two runs side by side.

## Variants

| Label            | Global setup (CLAUDE.md, RTK, ponytail, plugins) | Repo `.claude/`          |
|------------------|--------------------------------------------------|--------------------------|
| `none`           | off                                              | none                     |
| `env`            | on                                               | none                     |
| `rules@HEAD`     | on                                               | as committed             |
| `rules@WORKTREE` | on                                               | your working tree        |

The agent runs on `claude-sonnet-5-5` and the judge on `claude-opus-5-5`; override per provider with `config.model`.

Each run copies `fixtures/<fixture>` to a fresh git repo under `$TMPDIR/csharp-skills-evals/`, outside this repo so its
rules aren't picked up from a parent directory. The agent runs in `auto` permission mode. Run directories and
`transcript.jsonl` are kept there for inspection.

Every result records a `fingerprint` (Claude Code, model, plugins, global config hashes, RTK, dotnet).
Only compare results with the same fingerprint hash; if your global setup changed, re-run the baseline.

## Reading the code

A result's output is the git diff of everything the agent changed. A cell is PASS when every check and the judge passed.

- In `npm run view`, turn on "Render markdown" in the table settings and click a cell to read the highlighted diff,
  each check's reason and the judge's explanation. `metadata.runDir` is listed there too.
- To browse the full solution, open the run dir: `ls -td ${TMPDIR:-/tmp}/csharp-skills-evals/*/repo | head` (newest first), then
  `code <dir>` or `git -C <dir> diff --cached HEAD`. `transcript.jsonl` beside it shows how the agent got there.
  Run dirs live in the temp folder, so they disappear when the machine restarts.

## Grading

- `graders/checks.js`: deterministic checks on build, tests and the files the agent changed.
- `llm-rubric`: a local `claude -p` judge (`providers/judge.js`) with no tools, plugins, hooks or CLAUDE.md.
  The rubric text in `promptfooconfig.yaml` is the yardstick, so don't edit it in the same change as the rules.

Single runs are noisy. Use `--repeat 5` or more, and treat differences smaller than about 15 points as noise.

## Add a task

1. Write the prompt in `tasks/<id>.md`.
2. Add a test to `promptfooconfig.yaml` with the checks that apply and a rubric.
3. Add a fixture under `fixtures/` only if `orders` can't host the task.
