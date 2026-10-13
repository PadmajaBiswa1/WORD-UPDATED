import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { SuggestInsert, SuggestDelete, CommentAnchor, Suggestions, resolveSuggestions } from '@/ai/suggestions';
import { BlockRefs } from '@/ai/blockRefs';
import { getOutline } from '@/ai/tools/readTools';
import {
  replaceAll, setList, insertPageBreak, insertToc, addFootnote, setLink, insertImage, setHeaderFooter,
} from '@/ai/tools/documentTools';

const setHeaderFooter$ = vi.fn();
vi.mock('@/store', () => ({
  useDocumentStore: { getState: () => ({ headerFooter: { headerText: '', footerText: 'old' }, setHeaderFooter: setHeaderFooter$ }) },
}));

// Stand-in for the app's PageBreak node (the real one pulls in page layout and stores).
const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true,
  addAttributes: () => ({ auto: { default: false } }),
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': '' }],
});

const setup = (html) => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Link, Image, PageBreak, SuggestInsert, SuggestDelete, CommentAnchor, Suggestions],
    content: html,
  });
  const ctx = { editor, refs: new BlockRefs(editor) };
  return { editor, ctx, ids: getOutline({}, ctx).blocks.map((b) => b.id) };
};
const acceptAll = (editor) => {
  const { tr } = editor.state;
  resolveSuggestions(tr, 'accept');
  editor.view.dispatch(tr);
};

beforeEach(() => setHeaderFooter$.mockClear());

describe('replace_all', () => {
  it('replaces every occurrence across blocks as one suggestion', () => {
    const { editor, ctx } = setup('<p>Acme sells. Acme ships.</p><h2>About Acme</h2><p>none here</p>');
    const r = replaceAll({ find: 'Acme', replace: 'Globex' }, ctx);
    expect(r).toMatchObject({ ok: true, replaced: 3, blocks: 2 });
    acceptAll(editor);
    expect(editor.state.doc.textContent).toBe('Globex sells. Globex ships.About Globexnone here');
  });

  it('matches case-insensitively when asked and reports no matches', () => {
    const { editor, ctx } = setup('<p>acme and ACME</p>');
    expect(replaceAll({ find: 'Acme', replace: 'X' }, ctx).error).toMatch(/not found/);
    expect(replaceAll({ find: 'Acme', replace: 'X', match_case: false }, ctx).replaced).toBe(2);
    acceptAll(editor);
    expect(editor.state.doc.textContent).toBe('X and X');
  });
});

describe('structure tools', () => {
  it('turns blocks into a bullet list and back', () => {
    const { editor, ctx, ids } = setup('<p>one</p><p>two</p><p>three</p>');
    expect(setList({ ids: [ids[0], ids[1]], kind: 'bullet' }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toBe('<ul><li><p>one</p></li><li><p>two</p></li></ul><p>three</p>');
    expect(setList({ ids: [ids[0]], kind: 'ordered' }, ctx)).toEqual({ ok: true });
    expect(editor.getHTML()).toMatch(/^<ol>/);
    expect(setList({ ids: [ids[0], ids[1]], kind: 'none' }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toBe('<p>one</p><p>two</p><p>three</p>');
  });

  it('inserts a page break after a block', () => {
    const { editor, ctx, ids } = setup('<p>a</p><p>b</p>');
    expect(insertPageBreak({ after_id: ids[0] }, ctx).ok).toBe(true);
    expect(editor.state.doc.child(1).type.name).toBe('pageBreak');
  });

  it('inserts a table of contents from the headings', () => {
    const { editor, ctx, ids } = setup('<p>intro</p><h1>Start</h1><h2>Detail</h2>');
    expect(insertToc({ after_id: ids[0] }, ctx).ok).toBe(true);
    acceptAll(editor);
    expect(editor.state.doc.textContent).toBe('introTable of ContentsStartDetailStartDetail');
    expect(editor.state.doc.child(2).type.name).toBe('bulletList');
    expect(insertToc({ after_id: ids[0] }, setup('<p>none</p>').ctx).error).toMatch(/headings/);
  });

  it('adds a numbered footnote reference and note', () => {
    const { editor, ctx, ids } = setup('<p>A claim here.</p><p>End.</p>');
    expect(addFootnote({ block_id: ids[0], find: 'claim', text: 'Source: 2024 report.' }, ctx)).toMatchObject({ ok: true, number: 1 });
    acceptAll(editor);
    expect(editor.getText({ blockSeparator: '|' })).toBe('A claim[1] here.|End.|[1] Footnote: Source: 2024 report.');
    expect(addFootnote({ block_id: ids[1], text: 'Second.' }, ctx).number).toBe(2);
  });

  it('links a phrase and refuses unsafe urls', () => {
    const { editor, ctx, ids } = setup('<p>see our site</p>');
    expect(setLink({ block_id: ids[0], find: 'our site', url: 'https://example.com' }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toContain('href="https://example.com"');
    expect(setLink({ block_id: ids[0], find: 'see', url: 'javascript:alert(1)' }, ctx).error).toMatch(/url/);
  });

  it('inserts an image after a block', () => {
    const { editor, ctx, ids } = setup('<p>a</p>');
    expect(insertImage({ after_id: ids[0], url: 'https://example.com/x.png', alt: 'Chart' }, ctx).ok).toBe(true);
    expect(editor.getHTML()).toContain('<img src="https://example.com/x.png" alt="Chart">');
    expect(insertImage({ after_id: ids[0], url: 'file:///etc/passwd' }, ctx).error).toMatch(/url/);
  });

  it('sets header and footer text, leaving omitted fields alone', () => {
    const { ctx } = setup('<p>a</p>');
    expect(setHeaderFooter({ header: 'Quarterly Report', page_numbers: true }, ctx).ok).toBe(true);
    expect(setHeaderFooter$).toHaveBeenCalledWith({ headerText: 'Quarterly Report', pageNumberEnabled: true });
    expect(setHeaderFooter({}, ctx).error).toBeTruthy();
  });
});
