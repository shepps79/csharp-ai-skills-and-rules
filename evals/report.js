// Quality % and cost per variant and task for one or more evals (default: latest).
// Quality is promptfoo's weighted score (build, tests, acceptance and judge weigh 3, each rule check 1),
// forced to 0 when the build fails: code that doesn't compile has no quality.
// Runs that errored (agent never ran, not logged in, timeout) say nothing about quality, so they're left out.
// Exits 1 when the evals' environment fingerprints differ, because their results can't be compared.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// promptfoo also puts failed-assertion reasons in `error`; only failureReason 2 means the run itself errored.
const ERRORED = 2;

const evalIds = process.argv.length > 2 ? process.argv.slice(2) : ['latest'];
const fingerprints = new Set(evalIds.flatMap((evalId) => report(exportEval(evalId))));

// Printed so results from separate evals (baseline vs today) can be checked as comparable.
console.log(`fingerprint: ${[...fingerprints].join(', ') || 'none recorded'}`);
if (fingerprints.size > 1) {
  console.error(`${fingerprints.size} environment fingerprints: the global setup changed, so these results aren't comparable. ` +
    'Re-run the baseline.');
  process.exitCode = 1;
}

function exportEval(evalId) {
  const exportPath = path.join(os.tmpdir(), `csharp-skills-eval-${process.pid}.json`);
  try {
    execFileSync('npm', ['run', '--silent', 'promptfoo', '--', 'export', 'eval', evalId, '-o', exportPath],
      { cwd: __dirname, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    const reason = `${error.stdout}${error.stderr}`.split('\n').find((line) => /no eval found/i.test(line));
    console.error(reason ? `${reason}. Run an eval first (npm run eval or npm run eval-baseline).` : error.message);
    process.exit(1);
  }
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  fs.rmSync(exportPath);
  return exported;
}

// Prints the eval's table and returns its fingerprint hashes (the bare-model "none" variant has no global setup).
function report(exported) {
  const rows = exported.results.results.map((r) => ({
    variant: r.provider.label ?? r.provider.id,
    task: r.testCase.description.split(' ')[0],
    quality: r.failureReason === ERRORED || !r.response?.metadata?.dotnet?.buildOk ? 0 : r.score,
    passed: r.success,
    errored: r.failureReason === ERRORED,
    turns: r.response?.metadata?.agent?.turns ?? 0,
    minutes: (r.response?.metadata?.agent?.durationMs ?? 0) / 60000,
    tokens: r.response?.tokenUsage?.total ?? 0,
    cost: r.response?.cost ?? 0,
    pairwise: r.namedScores?.pairwise,
    fingerprint: r.response?.metadata?.fingerprint?.hash,
  }));

  const tasks = [...new Set(rows.map((r) => r.task))];
  const table = Object.fromEntries([...new Set(rows.map((r) => r.variant))].map((variant) => {
    const all = rows.filter((r) => r.variant === variant);
    const valid = all.filter((r) => !r.errored);
    const average = (field) => valid.reduce((total, r) => total + r[field], 0) / (valid.length || 1);
    const byTask = tasks.map((task) => [task, percent(valid.filter((r) => r.task === task).map((r) => r.quality))]);
    return [variant, {
      quality: percent(valid.map((r) => r.quality)),
      ...Object.fromEntries(byTask),
      'all checks pass': percent(valid.map((r) => Number(r.passed))),
      ...(valid.some((r) => r.pairwise !== undefined) ? { 'pairwise wins': percent(valid.map((r) => r.pairwise ?? 0)) } : {}),
      runs: valid.length,
      'failed checks': valid.filter((r) => !r.passed).length,
      'run errors': all.length - valid.length,
      // Per run: a rule change with the same quality at lower cost is still a win.
      turns: Math.round(average('turns')),
      'k tokens': Math.round(average('tokens') / 1000),
      'cost $': Number(average('cost').toFixed(2)),
      minutes: Number(average('minutes').toFixed(1)),
    }];
  }));

  console.log(`${exported.evalId} — ${exported.config?.description ?? ''}`);
  console.table(table);
  return rows.filter((r) => r.variant !== 'none' && r.fingerprint).map((r) => r.fingerprint);
}

function percent(values) {
  return values.length ? `${Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length)}%` : 'n/a';
}
