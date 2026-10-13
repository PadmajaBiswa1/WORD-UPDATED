// Review tools: the document's comment threads and the user's tracked changes
// (insertion / deletion marks). Pragna's own suggestions are not listed here;
// the user reviews those.
import { useDocumentStore } from '@/store';
import { safe } from '@/ai/tools/readTools';

const TRACKED = ['insertion', 'deletion'];
const tag = (tr) => tr.setMeta('pragnaAgent', true);

// Block id of the innermost textblock containing `pos`.
function blockIdAt(ctx, pos) {
  const $pos = ctx.editor.state.doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d -= 1) {
    const node = $pos.node(d);
    if (node.isTextblock) return ctx.refs.idFor($pos.before(d), node);
  }
  return undefined;
}

// commentId -> { from, quote } for comments anchored in the text.
function commentAnchors(doc) {
  const anchors = new Map();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    node.marks.forEach((mark) => {
      if (mark.type.name !== 'commentAnchor') return;
      const id = String(mark.attrs.commentId);
      const hit = anchors.get(id);
      if (hit) hit.quote += node.text;
      else anchors.set(id, { from: pos, quote: node.text });
    });
  });
  return anchors;
}

function findComment(id) {
  return useDocumentStore.getState().comments.find((c) => String(c.id) === String(id));
}

function listCommentsImpl({ include_resolved = false } = {}, ctx) {
  const anchors = commentAnchors(ctx.editor.state.doc);
  const comments = useDocumentStore.getState().comments
    .filter((c) => include_resolved || !c.resolved)
    .map((c) => {
      const anchor = anchors.get(String(c.anchor ?? c.id));
      return {
        id: String(c.id),
        author: c.author || 'Unknown',
        text: c.text,
        resolved: !!c.resolved,
        replies: (c.replies || []).map(({ author, text }) => ({ author, text })),
        ...(anchor ? { block_id: blockIdAt(ctx, anchor.from), quote: anchor.quote } : {}),
      };
    });
  return { comments };
}

function replyCommentImpl({ comment_id, text } = {}) {
  if (!findComment(comment_id)) return { error: `unknown comment id "${comment_id}"` };
  if (!String(text || '').trim()) return { error: 'text is required' };
  useDocumentStore.getState().replyComment(findComment(comment_id).id, {
    author: 'Pragna', text: String(text).trim(), timestamp: new Date().toISOString(),
  });
  return { ok: true };
}

function resolveCommentImpl({ comment_id } = {}) {
  const comment = findComment(comment_id);
  if (!comment) return { error: `unknown comment id "${comment_id}"` };
  useDocumentStore.getState().resolveComment(comment.id);
  return { ok: true };
}

// Contiguous runs of one tracked mark, in document order.
function trackedRuns(doc) {
  const runs = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => TRACKED.includes(m.type.name));
    if (!mark) return;
    const last = runs.at(-1);
    if (last && last.to === pos && last.type === mark.type.name) {
      last.to += node.nodeSize;
      last.text += node.text;
    } else {
      runs.push({ type: mark.type.name, from: pos, to: pos + node.nodeSize, text: node.text });
    }
  });
  return runs;
}

// A change id names a run by its type, text and how many identical runs come
// before it, so it still finds the same run after other changes are resolved.
function signature(runs, run) {
  const nth = runs.filter((r) => r.from < run.from && r.type === run.type && r.text === run.text).length;
  return { type: run.type, text: run.text, nth };
}

function listChangesImpl(_args, ctx) {
  const runs = trackedRuns(ctx.editor.state.doc);
  ctx.changes = new Map();
  const changes = runs.map((run, i) => {
    const id = `tc${i + 1}`;
    ctx.changes.set(id, signature(runs, run));
    return { id, type: run.type, text: run.text, block_id: blockIdAt(ctx, run.from) };
  });
  return { changes };
}

function applyResolution(tr, schema, run, accept) {
  const removeText = (accept && run.type === 'deletion') || (!accept && run.type === 'insertion');
  if (removeText) tr.delete(tr.mapping.map(run.from), tr.mapping.map(run.to));
  else tr.removeMark(tr.mapping.map(run.from), tr.mapping.map(run.to), schema.marks[run.type]);
}

function resolveChangeImpl({ change_id, accept } = {}, ctx) {
  if (typeof accept !== 'boolean') return { error: 'accept must be true or false' };
  const { schema } = ctx.editor.state;
  const runs = trackedRuns(ctx.editor.state.doc);
  const tr = ctx.editor.state.tr;
  if (change_id === 'all') {
    if (!runs.length) return { ok: true, resolved: 0 };
    runs.forEach((run) => applyResolution(tr, schema, run, accept));
    ctx.editor.view.dispatch(tag(tr));
    return { ok: true, resolved: runs.length };
  }
  const sig = ctx.changes?.get(String(change_id));
  if (!sig) return { error: `unknown change id "${change_id}"; call list_changes first` };
  const run = runs.filter((r) => r.type === sig.type && r.text === sig.text)[sig.nth];
  if (!run) return { error: `change ${change_id} was already resolved or edited` };
  applyResolution(tr, schema, run, accept);
  ctx.editor.view.dispatch(tag(tr));
  // Later identical runs shift down by one once this one is gone.
  ctx.changes.forEach((other, id) => {
    if (id !== change_id && other.type === sig.type && other.text === sig.text && other.nth > sig.nth) other.nth -= 1;
  });
  ctx.changes.delete(String(change_id));
  return { ok: true };
}

export const listComments = safe(listCommentsImpl, 'listComments');
export const replyComment = safe(replyCommentImpl, 'replyComment');
export const resolveComment = safe(resolveCommentImpl, 'resolveComment');
export const listChanges = safe(listChangesImpl, 'listChanges');
export const resolveChange = safe(resolveChangeImpl, 'resolveChange');
