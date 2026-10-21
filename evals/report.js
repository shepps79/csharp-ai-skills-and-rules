// Quality % and cost per variant and task for one or more evals (default: latest; `--last <n>` for the newest n), in
// one table. A variant that shows in more than one eval gets one row per eval.
// Quality is promptfoo's weighted score (build, tests, acceptance and judge weigh 3, each rule check 1),
// forced to 0 when the build fails: code that doesn't compile has no quality.
// Runs that errored (agent never ran, not logged in, timeout) say nothing about quality, so they're left out.
// Exits 1 when one variant has more than one environment fingerprint, because its results can't be compared.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// promptfoo also puts failed-assertion reasons in `error`; only failureReason 2 means the run itself errored.
const ERRORED = 2;

const args = process.argv.slice(2);
const evalIds = args[0] === '--last' ? latestEvalIds(Number(args[1])) : args.length ? args : ['latest'];
const rows = evalIds.map(exportEval).flatMap(evalRows);
console.table(table(rows));

// Printed so results from separate evals (baseline vs today) can be checked as comparable. Fingerprints differ
// between harnesses and models by design, so only one variant's runs are compared.
const variants = [...new Set(rows.map((r) => r.variant))];
for (const variant of variants.filter((v) => v !== 'none')) {
  const fingerprints = new Set(rows.filter((r) => r.variant === variant && r.fingerprint).map((r) => r.fingerprint));
  console.log(`${variant} fingerprint: ${[...fingerprints].join(', ') || 'none recorded'}`);
  if (fingerprints.size > 1) {
    console.error(`${variant} has ${fingerprints.size} environment fingerprints: the global setup changed, so its results ` +
      "aren't comparable. Re-run the baseline.");
    process.exitCode = 1;
  }
}

function latestEvalIds(count) {
  if (!(count > 0)) {
    console.error('Usage: npm run report -- --last <number of evals>');
    process.exit(1);
  }
  const output = execFileSync('npm', ['run', '--silent', 'promptfoo', '--', 'list', 'evals', '--ids-only', '-n', String(count)],
    { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return output.split('\n').filter((line) => line.startsWith('eval-'));
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

function evalRows(exported) {
  const empty = exported.results.results.length ? '' : ' (no results, so no row)';
  console.log(`${exported.evalId} — ${exported.config?.description ?? ''}${empty}`);
  return exported.results.results.map((r) => ({
    evalId: exported.evalId,
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
}

// One row per variant, or per variant and eval when the variant shows in more than one eval.
function table(rows) {
  const evalsOf = (variant) => new Set(rows.filter((r) => r.variant === variant).map((r) => r.evalId));
  const rowName = (r) => (evalsOf(r.variant).size > 1 ? `${r.variant} (${r.evalId})` : r.variant);
  const tasks = [...new Set(rows.map((r) => r.task))];
  return Object.fromEntries([...new Set(rows.map(rowName))].map((name) => {
    const all = rows.filter((r) => rowName(r) === name);
    const valid = all.filter((r) => !r.errored);
    const average = (field) => valid.reduce((total, r) => total + r[field], 0) / (valid.length || 1);
    const byTask = tasks.map((task) => [task, percent(valid.filter((r) => r.task === task).map((r) => r.quality))]);
    return [name, {
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
}

function percent(values) {
  return values.length ? `${Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length)}%` : 'n/a';
}
