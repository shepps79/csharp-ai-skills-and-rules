// Writes one static page of every agent transcript under $TMPDIR/csharp-skills-evals: evals → runs → timeline.
// Rerun after each eval; the page is a snapshot, so runs still in progress show as ungraded.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RUNS_ROOT = path.join(os.tmpdir(), 'csharp-skills-evals');
// promptfoo also puts failed-assertion reasons in `error`; only failureReason 2 means the run itself errored.
const ERRORED = 2;
// Per-token and progress events say nothing about what the agent did.
const NOISE = new Set(['thinking_tokens', 'rate_limit_event', 'tool_progress']);

if (require.main === module) {
  const runs = loadRuns();
  const grades = new Map([...new Set(runs.map((r) => r.evalId).filter(Boolean))].flatMap(gradesOf));
  const page = path.join(RUNS_ROOT, 'index.html');
  runs.filter((r) => r.hasCode).forEach((r) => fs.writeFileSync(path.join(r.dir, 'code.html'), codeHtml(r, sourceFiles(path.join(r.dir, 'repo')))));
  fs.writeFileSync(page, html(runs.map((r) => ({ ...r, ...grade(r, grades.get(gradeKey(r.evalId, r.testIdx, r.provider))) }))));
  console.log(`${runs.length} transcripts → file://${page}`);
}

function loadRuns() {
  if (!fs.existsSync(RUNS_ROOT)) {
    return [];
  }
  return fs.readdirSync(RUNS_ROOT)
    .filter((name) => fs.existsSync(path.join(RUNS_ROOT, name, 'transcript.jsonl')))
    .map((name) => {
      const dir = path.join(RUNS_ROOT, name);
      const meta = fs.existsSync(path.join(dir, 'run.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')) : {};
      const events = fs.readFileSync(path.join(dir, 'transcript.jsonl'), 'utf8').split('\n').filter(Boolean)
        .flatMap(parseJsonLine)
        .filter((e) => !NOISE.has(e.type) && !NOISE.has(e.subtype));
      // Run dirs are named `<Date.now()>-<random>` by the provider.
      return { name, dir, startedAt: Number(name.split('-')[0]), ...meta, events,
        diff: stagedDiff(path.join(dir, 'repo')), hasCode: fs.existsSync(path.join(dir, 'repo', '.git')) };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

// One `promptfoo export` per eval, the same interface report.js reads; an eval still running has no export yet.
function gradesOf(evalId) {
  const exportPath = path.join(os.tmpdir(), `csharp-skills-transcripts-${process.pid}.json`);
  try {
    execFileSync('npm', ['run', '--silent', 'promptfoo', '--', 'export', 'eval', evalId, '-o', exportPath],
      { cwd: __dirname, stdio: 'pipe' });
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    return exported.results.results.map((r) => [gradeKey(evalId, r.testIdx, r.provider.label ?? r.provider.id), {
      success: r.success,
      errored: r.failureReason === ERRORED,
      score: r.score,
      failures: (r.gradingResult?.componentResults ?? []).filter((c) => !c.pass)
        .map((c) => ({ check: c.assertion?.metric ?? c.assertion?.type ?? 'check', reason: c.reason })),
      error: r.failureReason === ERRORED ? r.error : undefined,
    }]);
  } catch (error) {
    console.error(`No grades for ${evalId}: ${error.message.split('\n')[0]}`);
    return [];
  } finally {
    fs.rmSync(exportPath, { force: true });
  }
}

// shortcut: a `--repeat` eval gives several runs one key, so they all show the last grade; add repeatIndex then.
function gradeKey(evalId, testIdx, provider) {
  return `${evalId}|${testIdx}|${provider}`;
}

function grade(run, graded) {
  const result = run.events.find((e) => e.type === 'result');
  const status = !result || result.is_error || graded?.errored ? 'errored'
    : graded === undefined ? 'ungraded'
      : graded.success ? 'passed' : 'failed';
  return { status, score: graded?.score, failures: graded?.failures ?? [], gradeError: graded?.error };
}

// What the provider staged after the agent finished, i.e. the diff promptfoo graded; empty while a run is in progress.
function stagedDiff(repo) {
  try {
    return execFileSync('git', ['-C', repo, 'diff', '--cached', 'HEAD'], { encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

// Every file on disk except build output: the graded repo plus the hidden acceptance tests copied in after grading.
function sourceFiles(repo) {
  const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'core.quotePath=false', ...args],
    { encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  const changed = new Map(git('diff', '--cached', '--name-status', '--no-renames', 'HEAD')
    .map((line) => line.split('\t')).map(([status, file]) => [file, status === 'A' ? 'added' : 'changed']));
  // Untracked, or different from what was staged: acceptanceTests() in the provider copied it in.
  const acceptance = new Set([...git('ls-files', '--others', '--exclude-standard'), ...git('diff', '--name-only')]);
  return [...new Set([...git('ls-files'), ...acceptance])].sort()
    .filter((file) => fs.statSync(path.join(repo, file), { throwIfNoEntry: false })?.isFile())
    .map((file) => {
      const content = fs.readFileSync(path.join(repo, file));
      return { path: file, mark: acceptance.has(file) ? 'acceptance' : changed.get(file), text: content.includes(0) ? null : content.toString('utf8') };
    });
}

function parseJsonLine(line) {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
}

function html(runs) {
  // `<` escaped so a transcript containing `</script>` cannot end the data block.
  const data = JSON.stringify(runs).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eval transcripts</title>
<style>
:root { --bg: #fafaf9; --fg: #1c1917; --muted: #78716c; --line: #e7e5e4; --card: #fff;
  --failed: #fdecec; --errored: #fff4e0; --passed: #ecf7ee; --code: #f5f5f4; --accent: #2563eb; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #1c1917; --fg: #e7e5e4; --muted: #a8a29e; --line: #44403c; --card: #292524;
    --failed: #3b2224; --errored: #3a2e1c; --passed: #1f3324; --code: #1f1d1b; --accent: #60a5fa; color-scheme: dark; }
}
body { margin: 0; padding: 1.5rem 1rem; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; }
a { color: var(--accent); text-decoration: none; }
h1 { font-size: 1.3rem; margin: 0 0 1rem; } h2 { font-size: 1rem; margin: 1.5rem 0 .5rem; }
.muted { color: var(--muted); }
.table { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background: var(--card); }
th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; color: var(--muted); font-size: .85em; }
tr.failed { background: var(--failed); } tr.errored { background: var(--errored); }
.badge { display: inline-block; padding: 0 .45rem; border-radius: 9px; font-size: .8em; background: var(--code); }
.badge.failed { background: var(--failed); } .badge.errored { background: var(--errored); } .badge.passed { background: var(--passed); }
pre { margin: .4rem 0; padding: .6rem; background: var(--code); border-radius: 6px; white-space: pre-wrap; word-break: break-word;
  font: 12.5px/1.45 ui-monospace, monospace; max-height: 32rem; overflow: auto; }
.step { margin: .5rem 0; padding: .5rem .75rem; background: var(--card); border: 1px solid var(--line); border-radius: 6px; }
.step.text { border-left: 3px solid var(--accent); white-space: pre-wrap; }
.step.note { background: none; border: none; padding: .1rem .75rem; color: var(--muted); font-size: .9em; }
.step.user { border-left: 3px solid var(--muted); white-space: pre-wrap; }
.step.tool-error > summary { color: #b91c1c; }
.step.failure { background: var(--failed); white-space: pre-wrap; }
.diff span { display: block; } .diff .add { background: var(--passed); } .diff .del { background: var(--failed); }
.diff .hunk { color: var(--muted); }
.browse { font-weight: normal; font-size: .9em; margin-left: .5rem; }
details > summary { cursor: pointer; }
.children { margin: .5rem 0 .5rem 1rem; padding-left: .75rem; border-left: 2px dashed var(--line); }
.label { font-size: .8em; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: .2rem 1rem; margin: 0 0 1rem; }
dt { color: var(--muted); } dd { margin: 0; word-break: break-all; }
</style>
</head>
<body>
<main id="app"></main>
<script type="application/json" id="data">${data}</script>
<script>
const RUNS = JSON.parse(document.getElementById('data').textContent);
const NO_EVAL = 'no-run-json';
const MAX_CHARS = 20000;
const app = document.getElementById('app');

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs ?? {}).forEach(([key, value]) => value !== undefined && node.setAttribute(key, value));
  node.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

const when = (ms) => new Date(ms).toLocaleString();
const minutes = (ms) => (ms ? (ms / 60000).toFixed(1) + ' min' : '');
const dollars = (usd) => (usd ? '$' + usd.toFixed(2) : '');
const evalOf = (run) => run.evalId ?? NO_EVAL;
const resultOf = (run) => run.events.find((e) => e.type === 'result') ?? {};
const badge = (status) => el('span', { class: 'badge ' + status }, status);
const clip = (text) => (text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '\\n… (' + (text.length - MAX_CHARS) + ' more chars)' : text);
const textOf = (content) => (typeof content === 'string' ? content
  : (content ?? []).map((c) => (c.type === 'text' ? c.text : '[' + c.type + ']')).join('\\n'));

function table(headers, rows) {
  return el('div', { class: 'table' }, el('table', {}, el('tr', {}, headers.map((h) => el('th', {}, h))), rows));
}

function evalsPage() {
  const ids = [...new Set(RUNS.map(evalOf))];
  const rows = ids.map((id) => {
    const runs = RUNS.filter((r) => evalOf(r) === id);
    const count = (status) => runs.filter((r) => r.status === status).length;
    const worst = count('failed') ? 'failed' : count('errored') ? 'errored' : '';
    return el('tr', { class: worst },
      el('td', {}, el('a', { href: '#/eval/' + encodeURIComponent(id) }, id === NO_EVAL ? 'Runs without run.json' : id)),
      el('td', {}, when(runs[0].startedAt)),
      el('td', {}, String(runs.length)),
      el('td', {}, String(count('passed'))), el('td', {}, String(count('failed'))),
      el('td', {}, String(count('errored'))), el('td', {}, String(count('ungraded'))));
  });
  return [el('h1', {}, 'Evals'),
    RUNS.length ? table(['Eval', 'Latest run', 'Runs', 'Passed', 'Failed', 'Errored', 'Ungraded'], rows)
      : el('p', { class: 'muted' }, 'No transcripts found.')];
}

function evalPage(id) {
  const runs = RUNS.filter((r) => evalOf(r) === id);
  const section = (title, statuses) => {
    const matching = runs.filter((r) => statuses.includes(r.status));
    return matching.length ? [el('h2', {}, title + ' (' + matching.length + ')'), table(
      ['Started', 'Task', 'Provider', 'Status', 'Failed checks', 'Turns', 'Time', 'Cost'],
      matching.map((run) => {
        const result = resultOf(run);
        return el('tr', { class: run.status },
          el('td', {}, el('a', { href: '#/run/' + run.name }, when(run.startedAt))),
          el('td', {}, run.description ?? el('span', { class: 'muted' }, run.name)),
          el('td', {}, run.provider ?? ''),
          el('td', {}, badge(run.status)),
          el('td', {}, run.failures.map((f) => f.check).join(', ')),
          el('td', {}, String(result.num_turns ?? '')),
          el('td', {}, minutes(result.duration_ms)),
          el('td', {}, dollars(result.total_cost_usd)));
      }))] : [];
  };
  return [el('p', {}, el('a', { href: '#/' }, '← Evals')),
    el('h1', {}, id === NO_EVAL ? 'Runs without run.json' : id),
    section('Failed', ['failed', 'errored']), section('Passed', ['passed']), section('Ungraded', ['ungraded'])];
}

function runPage(name) {
  const run = RUNS.find((r) => r.name === name);
  if (!run) {
    return el('p', {}, 'No run ' + name + '. ', el('a', { href: '#/' }, 'Back'));
  }
  const result = resultOf(run);
  const results = new Map(run.events.filter((e) => e.type === 'user').flatMap((e) => e.message?.content ?? [])
    .filter((c) => c.type === 'tool_result').map((c) => [c.tool_use_id, c]));
  const field = (label, value) => (value === undefined || value === '' ? [] : [el('dt', {}, label), el('dd', {}, value)]);
  return [
    el('p', {}, el('a', { href: '#/eval/' + encodeURIComponent(evalOf(run)) }, '← ' + evalOf(run))),
    el('h1', {}, run.description ?? run.name, ' ', badge(run.status)),
    el('dl', {},
      field('Provider', run.provider), field('Fixture', run.fixture), field('Started', when(run.startedAt)),
      field('Score', run.score === undefined ? undefined : run.score.toFixed(2)),
      field('Failed checks', run.failures.map((f) => f.check).join(', ')), field('Error', run.gradeError),
      field('Turns', String(result.num_turns ?? '')), field('Time', minutes(result.duration_ms)),
      field('Cost', dollars(result.total_cost_usd)), field('Run dir', run.dir)),
    run.task ? [el('div', { class: 'label' }, 'Task'), el('pre', {}, run.task)] : [],
    run.failures.length ? [el('div', { class: 'label' }, 'Why it failed'),
      run.failures.map((f) => el('div', { class: 'step failure' }, el('strong', {}, f.check), el('div', {}, f.reason ?? '')))] : [],
    changes(run),
    el('h2', {}, 'Timeline'),
    steps(run.events, null, results),
  ];
}

// Subagent events carry the id of the tool call that started them, so they nest under it.
function steps(events, parent, results) {
  return events.filter((e) => (e.parent_tool_use_id ?? null) === parent).flatMap((event) => {
    if (event.type === 'assistant') {
      return (event.message?.content ?? []).map((block) => {
        if (block.type === 'text') {
          return el('div', { class: 'step text' }, block.text);
        }
        if (block.type === 'thinking') {
          return el('details', { class: 'step' }, el('summary', { class: 'muted' }, 'Thinking'), el('pre', {}, block.thinking));
        }
        if (block.type === 'tool_use') {
          return toolCall(block, events, results);
        }
        return null;
      });
    }
    if (event.type === 'user') {
      const content = event.message?.content;
      const text = typeof content === 'string' ? content : textOf((content ?? []).filter((c) => c.type === 'text'));
      return text ? el('div', { class: 'step user' }, el('div', { class: 'label' }, 'User'), text) : null;
    }
    if (event.type === 'system' && event.subtype === 'init') {
      return el('div', { class: 'step note' }, 'Session start · ' + event.model + ' · ' + event.cwd);
    }
    if (event.type === 'system' && event.subtype?.startsWith('task_')) {
      return el('div', { class: 'step note' }, event.subtype.replace('_', ' ') + ': ' + (event.description ?? event.summary ?? event.status ?? ''));
    }
    if (event.type === 'result') {
      return el('div', { class: 'step text' }, el('div', { class: 'label' }, 'Result' + (event.is_error ? ' (error)' : '')), event.result ?? '');
    }
    return null;
  }).filter(Boolean);
}

function changes(run) {
  const browse = run.hasCode ? [' ', el('a', { href: run.name + '/code.html', class: 'browse' }, 'Browse final code →')] : [];
  const files = run.diff.split(/^(?=diff --git )/m).filter((file) => file.startsWith('diff --git '));
  if (!files.length) {
    return [el('h2', {}, 'Code', browse), el('p', { class: 'muted' }, 'No changes.')];
  }
  return [el('h2', {}, 'Code (' + files.length + ' files changed)', browse), files.map((file) => {
    const lines = file.replace(/\\n$/, '').split('\\n');
    const count = (sign) => lines.filter((line) => line[0] === sign && !line.startsWith(sign.repeat(3))).length;
    return el('details', { class: 'step' },
      el('summary', {}, el('strong', {}, lines[0].replace(/^diff --git a\\/(.*) b\\/.*$/, '$1')), ' ',
        el('span', { class: 'muted' }, '+' + count('+') + ' −' + count('-'))),
      el('pre', { class: 'diff' }, lines.map((line) => el('span', {
        class: line.startsWith('@@') ? 'hunk' : line[0] === '+' && !line.startsWith('+++') ? 'add'
          : line[0] === '-' && !line.startsWith('---') ? 'del' : undefined,
      }, line || ' '))));
  })];
}

function toolCall(block, events, results) {
  const result = results.get(block.id);
  const input = block.input ?? {};
  const hint = input.description ?? input.command ?? input.file_path ?? input.skill ?? input.pattern ?? input.prompt ?? '';
  const children = steps(events, block.id, results);
  return el('details', { class: 'step' + (result?.is_error ? ' tool-error' : '') },
    el('summary', {}, el('strong', {}, block.name), ' ', el('span', { class: 'muted' }, String(hint).split('\\n')[0].slice(0, 140))),
    el('div', { class: 'label' }, 'Input'), el('pre', {}, clip(JSON.stringify(input, null, 2))),
    children.length ? el('div', { class: 'children' }, children) : null,
    result ? [el('div', { class: 'label' }, 'Result' + (result.is_error ? ' (error)' : '')), el('pre', {}, clip(textOf(result.content)))]
      : el('div', { class: 'muted' }, 'No result'));
}

function render() {
  const [, kind, id] = location.hash.split('/');
  const page = kind === 'eval' ? evalPage(decodeURIComponent(id)) : kind === 'run' ? runPage(id) : evalsPage();
  app.replaceChildren(...[page].flat(Infinity).filter(Boolean));
  window.scrollTo(0, 0);
}

addEventListener('hashchange', render);
render();
</script>
</body>
</html>
`;
}

function codeHtml(run, files) {
  const data = JSON.stringify(files).replace(/</g, '\\u003c');
  const hljs = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Code · ${run.name}</title>
<link rel="stylesheet" href="${hljs}/styles/github.min.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="${hljs}/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
<script src="${hljs}/highlight.min.js"></script>
<style>
:root { --bg: #fafaf9; --fg: #1c1917; --muted: #78716c; --line: #e7e5e4; --card: #fff; --code: #fff; --accent: #2563eb;
  --added: #ecf7ee; --changed: #eef3fd; --acceptance: #fff4e0; --active: #e7e5e4; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #1c1917; --fg: #e7e5e4; --muted: #a8a29e; --line: #44403c; --card: #292524; --code: #0d1117; --accent: #60a5fa;
    --added: #1f3324; --changed: #1e2a3d; --acceptance: #3a2e1c; --active: #44403c; color-scheme: dark; }
}
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
a { color: var(--accent); text-decoration: none; }
.layout { display: grid; grid-template-columns: minmax(220px, 300px) 1fr; min-height: 100vh; }
nav { border-right: 1px solid var(--line); background: var(--card); padding: 1rem .75rem; position: sticky; top: 0;
  height: 100vh; overflow: auto; box-sizing: border-box; font-size: 13px; }
nav ul { list-style: none; margin: 0; padding-left: .9rem; }
nav > ul { padding-left: 0; }
nav summary { cursor: pointer; color: var(--muted); }
nav li a { display: block; padding: 0 .35rem; border-radius: 4px; color: var(--fg); white-space: nowrap; }
nav li a.active { background: var(--active); font-weight: 600; }
nav li a.added { background: var(--added); } nav li a.changed { background: var(--changed); } nav li a.acceptance { background: var(--acceptance); }
.mark { font-size: .75em; color: var(--muted); margin-left: .3rem; }
.legend { font-size: .8em; color: var(--muted); margin: .5rem 0 .75rem; }
.legend span { padding: 0 .3rem; border-radius: 4px; }
section { padding: 1rem; min-width: 0; }
h1 { font-size: 1rem; margin: 0 0 .75rem; word-break: break-all; }
.file { display: grid; grid-template-columns: auto 1fr; overflow-x: auto; background: var(--code); border: 1px solid var(--line); border-radius: 6px; }
.file pre { margin: 0; padding: .6rem; font: 12.5px/1.5 ui-monospace, monospace; white-space: pre; }
.file pre.gutter { color: var(--muted); text-align: right; user-select: none; border-right: 1px solid var(--line); }
.file pre code.hljs { padding: 0; background: none; }
@media (max-width: 700px) { .layout { grid-template-columns: 1fr; } nav { position: static; height: auto; max-height: 40vh; } }
</style>
</head>
<body>
<div class="layout">
<nav>
  <a href="../index.html#/run/${run.name}">← Run</a>
  <div class="legend"><span style="background: var(--added)">added</span> <span style="background: var(--changed)">changed</span>
    <span style="background: var(--acceptance)">acceptance (hidden tests)</span></div>
  <div id="tree"></div>
</nav>
<section><h1 id="title"></h1><div id="view"></div></section>
</div>
<script type="application/json" id="data">${data}</script>
<script>
const FILES = JSON.parse(document.getElementById('data').textContent);
const LANGUAGES = { cs: 'csharp', csproj: 'xml', props: 'xml', targets: 'xml', slnx: 'xml', xml: 'xml', json: 'json', md: 'markdown',
  yml: 'yaml', yaml: 'yaml', editorconfig: 'ini', sh: 'bash', js: 'javascript', sql: 'sql' };
const links = new Map();

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs ?? {}).forEach(([key, value]) => value !== undefined && node.setAttribute(key, value));
  node.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined));
  return node;
}

function folder(files, depth) {
  const dirs = [...new Set(files.filter((f) => f.parts.length > depth + 1).map((f) => f.parts[depth]))];
  const here = files.filter((f) => f.parts.length === depth + 1);
  return el('ul', {},
    dirs.map((dir) => el('li', {}, el('details', { open: '' }, el('summary', {}, dir + '/'),
      folder(files.filter((f) => f.parts.length > depth + 1 && f.parts[depth] === dir), depth + 1)))),
    here.map((f) => {
      const link = el('a', { href: '#' + encodeURIComponent(f.path), class: f.mark, title: f.path }, f.parts[depth],
        f.mark ? el('span', { class: 'mark' }, f.mark === 'acceptance' ? 'acc' : f.mark[0].toUpperCase()) : null);
      links.set(f.path, link);
      return el('li', {}, link);
    }));
}

function show() {
  const file = FILES.find((f) => f.path === decodeURIComponent(location.hash.slice(1)))
    ?? FILES.find((f) => f.mark === 'added' || f.mark === 'changed') ?? FILES[0];
  if (!file) {
    document.getElementById('view').textContent = 'No files.';
    return;
  }
  links.forEach((link, key) => link.classList.toggle('active', key === file.path));
  document.getElementById('title').textContent = file.path + (file.mark ? ' (' + file.mark + ')' : '');
  if (file.text === null) {
    document.getElementById('view').replaceChildren(el('p', {}, 'Binary file.'));
    return;
  }
  const name = file.path.split('/').pop();
  const language = LANGUAGES[name.slice(name.lastIndexOf('.') + 1)];
  const code = el('code', {});
  // Plain text when highlight.js could not load (offline) or does not know the language.
  if (window.hljs && language && hljs.getLanguage(language)) {
    code.innerHTML = hljs.highlight(file.text, { language, ignoreIllegals: true }).value;
    code.className = 'hljs';
  } else {
    code.textContent = file.text;
  }
  const lines = file.text.replace(/\\n$/, '').split('\\n').length;
  document.getElementById('view').replaceChildren(el('div', { class: 'file' },
    el('pre', { class: 'gutter' }, Array.from({ length: lines }, (_, i) => i + 1).join('\\n')), el('pre', {}, code)));
  window.scrollTo(0, 0);
}

document.getElementById('tree').append(folder(FILES.map((f) => ({ ...f, parts: f.path.split('/') })), 0));
addEventListener('hashchange', show);
show();
</script>
</body>
</html>
`;
}

module.exports = { grade, gradeKey };
