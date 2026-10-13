import { useDocumentStore } from '@/store';
import { getStoredUser } from '@/services/api';
import { newCommentId } from '@/ai/suggestions';

// Review > New Comment and Ctrl+Alt+M: a comment on the selected text, anchored
// with the comment mark (not a highlight, which would change the document's
// formatting), or a general comment when nothing is selected.
export function addCommentAtSelection(editor) {
  if (!editor) return null;
  const { from, to } = editor.state.selection;
  const user = getStoredUser() || {};
  const id = newCommentId();
  const base = { id, author: user.name || user.email || 'You', timestamp: new Date().toISOString() };
  if (from === to) {
    useDocumentStore.getState().addComment({ ...base, text: 'General comment' });
    return id;
  }
  const text = editor.state.doc.textBetween(from, to, ' ');
  const { tr, schema } = editor.state;
  tr.addMark(from, to, schema.marks.commentAnchor.create({ commentId: id }));
  editor.view.dispatch(tr);
  useDocumentStore.getState().addComment({ ...base, anchor: id, text: `Comment on: ${text.slice(0, 80)}` });
  return id;
}
