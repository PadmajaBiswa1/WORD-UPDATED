import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Superscript from '@tiptap/extension-superscript';
import { insertNote } from '@/utils/notes';

const editors = [];
const setup = (html) => {
  const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, Superscript], content: html });
  editors.push(editor);
  return editor;
};
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

describe('insertNote', () => {
  it('marks the end of the selection without deleting it and adds the note at the end', () => {
    const editor = setup('<p>Alpha beta gamma</p><p>Second</p>');
    editor.commands.setTextSelection({ from: 7, to: 11 }); // "beta"
    insertNote(editor, 'footnote');
    expect(editor.getHTML()).toBe('<p>Alpha beta<sup>[1]</sup> gamma</p><p>Second</p><p>[1] Footnote: </p>');
    // The cursor waits in the note, outside the superscript.
    editor.commands.insertContent('Source');
    expect(editor.getHTML()).toContain('<p>[1] Footnote: Source</p>');
  });

  it('numbers footnotes and letters endnotes separately', () => {
    const editor = setup('<p>One two</p>');
    editor.commands.setTextSelection(4);
    insertNote(editor, 'footnote');
    editor.commands.setTextSelection(8);
    insertNote(editor, 'footnote');
    editor.commands.setTextSelection(2);
    insertNote(editor, 'endnote');
    const text = editor.getText({ blockSeparator: '\n' });
    expect(text).toContain('[1] Footnote:');
    expect(text).toContain('[2] Footnote:');
    expect(text).toContain('[a] Endnote:');
  });
});
