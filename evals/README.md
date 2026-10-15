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
npm run eval -- --repeat 5                                   # your working-tree rules only
npm run eval -- --filter-pattern cancel-order                # one task
npm run eval-baseline -- --repeat 5                          # every variant, incl. none
npm run eval-pairwise                                        # judge picks rules@HEAD or rules@WORKTREE per task
PAIRWISE_SWAP=1 npm run eval-pairwise                        # the same with the order swapped
npm run view                                                 # local results UI
npm run clean                                                # delete ALL results and run dirs, baseline included
```

`clean` refuses while an eval is running. Restart `npm run view` afterwards, as it holds the deleted results open.

Run `eval-baseline` first, and again whenever the fingerprint changes (Claude Code, model, plugins, RTK, global
CLAUDE.md). Day to day, `eval` runs only `rules@WORKTREE`; compare it with the baseline using `npm run report`
for each eval, or "Compare" in `npm run view`. Its provider filter is fixed: a second
`--filter-providers` is ignored, so for any other selection call promptfoo directly, e.g.
`npm run promptfoo -- eval --no-cache --no-share --filter-providers WORKTREE`.

Label runs so they're easy to find and compare in the UI (`eval-baseline` is labelled "baseline" unless you override it):

```bash
npm run eval -- --repeat 5 --description "testing.md: drop TestContainers line"
```

In `npm run view`, each provider column shows its pass rate and a score per named metric (`build`, `uses-maybe`,
`judge`, …). Use the eval picker to open an earlier run, and "Compare" to show two runs side by side.

## Variants

| Label            | Global setup (CLAUDE.md, RTK, ponytail, plugins) | Repo `.claude/`          |
|------------------|--------------------------------------------------|--------------------------|
| `none`           | off                                              | none                     |
| `rules@WORKTREE` | on                                               | your working tree        |

Two more variants are out of the provider list until needed: `rules@HEAD` (committed rules run alongside, as a
same-session control), restored with `{ variant: rules, rulesRef: HEAD }`, and `env` (global setup on, no repo
`.claude/`, to separate the global setup's effect from the rules'), restored with `{ variant: env }`.

**Ablation.** `config.excludeRules` drops rule files from a `rules` variant, e.g.
`{ variant: rules, rulesRef: WORKTREE, excludeRules: [testing.md] }` with label `rules-testing.md`. Run each file out in
turn against the full rules: a file whose removal changes nothing is dead weight or ignored.

**Pairwise.** `pairwise.js` reuses this config with only `rules@HEAD` and `rules@WORKTREE`, and swaps each `llm-rubric`
for a `select-best` over the same rubric, so the judge picks the better diff per task (metric `pairwise`). Judges
favour a position, so run it in both orders and count a version as better only when it wins in both:
`npm run report -- <first-id> <swapped-id>`.

The agent runs on `claude-sonnet-5-5` and the judge on `claude-opus-5-5`; override per provider with `config.model`.

Fixtures: `orders` (existing service) and `empty` (greenfield). `orders` models the hexagonal layout the rules ask
for, because agents copy what they find: Domain, Application (use-case service as inbound port, DTOs at its boundary,
`IOrderRepository` outbound port), Infrastructure (in-memory adapter), Api (minimal-API inbound adapter plus the
composition root in `Configuration/Registrations.cs`), and UnitTests and IntegrationTests (`WebApplicationFactory`). Both symlink `.editorconfig` from `templates/dotnet/`,
and `orders` also its `Directory.Build.props`, so the compiler-enforced rules have one source. That props file adds
StyleCop (member ordering only) and the VS Threading analyzers (no `.Result`/`.Wait()`, no `async void`) as
`GlobalPackageReference`s. The `orders` test projects reference coverlet.collector and coverlet.msbuild.

Each run copies `fixtures/<fixture>` (symlinks resolved) to a fresh git repo under `$TMPDIR/csharp-skills-evals/`, outside this repo so its
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

## Quality %

```bash
npm run report                  # latest eval
npm run report -- <eval-id>     # a specific one
```

```bash
npm run report -- <baseline-id> <eval-id>   # several evals; exits 1 if their fingerprints differ
```

Prints a quality % per variant, overall and per task, and the mean turns, tokens, cost and minutes per run: the same
quality at lower cost is a win too. Each run's quality is the weighted mean of its checks (build, tests, acceptance and
judge weigh 3; each rule check 1; the judge's and coverage's scores are fractional), and is 0 when the build fails.
"all checks pass" is the stricter share of runs where nothing failed. Runs that errored (agent never ran, timed out)
are counted under "run errors" and left out of both percentages. The `fingerprint` line lists the environment hashes;
the report exits 1 when the evals it prints have more than one.

## Grading

- `graders/checks.js`: deterministic checks on build, tests and the files the agent changed. `testsAdded` counts the
  `[Fact]`/`[Theory]` attributes the diff adds, so the fixture's own tests don't count. `noWarningSuppression` fails a
  run that edits or deletes the fixture's `.editorconfig`/`Directory.Build.props` or suppresses warnings, since that
  would let the build check pass. `projectsInSolution` fails a project the build and test run would never see.
  `coverage` is the line coverage (merged across test projects) of the production files the agent changed, or of all
  of them for a tests-only change; it needs coverlet.collector, and the provider runs `dotnet test --collect "XPlat Code
  Coverage"`. `skillsUsed`/`noSkillsUsed` grade the repo skills the agent loaded.
  `npm test` runs the graders' own tests; run it after changing a check.
- `acceptance/`: hidden tests the agent never sees. After the agent's diff, build and coverage are taken, the provider
  copies `acceptance/<fixture>/` and `acceptance/<vars.acceptance>/` over the run dir and runs `dotnet test` on each
  project in them. `acceptance/orders` holds NetArchTest architecture tests (layer dependencies, sealed classes);
  `acceptance/order-limits` tests that task's HTTP contract.
- `llm-rubric`: a local `claude -p` judge (`providers/judge.js`) with no tools, plugins, hooks or CLAUDE.md.
  The rubric text in `promptfooconfig.yaml` is the yardstick, so don't edit it in the same change as the rules.

Single runs are noisy. Use `--repeat 5` or more, and treat differences smaller than about 15 points as noise.

## Add a task

1. Add a test to `promptfooconfig.yaml` with the task text in `vars.task`, the checks that apply, and a rubric.
2. If the task text fixes a contract (an HTTP route, a public method), add hidden tests for it under
   `acceptance/<name>/src/<Project>/` and set `vars.acceptance: <name>`.
3. Add a fixture under `fixtures/` only if `orders` (existing service) or `empty` (greenfield) can't host the task.
