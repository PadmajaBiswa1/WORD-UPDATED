import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { getOutline, readBlocks, findText, readTable } from '@/ai/tools/readTools';
import { replaceText, rewriteBlock, insertBlocks, deleteBlocks, setTableCell } from '@/ai/tools/editTools';

const setup = (html) => {
  const editor = createTestEditor(html);
  return { editor, ctx: { editor, refs: new BlockRefs(editor) } };
};
const idOf = (outline, start) => outline.blocks.find((b) => b.text.startsWith(start)).id;

describe('read tools', () => {
  it('outlines blocks with ids and pages', () => {
    const { ctx } = setup('<h2>Intro</h2><p>Hello world</p>');
    const out = getOutline({}, ctx);
    expect(out.blocks.map((b) => [b.type, b.text])).toEqual([['heading2', 'Intro'], ['paragraph', 'Hello world']]);
    expect(out.next_page).toBeNull();
  });

  it('finds text and reads blocks', () => {
    const { ctx } = setup('<p>alpha beta</p><p>gamma</p>');
    const hits = findText({ query: 'GAMMA' }, ctx);
    expect(hits.matches).toHaveLength(1);
    expect(readBlocks({ ids: [hits.matches[0].block_id] }, ctx).blocks[0].text).toBe('gamma');
  });

  it('reads a table with cell ids', () => {
    const { ctx } = setup('<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    const outline = getOutline({}, ctx);
    const t = outline.blocks.find((b) => b.type === 'table');
    const table = readTable({ table_id: t.id }, ctx);
    expect(table.rows[0]).toEqual([{ cell_id: `${t.id}.r0c0`, text: 'a' }, { cell_id: `${t.id}.r0c1`, text: 'b' }]);
  });

  it('reports unknown ids as errors', () => {
    const { ctx } = setup('<p>x</p>');
    expect(readBlocks({ ids: ['b99'] }, ctx).blocks[0].error).toMatch(/unknown/);
  });
});

describe('edit tools', () => {
  it('replace_text makes a word-level suggestion', () => {
    const { editor, ctx } = setup('<p>MongoDB store data</p>');
    const id = idOf(getOutline({}, ctx), 'MongoDB');
    const r = replaceText({ block_id: id, find: 'store', replace: 'stores' }, ctx);
    expect(r.ok).toBe(true);
    expect(editor.getHTML()).toContain('<del data-suggestion=');
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>MongoDB stores data</p>');
  });

  it('rewrite twice keeps one original-to-final diff', () => {
    const { editor, ctx } = setup('<p>teh quick fox</p>');
    const id = idOf(getOutline({}, ctx), 'teh');
    rewriteBlock({ block_id: id, text: 'the quick fox' }, ctx);
    rewriteBlock({ block_id: id, text: 'the quick brown fox' }, ctx);
    expect(readBlocks({ ids: [id] }, ctx).blocks[0].text).toBe('the quick brown fox');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>teh quick fox</p>');
  });

  it('rewrites a block Pragna inserted without touching its neighbours', () => {
    const { editor, ctx } = setup('<p>first</p><p>last</p>');
    insertBlocks({ after_id: idOf(getOutline({}, ctx), 'first'), markdown: 'draft line' }, ctx);
    const inserted = idOf(getOutline({}, ctx), 'draft');
    rewriteBlock({ block_id: inserted, text: 'final line' }, ctx);
    expect(editor.getText()).toContain('final line');
    expect(editor.getText()).toContain('last');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>first</p><p>last</p>');
  });

  it('replace_text reports a missing phrase', () => {
    const { ctx } = setup('<p>abc</p>');
    const id = idOf(getOutline({}, ctx), 'abc');
    expect(replaceText({ block_id: id, find: 'zzz', replace: 'y' }, ctx).error).toMatch(/not found/);
  });

  it('insert_blocks inserts suggested paragraphs after a block; reject removes them', () => {
    const { editor, ctx } = setup('<p>first</p><p>last</p>');
    const id = idOf(getOutline({}, ctx), 'first');
    insertBlocks({ after_id: id, markdown: 'new **bold** line' }, ctx);
    expect(editor.getText()).toContain('new bold line');
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>first</p><p>last</p>');
  });

  it('delete_blocks marks then accept removes', () => {
    const { editor, ctx } = setup('<p>keep</p><p>drop</p>');
    const id = idOf(getOutline({}, ctx), 'drop');
    deleteBlocks({ ids: [id] }, ctx);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>keep</p>');
  });

  it('set_table_cell rewrites one cell', () => {
    const { editor, ctx } = setup('<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    const t = getOutline({}, ctx).blocks.find((b) => b.type === 'table');
    setTableCell({ cell_id: `${t.id}.r0c1`, text: 'B2' }, ctx);
    editor.commands.acceptAllSuggestions();
    expect(editor.getText()).toContain('B2');
  });
});

describe('tool safety', () => {
  it('returns { error } instead of throwing', () => {
    expect(getOutline({}, {}).error).toMatch(/failed/);
    expect(replaceText({ block_id: 'b1', find: 'a' }, {}).error).toBeTruthy();
    expect(setTableCell({ cell_id: 'zz', text: 'x' }, setup('<p>x</p>').ctx).error).toBeTruthy();
  });
});
