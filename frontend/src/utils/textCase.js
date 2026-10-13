import { TextSelection } from '@tiptap/pm/state';

// Change the case of the selected text in place: each text node keeps its marks
// and the paragraphs stay separate.

export const CASES = {
  upper: (text) => text.toUpperCase(),
  lower: (text) => text.toLowerCase(),
  title: (text) => text.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (m, pre, ch) => pre + ch.toUpperCase()),
};

// Word's Shift+F3 cycle: lower -> Title -> UPPER -> lower.
export function nextCase(text) {
  if (text === text.toUpperCase()) return 'lower';
  if (text === text.toLowerCase()) return 'title';
  return 'upper';
}

export function selectionText(editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, '\n');
}

export function applyCase(editor, kind) {
  const transform = CASES[kind];
  const { state } = editor;
  const { from, to } = state.selection;
  if (!transform || from === to) return false;

  const segments = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    segments.push({ start, end, marks: node.marks, text: node.text.slice(start - pos, end - pos) });
    return false;
  });

  // Transform the whole run so title case sees word boundaries across marks; fall
  // back to per-segment when a character changes length (e.g. German ß -> SS).
  const joined = segments.map((s) => s.text).join('');
  const whole = transform(joined);
  let offset = 0;
  const tr = state.tr;
  segments.forEach((s) => {
    const next = whole.length === joined.length ? whole.slice(offset, offset + s.text.length) : transform(s.text);
    offset += s.text.length;
    if (next !== s.text) tr.replaceWith(tr.mapping.map(s.start), tr.mapping.map(s.end), state.schema.text(next, s.marks));
  });
  if (!tr.docChanged) return false;
  // Keep the same text selected so repeated presses keep cycling.
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from, -1), tr.mapping.map(to, 1))));
  editor.commands.focus();
  return true;
}
