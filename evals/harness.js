// Runs the working-tree rules with omp or pi (EVAL_HARNESS) in place of Claude Code. The judge runs through the same
// CLI and login, still on the Claude judge model, so scores compare with the Claude Code runs.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const harness = process.env.EVAL_HARNESS;
const base = yaml.load(fs.readFileSync(path.join(__dirname, 'promptfooconfig.yaml'), 'utf8'));
const { skills } = base.providers.find((provider) => provider.config.variant === 'rules').config;

module.exports = {
  ...base,
  description: harness,
  defaultTest: {
    ...base.defaultTest,
    options: { ...base.defaultTest.options, provider: { id: base.defaultTest.options.provider, config: { harness } } },
  },
  providers: [{
    id: 'file://providers/pi.js',
    label: `${harness}:rules@WORKTREE`,
    config: { harness, variant: 'rules', rulesRef: 'WORKTREE', skills },
  }],
};
