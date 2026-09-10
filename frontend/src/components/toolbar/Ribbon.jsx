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

  // When activeTab changes, scroll back to the start so each tab opens at group 0
  useEffect(() => {
    if (ribbonContentRef.current) {
      ribbonContentRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

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
          className="ribbon-tab-actions"
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


      {/* ── Ribbon content container ── */}
      <div
        ref={ribbonContainerRef}
        className="ribbon-outer-container"
        style={{
          position: 'relative',
          background: 'var(--ribbon-surface)',
          borderBottom: '1px solid var(--border)',
          height: 104,
          minHeight: 104,
          width: '100%',
          display: 'flex',
          alignItems: 'stretch',
          padding: '2px 10px 0',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Main row — stretches full width and supports smooth horizontal swipe */}
        <div
          ref={ribbonContentRef}
          className={`ribbon-main-row ribbon-main-${activeTab} ribbon-scroll`}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 12,
            flex: 1,
            minWidth: 0,
            width: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Content />
        </div>
      </div>
    </div>
  );
}
