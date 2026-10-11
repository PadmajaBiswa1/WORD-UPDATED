import { describe, it, expect, vi } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { getOutline } from '@/ai/tools/readTools';
import { formatText, setBlockStyle, tableAddRow, insertTable, addComment } from '@/ai/tools/structureTools';

const addCommentSpy = vi.fn();
vi.mock('@/store', () => ({ useDocumentStore: { getState: () => ({ addComment: addCommentSpy }) } }));

const setup = (html) => {
  const editor = createTestEditor(html);
  const ctx = { editor, refs: new BlockRefs(editor) };
  return { editor, ctx, outline: getOutline({}, ctx) };
};

describe('structure tools', () => {
  it('bolds a phrase', () => {
    const { editor, ctx, outline } = setup('<p>make this bold</p>');
    expect(formatText({ block_id: outline.blocks[0].id, find: 'this', bold: true }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toBe('<p>make <strong>this</strong> bold</p>');
  });

  it('turns a paragraph into a centered heading', () => {
    const { editor, ctx, outline } = setup('<p>Title</p>');
    setBlockStyle({ ids: [outline.blocks[0].id], style: 'h2', align: 'center' }, ctx);
    expect(editor.getHTML()).toBe('<h2 style="text-align: center;">Title</h2>');
  });

  it('adds a table row', () => {
    const { editor, ctx, outline } = setup('<table><tbody><tr><td><p>a</p></td></tr></tbody></table>');
    tableAddRow({ table_id: outline.blocks[0].id, index: 0 }, ctx);
    expect(editor.state.doc.firstChild.childCount).toBe(2);
  });

  it('inserts a table after a block', () => {
    const { editor, ctx, outline } = setup('<p>before</p>');
    insertTable({ after_id: outline.blocks[0].id, rows: [['Sl', 'Q'], ['1', 'What?']] }, ctx);
    expect(editor.getHTML()).toContain('<table');
    expect(editor.getText()).toContain('What?');
  });

  it('anchors a comment on a phrase', () => {
    const { editor, ctx, outline } = setup('<p>check this claim</p>');
    const r = addComment({ block_id: outline.blocks[0].id, find: 'this claim', text: 'Source?' }, ctx);
    expect(r.ok).toBe(true);
    expect(editor.getHTML()).toContain(`data-comment-id="${r.comment_id}"`);
    expect(addCommentSpy).toHaveBeenCalledWith(expect.objectContaining({ id: r.comment_id, text: 'Source?', author: 'Pragna', anchor: r.comment_id }));
  });
});
