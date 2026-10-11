import { Mark, Extension, mergeAttributes } from '@tiptap/core';
import { diffWords } from '@/ai/wordDiff';

const suggestionAttrs = () => ({
  id: { default: '', parseHTML: (el) => el.getAttribute('data-suggestion') || '' },
  author: { default: 'Pragna', parseHTML: (el) => el.getAttribute('data-author') || 'Pragna' },
  createdAt: { default: '', parseHTML: (el) => el.getAttribute('data-created') || '' },
});

function suggestionMark(name, tag, className) {
  return Mark.create({
    name,
    // Sorts before formatting marks in the schema so suggestions wrap them (<ins><strong>..</strong></ins>).
    priority: 1000,
    inclusive: false,
    excludes: 'suggestInsert suggestDelete',
    addAttributes: suggestionAttrs,
    // Higher than the legacy `insertion`/`deletion` marks, which also parse <ins>/<del>.
    parseHTML: () => [{ tag: `${tag}[data-suggestion]`, priority: 60 }],
    renderHTML: ({ mark, HTMLAttributes }) => [tag, mergeAttributes({
      'data-suggestion': mark.attrs.id,
      'data-author': mark.attrs.author,
      'data-created': mark.attrs.createdAt,
      class: className,
    }, HTMLAttributes.class ? { class: HTMLAttributes.class } : {}), 0],
  });
}

export const SuggestInsert = suggestionMark('suggestInsert', 'ins', 'etherx-suggest-insert');
export const SuggestDelete = suggestionMark('suggestDelete', 'del', 'etherx-suggest-delete');

export const CommentAnchor = Mark.create({
  name: 'commentAnchor',
  inclusive: false,
  addAttributes: () => ({
    commentId: { default: '', parseHTML: (el) => el.getAttribute('data-comment-id') || '' },
  }),
  parseHTML: () => [{ tag: 'span[data-comment-id]' }],
  renderHTML: ({ mark }) => ['span', { 'data-comment-id': mark.attrs.commentId, class: 'etherx-comment-anchor' }, 0],
});

let counter = 0;
export function newSuggestionId() {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
}

const hasMark = (node, name) => node.marks.some((m) => m.type.name === name);

/**
 * Text of a textblock as the reader sees it. `accepted` skips pending deletions,
 * `original` skips pending insertions. posAt(offset) maps a text offset to a doc position.
 */
export function blockText(node, contentStart, view = 'accepted') {
  const skip = view === 'accepted' ? 'suggestDelete' : 'suggestInsert';
  let text = '';
  const positions = [];
  let end = contentStart;
  node.forEach((child, offset) => {
    const pos = contentStart + offset;
    end = pos + child.nodeSize;
    if (child.isText) {
      if (hasMark(child, skip)) return;
      for (let i = 0; i < child.text.length; i += 1) positions.push(pos + i);
      text += child.text;
    } else {
      positions.push(pos);
      text += child.type.name === 'hardBreak' ? '\n' : '￼';
    }
  });
  return {
    text,
    posAt: (offset) => (offset < positions.length ? positions[offset] : (positions.length ? positions[positions.length - 1] + 1 : end)),
  };
}

/** Writes oldText -> newText into a suggestion-free textblock as insert/delete marks. */
export function applyTextDiff(tr, { from, oldText, newText, id, author = 'Pragna' }) {
  const createdAt = new Date().toISOString();
  const { schema } = tr.doc.type;
  const insertMark = schema.marks.suggestInsert.create({ id, author, createdAt });
  const deleteMark = schema.marks.suggestDelete.create({ id, author, createdAt });
  let cursor = from;
  for (const op of diffWords(oldText, newText)) {
    const len = op.text.length;
    if (op.type === 'equal') {
      cursor += len;
    } else if (op.type === 'delete') {
      tr.addMark(cursor, cursor + len, deleteMark);
      cursor += len;
    } else {
      // New words inherit the formatting of the text just before them.
      const $pos = tr.doc.resolve(cursor);
      const inherited = ($pos.nodeBefore?.marks || $pos.nodeAfter?.marks || [])
        .filter((m) => !['suggestInsert', 'suggestDelete', 'commentAnchor'].includes(m.type.name));
      tr.insert(cursor, schema.text(op.text, [...inherited, insertMark]));
      cursor += len;
    }
  }
}

/** Accepts or rejects pending suggestions (all, a range, or one id) inside `tr`. */
export function resolveSuggestions(tr, mode, { from = 0, to = tr.doc.content.size, id = null } = {}) {
  const removeType = mode === 'accept' ? 'suggestDelete' : 'suggestInsert';
  const keepType = mode === 'accept' ? 'suggestInsert' : 'suggestDelete';
  const removals = [];
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    node.marks.forEach((mark) => {
      if (id && mark.attrs.id !== id) return;
      if (mark.type.name === keepType) tr.removeMark(pos, pos + node.nodeSize, mark);
      if (mark.type.name === removeType) removals.push({ from: pos, to: pos + node.nodeSize });
    });
  });
  const merged = [];
  removals.sort((a, b) => a.from - b.from).forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && last.to === r.from) last.to = r.to;
    else merged.push({ ...r });
  });
  // Textblocks whose whole content this call removes (they had text before). Containers may only
  // be cleaned up when every textblock inside was emptied by this call, so blank blocks the user
  // left in a table or list are never swept away with them.
  let emptied = [];
  merged.forEach(({ from: a, to: b }) => {
    const $a = tr.doc.resolve(a);
    if (a === $a.start() && b === $a.end() && $a.depth > 0) emptied.push($a.before());
  });
  // Keeps `emptied` pointing at the same blocks after the steps added since `fromStep`.
  const sync = (fromStep) => {
    for (let i = fromStep; i < tr.steps.length; i += 1) {
      const { from: sFrom, to: sTo } = tr.steps[i];
      const map = tr.mapping.maps[i];
      emptied = emptied.filter((p) => !(p >= sFrom && p < sTo)).map((p) => map.map(p, 1));
    }
  };
  const del = (from, to) => {
    const n = tr.steps.length;
    tr.delete(from, to);
    sync(n);
  };
  const isEmptied = (pos) => emptied.includes(pos);

  // Delete from the end so earlier positions stay valid. A range covering a whole textblock
  // removes the block too, as long as its parent keeps a valid child list. Otherwise only the text
  // goes, and any container left holding nothing but emptied blocks is cleaned up with it.
  merged.reverse().forEach(({ from: a, to: b }) => {
    const $a = tr.doc.resolve(a);
    const wholeBlock = a === $a.start() && b === $a.end() && $a.depth > 0;
    if (wholeBlock && $a.node(-1).canReplace($a.index(-1), $a.index(-1) + 1)) {
      del($a.before(), $a.after());
    } else {
      del(a, b);
      if (wholeBlock) removeEmptyContainers(tr, $a.before(), isEmptied, del);
    }
  });
  return tr;
}

const EMPTY_CONTAINERS = new Set([
  'listItem', 'taskItem', 'bulletList', 'orderedList', 'taskList', 'blockquote',
  'tableCell', 'tableHeader', 'tableRow', 'table',
]);
const TABLE_CELLS = new Set(['tableCell', 'tableHeader']);

// True when every textblock inside `node` (whose content starts at `contentStart`) is empty and was
// emptied by the current resolve call, and nothing else (images, rules) lives there.
function onlyEmptiedBlocks(node, contentStart, isEmptied) {
  let ok = true;
  node.descendants((child, pos) => {
    if (!ok) return false;
    if (child.isTextblock) {
      if (child.content.size > 0 || !isEmptied(contentStart + pos)) ok = false;
      return false;
    }
    if (child.isLeaf) ok = false;
    return ok;
  });
  return ok;
}

// The textblock at `blockPos` was just emptied. Climb to the highest container holding only blocks
// emptied by this call and delete it, if its parent stays schema-valid without it.
function removeEmptyContainers(tr, blockPos, isEmptied, del) {
  const $p = tr.doc.resolve(blockPos);
  let top = null;
  for (let d = $p.depth; d > 0; d -= 1) {
    const n = $p.node(d);
    if (!EMPTY_CONTAINERS.has(n.type.name) || !onlyEmptiedBlocks(n, $p.start(d), isEmptied)) break;
    top = d;
  }
  // A table cell must keep a paragraph; never remove a cell on its own.
  if (top !== null && TABLE_CELLS.has($p.node(top).type.name)) top = top < $p.depth ? top + 1 : null;
  if (top === null || top < 1) return;
  const index = $p.index(top - 1);
  if ($p.node(top - 1).canReplace(index, index + 1)) del($p.before(top), $p.after(top));
}

export function listSuggestionIds(doc) {
  const ids = [];
  doc.descendants((node) => {
    if (!node.isText) return;
    node.marks.forEach((m) => {
      if ((m.type.name === 'suggestInsert' || m.type.name === 'suggestDelete') && m.attrs.id && !ids.includes(m.attrs.id)) ids.push(m.attrs.id);
    });
  });
  return ids;
}

export const Suggestions = Extension.create({
  name: 'suggestions',
  addCommands() {
    const run = (mode, id) => () => ({ tr, dispatch }) => {
      if (dispatch) resolveSuggestions(tr, mode, id ? { id } : {});
      return true;
    };
    return {
      acceptSuggestion: (id) => run('accept', id)(),
      rejectSuggestion: (id) => run('reject', id)(),
      acceptAllSuggestions: run('accept'),
      rejectAllSuggestions: run('reject'),
    };
  },
});
