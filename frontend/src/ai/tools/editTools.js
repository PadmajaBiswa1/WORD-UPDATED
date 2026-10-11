import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { blockText, applyTextDiff, resolveSuggestions, newSuggestionId } from '@/ai/suggestions';
import { markdownToHtml } from '@/services/ai';
import { safe } from '@/ai/tools/readTools';

const AUTHOR = 'Pragna';

function dispatch(ctx, tr) {
  tr.setMeta('pragnaAgent', true);
  ctx.editor.view.dispatch(tr);
}

// Rejects pending suggestions inside the block, then diffs its original text to `newText`.
function rewriteResolved(ctx, hit, newText) {
  const { tr } = ctx.editor.state;
  const start = hit.pos + 1;
  // A block Pragna inserted in this or an earlier run has no original text: rejecting would delete
  // the block itself. Replace its text instead, keeping it one pending insertion.
  if (hit.node.content.size > 0 && blockText(hit.node, start, 'original').text === '') {
    const existing = hit.node.firstChild?.marks.find((m) => m.type.name === 'suggestInsert');
    tr.replaceWith(start, start + hit.node.content.size, ctx.editor.schema.text(newText || ' ', [existing]));
    dispatch(ctx, tr);
    return { ok: true, suggestion_id: existing.attrs.id };
  }
  resolveSuggestions(tr, 'reject', { from: start, to: start + hit.node.content.size });
  const node = tr.doc.nodeAt(hit.pos);
  const original = blockText(node, start, 'original').text;
  if (original === newText) {
    dispatch(ctx, tr);
    return { ok: true, unchanged: true };
  }
  const id = newSuggestionId();
  applyTextDiff(tr, { from: start, oldText: original, newText, id, author: AUTHOR });
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id };
}

function rewriteBlockImpl({ block_id, text } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id; call get_outline or find_text first' };
  if (typeof text !== 'string') return { error: 'text is required' };
  return rewriteResolved(ctx, hit, text);
}

function replaceTextImpl({ block_id, find, replace = '', occurrence = 1 } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id; call get_outline or find_text first' };
  if (!find) return { error: 'find is required' };
  const current = blockText(hit.node, hit.pos + 1, 'accepted').text;
  let at = -1;
  for (let n = 0, from = 0; n < Math.max(1, occurrence); n += 1) {
    at = current.indexOf(find, from);
    if (at === -1) break;
    from = at + find.length;
  }
  if (at === -1) return { error: `"${find}" not found in ${block_id}; read the block and copy the exact text` };
  return rewriteResolved(ctx, hit, current.slice(0, at) + replace + current.slice(at + find.length));
}

function insertBlocksImpl({ after_id, markdown } = {}, ctx) {
  const hit = ctx.refs.resolve(after_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  if (!markdown) return { error: 'markdown is required' };
  const { schema, tr } = ctx.editor.state;
  const holder = document.createElement('div');
  holder.innerHTML = markdownToHtml(markdown);
  const slice = PMDOMParser.fromSchema(schema).parseSlice(holder);
  const insertAt = hit.pos + hit.node.nodeSize;
  tr.insert(insertAt, slice.content);
  const id = newSuggestionId();
  const mark = schema.marks.suggestInsert.create({ id, author: AUTHOR, createdAt: new Date().toISOString() });
  tr.addMark(insertAt, insertAt + slice.content.size, mark);
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id };
}

function deleteBlocksImpl({ ids } = {}, ctx) {
  if (!Array.isArray(ids) || !ids.length) return { error: 'ids[] is required' };
  const { schema, tr } = ctx.editor.state;
  const id = newSuggestionId();
  const mark = schema.marks.suggestDelete.create({ id, author: AUTHOR, createdAt: new Date().toISOString() });
  const missing = [];
  ids.forEach((blockId) => {
    const hit = ctx.refs.resolve(blockId);
    if (!hit) missing.push(blockId);
    else tr.addMark(hit.pos + 1, hit.pos + 1 + hit.node.content.size, mark);
  });
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id, ...(missing.length ? { missing } : {}) };
}

function setTableCellImpl({ cell_id, text } = {}, ctx) {
  const cell = ctx.refs.resolveCell(cell_id);
  if (!cell) return { error: 'unknown cell id; call read_table first' };
  if (typeof text !== 'string') return { error: 'text is required' };
  let first = null;
  cell.node.descendants((node, pos) => {
    if (!first && node.isTextblock) first = cell.pos + 1 + pos;
    return !first;
  });
  if (first === null) return { error: 'cell has no paragraph' };
  return rewriteResolved(ctx, { node: ctx.editor.state.doc.nodeAt(first), pos: first }, text);
}

export const rewriteBlock = safe(rewriteBlockImpl, 'rewriteBlock');
export const replaceText = safe(replaceTextImpl, 'replaceText');
export const insertBlocks = safe(insertBlocksImpl, 'insertBlocks');
export const deleteBlocks = safe(deleteBlocksImpl, 'deleteBlocks');
export const setTableCell = safe(setTableCellImpl, 'setTableCell');
