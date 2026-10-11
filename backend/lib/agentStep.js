// One step of Pragna's document agent: validate the browser's request and run a single model
// turn with tools. The loop and the document live in the browser; this is stateless.

const ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const MAX_MESSAGES = 120;
const MAX_TOOLS = 30;
const MAX_BYTES = 1_000_000;

function validateAgentStep(body = {}) {
  const { messages, tools, model } = body;
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    return { ok: false, error: `messages must be an array of 1-${MAX_MESSAGES} items` };
  }
  if (!messages.every((m) => m && ROLES.has(m.role))) return { ok: false, error: 'invalid message role' };
  if (!Array.isArray(tools) || !tools.length || tools.length > MAX_TOOLS) {
    return { ok: false, error: `tools must be an array of 1-${MAX_TOOLS} items` };
  }
  if (!tools.every((t) => t?.type === 'function' && typeof t.function?.name === 'string')) {
    return { ok: false, error: 'invalid tool schema' };
  }
  if (JSON.stringify({ messages, tools }).length > MAX_BYTES) return { ok: false, error: 'request too large' };
  return { ok: true, messages, tools, model: typeof model === 'string' ? model : undefined };
}

async function runAgentStep({ messages, tools, model }, chatCompletion) {
  const res = await chatCompletion({ messages, tools, model, temperature: 0.2, max_tokens: 2000 });
  return { content: res.content || '', tool_calls: res.tool_calls || [], model: res.model };
}

module.exports = { validateAgentStep, runAgentStep };
