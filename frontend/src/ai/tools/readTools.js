import { blockText } from '@/ai/suggestions';

export const OUTLINE_PAGE = 60;
export const MAX_READ = 40;

/** Wraps a tool so an unexpected exception becomes `{ error }` instead of propagating. */
export const safe = (fn, name) => (args, ctx) => {
  try {
    return fn(args, ctx);
  } catch (e) {
    console.error(`[pragna] ${name} threw`, e);
    return { error: `${name} failed: ${e && e.message ? e.message : e}` };
  }
};

const typeOf = (node) => (node.type.name === 'heading' ? `heading${node.attrs.level}` : node.type.name);

/** Reading-order list of textblocks outside tables, plus one entry per top-level table. */
export function listBlocks(ctx) {
  const { doc } = ctx.editor.state;
  const out = [];
  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'table') {
      out.push({ kind: 'table', node, pos });
      return false;
    }
    if (node.isTextblock) {
      out.push({ kind: 'block', node, pos, parent });
      return false;
    }
    return true;
  });
  return out;
}

const textOf = (node, pos) => blockText(node, pos + 1, 'accepted').text;

// Accepted-view text of a table cell (or row): one line per textblock inside it.
function cellText(cell, cellPos) {
  const lines = [];
  cell.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = textOf(node, cellPos + 1 + pos);
    // A paragraph whose content is entirely pending deletion no longer exists in the accepted view.
    if (text === '' && node.content.size > 0) return false;
    lines.push(text);
    return false;
  });
  return lines.join('\n');
}

function describe(entry, ctx, full) {
  if (entry.kind === 'table') {
    const id = ctx.refs.tableIdFor(entry.pos);
    const rows = entry.node.childCount;
    const cols = entry.node.firstChild ? entry.node.firstChild.childCount : 0;
    const row = entry.node.firstChild;
    const first = row
      ? (() => {
        const cells = [];
        row.forEach((cell, offset) => cells.push(cellText(cell, entry.pos + 1 + 1 + offset)));
        return cells.join(' | ').slice(0, 80);
      })()
      : '';
    return { id, type: 'table', rows, cols, text: first };
  }
  const id = ctx.refs.idFor(entry.pos);
  const text = textOf(entry.node, entry.pos);
  const inList = entry.parent && ['listItem', 'taskItem'].includes(entry.parent.type.name);
  return {
    id,
    type: typeOf(entry.node),
    ...(inList ? { list_item: true } : {}),
    ...(entry.node.attrs.textAlign && entry.node.attrs.textAlign !== 'left' ? { align: entry.node.attrs.textAlign } : {}),
    text: full ? text : text.slice(0, 80),
  };
}

function getOutlineImpl({ page = 1 } = {}, ctx) {
  const all = listBlocks(ctx);
  const p = Math.max(1, Number(page) || 1);
  const slice = all.slice((p - 1) * OUTLINE_PAGE, p * OUTLINE_PAGE);
  return {
    total_blocks: all.length,
    page: p,
    next_page: p * OUTLINE_PAGE < all.length ? p + 1 : null,
    blocks: slice.map((entry) => describe(entry, ctx, false)),
  };
}

function readBlocksImpl({ ids, from_id, to_id } = {}, ctx) {
  let wanted = Array.isArray(ids) ? ids.map(String) : null;
  if (!wanted && from_id && to_id) {
    const from = ctx.refs.resolve(from_id);
    const to = ctx.refs.resolve(to_id);
    if (!from || !to) return { error: 'unknown from_id or to_id; call get_outline first' };
    wanted = listBlocks(ctx)
      .filter((e) => e.kind === 'block' && e.pos >= from.pos && e.pos <= to.pos)
      .map((e) => ctx.refs.idFor(e.pos));
  }
  if (!wanted || !wanted.length) return { error: 'pass ids[] or from_id and to_id' };
  if (wanted.length > MAX_READ) return { error: `read at most ${MAX_READ} blocks at a time` };
  return {
    blocks: wanted.map((id) => {
      const hit = ctx.refs.resolve(id);
      if (!hit) return { id, error: 'unknown or deleted block id' };
      return { id, type: typeOf(hit.node), text: textOf(hit.node, hit.pos) };
    }),
  };
}

function findTextImpl({ query, match_case = false } = {}, ctx) {
  if (!query) return { error: 'query is required' };
  const needle = match_case ? String(query) : String(query).toLowerCase();
  const matches = [];
  ctx.editor.state.doc.descendants((node, pos) => {
    if (matches.length >= 30) return false;
    if (!node.isTextblock) return true;
    const text = textOf(node, pos);
    const hay = match_case ? text : text.toLowerCase();
    const at = hay.indexOf(needle);
    if (at !== -1) {
      matches.push({
        block_id: ctx.refs.idFor(pos),
        snippet: text.slice(Math.max(0, at - 60), at + needle.length + 60),
      });
    }
    return false;
  });
  return { matches };
}

function getSelectionImpl(_args, ctx) {
  const { from, to, empty } = ctx.editor.state.selection;
  if (empty) return { selected: false, blocks: [] };
  const entries = [];
  ctx.editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    entries.push({ node, pos });
    return false;
  });
  const truncated = entries.length > MAX_READ;
  const blocks = entries.slice(0, MAX_READ).map(({ node, pos }) => ({ id: ctx.refs.idFor(pos), text: textOf(node, pos) }));
  return {
    selected: true,
    text: blocks.map((b) => b.text).join('\n'),
    blocks,
    ...(truncated ? { truncated: true } : {}),
  };
}

function readTableImpl({ table_id } = {}, ctx) {
  const table = ctx.refs.resolve(table_id);
  if (!table || table.node.type.name !== 'table') return { error: 'unknown table id; call get_outline first' };
  const rows = [];
  table.node.forEach((row, rowOffset, r) => {
    const cells = [];
    row.forEach((cell, offset, c) => cells.push({ cell_id: `${table_id}.r${r}c${c}`, text: cellText(cell, table.pos + 1 + rowOffset + 1 + offset) }));
    rows.push(cells);
  });
  return { table_id, rows };
}

export const getOutline = safe(getOutlineImpl, 'getOutline');
export const readBlocks = safe(readBlocksImpl, 'readBlocks');
export const findText = safe(findTextImpl, 'findText');
export const getSelection = safe(getSelectionImpl, 'getSelection');
export const readTable = safe(readTableImpl, 'readTable');
