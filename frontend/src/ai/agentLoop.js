import { TOOL_SCHEMAS, executeTool, EDITING_TOOLS } from '@/ai/tools';
import { BlockRefs } from '@/ai/blockRefs';
import { RunRecorder } from '@/ai/runRecorder';
import { getOutline, getSelection } from '@/ai/tools/readTools';
import { listSuggestionIds } from '@/ai/suggestions';

const SYSTEM_PROMPT = `You are Pragna, an editing assistant working inside the user's open document in EtherxWord.
You change the document only by calling tools; the user reviews your text edits as suggestions.
Rules:
- Read before you edit: use get_outline, find_text or read_blocks to get block ids and exact text.
- Prefer replace_text for small changes; use rewrite_block only when most of a block changes.
- Change only what the user asked for. Keep their language, tone and formatting.
- If the request is ambiguous, ask one short question instead of editing.
- When you are done, reply without tool calls: one short paragraph saying what you changed.`;

const LABELS = {
  get_outline: () => 'Reading outline…',
  read_blocks: (a) => `Reading ${a.ids ? a.ids.length : 'a range of'} block(s)…`,
  find_text: (a) => `Searching for “${String(a.query || '').slice(0, 30)}”…`,
  get_selection: () => 'Reading your selection…',
  read_table: (a) => `Reading table ${a.table_id}…`,
  add_comment: (a) => `Commenting on ${a.block_id}…`,
};
const labelFor = (name, args) => (LABELS[name] ? LABELS[name](args || {}) : `Editing ${args?.block_id || args?.after_id || args?.cell_id || args?.table_id || (args?.ids || []).join(', ')}…`);

function contextMessage(editor, refs, prompt) {
  const ctx = { editor, refs };
  const outline = getOutline({}, ctx);
  const selection = getSelection({}, ctx);
  return `Request: ${prompt}

Document outline (page 1${outline.next_page ? `, more with get_outline page ${outline.next_page}` : ''}):
${JSON.stringify(outline.blocks)}

Selection: ${selection.selected ? JSON.stringify(selection) : 'none'}`;
}

export async function runAgent({ editor, prompt, history = [], agentStep, onStep = () => {}, signal, maxSteps = 15 }) {
  let refs = null;
  let recorder = null;
  let before = new Set();
  let steps = 0;
  const finish = (extra) => {
    refs?.detach();
    // The recorder keeps listening so a later whole-run undo maps through edits made after the run
    // (the hook stops it when the next run starts). A run that changed nothing has nothing to undo.
    if (recorder && !recorder.changed) recorder.stop();
    const suggestions = listSuggestionIds(editor.state.doc).filter((id) => !before.has(id)).length;
    return { summary: '', steps, suggestions, stopped: false, recorder, ...extra };
  };

  try {
    refs = new BlockRefs(editor);
    recorder = new RunRecorder(editor);
    before = new Set(listSuggestionIds(editor.state.doc));
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: contextMessage(editor, refs, prompt) },
    ];
    const ctx = { editor, refs };

    while (steps < maxSteps) {
      if (signal?.aborted) return finish({ stopped: true, summary: 'Stopped.' });
      steps += 1;
      onStep({ kind: 'thinking', label: steps === 1 ? 'Thinking…' : 'Continuing…' });
      let res;
      try {
        res = await agentStep({ messages, tools: TOOL_SCHEMAS }, { signal });
      } catch (err) {
        // Stop aborts the in-flight request: that is a stop, not a failure.
        if (signal?.aborted || err?.name === 'AbortError') return finish({ stopped: true, summary: 'Stopped.' });
        return finish({ error: err.message || 'Pragna could not reach the model' });
      }
      if (signal?.aborted) return finish({ stopped: true, summary: 'Stopped.' });
      if (!res?.success) return finish({ error: res?.message || 'Pragna did not return a response' });

      const calls = res.tool_calls || [];
      messages.push({ role: 'assistant', content: res.content || '', ...(calls.length ? { tool_calls: calls } : {}) });
      if (!calls.length) return finish({ summary: res.content || 'Done.' });

      for (const call of calls) {
        let args = {};
        try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
        onStep({ kind: 'tool', label: labelFor(call.function?.name, args), edits: EDITING_TOOLS.has(call.function?.name) });
        const result = executeTool(call.function?.name, call.function?.arguments, ctx);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return finish({ error: `Stopped at the step limit (${maxSteps}). Changes so far are kept for review.` });
  } catch (err) {
    // Setup, tool execution or an onStep callback threw: still detach listeners and keep any
    // changes already made undoable through the returned recorder.
    return finish({ error: err?.message || 'Pragna hit an unexpected error' });
  }
}
