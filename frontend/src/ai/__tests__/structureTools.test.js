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

  it('gives two comments made in the same millisecond distinct ids', () => {
    const { ctx, outline } = setup('<p>first claim and second claim</p>');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const a = addComment({ block_id: outline.blocks[0].id, find: 'first claim', text: 'One' }, ctx);
      const b = addComment({ block_id: outline.blocks[0].id, find: 'second claim', text: 'Two' }, ctx);
      expect(a.ok && b.ok).toBe(true);
      expect(a.comment_id).not.toBe(b.comment_id);
    } finally {
      now.mockRestore();
    }
  });
});

describe('format_text font and colour', () => {
  it('sets a font family on a phrase', () => {
    const { editor, ctx, outline } = setup('<p>make this serif</p>');
    expect(formatText({ block_id: outline.blocks[0].id, find: 'this', font_family: 'Georgia' }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toBe('<p>make <span style="font-family: Georgia;">this</span> serif</p>');
  });

  it('applies to the whole document with block_id "all"', () => {
    const { editor, ctx } = setup('<p>one</p><p>two</p>');
    expect(formatText({ block_id: 'all', font_family: 'Georgia' }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toBe('<p><span style="font-family: Georgia;">one</span></p><p><span style="font-family: Georgia;">two</span></p>');
  });

  it('keeps an existing colour when adding a font', () => {
    const { editor, ctx, outline } = setup('<p><span style="color: #c00000;">red</span></p>');
    formatText({ block_id: outline.blocks[0].id, font_family: 'Georgia' }, ctx);
    expect(editor.getHTML()).toBe('<p><span style="font-family: Georgia; color: rgb(192, 0, 0);">red</span></p>');
  });

  it('reports a request that changes nothing', () => {
    const { ctx, outline } = setup('<p>text</p>');
    expect(formatText({ block_id: outline.blocks[0].id }, ctx).error).toMatch(/nothing to change/);
  });
});
