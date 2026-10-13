import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentAnchor } from '@/ai/suggestions';
import { Insertion, Deletion } from '@/services/trackedChanges';
import { BlockRefs } from '@/ai/blockRefs';
import { listComments, replyComment, resolveComment, listChanges, resolveChange } from '@/ai/tools/reviewTools';

const store = { comments: [] };
const replyComment$ = vi.fn((id, reply) => {
  store.comments = store.comments.map((c) => (c.id === id ? { ...c, replies: [...(c.replies || []), reply] } : c));
});
const resolveComment$ = vi.fn((id) => {
  store.comments = store.comments.map((c) => (c.id === id ? { ...c, resolved: true } : c));
});
vi.mock('@/store', () => ({
  useDocumentStore: { getState: () => ({ comments: store.comments, replyComment: replyComment$, resolveComment: resolveComment$ }) },
}));

// Destroyed after each test so ProseMirror's DOM observer cannot fire after teardown.
const editors = [];
const setup = (html) => {
  const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, CommentAnchor, Insertion, Deletion], content: html });
  editors.push(editor);
  return { editor, ctx: { editor, refs: new BlockRefs(editor) } };
};

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

beforeEach(() => {
  store.comments = [];
  replyComment$.mockClear();
  resolveComment$.mockClear();
});

describe('comment tools', () => {
  it('lists open comments with the anchored block and quote', () => {
    const { ctx } = setup('<p>intro</p><p>check <span data-comment-id="c1">this claim</span> now</p>');
    store.comments = [
      { id: 'c1', text: 'Source?', author: 'You', resolved: false },
      { id: 'c2', text: 'General note', author: 'Ana', resolved: false },
      { id: 'c3', text: 'Old', author: 'You', resolved: true },
    ];
    const r = listComments({}, ctx);
    expect(r.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(r.comments[0]).toMatchObject({ text: 'Source?', author: 'You', quote: 'this claim' });
    expect(r.comments[0].block_id).toMatch(/^b\d+$/);
    expect(r.comments[1].block_id).toBeUndefined();
    expect(listComments({ include_resolved: true }, ctx).comments).toHaveLength(3);
  });

  it('replies as Pragna and resolves', () => {
    const { ctx } = setup('<p>x</p>');
    store.comments = [{ id: 'c1', text: 'Fix?', author: 'You', resolved: false }];
    expect(replyComment({ comment_id: 'c1', text: 'Done.' }, ctx).ok).toBe(true);
    expect(replyComment$).toHaveBeenCalledWith('c1', expect.objectContaining({ author: 'Pragna', text: 'Done.' }));
    expect(resolveComment({ comment_id: 'c1' }, ctx).ok).toBe(true);
    expect(resolveComment$).toHaveBeenCalledWith('c1');
    expect(replyComment({ comment_id: 'nope', text: 'x' }, ctx).error).toBeTruthy();
    expect(replyComment({ comment_id: 'c1', text: '' }, ctx).error).toBeTruthy();
  });
});

describe('tracked change tools', () => {
  const html = '<p>keep <span data-mark="insertion">added</span> and <span data-mark="deletion">removed</span> text</p><p>more <span data-mark="insertion">added</span></p>';

  it('lists tracked changes with ids, type, text and block', () => {
    const { ctx } = setup(html);
    const r = listChanges({}, ctx);
    expect(r.changes.map(({ id, type, text }) => [id, type, text])).toEqual([
      ['tc1', 'insertion', 'added'], ['tc2', 'deletion', 'removed'], ['tc3', 'insertion', 'added'],
    ]);
    expect(r.changes[0].block_id).not.toBe(r.changes[2].block_id);
  });

  it('accepts an insertion and rejects a deletion', () => {
    const { editor, ctx } = setup(html);
    listChanges({}, ctx);
    expect(resolveChange({ change_id: 'tc1', accept: true }, ctx).ok).toBe(true);
    expect(resolveChange({ change_id: 'tc2', accept: false }, ctx).ok).toBe(true);
    expect(editor.state.doc.textContent).toBe('keep added and removed textmore added');
    expect(editor.getHTML()).not.toMatch(/data-mark="(insertion|deletion)">(added|removed)<\/span> and/);
  });

  it('resolves the right change after earlier edits shift positions', () => {
    const { editor, ctx } = setup(html);
    listChanges({}, ctx);
    resolveChange({ change_id: 'tc1', accept: false }, ctx); // removes the first "added"
    expect(resolveChange({ change_id: 'tc3', accept: false }, ctx).ok).toBe(true);
    expect(editor.state.doc.textContent).toBe('keep  and removed textmore ');
  });

  it('accepts all changes', () => {
    const { editor, ctx } = setup(html);
    expect(resolveChange({ change_id: 'all', accept: true }, ctx)).toMatchObject({ ok: true, resolved: 3 });
    expect(editor.state.doc.textContent).toBe('keep added and  textmore added');
    expect(listChanges({}, ctx).changes).toEqual([]);
  });

  it('rejects unknown ids', () => {
    const { ctx } = setup(html);
    expect(resolveChange({ change_id: 'tc9', accept: true }, ctx).error).toBeTruthy();
  });
});
