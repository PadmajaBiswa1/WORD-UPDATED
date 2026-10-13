import { Mark, mergeAttributes } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Mapping, ReplaceStep } from '@tiptap/pm/transform';
import { useDocumentStore } from '@/store';
import { getStoredUser } from '@/services/api';

// ── Track Changes (Review ▸ Track Changes), modelled on Word ──
// While tracking is on, typed, pasted or replaced content gets an `insertion`
// mark and deleted content stays in the document with a `deletion` mark (struck
// through). Deleting your own pending insertion removes it outright.

const TRACK_KEY = new PluginKey('trackChanges');
// Transactions carrying this meta are never re-tracked (accept/reject, our own fix-ups).
export const SKIP_TRACKING = 'trackChangesSkip';

const changeAttributes = () => ({
  author: { default: null, parseHTML: (el) => el.getAttribute('data-author'), renderHTML: (a) => (a.author ? { 'data-author': a.author } : {}) },
  date: { default: null, parseHTML: (el) => el.getAttribute('data-date'), renderHTML: (a) => (a.date ? { 'data-date': a.date } : {}) },
});

const titleFor = (kind, attrs) => [kind, attrs.author && `by ${attrs.author}`, attrs.date && new Date(attrs.date).toLocaleString()]
  .filter(Boolean).join(' ');

export const Insertion = Mark.create({
  name: 'insertion',
  inclusive: false,
  addAttributes: changeAttributes,
  parseHTML() {
    return [{ tag: 'ins:not([data-suggestion])' }, { tag: 'span[data-mark="insertion"]' }];
  },
  renderHTML({ HTMLAttributes, mark }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'etherx-insertion', 'data-mark': 'insertion', title: titleFor('Inserted', mark.attrs) }), 0];
  },
});

export const Deletion = Mark.create({
  name: 'deletion',
  priority: 1000,
  inclusive: false,
  addAttributes: changeAttributes,
  parseHTML() {
    return [{ tag: 'del:not([data-suggestion])' }, { tag: 'span[data-mark="deletion"]' }];
  },
  renderHTML({ HTMLAttributes, mark }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'etherx-deletion', 'data-mark': 'deletion', title: titleFor('Deleted', mark.attrs) }), 0];
  },
  addProseMirrorPlugins() {
    return [trackChangesPlugin()];
  },
});

function currentAuthor() {
  const user = getStoredUser() || {};
  return user.name || user.email || 'Unknown';
}

// Deleted content to keep visible: the author's own pending insertions are
// dropped (deleting them just removes them); everything else is marked deleted.
function markDeleted(fragment, schema, attrs) {
  const nodes = [];
  fragment.forEach((node) => {
    if (node.isText) {
      if (node.marks.some((m) => m.type.name === 'insertion')) return;
      nodes.push(node.mark(schema.marks.deletion.create(attrs).addToSet(node.marks)));
    } else {
      nodes.push(node.copy(markDeleted(node.content, schema, attrs)));
    }
  });
  return Fragment.fromArray(nodes);
}

const step0From = (tr) => tr.steps.find((step) => step instanceof ReplaceStep)?.from ?? tr.selection.head;

// User edits only: not loads or remote sync (setContent without an update),
// whole-document replacements, pagination, Pragna (it has its own suggestions)
// or our own accept/reject.
const isTrackable = (tr, index, transactions, oldDoc) => tr.docChanged
  && !tr.getMeta(SKIP_TRACKING)
  && !tr.getMeta('preventUpdate')
  && !tr.getMeta('pragnaAgent')
  && !tr.getMeta('pragnaUndo')
  && tr.getMeta('addToHistory') !== false
  && !tr.getMeta('history$')
  && tr.steps.every((step) => step instanceof ReplaceStep || step.constructor.name.endsWith('MarkStep'))
  && !tr.steps.some((step) => step instanceof ReplaceStep && step.from === 0 && step.to >= oldDoc.content.size);

function trackChangesPlugin() {
  return new Plugin({
    key: TRACK_KEY,
    appendTransaction(transactions, oldState, newState) {
      if (!useDocumentStore.getState().trackChanges) return null;
      const tr = transactions.find((t, i, all) => isTrackable(t, i, all, oldState.doc));
      if (!tr) return null;
      // Other plugins may have appended transactions after the user's one.
      const afterTr = new Mapping();
      transactions.slice(transactions.indexOf(tr) + 1).forEach((t) => t.mapping.maps.forEach((m) => afterTr.appendMap(m)));
      const { schema } = newState;
      // Minute precision so consecutive keystrokes share attributes and merge into one span.
      const minute = new Date();
      minute.setSeconds(0, 0);
      const attrs = { author: currentAuthor(), date: minute.toISOString() };
      const out = newState.tr;
      let deletedAt = null; // where re-inserted deleted text starts (for the cursor)
      let deletedSize = 0;

      tr.steps.forEach((step, index) => {
        if (!(step instanceof ReplaceStep)) return;
        const before = tr.docs[index];
        const laterMap = tr.mapping.slice(index + 1);
        const toNew = (pos, assoc) => out.mapping.map(afterTr.map(laterMap.map(pos, assoc), assoc), assoc);

        if (step.slice.size) {
          const from = toNew(step.from, -1);
          const to = toNew(step.from + step.slice.size, 1);
          out.removeMark(from, to, schema.marks.deletion);
          out.addMark(from, to, schema.marks.insertion.create(attrs));
        }

        // Put back what was deleted, marked as a deletion, just before the insertion.
        if (step.to > step.from) {
          const removed = before.slice(step.from, step.to);
          const kept = markDeleted(removed.content, schema, attrs);
          if (kept.size) {
            const at = toNew(step.from, -1);
            out.replace(at, at, new Slice(kept, removed.openStart, removed.openEnd));
            deletedAt = at;
            deletedSize = out.doc.content.size - newState.doc.content.size;
          }
        }
      });

      if (!out.docChanged) return null;
      // Backspace leaves the cursor before the struck-through text, Delete after it (as in Word).
      if (deletedAt !== null && tr.selection.empty) {
        const backward = oldState.selection.head > step0From(tr);
        const pos = backward ? deletedAt : deletedAt + deletedSize;
        out.setSelection(TextSelection.near(out.doc.resolve(Math.min(pos, out.doc.content.size))));
      }
      return out.setMeta(SKIP_TRACKING, true);
    },
  });
}

// Resolve tracked edits through ProseMirror transactions so save and undo see them.
export function getTrackedChanges(editor) {
  const changes = [];
  editor?.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((mark) => ['insertion', 'deletion'].includes(mark.type.name));
    if (!mark) return;
    const previous = changes.at(-1);
    if (previous?.to === pos && previous.type === mark.type.name) previous.to += node.nodeSize;
    else changes.push({ from: pos, to: pos + node.nodeSize, type: mark.type.name });
  });
  return changes;
}

export function resolveTrackedChange(editor, accept) {
  if (!editor) return false;
  const changes = getTrackedChanges(editor);
  const selection = editor.state.selection;
  const change = changes.find((change) => change.from <= selection.to && change.to >= selection.from) || changes[0];
  if (!change) return false;
  const removeText = (accept && change.type === 'deletion') || (!accept && change.type === 'insertion');
  const transaction = editor.state.tr;
  if (removeText) transaction.delete(change.from, change.to);
  else transaction.removeMark(change.from, change.to, editor.schema.marks[change.type]);
  editor.view.dispatch(transaction.setMeta(SKIP_TRACKING, true));
  editor.view.focus();
  return true;
}

export function selectTrackedChange(editor, direction) {
  const changes = getTrackedChanges(editor);
  if (!changes.length) return false;
  const { from, to } = editor.state.selection;
  const target = direction > 0
    ? changes.find((change) => change.from > to) || changes[0]
    : [...changes].reverse().find((change) => change.to < from) || changes.at(-1);
  editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
  return true;
}
