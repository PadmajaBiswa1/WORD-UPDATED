const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');
const { validateAgentStep, runAgentStep } = require('../lib/agentStep');

const tool = { type: 'function', function: { name: 'read_blocks', description: 'x', parameters: { type: 'object', properties: {} } } };

test('validateAgentStep accepts a normal request', () => {
  const r = validateAgentStep({ messages: [{ role: 'user', content: 'hi' }], tools: [tool] });
  assert.equal(r.ok, true);
});

test('validateAgentStep rejects bad roles, too many messages and missing tools', () => {
  assert.equal(validateAgentStep({ messages: [{ role: 'admin', content: 'x' }], tools: [tool] }).ok, false);
  assert.equal(validateAgentStep({ messages: Array(121).fill({ role: 'user', content: 'x' }), tools: [tool] }).ok, false);
  assert.equal(validateAgentStep({ messages: [{ role: 'user', content: 'x' }], tools: [] }).ok, false);
  assert.equal(validateAgentStep({ messages: [{ role: 'user', content: 'x'.repeat(1_100_000) }], tools: [tool] }).ok, false);
});

test('runAgentStep passes tools through and returns tool calls', async () => {
  let seen = null;
  const fake = async (args) => {
    seen = args;
    return { content: '', model: 'gpt-oss:20b', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_blocks', arguments: '{}' } }] };
  };
  const out = await runAgentStep({ messages: [{ role: 'user', content: 'x' }], tools: [tool] }, fake);
  assert.deepEqual(seen.tools, [tool]);
  assert.equal(out.tool_calls[0].function.name, 'read_blocks');
  assert.equal(out.content, '');
});

test('chatCompletion with tools skips Gemini and returns tool_calls', async (t) => {
  process.env.GEMINI_API_KEY = 'test-gemini';
  const calls = [];
  const original = axios.post;
  axios.post = async (url, body) => {
    calls.push(url);
    return { data: { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_blocks', arguments: { ids: ['b1'] } } }] } }] } };
  };
  t.after(() => { axios.post = original; delete process.env.GEMINI_API_KEY; });
  const ollamaService = require('../utils/ollamaService');
  if (!ollamaService.keys.length) ollamaService.keys.push('test-key');
  const res = await ollamaService.chatCompletion({ messages: [{ role: 'user', content: 'x' }], tools: [tool] });
  assert.ok(calls.every((u) => !u.includes('generativelanguage')));
  assert.equal(res.tool_calls[0].function.arguments, '{"ids":["b1"]}');
});
