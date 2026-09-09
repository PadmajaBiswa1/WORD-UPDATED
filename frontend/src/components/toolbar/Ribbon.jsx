import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useUIStore, useEditorStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { HomeTab }      from './tabs/HomeTab';
import { InsertTab }    from './tabs/InsertTab';
import { DrawTab }      from './tabs/DrawTab';
import { DesignTab }    from './tabs/DesignTab';
import { LayoutTab }    from './tabs/LayoutTab';
import { ReferenceTab } from './tabs/ReferenceTab';
import { MailingsTab }  from './tabs/MailingsTab';
import { ReviewTab }    from './tabs/ReviewTab';
import { ViewTab }      from './tabs/ViewTab';
import { AITab }        from './tabs/AITab';
import { HelpTab }      from './tabs/HelpTab';
import { RibbonFeatureSearch } from './RibbonFeatureSearch';

const TABS = [
  { id: 'file',      label: 'File'      },
  { id: 'home',      label: 'Home'      },
  { id: 'insert',    label: 'Insert'    },
  { id: 'draw',      label: 'Draw'      },
  { id: 'design',    label: 'Design'    },
  { id: 'layout',    label: 'Layout'    },
  { id: 'reference', label: 'References'},
  { id: 'mailings',  label: 'Mailings'  },
  { id: 'review',    label: 'Review'    },
  { id: 'view',      label: 'View'      },
  { id: 'help',      label: 'Help'      },
];

const TAB_CONTENT = {
  home: HomeTab, insert: InsertTab, draw: DrawTab, design: DesignTab,
  layout: LayoutTab, reference: ReferenceTab, mailings: MailingsTab,
  review: ReviewTab, view: ViewTab, ai: AITab, help: HelpTab,
};

export function Ribbon() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTab, setActiveTab, openDialog } = useUIStore();
  const Content = TAB_CONTENT[activeTab] || HomeTab;

  const ribbonContainerRef = useRef(null);
  const ribbonContentRef = useRef(null);
  const ribbonMeasureContentRef = useRef(null);
  const overflowBtnRef = useRef(null);
  const overflowWrapperRef = useRef(null);
  const overflowMeasureRef = useRef(null);
  const tabWidthsCache = useRef({});
  const popoverRef = useRef(null);

  const [visibleCount, setVisibleCount] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Calculate which groups fit based on *actual* rendered widths.
  // Fixes: premature overflow when we over-subtract padding or use stale measurements.
  const computeVisible = useCallback(() => {
    const container = ribbonContainerRef.current;
    const content = ribbonContentRef.current;
    if (!container || !content) return;

    const children = Array.from(content.children);
    if (children.length === 0) return;

    // Measure each group’s rendered width (avoid cached widths).
    // Note: we include the label/caption row in width via the group’s actual box.
    const GAP = Number.parseFloat(window.getComputedStyle(content).gap) || 6;
    const tolerance = 0.5;

    const widths = children.map((c) => {
      const rect = c.getBoundingClientRect();
      return Math.ceil(rect.width || c.offsetWidth || 0);
    });

    const count = widths.length;
    setTotalCount(count);

    // Inline rail width is what the groups currently have when overflow button
    // is NOT taking space (this is the gap we’re trying to fill).
    const inlineAvailable = Math.floor(content.getBoundingClientRect().width);

    const requiredInlineWidth = widths.reduce((sum, w) => sum + w, 0) + (count - 1) * GAP;
    if (requiredInlineWidth <= inlineAvailable + tolerance) {
      setVisibleCount(count);
      return;
    }

    // When overflow is needed, main rail must make room for the overflow button.
    // Measure the actual overflow button width when it’s rendered.
    const overflowMeasureEl = overflowMeasureRef.current;
    const overflowWidth = overflowMeasureEl
      ? Math.ceil(overflowMeasureEl.getBoundingClientRect().width)
      : 96;

    const availableWithBtn = inlineAvailable - overflowWidth;

    let runningWidth = 0;
    let fitCount = 0;
    for (let i = 0; i < widths.length; i++) {
      const nextWidth = runningWidth + widths[i] + (i > 0 ? GAP : 0);
      if (nextWidth <= availableWithBtn + tolerance) {
        runningWidth = nextWidth;
        fitCount = i + 1;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(1, fitCount));
  }, [activeTab]);

  // When activeTab changes, close overflow and prepare for measurement
  useEffect(() => {
    setOverflowOpen(false);
    if (!tabWidthsCache.current[activeTab]) {
      setVisibleCount(null);
    } else {
      computeVisible();
    }
  }, [activeTab, computeVisible]);

  // Measure children when visibleCount is reset to null
  useLayoutEffect(() => {
    if (visibleCount === null) {
      computeVisible();
    }
  }, [visibleCount, computeVisible]);

  // Listen for container resize
  useEffect(() => {
    const container = ribbonContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      computeVisible();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeVisible]);

  // Close popover on outside click or Escape key
  useEffect(() => {
    if (!overflowOpen) return;
    const onMouseDown = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        overflowBtnRef.current &&
        !overflowBtnRef.current.contains(e.target)
      ) {
        setOverflowOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [overflowOpen]);

  const onTabClick = (id) => {
    if (id === 'file') {
      navigate('/home', { state: { returnTo: location.pathname } });
      return;
    }
    setActiveTab(id);
  };
  const ribbonVars = {
    '--ribbon-surface': 'var(--bg-surface)',
    '--ribbon-surface-2': 'var(--bg-elevated)',
    '--ribbon-ink': 'var(--text-primary)',
    '--ribbon-divider': 'var(--border)',
    '--ribbon-hover': 'var(--bg-hover)',
  };

  return (
    <div style={{ flexShrink: 0, ...ribbonVars }}>
      {/* ── Tab strip ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 30,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-app)',
          fontFamily: 'var(--font-ui)',
          gap: 0,
        }}
      >
        {/* Scrollable tabs container */}
        <div
          className="ribbon-scroll"
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            padding: '0 8px',
            gap: 2,
            overflowX: 'auto',
            overflowY: 'hidden',
            minWidth: 0,
          }}
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            const isFile = t.id === 'file';
            return (
              <button
                key={t.id}
                onClick={() => onTabClick(t.id)}
                style={{
                  background: isFile ? '#1e1400' : active ? 'var(--bg-elevated)' : 'transparent',
                  border: '1px solid transparent',
                  borderTop: active ? '2px solid var(--gold)' : '2px solid transparent',
                  borderRadius: 2,
                  color: isFile ? 'var(--gold)' : active ? 'var(--text-primary)' : 'var(--gold)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  padding: '0 12px',
                  height: 28,
                  cursor: 'pointer',
                  transition: 'background 0.1s, border-color 0.1s',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--ribbon-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Feature search bar and quick actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 30,
            paddingRight: 6,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-app)',
            flexShrink: 0,
            gap: 4,
          }}
        >
          <RibbonFeatureSearch onActivateTab={(id) => setActiveTab(id)} />
          <button
            onClick={() => openDialog('shortcuts')}
            title="Remap Keyboard Shortcuts"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 13,
              padding: '2px 6px',
              borderRadius: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            ⌨
          </button>
          <button
            onClick={() => openDialog('help')}
            title="Help & Reference (F1)"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 13,
              padding: '2px 6px',
              borderRadius: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            ?
          </button>
        </div>

      </div>


      {/* ── Ribbon content container with responsive overflow ── */}
      <div
        ref={ribbonContainerRef}
        style={{
          position: 'relative',
          background: 'var(--ribbon-surface)',
          borderBottom: '1px solid var(--border)',
          minHeight: 92,
          display: 'flex',
          alignItems: 'stretch',
          padding: '2px 8px 0',
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        {/* Dynamic style rules for active tab to hide overflowed groups in main row and shown groups in popover */}
        {visibleCount !== null && (
          <style>
            {`
              .ribbon-main-${activeTab} > :nth-child(n + ${visibleCount + 1}) {
                display: none !important;
              }
              .ribbon-overflow-${activeTab} > :nth-child(-n + ${visibleCount}) {
                display: none !important;
              }
            `}
          </style>
        )}

        {/* Main row */}
        <div
          ref={ribbonContentRef}
          className={`ribbon-main-row ribbon-main-${activeTab}`}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 6,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Content />
        </div>

        {/* "··· More" trigger button when content overflows container */}
        {visibleCount !== null && totalCount > visibleCount && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 4,
              flexShrink: 0,
            }}
          >
            <button
              ref={overflowBtnRef}
              onClick={() => setOverflowOpen((prev) => !prev)}
              aria-label="More ribbon options"
              aria-expanded={overflowOpen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 72,
                padding: '0 10px',
                borderRadius: 4,
                border: overflowOpen ? '1px solid var(--gold)' : '1px solid var(--border)',
                background: overflowOpen ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                color: overflowOpen ? 'var(--gold)' : 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold)';
                e.currentTarget.style.color = 'var(--gold)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!overflowOpen) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }
              }}
              title="More ribbon groups that do not fit in the current window"
            >
              <span style={{ letterSpacing: '1px' }}>•••</span>
              <span>More</span>
              <span style={{ fontSize: 9 }}>▾</span>
            </button>
          </div>
        )}

        {/* Overflow Popover shelf containing collapsed groups */}
        {overflowOpen && visibleCount !== null && totalCount > visibleCount && (
          <div
            ref={popoverRef}
            className="ribbon-overflow-popover ribbon-scroll"
            style={{
              position: 'absolute',
              top: 'calc(100% + 2px)',
              right: 8,
              background: 'var(--ribbon-surface, #1e1e1e)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              padding: '4px 8px',
              zIndex: 1050,
              maxWidth: 'calc(100vw - 32px)',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              height: 90,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'stretch',
            }}
          >
            <div
              className={`ribbon-overflow-row ribbon-overflow-${activeTab}`}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 6,
                height: '100%',
              }}
            >
              <Content />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
