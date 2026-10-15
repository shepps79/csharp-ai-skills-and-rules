// Runs Claude Code headless against a fresh copy of a fixture, then builds and tests the result.
// Variants: "none" (bare model), "env" (your global setup, no repo rules),
// "rules" (global setup + this repo's .claude/ at `rulesRef`: a git ref, or WORKTREE for uncommitted edits).
const { execFileSync, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../..');
const EVALS = path.join(REPO, 'evals');
// Outside the repo so Claude Code can't discover this repo's .claude/ or CLAUDE.md from a parent directory.
const RUNS_ROOT = path.join(os.tmpdir(), 'csharp-skills-evals');
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;

class ClaudeCodeProvider {
  constructor(options) {
    this.config = { model: DEFAULT_MODEL, ...options.config };
    this.label = options.label;
  }

  id() {
    const { variant, rulesRef } = this.config;
    return variant === 'rules' ? `claude-code:rules@${rulesRef}` : `claude-code:${variant}`;
  }

  async callApi(prompt, context) {
    const runDir = createRunDir(context.vars.fixture, this.config);
    const events = await runAgent(prompt, runDir, this.config);
    const changedFiles = stageAndListChanges(runDir);
    const diff = git(runDir, 'diff', '--cached', 'HEAD');
    const result = events.find((e) => e.type === 'result') ?? {};

    return {
      output: diff || '(no changes)',
      cost: result.total_cost_usd,
      tokenUsage: tokenUsage(result.usage),
      metadata: {
        runDir,
        changedFiles,
        dotnet: buildAndTest(runDir),
        agent: summariseTranscript(events, result),
        fingerprint: fingerprint(events, this.config),
      },
    };
  }
}

function createRunDir(fixture, { variant, rulesRef }) {
  const runDir = path.join(RUNS_ROOT, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, 'repo');
  fs.cpSync(path.join(EVALS, 'fixtures', fixture), runDir, { recursive: true });
  if (variant === 'rules') {
    copyRules(rulesRef, runDir);
  }
  // Rules are committed with the fixture so the diff only shows the agent's work.
  git(runDir, 'init', '-q');
  git(runDir, 'add', '-A');
  git(runDir, '-c', 'user.name=eval', '-c', 'user.email=eval@localhost', 'commit', '-qm', 'fixture');
  return runDir;
}

function copyRules(rulesRef, runDir) {
  if (rulesRef === 'WORKTREE') {
    fs.cpSync(path.join(REPO, '.claude'), path.join(runDir, '.claude'), {
      recursive: true,
      filter: (src) => !src.endsWith('settings.local.json'),
    });
    return;
  }
  const archive = execFileSync('git', ['-C', REPO, 'archive', rulesRef, '.claude']);
  execFileSync('tar', ['-x', '-C', runDir], { input: archive });
}

function runAgent(prompt, runDir, { variant, model }) {
  const args = ['-p', prompt, '--model', model, '--permission-mode', 'auto',
    '--output-format', 'stream-json', '--verbose', '--no-session-persistence'];
  const env = { ...process.env };
  if (variant === 'none') {
    args.push('--setting-sources', '', '--strict-mcp-config');
    env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1';
    env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
  }

  const transcriptPath = path.join(runDir, '..', 'transcript.jsonl');
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: runDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const transcript = fs.createWriteStream(transcriptPath);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; transcript.write(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill('SIGTERM'), AGENT_TIMEOUT_MS);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      transcript.end();
      const events = stdout.split('\n').filter(Boolean).flatMap(parseJsonLine);
      if (!events.some((e) => e.type === 'result')) {
        reject(new Error(`claude exited ${code} without a result: ${stderr.slice(-2000)}`));
        return;
      }
      resolve(events);
    });
  });
}

function stageAndListChanges(runDir) {
  git(runDir, 'add', '-A');
  return git(runDir, 'diff', '--cached', '--name-only', 'HEAD').split('\n').filter(Boolean);
}

function buildAndTest(runDir) {
  const build = dotnet(runDir, ['build', '-warnaserror']);
  if (!build.ok) {
    return { buildOk: false, testsOk: false, passed: 0, failed: 0, log: build.log.slice(-4000) };
  }
  const test = dotnet(runDir, ['test', '--no-build']);
  const sum = (pattern) => [...test.log.matchAll(pattern)].reduce((total, m) => total + Number(m[1]), 0);
  return {
    buildOk: true,
    testsOk: test.ok,
    passed: sum(/Passed:\s+(\d+)/g),
    failed: sum(/Failed:\s+(\d+)/g),
    log: test.log.slice(-4000),
  };
}

function summariseTranscript(events, result) {
  const toolUses = events
    .filter((e) => e.type === 'assistant')
    .flatMap((e) => e.message?.content ?? [])
    .filter((block) => block.type === 'tool_use');
  const toolCounts = toolUses.reduce((counts, t) => ({ ...counts, [t.name]: (counts[t.name] ?? 0) + 1 }), {});
  return {
    turns: result.num_turns,
    durationMs: result.duration_ms,
    isError: result.is_error,
    finalMessage: result.result,
    skillsUsed: toolUses.filter((t) => t.name === 'Skill').map((t) => t.input?.skill),
    toolCounts,
    permissionDenials: result.permission_denials?.length ?? 0,
  };
}

// Identifies everything outside the repo that shapes a run; only compare runs whose fingerprints match.
function fingerprint(events, { variant, model }) {
  const init = events.find((e) => e.subtype === 'init') ?? {};
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
  const globalFiles = variant === 'none' ? [] : ['settings.json', 'CLAUDE.md', 'RTK.md']
    .map((name) => path.join(configDir, name))
    .filter((file) => fs.existsSync(file))
    .map((file) => `${path.basename(file)}:${sha(fs.readFileSync(file))}`);
  const parts = {
    claudeCode: init.claude_code_version,
    model: init.model ?? model,
    plugins: (init.plugins ?? []).map((p) => `${p.name}:${p.path ?? ''}`).sort(),
    globalFiles,
    rtk: variant === 'none' ? null : commandVersion('rtk'),
    dotnet: commandVersion('dotnet'),
  };
  return { hash: sha(JSON.stringify(parts)).slice(0, 12), ...parts };
}

function tokenUsage(usage = {}) {
  const prompt = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const completion = usage.output_tokens ?? 0;
  return { prompt, completion, total: prompt + completion };
}

function dotnet(cwd, args) {
  try {
    return { ok: true, log: execFileSync('dotnet', args, { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { ok: false, log: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

function commandVersion(command) {
  try {
    return execFileSync(command, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function parseJsonLine(line) {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
}

function sha(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = ClaudeCodeProvider;
