// Resumes the agent session of an eval run, so you can ask the agent why it made a choice. Needs a run made with
// EVAL_KEEP_SESSIONS=1. Usage: npm run eval-session -- [run id or dir] [claude args, e.g. -p "Why ...?"]
// With no run, picks the newest run whose session was kept.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RUNS_ROOT = path.join(os.tmpdir(), 'csharp-skills-evals');
const PROJECTS = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects');

const [target, ...claudeArgs] = process.argv.slice(2);
const runs = fs.existsSync(RUNS_ROOT)
  ? fs.readdirSync(RUNS_ROOT).map((name) => path.join(RUNS_ROOT, name)).filter((dir) => fs.existsSync(path.join(dir, 'run.json')))
  : [];
const run = target && !target.startsWith('-')
  ? runs.find((dir) => path.basename(dir) === target) ?? path.resolve(target).replace(/\/repo\/?$/, '')
  : runs.filter((dir) => sessionFile(session(dir)?.session_id)).sort().at(-1);
if (target?.startsWith('-')) {
  claudeArgs.unshift(target);
}

const init = run && session(run);
if (!init) {
  fail(`No run with a kept session${target ? ` matching ${target}` : ''}. Run the eval with EVAL_KEEP_SESSIONS=1 first.`);
}
if (!sessionFile(init.session_id)) {
  fail(`The session of ${run} was not kept. Run the eval with EVAL_KEEP_SESSIONS=1 first.`);
}

const meta = JSON.parse(fs.readFileSync(path.join(run, 'run.json'), 'utf8'));
console.error(`Resuming ${meta.provider} on "${meta.description}" in ${init.cwd}`);
console.error('The run dir now also holds the hidden acceptance tests and build output from grading.');
// Resumed with the run's own model and, for `none`, without the global setup, so the agent answers as it ran.
const args = ['--resume', init.session_id, '--model', init.model, ...claudeArgs];
const env = { ...process.env };
if (meta.provider === 'none') {
  args.push('--setting-sources', '', '--strict-mcp-config');
  env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1';
  env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
}
process.exitCode = spawnSync('claude', args, { cwd: init.cwd, env, stdio: 'inherit' }).status ?? 1;

// The transcript's init event: session id, model and working directory of the run.
function session(runDir) {
  const transcript = path.join(runDir, 'transcript.jsonl');
  if (!fs.existsSync(transcript)) {
    return null;
  }
  const line = fs.readFileSync(transcript, 'utf8').split('\n').find((text) => text.includes('"subtype":"init"'));
  return line ? JSON.parse(line) : null;
}

function sessionFile(sessionId) {
  return Boolean(sessionId) && fs.existsSync(PROJECTS)
    && fs.readdirSync(PROJECTS).some((dir) => fs.existsSync(path.join(PROJECTS, dir, `${sessionId}.jsonl`)));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
