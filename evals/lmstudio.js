// Runs the working-tree rules with Claude Code on a model served by LM Studio, through its Anthropic-compatible
// API. The judge stays on Claude, so scores compare with the Claude runs.
// LMSTUDIO_MODEL is the model id from `lms ls` or the LM Studio UI; LMSTUDIO_URL defaults to the local server.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const model = process.env.LMSTUDIO_MODEL;
if (!model) {
  throw new Error('Set LMSTUDIO_MODEL to the id of a model loaded in LM Studio, e.g. LMSTUDIO_MODEL=qwen/qwen3-coder-30b');
}
const baseUrl = process.env.LMSTUDIO_URL ?? 'http://localhost:1234';

const base = yaml.load(fs.readFileSync(path.join(__dirname, 'promptfooconfig.yaml'), 'utf8'));
const { skills } = base.providers.find((provider) => provider.config.variant === 'rules').config;

module.exports = {
  ...base,
  description: `lmstudio ${model}`,
  providers: [{
    id: 'file://providers/claude-code.js',
    label: `lmstudio:${model}:rules@WORKTREE`,
    config: {
      variant: 'rules',
      rulesRef: 'WORKTREE',
      skills,
      model,
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        // LM Studio ignores the token, but Claude Code needs one to skip its own login.
        ANTHROPIC_AUTH_TOKEN: 'lmstudio',
        // Claude Code's background calls (titles, summaries) would otherwise ask for a Claude model.
        ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
        ANTHROPIC_DEFAULT_SONNET_MODEL: model,
        ANTHROPIC_DEFAULT_OPUS_MODEL: model,
        CLAUDE_CODE_SUBAGENT_MODEL: model,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      },
    },
  }],
  // One local model serves one session at a time well; two would halve its speed and risk the agent timeout.
  evaluateOptions: { ...base.evaluateOptions, maxConcurrency: 1 },
};
