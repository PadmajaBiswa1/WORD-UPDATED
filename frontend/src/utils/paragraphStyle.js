// Edits the inline style of every paragraph and heading in the selection, one
// property at a time, so changing indent keeps line spacing, shading and the rest.

export function parseStyle(style) {
  const css = {};
  String(style || '').split(';').forEach((part) => {
    const i = part.indexOf(':');
    if (i < 0) return;
    const key = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if (key && value) css[key] = value;
  });
  return css;
}

export function toStyle(css) {
  return Object.entries(css)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

// `edit(css)` mutates the block's parsed style; an empty result clears the attribute.
export function patchBlockStyle(editor, edit) {
  if (!editor) return false;
  const { state } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return true;
    const css = parseStyle(node.attrs.style);
    edit(css);
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: toStyle(css) || null });
    return false;
  });
  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

export const pxValue = (value) => parseInt(String(value || '0'), 10) || 0;
