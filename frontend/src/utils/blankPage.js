import { TextSelection } from '@tiptap/pm/state';

export function insertBlankPage(editor) {
  if (!editor || !editor.schema.nodes.pageBreak) return false;
  const { state } = editor;
  const { $from } = state.selection;
  const at = $from.depth ? $from.after(1) : state.selection.from;
  const pageBreak = editor.schema.nodes.pageBreak.create({ auto: false, manual: true });
  const paragraph = editor.schema.nodes.paragraph.create();
  const nodes = at < state.doc.content.size ? [pageBreak, paragraph, pageBreak] : [pageBreak, paragraph];
  const tr = state.tr.insert(at, nodes);
  tr.setSelection(TextSelection.create(tr.doc, at + pageBreak.nodeSize + 1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
  return true;
}
