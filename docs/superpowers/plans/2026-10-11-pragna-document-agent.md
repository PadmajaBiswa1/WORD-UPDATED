# Pragna Document Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pragna edit the open document like Claude in Microsoft Word: it reads the document through tools, makes targeted edits that appear as accept/reject suggestions, formats text, works on tables and leaves anchored comments.

**Architecture:** The agent loop runs in the browser (`useDocumentAgent`) against the live Tiptap editor; the backend exposes one stateless endpoint, `POST /api/ai/agent-step`, that sends the conversation and tool schemas to the existing Ollama models and returns text or tool calls. Text edits become `suggestInsert` / `suggestDelete` marks produced by a word-level diff; block ids are run-scoped and mapped through every transaction.

**Tech Stack:** React 18, Tiptap 2.27.3 / ProseMirror, Express, Ollama OpenAI-compatible `/chat/completions` (`gemma4:31b`, `gpt-oss:*`, `nemotron-3-nano:30b`), `docx` 8.5.0, Vitest + jsdom (new, dev-only), `node --test` (backend).

**Spec:** `docs/superpowers/specs/2026-10-11-pragna-document-agent-design.md`

## Global Constraints

- Models: keep the existing Ollama models; no new AI provider. Tool requests skip the Gemini path.
- Loop limits: 15 model steps per run; ≤ 40 blocks per read; outline pages of 60 entries; 60 s per model step (existing axios timeout).
- `/api/ai/agent-step` gated by `requireFeature('aiWritingTools')`, like `/api/ai/chat`.
- Block ids, suggestion state and run records are never written into saved HTML except the suggestion/comment marks themselves.
- Suggestion marks render as `<ins data-suggestion="…">` / `<del data-suggestion="…">`; comment anchors as `<span data-comment-id="…">`.
- Author name on suggestions and comments: `Pragna`.
- New dependencies: `vitest@2.1.9`, `jsdom@25.0.1` as frontend devDependencies only.
- Frontend tests: `npm test --workspace=frontend` (Vitest). Backend tests: `node --test backend/test/`.
- Do not commit `backend/.env`.

## Deviations from the spec (decided while planning)

- Block ids live in a run-scoped `BlockRefs` object that listens to editor transactions, not in a ProseMirror plugin. Same behaviour (mapped through every transaction, never saved), less code.
- Suggestions open their ✓/✗ popover on click/tap rather than hover, because the editor is used on phones.
- When Pragna edits a block that already has pending Pragna suggestions, those are first rejected inside that block and the new edit is diffed from the original text, so the block always shows one original→latest suggestion set. `replace_text` searches the block's *accepted* text (what read tools return).

## Review Focus

- Editing a block that already contains pending suggestions twice in one run, including a block Pragna itself inserted — expected: one clean original→final diff, no doubled text, neighbours untouched. (Task 5 tests `rewrite twice`, `rewrites a block Pragna inserted`.)
- The user types in the document while a run is in progress — expected: ids still point at the same blocks; a deleted block returns `{ error }` instead of editing the wrong text. (Task 3 tests.)
- Model returns malformed tool arguments (non-JSON) or an unknown tool name — expected: tool result `{ error }`, run continues. (Task 8 test.)
- Rejecting an inserted whole paragraph / accepting a deleted whole paragraph — expected: the empty paragraph is removed too, not left behind. (Task 2 tests.)
- Export of a document with pending suggestions — expected: `.docx` has `w:ins`/`w:del`; HTML/PDF/Markdown show accepted text with no `ins`/`del` duplicates. (Task 10 tests.)

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/vitest.config.js` (new) | Vitest config: jsdom, `@` alias |
| `frontend/src/ai/wordDiff.js` (new) | Pure tokeniser + LCS word diff |
| `frontend/src/ai/suggestions.js` (new) | `suggestInsert`/`suggestDelete`/`commentAnchor` marks, `Suggestions` extension (accept/reject commands), `resolveSuggestions`, `applyTextDiff`, `blockText`, `listSuggestionIds` |
| `frontend/src/ai/blockRefs.js` (new) | `BlockRefs` class: run-scoped ids ↔ positions |
| `frontend/src/ai/tools/readTools.js` (new) | `get_outline`, `read_blocks`, `find_text`, `get_selection`, `read_table` |
| `frontend/src/ai/tools/editTools.js` (new) | `replace_text`, `rewrite_block`, `insert_blocks`, `delete_blocks`, `set_table_cell` |
| `frontend/src/ai/tools/structureTools.js` (new) | `format_text`, `set_block_style`, `table_add_row`, `table_add_column`, `table_delete_row`, `insert_table`, `add_comment` |
| `frontend/src/ai/tools/index.js` (new) | `TOOL_SCHEMAS`, `executeTool(name, args, ctx)` |
| `frontend/src/ai/runRecorder.js` (new) | Records agent steps; `undoRun()` builds one inverse transaction |
| `frontend/src/ai/useDocumentAgent.js` (new) | React hook running the loop |
| `frontend/src/ai/__tests__/*.test.js` (new) | Unit tests; `testEditor.js` helper |
| `frontend/src/components/sidebar/SuggestionReview.jsx` (new) | Review bar + click popover |
| `frontend/src/services/suggestionHtml.js` (new) | `acceptSuggestionsInHtml(html)` for non-docx exports |
| `frontend/src/hooks/useEditorSetup.js` (modify) | Register new marks/extension |
| `frontend/src/components/sidebar/PragnaChatSidebar.jsx` (modify) | Agent mode, step lines, Stop, review bar, quick prompts |
| `frontend/src/services/api.js` (modify) | `aiApi.agentStep` |
| `frontend/src/services/export.js`, `markdownExport.js`, `epubExport.js` (modify) | Tracked changes in docx; accepted view elsewhere |
| `frontend/src/components/dialogs/ReviewDialogs.jsx` (modify) | Click comment → jump to anchor |
| `frontend/src/theme/global.css` (modify) | Suggestion / comment / popover styles |
| `backend/lib/agentStep.js` (new) | Validate request; run one step through `chatCompletion` |
| `backend/utils/ollamaService.js` (modify) | `chatCompletion({ tools })` support |
| `backend/routes/ai.js` (modify) | `POST /agent-step` |
| `backend/test/agent-step.test.js` (new) | Backend tests |

---

### Task 1: Test setup and word diff

**Files:**
- Create: `frontend/vitest.config.js`, `frontend/src/ai/wordDiff.js`, `frontend/src/ai/__tests__/wordDiff.test.js`
- Modify: `frontend/package.json` (scripts + devDependencies)

**Interfaces:**
- Produces: `tokenize(text: string): string[]`; `diffWords(oldText: string, newText: string): Array<{ type: 'equal'|'delete'|'insert', text: string }>` — adjacent ops of the same type merged; in a replaced region the `delete` op comes before the `insert` op; concatenating `equal`+`delete` texts gives `oldText`, `equal`+`insert` gives `newText`.

- [ ] **Step 1: Install test tooling**

```bash
cd /home/vinay/WORD-UPDATED
npm install -D vitest@2.1.9 jsdom@25.0.1 --workspace=frontend
```

Add to `frontend/package.json` `"scripts"`: `"test": "vitest run"`.

Create `frontend/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'jsdom', include: ['src/**/__tests__/**/*.test.js'] },
});
```

- [ ] **Step 2: Write the failing test**

`frontend/src/ai/__tests__/wordDiff.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { tokenize, diffWords } from '@/ai/wordDiff';

const join = (ops, keep) => ops.filter((o) => keep.includes(o.type)).map((o) => o.text).join('');

describe('diffWords', () => {
  it('tokenizes words, spaces and punctuation separately', () => {
    expect(tokenize('Hi, you  there.')).toEqual(['Hi', ',', ' ', 'you', '  ', 'there', '.']);
  });

  it('marks a single changed word', () => {
    const ops = diffWords('teh quick fox', 'the quick fox');
    expect(ops).toEqual([
      { type: 'delete', text: 'teh' },
      { type: 'insert', text: 'the' },
      { type: 'equal', text: ' quick fox' },
    ]);
  });

  it('reconstructs both texts', () => {
    const a = 'MongoDB is a NoSQL database that store data.';
    const b = 'MongoDB is a NoSQL database that stores data in documents.';
    const ops = diffWords(a, b);
    expect(join(ops, ['equal', 'delete'])).toBe(a);
    expect(join(ops, ['equal', 'insert'])).toBe(b);
  });

  it('handles empty sides', () => {
    expect(diffWords('', 'new')).toEqual([{ type: 'insert', text: 'new' }]);
    expect(diffWords('old', '')).toEqual([{ type: 'delete', text: 'old' }]);
    expect(diffWords('same', 'same')).toEqual([{ type: 'equal', text: 'same' }]);
  });

  it('falls back to whole replace for very long inputs', () => {
    const a = 'a '.repeat(700);
    const b = 'b '.repeat(700);
    expect(diffWords(a, b)).toEqual([{ type: 'delete', text: a }, { type: 'insert', text: b }]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test --workspace=frontend -- wordDiff`
Expected: FAIL — cannot resolve `@/ai/wordDiff`.

- [ ] **Step 4: Implement**

`frontend/src/ai/wordDiff.js`:

```js
// Word-level diff used to turn Pragna's rewrites into reviewable suggestions.

const TOKEN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
const MAX_CELLS = 250000; // LCS table size guard (~500 x 500 tokens)

export function tokenize(text = '') {
  return text.match(TOKEN) || [];
}

function push(ops, type, text) {
  if (!text) return;
  const last = ops[ops.length - 1];
  if (last && last.type === type) last.text += text;
  else ops.push({ type, text });
}

export function diffWords(oldText = '', newText = '') {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  if (a.length * b.length > MAX_CELLS) {
    const ops = [];
    push(ops, 'delete', oldText);
    push(ops, 'insert', newText);
    return ops;
  }

  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  let pendingDelete = '';
  let pendingInsert = '';
  const flush = () => {
    push(ops, 'delete', pendingDelete);
    push(ops, 'insert', pendingInsert);
    pendingDelete = '';
    pendingInsert = '';
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      push(ops, 'equal', a[i]);
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      pendingInsert += b[j];
      j += 1;
    } else {
      pendingDelete += a[i];
      i += 1;
    }
  }
  flush();
  return ops;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test --workspace=frontend -- wordDiff`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json package-lock.json frontend/vitest.config.js frontend/src/ai/wordDiff.js frontend/src/ai/__tests__/wordDiff.test.js
git commit -m "feat(pragna): word-level diff and frontend test setup"
```

---

### Task 2: Suggestion and comment marks, accept/reject

**Files:**
- Create: `frontend/src/ai/suggestions.js`, `frontend/src/ai/__tests__/testEditor.js`, `frontend/src/ai/__tests__/suggestions.test.js`
- Modify: `frontend/src/hooks/useEditorSetup.js` (extensions list near line 412), `frontend/src/theme/global.css` (append)

**Interfaces:**
- Consumes: `diffWords` (Task 1).
- Produces:
  - Marks `SuggestInsert` (`suggestInsert`), `SuggestDelete` (`suggestDelete`), attrs `{ id: string, author: string, createdAt: string }`; `CommentAnchor` (`commentAnchor`), attrs `{ commentId: string }`.
  - Extension `Suggestions` with commands `acceptSuggestion(id)`, `rejectSuggestion(id)`, `acceptAllSuggestions()`, `rejectAllSuggestions()`.
  - `newSuggestionId(): string`
  - `resolveSuggestions(tr, mode: 'accept'|'reject', opts?: { from?, to?, id? }): Transaction`
  - `blockText(node, contentStart, view: 'accepted'|'original'): { text: string, posAt(offset: number): number }`
  - `applyTextDiff(tr, { from: number, oldText: string, newText: string, id: string, author: string }): void` — `from` is the content start of a textblock with no pending suggestions; `oldText` must equal that block's text.
  - `listSuggestionIds(doc): string[]` (document order, unique)
  - `createTestEditor(html: string): Editor` (test helper)

- [ ] **Step 1: Write the test helper**

`frontend/src/ai/__tests__/testEditor.js`:

```js
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
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
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      SuggestInsert, SuggestDelete, CommentAnchor, Suggestions,
    ],
    content: html,
  });
}
```

- [ ] **Step 2: Write the failing tests**

`frontend/src/ai/__tests__/suggestions.test.js`:

```js
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test --workspace=frontend -- suggestions`
Expected: FAIL — cannot resolve `@/ai/suggestions`.

- [ ] **Step 4: Implement**

`frontend/src/ai/suggestions.js`:

```js
import { Mark, Extension, mergeAttributes } from '@tiptap/core';
import { diffWords } from '@/ai/wordDiff';

const suggestionAttrs = () => ({
  id: { default: '', parseHTML: (el) => el.getAttribute('data-suggestion') || '' },
  author: { default: 'Pragna', parseHTML: (el) => el.getAttribute('data-author') || 'Pragna' },
  createdAt: { default: '', parseHTML: (el) => el.getAttribute('data-created') || '' },
});

function suggestionMark(name, tag, className) {
  return Mark.create({
    name,
    inclusive: false,
    excludes: 'suggestInsert suggestDelete',
    addAttributes: suggestionAttrs,
    // Higher than the legacy `insertion`/`deletion` marks, which also parse <ins>/<del>.
    parseHTML: () => [{ tag: `${tag}[data-suggestion]`, priority: 60 }],
    renderHTML: ({ mark, HTMLAttributes }) => [tag, mergeAttributes({
      'data-suggestion': mark.attrs.id,
      'data-author': mark.attrs.author,
      'data-created': mark.attrs.createdAt,
      class: className,
    }, HTMLAttributes.class ? { class: HTMLAttributes.class } : {}), 0],
  });
}

export const SuggestInsert = suggestionMark('suggestInsert', 'ins', 'etherx-suggest-insert');
export const SuggestDelete = suggestionMark('suggestDelete', 'del', 'etherx-suggest-delete');

export const CommentAnchor = Mark.create({
  name: 'commentAnchor',
  inclusive: false,
  addAttributes: () => ({
    commentId: { default: '', parseHTML: (el) => el.getAttribute('data-comment-id') || '' },
  }),
  parseHTML: () => [{ tag: 'span[data-comment-id]' }],
  renderHTML: ({ mark }) => ['span', { 'data-comment-id': mark.attrs.commentId, class: 'etherx-comment-anchor' }, 0],
});

let counter = 0;
export function newSuggestionId() {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
}

const hasMark = (node, name) => node.marks.some((m) => m.type.name === name);

/**
 * Text of a textblock as the reader sees it. `accepted` skips pending deletions,
 * `original` skips pending insertions. posAt(offset) maps a text offset to a doc position.
 */
export function blockText(node, contentStart, view = 'accepted') {
  const skip = view === 'accepted' ? 'suggestDelete' : 'suggestInsert';
  let text = '';
  const positions = [];
  let end = contentStart;
  node.forEach((child, offset) => {
    const pos = contentStart + offset;
    end = pos + child.nodeSize;
    if (child.isText) {
      if (hasMark(child, skip)) return;
      for (let i = 0; i < child.text.length; i += 1) positions.push(pos + i);
      text += child.text;
    } else {
      positions.push(pos);
      text += child.type.name === 'hardBreak' ? '\n' : '￼';
    }
  });
  return {
    text,
    posAt: (offset) => (offset < positions.length ? positions[offset] : (positions.length ? positions[positions.length - 1] + 1 : end)),
  };
}

/** Writes oldText -> newText into a suggestion-free textblock as insert/delete marks. */
export function applyTextDiff(tr, { from, oldText, newText, id, author = 'Pragna' }) {
  const createdAt = new Date().toISOString();
  const { schema } = tr.doc.type;
  const insertMark = schema.marks.suggestInsert.create({ id, author, createdAt });
  const deleteMark = schema.marks.suggestDelete.create({ id, author, createdAt });
  let cursor = from;
  for (const op of diffWords(oldText, newText)) {
    const len = op.text.length;
    if (op.type === 'equal') {
      cursor += len;
    } else if (op.type === 'delete') {
      tr.addMark(cursor, cursor + len, deleteMark);
      cursor += len;
    } else {
      // New words inherit the formatting of the text just before them.
      const $pos = tr.doc.resolve(cursor);
      const inherited = ($pos.nodeBefore?.marks || $pos.nodeAfter?.marks || [])
        .filter((m) => !['suggestInsert', 'suggestDelete', 'commentAnchor'].includes(m.type.name));
      tr.insert(cursor, schema.text(op.text, [...inherited, insertMark]));
      cursor += len;
    }
  }
}

/** Accepts or rejects pending suggestions (all, a range, or one id) inside `tr`. */
export function resolveSuggestions(tr, mode, { from = 0, to = tr.doc.content.size, id = null } = {}) {
  const removeType = mode === 'accept' ? 'suggestDelete' : 'suggestInsert';
  const keepType = mode === 'accept' ? 'suggestInsert' : 'suggestDelete';
  const removals = [];
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    node.marks.forEach((mark) => {
      if (id && mark.attrs.id !== id) return;
      if (mark.type.name === keepType) tr.removeMark(pos, pos + node.nodeSize, mark);
      if (mark.type.name === removeType) removals.push({ from: pos, to: pos + node.nodeSize });
    });
  });
  const merged = [];
  removals.sort((a, b) => a.from - b.from).forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && last.to === r.from) last.to = r.to;
    else merged.push({ ...r });
  });
  // Delete from the end so earlier positions stay valid. A range covering a whole textblock
  // removes the block too, as long as its parent keeps another child.
  merged.reverse().forEach(({ from: a, to: b }) => {
    const $a = tr.doc.resolve(a);
    const wholeBlock = a === $a.start() && b === $a.end();
    if (wholeBlock && $a.depth > 0 && $a.node(-1).childCount > 1) tr.delete($a.before(), $a.after());
    else tr.delete(a, b);
  });
  return tr;
}

export function listSuggestionIds(doc) {
  const ids = [];
  doc.descendants((node) => {
    if (!node.isText) return;
    node.marks.forEach((m) => {
      if ((m.type.name === 'suggestInsert' || m.type.name === 'suggestDelete') && m.attrs.id && !ids.includes(m.attrs.id)) ids.push(m.attrs.id);
    });
  });
  return ids;
}

export const Suggestions = Extension.create({
  name: 'suggestions',
  addCommands() {
    const run = (mode, id) => () => ({ tr, dispatch }) => {
      if (dispatch) resolveSuggestions(tr, mode, id ? { id } : {});
      return true;
    };
    return {
      acceptSuggestion: (id) => run('accept', id)(),
      rejectSuggestion: (id) => run('reject', id)(),
      acceptAllSuggestions: run('accept'),
      rejectAllSuggestions: run('reject'),
    };
  },
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test --workspace=frontend -- suggestions`
Expected: PASS (6 tests). If the bold test fails on mark order, keep the regex (both nestings are valid output).

- [ ] **Step 6: Register in the editor and style**

In `frontend/src/hooks/useEditorSetup.js` add the import:

```js
import { SuggestInsert, SuggestDelete, CommentAnchor, Suggestions } from '@/ai/suggestions';
```

and add `SuggestInsert, SuggestDelete, CommentAnchor, Suggestions,` to the extensions array right after `ResizableImage.configure({ allowBase64: true }),`.

Append to `frontend/src/theme/global.css`:

```css
/* Pragna suggestions and comment anchors */
.ProseMirror ins.etherx-suggest-insert { color: #6fcf8f; text-decoration: underline; text-decoration-color: rgba(111, 207, 143, 0.7); background: rgba(111, 207, 143, 0.10); cursor: pointer; }
.ProseMirror del.etherx-suggest-delete { color: #ff8a83; text-decoration: line-through; background: rgba(216, 68, 61, 0.10); cursor: pointer; }
.ProseMirror .etherx-comment-anchor { background: rgba(217, 181, 74, 0.22); border-bottom: 1px dashed #d9b54a; }
.etherx-suggestion-popover { position: fixed; z-index: 1000; display: flex; gap: 4px; padding: 4px; border-radius: 8px; background: var(--bg-elevated); border: 1px solid var(--border); box-shadow: var(--shadow-md); }
.etherx-suggestion-popover button { border: 0; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
```

- [ ] **Step 7: Verify the app still builds**

Run: `cd frontend && npx vite build 2>&1 | tail -1`
Expected: `✓ built in …`

- [ ] **Step 8: Commit**

```bash
git add frontend/src/ai/suggestions.js frontend/src/ai/__tests__/testEditor.js frontend/src/ai/__tests__/suggestions.test.js frontend/src/hooks/useEditorSetup.js frontend/src/theme/global.css
git commit -m "feat(pragna): suggestion and comment marks with accept/reject"
```

---

### Task 3: Run-scoped block ids

**Files:**
- Create: `frontend/src/ai/blockRefs.js`, `frontend/src/ai/__tests__/blockRefs.test.js`

**Interfaces:**
- Consumes: Tiptap `Editor` (`editor.on('transaction')`, `editor.state.doc`).
- Produces: `class BlockRefs { constructor(editor); idFor(pos: number, node): string; resolve(id: string): { node, pos } | null; tableIdFor(pos): string; resolveCell(cellId: string): { node, pos } | null; detach(): void }`.
  - Textblocks get `b1, b2…`; tables `t1, t2…`; cells are `t1.r{row}c{col}` (0-based).
  - `resolve` returns null when the block was deleted or its position no longer holds a node of the same kind.

- [ ] **Step 1: Write the failing test**

`frontend/src/ai/__tests__/blockRefs.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';

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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=frontend -- blockRefs`
Expected: FAIL — cannot resolve `@/ai/blockRefs`.

- [ ] **Step 3: Implement**

`frontend/src/ai/blockRefs.js`:

```js
// Run-scoped ids for blocks the agent has seen. Positions are mapped through every
// transaction (including the user's typing), and nothing is stored in the document.

export class BlockRefs {
  constructor(editor) {
    this.editor = editor;
    this.entries = new Map(); // id -> { pos, kind: 'block'|'table', deleted }
    this.byPos = new Map(); // pos -> id (refreshed lazily)
    this.counts = { block: 0, table: 0 };
    this.onTransaction = ({ transaction }) => {
      if (!transaction.docChanged) return;
      this.byPos.clear();
      this.entries.forEach((entry) => {
        if (entry.deleted) return;
        const result = transaction.mapping.mapResult(entry.pos, 1);
        entry.pos = result.pos;
        entry.deleted = result.deleted;
      });
    };
    editor.on('transaction', this.onTransaction);
  }

  register(pos, kind) {
    const existing = this.byPos.get(pos) || Array.from(this.entries.entries())
      .find(([, e]) => !e.deleted && e.pos === pos && e.kind === kind)?.[0];
    if (existing) {
      this.byPos.set(pos, existing);
      return existing;
    }
    this.counts[kind] += 1;
    const id = `${kind === 'table' ? 't' : 'b'}${this.counts[kind]}`;
    this.entries.set(id, { pos, kind, deleted: false });
    this.byPos.set(pos, id);
    return id;
  }

  idFor(pos) {
    return this.register(pos, 'block');
  }

  tableIdFor(pos) {
    return this.register(pos, 'table');
  }

  resolve(id) {
    const entry = this.entries.get(String(id || '').trim());
    if (!entry || entry.deleted) return null;
    const node = this.editor.state.doc.nodeAt(entry.pos);
    if (!node) return null;
    if (entry.kind === 'block' && !node.isTextblock) return null;
    if (entry.kind === 'table' && node.type.name !== 'table') return null;
    return { node, pos: entry.pos };
  }

  // `t1.r2c3` -> the cell node at row 2, column 3 of table t1.
  resolveCell(cellId) {
    const match = /^(t\d+)\.r(\d+)c(\d+)$/.exec(String(cellId || '').trim());
    if (!match) return null;
    const table = this.resolve(match[1]);
    if (!table) return null;
    const row = Number(match[2]);
    const col = Number(match[3]);
    if (row >= table.node.childCount) return null;
    let pos = table.pos + 1;
    for (let r = 0; r < row; r += 1) pos += table.node.child(r).nodeSize;
    const rowNode = table.node.child(row);
    if (col >= rowNode.childCount) return null;
    pos += 1;
    for (let c = 0; c < col; c += 1) pos += rowNode.child(c).nodeSize;
    return { node: rowNode.child(col), pos };
  }

  detach() {
    this.editor.off('transaction', this.onTransaction);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test --workspace=frontend -- blockRefs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ai/blockRefs.js frontend/src/ai/__tests__/blockRefs.test.js
git commit -m "feat(pragna): run-scoped block ids mapped through edits"
```

---

### Task 4: Backend agent step

**Files:**
- Create: `backend/lib/agentStep.js`, `backend/test/agent-step.test.js`
- Modify: `backend/utils/ollamaService.js:199` (`chatCompletion`), `backend/routes/ai.js` (new route), `frontend/src/services/api.js:157-160` (`aiApi`)

**Interfaces:**
- Produces (backend): `validateAgentStep(body) -> { ok: true, messages, tools, model } | { ok: false, error: string }`; `runAgentStep({ messages, tools, model }, chatCompletion) -> Promise<{ content: string, tool_calls: Array<{ id, type: 'function', function: { name, arguments: string } }>, model: string }>`.
- `chatCompletion({ messages, temperature, max_tokens, model, tools })` → when `tools` is given: skips Gemini, sends `tools`, accepts a reply with `tool_calls` and empty content, returns `{ content, tool_calls, model, role }`.
- Produces (frontend): `aiApi.agentStep({ messages, tools, model? })` → `{ success: true, content, tool_calls, model }`.

- [ ] **Step 1: Write the failing test**

`backend/test/agent-step.test.js`:

```js
const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');
const { validateAgentStep, runAgentStep } = require('../lib/agentStep');

const tool = { type: 'function', function: { name: 'read_blocks', description: 'x', parameters: { type: 'object', properties: {} } } };

test('validateAgentStep accepts a normal request', () => {
  const r = validateAgentStep({ messages: [{ role: 'user', content: 'hi' }], tools: [tool] });
  assert.equal(r.ok, true);
});

test('validateAgentStep rejects bad roles, too many messages and missing tools', () => {
  assert.equal(validateAgentStep({ messages: [{ role: 'admin', content: 'x' }], tools: [tool] }).ok, false);
  assert.equal(validateAgentStep({ messages: Array(121).fill({ role: 'user', content: 'x' }), tools: [tool] }).ok, false);
  assert.equal(validateAgentStep({ messages: [{ role: 'user', content: 'x' }], tools: [] }).ok, false);
  assert.equal(validateAgentStep({ messages: [{ role: 'user', content: 'x'.repeat(1_100_000) }], tools: [tool] }).ok, false);
});

test('runAgentStep passes tools through and returns tool calls', async () => {
  let seen = null;
  const fake = async (args) => {
    seen = args;
    return { content: '', model: 'gpt-oss:20b', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_blocks', arguments: '{}' } }] };
  };
  const out = await runAgentStep({ messages: [{ role: 'user', content: 'x' }], tools: [tool] }, fake);
  assert.deepEqual(seen.tools, [tool]);
  assert.equal(out.tool_calls[0].function.name, 'read_blocks');
  assert.equal(out.content, '');
});

test('chatCompletion with tools skips Gemini and returns tool_calls', async (t) => {
  process.env.GEMINI_API_KEY = 'test-gemini';
  const calls = [];
  const original = axios.post;
  axios.post = async (url, body) => {
    calls.push(url);
    return { data: { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_blocks', arguments: { ids: ['b1'] } } }] } }] } };
  };
  t.after(() => { axios.post = original; delete process.env.GEMINI_API_KEY; });
  const ollamaService = require('../utils/ollamaService');
  if (!ollamaService.keys.length) ollamaService.keys.push('test-key');
  const res = await ollamaService.chatCompletion({ messages: [{ role: 'user', content: 'x' }], tools: [tool] });
  assert.ok(calls.every((u) => !u.includes('generativelanguage')));
  assert.equal(res.tool_calls[0].function.arguments, '{"ids":["b1"]}');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test backend/test/agent-step.test.js`
Expected: FAIL — `Cannot find module '../lib/agentStep'`.

- [ ] **Step 3: Implement `backend/lib/agentStep.js`**

```js
// One step of Pragna's document agent: validate the browser's request and run a single model
// turn with tools. The loop and the document live in the browser; this is stateless.

const ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const MAX_MESSAGES = 120;
const MAX_TOOLS = 30;
const MAX_BYTES = 1_000_000;

function validateAgentStep(body = {}) {
  const { messages, tools, model } = body;
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    return { ok: false, error: `messages must be an array of 1-${MAX_MESSAGES} items` };
  }
  if (!messages.every((m) => m && ROLES.has(m.role))) return { ok: false, error: 'invalid message role' };
  if (!Array.isArray(tools) || !tools.length || tools.length > MAX_TOOLS) {
    return { ok: false, error: `tools must be an array of 1-${MAX_TOOLS} items` };
  }
  if (!tools.every((t) => t?.type === 'function' && typeof t.function?.name === 'string')) {
    return { ok: false, error: 'invalid tool schema' };
  }
  if (JSON.stringify({ messages, tools }).length > MAX_BYTES) return { ok: false, error: 'request too large' };
  return { ok: true, messages, tools, model: typeof model === 'string' ? model : undefined };
}

async function runAgentStep({ messages, tools, model }, chatCompletion) {
  const res = await chatCompletion({ messages, tools, model, temperature: 0.2, max_tokens: 2000 });
  return { content: res.content || '', tool_calls: res.tool_calls || [], model: res.model };
}

module.exports = { validateAgentStep, runAgentStep };
```

- [ ] **Step 4: Add tool support to `chatCompletion`** in `backend/utils/ollamaService.js`

Change the signature line to:

```js
  async chatCompletion({ messages, temperature = 0.7, max_tokens = 4000, model, tools }) {
    const withTools = Array.isArray(tools) && tools.length > 0;
```

Change `if (process.env.GEMINI_API_KEY) {` to `if (process.env.GEMINI_API_KEY && !withTools) {` (Gemini uses a different tool format).

In the Ollama request body change `{ model: currentModel, messages, temperature, max_tokens }` to:

```js
          {
            model: currentModel,
            messages,
            temperature,
            max_tokens,
            ...(withTools ? { tools } : {}),
          },
```

Replace the response handling block (`const choice = …` through the `return { content: …, role: … };`) with:

```js
        const choice = response.data?.choices?.[0];
        const toolCalls = (choice?.message?.tool_calls || []).map((call, index) => ({
          id: call.id || `call_${Date.now()}_${index}`,
          type: 'function',
          function: {
            name: call.function?.name,
            arguments: typeof call.function?.arguments === 'string'
              ? call.function.arguments
              : JSON.stringify(call.function?.arguments || {}),
          },
        }));
        if (!choice?.message?.content && !(withTools && toolCalls.length)) {
          throw new Error('Empty response from Ollama API');
        }

        return {
          content: (choice.message.content || '').trim(),
          model: currentModel,
          role: choice.message.role || 'assistant',
          ...(withTools ? { tool_calls: toolCalls } : {}),
        };
```

- [ ] **Step 5: Add the route** in `backend/routes/ai.js` (after the `/chat` route)

```js
const { validateAgentStep, runAgentStep } = require('../lib/agentStep');

// One model turn for Pragna's document agent (the loop runs in the browser).
router.post('/agent-step', requireFeature('aiWritingTools'), async (req, res) => {
  const checked = validateAgentStep(req.body);
  if (!checked.ok) return res.status(400).json({ success: false, message: checked.error });
  try {
    const result = await runAgentStep(checked, (args) => ollamaService.chatCompletion(args));
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ Pragna agent step error:', err.message);
    return res.status(502).json({ success: false, message: err.message || 'Pragna agent step failed' });
  }
});
```

(Put the `require` at the top of the file with the other requires.)

- [ ] **Step 6: Frontend client** — in `frontend/src/services/api.js` add to `aiApi`:

```js
  agentStep:       (payload) => req('/ai/agent-step',       { method: 'POST', body: payload }),
```

- [ ] **Step 7: Run to verify it passes**

Run: `node --test backend/test/agent-step.test.js`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/lib/agentStep.js backend/test/agent-step.test.js backend/utils/ollamaService.js backend/routes/ai.js frontend/src/services/api.js
git commit -m "feat(pragna): /api/ai/agent-step with Ollama tool calling"
```

---

### Task 5: Read and edit tools

**Files:**
- Create: `frontend/src/ai/tools/readTools.js`, `frontend/src/ai/tools/editTools.js`, `frontend/src/ai/__tests__/tools.test.js`

**Interfaces:**
- Consumes: `BlockRefs` (Task 3); `blockText`, `applyTextDiff`, `resolveSuggestions`, `newSuggestionId` (Task 2); `markdownToHtml` from `@/services/ai`.
- Produces: every tool is `(args, ctx) => object` where `ctx = { editor, refs }`; results are plain JSON; failures return `{ error: string }` and never throw.
  - Read: `getOutline({ page = 1 })`, `readBlocks({ ids, from_id, to_id })`, `findText({ query, match_case = false })`, `getSelection()`, `readTable({ table_id })`.
  - Edit: `replaceText({ block_id, find, replace, occurrence = 1 })`, `rewriteBlock({ block_id, text })`, `insertBlocks({ after_id, markdown })`, `deleteBlocks({ ids })`, `setTableCell({ cell_id, text })`. Edit results include `{ ok: true, suggestion_id }`.
  - Every dispatched transaction sets meta `pragnaAgent: true`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/ai/__tests__/tools.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=frontend -- tools`
Expected: FAIL — cannot resolve `@/ai/tools/readTools`.

- [ ] **Step 3: Implement `frontend/src/ai/tools/readTools.js`**

```js
import { blockText } from '@/ai/suggestions';

export const OUTLINE_PAGE = 60;
export const MAX_READ = 40;

const typeOf = (node) => (node.type.name === 'heading' ? `heading${node.attrs.level}` : node.type.name);

/** Reading-order list of textblocks outside tables, plus one entry per top-level table. */
export function listBlocks(ctx) {
  const { doc } = ctx.editor.state;
  const out = [];
  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'table') {
      out.push({ kind: 'table', node, pos });
      return false;
    }
    if (node.isTextblock) {
      out.push({ kind: 'block', node, pos, parent });
      return false;
    }
    return true;
  });
  return out;
}

const textOf = (node, pos) => blockText(node, pos + 1, 'accepted').text;

function describe(entry, ctx, full) {
  if (entry.kind === 'table') {
    const id = ctx.refs.tableIdFor(entry.pos);
    const rows = entry.node.childCount;
    const cols = entry.node.firstChild ? entry.node.firstChild.childCount : 0;
    const first = entry.node.firstChild ? entry.node.firstChild.textContent.slice(0, 80) : '';
    return { id, type: 'table', rows, cols, text: first };
  }
  const id = ctx.refs.idFor(entry.pos);
  const text = textOf(entry.node, entry.pos);
  const inList = entry.parent && ['listItem', 'taskItem'].includes(entry.parent.type.name);
  return {
    id,
    type: typeOf(entry.node),
    ...(inList ? { list_item: true } : {}),
    ...(entry.node.attrs.textAlign && entry.node.attrs.textAlign !== 'left' ? { align: entry.node.attrs.textAlign } : {}),
    text: full ? text : text.slice(0, 80),
  };
}

export function getOutline({ page = 1 } = {}, ctx) {
  const all = listBlocks(ctx);
  const p = Math.max(1, Number(page) || 1);
  const slice = all.slice((p - 1) * OUTLINE_PAGE, p * OUTLINE_PAGE);
  return {
    total_blocks: all.length,
    page: p,
    next_page: p * OUTLINE_PAGE < all.length ? p + 1 : null,
    blocks: slice.map((entry) => describe(entry, ctx, false)),
  };
}

export function readBlocks({ ids, from_id, to_id } = {}, ctx) {
  let wanted = Array.isArray(ids) ? ids.map(String) : null;
  if (!wanted && from_id && to_id) {
    const from = ctx.refs.resolve(from_id);
    const to = ctx.refs.resolve(to_id);
    if (!from || !to) return { error: 'unknown from_id or to_id; call get_outline first' };
    wanted = listBlocks(ctx)
      .filter((e) => e.kind === 'block' && e.pos >= from.pos && e.pos <= to.pos)
      .map((e) => ctx.refs.idFor(e.pos));
  }
  if (!wanted || !wanted.length) return { error: 'pass ids[] or from_id and to_id' };
  if (wanted.length > MAX_READ) return { error: `read at most ${MAX_READ} blocks at a time` };
  return {
    blocks: wanted.map((id) => {
      const hit = ctx.refs.resolve(id);
      if (!hit) return { id, error: 'unknown or deleted block id' };
      return { id, type: typeOf(hit.node), text: textOf(hit.node, hit.pos) };
    }),
  };
}

export function findText({ query, match_case = false } = {}, ctx) {
  if (!query) return { error: 'query is required' };
  const needle = match_case ? String(query) : String(query).toLowerCase();
  const matches = [];
  ctx.editor.state.doc.descendants((node, pos) => {
    if (matches.length >= 30) return false;
    if (!node.isTextblock) return true;
    const text = textOf(node, pos);
    const hay = match_case ? text : text.toLowerCase();
    const at = hay.indexOf(needle);
    if (at !== -1) {
      matches.push({
        block_id: ctx.refs.idFor(pos),
        snippet: text.slice(Math.max(0, at - 60), at + needle.length + 60),
      });
    }
    return false;
  });
  return { matches };
}

export function getSelection(_args, ctx) {
  const { from, to, empty } = ctx.editor.state.selection;
  if (empty) return { selected: false, blocks: [] };
  const blocks = [];
  ctx.editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    blocks.push({ id: ctx.refs.idFor(pos), text: textOf(node, pos) });
    return false;
  });
  return { selected: true, text: ctx.editor.state.doc.textBetween(from, to, '\n'), blocks };
}

export function readTable({ table_id } = {}, ctx) {
  const table = ctx.refs.resolve(table_id);
  if (!table) return { error: 'unknown table id; call get_outline first' };
  const rows = [];
  table.node.forEach((row, _o, r) => {
    const cells = [];
    row.forEach((cell, _c, c) => cells.push({ cell_id: `${table_id}.r${r}c${c}`, text: cell.textContent }));
    rows.push(cells);
  });
  return { table_id, rows };
}
```

- [ ] **Step 4: Implement `frontend/src/ai/tools/editTools.js`**

```js
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { blockText, applyTextDiff, resolveSuggestions, newSuggestionId } from '@/ai/suggestions';
import { markdownToHtml } from '@/services/ai';

const AUTHOR = 'Pragna';

function dispatch(ctx, tr) {
  tr.setMeta('pragnaAgent', true);
  ctx.editor.view.dispatch(tr);
}

// Rejects pending suggestions inside the block, then diffs its original text to `newText`.
function rewriteResolved(ctx, hit, newText) {
  const { tr } = ctx.editor.state;
  const start = hit.pos + 1;
  // A block Pragna inserted in this or an earlier run has no original text: rejecting would delete
  // the block itself. Replace its text instead, keeping it one pending insertion.
  if (hit.node.content.size > 0 && blockText(hit.node, start, 'original').text === '') {
    const existing = hit.node.firstChild?.marks.find((m) => m.type.name === 'suggestInsert');
    tr.replaceWith(start, start + hit.node.content.size, ctx.editor.schema.text(newText || ' ', [existing]));
    dispatch(ctx, tr);
    return { ok: true, suggestion_id: existing.attrs.id };
  }
  resolveSuggestions(tr, 'reject', { from: start, to: start + hit.node.content.size });
  const node = tr.doc.nodeAt(hit.pos);
  const original = blockText(node, start, 'original').text;
  if (original === newText) {
    dispatch(ctx, tr);
    return { ok: true, unchanged: true };
  }
  const id = newSuggestionId();
  applyTextDiff(tr, { from: start, oldText: original, newText, id, author: AUTHOR });
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id };
}

export function rewriteBlock({ block_id, text } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id; call get_outline or find_text first' };
  if (typeof text !== 'string') return { error: 'text is required' };
  return rewriteResolved(ctx, hit, text);
}

export function replaceText({ block_id, find, replace = '', occurrence = 1 } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id; call get_outline or find_text first' };
  if (!find) return { error: 'find is required' };
  const current = blockText(hit.node, hit.pos + 1, 'accepted').text;
  let at = -1;
  for (let n = 0, from = 0; n < Math.max(1, occurrence); n += 1) {
    at = current.indexOf(find, from);
    if (at === -1) break;
    from = at + find.length;
  }
  if (at === -1) return { error: `"${find}" not found in ${block_id}; read the block and copy the exact text` };
  return rewriteResolved(ctx, hit, current.slice(0, at) + replace + current.slice(at + find.length));
}

export function insertBlocks({ after_id, markdown } = {}, ctx) {
  const hit = ctx.refs.resolve(after_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  if (!markdown) return { error: 'markdown is required' };
  const { schema, tr } = ctx.editor.state;
  const holder = document.createElement('div');
  holder.innerHTML = markdownToHtml(markdown);
  const slice = PMDOMParser.fromSchema(schema).parseSlice(holder);
  const insertAt = hit.pos + hit.node.nodeSize;
  tr.insert(insertAt, slice.content);
  const id = newSuggestionId();
  const mark = schema.marks.suggestInsert.create({ id, author: AUTHOR, createdAt: new Date().toISOString() });
  tr.addMark(insertAt, insertAt + slice.content.size, mark);
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id };
}

export function deleteBlocks({ ids } = {}, ctx) {
  if (!Array.isArray(ids) || !ids.length) return { error: 'ids[] is required' };
  const { schema, tr } = ctx.editor.state;
  const id = newSuggestionId();
  const mark = schema.marks.suggestDelete.create({ id, author: AUTHOR, createdAt: new Date().toISOString() });
  const missing = [];
  ids.forEach((blockId) => {
    const hit = ctx.refs.resolve(blockId);
    if (!hit) missing.push(blockId);
    else tr.addMark(hit.pos + 1, hit.pos + 1 + hit.node.content.size, mark);
  });
  dispatch(ctx, tr);
  return { ok: true, suggestion_id: id, ...(missing.length ? { missing } : {}) };
}

export function setTableCell({ cell_id, text } = {}, ctx) {
  const cell = ctx.refs.resolveCell(cell_id);
  if (!cell) return { error: 'unknown cell id; call read_table first' };
  if (typeof text !== 'string') return { error: 'text is required' };
  let first = null;
  cell.node.descendants((node, pos) => {
    if (!first && node.isTextblock) first = cell.pos + 1 + pos;
    return !first;
  });
  if (first === null) return { error: 'cell has no paragraph' };
  return rewriteResolved(ctx, { node: ctx.editor.state.doc.nodeAt(first), pos: first }, text);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test --workspace=frontend -- tools`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/ai/tools/readTools.js frontend/src/ai/tools/editTools.js frontend/src/ai/__tests__/tools.test.js
git commit -m "feat(pragna): read and suggestion-based edit tools"
```

---

### Task 6: Structure, formatting and comment tools

**Files:**
- Create: `frontend/src/ai/tools/structureTools.js`, `frontend/src/ai/__tests__/structureTools.test.js`

**Interfaces:**
- Consumes: `BlockRefs`, `blockText`; `useDocumentStore` from `@/store` (`addComment`).
- Produces: `formatText({ block_id, find, bold, italic, underline, color, font_size })`, `setBlockStyle({ ids, style, align, line_spacing })`, `tableAddRow({ table_id, index })`, `tableAddColumn({ table_id, index })`, `tableDeleteRow({ table_id, index })`, `insertTable({ after_id, rows })`, `addComment({ block_id, find, text })` — all `(args, ctx) => { ok } | { error }`, transactions tagged `pragnaAgent`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/ai/__tests__/structureTools.test.js`:

```js
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
    expect(editor.getHTML()).toBe('<h2 style="text-align: center">Title</h2>');
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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=frontend -- structureTools`
Expected: FAIL — cannot resolve `@/ai/tools/structureTools`.

- [ ] **Step 3: Implement `frontend/src/ai/tools/structureTools.js`**

```js
import { blockText } from '@/ai/suggestions';
import { useDocumentStore } from '@/store';

const tag = (tr) => tr.setMeta('pragnaAgent', true);

// Doc range of `find` (accepted text) inside a block, or the whole block content.
function rangeIn(hit, find) {
  const start = hit.pos + 1;
  if (!find) return { from: start, to: start + hit.node.content.size };
  const view = blockText(hit.node, start, 'accepted');
  const at = view.text.indexOf(find);
  if (at === -1) return null;
  return { from: view.posAt(at), to: view.posAt(at + find.length - 1) + 1 };
}

export function formatText({ block_id, find, bold, italic, underline, color, font_size } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  const range = rangeIn(hit, find);
  if (!range) return { error: `"${find}" not found in ${block_id}` };
  const { schema, tr } = ctx.editor.state;
  const toggle = (value, markName, attrs) => {
    if (value === true) tr.addMark(range.from, range.to, schema.marks[markName].create(attrs));
    if (value === false) tr.removeMark(range.from, range.to, schema.marks[markName]);
  };
  toggle(bold, 'bold');
  toggle(italic, 'italic');
  if (schema.marks.underline) toggle(underline, 'underline');
  if ((color || font_size) && schema.marks.textStyle) {
    tr.addMark(range.from, range.to, schema.marks.textStyle.create({
      ...(color ? { color } : {}),
      ...(font_size ? { fontSize: `${parseFloat(font_size)}pt` } : {}),
    }));
  }
  ctx.editor.view.dispatch(tag(tr));
  return { ok: true };
}

const STYLE_MAP = { normal: ['paragraph', {}], h1: ['heading', { level: 1 }], h2: ['heading', { level: 2 }], h3: ['heading', { level: 3 }], h4: ['heading', { level: 4 }] };

export function setBlockStyle({ ids, style, align, line_spacing } = {}, ctx) {
  if (!Array.isArray(ids) || !ids.length) return { error: 'ids[] is required' };
  if (style && !STYLE_MAP[style]) return { error: 'style must be one of normal, h1, h2, h3, h4' };
  const { schema, tr } = ctx.editor.state;
  const missing = [];
  ids.forEach((id) => {
    const hit = ctx.refs.resolve(id);
    if (!hit) { missing.push(id); return; }
    const [typeName, extra] = style ? STYLE_MAP[style] : [hit.node.type.name, {}];
    const attrs = { ...hit.node.attrs, ...extra };
    if (align) attrs.textAlign = align;
    if (line_spacing && 'style' in attrs) {
      const rest = String(attrs.style || '').replace(/line-height:\s*[^;]+;?/g, '').trim();
      attrs.style = `${rest ? `${rest}; ` : ''}line-height: ${parseFloat(line_spacing)}`;
    }
    tr.setNodeMarkup(hit.pos, schema.nodes[typeName], attrs);
  });
  ctx.editor.view.dispatch(tag(tr));
  return { ok: true, ...(missing.length ? { missing } : {}) };
}

// Puts the cursor in the first cell of `row`, then runs a Tiptap table command in one transaction.
function tableCommand(ctx, table_id, row, command) {
  const table = ctx.refs.resolve(table_id);
  if (!table) return { error: 'unknown table id' };
  const cell = ctx.refs.resolveCell(`${table_id}.r${Math.max(0, Math.min(row, table.node.childCount - 1))}c0`);
  const ok = ctx.editor.chain()
    .command(({ tr }) => { tag(tr); return true; })
    .setTextSelection(cell.pos + 2)[command]()
    .run();
  return ok ? { ok: true } : { error: `could not ${command}` };
}

export const tableAddRow = ({ table_id, index = 0 } = {}, ctx) => tableCommand(ctx, table_id, Number(index), 'addRowAfter');
export const tableDeleteRow = ({ table_id, index = 0 } = {}, ctx) => tableCommand(ctx, table_id, Number(index), 'deleteRow');
export function tableAddColumn({ table_id, index = 0 } = {}, ctx) {
  const table = ctx.refs.resolve(table_id);
  if (!table) return { error: 'unknown table id' };
  const cell = ctx.refs.resolveCell(`${table_id}.r0c${Math.max(0, Math.min(Number(index), table.node.firstChild.childCount - 1))}`);
  const ok = ctx.editor.chain().command(({ tr }) => { tag(tr); return true; }).setTextSelection(cell.pos + 2).addColumnAfter().run();
  return ok ? { ok: true } : { error: 'could not add column' };
}

export function insertTable({ after_id, rows } = {}, ctx) {
  const hit = ctx.refs.resolve(after_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  if (!Array.isArray(rows) || !rows.length || !rows.every(Array.isArray)) return { error: 'rows must be an array of arrays' };
  const width = Math.max(...rows.map((r) => r.length));
  const table = {
    type: 'table',
    content: rows.map((r) => ({
      type: 'tableRow',
      content: Array.from({ length: width }, (_, c) => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: r[c] ? [{ type: 'text', text: String(r[c]) }] : [] }],
      })),
    })),
  };
  // Tables live at the top level: insert after the block's top-level ancestor.
  const $pos = ctx.editor.state.doc.resolve(hit.pos);
  const after = $pos.depth === 0 ? hit.pos + hit.node.nodeSize : $pos.after(1);
  const ok = ctx.editor.chain().command(({ tr }) => { tag(tr); return true; }).insertContentAt(after, table).run();
  return ok ? { ok: true } : { error: 'could not insert table' };
}

export function addComment({ block_id, find, text } = {}, ctx) {
  const hit = ctx.refs.resolve(block_id);
  if (!hit) return { error: 'unknown or deleted block id' };
  if (!text) return { error: 'text is required' };
  const range = rangeIn(hit, find);
  if (!range) return { error: `"${find}" not found in ${block_id}` };
  const commentId = `c${Date.now().toString(36)}`;
  const { schema, tr } = ctx.editor.state;
  tr.addMark(range.from, range.to, schema.marks.commentAnchor.create({ commentId }));
  ctx.editor.view.dispatch(tag(tr));
  useDocumentStore.getState().addComment({
    id: commentId, text, author: 'Pragna', anchor: commentId, timestamp: new Date().toISOString(),
  });
  return { ok: true, comment_id: commentId };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test --workspace=frontend -- structureTools`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ai/tools/structureTools.js frontend/src/ai/__tests__/structureTools.test.js
git commit -m "feat(pragna): formatting, table and comment tools"
```

---

### Task 7: Tool registry and run recorder

**Files:**
- Create: `frontend/src/ai/tools/index.js`, `frontend/src/ai/runRecorder.js`, `frontend/src/ai/__tests__/registry.test.js`

**Interfaces:**
- Consumes: all tool functions (Tasks 5–6).
- Produces:
  - `TOOL_SCHEMAS: Array<{ type: 'function', function: { name, description, parameters } }>` (17 tools, names exactly as in the spec).
  - `executeTool(name: string, rawArgs: string|object, ctx) -> object` — parses JSON args, unknown tool / bad JSON / thrown error → `{ error }`.
  - `class RunRecorder { constructor(editor); stop(); undo(): boolean; get changed(): boolean }` — records inverted steps of transactions with meta `pragnaAgent` and the step maps of every transaction; `undo()` dispatches one transaction reverting all recorded agent steps.

- [ ] **Step 1: Write the failing test**

`frontend/src/ai/__tests__/registry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { BlockRefs } from '@/ai/blockRefs';
import { TOOL_SCHEMAS, executeTool } from '@/ai/tools';
import { RunRecorder } from '@/ai/runRecorder';

describe('tool registry', () => {
  it('lists the 17 spec tools', () => {
    expect(TOOL_SCHEMAS.map((t) => t.function.name).sort()).toEqual([
      'add_comment', 'delete_blocks', 'find_text', 'format_text', 'get_outline', 'get_selection',
      'insert_blocks', 'insert_table', 'read_blocks', 'read_table', 'replace_text', 'rewrite_block',
      'set_block_style', 'set_table_cell', 'table_add_column', 'table_add_row', 'table_delete_row',
    ]);
  });

  it('turns bad input into errors', () => {
    const editor = createTestEditor('<p>x</p>');
    const ctx = { editor, refs: new BlockRefs(editor) };
    expect(executeTool('nope', '{}', ctx).error).toMatch(/unknown tool/);
    expect(executeTool('read_blocks', '{not json', ctx).error).toMatch(/JSON/);
    expect(executeTool('get_outline', '{}', ctx).blocks).toHaveLength(1);
  });
});

describe('RunRecorder', () => {
  it('undoes agent edits but keeps the user typing that came after', () => {
    const editor = createTestEditor('<p>alpha</p>');
    const recorder = new RunRecorder(editor);
    const ctx = { editor, refs: new BlockRefs(editor) };
    const id = executeTool('get_outline', {}, ctx).blocks[0].id;
    executeTool('format_text', { block_id: id, bold: true }, ctx);
    editor.commands.insertContentAt(editor.state.doc.content.size, '<p>mine</p>');
    recorder.stop();
    expect(recorder.undo()).toBe(true);
    expect(editor.getHTML()).toBe('<p>alpha</p><p>mine</p>');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=frontend -- registry`
Expected: FAIL — cannot resolve `@/ai/tools`.

- [ ] **Step 3: Implement `frontend/src/ai/tools/index.js`**

```js
import { getOutline, readBlocks, findText, getSelection, readTable } from './readTools';
import { replaceText, rewriteBlock, insertBlocks, deleteBlocks, setTableCell } from './editTools';
import { formatText, setBlockStyle, tableAddRow, tableAddColumn, tableDeleteRow, insertTable, addComment } from './structureTools';

const fn = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const str = (description) => ({ type: 'string', description });
const ids = { type: 'array', items: { type: 'string' }, description: 'Block ids like b12' };

export const TOOL_SCHEMAS = [
  fn('get_outline', 'List the document blocks in reading order with ids (b#, tables t#) and their first words. 60 per page.', { page: { type: 'integer' } }),
  fn('read_blocks', 'Read the full text of blocks by ids, or a range from_id..to_id (max 40).', { ids, from_id: str('first block id'), to_id: str('last block id') }),
  fn('find_text', 'Find blocks containing text. Returns block ids and snippets.', { query: str('text to find'), match_case: { type: 'boolean' } }, ['query']),
  fn('get_selection', "Get the user's current selection: text and block ids.", {}),
  fn('read_table', 'Read a table as rows of cells with cell ids (t1.r0c0).', { table_id: str('table id like t1') }, ['table_id']),
  fn('replace_text', 'Replace an exact phrase inside one block. Preferred for small edits. Shown as a suggestion.', { block_id: str('block id'), find: str('exact current text'), replace: str('new text'), occurrence: { type: 'integer' } }, ['block_id', 'find', 'replace']),
  fn('rewrite_block', "Replace a block's whole text. Shown as a word-level suggestion.", { block_id: str('block id'), text: str('new full text of the block') }, ['block_id', 'text']),
  fn('insert_blocks', 'Insert new content (markdown: paragraphs, headings, lists) after a block. Shown as a suggestion.', { after_id: str('block id to insert after'), markdown: str('content in markdown') }, ['after_id', 'markdown']),
  fn('delete_blocks', 'Suggest deleting whole blocks.', { ids }, ['ids']),
  fn('set_table_cell', "Set a table cell's text. Shown as a suggestion.", { cell_id: str('cell id like t1.r2c1'), text: str('new cell text') }, ['cell_id', 'text']),
  fn('format_text', 'Format a phrase (or the whole block if find is omitted).', { block_id: str('block id'), find: str('exact phrase'), bold: { type: 'boolean' }, italic: { type: 'boolean' }, underline: { type: 'boolean' }, color: str('CSS color like #c00000'), font_size: { type: 'number', description: 'points' } }, ['block_id']),
  fn('set_block_style', 'Set block style (normal, h1-h4), alignment and line spacing.', { ids, style: { type: 'string', enum: ['normal', 'h1', 'h2', 'h3', 'h4'] }, align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] }, line_spacing: { type: 'number' } }, ['ids']),
  fn('table_add_row', 'Add a row after row index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id']),
  fn('table_add_column', 'Add a column after column index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id']),
  fn('table_delete_row', 'Delete the row at index (0-based).', { table_id: str('table id'), index: { type: 'integer' } }, ['table_id', 'index']),
  fn('insert_table', 'Insert a new table after a block. rows is an array of rows, each an array of cell texts.', { after_id: str('block id'), rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, ['after_id', 'rows']),
  fn('add_comment', 'Leave a comment on a phrase (or whole block) for the user.', { block_id: str('block id'), find: str('exact phrase'), text: str('comment text') }, ['block_id', 'text']),
];

const HANDLERS = {
  get_outline: getOutline,
  read_blocks: readBlocks,
  find_text: findText,
  get_selection: getSelection,
  read_table: readTable,
  replace_text: replaceText,
  rewrite_block: rewriteBlock,
  insert_blocks: insertBlocks,
  delete_blocks: deleteBlocks,
  set_table_cell: setTableCell,
  format_text: formatText,
  set_block_style: setBlockStyle,
  table_add_row: tableAddRow,
  table_add_column: tableAddColumn,
  table_delete_row: tableDeleteRow,
  insert_table: insertTable,
  add_comment: addComment,
};

export const EDITING_TOOLS = new Set(['replace_text', 'rewrite_block', 'insert_blocks', 'delete_blocks', 'set_table_cell']);

export function executeTool(name, rawArgs, ctx) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `unknown tool "${name}"` };
  let args = rawArgs;
  if (typeof rawArgs === 'string') {
    try { args = rawArgs.trim() ? JSON.parse(rawArgs) : {}; } catch { return { error: 'arguments were not valid JSON; send a JSON object' }; }
  }
  try {
    return handler(args || {}, ctx);
  } catch (err) {
    return { error: `tool failed: ${err.message}` };
  }
}
```

- [ ] **Step 4: Implement `frontend/src/ai/runRecorder.js`**

```js
import { Mapping } from '@tiptap/pm/transform';

// Records every step map after the run starts, and the inverse of each agent step, so the whole
// run can be reverted in one transaction even if the user edited in between.
export class RunRecorder {
  constructor(editor) {
    this.editor = editor;
    this.maps = [];
    this.items = []; // { inverted, index } index = position of that step's map in `maps`
    this.onTransaction = ({ transaction }) => {
      if (!transaction.docChanged) return;
      const agent = transaction.getMeta('pragnaAgent');
      transaction.steps.forEach((step, i) => {
        if (agent) this.items.push({ inverted: step.invert(transaction.docs[i]), index: this.maps.length });
        this.maps.push(step.getMap());
      });
    };
    editor.on('transaction', this.onTransaction);
  }

  get changed() {
    return this.items.length > 0;
  }

  stop() {
    this.editor.off('transaction', this.onTransaction);
  }

  undo() {
    if (!this.items.length) return false;
    const { tr } = this.editor.state;
    for (let k = this.items.length - 1; k >= 0; k -= 1) {
      const { inverted, index } = this.items[k];
      const later = new Mapping(this.maps.slice(index + 1));
      const mapped = inverted.map(later)?.map(tr.mapping);
      if (mapped) tr.maybeStep(mapped);
    }
    this.items = [];
    this.editor.view.dispatch(tr);
    return true;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test --workspace=frontend -- registry`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/ai/tools/index.js frontend/src/ai/runRecorder.js frontend/src/ai/__tests__/registry.test.js
git commit -m "feat(pragna): tool registry and whole-run undo"
```

---

### Task 8: The agent loop hook

**Files:**
- Create: `frontend/src/ai/agentLoop.js`, `frontend/src/ai/useDocumentAgent.js`, `frontend/src/ai/__tests__/agentLoop.test.js`

**Interfaces:**
- Consumes: `TOOL_SCHEMAS`, `executeTool`, `EDITING_TOOLS` (Task 7), `BlockRefs`, `RunRecorder`, `getOutline`, `getSelection`, `aiApi.agentStep` (Task 4).
- Produces:
  - `runAgent({ editor, prompt, history = [], agentStep, onStep, signal, maxSteps = 15 }) -> Promise<{ summary: string, steps: number, suggestions: number, stopped: boolean, recorder: RunRecorder, error?: string }>` — pure of React, testable.
  - `onStep({ kind: 'tool'|'thinking', label: string })`.
  - `useDocumentAgent(editor) -> { run(prompt, history?): Promise<result>, stop(): void, running: boolean, steps: Array<{label}>, lastRun: result|null, undoRun(): boolean }`.

- [ ] **Step 1: Write the failing test**

`frontend/src/ai/__tests__/agentLoop.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createTestEditor } from './testEditor';
import { runAgent } from '@/ai/agentLoop';

const call = (name, args, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

describe('runAgent', () => {
  it('reads, edits and finishes with a summary', async () => {
    const editor = createTestEditor('<p>teh fox</p>');
    const script = [
      (msgs) => ({ content: '', tool_calls: [call('get_outline', {})] }),
      (msgs) => {
        const outline = JSON.parse(msgs[msgs.length - 1].content);
        return { content: '', tool_calls: [call('replace_text', { block_id: outline.blocks[0].id, find: 'teh', replace: 'the' })] };
      },
      () => ({ content: 'Fixed one typo.', tool_calls: [] }),
    ];
    let n = 0;
    const steps = [];
    const result = await runAgent({
      editor,
      prompt: 'fix typos',
      agentStep: async ({ messages }) => ({ success: true, ...script[n++](messages) }),
      onStep: (s) => steps.push(s.label),
    });
    expect(result.summary).toBe('Fixed one typo.');
    expect(result.suggestions).toBe(1);
    expect(steps.some((l) => l.startsWith('Editing'))).toBe(true);
    editor.commands.acceptAllSuggestions();
    expect(editor.getHTML()).toBe('<p>the fox</p>');
  });

  it('feeds tool errors back instead of failing', async () => {
    const editor = createTestEditor('<p>x</p>');
    const seen = [];
    let n = 0;
    await runAgent({
      editor,
      prompt: 'p',
      agentStep: async ({ messages }) => {
        seen.push(messages[messages.length - 1]);
        return n++ === 0
          ? { success: true, content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_blocks', arguments: '{bad' } }] }
          : { success: true, content: 'done', tool_calls: [] };
      },
    });
    expect(seen[1].role).toBe('tool');
    expect(JSON.parse(seen[1].content).error).toMatch(/JSON/);
  });

  it('stops after maxSteps', async () => {
    const editor = createTestEditor('<p>x</p>');
    const result = await runAgent({
      editor, prompt: 'loop', maxSteps: 3,
      agentStep: async () => ({ success: true, content: '', tool_calls: [call('get_outline', {})] }),
    });
    expect(result.steps).toBe(3);
    expect(result.error).toMatch(/step limit/);
  });

  it('honours an abort signal', async () => {
    const editor = createTestEditor('<p>x</p>');
    const controller = new AbortController();
    controller.abort();
    const result = await runAgent({ editor, prompt: 'p', signal: controller.signal, agentStep: async () => ({ success: true, content: 'x', tool_calls: [] }) });
    expect(result.stopped).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=frontend -- agentLoop`
Expected: FAIL — cannot resolve `@/ai/agentLoop`.

- [ ] **Step 3: Implement `frontend/src/ai/agentLoop.js`**

```js
import { TOOL_SCHEMAS, executeTool, EDITING_TOOLS } from '@/ai/tools';
import { BlockRefs } from '@/ai/blockRefs';
import { RunRecorder } from '@/ai/runRecorder';
import { getOutline, getSelection } from '@/ai/tools/readTools';
import { listSuggestionIds } from '@/ai/suggestions';

const SYSTEM_PROMPT = `You are Pragna, an editing assistant working inside the user's open document in EtherxWord.
You change the document only by calling tools; the user reviews your text edits as suggestions.
Rules:
- Read before you edit: use get_outline, find_text or read_blocks to get block ids and exact text.
- Prefer replace_text for small changes; use rewrite_block only when most of a block changes.
- Change only what the user asked for. Keep their language, tone and formatting.
- If the request is ambiguous, ask one short question instead of editing.
- When you are done, reply without tool calls: one short paragraph saying what you changed.`;

const LABELS = {
  get_outline: () => 'Reading outline…',
  read_blocks: (a) => `Reading ${a.ids ? a.ids.length : 'a range of'} block(s)…`,
  find_text: (a) => `Searching for “${String(a.query || '').slice(0, 30)}”…`,
  get_selection: () => 'Reading your selection…',
  read_table: (a) => `Reading table ${a.table_id}…`,
  add_comment: (a) => `Commenting on ${a.block_id}…`,
};
const labelFor = (name, args) => (LABELS[name] ? LABELS[name](args || {}) : `Editing ${args?.block_id || args?.after_id || args?.cell_id || args?.table_id || (args?.ids || []).join(', ')}…`);

function contextMessage(editor, refs, prompt) {
  const ctx = { editor, refs };
  const outline = getOutline({}, ctx);
  const selection = getSelection({}, ctx);
  return `Request: ${prompt}

Document outline (page 1${outline.next_page ? `, more with get_outline page ${outline.next_page}` : ''}):
${JSON.stringify(outline.blocks)}

Selection: ${selection.selected ? JSON.stringify(selection) : 'none'}`;
}

export async function runAgent({ editor, prompt, history = [], agentStep, onStep = () => {}, signal, maxSteps = 15 }) {
  const refs = new BlockRefs(editor);
  const recorder = new RunRecorder(editor);
  const before = new Set(listSuggestionIds(editor.state.doc));
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: contextMessage(editor, refs, prompt) },
  ];
  const ctx = { editor, refs };
  const finish = (extra) => {
    refs.detach();
    recorder.stop();
    const suggestions = listSuggestionIds(editor.state.doc).filter((id) => !before.has(id)).length;
    return { summary: '', steps, suggestions, stopped: false, recorder, ...extra };
  };

  let steps = 0;
  while (steps < maxSteps) {
    if (signal?.aborted) return finish({ stopped: true, summary: 'Stopped.' });
    steps += 1;
    onStep({ kind: 'thinking', label: steps === 1 ? 'Thinking…' : 'Continuing…' });
    let res;
    try {
      res = await agentStep({ messages, tools: TOOL_SCHEMAS });
    } catch (err) {
      return finish({ error: err.message || 'Pragna could not reach the model' });
    }
    if (signal?.aborted) return finish({ stopped: true, summary: 'Stopped.' });
    if (!res?.success) return finish({ error: res?.message || 'Pragna did not return a response' });

    const calls = res.tool_calls || [];
    messages.push({ role: 'assistant', content: res.content || '', ...(calls.length ? { tool_calls: calls } : {}) });
    if (!calls.length) return finish({ summary: res.content || 'Done.' });

    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      onStep({ kind: 'tool', label: labelFor(call.function?.name, args), edits: EDITING_TOOLS.has(call.function?.name) });
      const result = executeTool(call.function?.name, call.function?.arguments, ctx);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return finish({ error: `Stopped at the step limit (${maxSteps}). Changes so far are kept for review.` });
}
```

- [ ] **Step 4: Implement `frontend/src/ai/useDocumentAgent.js`**

```js
import { useCallback, useRef, useState } from 'react';
import { aiApi } from '@/services/api';
import { runAgent } from '@/ai/agentLoop';

export function useDocumentAgent(editor) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const controllerRef = useRef(null);

  const run = useCallback(async (prompt, history = []) => {
    if (!editor || running) return null;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setSteps([]);
    try {
      const result = await runAgent({
        editor,
        prompt,
        history,
        agentStep: (payload) => aiApi.agentStep(payload),
        onStep: (step) => setSteps((prev) => [...prev, step]),
        signal: controller.signal,
      });
      setLastRun(result);
      return result;
    } finally {
      setRunning(false);
      controllerRef.current = null;
    }
  }, [editor, running]);

  const stop = useCallback(() => controllerRef.current?.abort(), []);
  const undoRun = useCallback(() => (lastRun?.recorder ? lastRun.recorder.undo() : false), [lastRun]);

  return { run, stop, running, steps, lastRun, undoRun };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test --workspace=frontend -- agentLoop`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/ai/agentLoop.js frontend/src/ai/useDocumentAgent.js frontend/src/ai/__tests__/agentLoop.test.js
git commit -m "feat(pragna): browser agent loop and hook"
```

---

### Task 9: Sidebar integration and review UI

**Files:**
- Create: `frontend/src/components/sidebar/SuggestionReview.jsx`
- Modify: `frontend/src/components/sidebar/PragnaChatSidebar.jsx` (`handleSendMessage` at line ~417, message rendering at ~1200, quick prompts at ~1502), `frontend/src/components/dialogs/ReviewDialogs.jsx:149-152` (`openComment`)

**Interfaces:**
- Consumes: `useDocumentAgent(editor)` (Task 8); `listSuggestionIds` (Task 2); editor commands `acceptSuggestion`, `rejectSuggestion`, `acceptAllSuggestions`, `rejectAllSuggestions`.
- Produces: `<SuggestionReview editor={editor} />` — review bar (count, Previous, Next, Accept all, Reject all) and the click popover on `[data-suggestion]`.

- [ ] **Step 1: Create `frontend/src/components/sidebar/SuggestionReview.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { listSuggestionIds } from '@/ai/suggestions';

function selectSuggestion(editor, id) {
  const el = editor.view.dom.querySelector(`[data-suggestion="${CSS.escape(id)}"]`);
  if (!el) return;
  const pos = editor.view.posAtDOM(el, 0);
  editor.chain().focus().setTextSelection(pos).run();
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function SuggestionReview({ editor }) {
  const [ids, setIds] = useState([]);
  const [index, setIndex] = useState(0);
  const [popover, setPopover] = useState(null); // { id, x, y }

  useEffect(() => {
    if (!editor) return undefined;
    const refresh = () => setIds(listSuggestionIds(editor.state.doc));
    refresh();
    editor.on('update', refresh);
    const onClick = (event) => {
      const el = event.target.closest?.('[data-suggestion]');
      if (!el) { setPopover(null); return; }
      const rect = el.getBoundingClientRect();
      setPopover({ id: el.getAttribute('data-suggestion'), x: rect.left, y: rect.bottom + 6 });
    };
    editor.view.dom.addEventListener('click', onClick);
    return () => {
      editor.off('update', refresh);
      editor.view.dom.removeEventListener('click', onClick);
    };
  }, [editor]);

  if (!editor || !ids.length) return null;
  const go = (step) => {
    const next = (index + step + ids.length) % ids.length;
    setIndex(next);
    selectSuggestion(editor, ids[next]);
  };
  const act = (command, id) => {
    editor.chain().focus()[command](id).run();
    setPopover(null);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
        <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Pragna changes ({ids.length})</span>
        <button type="button" onClick={() => go(-1)} title="Previous change">‹</button>
        <button type="button" onClick={() => go(1)} title="Next change">›</button>
        <button type="button" onClick={() => act('acceptAllSuggestions')}>Accept all</button>
        <button type="button" onClick={() => act('rejectAllSuggestions')}>Reject all</button>
      </div>
      {popover && (
        <div className="etherx-suggestion-popover" style={{ left: popover.x, top: popover.y }}>
          <button type="button" style={{ background: '#6fcf8f', color: '#10200f' }} onClick={() => act('acceptSuggestion', popover.id)}>✓ Accept</button>
          <button type="button" style={{ background: '#d8443d', color: '#fff' }} onClick={() => act('rejectSuggestion', popover.id)}>✗ Reject</button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Wire the agent into `PragnaChatSidebar.jsx`**

Add imports:

```js
import { useDocumentAgent } from '@/ai/useDocumentAgent';
import { SuggestionReview } from './SuggestionReview';
```

Inside the component, after the existing `useState` hooks:

```js
  const [agentMode, setAgentMode] = useState(true);
  const agent = useDocumentAgent(editor);
```

At the start of `handleSendMessage`, after `if ((!promptToSend && currentAttachments.length === 0) || loading) return;`, route plain requests to the agent (attachments and web search keep the existing chat path):

```js
    if (agentMode && !currentAttachments.length && !webSearchEnabled && editor) {
      const userMsg = { id: `user-${Date.now()}`, role: 'user', content: promptToSend, timestamp: new Date() };
      const history = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.isError && typeof m.content === 'string')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, userMsg]);
      setInputPrompt('');
      setLoading(true);
      try {
        const result = await agent.run(promptToSend, history);
        const text = result?.error
          ? `${result.error}`
          : `${result?.summary || 'Done.'}${result?.suggestions ? `\n\n_${result.suggestions} change(s) to review._` : ''}`;
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`, role: 'assistant', content: text, html: markdownToHtml(text),
          isAgentRun: true, canUndo: Boolean(result?.recorder?.changed), timestamp: new Date(),
        }]);
      } finally {
        setLoading(false);
      }
      return;
    }
```

(If the existing input state setter is named differently than `setInputPrompt`, use the setter paired with `inputPrompt`.)

In the message list render (`messages.map((msg) => …)` around line 1200), after the bubble of an assistant message with `msg.isAgentRun && msg.canUndo`, render:

```jsx
              {msg.isAgentRun && msg.canUndo && (
                <button type="button" onClick={() => agent.undoRun()} style={{ marginTop: 4, fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '2px 8px', cursor: 'pointer' }}>
                  Undo Pragna's changes
                </button>
              )}
```

Directly after the message list, while a run is in progress, render the step lines and Stop:

```jsx
        {agent.running && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 2px' }}>
            {agent.steps.slice(-4).map((s, i) => <div key={i}>{s.label}</div>)}
            <button type="button" onClick={agent.stop} style={{ marginTop: 4, fontSize: 11 }}>Stop</button>
          </div>
        )}
```

Render `<SuggestionReview editor={editor} />` directly above the quick prompts bar (before the `{QUICK_PROMPTS.map(…)}` container).

Add an Agent/Ask toggle next to the existing web-search toggle (around line 848):

```jsx
          <button type="button" onClick={() => setAgentMode((on) => !on)} title={agentMode ? 'Pragna edits the document (suggestions)' : 'Pragna only answers in chat'}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)', background: agentMode ? 'var(--gold-dim)' : 'transparent', color: agentMode ? 'var(--text-gold)' : 'var(--text-secondary)', cursor: 'pointer' }}>
            {agentMode ? 'Edit' : 'Ask'}
          </button>
```

Quick prompts already call `handleSendMessage(qp.prompt)`, so in agent mode they become agent requests automatically. Reword their prompts to say "the selected text, or the whole document if nothing is selected" instead of "the attached text".

- [ ] **Step 3: Comments jump to their anchor** — in `frontend/src/components/dialogs/ReviewDialogs.jsx` replace `openComment`:

```js
  const openComment = (comment) => {
    const editor = useEditorStore.getState().editor;
    const el = comment.anchor && editor?.view.dom.querySelector(`[data-comment-id="${CSS.escape(String(comment.anchor))}"]`);
    if (el) {
      const from = editor.view.posAtDOM(el, 0);
      const to = from + el.textContent.length;
      editor.chain().focus().setTextSelection({ from, to }).run();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      closeDialog('comments');
      return;
    }
    toast(comment.text || 'Comment selected', 'info');
  };
```

Import `useEditorStore` from `@/store` in that file if it is not imported yet. When deleting a comment that has `anchor`, also remove its mark: in the delete handler call

```js
    const editor = useEditorStore.getState().editor;
    if (comment.anchor && editor) {
      const { tr, schema } = editor.state;
      editor.state.doc.descendants((node, pos) => {
        node.marks?.forEach((m) => {
          if (m.type.name === 'commentAnchor' && m.attrs.commentId === comment.anchor) tr.removeMark(pos, pos + node.nodeSize, m);
        });
      });
      editor.view.dispatch(tr);
    }
```

before `deleteComment(comment.id)`.

- [ ] **Step 4: Build and smoke-test**

Run: `cd frontend && npx vite build 2>&1 | tail -1` — Expected: `✓ built in …`
Then with the dev servers running (`npm run dev` in backend, `npx vite` in frontend), open a document, type "make the first paragraph more formal" in Pragna. Expected: step lines appear; green/red suggestions appear in the document; clicking one shows ✓/✗; "Pragna changes (n)" bar works; "Undo Pragna's changes" reverts the run.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/sidebar/SuggestionReview.jsx frontend/src/components/sidebar/PragnaChatSidebar.jsx frontend/src/components/dialogs/ReviewDialogs.jsx
git commit -m "feat(pragna): agent mode in the sidebar with suggestion review"
```

---

### Task 10: Export suggestions

**Files:**
- Create: `frontend/src/services/suggestionHtml.js`, `frontend/src/ai/__tests__/exportSuggestions.test.js`
- Modify: `frontend/src/services/export.js` (`prepareExportHtml` ~line 119, `buildDocxBlob` imports ~line 845 and `walkInline` text-run creation ~line 1010-1030), `frontend/src/services/markdownExport.js:240` (`htmlToMarkdown`), `frontend/src/services/epubExport.js:221,398`

**Interfaces:**
- Produces: `acceptSuggestionsInHtml(html: string): string` — removes `del[data-suggestion]`, unwraps `ins[data-suggestion]` and `span[data-comment-id]`.
- `prepareExportHtml(rawHtml, { keepSuggestions = false })` — accepts suggestions unless `keepSuggestions`.
- `.docx`: text inside `ins[data-suggestion]` → `InsertedTextRun`, inside `del[data-suggestion]` → `DeletedTextRun` (`author`, ISO `date`, numeric `id`).

- [ ] **Step 1: Write the failing test**

`frontend/src/ai/__tests__/exportSuggestions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { acceptSuggestionsInHtml } from '@/services/suggestionHtml';
import { buildDocxBlob } from '@/services/export';

const html = '<p><del data-suggestion="s1" data-author="Pragna">teh</del><ins data-suggestion="s1" data-author="Pragna">the</ins> fox <span data-comment-id="c1">here</span></p>';

describe('export of suggestions', () => {
  it('accepts suggestions for non-docx formats', () => {
    expect(acceptSuggestionsInHtml(html)).toBe('<p>the fox here</p>');
  });

  it('writes Word tracked changes into docx', async () => {
    const blob = await buildDocxBlob(html, {});
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toMatch(/<w:ins [^>]*w:author="Pragna"/);
    expect(xml).toMatch(/<w:del [^>]*w:author="Pragna"/);
    expect(xml).toContain('<w:delText');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace=frontend -- exportSuggestions`
Expected: FAIL — cannot resolve `@/services/suggestionHtml`.

- [ ] **Step 3: Implement `frontend/src/services/suggestionHtml.js`**

```js
// Pending Pragna suggestions shown as if accepted, for exports that have no tracked changes.
export function acceptSuggestionsInHtml(html = '') {
  if (!html || !/data-suggestion|data-comment-id/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('del[data-suggestion]').forEach((el) => el.remove());
  doc.body.querySelectorAll('ins[data-suggestion], span[data-comment-id]').forEach((el) => el.replaceWith(...el.childNodes));
  return doc.body.innerHTML;
}
```

- [ ] **Step 4: Apply it in exports**

In `frontend/src/services/export.js`:
- import: `import { acceptSuggestionsInHtml } from '@/services/suggestionHtml';`
- in `prepareExportHtml(rawHtml = '', options = {})`, change the first assignment to

```js
  let html = stripAutoPageBreaks(options.keepSuggestions ? rawHtml : acceptSuggestionsInHtml(rawHtml))
```

- in `buildDocxBlob`, change `const cleanHtml = prepareExportHtml(rawHtml, options);` to `const cleanHtml = prepareExportHtml(rawHtml, { ...options, keepSuggestions: true });`, add `InsertedTextRun, DeletedTextRun,` to the `await import('docx')` destructuring, and in `walkInline`:
  - before the `if (tag === 'a' …)` branch add

```js
      if ((tag === 'ins' || tag === 'del') && currNode.hasAttribute('data-suggestion')) {
        const revision = {
          kind: tag,
          id: revisionId(currNode.getAttribute('data-suggestion')),
          author: currNode.getAttribute('data-author') || 'Pragna',
          date: currNode.getAttribute('data-created') || new Date().toISOString(),
        };
        currNode.childNodes.forEach((child) => walkInline(child, { ...nextProps, __revision: revision }));
        return;
      }
```

  - replace the text-node branch `runs.push(new TextRun({ text: txt, font: bodyFont, ...currProps }));` with

```js
          const { __revision: revision, ...props } = currProps;
          if (revision) {
            const Run = revision.kind === 'ins' ? InsertedTextRun : DeletedTextRun;
            runs.push(new Run({ text: txt, font: bodyFont, ...props, id: revision.id, author: revision.author, date: revision.date }));
          } else {
            runs.push(new TextRun({ text: txt, font: bodyFont, ...props }));
          }
```

  - next to `parseInlineNodes`, add the id helper:

```js
  const revisionIds = new Map();
  const revisionId = (key) => {
    if (!revisionIds.has(key)) revisionIds.set(key, revisionIds.size + 1);
    return revisionIds.get(key);
  };
```

  - anywhere else in `walkInline` that spreads `currProps`/`nextProps` into a `TextRun` (the `br` branch and link runs), strip `__revision` the same way: `const { __revision, ...rest } = currProps;` and use `rest`.

In `frontend/src/services/markdownExport.js` at the start of `htmlToMarkdown(html)`: `html = acceptSuggestionsInHtml(html);` (add the import).
In `frontend/src/services/epubExport.js` at the start of `exportToEpub` and `buildEpubBlob`: `contentHtml = acceptSuggestionsInHtml(contentHtml);` (add the import).

- [ ] **Step 5: Run to verify it passes**

Run: `npm test --workspace=frontend`
Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/suggestionHtml.js frontend/src/services/export.js frontend/src/services/markdownExport.js frontend/src/services/epubExport.js frontend/src/ai/__tests__/exportSuggestions.test.js
git commit -m "feat(pragna): export suggestions as Word tracked changes"
```

---

### Task 11: End-to-end check on the BIS601 document

**Files:**
- Create (scratch, not committed): a Playwright script in the session scratchpad.

- [ ] **Step 1: Start the app** — backend `cd backend && node server.js`; frontend `cd frontend && npx vite`. Health: `curl -s localhost:5053/api/health` → `{"status":"ok"}`.

- [ ] **Step 2: Run the flow in an isolated headless browser** (Chrome at `/usr/bin/google-chrome-stable` with Playwright from `/home/vinay/OmniRoute/node_modules/playwright`; never the user's own browser session):
  1. Sign in with the local demo account (`POST /api/auth/demo`), import `ISE__VI_FULLSTACK_Development_BIS601_IA_3_Students_All_Questions_Solutions (2).docx` with `docxToHtml`, create a document, open `/doc/<id>`.
  2. In Pragna (Edit mode) send: "Fix the grammar in the answer to question 1. Do not change anything else."
  3. Assert: at least one `[data-suggestion]` exists; every suggestion is inside question 1's answer cell (`t?.r1c1`); no `[data-suggestion]` elsewhere.
  4. Click "Accept all"; assert no `[data-suggestion]` remains and the logo/table structure is unchanged (same number of `img` and `table` elements as before).
  5. Send "Add a comment on the first heading saying 'check marks'" → a `[data-comment-id]` exists and the comments list has an item by Pragna.
  6. Export to `.docx` before accepting a fresh suggestion and convert with `soffice --headless --convert-to pdf`; `unzip -p … word/document.xml | grep -c "<w:ins "` > 0.
  7. Delete the test document.

- [ ] **Step 3: Record results** in the PR / final report (pass/fail per assertion, models used from the step responses).

---

## Self-review notes

- Spec coverage: architecture/data flow → Tasks 4, 8; block ids → 3; tools → 5, 6, 7; suggestions + review UI → 2, 9; comments → 6, 9; export → 10; sidebar UX + limits → 8, 9; testing → every task + 11. Deviations listed at the top.
- Types: `ctx = { editor, refs }` everywhere; tool names identical in `TOOL_SCHEMAS`, `HANDLERS`, tests; `resolveSuggestions` / `applyTextDiff` signatures match Task 2.
- Review Focus tests: rewrite twice (Task 5), user edits during run (Task 3), malformed args (Task 8), whole-paragraph accept/reject (Task 2), exports (Task 10).
