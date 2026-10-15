# Evals: next steps

The eval harness in `evals/` (see `evals/README.md`) runs Claude Code headless against a .NET fixture
for each variant (`none`, `env`, `rules@HEAD`, `rules@WORKTREE`) and grades the result with deterministic
checks plus a local `claude -p` judge. Everything stays local; promptfoo telemetry and sharing are off.

## Current state

- Agent: `claude-sonnet-5-5`. Judge: `claude-opus-5-5`.
- One fixture (`fixtures/orders`) and three tasks: `find-order` (null trap), `place-order-tests`
  (mocks vs TestContainers conflict), `cancel-order` (realistic feature).
- 11 deterministic checks in `evals/graders/checks.js`, plus one `llm-rubric` per task.
- Smoke run passed end to end (one task, `rules@HEAD`, before the agent model switched to Sonnet).
- No baseline recorded yet.

## Next steps, in order

1. **Record a baseline.** `npm run eval-baseline -- --repeat 5` from `evals/`. Note the
   fingerprint hash and the per-metric pass rate for each variant. `none` against `env` shows what your
   global setup adds; `env` against `rules@HEAD` shows what the repo rules add.
2. **Ablation.** Add a provider option that drops one rule file (e.g. `config.excludeRules: [testing.md]`)
   and run each file out in turn. Files whose removal changes nothing are dead weight or ignored.
3. **Rule-conflict tasks.** Add a task per known contradiction:
   - `hexagonal-architecture.md` "Unit test use TestContainers" vs `testing.md` Moq for ports
     (covered by `place-order-tests`).
   - `testing.md` examples returning `(Order?)null` vs `dotnet-functional.md` banning null.
   - `hexagonal-architecture.md` "translate to an exception" vs `dotnet-functional.md` "translate to a Result".
4. **Skill-triggering tasks.** Tasks that should load a skill (`ef-core`, `fast-endpoints`, `configuration`,
   `dependency-injection`, `opentelemetry`, `aspire`) and tasks that shouldn't. Grade on
   `metadata.agent.skillsUsed`. Needs a fixture with an API project and EF Core (add `fixtures/orders-api`).
5. **Hidden acceptance tests.** For tasks with a fixed contract, copy tests from `acceptance/<task-id>/`
   into the run dir after the agent finishes and run them in `buildAndTest`.
6. **Architecture check.** Add an ArchUnitNET or NetArchTest test to the fixture's acceptance set enforcing
   Domain → nothing, Application → Domain, Infrastructure → Application.
7. **Pairwise judging.** Use promptfoo `select-best` with the judge provider to pick the better of
   `rules@HEAD` and `rules@WORKTREE` per test, run twice with the order swapped to cancel position bias.
8. **Fingerprint guard.** A small script (or `javascript` assertion) that fails when results being compared
   have different `metadata.fingerprint.hash`.
9. **Cost and effort metrics.** Surface `metadata.agent.turns`, tokens and cost per variant; a rule change
   with the same quality at lower cost counts as a win.

## Things to keep in mind

- The rubrics in `promptfooconfig.yaml` are the yardstick. Change them in a separate commit from rule changes,
  and re-run the baseline after.
- Single runs are noisy. Use `--repeat 5` or more; differences under about 15 points are noise at that size.
- The global setup (RTK, ponytail, CLAUDE.md) is deliberately part of the `env` and `rules@*` variants.
  If it changes, the fingerprint changes and the baseline must be re-run.
