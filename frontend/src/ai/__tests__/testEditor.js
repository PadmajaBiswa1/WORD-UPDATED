import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { SuggestInsert, SuggestDelete, CommentAnchor, Suggestions } from '@/ai/suggestions';

export function createTestEditor(html) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      SuggestInsert, SuggestDelete, CommentAnchor, Suggestions,
    ],
    content: html,
  });
}
