import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { applyCase, nextCase, selectionText } from '@/utils/textCase';

const editors = [];
const setup = (html) => {
  const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit], content: html });
  editors.push(editor);
  return editor;
};
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));
const selectAll = (editor) => editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });

describe('applyCase', () => {
  it('keeps marks and paragraphs', () => {
    const editor = setup('<p>hello <strong>bold</strong> world</p><p>second line</p>');
    selectAll(editor);
    applyCase(editor, 'upper');
    expect(editor.getHTML()).toBe('<p>HELLO <strong>BOLD</strong> WORLD</p><p>SECOND LINE</p>');
  });

  it('title-cases words that span marks', () => {
    const editor = setup('<p>he<em>llo</em> big world</p>');
    selectAll(editor);
    applyCase(editor, 'title');
    expect(editor.getHTML()).toBe('<p>He<em>llo</em> Big World</p>');
  });

  it('keeps the selection so the cycle can continue', () => {
    const editor = setup('<p>abc def</p>');
    selectAll(editor);
    applyCase(editor, nextCase(selectionText(editor)));
    expect(editor.getText()).toBe('Abc Def');
    applyCase(editor, nextCase(selectionText(editor)));
    expect(editor.getText()).toBe('ABC DEF');
    applyCase(editor, nextCase(selectionText(editor)));
    expect(editor.getText()).toBe('abc def');
  });
});
