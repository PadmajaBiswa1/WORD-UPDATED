import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { ensureRegistered, searchCommands } from './commandRegistry';
import { DEFAULT_COMMANDS } from './defaultCommands';

export function RibbonFeatureSearch({ compactWidth = 190, onActivateTab: onActivateTabProp }) {
  const navigate = useNavigate();
  const {
    openDialog,
    closeDialog,
    toast,
    setActiveTab,
    watermarkText,
    setWatermarkText,
    setFindQuery,
    openPragna,
    toggleRuler,
    toggleGridlines,
    toggleSidebar,
    toggleFullscreen,
    setZoom,
    zoom,
    setPageOrientation,
    pageOrientation,
    setHeaderFooterTab,
    setDrawTool,
    toggleFormattingMarks,
  } = useUIStore();

  const onActivateTab = onActivateTabProp ?? null;
  const { editor } = useEditorStore();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    ensureRegistered();
  }, []);

  // Registry-backed results
  const filtered = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Default suggestions when search input is focused but empty
      return DEFAULT_COMMANDS.slice(0, 12);
    }
    return searchCommands(trimmed, { limit: 16 });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
  }, [query, open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDown = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) {
        setOpen(false);
        setHasFocus(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const runAction = (action) => {
    if (!action) return;

    setOpen(false);
    setQuery('');
    setActiveIdx(0);

    const tab = action.tab;

    // Switch tab so user sees where this feature lives on the ribbon
    if (tab) {
      if (tab === 'file') {
        onActivateTab?.('file');
      } else {
        onActivateTab?.(tab);
        setActiveTab(tab);
      }
    }

    // Build the execution context with all live stores & methods
    const context = {
      editor,
      openDialog,
      closeDialog,
      toast,
      setActiveTab,
      watermarkText,
      setWatermarkText,
      openPragna,
      setFindQuery,
      navigate,
      toggleRuler,
      toggleGridlines,
      toggleSidebar,
      toggleFullscreen,
      setZoom,
      zoom,
      setPageOrientation,
      pageOrientation,
      setHeaderFooterTab,
      setDrawTool,
      toggleFormattingMarks,
      toggleSpellCheck: useEditorStore.getState().toggleSpellCheck,
      spellCheck: useEditorStore.getState().spellCheck,
      addComment: useDocumentStore.getState().addComment,
      toggleTrackChanges: useDocumentStore.getState().toggleTrackChanges,
      trackChanges: useDocumentStore.getState().trackChanges,
      setDesign: useDocumentStore.getState().setDesign,
      getDesign: () => useDocumentStore.getState().design,
      designPopover: useUIStore.getState().designPopover,
      setDesignPopover: useUIStore.getState().setDesignPopover,
      pageBordersModalOpen: useUIStore.getState().pageBordersModalOpen,
      setPageBordersModalOpen: useUIStore.getState().setPageBordersModalOpen,
    };

    // DIRECTLY EXECUTE the feature
    try {
      if (typeof action.run === 'function') {
        action.run(context);
        return;
      }

      // Fallback matching by ID if run is missing
      const id = action.id || action.key;
      const matched = DEFAULT_COMMANDS.find((c) => c.id === id);
      if (matched && typeof matched.run === 'function') {
        matched.run(context);
      } else {
        toast('Selected feature: ' + action.title, 'info');
      }
    } catch (e) {
      console.error('Feature execution error:', e);
      toast('Could not execute this feature', 'error');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIdx(0);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }

    if (e.key === 'Enter') {
      if (filtered.length > 0) {
        e.preventDefault();
        runAction(filtered[activeIdx] || filtered[0]);
      } else if (query.trim()) {
        e.preventDefault();
        setOpen(false);
        setFindQuery(query.trim());
        openDialog('findReplace');
      }
      return;
    }
  };

  const showDropdown = open && filtered.length > 0;

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: hasFocus ? 260 : compactWidth,
          transition: 'width 140ms ease',
        }}
        onMouseEnter={() => setHasFocus(true)}
        onMouseLeave={() => {
          if (!open) setHasFocus(false);
        }}
      >
        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
          <svg
            style={{
              position: 'absolute',
              left: 9,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 13,
              height: 13,
              color: hasFocus ? 'var(--gold)' : 'var(--text-muted)',
              pointerEvents: 'none',
              transition: 'color 0.12s ease',
              zIndex: 2,
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <Input
            value={query}
            onChange={(v) => {
              setQuery(v);
              setOpen(true);
            }}
            onFocus={() => {
              setHasFocus(true);
              setOpen(true);
            }}
            placeholder={hasFocus ? "Type a feature, command, or action..." : "Tell me what to do..."}
            width="100%"
            type="text"
            autoFocus={false}
            onKeyDown={onKeyDown}
            style={{
              padding: '4px 10px 4px 30px',
              height: 25,
              fontSize: 11,
              borderRadius: 4,
              border: hasFocus ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}
          />
        </div>
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 34,
            width: hasFocus ? 400 : compactWidth,
            maxWidth: 520,
            maxHeight: 380,
            overflowY: 'auto',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{query.trim() ? `Search Results (${filtered.length})` : 'Popular Commands'}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>Press Enter to run</span>
          </div>

          {filtered.map((a, idx) => {
            const active = idx === activeIdx;
            return (
              <button
                key={a.id || a.key || a.title}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runAction(a)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '7px 10px',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.08s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.title}
                  </span>
                  {a.group && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      • {a.group}
                    </span>
                  )}
                </div>
                {a.tab && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--gold, #c9a84c)',
                      border: '1px solid rgba(201, 168, 76, 0.3)',
                      background: 'rgba(201, 168, 76, 0.08)',
                      padding: '2px 7px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      fontWeight: 500,
                    }}
                  >
                    {a.tab === 'file' ? 'File' : a.tab === 'ai' ? 'AI' : a.tab[0].toUpperCase() + a.tab.slice(1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
