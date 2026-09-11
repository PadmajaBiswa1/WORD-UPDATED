import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Shapes, Image, Keyboard, HelpCircle } from 'lucide-react';

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
          height: 34,
          minHeight: 34,
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
            padding: '0 10px',
            gap: 4,
            overflowX: 'auto',
            overflowY: 'hidden',
            minWidth: 0,
            height: '100%',
          }}
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            const isFile = t.id === 'file';

            if (isFile) {
              return (
                <button
                  key={t.id}
                  onClick={() => onTabClick(t.id)}
                  style={{
                    background: 'rgba(212, 175, 55, 0.14)',
                    border: '1px solid rgba(212, 175, 55, 0.35)',
                    borderRadius: 4,
                    color: 'var(--gold)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '0 12px',
                    height: 25,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.25)';
                    e.currentTarget.style.borderColor = 'var(--gold)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.14)';
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.35)';
                  }}
                >
                  {t.label}
                </button>
              );
            }

            return (
              <button
                key={t.id}
                onClick={() => onTabClick(t.id)}
                style={{
                  background: active ? 'var(--bg-surface)' : 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                  borderRadius: '4px 4px 0 0',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 450,
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  padding: '0 11px',
                  height: 33,
                  marginTop: 1,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {t.label}
              </button>
            );
          })}

          {(imageSelected || activeTab === 'pictureFormat') && (
            <button
              onClick={() => onTabClick('pictureFormat')}
              style={{
                background: activeTab === 'pictureFormat' ? 'var(--bg-surface)' : 'rgba(59, 130, 246, 0.12)',
                border: 'none',
                borderBottom: activeTab === 'pictureFormat' ? '2px solid #2563eb' : '2px solid transparent',
                borderRadius: '4px 4px 0 0',
                color: activeTab === 'pictureFormat' ? '#2563eb' : 'var(--text-primary)',
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                padding: '0 11px',
                height: 33,
                marginTop: 1,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                outline: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{isShape ? <Shapes size={14} strokeWidth={1.75} /> : <Image size={14} strokeWidth={1.75} />}</span>
              <span>{isShape ? 'Shape Format' : 'Picture Format'}</span>
            </button>
          )}
        </div>

        {/* Feature search bar and quick actions */}
        <div
          className="ribbon-tab-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            paddingRight: 8,
            paddingLeft: 4,
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
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Keyboard size={14} strokeWidth={1.75} />
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
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <HelpCircle size={14} strokeWidth={1.75} />
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
