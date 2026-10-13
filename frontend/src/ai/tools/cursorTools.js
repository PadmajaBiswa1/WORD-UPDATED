// The user's cursor at the start of a run, and the run's visible plan.
import { blockText, newSuggestionId } from '@/ai/suggestions';
import { safe } from '@/ai/tools/readTools';
import { dispatch, rewriteInTr, insertBlocksImpl } from '@/ai/tools/editTools';

// Pragna's own tools move the live selection, so remember where the user's
// cursor was when the run started and map it through every change.
// Returns a function that stops tracking (the last mapped cursor stays usable).
export function trackCursor(ctx) {
  const { editor } = ctx;
  ctx.cursor = editor.state.selection.getBookmark();
  const onTransaction = ({ transaction }) => {
    if (transaction.docChanged) ctx.cursor = ctx.cursor.map(transaction.mapping);
  };
  editor.on('transaction', onTransaction);
  return () => editor.off('transaction', onTransaction);
}

// Text offset inside a block for a doc position.
function offsetIn(view, pos) {
  let i = 0;
  while (i < view.text.length && view.posAt(i) < pos) i += 1;
  return i;
}

const BLOCK_MARKDOWN = /\n\s*\n|^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|)/m;

function insertAtCursorImpl({ text, replace_selection = false } = {}, ctx) {
  if (typeof text !== 'string' || !text) return { error: 'text is required' };
  const { doc } = ctx.editor.state;
  const sel = (ctx.cursor || ctx.editor.state.selection.getBookmark()).resolve(doc);
  const $from = sel.$from;
  let depth = $from.depth;
  while (depth > 0 && !$from.node(depth).isTextblock) depth -= 1;
  if (depth === 0) return { error: 'the cursor is not in a text block' };
  const node = $from.node(depth);
  const pos = $from.before(depth);
  if (BLOCK_MARKDOWN.test(text)) {
    return insertBlocksImpl({ after_id: ctx.refs.idFor(pos, node), markdown: text }, ctx);
  }
  const view = blockText(node, pos + 1, 'accepted');
  const start = offsetIn(view, sel.from);
  const end = replace_selection && sel.to <= pos + node.nodeSize ? offsetIn(view, sel.to) : start;
  const { tr } = ctx.editor.state;
  const r = rewriteInTr(ctx, tr, { pos, node }, view.text.slice(0, start) + text + view.text.slice(end), newSuggestionId());
  dispatch(ctx, tr);
  return r.unchanged ? { ok: true, unchanged: true } : { ok: true, suggestion_id: r.suggestion_id };
}

const STATUSES = ['pending', 'active', 'done'];

function updatePlanImpl({ steps } = {}, ctx) {
  if (!Array.isArray(steps) || !steps.length) return { error: 'steps must be a non-empty array' };
  if (steps.length > 20) return { error: 'keep the plan to 20 steps or fewer' };
  const plan = steps.map((s) => ({
    text: String(s?.text ?? '').trim(),
    status: STATUSES.includes(s?.status) ? s.status : 'pending',
  }));
  if (plan.some((s) => !s.text)) return { error: 'every step needs text' };
  ctx.plan = plan;
  return { ok: true };
}

export const insertAtCursor = safe(insertAtCursorImpl, 'insertAtCursor');
export const updatePlan = safe(updatePlanImpl, 'updatePlan');
