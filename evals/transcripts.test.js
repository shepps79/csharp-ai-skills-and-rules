// The status decides which section a run lands in on the transcripts page.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { grade, fromPiEvents } = require('./transcripts.js');

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
  assert.equal(grade(finished(false), { success: true, failures: [] }).status, 'passed');
  const failures = [{ check: 'build', reason: 'Build failed' }];
  assert.deepEqual(grade(finished(false), { success: false, failures }),
    { status: 'failed', score: undefined, failures, gradeError: undefined });
});

test('fromPiEvents turns an omp or pi run into the Claude Code events that the page reads', () => {
  const reply = (content, stopReason, timestamp) => ({ type: 'message_end',
    message: { role: 'assistant', model: 'm', content, stopReason, timestamp, usage: { cost: { total: 0.25 } } } });
  const events = [
    { type: 'session', timestamp: '2026-10-21T07:00:00.000Z', cwd: '/run' },
    { type: 'message_end', message: { role: 'user', content: [{ type: 'text', text: 'task' }] } },
    reply([{ type: 'toolCall', id: 't1', name: 'bash', arguments: { command: 'ls' } }], 'toolUse', Date.parse('2026-10-21T07:00:01.000Z')),
    { type: 'message_end', message: { role: 'toolResult', toolCallId: 't1', content: [{ type: 'text', text: 'a' }], isError: false } },
    reply([{ type: 'text', text: 'done' }], 'stop', Date.parse('2026-10-21T07:01:00.000Z')),
    { type: 'agent_end' },
  ];

  const converted = fromPiEvents(events);

  assert.deepEqual(converted, [
    { type: 'system', subtype: 'init', model: 'm', cwd: '/run' },
    { type: 'user', message: { content: [{ type: 'text', text: 'task' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'a' }], is_error: false }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } },
    { type: 'result', is_error: false, result: 'done', num_turns: 2, duration_ms: 60000, total_cost_usd: 0.5 },
  ]);
});
