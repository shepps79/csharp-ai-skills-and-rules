# Evals

Measures how changes to `.claude/rules` and `.claude/skills` affect the code Claude Code writes.
Everything runs locally with your own `claude` login. promptfoo telemetry, update checks, sharing and
remote generation are switched off in `package.json`, and results stay in `evals/.promptfoo/`.

## Run

Each run uses the config that the shell names, and the provider throws when it is not set: `CLAUDE_CONFIG_DIR` for
Claude Code, `OMP_PROFILE` for omp and `PI_CODING_AGENT_DIR` for pi. Name the one you are logged in through, or
every run errors with "Not logged in":

```bash
export CLAUDE_CONFIG_DIR=~/.claude-<profile>
export OMP_PROFILE=<profile>             # for eval-omp
export PI_CODING_AGENT_DIR=~/.pi/agent   # for eval-pi
```

```bash
npm ci --ignore-scripts
npm run eval -- --repeat 5                                   # your working-tree rules only
npm run eval -- --filter-pattern cancel-order                # one task
npm run eval-baseline -- --repeat 5                          # every variant, incl. none
npm run eval-pairwise                                        # judge picks rules@HEAD or rules@WORKTREE per task
PAIRWISE_SWAP=1 npm run eval-pairwise                        # the same with the order swapped
LMSTUDIO_MODEL=qwen/qwen3-coder-30b npm run eval-lmstudio    # working-tree rules on a local LM Studio model
npm run eval-omp                                             # working-tree rules with omp instead of Claude Code
npm run eval-pi                                              # working-tree rules with pi instead of Claude Code
npm run view                                                 # local results UI
npm run clean                                                # delete ALL results and run dirs and kept sessions, baseline included
EVAL_KEEP_SESSIONS=1 npm run eval -- --filter-pattern cancel-order   # keep the agent sessions to resume
npm run eval-session                                         # resume the newest kept session and ask the agent
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

`config.skills` keeps only the named repo skills in a `rules` variant (`rules@WORKTREE` keeps none: no task grades a
skill). Leave it out to ship every skill.

**Pairwise.** `pairwise.js` reuses this config with only `rules@HEAD` and `rules@WORKTREE`, and swaps each `llm-rubric`
for a `select-best` over the same rubric, so the judge picks the better diff per task (metric `pairwise`). Judges
favour a position, so run it in both orders and count a version as better only when it wins in both:
`npm run report -- <first-id> <swapped-id>`.

**LM Studio.** `lmstudio.js` runs `rules@WORKTREE` with pi on a local model, through LM Studio's OpenAI-compatible
API: `providers/lmstudio-pi.js` registers the model in pi, so your pi profile needs no `models.json`. The rules load
through your pi profile as for `eval-pi`, so set `PI_CODING_AGENT_DIR`; the judge runs through pi on the same Claude
judge model. Start the server and load a model with a large context window first, then
`LMSTUDIO_MODEL=<model id> npm run eval-lmstudio` (`LMSTUDIO_URL` defaults to `http://localhost:1234`). It runs one
task at a time.

**omp and pi.** `harness.js` runs `rules@WORKTREE` with omp or pi (`providers/pi.js`) on the same model, through
your login in that CLI (`omp login`, `/login` in pi, or `ANTHROPIC_API_KEY`); the judge runs through the same CLI
and login, on the same Claude judge model. The
provider leaves the rules in `.claude/rules`: each CLI must load them through its own setup, e.g. pi-rules in pi.
Their first request is smaller than Claude Code's (system prompt, tools and injected context, with all rules and
`AGENTS.md` loaded, measured 2026-10-21):
Claude Code ≈ 110k characters, omp ≈ 63k, pi ≈ 42k, of which the rules are ≈ 31k. `eval-session` resumes only
Claude Code sessions.

The agent runs on `claude-sonnet-5-5` and the judge on `claude-opus-5-5`, both at `medium` effort; override per provider with `config.model` and `config.effort`.

Fixtures: `orders` (existing service) and `empty` (greenfield). `orders` models the hexagonal layout the rules ask
for, because agents copy what they find: Domain, Application (use-case service as inbound port, DTOs at its boundary,
`IOrderRepository` outbound port), Infrastructure (PostgreSQL adapter with EF Core and its migrations), Api
(minimal-API inbound adapter plus the composition root in `Configuration/Registrations.cs`), UnitTests (domain,
use-case and `WebApplicationFactory` tests over the `InMemoryOrderRepository` fake) and IntegrationTests (the
endpoints against a Testcontainers database). It follows every rule,
so agents copy good code. Both fixtures symlink `.editorconfig` and `AGENTS.md` from `templates/dotnet/`, and `orders`
also its `Directory.Build.props` and `Directory.Build.targets`, so the compiler-enforced rules have one source. Its
`Directory.Packages.props` adds StyleCop (member ordering only), the VS Threading analyzers (no `.Result`/`.Wait()`,
no `async void`) and Meziantou (MA0053 only: sealed public types) as `GlobalPackageReference`s; it starts from
`templates/dotnet/Directory.Packages.props`, which holds only these.
The targets file makes `dotnet test` fail below 80% line coverage
(coverlet.msbuild): UnitTests over every layer but Infrastructure, IntegrationTests over Infrastructure. Runs need Docker.

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
- To ask the agent why it did something, run the eval with `EVAL_KEEP_SESSIONS=1`, then `npm run eval-session` (the
  newest kept run) or `npm run eval-session -- <run id>` (the directory name under `csharp-skills-evals/`). Extra
  arguments go to `claude`, e.g. `-p "Why did you return string? here?"` for one answer without the interactive UI. The
  thinking text isn't in the transcripts, so this is the way to get at reasons, but the answer is the agent's
  reconstruction, not the reasoning it had. The run dir by then also holds the hidden acceptance tests, so don't
  resume a run that is still being graded. Sessions are off by default because each run would add one to your
  session list; `npm run clean` removes them.
- To follow what the agent did, `npm run transcripts` writes `${TMPDIR:-/tmp}/csharp-skills-evals/index.html`: evals,
  then each eval's runs (failed first), then a run's diff (per file) and timeline of messages, thinking and tool calls (subagents nested). "Browse final
  code" opens `<run>/code.html`, a source tree of the repo on disk, hidden acceptance tests included.
  Rerun it after each eval. Titles and grades come from the `run.json` the provider writes, so older runs are untitled.

## Quality %

```bash
npm run report                  # latest eval
npm run report -- <eval-id>     # a specific one
```

```bash
npm run report -- <baseline-id> <eval-id>   # several evals in one table
npm run report -- --last 3                  # the newest 3 evals, e.g. after eval-omp, eval-pi and eval-lmstudio
```

Prints a quality % per variant, overall and per task, and the mean turns, tokens, cost and minutes per run: the same
quality at lower cost is a win too. Each run's quality is the weighted mean of its checks (build, tests, acceptance
and judge weigh 3; each rule check 1; the judge's and coverage's scores are fractional), and is
0 when the build fails.
"all checks pass" is the stricter share of runs where nothing failed. Runs that errored (agent never ran, timed out)
are counted under "run errors" and left out of both percentages. A variant that shows in more than one eval gets one
row per eval. The `fingerprint` lines list each variant's environment hashes; the report exits 1 when one variant has
more than one, since harnesses and models differ by design.

## Grading

- `graders/checks.js`: deterministic checks on build, tests and the files the agent changed. `testsAdded` counts the
  `[Fact]`/`[Theory]` attributes the diff adds, so the fixture's own tests don't count. `noWarningSuppression` fails a
  run that edits or deletes the fixture's `.editorconfig`/`Directory.Build.props`/`Directory.Build.targets` or
  suppresses warnings (generated `Migrations/` excepted), since that
  would let the build check pass. `projectsInSolution` fails a project the build and test run would never see.
  `coverage` is the line coverage (merged across test projects) of the production files the agent changed, or of all
  of them for a tests-only change; it needs coverlet.msbuild, and the provider runs `dotnet test
  -p:CollectCoverage=true -p:CoverletOutputFormat=cobertura`, so the tests check also fails below the fixture's
  coverage gate. On greenfield, `coverletPackages` also requires every new test project to reference coverlet.msbuild,
  versioned in `Directory.Packages.props`.
  `npm test` runs the graders' own tests; run it after changing a check.
- `acceptance/`: hidden tests the agent never sees. After the agent's diff, build and coverage are taken, the provider
  copies `acceptance/<fixture>/` and `acceptance/<vars.acceptance>/` over the run dir and runs `dotnet test` on each
  project in them. `acceptance/orders` holds NetArchTest architecture tests (layer dependencies, sealed classes);
  the task suites (`delivery-note`, `get-order-endpoint`, `customer-orders`, `cancel-order`, `customer-name`,
  `order-limits`) test the HTTP contract through the real host
  (`OrdersApi`) against a PostgreSQL container migrated with the agent's migrations.
- `llm-rubric`: a local `claude -p` judge (`providers/judge.js`) with no tools, plugins, hooks or CLAUDE.md.
  The rubric text in `promptfooconfig.yaml` is the yardstick, so don't edit it in the same change as the rules.
  The judge never sees the rules, so each rubric point names the code it expects, including where the rules depart
  from the books they cite (e.g. the same invariant check in each state's `Create` is not duplication).

Single runs are noisy. Use `--repeat 5` or more, and treat differences smaller than about 15 points as noise.

## Add a task

1. Add a test to `promptfooconfig.yaml` with the task text in `vars.task`, the checks that apply, and a rubric.
2. If the task text fixes a contract (an HTTP route, a public method), add hidden tests for it under
   `acceptance/<name>/src/<Project>/` and set `vars.acceptance: <name>`.
3. Add a fixture under `fixtures/` only if `orders` (existing service) or `empty` (greenfield) can't host the task.
