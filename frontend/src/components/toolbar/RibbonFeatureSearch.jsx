import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui';
import { useUIStore } from '@/store';
import { ensureRegistered, runCommand, searchCommands } from './commandRegistry';
import { DEFAULT_COMMANDS } from './defaultCommands';

export function RibbonFeatureSearch({ compactWidth = 190, onActivateTab: onActivateTabProp, variant }) {
  const navigate = useNavigate();
  const { openDialog, toast, setActiveTab, setFindQuery } = useUIStore();

  const onActivateTab = onActivateTabProp ?? null;

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

    if (!runCommand(action, { navigate }) && !runCommand(action.id || action.key, { navigate })) {
      toast('Selected feature: ' + action.title, 'info');
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

  // Alt+Q focuses the search, as the top-bar pill advertises.
  useEffect(() => {
    if (variant !== 'pill') return undefined;
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant]);

  const pill = variant === 'pill' && (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, width: 300, maxWidth: '24vw', padding: '0 6px 0 12px', boxSizing: 'border-box', borderRadius: 999, background: 'rgba(var(--ink,255,255,255),0.05)', border: hasFocus ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(var(--ink,255,255,255),0.08)', color: 'var(--t27,#7d7b76)', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'text' }}
    >
      <i className="icon-search" style={{ fontSize: 14 }} />
      <input
        ref={inputRef}
        aria-label="Search commands"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setHasFocus(true); setOpen(true); }}
        onBlur={() => setHasFocus(false)}
        onKeyDown={onKeyDown}
        placeholder="Search"
        style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: 'var(--t19,#ecebe7)', font: 'inherit', padding: 0 }}
      />
      <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 999, background: 'rgba(var(--ink,255,255,255),0.06)', color: 'var(--t26,#85837d)' }}>Alt Q</span>
    </div>
  );

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
      {pill || <div
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
      </div>}

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
