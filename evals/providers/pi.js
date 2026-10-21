// Runs omp or pi (`config.harness`) headless in place of Claude Code; the run dir, build, tests and grading are the
// Claude Code provider's. Both CLIs print the same JSON events. Only the "env" and "rules" variants: neither CLI
// has a switch that turns off all of your global setup, which "none" needs.
// omp reads always-apply rules from .omp/rules, not .claude/rules. pi reads no rules, so they go in the system
// prompt, as pi-rules does with always-apply rules.
const fs = require('node:fs');
const path = require('node:path');
const ClaudeCodeProvider = require('./claude-code.js');

const { spawnAgent, commandVersion, sha } = ClaudeCodeProvider;
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5-5';

class PiProvider extends ClaudeCodeProvider {
  constructor(options) {
    super({ ...options, config: { model: DEFAULT_MODEL, ...options.config } });
    if (!['omp', 'pi'].includes(this.config.harness) || this.config.variant === 'none') {
      throw new Error('pi.js needs config.harness omp or pi, and variant env or rules');
    }
  }

  get harness() {
    return this.config.harness;
  }

  placeRules(runDir) {
    if (this.harness === 'omp') {
      fs.mkdirSync(path.join(runDir, '.omp'));
      fs.renameSync(path.join(runDir, '.claude', 'rules'), path.join(runDir, '.omp', 'rules'));
    }
  }

  async runAgent(prompt, runDir) {
    const { model, effort, env } = this.config;
    const args = ['-p', '--mode', 'json', '--model', model, '--thinking', effort, ...this.harnessArgs(runDir)];
    if (process.env.EVAL_KEEP_SESSIONS !== '1') {
      args.push('--no-session');
    }
    const startedAt = Date.now();
    const events = await spawnAgent(this.harness, [...args, '--', prompt], runDir, { ...process.env, ...env }, 'agent_end');
    const replies = events.filter((e) => e.type === 'message_end' && e.message?.role === 'assistant').map((e) => e.message);
    const last = replies.at(-1);
    const total = (field) => replies.reduce((sum, reply) => sum + (reply.usage?.[field] ?? 0), 0);
    const prompted = total('input') + total('cacheRead') + total('cacheWrite');
    const toolNames = events.filter((e) => e.type === 'tool_execution_start').map((e) => e.toolName);
    return {
      error: ['error', 'aborted'].includes(last?.stopReason) ? last.errorMessage ?? last.stopReason : undefined,
      cost: replies.reduce((sum, reply) => sum + (reply.usage?.cost?.total ?? 0), 0),
      tokenUsage: { prompt: prompted, completion: total('output'), total: prompted + total('output') },
      agent: {
        turns: replies.length,
        durationMs: Date.now() - startedAt,
        isError: last?.stopReason === 'error',
        finalMessage: (last?.content ?? []).filter((block) => block.type === 'text').map((block) => block.text).join('\n'),
        toolCounts: toolNames.reduce((counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }), {}),
      },
      fingerprint: this.fingerprint(),
    };
  }

  harnessArgs(runDir) {
    if (this.harness === 'omp') {
      return ['--auto-approve', '--no-title'];
    }
    const rulesDir = path.join(runDir, '.claude', 'rules');
    const rules = fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir).filter((file) => file.endsWith('.md')).sort() : [];
    return rules.flatMap((file) => ['--append-system-prompt', alwaysApplyBody(path.join(rulesDir, file))]);
  }

  // Your global omp or pi setup is not hashed, unlike Claude Code's; keep it unchanged between runs you compare.
  fingerprint() {
    const { model, effort } = this.config;
    const parts = { [this.harness]: commandVersion(this.harness), model, effort, dotnet: commandVersion('dotnet') };
    return { hash: sha(JSON.stringify(parts)).slice(0, 12), ...parts };
  }
}

function alwaysApplyBody(file) {
  const [, frontmatter = '', body] = fs.readFileSync(file, 'utf8').match(/^(?:---\n([\s\S]*?)\n---\n)?([\s\S]*)$/);
  if (!/^alwaysApply:\s*true\s*$/m.test(frontmatter)) {
    // shortcut: a `paths:` rule would load on every file; load it with pi-rules once a rule uses `paths:`.
    throw new Error(`${file} is not alwaysApply: true, and pi.js puts every rule in the system prompt`);
  }
  return body.trim();
}

module.exports = PiProvider;
