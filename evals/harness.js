// Runs the working-tree rules with omp or pi (EVAL_HARNESS) in place of Claude Code. The judge stays on Claude,
// so scores compare with the Claude Code runs.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const harness = process.env.EVAL_HARNESS;
const base = yaml.load(fs.readFileSync(path.join(__dirname, 'promptfooconfig.yaml'), 'utf8'));
const { skills } = base.providers.find((provider) => provider.config.variant === 'rules').config;

module.exports = {
  ...base,
  description: harness,
  providers: [{
    id: 'file://providers/pi.js',
    label: `${harness}:rules@WORKTREE`,
    config: { harness, variant: 'rules', rulesRef: 'WORKTREE', skills },
  }],
};
