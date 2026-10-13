// A selected picture is an insertion anchor, not content to replace.
export function insertDocumentImage(editor, attrs) {
  if (!editor || editor.isDestroyed || !editor.isEditable || !attrs.src) return false;
  const selection = editor.state.selection;
  const chain = editor.chain().focus();
  return selection.node?.type.name === 'image'
    ? chain.insertContentAt(selection.to, { type: 'image', attrs }).run()
    : chain.setImage(attrs).run();
}
