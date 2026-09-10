# EtherX Word Feature Roadmap — Phased Design

**Date:** 2026-09-09
**Status:** Proposed design for review
**Scope:** The requested Styles & Structure, Access Control, Pragna AI, Productivity, and Infrastructure features

## 1. Executive summary

EtherX Word already has a React/Vite frontend, a Tiptap editor, Zustand state, a Node/Express backend, MongoDB persistence, document sharing, comments, revision snapshots, collaboration presence, citations, Pragna AI, and HTML/PDF/DOCX export.

The requested features are a coordinated product expansion rather than a collection of isolated toolbar additions. The recommended implementation is divided into six phases:

1. **Foundation:** stabilize the document model, permissions boundary, extension contracts, migrations, and test fixtures.
2. **Styles & Structure:** build reusable styles, multilevel numbering, table styles, generated reference lists, and index generation.
3. **Access & Trust:** enforce Viewer/Commenter/Editor permissions, add protected documents, digital signatures, and mention notifications.
4. **Pragna AI:** add readability, voice commands, citation fact-checking, and per-document tone/persona memory.
5. **Productivity & Output:** add AutoCorrect, dictionaries, AutoText, clipboard history, remappable shortcuts, Markdown, and EPUB export.
6. **Offline & Document Composition:** add PWA/offline storage, merge resolution, and master/subdocument workflows, followed by hardening and staged rollout.

The central architectural decision is to retain the current HTML content field for compatibility while introducing versioned Tiptap JSON as the canonical representation for new capabilities. This is necessary for stable anchors, semantic styles, reference fields, merge operations, encrypted payloads, and master-document composition.

No implementation is included in this document. Each phase below has an explicit boundary, data contract, acceptance criteria, and test strategy so that work can be shipped incrementally.

## 2. Current project baseline

The design is based on the repository at `/home/vinay/WORD-UPDATED`.

### Existing pieces to extend

- `frontend/src/hooks/useEditorSetup.js` configures Tiptap with headings, blockquotes, lists, tables, images, links, formatting, task lists, and pagination-related behavior.
- `frontend/src/store/index.js` contains document, UI, editor, and collaboration Zustand stores.
- `frontend/src/components/toolbar/` already contains Home, Insert, Reference, Review, AI, Design, Layout, View, and related ribbon tabs.
- `frontend/src/components/dialogs/` already contains reference, review, export, share, version history, and Pragna AI dialogs.
- `frontend/src/services/export.js` supports HTML, PDF, and DOCX export.
- `backend/models/Document.js` stores HTML content, sharing entries, comments, versions, design, header/footer, and revision data.
- `backend/lib/documentStore.js` owns document normalization, revisions, versions, access lookup, and sharing mutations.
- `backend/routes/documents.js` exposes document CRUD, versions, sharing, collaboration stream, and collaboration publishing.
- `backend/routes/ai.js` and `frontend/src/components/dialogs/PragnaAiDialog.jsx` provide the existing Pragna conversation flow with optional web search.

### Current gaps that affect the roadmap

- Document routes use request identity headers and query data in several places; permission enforcement must move to authenticated, server-side checks before adding more roles.
- Content is primarily stored as an HTML string. HTML alone is not a reliable source for stable comment anchors, generated fields, structured styles, semantic merges, or encrypted document envelopes.
- Collaboration currently publishes revision-based whole-document changes and returns a conflict response, but there is no user-facing three-way merge experience.
- The existing styles control covers only a subset of the requested quick styles and currently maps some styles directly to heading/font attributes.
- Existing reference functionality includes a table of contents, citations, captions, and local index-related storage, but generated figures/tables lists and a document-scoped index model are not yet first-class document objects.
- Browser clipboard APIs cannot provide unrestricted operating-system clipboard history. The product must implement an in-app history based on explicit copy/cut operations and permitted clipboard reads.

## 3. Product and architecture decisions

### 3.1 Canonical document representation

New and migrated documents use a versioned Tiptap JSON document as the canonical content model:

```js
{
  contentFormatVersion: 2,
  contentJson: { type: 'doc', content: [] },
  content: '<p></p>' // compatibility projection for legacy clients/export paths
}
```

The backend stores both `contentJson` and `content` during the migration period. The frontend hydrates JSON when present and falls back to HTML for legacy documents. Every save writes both projections from one transaction. The HTML projection is never treated as the authoritative source once `contentFormatVersion: 2` is active.

Semantic nodes and attributes use stable IDs where a feature needs an anchor:

- heading and caption IDs for generated references;
- comment anchor IDs for review threads;
- citation IDs for source verification;
- index-entry IDs for generated indexes;
- signature-field IDs for signing and audit records;
- document-part IDs for master/subdocument composition.

IDs are generated in the editor command layer and preserved through serialization, export, and merges.

### 3.2 Feature contracts instead of toolbar-only implementations

Each feature is implemented as a small command/service contract first, then exposed through the ribbon, command palette, keyboard shortcuts, and dialogs as appropriate. For example, `applyStyle(styleId)` is the single command used by the Quick Styles gallery, Style Inspector, keyboard shortcuts, and AI formatting commands.

The existing command registry becomes the source of truth for:

- command IDs and labels;
- default shortcuts;
- required editor state;
- permission requirements;
- whether a command is safe in offline mode;
- telemetry and audit labels.

### 3.3 Server-side authorization is authoritative

The client may hide or disable controls based on the current role, but every document read, write, comment, share, export, AI, signature, and document-part operation is checked by the backend. A caller cannot gain editor rights by changing a role in local state or request headers.

The effective role is one of:

- **Owner:** full control, including sharing and security settings.
- **Editor:** edit content, styles, comments, references, and document metadata permitted by the owner.
- **Commenter:** read content and create/reply to comments and mentions; cannot change document content or resolve another user’s comment unless explicitly granted.
- **Viewer:** read and export only when export is allowed by the document policy.

### 3.4 Protected-document behavior

Password/encryption is designed as client-side document protection, not merely a server flag. The user chooses either a normal server-readable document or a protected document. Protected documents encrypt the document payload before it leaves the browser using an authenticated envelope:

- AES-256-GCM for content encryption;
- a per-document random data-encryption key;
- a passphrase-derived wrapping key using Argon2id where available, with a Web Crypto PBKDF2 fallback;
- a random salt, nonce, KDF parameters, key version, and authentication tag stored with the envelope;
- no plaintext password stored by the client or server.

Protected documents keep only the minimum metadata needed for discovery and access control in plaintext. The server cannot perform server-side full-text search, AI analysis, indexing, or exports until an authorized client unlocks the document. Collaboration and offline sync exchange encrypted envelopes.

### 3.5 Generated fields are explicit document objects

Table of contents, Table of Figures, Table of Tables, and Index are stored as generated-field nodes with a source configuration and last-generated snapshot. They can be refreshed in the editor and regenerated during export. This prevents generated output from being confused with manually typed content.

Page numbers are resolved using the editor’s pagination map. If pagination is unavailable, a generated field shows a clear “update pagination” state rather than silently displaying incorrect numbers.

## 4. Phase map

| Phase | Primary outcome | Requested features | Main dependencies |
|---|---|---|---|
| 0 | Safe platform for structured features | Canonical JSON, migrations, command contracts, permission boundary, test fixtures | Existing Tiptap/store/API |
| 1 | Professional document structure | Quick Styles, Style Inspector, multilevel lists, table styles, Table of Figures/Tables, Index | Phase 0 content model and pagination |
| 2 | Secure collaboration | Encryption/password save, Viewer/Commenter/Editor, signatures, @mentions and notifications | Phase 0 authorization and stable anchors |
| 3 | Document-aware Pragna | Readability dashboard, voice commands, citation fact-checking, tone/persona memory | Phase 1 references and Phase 2 privacy rules |
| 4 | Faster authoring and portable output | AutoCorrect, custom dictionary, AutoText, clipboard history, shortcut remapping, Markdown, EPUB | Command registry and canonical content |
| 5 | Resilient and composable documents | Offline/PWA, merge UI, master documents/subdocuments | Revisions, JSON merge, permissions, generated fields |
| 6 | Release hardening | Accessibility, security review, migration completion, performance, observability, staged rollout | All prior phases |

## 5. Phase 0 — Foundation and migration

### Goal

Create the contracts that let all later features operate on structured content without breaking existing documents or current editor behavior.

### Scope

#### Document model

Extend the document model with:

```js
{
  contentFormatVersion: 2,
  contentJson: Object,
  content: String,
  styles: [StyleDefinition],
  references: {
    citations: [CitationRecord],
    captions: [CaptionRecord],
    indexEntries: [IndexEntryRecord]
  },
  security: SecurityEnvelopeMetadata,
  aiProfile: DocumentAiProfile,
  accessPolicy: AccessPolicy,
  documentParts: [DocumentPartLink],
  revision: Number
}
```

The existing fields remain readable. New fields are optional during migration and receive safe defaults in `normalizeDoc`.

#### Migration path

1. On load, hydrate `contentJson` when present.
2. For legacy HTML-only documents, parse the HTML into Tiptap JSON in the browser or migration job and attach stable IDs to headings, captions, citations, and index markers.
3. Save the JSON and HTML projection on the next successful save.
4. Keep the legacy HTML fallback until every supported client version understands `contentFormatVersion: 2`.
5. Record conversion failures in a migration status field and keep the original HTML unchanged so content is recoverable.

#### Command and extension contracts

Add a shared editor command layer for:

- styles and direct-format clearing;
- list template application;
- table style application;
- generated-field refresh;
- comment anchor creation;
- citation and index markers;
- signature field insertion;
- document-part insertion;
- protected save/unlock state.

Register each command in the existing command registry with required role and offline support metadata.

#### Backend boundary

Introduce authenticated document middleware and a single permission resolver used by REST routes, collaboration publishing, and future offline sync. The resolver receives `(document, user, action)` and returns an allow/deny decision with a stable reason code.

### Acceptance criteria

- Existing HTML-only documents open, edit, save, and export without visible content changes.
- New documents save valid Tiptap JSON and a matching HTML projection.
- Revision conflicts include the server base revision and a machine-readable conflict type.
- Every document route identifies the effective user and action before mutating data.
- A document command can be invoked from the ribbon and command registry without duplicating business logic.

### Tests

- HTML-to-JSON conversion fixtures for headings, lists, tables, images, links, comments, and malformed but recoverable HTML.
- Round-trip JSON-to-HTML-to-JSON tests for supported nodes.
- Authorization matrix tests for every document route and collaboration message type.
- Regression tests for current editor hydration, autosave, version history, and export.

## 6. Phase 1 — Styles & Structure

### Goal

Give users Word-like structural authoring tools that produce semantic, reusable document content.

### 6.1 Quick Styles gallery

Provide built-in styles:

- Normal
- Title
- Subtitle
- Heading 1
- Heading 2
- Heading 3
- Quote
- Emphasis

Each style has a stable ID, semantic type, display preview, and attributes for font family, size, weight, color, spacing, alignment, indentation, and paragraph behavior. Heading styles preserve their outline level independently from visual formatting so the table of contents and generated references remain correct.

The gallery supports applying a style to the current paragraph, selected paragraphs, or the selected text when the style is a character style. A direct-format reset command removes overrides and reapplies the style definition.

### 6.2 Style Inspector / Pane

The inspector shows:

- selected node type and active style;
- inherited style and direct formatting separately;
- effective font, paragraph, spacing, list, and table attributes;
- a command to clear direct formatting;
- a command to update the current style from selection for documents where the user has permission;
- a link to navigate to all occurrences of the style.

The inspector reads editor state rather than the DOM so it continues to work with protected documents and offline content.

### 6.3 Multilevel list numbering

Add list templates with up to nine levels. A template defines the numbering format for each level, such as:

- `1`, `2`, `3`;
- `1.1`, `1.2`, `2.1`;
- `1.1.a`, `1.1.b`, `1.2.a`;
- legal and outline variants with configurable punctuation and indentation.

Nested Tiptap list items store the template ID and level metadata. Rendering uses deterministic counters, and DOCX/HTML/Markdown exporters use the same numbering model. Restart-at-level and continue-numbering commands are explicit so a merge or refresh cannot change numbering unexpectedly.

### 6.4 Table styles gallery

Store a table style ID and table-level options instead of hard-coding cell styling. Built-in choices include:

- header shading;
- banded rows;
- banded columns;
- first/last column emphasis;
- border and accent variants matching the document theme.

The gallery previews each style and applies it to the selected table. Header cells remain semantic table-header nodes. Exporters map the style to HTML classes, DOCX table properties, and EPUB CSS.

### 6.5 Table of Figures and Table of Tables

Captions become structured records with:

```js
{
  id,
  kind: 'figure' | 'table',
  label,
  sequence,
  text,
  targetNodeId,
  includeInGeneratedList: true
}
```

Insert Caption creates the record and attaches it to the target figure or table. The generated-field command creates a Table of Figures or Table of Tables filtered by kind, label, and outline scope. Entries link back to their target IDs and display page numbers from the pagination map.

### 6.6 Index generation

Users mark a selection as an index entry and may provide a main term, subterm, cross-reference, and page-range behavior. Index entries are structured markers, not only localStorage strings. The generated Index field groups case-insensitively, sorts according to the document language, collapses duplicate page numbers, and links each entry back to its marker.

Index refresh runs on demand and automatically before export when the document is not protected or is already unlocked. Protected documents generate the index locally after unlock.

### Phase 1 backend and frontend work

- Add style, caption, index, and generated-field schemas to the document model.
- Add Tiptap extensions for style IDs, caption metadata, generated fields, index marks, and list templates.
- Add style gallery and inspector components under `components/toolbar` and `components/sidebar`.
- Extend Reference tools and export services to consume structured records.
- Add page-map events so generated fields can refresh after pagination changes.

### Acceptance criteria

- A user can apply all eight quick styles and see the same result after reload.
- The inspector differentiates direct formatting from style formatting.
- A nested list renders the same numbering in the editor, HTML, DOCX, Markdown, and EPUB.
- Table style changes survive save/reload and do not remove cell content.
- Figure/table lists contain only structured captions of the requested kind and link to their targets.
- An index can be marked, refreshed, searched, and exported with correct grouping.

### Tests

- Style inheritance and direct-format override unit tests.
- Numbering fixtures covering insertion, deletion, nesting, restart, continuation, and merge-safe serialization.
- Table style render/export snapshots.
- Generated-field refresh tests after adding, deleting, and reordering captions.
- Index tests for duplicates, subentries, cross-references, language sorting, and pagination updates.

## 7. Phase 2 — Access Control and Trust

### Goal

Make document sharing enforceable and add privacy, attribution, and review-notification primitives.

### 7.1 Role-based permissions

Replace role handling based only on client state with persisted access entries and server enforcement. The Share dialog supports Viewer, Commenter, and Editor roles, with Owner displayed separately.

| Action | Owner | Editor | Commenter | Viewer |
|---|---:|---:|---:|---:|
| Read unlocked content | Yes | Yes | Yes | Yes |
| Edit text, structure, and metadata | Yes | Yes | No | No |
| Create/reply to comments | Yes | Yes | Yes | No |
| Resolve comments | Yes | Yes | Own comments by default | No |
| Manage sharing | Yes | No | No | No |
| Change password/encryption | Yes | No | No | No |
| Sign or invalidate document | Yes | Configurable | No | No |
| Export | Policy-controlled | Policy-controlled | Policy-controlled | Policy-controlled |
| Manage subdocuments | Yes | Configurable | No | No |

Document policies can further disable download/export, comments, or copying. The policy is evaluated server-side and mirrored in the client for immediate feedback.

### 7.2 Password/encryption on save

Add a Security dialog with:

- enable protected document;
- set or rotate passphrase;
- unlock for the current session;
- lock immediately;
- show recovery warning and key version;
- export an encrypted backup envelope.

The client encrypts the canonical JSON, generated-field configuration, comments, AI profile, citations, and document-part metadata that the user marks as protected. The server stores the envelope and revision metadata but never receives the passphrase. Autosave writes the encrypted envelope after unlock and locks the local key when the document is locked or the session ends.

Protected mode explicitly disables server-only operations until unlock: backend full-text search, backend AI processing, server-side index generation, and server-side export. The UI explains this instead of silently failing.

### 7.3 Digital signature field

Insert Signature Field creates a structured field with signer, reason, status, and required-signers metadata. Signing computes a hash over canonical content plus signature-field identity, then creates a Web Crypto signature using a key held by the signer’s authenticated client. The server stores the public key, signature, content hash, timestamp, and audit event.

Any content or structural change after signing marks the signature as invalid until the signer signs again. The editor displays valid, invalidated, declined, and pending states. This phase delivers document integrity and approval evidence; regulated identity verification and legally binding e-signature workflows remain outside this scope.

### 7.4 @mentions and notifications

Comments become threaded records with stable anchors and mention metadata:

```js
{
  threadId,
  parentId,
  anchor: { nodeId, from, to, quotedText },
  author,
  body,
  mentions: [{ userId, displayName }],
  resolved,
  createdAt,
  updatedAt
}
```

Typing `@` opens a collaborator picker. Mentions are rendered as non-destructive inline tokens and are preserved when content is re-anchored during a merge. Mentioned users receive in-app notifications and optional email notifications. Notification delivery is idempotent, records the document/thread, and never exposes protected content in email bodies.

### Phase 2 backend and frontend work

- Add authenticated middleware and route-level action checks.
- Normalize roles and migrate existing `sharedWith` entries.
- Add access-policy, security-envelope, signature, notification, and audit schemas.
- Add protected-document client crypto service and lock/unlock store state.
- Replace raw comment mutation with thread/mention APIs while retaining a legacy read adapter.
- Add permission-aware command guards to the ribbon, command palette, keyboard shortcuts, and collaboration publisher.

### Acceptance criteria

- A Commenter cannot mutate document content through REST, collaboration publishing, or a forged client request.
- A Viewer cannot create comments or access a disabled export endpoint.
- A protected document cannot be read as plaintext from server responses or database content fields.
- Wrong passphrases fail authentication without corrupting the document.
- A signature becomes invalid after a signed document changes.
- Mentioned collaborators receive exactly one notification per comment mention event.

### Tests

- Full permission matrix tests at route and collaboration layers.
- Crypto envelope tests for round-trip, wrong password, tampered ciphertext, rotation, lock, and recovery backup.
- Signature verification and invalidation tests.
- Comment anchor, mention parsing, notification deduplication, and protected-content redaction tests.
- Security review for logs, error messages, browser storage, and email payloads.

## 8. Phase 3 — Pragna AI enhancements

### Goal

Make Pragna useful for editing and research while keeping document scope, privacy, and user control explicit.

### 8.1 Readability score dashboard

Add a dashboard that calculates at least:

- Flesch Reading Ease;
- Flesch-Kincaid Grade Level;
- word, sentence, and syllable counts;
- long-sentence and passive-voice indicators where the language supports them.

The score is computed locally from the unlocked canonical document by default. The dashboard supports whole-document and selection scope, shows the formula inputs, and highlights sentences contributing to the score. Scores are labeled as guidance, not an objective quality judgment.

### 8.2 Voice editing commands

Use the browser speech-recognition API when available and provide a typed-command fallback. Voice commands are parsed into a constrained command grammar before execution. Initial commands include:

- insert dictated text;
- select the last sentence/paragraph;
- rewrite selection for clarity/formality/conciseness;
- apply a named style;
- add a comment;
- undo/redo;
- go to heading or page;
- start/stop dictation.

Destructive or externally visible actions require confirmation. Raw audio is not persisted. Transcripts are treated as document input and follow the document’s privacy mode.

### 8.3 AI fact-check on citations

Fact-checking operates on structured citations and claims, not an undifferentiated text prompt. The workflow:

1. Extract a claim associated with a citation.
2. Resolve the citation to its source metadata and URL.
3. Retrieve permitted source content through the existing web tooling or a configured provider.
4. Ask the selected model for a verdict: supported, partially supported, contradicted, unverifiable, or source unavailable.
5. Display evidence snippets, source URLs, retrieval time, and confidence language.
6. Let the user update the citation or mark the result reviewed.

Fact-check results are advisory and never rewrite a citation automatically. Protected documents send only the selected claim and citation details after unlock and explicit confirmation.

### 8.4 Persistent per-document tone/persona memory

Add an AI Profile panel with:

- tone: formal, academic, conversational, technical, marketing, or custom;
- audience and reading level;
- preferred terminology and forbidden terminology;
- response behavior, such as concise or explanatory;
- user-authored instructions and optional example passages;
- reset, export, and delete controls.

The profile is document-scoped and versioned. It is included in AI requests only when the user has access and the document is unlocked. Pragna distinguishes profile instructions from document content and never silently stores chat messages as persona memory. Each AI response shows whether profile memory was applied.

### Phase 3 backend and frontend work

- Add local readability utilities and a dashboard dialog/sidebar.
- Add a voice-command controller tied to the command registry.
- Add citation fact-check endpoints with source-result caching and redaction rules.
- Add versioned document AI profile storage and profile-aware prompt construction.
- Add explicit AI consent, protected-document guards, usage/error states, and source provenance in the Pragna UI.

### Acceptance criteria

- Readability scores update for the selected range without sending protected content to the server.
- Voice commands execute only recognized, permission-allowed commands and ask for confirmation when needed.
- Citation fact-check results always show source, retrieval time, and a non-authoritative verdict.
- A document’s AI profile persists across reloads and is isolated from another document’s profile.
- Clearing an AI profile removes it from future prompts and stored document data.

### Tests

- Readability formula fixtures with known scores and multilingual fallback behavior.
- Voice parser tests for aliases, ambiguity, confirmation, and permission denial.
- Citation fact-check tests with mocked source retrieval, unavailable sources, stale cache, and protected documents.
- Prompt-construction tests proving profile isolation and protected-content redaction.

## 9. Phase 4 — Productivity and Output

### Goal

Reduce repetitive authoring work and make structured documents portable outside EtherX Word.

### 9.1 AutoCorrect and custom dictionary

Provide built-in correction rules plus user-managed rules with:

- trigger text;
- replacement text;
- case behavior;
- language scope;
- enable/disable state.

The custom dictionary supports add-to-dictionary from the spelling UI, import/export, per-language dictionaries, and document exceptions. Corrections are applied through Tiptap input rules and paste normalization, with an undoable transaction and a visible “reverted AutoCorrect” action.

### 9.2 AutoText / building blocks

Building blocks are named structured snippets that may contain text, styles, lists, tables, images, and generated fields. Store them as Tiptap JSON plus preview metadata, not only HTML. Support:

- create from selection;
- insert at cursor;
- rename, categorize, and delete;
- user-level and organization-level scope;
- permission-controlled shared blocks;
- update block without silently changing existing insertions.

### 9.3 Multi-item clipboard history

The in-app clipboard captures explicit copy and cut operations, preserving text, HTML, and a sanitized Tiptap fragment where available. Store up to 20 recent items in IndexedDB, with pin, delete, clear-all, and paste-as-plain-text actions. Do not promise access to clipboard data copied outside the app unless the browser explicitly grants a read.

### 9.4 Keyboard shortcut remapping panel

Use the command registry as the remapping source. The panel supports:

- search by command name;
- record a shortcut;
- conflict detection and resolution;
- reset one shortcut or all shortcuts;
- import/export JSON;
- warnings for browser, operating-system, and accessibility-reserved combinations.

Shortcuts are stored per user and applied only when the current editor, role, and platform permit them.

### 9.5 Markdown export

Export canonical JSON to Markdown with deterministic rules for headings, emphasis, links, lists, tables, code, images, citations, captions, footnotes, and generated fields. Include a front-matter block for document title, author, and export metadata. Unsupported visual-only formatting is represented by a readable HTML fallback or a warning report.

### 9.6 EPUB export

Generate a valid EPUB 3 package:

- required `mimetype` entry;
- `META-INF/container.xml`;
- package metadata and manifest;
- navigation document;
- one or more XHTML content chapters;
- embedded images and CSS;
- accessible headings, landmarks, and alt text.

Chapter boundaries derive from Heading 1 styles, with a single-chapter fallback. Table of contents and document metadata are generated from the same structure used by the editor. Export runs locally for unlocked documents and reports missing assets or unsupported elements before download.

### Phase 4 backend and frontend work

- Add user preference and building-block persistence endpoints.
- Add IndexedDB storage for clipboard history and offline-safe preferences.
- Extend the command registry and shortcut listener.
- Add Markdown and EPUB exporters driven by canonical JSON.
- Add export diagnostics so users can review unsupported content before downloading.

### Acceptance criteria

- AutoCorrect is undoable and does not alter content in protected areas without permission.
- Building blocks preserve structure and formatting after insertion.
- Clipboard history survives a page reload and supports plain-text paste.
- Shortcut conflicts are shown before save and do not break default commands.
- Markdown output is deterministic across repeated exports.
- EPUB files open in a standards-compliant reader and include navigation and accessible headings.

### Tests

- AutoCorrect transaction and language-scope tests.
- Building-block JSON round-trip and permission tests.
- Clipboard history quota, sanitization, pinning, and clear tests.
- Shortcut conflict and reserved-key tests.
- Golden-file Markdown and EPUB package tests, including images, tables, citations, and generated fields.

## 10. Phase 5 — Offline mode, conflict resolution, and document composition

### Goal

Allow users to keep working without connectivity and compose large documents from governed parts without losing edits.

### 10.1 Offline mode / PWA

Add a web app manifest, service worker, install metadata, cached application shell, and an IndexedDB document cache. Each local document record includes:

- encrypted or plaintext content according to document security mode;
- last server revision;
- local revision and operation metadata;
- pending mutations;
- sync status and last error.

The editor clearly shows Online, Offline, Syncing, Conflict, and Read-only states. Offline edits are queued as semantic document updates rather than blind replacement requests when possible. Protected documents remain encrypted at rest in IndexedDB. The service worker never caches document content in a public cache.

### 10.2 Conflict-resolution merge UI

When a save or sync encounters a revision mismatch, show a three-way merge view with:

- Base: the revision the user edited;
- Local: the user’s unsynced content;
- Remote: the current server content.

Merge operates at block level first, then uses text-level diffs inside conflicting blocks. The user can choose local, remote, or manual combination for each conflict. Comments, citations, signatures, styles, generated fields, and document-part links are merged as typed metadata with explicit conflict rules. A merge preview never changes the document until the user confirms.

After confirmation, the client submits the resolved canonical JSON with the server revision it reconciled. The server creates a merge revision and preserves all three inputs in version history. Silent last-write-wins is not permitted for user-authored content.

### 10.3 Master documents and subdocuments

Introduce a document graph:

```js
{
  masterDocumentId,
  partId,
  partType: 'master' | 'subdocument',
  order,
  title,
  linkedDocumentId,
  includeMode: 'linked' | 'snapshot',
  permissionsInherited: true
}
```

The master document contains document-part nodes with stable links. A linked part renders current subdocument content after refresh; a snapshot part records the version used at insertion. Users can open a subdocument in its own editor, refresh the master, detach a part, reorder parts, and inspect stale or broken links. The backend prevents cycles and checks permissions for both the master and every linked child.

Generated fields operate across the composed view. Headings, captions, citations, and index entries receive source-part metadata so links and page numbers remain unambiguous. Export produces one combined artifact with predictable chapter and numbering behavior.

### Phase 5 backend and frontend work

- Add PWA shell, service worker, IndexedDB storage, sync queue, and document status UI.
- Add revision fetch, merge preview, merge commit, and merge history APIs.
- Add typed JSON merge utilities and conflict decorations.
- Add document graph schemas, cycle detection, permission inheritance, refresh/detach commands, and composed export.
- Ensure all generated fields can rebuild after offline edits, merges, or part refreshes.

### Acceptance criteria

- A user can open a previously cached document, edit it, close the tab, and sync later.
- Protected content is not written to an unencrypted public browser cache.
- A stale save opens a three-way merge view and never silently overwrites remote edits.
- A merge preserves or explicitly resolves comments, captions, styles, citations, and signatures.
- A master document can include linked and snapshot subdocuments, refresh them, detect cycles, and export the composed result.

### Tests

- Service-worker cache and offline editor tests using a browser test harness.
- Sync queue retry, ordering, duplicate delivery, lock/unlock, and network interruption tests.
- Three-way merge fixtures for insertions, deletions, moved blocks, formatting, comments, and signatures.
- Document graph cycle, permission inheritance, stale link, refresh, detach, and composed export tests.

## 11. Phase 6 — Hardening and release

### Accessibility and UX

- Keyboard access for every gallery, pane, dialog, generated field, and merge action.
- Screen-reader labels for role, sync, signature, AI, and conflict states.
- Visible focus states and reduced-motion support.
- Color-independent indicators for readability, permissions, signatures, and sync health.
- Accessible EPUB output with heading order and alt-text validation.

### Security and privacy

- Threat-model document sharing, protected envelopes, collaboration, notifications, AI requests, service workers, and exports.
- Remove sensitive content from server logs, analytics payloads, email notifications, and error responses.
- Rotate and revoke sessions, access entries, encryption keys, and signing keys.
- Rate-limit authentication, unlock attempts, sharing, AI, fact-check, and notification endpoints.
- Run dependency, static-analysis, and browser-storage audits before protected-document release.

### Reliability and performance

- Measure editor load time, JSON conversion time, pagination latency, generated-field refresh, merge size, offline queue depth, and export duration.
- Use background or incremental work for readability, indexing, thumbnails, and large-document generation.
- Cap or paginate large history, notification, and building-block datasets.
- Preserve a recoverable local draft when migration, encryption, export, or merge fails.

### Rollout

1. Ship Phase 0 behind migration telemetry and a legacy fallback.
2. Release Phase 1 to all users after round-trip and export validation.
3. Release role enforcement before adding more collaboration features; audit existing shared documents during migration.
4. Gate protected documents, signatures, and AI fact-checking behind explicit opt-ins until security review is complete.
5. Release productivity exports and PWA support with feature flags and clear unsupported-content diagnostics.
6. Enable master/subdocuments after merge reliability and composed export tests meet release thresholds.
7. Remove HTML-only writes only after supported-client adoption and backup verification are complete.

## 12. API and storage outline

The exact route names may follow current conventions, but the capabilities should be separated as follows:

### Document and structure

- `GET /api/documents/:id` — hydrated document plus effective policy.
- `PUT /api/documents/:id` — canonical save with expected revision.
- `POST /api/documents/:id/structure/refresh` — refresh generated fields.
- `GET /api/documents/:id/revisions/:revision` — retrieve a merge base.

### Access and security

- `GET /api/documents/:id/access`
- `POST /api/documents/:id/access`
- `PATCH /api/documents/:id/access/:entryId`
- `DELETE /api/documents/:id/access/:entryId`
- `POST /api/documents/:id/security/rotate`
- `POST /api/documents/:id/signatures/:fieldId/verify`

### Comments and notifications

- `GET /api/documents/:id/comments`
- `POST /api/documents/:id/comments`
- `PATCH /api/documents/:id/comments/:threadId`
- `GET /api/notifications`
- `POST /api/notifications/:id/read`

### AI

- `POST /api/ai/readability` only for explicitly permitted, unlocked content when server computation is selected.
- `POST /api/ai/fact-check`
- `GET/PATCH /api/documents/:id/ai-profile`
- `POST /api/ai/command` for commands that require the existing Pragna backend.

### Offline, merge, and composition

- `POST /api/documents/:id/sync`
- `POST /api/documents/:id/merge/preview`
- `POST /api/documents/:id/merge/commit`
- `GET/POST /api/documents/:id/parts`
- `POST /api/documents/:id/parts/:partId/refresh`
- `POST /api/documents/:id/parts/:partId/detach`

All mutation routes accept an expected revision or equivalent idempotency key where a retry could duplicate a mutation.

## 13. Cross-phase testing strategy

### Unit tests

Cover style resolution, numbering, generated fields, index sorting, permission decisions, crypto envelopes, signature hashes, readability formulas, voice parsing, AutoCorrect, serialization, Markdown/EPUB output, JSON merges, and document graph validation.

### Integration tests

Exercise browser-to-API flows for hydration, autosave, sharing, role changes, comments, mentions, protected save/unlock, AI profile application, offline sync, conflict resolution, and composed export.

### End-to-end browser tests

Use a real editor instance to verify selection behavior, pagination, keyboard shortcuts, dialogs, generated-field navigation, service-worker offline state, merge decisions, and accessibility semantics.

### Data and migration tests

Maintain fixtures for current HTML documents and verify:

- content remains readable after migration;
- old clients can still open supported documents during the compatibility window;
- failed conversions preserve the original payload;
- encrypted backups can restore content;
- exports before and after migration are semantically equivalent.

### Required release gates

- zero authorization bypasses in the role matrix;
- zero plaintext leakage for protected payloads;
- deterministic canonical JSON serialization;
- no silent data loss in merge fixtures;
- WCAG-oriented keyboard and screen-reader checks for new surfaces;
- successful HTML, PDF, DOCX, Markdown, and EPUB export fixtures.

## 14. Out of scope for this roadmap

- Full legally binding e-signature identity verification, certificate authority integration, or regulated signature compliance.
- Real-time CRDT replacement of the current revision-based collaboration model. The merge UI is the first safe step; a CRDT can be evaluated later if editing scale requires it.
- Server-side OCR, grammar models, or a new AI provider unrelated to the requested Pragna workflows.
- Native desktop or mobile clients. The PWA remains the first offline target.

## 15. Definition of done for the roadmap

The roadmap is complete when all requested features are available through the appropriate editor surfaces, persist through reload and migration, respect server-side permissions, work with the canonical document model, produce tested exports, preserve protected-document privacy, and have documented offline/merge behavior. Each phase must meet its acceptance criteria and release gates before the next phase is enabled by default.
