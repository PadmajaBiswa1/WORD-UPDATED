import { describe, it, expect, afterEach } from 'vitest';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { patchBlockStyle, pxValue } from '@/utils/paragraphStyle';

// The app keeps block styles in a global `style` attribute (useEditorSetup's blockStyle).
const BlockStyle = Extension.create({
  name: 'blockStyle',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading'],
    attributes: { style: { default: null, parseHTML: (el) => el.getAttribute('style'), renderHTML: (a) => (a.style ? { style: a.style } : {}) } },
  }],
});

const editors = [];
const setup = (html) => {
  const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, BlockStyle], content: html });
  editors.push(editor);
  return editor;
};
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

describe('patchBlockStyle', () => {
  it('changes one property and keeps the others', () => {
    const editor = setup('<p style="line-height:1.5">one</p>');
    editor.commands.setTextSelection(2);
    patchBlockStyle(editor, (css) => { css['margin-left'] = `${pxValue(css['margin-left']) + 40}px`; });
    patchBlockStyle(editor, (css) => { css['background-color'] = '#ffff00'; });
    expect(editor.state.doc.child(0).attrs.style).toBe('line-height:1.5;margin-left:40px;background-color:#ffff00');
  });

  it('edits each selected block from its own style', () => {
    const editor = setup('<p style="margin-left:40px">a</p><h2>b</h2>');
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
    patchBlockStyle(editor, (css) => { css['margin-left'] = `${pxValue(css['margin-left']) + 40}px`; });
    expect([0, 1].map((i) => editor.state.doc.child(i).attrs.style)).toEqual(['margin-left:80px', 'margin-left:40px']);
  });

  it('clears the attribute when no properties remain', () => {
    const editor = setup('<p style="margin-left:40px">a</p>');
    editor.commands.setTextSelection(2);
    patchBlockStyle(editor, (css) => { delete css['margin-left']; });
    expect(editor.state.doc.child(0).attrs.style).toBeNull();
  });
});
