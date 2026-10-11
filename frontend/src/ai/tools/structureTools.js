import { blockText } from '@/ai/suggestions';
import { useDocumentStore } from '@/store';
import { safe } from '@/ai/tools/readTools';

const tag = (tr) => tr.setMeta('pragnaAgent', true);

// Doc range of `find` (accepted text) inside a block, or the whole block content.
function rangeIn(hit, find) {
  const start = hit.pos + 1;
  if (!find) return { from: start, to: start + hit.node.content.size };
  const view = blockText(hit.node, start, 'accepted');
  const at = view.text.indexOf(find);
  if (at === -1) return null;
  return { from: view.posAt(at), to: view.posAt(at + find.length - 1) + 1 };
}

function formatTextImpl({ block_id, find, bold, italic, underline, color, font_size } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  const range = rangeIn(hit, find);
  if (!range) return { error: `"${find}" not found in ${block_id}` };
  const { schema, tr } = ctx.editor.state;
  const toggle = (value, markName, attrs) => {
    if (!schema.marks[markName]) return;
    if (value === true) tr.addMark(range.from, range.to, schema.marks[markName].create(attrs));
    if (value === false) tr.removeMark(range.from, range.to, schema.marks[markName]);
  };
  toggle(bold, 'bold');
  toggle(italic, 'italic');
  toggle(underline, 'underline');
  if ((color || font_size) && schema.marks.textStyle) {
    // Only set attributes the schema supports (the test editor's TextStyle has none).
    const supported = schema.marks.textStyle.spec.attrs || {};
    const attrs = {
      ...(color && 'color' in supported ? { color } : {}),
      ...(font_size && 'fontSize' in supported ? { fontSize: `${parseFloat(font_size)}pt` } : {}),
    };
    if (Object.keys(attrs).length) tr.addMark(range.from, range.to, schema.marks.textStyle.create(attrs));
  }
  ctx.editor.view.dispatch(tag(tr));
  return { ok: true };
}

const STYLE_MAP = { normal: ['paragraph', {}], h1: ['heading', { level: 1 }], h2: ['heading', { level: 2 }], h3: ['heading', { level: 3 }], h4: ['heading', { level: 4 }] };

function setBlockStyleImpl({ ids, style, align, line_spacing } = {}, ctx) {
  if (!Array.isArray(ids) || !ids.length) return { error: 'ids[] is required' };
  if (style && !STYLE_MAP[style]) return { error: 'style must be one of normal, h1, h2, h3, h4' };
  const { schema, tr } = ctx.editor.state;
  const missing = [];
  ids.forEach((id) => {
    const hit = ctx.refs.resolve(id);
    if (!hit) { missing.push(id); return; }
    const [typeName, extra] = style ? STYLE_MAP[style] : [hit.node.type.name, {}];
    const attrs = { ...hit.node.attrs, ...extra };
    if (typeName === 'paragraph') delete attrs.level;
    if (align) attrs.textAlign = align;
    if (line_spacing && 'style' in attrs) {
      const rest = String(attrs.style || '').replace(/line-height:\s*[^;]+;?/g, '').trim();
      attrs.style = `${rest ? `${rest}; ` : ''}line-height: ${parseFloat(line_spacing)}`;
    }
    tr.setNodeMarkup(hit.pos, schema.nodes[typeName], attrs);
  });
  ctx.editor.view.dispatch(tag(tr));
  return { ok: true, ...(missing.length ? { missing } : {}) };
}

// Puts the cursor in the first cell of `row`, then runs a Tiptap table command in one transaction.
function tableCommand(ctx, table_id, row, command) {
  const table = ctx.refs.resolve(table_id);
  if (!table) return { error: 'unknown table id' };
  const cell = ctx.refs.resolveCell(`${table_id}.r${Math.max(0, Math.min(row, table.node.childCount - 1))}c0`);
  if (!cell) return { error: 'unknown table cell' };
  const ok = ctx.editor.chain()
    .command(({ tr }) => { tag(tr); return true; })
    .setTextSelection(cell.pos + 2)[command]()
    .run();
  return ok ? { ok: true } : { error: `could not ${command}` };
}

function tableAddRowImpl({ table_id, index = 0 } = {}, ctx) {
  return tableCommand(ctx, table_id, Number(index), 'addRowAfter');
}

function tableDeleteRowImpl({ table_id, index = 0 } = {}, ctx) {
  return tableCommand(ctx, table_id, Number(index), 'deleteRow');
}

function tableAddColumnImpl({ table_id, index = 0 } = {}, ctx) {
  const table = ctx.refs.resolve(table_id);
  if (!table) return { error: 'unknown table id' };
  const cell = ctx.refs.resolveCell(`${table_id}.r0c${Math.max(0, Math.min(Number(index), table.node.firstChild.childCount - 1))}`);
  if (!cell) return { error: 'unknown table cell' };
  const ok = ctx.editor.chain().command(({ tr }) => { tag(tr); return true; }).setTextSelection(cell.pos + 2).addColumnAfter().run();
  return ok ? { ok: true } : { error: 'could not add column' };
}

function insertTableImpl({ after_id, rows } = {}, ctx) {
  const hit = ctx.refs.resolve(after_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  if (!Array.isArray(rows) || !rows.length || !rows.every(Array.isArray)) return { error: 'rows must be an array of arrays' };
  const width = Math.max(...rows.map((r) => r.length));
  const table = {
    type: 'table',
    content: rows.map((r) => ({
      type: 'tableRow',
      content: Array.from({ length: width }, (_, c) => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: r[c] ? [{ type: 'text', text: String(r[c]) }] : [] }],
      })),
    })),
  };
  // Tables live at the top level: insert after the block's top-level ancestor.
  const $pos = ctx.editor.state.doc.resolve(hit.pos);
  const after = $pos.depth === 0 ? hit.pos + hit.node.nodeSize : $pos.after(1);
  const ok = ctx.editor.chain().command(({ tr }) => { tag(tr); return true; }).insertContentAt(after, table).run();
  return ok ? { ok: true } : { error: 'could not insert table' };
}

function addCommentImpl({ block_id, find, text } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  if (!text) return { error: 'text is required' };
  const range = rangeIn(hit, find);
  if (!range) return { error: `"${find}" not found in ${block_id}` };
  const commentId = `c${Date.now().toString(36)}`;
  const { schema, tr } = ctx.editor.state;
  tr.addMark(range.from, range.to, schema.marks.commentAnchor.create({ commentId }));
  ctx.editor.view.dispatch(tag(tr));
  useDocumentStore.getState().addComment({
    id: commentId, text, author: 'Pragna', anchor: commentId, timestamp: new Date().toISOString(),
  });
  return { ok: true, comment_id: commentId };
}

export const formatText = safe(formatTextImpl, 'formatText');
export const setBlockStyle = safe(setBlockStyleImpl, 'setBlockStyle');
export const tableAddRow = safe(tableAddRowImpl, 'tableAddRow');
export const tableAddColumn = safe(tableAddColumnImpl, 'tableAddColumn');
export const tableDeleteRow = safe(tableDeleteRowImpl, 'tableDeleteRow');
export const insertTable = safe(insertTableImpl, 'insertTable');
export const addComment = safe(addCommentImpl, 'addComment');
