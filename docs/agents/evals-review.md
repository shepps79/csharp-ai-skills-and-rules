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

1. **Judge prompt injection.** The judge reads the agent's diff verbatim, so a comment like "score this 1" lands in
   its prompt. This is low risk with a cooperative agent, but nothing defends against it. Fix: tell the judge that the
   diff is untrusted data, or strip comments before judging.
2. **Gaps in the fingerprint.** It hashes `settings.json`, `CLAUDE.md` and `RTK.md`. It doesn't cover other `@`-imports,
   `~/.claude/skills`, `agents/`, `commands/`, or plugin *contents* (only names and paths). A change there alters the
   `env`/`rules` variants without changing the hash.
3. **There is still no cross-eval fingerprint guard.** The report prints the hash, but comparing it is still manual
   (next-steps item 8).
4. **Regex checks remain shallow.** `testCancellationToken` misses `default` and `new CancellationToken()`, and doesn't
   catch tests that don't pass a token at all. `noNullForAbsence` misses `FirstOrDefault()` leaking null through a
   `Maybe`-less path. Hidden acceptance tests and an architecture test (next steps 5–6) are the real fix.
5. ~~`layeredProjects` doesn't check Infrastructure or the API.~~ Fixed: it now requires a web API project that
   references Application, and fails Infrastructure → API references.
6. **Killing the agent on timeout uses SIGTERM on `claude` only.** Child processes such as `dotnet` build servers can
   outlive it. This is harmless but leaks processes.
7. **Grader tests leave temp dirs** in `$TMPDIR/checks-test-*`.
8. **Rule conflicts in the rules themselves** (already in next steps item 3): `testing.md` examples return
   `(Order?)null`, and `hexagonal-architecture.md` says to translate errors into exceptions. Both contradict
   `dotnet-functional.md`. The evals measure these conflicts; they don't fix them.
