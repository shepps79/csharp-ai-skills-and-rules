// Runs the working-tree rules with pi on a model served by LM Studio, through its OpenAI-compatible API
// (providers/lmstudio-pi.js). The judge runs through pi too, still on the Claude judge model, so scores compare
// with the Claude runs.
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
  defaultTest: {
    ...base.defaultTest,
    options: { ...base.defaultTest.options, provider: { id: base.defaultTest.options.provider, config: { harness: 'pi' } } },
  },
  providers: [{
    id: 'file://providers/pi.js',
    label: `lmstudio:${model}:rules@WORKTREE`,
    config: {
      harness: 'pi',
      variant: 'rules',
      rulesRef: 'WORKTREE',
      skills,
      model: `lmstudio/${model}`,
      extensions: [path.join(__dirname, 'providers/lmstudio-pi.js')],
      env: { LMSTUDIO_URL: baseUrl, LMSTUDIO_MODEL: model },
    },
  }],
  // One local model serves one session at a time well; two would halve its speed and risk the agent timeout.
  evaluateOptions: { ...base.evaluateOptions, maxConcurrency: 1 },
};
