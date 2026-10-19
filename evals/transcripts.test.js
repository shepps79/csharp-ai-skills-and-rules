// The status decides which section a run lands in on the transcripts page.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { grade } = require('./transcripts.js');

const finished = (isError) => ({ events: [{ type: 'result', is_error: isError }] });

test('grade marks a run errored when the agent never ran, whatever promptfoo says', () => {
  assert.equal(grade(finished(true), { success: false, errored: false }).status, 'errored');
});

test('grade marks a run errored when it has no result event', () => {
  assert.equal(grade({ events: [] }, undefined).status, 'errored');
});

test('grade marks a run ungraded when promptfoo has no grade for it', () => {
  assert.equal(grade(finished(false), undefined).status, 'ungraded');
});

test('grade follows promptfoo success for a finished run', () => {
  assert.equal(grade(finished(false), { success: true, failedChecks: [] }).status, 'passed');
  assert.deepEqual(grade(finished(false), { success: false, failedChecks: ['build'] }),
    { status: 'failed', score: undefined, failedChecks: ['build'], gradeError: undefined });
});
