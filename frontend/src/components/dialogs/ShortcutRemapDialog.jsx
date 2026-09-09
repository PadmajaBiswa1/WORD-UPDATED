import { useState, useEffect, useRef } from 'react';
import { useUIStore, useProductivityStore } from '@/store';
import { Modal, Button, Stack, Input, Label, Badge } from '@/components/ui';

const STORAGE_KEY = 'etherx_custom_shortcuts';

const DEFAULT_SHORTCUTS = [
  { id: 'cmd-bold', name: 'Bold', category: 'Formatting', defaultKey: 'Ctrl+B', currentKey: 'Ctrl+B' },
  { id: 'cmd-italic', name: 'Italic', category: 'Formatting', defaultKey: 'Ctrl+I', currentKey: 'Ctrl+I' },
  { id: 'cmd-underline', name: 'Underline', category: 'Formatting', defaultKey: 'Ctrl+U', currentKey: 'Ctrl+U' },
  { id: 'cmd-find', name: 'Find and Replace', category: 'Editing', defaultKey: 'Ctrl+H', currentKey: 'Ctrl+H' },
  { id: 'cmd-undo', name: 'Undo', category: 'Editing', defaultKey: 'Ctrl+Z', currentKey: 'Ctrl+Z' },
  { id: 'cmd-redo', name: 'Redo', category: 'Editing', defaultKey: 'Ctrl+Y', currentKey: 'Ctrl+Y' },
  { id: 'cmd-selectall', name: 'Select All', category: 'Editing', defaultKey: 'Ctrl+A', currentKey: 'Ctrl+A' },
  { id: 'cmd-spellcheck', name: 'Toggle Spell Check', category: 'Review', defaultKey: 'F7', currentKey: 'F7' },
  { id: 'cmd-comment', name: 'New Comment', category: 'Review', defaultKey: 'Ctrl+Alt+M', currentKey: 'Ctrl+Alt+M' },
  { id: 'cmd-trackchanges', name: 'Toggle Track Changes', category: 'Review', defaultKey: 'Ctrl+Shift+T', currentKey: 'Ctrl+Shift+T' },
  { id: 'cmd-wordcount', name: 'Word Count Dialog', category: 'Review', defaultKey: 'Ctrl+Alt+W', currentKey: 'Ctrl+Alt+W' },
  { id: 'cmd-readability', name: 'Readability Dashboard', category: 'Review', defaultKey: 'Ctrl+Shift+D', currentKey: 'Ctrl+Shift+D' },
  { id: 'cmd-security', name: 'Document Security / Lock', category: 'Access', defaultKey: 'Ctrl+Alt+K', currentKey: 'Ctrl+Alt+K' },
  { id: 'cmd-buildingblocks', name: 'Building Blocks / AutoText', category: 'Productivity', defaultKey: 'F3', currentKey: 'F3' },
  { id: 'cmd-export', name: 'Export Document', category: 'File', defaultKey: 'Ctrl+Shift+S', currentKey: 'Ctrl+Shift+S' },
  { id: 'cmd-copilot', name: 'Toggle Pragna AI Copilot', category: 'AI', defaultKey: 'Alt+I', currentKey: 'Alt+I' },
  { id: 'cmd-help', name: 'Help Dialog', category: 'Help', defaultKey: 'F1', currentKey: 'F1' },
  { id: 'cmd-commandmap', name: 'Keyboard Shortcuts Map', category: 'Help', defaultKey: 'Ctrl+/', currentKey: 'Ctrl+/' },
];

const BROWSER_RESERVED = ['Ctrl+W', 'Ctrl+N', 'Ctrl+T', 'Ctrl+Shift+W', 'Ctrl+Tab'];

export function ShortcutRemapDialog() {
  const { closeDialog, toast } = useUIStore();

  const [shortcuts, setShortcuts] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [recordingId, setRecordingId] = useState(null);
  const [recordedKeys, setRecordedKeys] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);

  const recordingRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with defaults in case new commands were added
          const merged = DEFAULT_SHORTCUTS.map((def) => {
            const match = parsed.find((p) => p.id === def.id);
            return match ? { ...def, currentKey: match.currentKey || def.defaultKey } : def;
          });
          setShortcuts(merged);
          return;
        }
      }
    } catch {
      // fallback
    }
    setShortcuts(DEFAULT_SHORTCUTS);
  }, []);

  const saveShortcuts = (next) => {
    setShortcuts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    const customMap = {};
    next.forEach((s) => {
      if (s.currentKey !== s.defaultKey) {
        customMap[s.id] = s.currentKey;
      }
    });
    const currentCustom = useProductivityStore.getState().customShortcuts || {};
    Object.keys(currentCustom).forEach((k) => {
      if (!customMap[k]) {
        useProductivityStore.getState().removeCustomShortcut(k);
      }
    });
    Object.entries(customMap).forEach(([cmdId, key]) => {
      useProductivityStore.getState().setCustomShortcut(cmdId, key);
    });
  };

  // Keyboard recorder listener
  useEffect(() => {
    if (!recordingId) return undefined;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record standalone modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let keyName = e.key.toUpperCase();
      if (keyName === ' ') keyName = 'Space';
      if (keyName.length === 1) keyName = keyName.toUpperCase();
      parts.push(keyName);

      const combo = parts.join('+');
      setRecordedKeys(combo);

      // Check conflict
      const existing = shortcuts.find((s) => s.id !== recordingId && s.currentKey.toLowerCase() === combo.toLowerCase());
      if (existing) {
        setConflictWarning(`Conflicts with "${existing.name}". Assigning will replace or duplicate.`);
      } else if (BROWSER_RESERVED.includes(combo)) {
        setConflictWarning(`⚠️ Warning: "${combo}" is reserved by most browsers and may be intercepted.`);
      } else {
        setConflictWarning(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingId, shortcuts]);

  const handleStartRecord = (id) => {
    setRecordingId(id);
    setRecordedKeys('');
    setConflictWarning(null);
  };

  const handleApplyRecorded = () => {
    if (!recordingId || !recordedKeys) return;
    const next = shortcuts.map((s) => (s.id === recordingId ? { ...s, currentKey: recordedKeys } : s));
    saveShortcuts(next);
    toast(`Assigned "${recordedKeys}" to shortcut`, 'success');
    setRecordingId(null);
    setRecordedKeys('');
    setConflictWarning(null);
  };

  const handleCancelRecord = () => {
    setRecordingId(null);
    setRecordedKeys('');
    setConflictWarning(null);
  };

  const handleResetSingle = (id) => {
    const next = shortcuts.map((s) => (s.id === id ? { ...s, currentKey: s.defaultKey } : s));
    saveShortcuts(next);
    toast('Shortcut reset to default', 'info');
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all keyboard shortcuts to their default values?')) {
      saveShortcuts(DEFAULT_SHORTCUTS);
      toast('All keyboard shortcuts restored to default', 'success');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(shortcuts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etherx-shortcuts.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Keyboard shortcuts exported', 'success');
  };

  const handleImportJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          saveShortcuts(parsed);
          toast('Custom shortcuts imported successfully', 'success');
        } else {
          toast('Invalid shortcut configuration file', 'error');
        }
      } catch {
        toast('Failed to parse JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const categories = ['All', ...new Set(shortcuts.map((s) => s.category))];

  const filtered = shortcuts.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.currentKey.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || s.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <Modal title="Keyboard Shortcut Remapping" onClose={() => closeDialog('shortcuts')} width={680}>
      <Stack gap={14}>
        {/* Top Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search commands or shortcuts…"
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="subtle" size="xs" onClick={handleExportJson}>
              📥 Export JSON
            </Button>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  fontSize: 11,
                  fontFamily: 'var(--font-ui)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                📤 Import JSON
              </span>
            </label>
            <Button variant="outline" size="xs" onClick={handleResetAll}>
              ↺ Reset Defaults
            </Button>
          </div>
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                background: categoryFilter === cat ? 'var(--gold)' : 'var(--bg-elevated)',
                color: categoryFilter === cat ? 'var(--text-on-gold)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '2px 10px',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontWeight: categoryFilter === cat ? 600 : 400,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Live Keystroke Recording Modal Banner */}
        {recordingId && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(212,175,55,0.12)',
              border: '1px solid var(--gold)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
                  Recording Keystroke for: {shortcuts.find((s) => s.id === recordingId)?.name}
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Press your desired key combination on your keyboard…
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="subtle" size="xs" onClick={handleCancelRecord}>
                  Cancel
                </Button>
                <Button variant="primary" size="xs" disabled={!recordedKeys} onClick={handleApplyRecorded}>
                  Save Shortcut
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  background: '#0a0800',
                  color: '#fae084',
                  border: '1px solid var(--border-gold)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {recordedKeys || 'Waiting for keystroke…'}
              </div>
              {conflictWarning && (
                <div style={{ fontSize: 11, color: '#f87171', fontWeight: 500 }}>
                  {conflictWarning}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shortcuts Table */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            maxHeight: 340,
            overflowY: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Command</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Category</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Current Shortcut</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Default</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const isCustomized = s.currentKey !== s.defaultKey;
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: recordingId === s.id ? 'var(--bg-hover)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge color="rgba(212,175,55,0.18)">{s.category}</Badge>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          background: isCustomized ? 'rgba(212,175,55,0.2)' : 'var(--bg-elevated)',
                          color: isCustomized ? 'var(--text-gold)' : 'var(--text-primary)',
                          border: `1px solid ${isCustomized ? 'var(--gold)' : 'var(--border)'}`,
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {s.currentKey}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                      {s.defaultKey}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => handleStartRecord(s.id)}
                        >
                          Record
                        </Button>
                        {isCustomized && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleResetSingle(s.id)}
                            title="Reset to default"
                          >
                            ↺
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={() => closeDialog('shortcuts')}>
            Done
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
