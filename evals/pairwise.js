// Pairwise judging: for each task the judge picks the better of the committed (HEAD) and working-tree rules,
// using the task's rubric as the criteria. Judges favour a position, so run it twice, the second time with
// PAIRWISE_SWAP=1, and count a rule version as better only when it wins in both orders.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const base = yaml.load(fs.readFileSync(path.join(__dirname, 'promptfooconfig.yaml'), 'utf8'));
const { skills } = base.providers.find((provider) => provider.config.variant === 'rules').config;
const variants = ['HEAD', 'WORKTREE'].map((rulesRef) =>
  ({ id: 'file://providers/claude-code.js', label: `rules@${rulesRef}`, config: { variant: 'rules', rulesRef, skills } }));
const swapped = Boolean(process.env.PAIRWISE_SWAP);

module.exports = {
  ...base,
  description: `pairwise, ${swapped ? 'WORKTREE' : 'HEAD'} first`,
  providers: swapped ? variants.reverse() : variants,
  tests: base.tests.map((test) => ({
    ...test,
    assert: test.assert.map((assertion) => (assertion.type === 'llm-rubric'
      ? { type: 'select-best', value: assertion.value, metric: 'pairwise' }
      : assertion)),
  })),
};
