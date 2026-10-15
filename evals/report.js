// Quality % per variant and task for one eval (default: latest).
// Quality is promptfoo's weighted score (build, tests and judge weigh 3, each rule check 1),
// forced to 0 when the build fails: code that doesn't compile has no quality.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const evalId = process.argv[2] ?? 'latest';
const exportPath = path.join(os.tmpdir(), `csharp-skills-eval-${process.pid}.json`);
execFileSync('npm', ['run', '--silent', 'promptfoo', '--', 'export', 'eval', evalId, '-o', exportPath],
  { cwd: __dirname, stdio: 'ignore' });
const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
fs.rmSync(exportPath);

const rows = exported.results.results.map((r) => ({
  variant: r.provider.label ?? r.provider.id,
  task: r.testCase.description.split(' ')[0],
  quality: r.error || !r.response?.metadata?.dotnet?.buildOk ? 0 : r.score,
  passed: r.success,
  errored: Boolean(r.error),
  fingerprint: r.response?.metadata?.fingerprint?.hash,
}));

const percent = (values) => `${Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length)}%`;
const tasks = [...new Set(rows.map((r) => r.task))];
const table = Object.fromEntries([...new Set(rows.map((r) => r.variant))].map((variant) => {
  const mine = rows.filter((r) => r.variant === variant);
  const byTask = tasks.map((task) => [task, percent(mine.filter((r) => r.task === task).map((r) => r.quality))]);
  return [variant, {
    quality: percent(mine.map((r) => r.quality)),
    ...Object.fromEntries(byTask),
    'all checks pass': percent(mine.map((r) => Number(r.passed))),
    runs: mine.length,
    errors: mine.filter((r) => r.errored).length,
  }];
}));

console.log(`${exported.evalId} — ${exported.config?.description ?? ''}`);
console.table(table);

const fingerprints = new Set(rows.filter((r) => r.variant !== 'none' && r.fingerprint).map((r) => r.fingerprint));
if (fingerprints.size > 1) {
  console.warn(`Warning: ${fingerprints.size} environment fingerprints in this eval; the global setup changed mid-run.`);
}
