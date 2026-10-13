import { describe, it, expect } from 'vitest';
import { Editor, Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { getTrackedChanges, resolveTrackedChange } from '../trackedChanges';

const mark = (name, tag) => Mark.create({ name, priority: 1000, parseHTML: () => [{ tag }], renderHTML: () => [tag, {}, 0] });
function editorFor(html) {
  return new Editor({ element: document.createElement('div'), extensions: [StarterKit, mark('insertion', 'ins'), mark('deletion', 'del')], content: html });
}

describe('tracked review actions', () => {
  for (const [accept, type, expected] of [[true, 'ins', 'keep new'], [false, 'ins', 'keep '], [true, 'del', 'keep '], [false, 'del', 'keep new']]) {
    it(`${accept ? 'accepts' : 'rejects'} ${type} using an undoable transaction`, () => {
      const editor = editorFor(`<p>keep <${type}><strong>new</strong></${type}></p>`);
      expect(resolveTrackedChange(editor, accept)).toBe(true);
      expect(editor.getText()).toBe(expected);
      expect(getTrackedChanges(editor)).toHaveLength(0);
      if (expected.includes('new')) expect(editor.getHTML()).toContain('<strong>new</strong>');
      editor.commands.undo();
      expect(getTrackedChanges(editor)).toHaveLength(1);
      editor.destroy();
    });
  }
  it('resolves the change under selection and keeps other edits', () => {
    const editor = editorFor('<p><ins>first</ins> gap <ins>second</ins></p>');
    const second = getTrackedChanges(editor)[1];
    editor.commands.setTextSelection({ from: second.from, to: second.to });
    expect(resolveTrackedChange(editor, false)).toBe(true);
    expect(editor.getText()).toBe('first gap ');
    expect(getTrackedChanges(editor)).toHaveLength(1);
    editor.destroy();
  });
});
