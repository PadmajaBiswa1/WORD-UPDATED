import { describe, it, expect } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { resolveSuggestions } from '@/ai/suggestions';
import { insertAtCursor, updatePlan, trackCursor } from '@/ai/tools/cursorTools';

const setup = (html, from, to = from) => {
  const editor = createTestEditor(html);
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)));
  const ctx = { editor, refs: new BlockRefs(editor) };
  const stop = trackCursor(ctx);
  return { editor, ctx, stop };
};
const acceptAll = (editor) => {
  const { tr } = editor.state;
  resolveSuggestions(tr, 'accept');
  editor.view.dispatch(tr);
};

describe('insert_at_cursor', () => {
  it('inserts inline text at the cursor as a suggestion', () => {
    const { editor, ctx } = setup('<p>Hello world</p>', 7); // before "world"
    expect(insertAtCursor({ text: 'big ' }, ctx).ok).toBe(true);
    acceptAll(editor);
    expect(editor.state.doc.textContent).toBe('Hello big world');
  });

  it('replaces the selection when asked', () => {
    const { editor, ctx } = setup('<p>Hello world</p>', 7, 12); // "world"
    expect(insertAtCursor({ text: 'there', replace_selection: true }, ctx).ok).toBe(true);
    acceptAll(editor);
    expect(editor.state.doc.textContent).toBe('Hello there');
  });

  it('inserts multi-block markdown after the cursor block', () => {
    const { editor, ctx } = setup('<p>first</p><p>last</p>', 3);
    expect(insertAtCursor({ text: '## New section\n\nBody text.' }, ctx).ok).toBe(true);
    acceptAll(editor);
    expect(editor.getHTML()).toBe('<p>first</p><h2>New section</h2><p>Body text.</p><p>last</p>');
  });

  it('keeps the original cursor even after other edits move the selection', () => {
    const { editor, ctx } = setup('<p>aa</p><p>bb</p>', 6); // between the b's
    editor.chain().setTextSelection(1).insertContent('X').run(); // selection now in block 1
    expect(insertAtCursor({ text: '!' }, ctx).ok).toBe(true);
    acceptAll(editor);
    expect(editor.state.doc.textContent).toBe('Xaab!b');
  });

  it('stops tracking after the run', () => {
    const { ctx, stop } = setup('<p>a</p>', 1);
    stop();
    expect(insertAtCursor({ text: 'x' }, ctx).ok).toBe(true);
  });
});

describe('update_plan', () => {
  it('stores a validated plan on the context', () => {
    const ctx = {};
    const r = updatePlan({ steps: [{ text: 'Read', status: 'done' }, { text: 'Edit', status: 'active' }, { text: 'Review' }] }, ctx);
    expect(r.ok).toBe(true);
    expect(ctx.plan).toEqual([
      { text: 'Read', status: 'done' }, { text: 'Edit', status: 'active' }, { text: 'Review', status: 'pending' },
    ]);
    expect(updatePlan({ steps: [] }, ctx).error).toBeTruthy();
    expect(updatePlan({ steps: [{ text: '' }] }, ctx).error).toBeTruthy();
  });
});
