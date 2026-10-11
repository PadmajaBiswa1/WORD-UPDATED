import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { applyTextDiff, blockText, listSuggestionIds } from '@/ai/suggestions';

function firstBlock(editor) {
  let found = null;
  editor.state.doc.descendants((node, pos) => {
    if (!found && node.isTextblock) found = { node, pos };
    return !found;
  });
  return found;
}

function suggest(editor, newText) {
  const { node, pos } = firstBlock(editor);
  const { tr } = editor.state;
  applyTextDiff(tr, { from: pos + 1, oldText: node.textContent, newText, id: 's1', author: 'Pragna' });
  editor.view.dispatch(tr);
}

describe('suggestions', () => {
  it('marks a rewrite as insert/delete without losing bold', () => {
    const editor = createTestEditor('<p><strong>teh</strong> quick fox</p>');
    suggest(editor, 'the quick fox');
    const html = editor.getHTML();
    expect(html).toContain('<del data-suggestion="s1"');
    expect(html).toContain('<ins data-suggestion="s1"');
    expect(html).toMatch(/<strong><ins[^>]*>the<\/ins><\/strong>|<ins[^>]*><strong>the<\/strong><\/ins>/);
    expect(listSuggestionIds(editor.state.doc)).toEqual(['s1']);
  });

  it('reads accepted and original views', () => {
    const editor = createTestEditor('<p>teh quick fox</p>');
    suggest(editor, 'the quick fox');
    const { node, pos } = firstBlock(editor);
    expect(blockText(node, pos + 1, 'accepted').text).toBe('the quick fox');
    expect(blockText(node, pos + 1, 'original').text).toBe('teh quick fox');
  });

  it('accepts and rejects', () => {
    const a = createTestEditor('<p>teh quick fox</p>');
    suggest(a, 'the quick fox');
    a.commands.acceptAllSuggestions();
    expect(a.getHTML()).toBe('<p>the quick fox</p>');

    const r = createTestEditor('<p>teh quick fox</p>');
    suggest(r, 'the quick fox');
    r.commands.rejectSuggestion('s1');
    expect(r.getHTML()).toBe('<p>teh quick fox</p>');
  });

  it('removes a whole paragraph when its deletion is accepted', () => {
    const editor = createTestEditor('<p>keep</p><p>drop me</p>');
    const { tr } = editor.state;
    const mark = editor.schema.marks.suggestDelete.create({ id: 'd1', author: 'Pragna', createdAt: '' });
    tr.addMark(7, 14, mark); // content of the second paragraph
    editor.view.dispatch(tr);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>keep</p>');
  });

  it('removes an inserted paragraph when rejected', () => {
    const editor = createTestEditor('<p>keep</p><p>new one</p>');
    const { tr } = editor.state;
    tr.addMark(7, 14, editor.schema.marks.suggestInsert.create({ id: 'i1', author: 'Pragna', createdAt: '' }));
    editor.view.dispatch(tr);
    editor.commands.rejectAllSuggestions();
    expect(editor.getHTML()).toBe('<p>keep</p>');
  });

  it('round-trips through HTML', () => {
    const editor = createTestEditor('<p>teh quick fox</p>');
    suggest(editor, 'the quick fox');
    const reloaded = createTestEditor(editor.getHTML());
    expect(listSuggestionIds(reloaded.state.doc)).toEqual(['s1']);
  });
});
