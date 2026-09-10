// ═══════════════════════════════════════════════════════════════
//  ClipboardHistoryDrawer — View and Click-to-Paste Clipboard History
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useUIStore, useEditorStore, useProductivityStore } from '@/store';
import { Modal, Button, Stack, Input, Badge } from '@/components/ui';

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function ClipboardHistoryDrawer() {
  const { closeDialog, toast } = useUIStore();
  const { editor } = useEditorStore();
  const {
    clipboardHistory = [],
    togglePinClipboardItem,
    deleteClipboardItem,
    clearClipboardHistory,
  } = useProductivityStore();

  const [search, setSearch] = useState('');

  const filteredItems = clipboardHistory.filter((item) => {
    if (!search.trim()) return true;
    return (item.text || '').toLowerCase().includes(search.toLowerCase());
  });

  const handlePasteItem = (item) => {
    if (!editor) {
      toast('Editor is not ready', 'error');
      return;
    }
    try {
      if (item.html) {
        editor.chain().focus().insertContent(item.html).run();
      } else {
        editor.chain().focus().insertContent(item.text).run();
      }
      toast('Pasted clip into editor', 'success');
      closeDialog('clipboardHistory');
    } catch (err) {
      console.error(err);
      toast('Failed to paste clip: ' + err.message, 'error');
    }
  };

  const handleCopyAgain = (e, text) => {
    e.stopPropagation();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      toast('Copied to system clipboard', 'info');
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear unpinned items from clipboard history?')) {
      clearClipboardHistory(true);
      toast('Cleared unpinned clipboard history', 'info');
    }
  };

  return (
    <Modal
      title="📋 Clipboard History"
      onClose={() => closeDialog('clipboardHistory')}
      width={560}
    >
      <Stack gap={14}>
        {/* Header toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Click any item to paste at current selection
            </span>
            <Badge color="rgba(212,175,55,0.2)">
              {clipboardHistory.length}/20 items
            </Badge>
          </div>
          {clipboardHistory.length > 0 && (
            <Button variant="ghost" size="xs" onClick={handleClear}>
              Clear Unpinned
            </Button>
          )}
        </div>

        {/* Search */}
        <Input
          value={search}
          onChange={setSearch}
          placeholder="Search clips…"
        />

        {/* List of clips */}
        <div
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingRight: 4,
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12,
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
              }}
            >
              {search
                ? 'No clips matching your search.'
                : 'Clipboard history is empty. Content you copy (Ctrl+C) or cut (Ctrl+X) in EtherX Word will automatically appear here.'}
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handlePasteItem(item)}
                style={{
                  background: item.pinned ? 'rgba(212,175,55,0.08)' : 'var(--bg-elevated)',
                  border: item.pinned ? '1px solid var(--gold)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.1s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = item.pinned
                    ? 'rgba(212,175,55,0.14)'
                    : 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = item.pinned
                    ? 'rgba(212,175,55,0.08)'
                    : 'var(--bg-elevated)';
                }}
              >
                {/* Card Top Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.pinned && (
                      <span style={{ fontSize: 12 }} title="Pinned to top">
                        📌
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatRelativeTime(item.copiedAt)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => handleCopyAgain(e, item.text)}
                      title="Copy to system clipboard"
                    >
                      📄 Copy
                    </Button>
                    <Button
                      variant={item.pinned ? 'primary' : 'subtle'}
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinClipboardItem(item.id);
                      }}
                      title={item.pinned ? 'Unpin clip' : 'Pin clip to top'}
                    >
                      {item.pinned ? 'Pinned 📌' : 'Pin'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClipboardItem(item.id);
                      }}
                      title="Delete from history"
                      style={{ color: '#ef4444' }}
                    >
                      ×
                    </Button>
                  </div>
                </div>

                {/* Text / HTML preview */}
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    maxHeight: 68,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.text || '(empty clip)'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <Button variant="subtle" onClick={() => closeDialog('clipboardHistory')}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
