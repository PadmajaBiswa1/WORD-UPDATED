import { DOMParser as PMDOMParser, Fragment } from '@tiptap/pm/model';
import { blockText, applyTextDiff, resolveSuggestions, newSuggestionId } from '@/ai/suggestions';
import { markdownToHtml } from '@/services/ai';
import { safe } from '@/ai/tools/readTools';

const AUTHOR = 'Pragna';

function dispatch(ctx, tr) {
  tr.setMeta('pragnaAgent', true);
  ctx.editor.view.dispatch(tr);
}

// Rejects pending suggestions inside the block, then diffs its original text to `newText`, all in `tr`.
function rewriteInTr(ctx, tr, hit, newText, id) {
  const start = hit.pos + 1;
  // A block Pragna inserted in this or an earlier run has no original text: rejecting would delete
  // the block itself. Replace its text instead, keeping it one pending insertion.
  if (hit.node.content.size > 0 && blockText(hit.node, start, 'original').text === '') {
    const existing = hit.node.firstChild?.marks.find((m) => m.type.name === 'suggestInsert');
    tr.replaceWith(start, start + hit.node.content.size, ctx.editor.schema.text(newText || ' ', [existing]));
    return { suggestion_id: existing.attrs.id };
  }
  resolveSuggestions(tr, 'reject', { from: start, to: start + hit.node.content.size });
  const node = tr.doc.nodeAt(hit.pos);
  const original = blockText(node, start, 'original').text;
  if (original === newText) return { unchanged: true };
  applyTextDiff(tr, { from: start, oldText: original, newText, id, author: AUTHOR });
  return { suggestion_id: id };
}

function rewriteResolved(ctx, hit, newText) {
  const { tr } = ctx.editor.state;
  const r = rewriteInTr(ctx, tr, hit, newText, newSuggestionId());
  dispatch(ctx, tr);
  return r.unchanged ? { ok: true, unchanged: true } : { ok: true, suggestion_id: r.suggestion_id };
}

// Marks the visible text of `block` as deleted with `mark`; text Pragna itself inserted is removed outright.
function deleteBlockText(tr, block, mark) {
  const start = block.pos + 1;
  const drop = [];
  block.node.forEach((child, offset) => {
    if (!child.isText) return;
    const from = start + offset;
    if (child.marks.some((m) => m.type.name === 'suggestInsert')) drop.push([from, from + child.nodeSize]);
    else if (!child.marks.some((m) => m.type.name === 'suggestDelete')) tr.addMark(from, from + child.nodeSize, mark);
  });
  drop.reverse().forEach(([from, to]) => tr.delete(from, to));
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

const LIST_TYPES = ['bulletList', 'orderedList', 'taskList'];

// Items to insert after a list item: a parsed list contributes its items, anything else is wrapped.
function listItemsFor(schema, parentItem, content) {
  const itemType = schema.nodes[parentItem.type.name];
  const items = [];
  const asItem = (children) => itemType.createAndFill(null, children);
  if (content.childCount === 1 && LIST_TYPES.includes(content.firstChild.type.name)) {
    content.firstChild.forEach((item) => {
      items.push(item.type === itemType ? item : asItem(item.content));
    });
  } else {
    content.forEach((block) => {
      const wrapped = asItem(block) || asItem(schema.nodes.paragraph.create(null, block.content));
      if (wrapped) items.push(wrapped);
    });
  }
  return items.filter(Boolean);
}

function insertBlocksImpl({ after_id, markdown } = {}, ctx) {
  const hit = ctx.refs.resolve(after_id);
  if (!hit) return { error: 'unknown or deleted block id; call get_outline or find_text first' };
  if (!markdown) return { error: 'markdown is required' };
  const { schema, tr } = ctx.editor.state;
  const holder = document.createElement('div');
  holder.innerHTML = markdownToHtml(markdown);
  const { content } = PMDOMParser.fromSchema(schema).parseSlice(holder);
  const $pos = tr.doc.resolve(hit.pos);
  const parentItem = $pos.parent;
  const inItem = ['listItem', 'taskItem'].includes(parentItem.type.name);
  let insertAt = hit.pos + hit.node.nodeSize;
  let fragment = content;
  if (inItem) {
    insertAt = $pos.after($pos.depth);
    fragment = Fragment.from(listItemsFor(schema, parentItem, content));
  }
  const before = tr.doc.content.size;
  tr.insert(insertAt, fragment);
  const inserted = tr.doc.content.size - before;
  if (inserted <= 0) return { error: 'nothing was inserted; check the markdown' };
  const id = newSuggestionId();
  const mark = schema.marks.suggestInsert.create({ id, author: AUTHOR, createdAt: new Date().toISOString() });
  tr.addMark(insertAt, insertAt + inserted, mark);
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
  if (missing.length === ids.length) return { error: `unknown or deleted block ids: ${missing.join(', ')}; call get_outline first` };
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id, ...(missing.length ? { missing } : {}) };
}

function setTableCellImpl({ cell_id, text } = {}, ctx) {
  const cell = ctx.refs.resolveCell(cell_id);
  if (!cell) return { error: 'unknown cell id; call read_table first' };
  if (typeof text !== 'string') return { error: 'text is required' };
  const blocks = [];
  cell.node.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    blocks.push({ node, pos: cell.pos + 1 + pos });
    return false;
  });
  if (!blocks.length) return { error: 'cell has no paragraph' };
  const { schema, tr } = ctx.editor.state;
  const id = newSuggestionId();
  // The first paragraph takes the whole new text; the cell's other paragraphs are marked deleted
  // under the same suggestion so accepting leaves exactly the new text. Later blocks go first so
  // earlier positions stay valid.
  const others = blocks.slice(1).filter((b) => blockText(b.node, b.pos + 1, 'accepted').text !== '');
  if (others.length) {
    const del = schema.marks.suggestDelete.create({ id, author: AUTHOR, createdAt: new Date().toISOString() });
    others.reverse().forEach((b) => deleteBlockText(tr, b, del));
  }
  const first = { node: ctx.editor.state.doc.nodeAt(blocks[0].pos), pos: blocks[0].pos };
  const r = rewriteInTr(ctx, tr, first, text, id);
  dispatch(ctx, tr);
  if (r.unchanged && !others.length) return { ok: true, unchanged: true };
  return { ok: true, suggestion_id: r.suggestion_id || id };
}

export const rewriteBlock = safe(rewriteBlockImpl, 'rewriteBlock');
export const replaceText = safe(replaceTextImpl, 'replaceText');
export const insertBlocks = safe(insertBlocksImpl, 'insertBlocks');
export const deleteBlocks = safe(deleteBlocksImpl, 'deleteBlocks');
export const setTableCell = safe(setTableCellImpl, 'setTableCell');
