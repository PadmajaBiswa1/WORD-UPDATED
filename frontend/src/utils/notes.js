// Footnotes and endnotes, in the convention Pragna's add_footnote also uses: a
// superscript "[n]" (endnotes "[a]") after the selection, and a
// "[n] Footnote: " paragraph at the end of the document where the note is typed.

const LABEL = { footnote: 'Footnote', endnote: 'Endnote' };
const NOTE_LINE = { footnote: /^\[(\d+)\] Footnote:/, endnote: /^\[([a-z]+)\] Endnote:/ };

const toLetters = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(97 + ((x - 1) % 26)) + s;
  return s;
};

export function nextNoteMarker(doc, kind) {
  let count = 0;
  doc.descendants((node) => {
    if (node.isTextblock && NOTE_LINE[kind].test(node.textContent)) count += 1;
    return !node.isTextblock;
  });
  return kind === 'endnote' ? toLetters(count + 1) : String(count + 1);
}

// Inserts the marker at the end of the selection (the selected text stays) and
// puts the cursor in the new note so the user can type it, as Word does.
export function insertNote(editor, kind) {
  if (!editor || !LABEL[kind]) return false;
  const marker = `[${nextNoteMarker(editor.state.doc, kind)}]`;
  const { to } = editor.state.selection;
  const superscript = editor.schema.marks.superscript ? [{ type: 'superscript' }] : [];
  editor.chain().focus().insertContentAt(to, { type: 'text', text: marker, marks: superscript }).run();
  // A separate step: the end position must be read after the marker went in.
  editor.chain().insertContentAt(editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text: `${marker} ${LABEL[kind]}: ` }] }).run();
  // The note paragraph is the last one with text; the editor may keep an empty trailing paragraph after it.
  let notePos = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent.startsWith(`${marker} ${LABEL[kind]}:`)) notePos = pos + node.nodeSize - 1;
    return !node.isTextblock;
  });
  if (notePos !== null) editor.commands.setTextSelection(notePos);
  if (superscript.length) editor.commands.unsetMark('superscript');
  return true;
}
