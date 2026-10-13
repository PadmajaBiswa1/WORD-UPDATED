import { TOOL_SCHEMAS, executeTool, EDITING_TOOLS } from '@/ai/tools';
import { BlockRefs } from '@/ai/blockRefs';
import { RunRecorder } from '@/ai/runRecorder';
import { getOutline, getSelection } from '@/ai/tools/readTools';
import { listSuggestionIds } from '@/ai/suggestions';
import { useDocumentStore } from '@/store';
import { trackCursor } from '@/ai/tools/cursorTools';
import { describeChange } from '@/ai/memory';

const SYSTEM_PROMPT = `You are Pragna, an editing assistant working inside the user's open document in EtherxWord.
You change the document only by calling tools; the user reviews your text edits as suggestions.
Rules:
- Read before you edit: use get_outline, find_text or read_blocks to get block ids and exact text.
- Prefer replace_text for small changes; use rewrite_block only when most of a block changes.
- Inside tables, read_table returns paragraph ids for each cell: fix words with replace_text on those ids, not set_table_cell.
- Formatting (bold, colour, size, font family) uses format_text; block_id "all" formats the whole document.
- Comments: list_comments shows threads and where they are anchored. When asked to address comments, make the edit, reply_comment saying what you did, then resolve_comment.
- Tracked changes: list_changes shows the user's insertions and deletions; accept or reject them with resolve_change only when the user asks.
- To change a word or name everywhere, use replace_all once instead of many replace_text calls.
- Structure: set_list for lists, insert_page_break, insert_toc, add_footnote, set_link, insert_image, set_header_footer.
- Change only what the user asked for. Keep their language, tone and formatting.
- For a task with more than three steps (a whole-document pass, several sections), first call update_plan with the steps, then call it again as each step finishes.
- To write where the user is typing ("here", "at my cursor", "replace this"), use insert_at_cursor.
- If the request is ambiguous, ask one short question instead of editing.
- Block and table ids (b12, t1, t1.r0c0) are internal. Never show them to the user: in plan steps and replies, name the text by a short quote or its heading.
- When you are done, reply without tool calls: one short paragraph saying what you changed.`;

const LABELS = {
  get_outline: () => 'Reading outline…',
  read_blocks: (a) => `Reading ${a.ids ? a.ids.length : 'a range of'} block(s)…`,
  find_text: (a) => `Searching for “${String(a.query || '').slice(0, 30)}”…`,
  get_selection: () => 'Reading your selection…',
  read_table: () => 'Reading a table…',
  add_comment: () => 'Adding a comment…',
  list_comments: () => 'Reading comments…',
  insert_at_cursor: () => 'Writing at your cursor…',
  update_plan: () => 'Updating plan…',
  replace_all: (a) => `Replacing “${String(a.find || '').slice(0, 24)}” everywhere…`,
  set_list: (a) => (a.kind === 'none' ? 'Removing list…' : `Making a ${a.kind} list…`),
  insert_page_break: () => 'Inserting page break…',
  insert_toc: () => 'Building table of contents…',
  add_footnote: () => 'Adding footnote…',
  set_link: () => 'Adding link…',
  insert_image: () => 'Inserting image…',
  set_header_footer: () => 'Updating header and footer…',
  reply_comment: (a) => `Replying to comment ${a.comment_id}…`,
  resolve_comment: (a) => `Resolving comment ${a.comment_id}…`,
  list_changes: () => 'Reading tracked changes…',
  resolve_change: (a) => `${a.accept ? 'Accepting' : 'Rejecting'} ${a.change_id === 'all' ? 'all changes' : `change ${a.change_id}`}…`,
};
// Labels are shown to the user, so they never include internal block ids.
const labelFor = (name, args) => (LABELS[name] ? LABELS[name](args || {}) : 'Editing the document…');

// One line telling the model whether comments or tracked changes exist, so it
// knows to call list_comments / list_changes.
function reviewSummary(editor) {
  const open = useDocumentStore.getState().comments.filter((c) => !c.resolved).length;
  let tracked = 0;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'insertion' || m.type.name === 'deletion')) tracked += 1;
  });
  return `Open comments: ${open}. Tracked-change runs: ${tracked}.`;
}

function contextMessage(editor, refs, prompt) {
  const ctx = { editor, refs };
  const outline = getOutline({}, ctx);
  const selection = getSelection({}, ctx);
  return `Request: ${prompt}

Document outline (page 1${outline.next_page ? `, more with get_outline page ${outline.next_page}` : ''}):
${JSON.stringify(outline.blocks)}

Selection: ${selection.selected ? JSON.stringify(selection) : 'none'}
${reviewSummary(editor)}`;
}

export async function runAgent({ editor, prompt, history = [], agentStep, onStep = () => {}, signal, maxSteps = 40 }) {
  let refs = null;
  let stopCursor = null;
  const changes = [];
  let recorder = null;
  let before = new Set();
  let steps = 0;
  const finish = (extra) => {
    refs?.detach();
    stopCursor?.();
    // The recorder keeps listening so a later whole-run undo maps through edits made after the run
    // (the hook stops it when the next run starts). A run that changed nothing has nothing to undo.
    if (recorder && !recorder.changed) recorder.stop();
    const suggestions = listSuggestionIds(editor.state.doc).filter((id) => !before.has(id)).length;
    return { summary: '', steps, suggestions, stopped: false, recorder, changes, ...extra };
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
    stopCursor = trackCursor(ctx);

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
        if (call.function?.name === 'update_plan' && result?.ok) onStep({ kind: 'plan', plan: ctx.plan });
        const change = describeChange(call.function?.name, args, result);
        if (change) changes.push(change);
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
