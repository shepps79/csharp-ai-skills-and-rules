// Runs Claude Code headless against a fresh copy of a fixture, then builds and tests the result.
// Variants: "none" (bare model), "env" (your global setup, no repo rules),
// "rules" (global setup + this repo's .claude/ at `rulesRef`: a git ref, or WORKTREE for uncommitted edits).
// `excludeRules: [file.md]` drops rule files for an ablation run; `skills: [name]` keeps only those repo skills.
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
const DEFAULT_EFFORT = 'medium';
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;
// A deadlocked test (e.g. a stray .Result) must fail the run, not hang the whole eval.
const DOTNET_TIMEOUT_MS = 10 * 60 * 1000;

class ClaudeCodeProvider {
  constructor(options) {
    this.config = { model: DEFAULT_MODEL, effort: DEFAULT_EFFORT, ...options.config };
    this.label = options.label;
  }

  id() {
    const { variant, rulesRef, excludeRules = [], skills } = this.config;
    const without = excludeRules.map((file) => `-${file}`).join('');
    const only = skills ? `+skills:${skills.join(',')}` : '';
    return variant === 'rules' ? `claude-code:rules@${rulesRef}${without}${only}` : `claude-code:${variant}`;
  }

  async callApi(prompt, context) {
    const runDir = createRunDir(context.vars.fixture, this.config);
    // The transcript holds neither the task nor the eval, so transcripts.js reads them from here.
    fs.writeFileSync(path.join(runDir, '..', 'run.json'), JSON.stringify({
      evalId: context.evaluationId,
      testIdx: context.testIdx,
      description: context.test?.description,
      task: prompt,
      provider: this.label ?? this.id(),
      fixture: context.vars.fixture,
    }, null, 2));
    const events = await runAgent(prompt, runDir, this.config);
    const result = events.find((e) => e.type === 'result') ?? {};
    if (result.is_error) {
      // An agent that never ran (e.g. not logged in) is an ERROR, not a quality FAIL.
      return { error: `agent failed in ${runDir}: ${result.result}` };
    }
    const changedFiles = stageAndListChanges(runDir);
    const diff = git(runDir, 'diff', '--cached', 'HEAD');

    return {
      // Fenced so the results UI's "Render markdown" setting shows it as a highlighted diff.
      output: diff ? `\`\`\`diff\n${diff}\n\`\`\`` : '(no changes)',
      cost: result.total_cost_usd,
      tokenUsage: tokenUsage(result.usage),
      metadata: {
        runDir,
        changedFiles,
        dotnet: buildAndTest(runDir, context.vars),
        agent: summariseTranscript(events, result),
        fingerprint: fingerprint(events, this.config),
      },
    };
  }
}

function createRunDir(fixture, { variant, rulesRef, excludeRules = [], skills }) {
  const runDir = path.join(RUNS_ROOT, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, 'repo');
  // Fixtures symlink shared files from templates/; copy their contents so each run dir is self-contained.
  fs.mkdirSync(runDir, { recursive: true });
  execFileSync('cp', ['-RL', `${path.join(EVALS, 'fixtures', fixture)}/.`, runDir]);
  if (variant === 'rules') {
    copyRules(rulesRef, runDir);
    excludeRules.forEach((file) => fs.rmSync(path.join(runDir, '.claude', 'rules', file)));
    const skillsDir = path.join(runDir, '.claude', 'skills');
    if (skills && fs.existsSync(skillsDir)) {
      fs.readdirSync(skillsDir).filter((name) => !skills.includes(name))
        .forEach((name) => fs.rmSync(path.join(skillsDir, name), { recursive: true }));
    }
  }
  // Rules are committed with the fixture so the diff only shows the agent's work.
  git(runDir, 'init', '-q');
  // Keeps build output out of the diff without a .gitignore the agent could see (greenfield starts empty).
  fs.appendFileSync(path.join(runDir, '.git', 'info', 'exclude'), 'bin/\nobj/\nTestResults/\n');
  git(runDir, 'add', '-A');
  git(runDir, '-c', 'user.name=eval', '-c', 'user.email=eval@localhost', 'commit', '-qm', 'fixture', '--allow-empty');
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

function runAgent(prompt, runDir, { variant, model, effort }) {
  const args = ['-p', prompt, '--model', model, '--effort', effort, '--permission-mode', 'auto',
    '--output-format', 'stream-json', '--verbose'];
  // EVAL_KEEP_SESSIONS=1 keeps each session, so `npm run eval-session` can resume it and ask the agent about its choices.
  if (process.env.EVAL_KEEP_SESSIONS !== '1') {
    args.push('--no-session-persistence');
  }
  const env = { ...process.env };
  if (variant === 'none') {
    args.push('--setting-sources', '', '--strict-mcp-config');
    env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1';
    env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
  }

  const transcriptPath = path.join(runDir, '..', 'transcript.jsonl');
  return new Promise((resolve, reject) => {
    // Own process group, so a timeout also kills what the agent started (dotnet build servers, test hosts).
    const child = spawn('claude', args, { cwd: runDir, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const transcript = fs.createWriteStream(transcriptPath);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; transcript.write(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // The group already exited.
      }
    }, AGENT_TIMEOUT_MS);
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
  return git(runDir, 'diff', '--cached', '--name-only', '--diff-filter=d', 'HEAD').split('\n').filter(Boolean);
}

// Builds and tests the agent's work, then runs the hidden acceptance tests in acceptance/<fixture> and
// acceptance/<vars.acceptance>.
function buildAndTest(runDir, { fixture, acceptance }) {
  const build = dotnet(runDir, ['build', '-warnaserror']);
  if (!build.ok) {
    return { buildOk: false, testsOk: false, passed: 0, failed: 0, coverage: null, acceptance: null, log: build.log.slice(-4000) };
  }
  // coverlet.msbuild: the fixture's Directory.Build.targets turns it on and fails the run below its threshold; the
  // global properties make a greenfield solution without that file report coverage too.
  const test = dotnet(runDir, ['test', '--no-build', '-p:CollectCoverage=true', '-p:CoverletOutputFormat=cobertura']);
  return {
    buildOk: true,
    testsOk: test.ok,
    ...testCounts(test.log),
    coverage: lineCoverage(runDir),
    acceptance: acceptanceTests(runDir, [fixture, acceptance]),
    log: test.log.slice(-4000),
  };
}

// Copied in only after the agent's diff and coverage are taken, so the agent never sees them and they don't count.
function acceptanceTests(runDir, names) {
  const dirs = names.filter(Boolean).map((name) => path.join(EVALS, 'acceptance', name)).filter((dir) => fs.existsSync(dir));
  if (dirs.length === 0) {
    return null;
  }
  dirs.forEach((dir) => fs.cpSync(dir, runDir, { recursive: true }));
  const projects = dirs.flatMap((dir) => fs.readdirSync(dir, { recursive: true }).filter((file) => file.endsWith('.csproj')));
  const runs = projects.map((project) => dotnet(runDir, ['test', project]));
  const log = runs.map((run) => run.log).join('\n');
  return { ok: runs.every((run) => run.ok), ...testCounts(log), log: log.slice(-4000) };
}

function testCounts(log) {
  const sum = (pattern) => [...log.matchAll(pattern)].reduce((total, m) => total + Number(m[1]), 0);
  // VSTest "Passed: n", Testing Platform "succeeded: n"
  return { passed: sum(/(?:passed|succeeded):\s+(\d+)/gi), failed: sum(/failed:\s+(\d+)/gi) };
}

// Covered and coverable lines per production file, merged across test projects: a line counts as covered when
// any project's tests hit it. null when no coverlet report was written.
function lineCoverage(runDir) {
  const reports = fs.readdirSync(runDir, { recursive: true })
    .filter((file) => file.endsWith('coverage.cobertura.xml') && !file.split(path.sep).includes('node_modules'))
    .map((file) => path.join(runDir, file));
  if (reports.length === 0) {
    return null;
  }
  const hitByLine = new Map();
  for (const report of reports) {
    const xml = fs.readFileSync(report, 'utf8');
    const source = xml.match(/<source>([^<]*)<\/source>/)?.[1] ?? runDir;
    for (const [, filename, body] of xml.matchAll(/<class [^>]*filename="([^"]+)"[^>]*>([\s\S]*?)<\/class>/g)) {
      const file = path.relative(runDir, path.resolve(source, filename));
      for (const [, line, hits] of body.matchAll(/<line number="(\d+)" hits="(\d+)"/g)) {
        const key = `${file}:${line}`;
        hitByLine.set(key, hitByLine.get(key) || Number(hits) > 0);
      }
    }
  }
  const files = {};
  for (const [key, hit] of hitByLine) {
    const file = key.slice(0, key.lastIndexOf(':'));
    files[file] ??= { covered: 0, lines: 0 };
    files[file].lines += 1;
    files[file].covered += Number(hit);
  }
  return files;
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
function fingerprint(events, { variant, model, effort }) {
  const init = events.find((e) => e.subtype === 'init') ?? {};
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
  const global = (paths) => (variant === 'none' ? [] : paths.filter((file) => fs.existsSync(file))
    .map((file) => `${path.relative(configDir, file)}:${hashTree(file)}`));
  const plugins = init.plugins ?? [];
  const parts = {
    claudeCode: init.claude_code_version,
    model: init.model ?? model,
    effort,
    plugins: plugins.map((p) => `${p.name}:${p.path ? hashTree(p.path) : ''}`).sort(),
    globalFiles: global([path.join(configDir, 'settings.json'), ...withImports(path.join(configDir, 'CLAUDE.md')),
      ...['skills', 'agents', 'commands'].map((dir) => path.join(configDir, dir))]),
    rtk: variant === 'none' ? null : commandVersion('rtk'),
    dotnet: commandVersion('dotnet'),
  };
  return { hash: sha(JSON.stringify(parts)).slice(0, 12), ...parts };
}

// A memory file plus every file it pulls in with `@path`, recursively.
function withImports(file, seen = new Set()) {
  if (seen.has(file) || !fs.existsSync(file)) {
    return [];
  }
  seen.add(file);
  const imports = [...fs.readFileSync(file, 'utf8').matchAll(/^@(\S+)/gm)]
    .map(([, ref]) => path.resolve(path.dirname(file), ref.replace(/^~(?=\/)/, os.homedir())));
  return [file, ...imports.flatMap((ref) => withImports(ref, seen))];
}

// Content hash of a file, or of every file under a directory (names included, so renames count).
function hashTree(target) {
  if (!fs.statSync(target, { throwIfNoEntry: false })?.isDirectory()) {
    return fs.existsSync(target) ? sha(fs.readFileSync(target)).slice(0, 12) : 'missing';
  }
  const files = fs.readdirSync(target, { recursive: true })
    // Claude Code writes a `.in_use/<pid>` lock into each plugin it loads.
    .filter((file) => !file.split(path.sep).some((part) => part === '.git' || part === '.in_use') && fs.statSync(path.join(target, file), { throwIfNoEntry: false })?.isFile())
    .sort();
  return sha(files.map((file) => `${file}:${sha(fs.readFileSync(path.join(target, file)))}`).join('\n')).slice(0, 12);
}

function tokenUsage(usage = {}) {
  const prompt = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const completion = usage.output_tokens ?? 0;
  return { prompt, completion, total: prompt + completion };
}

function dotnet(cwd, args) {
  try {
    return { ok: true, log: execFileSync('dotnet', args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: DOTNET_TIMEOUT_MS }) };
  } catch (error) {
    const timedOut = error.code === 'ETIMEDOUT' ? `\ndotnet ${args[0]} timed out after ${DOTNET_TIMEOUT_MS / 60000} min` : '';
    return { ok: false, log: `${error.stdout ?? ''}${error.stderr ?? ''}${timedOut}` };
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
