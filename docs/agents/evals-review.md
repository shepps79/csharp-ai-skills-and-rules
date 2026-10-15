# Evals: adversarial review (2026-10-15)

I reviewed the harness in `evals/` (provider, judge, graders, report, fixtures, config) by asking one question:
how could a run get a score it didn't earn, or lose one it did? I checked suspected issues against the 20 run dirs in
`/tmp/csharp-skills-evals` and against real `dotnet test` output.

**Re-run the baseline.** The graders changed, so earlier results aren't comparable with new ones. A
`baseline --repeat 5` eval was running while these edits were made, so its grading may mix old and new checks.
Discard it and run `npm run eval-baseline -- --repeat 5` again.

## Fixed

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Critical | **The build check could be gamed.** It is the main gate (weight 3, and quality is 0 without it), but nothing stopped the agent editing or deleting `.editorconfig`/`Directory.Build.props`, or adding `<NoWarn>`, `#pragma warning disable`, `[SuppressMessage]`, `severity = none` or `<Nullable>disable`. Any of these turns analyzer errors off and the build still "passes". | New `noWarningSuppression` check on every task: fails if a fixture build guard is modified or deleted (via `git diff --diff-filter=MD`) or if any changed build or source file contains a suppression. |
| 2 | Major | **`testsAdded` didn't measure added tests.** It counted *all* passing tests. The `orders` fixture already has 2, so adding one test met the "≥ 3" bar. Confirmed on a real run: 6 passing tests, of which only 4 were new. | Counts the `[Fact]`/`[Theory]` lines the diff adds, ignoring `Skip`. The existing `tests` check still proves they pass. |
| 3 | Major | **Projects missing from the solution were invisible.** `dotnet build`/`dotnet test` only see projects listed in the root `.sln`/`.slnx`. A new test project left out of it was never compiled or run, so its broken code or failing tests went unnoticed. | New `projectsInSolution` check on every task: every changed `.csproj` must appear in a root solution file. |
| 4 | Major | **No timeout on `dotnet build`/`test`.** A deadlocking test (`.Result`, which the rules ban for exactly this reason) would hang the whole eval forever. The agent had a 30-minute timeout; dotnet had none. | 10-minute timeout per dotnet command. A timeout fails the run and is noted in the log. |
| 5 | Major | **`report.js` counted errored runs as 0% quality.** The provider is careful to mark "agent never ran" (not logged in, timeout) as an ERROR rather than a FAIL, but the report then averaged those in as 0. A few infrastructure errors in one variant would show up as a quality drop. | Errored runs are left out of `quality` and `all checks pass` and still counted under `run errors`. A variant with no valid runs shows `n/a` instead of `NaN%`. |
| 6 | Major | **`noThrowInDomain` failed rule-compliant code.** A switch expression over an enum needs a discard arm (CS8524, and the template sets IDE0072 to error). `dotnet.md` also requires unhandled switch branches to throw `NotImplementedException`. Both mean `_ => throw …` in Domain, which failed the check. It also matched the word "throw" in comments. | Comments are stripped and `_ => throw` / `default: throw` arms are allowed. A business-rule throw (e.g. `if (qty < 0) throw …`) still fails. |
| 7 | Major | **`noNullForAbsence` only caught `Task<T?>`.** A sync `Order? Find(...)` or `string? Lookup(...)` passed, even though this is the headline trap check. | Also matches nullable method return types (`\w+? Name(`) and lower-case `Task<string?>`. |
| 8 | Major | **The fingerprint couldn't be compared across evals.** The documented workflow is "baseline in one eval, today's run in another, only compare matching fingerprints", but the report only warned about a mismatch *within* one eval and never printed the hash. | The report prints the fingerprint hash(es). |
| 9 | Major | **The graders had no tests.** They are regexes, and they are the yardstick. Several of them (items 2, 6 and 7, plus the minor ones below) were wrong in ways no one could see. | `evals/graders/checks.test.js` (`npm test`): each changed check is tested against the shortcut it should catch and against compliant code. All 7 tests pass. The new checks also pass on all 20 existing real runs; the only failures were runs still in progress and `usesMaybe` on tasks that don't use it. |

These minor fixes were each a few characters, so I made them while in the file:

- `sealedTestClasses` missed `internal`/`partial`/unmodified test classes and singular `*Test` classes.
- `fileScopedNamespaces` missed `namespace X {` on one line. The build's IDE0161 also catches this.
- `testsUnderSrc` accepted nested `src/tests/X/X.csproj`. `testing.md` requires a flat `src/<project>/` layout.
- `layeredProjects` didn't check Domain package references. It now flags `Microsoft.AspNetCore*`/`Microsoft.EntityFrameworkCore*` in Domain.
- The docs said there were 16 checks. There are 19 now.

## Left open

Not fixed, in rough order of how much they matter:

1. ~~**Judge prompt injection.**~~ Mitigated: the judge's system prompt says the graded text is untrusted data and its
   instructions must not be followed. A determined injection could still get through; stripping comments would be stronger.
2. ~~**Gaps in the fingerprint.**~~ Fixed: it now hashes `CLAUDE.md` with its `@`-imports, `settings.json`, the
   `skills/`, `agents/` and `commands/` directories, and each plugin's contents.
3. ~~**No cross-eval fingerprint guard.**~~ Fixed: `npm run report -- <id> <id>` exits 1 when the fingerprints differ.
4. **Regex checks remain shallow.** `testCancellationToken` now also catches `default` and `new CancellationToken()`,
   and the build's xUnit1051 catches tests that pass no token. `noNullForAbsence` still misses `FirstOrDefault()`
   leaking null through a `Maybe`-less path; the `orders` architecture tests and `order-limits` acceptance tests
   cover structure and one contract, not this.
5. ~~`layeredProjects` doesn't check Infrastructure or the API.~~ Fixed: it now requires a web API project that
   references Application, and fails Infrastructure → API references.
6. ~~**Killing the agent on timeout uses SIGTERM on `claude` only.**~~ Fixed: the agent runs in its own process group,
   and the timeout kills the group.
7. ~~**Grader tests leave temp dirs.**~~ Fixed: `checks.test.js` removes them.
8. **Rule conflicts in the rules themselves**: now listed under "Rule problems the evals now surface" in
   `evals-next-steps.md`, each with the task and check that measures it.
