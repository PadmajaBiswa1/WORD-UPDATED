# Pragna Document Agent — Design

Date: 2026-10-11
Status: Approved in conversation; awaiting written-spec review

## Goal

Make Pragna (the AI sidebar in EtherxWord) work the way Claude works inside Microsoft Word: you ask
in the side panel, and Pragna reads the document's structure, makes targeted edits through tools,
and shows its text changes as tracked suggestions you accept or reject one by one. It keeps the
formatting around what it changes, can format text, work on tables and leave comments.

### What the user said

- "I just want it to function like how Claude in MS Word works."
- Keep the existing Ollama models (no new AI provider or cost).
- Run the agent loop in the browser against the live document (approach A).
- The tool set and the review / suggestion design below were approved as presented.

### Success criteria

- A request such as "fix grammar in question 1's answer" on the BIS601 question bank produces
  word-level suggestions only in that answer; Accept all leaves clean, correctly formatted text.
- Pragna can read a long document by outline and pages instead of receiving the whole text.
- Every text edit Pragna makes is reviewable (accept / reject individually or all at once) and a
  whole run can be undone with one "Undo Pragna's changes" action.
- Formatting, table structure and comments can be changed by request.
- Pending suggestions survive save / reload and export to `.docx` as real Word tracked changes.

### Out of scope (follow-ups)

- The user's own Track Changes mode (the ribbon toggle currently only flips an `insertion` mark).
  This spec builds the marks and review UI it can later reuse.
- Claude / other providers; streaming tokens; multi-document actions.

## Current state (what exists)

- `frontend/src/components/sidebar/PragnaChatSidebar.jsx` (~1900 lines): chat with document /
  selection context, web search, quick prompts, image insert; applies results by
  `insertContent` / `setContent` on whole blocks or the whole document.
- `backend/routes/ai.js`: `/api/ai/action`, `/api/ai/chat`, web tools; gated by
  `requireFeature('aiWritingTools')`.
- `backend/utils/ollamaService.js`: `chatCompletion` calls Ollama's OpenAI-compatible
  `/chat/completions` with key rotation and model fallback (`gemma4:31b`, `gpt-oss:20b`,
  `gpt-oss:120b`, `nemotron-3-nano:30b`), Gemini as last resort. No tool calling today.
- Probe (2026-10-11): all four Ollama models return correct `tool_calls` for a `tools` request.
- Comments are a plain list in the document store (`comments[]`), not anchored to text.

## Architecture

```
PragnaChatSidebar
  └─ useDocumentAgent()                 frontend/src/ai/useDocumentAgent.js   — runs the loop
       ├─ agentTools.js                 frontend/src/ai/agentTools.js         — tool schemas + executors
       ├─ blockRefs.js (PM plugin)      frontend/src/ai/blockRefs.js          — run-scoped block ids
       ├─ suggestions.js (marks + cmds) frontend/src/ai/suggestions.js        — suggestInsert/suggestDelete
       ├─ wordDiff.js                   frontend/src/ai/wordDiff.js           — word-level diff
       └─ POST /api/ai/agent-step       backend/routes/ai.js                  — one model turn
```

Each unit has one job and is testable on its own: the diff is pure; block refs and suggestions are
ProseMirror plugins/commands testable against a headless editor; tools are thin executors over
those; the hook only orchestrates.

### Data flow

1. User sends a request in the sidebar (agent mode is the default; "Ask" stays plain chat).
2. `useDocumentAgent` builds the first message: system rules, tool schemas, and context — title,
   page count, selection (ids + text), and the outline of the first 60 blocks.
3. `POST /api/ai/agent-step { messages, tools, model? }` → backend calls
   `ollamaService.chatCompletion({ messages, tools, ... })` and returns
   `{ content, tool_calls, model }`. Key rotation / model fallback reused. No document state on
   the server.
4. The hook executes each tool call against the live editor and appends a `tool` message with the
   result (JSON, or `{ error }` the model can recover from), then requests the next step.
5. Stops when the model replies without tool calls (that text is the chat summary), after 15
   steps, on Stop, or on an unrecoverable error (changes made so far are kept and reported).

### Block ids (`blockRefs.js`)

- Ids `b1, b2, …` cover textblocks: paragraphs, headings, list-item paragraphs, table-cell
  paragraphs; tables get `t1, t2, …` and cells `t1.r2c3`.
- Assigned lazily when a read tool first reports a block; stored in plugin state as
  `id → position` and mapped through every transaction (`tr.mapping`), so ids stay valid while the
  user types during a run. A block deleted by anyone resolves to `{ error: 'block no longer exists' }`.
- Run-scoped: cleared when the run ends. Never written into the document or saved HTML.

### `/api/ai/agent-step` (backend)

- `router.post('/agent-step', requireFeature('aiWritingTools'), …)`.
- Validates: `messages` array (≤ 60, roles system/user/assistant/tool), `tools` array (≤ 30, schema
  shape only), total body ≤ 1 MB. Rejects otherwise with 400.
- `chatCompletion` gains optional `tools` / `tool_choice`; when present it returns
  `tool_calls` and allows empty `content`. When the response has neither content nor tool calls it
  is an error (existing retry / fallback applies). The Gemini fallback is skipped for tool requests
  (different tool format).
- Timeout 60 s per step (existing).

## Tools

Reading (no changes):

| Tool | Arguments | Returns |
|---|---|---|
| `get_outline` | `page?` (60 blocks per page) | headings, tables, lists with ids + first ~80 chars of each block; `next_page` |
| `read_blocks` | `ids[]` or `from_id`,`to_id` (≤ 40 blocks) | full text per block with type, style, and inline marks as light markdown (`**bold**`, `*italic*`) |
| `find_text` | `query`, `match_case?` | up to 30 hits: block id + ±60-char snippet |
| `get_selection` | — | selected block ids and text (empty if none) |
| `read_table` | `table_id` | rows × columns of cell text with cell ids |

Editing — applied as suggestions:

| Tool | Arguments | Effect |
|---|---|---|
| `replace_text` | `block_id`, `find`, `replace`, `occurrence?` | one phrase replaced inside the block |
| `rewrite_block` | `block_id`, `text` | new text vs old text diffed word-by-word |
| `insert_blocks` | `after_id`, `markdown` | markdown → editor nodes inserted after the block, all marked as insertion |
| `delete_blocks` | `ids[]` | content of those blocks marked as deletion |
| `set_table_cell` | `cell_id`, `text` | cell text diffed like `rewrite_block` |

Structure and formatting — applied directly, part of the run's single undo step:

| Tool | Arguments | Effect |
|---|---|---|
| `format_text` | `block_id`, `find?`, `bold?`, `italic?`, `underline?`, `color?`, `font_size?` | marks on the phrase or whole block |
| `set_block_style` | `ids[]`, `style` (normal, h1–h4), `align?`, `line_spacing?` | block type / alignment / spacing |
| `table_add_row` / `table_add_column` / `table_delete_row` | `table_id`, `index` | table structure |
| `insert_table` | `after_id`, `rows[][]` | new table after the block |
| `add_comment` | `block_id`, `find?`, `text` | anchored comment by "Pragna" |

Rules in the system prompt: read before editing; prefer `replace_text` over `rewrite_block`; never
change text the user did not ask about; keep the document's language and tone; ask a question
instead of guessing when the request is ambiguous; finish with a one-paragraph summary of what
changed.

Tool errors (unknown id, `find` not found, too many blocks) return `{ error }` with a hint and do
not end the run.

## Suggestions (`suggestions.js`, `wordDiff.js`)

- Marks: `suggestInsert` and `suggestDelete`, attrs `{ id, author, createdAt }`, `inclusive: false`.
  Rendered as `<ins data-suggestion=…>` (green underline) and `<del data-suggestion=…>`
  (red strike-through); parsed back from the same HTML so they survive save / reload.
- Word diff: tokenise both texts into words + whitespace + punctuation, LCS diff, then emit runs:
  equal (untouched), deleted (existing text gets `suggestDelete`), inserted (new text inserted with
  `suggestInsert`, inheriting the surrounding text's marks). One suggestion id per contiguous change.
- Commands: `acceptSuggestion(id)`, `rejectSuggestion(id)`, `acceptAll()`, `rejectAll()`,
  `nextSuggestion()` / `prevSuggestion()`. Accept removes deleted text and unmarks insertions;
  reject does the opposite.
- UI: hovering a suggestion shows ✓ / ✗; the sidebar shows "Pragna changes (n)" with Accept all,
  Reject all, Next, Previous.
- Undo: Ctrl+Z still undoes Pragna's edits one tool call at a time (normal history). For the whole
  run, the hook records the steps of every transaction it dispatches; "Undo Pragna's changes"
  applies their inverses in reverse order, mapped through any edits made after them, as one
  transaction (then one Ctrl+Z redoes it).

## Comments

- New mark `commentAnchor { commentId }` (subtle highlight). `add_comment` sets it on the phrase and
  appends `{ id, text, author: 'Pragna', anchor: commentId, timestamp }` to the document store's
  `comments[]` (already saved by `documentStore`). Clicking a comment in the existing comments panel
  scrolls to and selects its anchor. Deleting the comment removes the mark.

## Export

- `.docx` (`services/export.js`): text in `suggestInsert` → `InsertedTextRun`, in `suggestDelete` →
  `DeletedTextRun` (author Pragna, date), so Word shows them as tracked revisions. Comments are not
  exported in this spec.
- PDF / HTML / Markdown / EPUB: pending suggestions rendered as accepted (deleted text removed,
  inserted text plain); anchors stripped.

## Sidebar UX

- Agent mode by default; "Ask" (plain chat, current behaviour) remains.
- During a run: compact step lines ("Reading outline…", "Editing b17…", "Added 3 suggestions"),
  and a Stop button. At the end: Pragna's summary + "Review changes".
- Quick prompts (Executive Summary, Fix Grammar & Flow, …) become agent requests scoped to the
  selection, or the document when nothing is selected.
- Web search and image insert keep working as today.

## Error handling and limits

- 15 steps per run; ≤ 40 blocks per read; 60 s per model step; Stop at any time.
- A failed step ends the run with the reason in chat; changes already made stay (reviewable).
- Plan gating unchanged (`aiWritingTools`).

## Testing

- New frontend dev dependencies: `vitest`, `jsdom` (tests only; not shipped).
- Unit: `wordDiff` cases; `blockRefs` ids stable across inserts/deletes before and after the block;
  suggestion commands accept / reject / all; each tool executor against a headless Tiptap editor
  with the app's extensions.
- Backend (`node --test`): `/agent-step` validation and tool-call passthrough with `chatCompletion`
  mocked.
- End to end (dev server + headless browser): on the BIS601 document, "fix grammar in question 1's
  answer" → suggestions only in that answer → Accept all → text clean, formatting intact; export to
  `.docx` with pending suggestions → LibreOffice shows them as tracked changes.
