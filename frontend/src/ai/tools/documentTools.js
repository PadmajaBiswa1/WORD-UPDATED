// Document-level tools: bulk replace, lists, page breaks, table of contents,
// footnotes, links, images, header and footer. Text changes go through the
// suggestion path (reviewable); structure changes are tagged as Pragna edits so
// whole-run undo covers them.
import { blockText, newSuggestionId } from '@/ai/suggestions';
import { useDocumentStore } from '@/store';
import { safe, listBlocks } from '@/ai/tools/readTools';
import { dispatch, rewriteInTr, insertBlocksImpl } from '@/ai/tools/editTools';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const SAFE_IMAGE = /^(https?:\/\/|data:image\/)/i;

function replaceAllImpl({ find, replace = '', match_case = true } = {}, ctx) {
  if (!find) return { error: 'find is required' };
  const re = new RegExp(escapeRe(find), match_case ? 'g' : 'gi');
  const hits = listBlocks(ctx).filter((b) => b.kind === 'block');
  const { tr } = ctx.editor.state;
  const id = newSuggestionId();
  let replaced = 0;
  let blocks = 0;
  // Last block first, so earlier positions stay valid within one transaction.
  [...hits].reverse().forEach((hit) => {
    const text = blockText(hit.node, hit.pos + 1, 'accepted').text;
    const count = (text.match(re) || []).length;
    if (!count) return;
    const node = tr.doc.nodeAt(hit.pos);
    rewriteInTr(ctx, tr, { pos: hit.pos, node }, text.replace(re, replace), id);
    replaced += count;
    blocks += 1;
  });
  if (!replaced) return { error: `"${find}" not found in the document` };
  dispatch(ctx, tr);
  return { ok: true, replaced, blocks, suggestion_id: id };
}

const LIST_COMMANDS = { bullet: 'toggleBulletList', ordered: 'toggleOrderedList', task: 'toggleTaskList' };
const LIST_NODE = { bullet: 'bulletList', ordered: 'orderedList', task: 'taskList' };

function setListImpl({ ids, kind } = {}, ctx) {
  if (!Array.isArray(ids) || !ids.length) return { error: 'ids is required' };
  if (!['bullet', 'ordered', 'task', 'none'].includes(kind)) return { error: 'kind must be bullet, ordered, task or none' };
  const hits = ids.map((id) => ctx.refs.resolve(id));
  if (hits.some((h) => !h)) return { error: 'unknown or deleted block id' };
  const from = Math.min(...hits.map((h) => h.pos)) + 1;
  const to = Math.max(...hits.map((h) => h.pos + h.node.nodeSize)) - 1;
  const { editor } = ctx;
  const listAround = () => {
    const $from = editor.state.doc.resolve(editor.state.selection.from);
    for (let d = $from.depth; d > 0; d -= 1) {
      const name = $from.node(d).type.name;
      if (Object.values(LIST_NODE).includes(name)) return name;
    }
    return null;
  };
  editor.chain().setTextSelection({ from, to }).run();
  const current = listAround();
  if (kind === 'none') {
    const item = current === 'taskList' ? 'taskItem' : 'listItem';
    for (let guard = 0; guard < 8 && listAround(); guard += 1) {
      if (!editor.chain().setMeta('pragnaAgent', true).liftListItem(item).run()) break;
    }
    return listAround() ? { error: 'could not remove the list' } : { ok: true };
  }
  if (current === LIST_NODE[kind]) return { ok: true, unchanged: true };
  const chain = editor.chain().setMeta('pragnaAgent', true);
  if (typeof chain[LIST_COMMANDS[kind]] !== 'function') return { error: `${kind} lists are not available in this editor` };
  // toggle* converts an existing list of another kind in place.
  return chain[LIST_COMMANDS[kind]]().run() ? { ok: true } : { error: `could not make a ${kind} list here` };
}

function insertNodeAfter(ctx, after_id, node) {
  const hit = ctx.refs.resolve(after_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  const $pos = ctx.editor.state.doc.resolve(hit.pos);
  // After the top-level ancestor, so the node never lands inside a list or table.
  const at = $pos.depth > 0 ? $pos.after(1) : hit.pos + hit.node.nodeSize;
  const { tr } = ctx.editor.state;
  tr.insert(at, node);
  dispatch(ctx, tr);
  return { ok: true };
}

function insertPageBreakImpl({ after_id } = {}, ctx) {
  const type = ctx.editor.schema.nodes.pageBreak;
  if (!type) return { error: 'page breaks are not available in this editor' };
  return insertNodeAfter(ctx, after_id, type.create({ auto: false }));
}

function insertTocImpl({ after_id } = {}, ctx) {
  const lines = [];
  ctx.editor.state.doc.descendants((node) => {
    if (node.type.name !== 'heading') return;
    const text = node.textContent.trim();
    // markdownToHtml has no nested lists, so sub-levels stay in one flat list.
    if (text) lines.push(`- ${text}`);
  });
  if (!lines.length) return { error: 'the document has no headings to list; add headings first' };
  return insertBlocksImpl({ after_id, markdown: `## Table of Contents\n\n${lines.join('\n')}` }, ctx);
}

// Footnotes follow the app's convention: "[n]" after the phrase, and a
// "[n] Footnote: …" paragraph at the end of the document.
function addFootnoteImpl({ block_id, find, text } = {}, ctx) {
  if (!String(text || '').trim()) return { error: 'text is required' };
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  let number = 1;
  ctx.editor.state.doc.descendants((node) => {
    if (node.isTextblock && /^\[\d+\] Footnote:/.test(node.textContent)) number += 1;
  });
  const current = blockText(hit.node, hit.pos + 1, 'accepted').text;
  const at = find ? current.indexOf(find) : -1;
  if (find && at === -1) return { error: `"${find}" not found in ${block_id}` };
  const end = find ? at + find.length : current.length;
  const { tr } = ctx.editor.state;
  rewriteInTr(ctx, tr, hit, `${current.slice(0, end)}[${number}]${current.slice(end)}`, newSuggestionId());
  dispatch(ctx, tr);
  const blocks = listBlocks(ctx);
  const last = blocks[blocks.length - 1];
  const lastId = last.kind === 'table' ? ctx.refs.tableIdFor(last.pos, last.node) : ctx.refs.idFor(last.pos, last.node);
  const note = insertBlocksImpl({ after_id: lastId, markdown: `[${number}] Footnote: ${String(text).trim()}` }, ctx);
  return note.error ? note : { ok: true, number };
}

function setLinkImpl({ block_id, find, url } = {}, ctx) {
  if (!SAFE_LINK.test(String(url || ''))) return { error: 'url must start with http://, https:// or mailto:' };
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  const linkType = ctx.editor.schema.marks.link;
  if (!linkType) return { error: 'links are not available in this editor' };
  const view = blockText(hit.node, hit.pos + 1, 'accepted');
  const at = find ? view.text.indexOf(find) : 0;
  if (find && at === -1) return { error: `"${find}" not found in ${block_id}` };
  const from = find ? view.posAt(at) : hit.pos + 1;
  const to = find ? view.posAt(at + find.length - 1) + 1 : hit.pos + 1 + hit.node.content.size;
  const { tr } = ctx.editor.state;
  tr.addMark(from, to, linkType.create({ href: url }));
  dispatch(ctx, tr);
  return { ok: true };
}

function insertImageImpl({ after_id, url, alt = '' } = {}, ctx) {
  if (!SAFE_IMAGE.test(String(url || ''))) return { error: 'url must be an http(s) address or a data:image URL' };
  const type = ctx.editor.schema.nodes.image;
  if (!type) return { error: 'images are not available in this editor' };
  // Inline images sit in their own paragraph.
  const image = type.create({ src: url, alt });
  const node = type.isInline ? ctx.editor.schema.nodes.paragraph.create(null, image) : image;
  return insertNodeAfter(ctx, after_id, node);
}

function setHeaderFooterImpl({ header, footer, page_numbers } = {}) {
  const patch = {};
  if (typeof header === 'string') patch.headerText = header;
  if (typeof footer === 'string') patch.footerText = footer;
  if (typeof page_numbers === 'boolean') patch.pageNumberEnabled = page_numbers;
  if (!Object.keys(patch).length) return { error: 'give header, footer or page_numbers' };
  useDocumentStore.getState().setHeaderFooter(patch);
  return { ok: true };
}

export const replaceAll = safe(replaceAllImpl, 'replaceAll');
export const setList = safe(setListImpl, 'setList');
export const insertPageBreak = safe(insertPageBreakImpl, 'insertPageBreak');
export const insertToc = safe(insertTocImpl, 'insertToc');
export const addFootnote = safe(addFootnoteImpl, 'addFootnote');
export const setLink = safe(setLinkImpl, 'setLink');
export const insertImage = safe(insertImageImpl, 'insertImage');
export const setHeaderFooter = safe(setHeaderFooterImpl, 'setHeaderFooter');
