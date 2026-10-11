import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { executeTool } from '@/ai/tools';

const posOfText = (editor, text) => {
  let found = null;
  editor.state.doc.descendants((node, pos) => {
    if (found === null && node.isTextblock && node.textContent === text) found = pos;
  });
  return found;
};

describe('BlockRefs', () => {
  it('keeps ids pointing at the same block after edits above it', () => {
    const editor = createTestEditor('<p>one</p><p>two</p>');
    const refs = new BlockRefs(editor);
    const id = refs.idFor(posOfText(editor, 'two'), editor.state.doc.nodeAt(posOfText(editor, 'two')));
    editor.commands.insertContentAt(0, '<p>inserted</p><p>more</p>');
    expect(refs.resolve(id).node.textContent).toBe('two');
    refs.detach();
  });

  it('returns the same id for the same block', () => {
    const editor = createTestEditor('<p>one</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'one');
    expect(refs.idFor(pos, editor.state.doc.nodeAt(pos))).toBe(refs.idFor(pos, editor.state.doc.nodeAt(pos)));
  });

  it('returns null for a deleted block', () => {
    const editor = createTestEditor('<p>one</p><p>two</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'two');
    const id = refs.idFor(pos, editor.state.doc.nodeAt(pos));
    editor.commands.deleteRange({ from: pos, to: pos + editor.state.doc.nodeAt(pos).nodeSize });
    expect(refs.resolve(id)).toBeNull();
  });

  it('resolves table cells', () => {
    const editor = createTestEditor('<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    const refs = new BlockRefs(editor);
    let tablePos = null;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'table' && tablePos === null) tablePos = pos; });
    const tid = refs.tableIdFor(tablePos);
    expect(refs.resolveCell(`${tid}.r0c1`).node.textContent).toBe('b');
    expect(refs.resolveCell(`${tid}.r5c0`)).toBeNull();
  });

  it('keeps the original text when Enter is pressed at the start of the block', () => {
    const editor = createTestEditor('<p>one</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'one');
    const id = refs.idFor(pos, editor.state.doc.nodeAt(pos));
    editor.chain().setTextSelection(pos + 1).splitBlock().run();
    expect(refs.resolve(id).node.textContent).toBe('one');
    refs.detach();
  });

  it('keeps the original text when Enter is pressed at the end of the block', () => {
    const editor = createTestEditor('<p>one</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'one');
    const id = refs.idFor(pos, editor.state.doc.nodeAt(pos));
    editor.chain().setTextSelection(pos + 1 + 'one'.length).splitBlock().run();
    expect(refs.resolve(id).node.textContent).toBe('one');
    refs.detach();
  });

  it('resolves to the same block after typing at its start', () => {
    const editor = createTestEditor('<p>one</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'one');
    const id = refs.idFor(pos, editor.state.doc.nodeAt(pos));
    editor.commands.insertContentAt(pos + 1, 'X');
    const resolved = refs.resolve(id);
    expect(resolved.node.textContent).toBe('Xone');
    expect(resolved.node.isTextblock).toBe(true);
    refs.detach();
  });

  it('keeps the id alive when the block is toggled to a heading', () => {
    const editor = createTestEditor('<p>one</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'one');
    const id = refs.idFor(pos, editor.state.doc.nodeAt(pos));
    editor.chain().setTextSelection(pos + 1).setNode('heading', { level: 2 }).run();
    const resolved = refs.resolve(id);
    expect(resolved).not.toBeNull();
    expect(resolved.node.type.name).toBe('heading');
    expect(resolved.node.textContent).toBe('one');
    refs.detach();
  });

  it('returns null when the block is merged into the previous one by backspace', () => {
    const editor = createTestEditor('<p>two</p><p>one</p>');
    const refs = new BlockRefs(editor);
    const pos = posOfText(editor, 'one');
    const id = refs.idFor(pos, editor.state.doc.nodeAt(pos));
    editor.commands.deleteRange({ from: pos - 1, to: pos + 1 });
    expect(refs.resolve(id)).toBeNull();
    refs.detach();
  });

  it('keeps the id on the first half after a mid-block split and gives the second half its own id', () => {
    const editor = createTestEditor('<p>ab cdefghijklmnop</p>');
    const refs = new BlockRefs(editor);
    const ctx = { editor, refs };
    const b1 = executeTool('get_outline', {}, ctx).blocks[0].id;
    // Enter after "ab": the second half is the longer one.
    editor.chain().setTextSelection(1 + 'ab'.length).splitBlock().run();
    const blocks = executeTool('get_outline', {}, ctx).blocks;
    expect(blocks).toHaveLength(2);
    const [first, second] = blocks;
    expect(first.id).toBe(b1);
    expect(second.id).not.toBe(b1);
    expect(refs.resolve(first.id).node.textContent).toBe('ab');
    expect(refs.resolve(second.id).node.textContent).toBe(' cdefghijklmnop');
    expect(executeTool('rewrite_block', { block_id: b1, text: 'AB' }, ctx).ok).toBe(true);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>AB</p><p> cdefghijklmnop</p>');
    refs.detach();
  });

  it('does not reuse the id for an empty first half after Enter at the block start', () => {
    const editor = createTestEditor('<p>one</p>');
    const refs = new BlockRefs(editor);
    const ctx = { editor, refs };
    const b1 = executeTool('get_outline', {}, ctx).blocks[0].id;
    editor.chain().setTextSelection(1).splitBlock().run();
    const [first, second] = executeTool('get_outline', {}, ctx).blocks;
    expect(first.id).not.toBe(b1);
    expect(refs.resolve(first.id).node.textContent).toBe('');
    expect(refs.resolve(second.id).node.textContent).toBe('one');
    expect(refs.resolve(b1).node.textContent).toBe('one');
    refs.detach();
  });
});
