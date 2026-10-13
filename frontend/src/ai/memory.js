// Conversation memory for the agent: what each run changed, and whether the
// user has reviewed those changes since. Block ids are run-scoped, so changes
// are described by the text they touched.

const MAX_QUOTE = 60;

const q = (s) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return `"${t.length > MAX_QUOTE ? `${t.slice(0, MAX_QUOTE - 1)}…` : t}"`;
};

const DESCRIBE = {
  replace_text: (a) => `Replaced ${q(a.find)} with ${q(a.replace)}`,
  replace_all: (a, r) => `Replaced ${q(a.find)} with ${q(a.replace)} everywhere (${r.replaced})`,
  rewrite_block: (a) => `Rewrote a paragraph as ${q(a.text)}`,
  insert_blocks: (a) => `Inserted ${q(a.markdown)}`,
  insert_at_cursor: (a) => `${a.replace_selection ? 'Replaced the selection with' : 'Wrote at the cursor:'} ${q(a.text)}`,
  delete_blocks: (a) => `Deleted ${(a.ids || []).length} block(s)`,
  set_table_cell: (a) => `Set a table cell to ${q(a.text)}`,
  format_text: (a) => `Formatted ${a.block_id === 'all' ? 'the whole document' : a.find ? q(a.find) : 'a paragraph'}`,
  set_block_style: (a) => `Set ${(a.ids || []).length} block(s) to ${[a.style, a.align].filter(Boolean).join(', ') || 'a new style'}`,
  set_list: (a) => (a.kind === 'none' ? 'Removed a list' : `Made a ${a.kind} list`),
  insert_table: (a) => `Inserted a ${(a.rows || []).length}-row table`,
  table_add_row: () => 'Added a table row',
  table_add_column: () => 'Added a table column',
  table_delete_row: () => 'Deleted a table row',
  insert_page_break: () => 'Inserted a page break',
  insert_toc: () => 'Inserted a table of contents',
  add_footnote: (a, r) => `Added footnote [${r.number}]: ${q(a.text)}`,
  set_link: (a) => `Linked ${a.find ? q(a.find) : 'a paragraph'} to ${a.url}`,
  insert_image: (a) => `Inserted an image${a.alt ? ` (${a.alt})` : ''}`,
  set_header_footer: (a) => `Updated the ${[typeof a.header === 'string' && 'header', typeof a.footer === 'string' && 'footer', typeof a.page_numbers === 'boolean' && 'page numbers'].filter(Boolean).join(' and ')}`,
  add_comment: (a) => `Commented ${q(a.text)}`,
  reply_comment: (a) => `Replied to comment ${a.comment_id}: ${q(a.text)}`,
  resolve_comment: (a) => `Resolved comment ${a.comment_id}`,
  resolve_change: (a) => `${a.accept ? 'Accepted' : 'Rejected'} ${a.change_id === 'all' ? 'all tracked changes' : `tracked change ${a.change_id}`}`,
};

/** One line for a successful document change, or null for reads and failures. */
export function describeChange(name, args = {}, result = {}) {
  const describe = DESCRIBE[name];
  if (!describe || !result?.ok || result.unchanged) return null;
  return { text: describe(args || {}, result), ...(result.suggestion_id ? { suggestionId: result.suggestion_id } : {}) };
}

/**
 * Chat messages -> model history. Agent runs carry their change log; each
 * suggestion is marked pending if its id is still in the document.
 */
export function buildHistory(messages, pendingSuggestionIds = new Set(), { limit = 10 } = {}) {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.id !== 'welcome' && !m.isError && typeof m.content === 'string')
    .slice(-limit)
    .map((m) => {
      if (!m.changes?.length) return { role: m.role, content: m.content };
      const lines = m.changes.map((c) => {
        if (!c.suggestionId) return `- ${c.text}`;
        return `- ${c.text} (${pendingSuggestionIds.has(c.suggestionId) ? 'still pending review' : 'accepted or rejected by the user'})`;
      });
      return { role: m.role, content: [m.content, '', 'Changes Pragna made in that run:', ...lines].join('\n') };
    });
}
