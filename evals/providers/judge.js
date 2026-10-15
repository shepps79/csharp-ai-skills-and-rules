// LLM judge for llm-rubric assertions: local `claude -p` with no tools, no plugins, no hooks and no CLAUDE.md,
// so the yardstick stays fixed while the rules and your global setup change.
const { spawn } = require('node:child_process');
const os = require('node:os');

const DEFAULT_MODEL = 'claude-opus-5-5';

class JudgeProvider {
  constructor(options) {
    this.model = options.config?.model ?? DEFAULT_MODEL;
  }

  id() {
    return `claude-judge:${this.model}`;
  }

  callApi(prompt) {
    const args = ['-p', '--model', this.model, '--tools', '', '--setting-sources', '', '--strict-mcp-config',
      '--no-session-persistence', '--output-format', 'json'];
    const env = { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };

    return new Promise((resolve) => {
      const child = spawn('claude', args, { cwd: os.tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('close', (code) => {
        try {
          const result = JSON.parse(stdout);
          resolve(result.is_error
            ? { error: `judge failed: ${result.result}` }
            : { output: result.result, cost: result.total_cost_usd });
        } catch {
          resolve({ error: `judge exited ${code}: ${stderr.slice(-2000) || stdout.slice(-2000)}` });
        }
      });
      // Prompt via stdin: rubric + diff can exceed argv limits.
      child.stdin.end(prompt);
    });
  }
}

module.exports = JudgeProvider;
