import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Shapes, Image, Keyboard, HelpCircle, MessageSquare, Pencil, ChevronDown, Sparkles, Share2 } from 'lucide-react';

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
import { PictureFormatTab } from './tabs/PictureFormatTab';
import { isImageSelection } from '@/utils/imageSelection';
import { isShapeSrc } from '@/utils/shapeUtils';

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

const PictureFormatRibbonTab = () => <PictureFormatTab mode="ribbon" />;

const TAB_CONTENT = {
  home: HomeTab, insert: InsertTab, draw: DrawTab, design: DesignTab,
  layout: LayoutTab, reference: ReferenceTab, mailings: MailingsTab,
  review: ReviewTab, view: ViewTab, ai: AITab, help: HelpTab,
  pictureFormat: PictureFormatRibbonTab,
};

export function Ribbon() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTab, setActiveTab, openDialog } = useUIStore();
  const copilotOpen = useUIStore((s) => s.copilotOpen);
  const toggleCopilot = useUIStore((s) => s.toggleCopilot);
  const { editor } = useEditorStore();
  const [imageSelected, setImageSelected] = useState(false);
  const [isShape, setIsShape] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const checkSelection = () => {
      const isImg = isImageSelection(editor);
      setImageSelected(isImg);
      if (isImg) {
        const attrs = editor.getAttributes('image') || {};
        setIsShape(isShapeSrc(attrs.src));
      }
    };
    checkSelection();
    editor.on('selectionUpdate', checkSelection);
    return () => {
      editor.off('selectionUpdate', checkSelection);
    };
  }, [editor]);

  useEffect(() => {
    const handleOpenEditPanel = () => {
      setActiveTab('pictureFormat');
    };
    window.addEventListener('open-image-edit-panel', handleOpenEditPanel);
    return () => window.removeEventListener('open-image-edit-panel', handleOpenEditPanel);
  }, [setActiveTab]);

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
    '--ribbon-surface': 'var(--bg-elevated)',
    '--ribbon-surface-2': '#1a1a1d',
    '--ribbon-ink': 'var(--text-secondary)',
    '--ribbon-divider': 'rgba(255,255,255,0.06)',
    '--ribbon-hover': 'rgba(255,255,255,0.07)',
  };

  return (
    <div style={{ flexShrink: 0, ...ribbonVars }}>
      {/* ── Tab strip ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: 36,
          minHeight: 36,
          background: 'var(--bg-app)',
          fontFamily: 'var(--font-ui)',
          padding: '0 10px',
          gap: 2,
        }}
      >
        <div
          className="ribbon-scroll"
          role="tablist"
          aria-label="Ribbon tabs"
          style={{ display: 'flex', alignItems: 'stretch', flex: 1, gap: 2, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            if (t.id === 'file') {
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabClick(t.id)}
                  style={fileTabBtn}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
                >
                  {t.label}
                </button>
              );
            }
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabClick(t.id)}
                style={{
                  ...tabBtn,
                  color: active ? 'var(--text-primary)' : '#7d7b76',
                  fontWeight: active ? 500 : 400,
                  boxShadow: `inset 0 -2px 0 ${active ? 'var(--gold)' : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#7d7b76'; }}
              >
                {t.label}
              </button>
            );
          })}

          {(imageSelected || activeTab === 'pictureFormat') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pictureFormat'}
              onClick={() => onTabClick('pictureFormat')}
              style={{
                ...tabBtn,
                gap: 5,
                color: activeTab === 'pictureFormat' ? 'var(--text-primary)' : '#7d7b76',
                fontWeight: 500,
                boxShadow: `inset 0 -2px 0 ${activeTab === 'pictureFormat' ? '#5b8def' : 'transparent'}`,
              }}
            >
              {isShape ? <Shapes size={14} strokeWidth={1.75} /> : <Image size={14} strokeWidth={1.75} />}
              <span>{isShape ? 'Shape Format' : 'Picture Format'}</span>
            </button>
          )}
        </div>

        <div className="ribbon-tab-actions" style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={() => openDialog('shortcuts')} title="Keyboard shortcuts" aria-label="Keyboard shortcuts" style={iconBtn} onMouseEnter={iconHoverOn} onMouseLeave={iconHoverOff}>
            <Keyboard size={14} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => openDialog('help')} title="Help & Reference (F1)" aria-label="Help" style={iconBtn} onMouseEnter={iconHoverOn} onMouseLeave={iconHoverOff}>
            <HelpCircle size={14} strokeWidth={1.75} />
          </button>
          <button type="button" className="titlebar-comments-btn" onClick={() => openDialog('comments')} title="Comments" style={outlineBtn} onMouseEnter={outlineHoverOn} onMouseLeave={outlineHoverOff}>
            <MessageSquare size={14} strokeWidth={1.75} />Comments
          </button>
          <button type="button" className="titlebar-editing-btn" onClick={() => openDialog('restrictEditing')} title="Editing permissions" style={outlineBtn} onMouseEnter={outlineHoverOn} onMouseLeave={outlineHoverOff}>
            <Pencil size={14} strokeWidth={1.75} />Editing<ChevronDown size={12} color="#8b8984" />
          </button>
          <button
            type="button"
            onClick={toggleCopilot}
            aria-pressed={copilotOpen}
            title={copilotOpen ? 'Hide Pragna' : 'Show Pragna'}
            style={{ ...outlineBtn, borderColor: 'rgba(212,175,55,0.35)', color: 'var(--gold-hover)', background: copilotOpen ? 'rgba(212,175,55,0.1)' : 'transparent' }}
          >
            <Sparkles size={14} strokeWidth={1.75} />Pragna
          </button>
          <button
            type="button"
            className="titlebar-share-btn"
            onClick={() => openDialog('shareDoc')}
            style={shareBtn}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <Share2 size={14} strokeWidth={1.75} />Share
          </button>
        </div>
      </div>

      {/* ── Ribbon content container ── */}
      <div
        ref={ribbonContainerRef}
        className="ribbon-outer-container"
        style={{
          position: 'relative',
          background: 'var(--bg-elevated)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
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

const tabBtn = {
  border: 0,
  background: 'transparent',
  padding: '0 10px',
  fontSize: 12.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  outline: 'none',
};

const fileTabBtn = {
  alignSelf: 'center',
  height: 28,
  padding: '0 12px',
  border: 0,
  borderRadius: 6,
  background: 'rgba(212,175,55,0.12)',
  color: 'var(--gold-hover)',
  fontWeight: 500,
  fontSize: 12.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  marginRight: 4,
  flexShrink: 0,
};

const iconBtn = {
  width: 28,
  height: 28,
  border: 0,
  background: 'transparent',
  borderRadius: 6,
  color: '#8b8984',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
};

const outlineBtn = {
  height: 28,
  padding: '0 10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  borderRadius: 6,
  color: '#e8e6e1',
  fontSize: 12.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

const shareBtn = {
  height: 28,
  padding: '0 12px',
  border: 0,
  borderRadius: 6,
  background: 'linear-gradient(135deg,#e5c76b 0%,#d4af37 50%,#b8860b 100%)',
  boxShadow: '0 0 20px rgba(212,175,55,0.25)',
  color: '#1a1405',
  fontWeight: 600,
  fontSize: 12.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

function iconHoverOn(e) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text-primary)'; }
function iconHoverOff(e) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b8984'; }
function outlineHoverOn(e) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }
function outlineHoverOff(e) { e.currentTarget.style.background = 'transparent'; }
