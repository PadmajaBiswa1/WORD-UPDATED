import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';

import { useUIStore, useEditorStore, useDocumentStore } from '@/store';
import { DrawTab } from './tabs/DrawTab';
import { AITab } from './tabs/AITab';
import { PictureFormatTab } from './tabs/PictureFormatTab';
import { DesignTab, DOCUMENT_THEMES } from './tabs/DesignTab';
import { LayoutTab } from './tabs/LayoutTab';
import { ReferenceTab } from './tabs/ReferenceTab';
import { MailingsTab } from './tabs/MailingsTab';
import { ReviewTab } from './tabs/ReviewTab';
import { TableFormatTab } from './tabs/TableFormatTab';
import { isImageSelection } from '@/utils/imageSelection';
import { isShapeSrc } from '@/utils/shapeUtils';
import { getThemeAppearance } from '@/utils/documentTheme';
import { runCommand } from './commandRegistry';
import { FONT_SIZE_OPTIONS, fontFamilyChoice, useFontFormattingControls } from './fontFormatting.jsx';
import { TabStripView, RibbonView } from '@/components/design/DesignViews';
import { RIBBON_TABS, RIBBON_COMMANDS } from '@/components/design/ribbonModel';

// Design tab name -> ribbon tab id in the UI store. Draw and the contextual
// Picture/Shape Format tab are app features the design does not draw; they keep
// their own tab bodies.
const TABS = [
  ['Home', 'home'], ['Insert', 'insert'], ['Design', 'design'], ['Layout', 'layout'],
  ['References', 'reference'], ['Mailings', 'mailings'], ['Review', 'review'], ['View', 'view'], ['Help', 'help'],
];
const NAME_OF = Object.fromEntries(TABS.map(([n, id]) => [id, n]));
const APP_TAB_BODIES = { draw: DrawTab, layout: LayoutTab, reference: ReferenceTab, mailings: MailingsTab,
  review: ReviewTab, ai: AITab, tableFormat: TableFormatTab, pictureFormat: () => <PictureFormatTab mode="ribbon" /> };

// Home ribbon controls the design hard-codes: [icon, label, command id, isActive(editor)].
const FONT_ROW = [
  ['bold', 'Bold', 'home-bold', (e) => e.isActive('bold')],
  ['italic', 'Italic', 'home-italic', (e) => e.isActive('italic')],
  ['underline', 'Underline', 'home-underline', (e) => e.isActive('underline')],
  ['strikethrough', 'Strikethrough', 'home-strike', (e) => e.isActive('strike')],
  ['subscript', 'Subscript', 'home-subscript', (e) => e.isActive('subscript')],
  ['superscript', 'Superscript', 'home-superscript', (e) => e.isActive('superscript')],
  ['case-sensitive', 'Change case', 'home-case'],
  ['highlighter', 'Highlight', 'home-highlight', (e) => e.isActive('highlight')],
  ['baseline', 'Font color', 'home-textcolor'],
];
const PARA_ROW_1 = [
  ['list', 'Bullets', 'home-bullets', (e) => e.isActive('bulletList')],
  ['list-ordered', 'Numbering', 'home-ordered', (e) => e.isActive('orderedList') && !e.getAttributes('orderedList')?.class?.startsWith('multilevel')],
  ['list-tree', 'Multilevel list', 'home-multilevel', (e) => e.isActive('orderedList') && Boolean(e.getAttributes('orderedList')?.class?.startsWith('multilevel'))],
  ['list-checks', 'Checklist', 'home-tasklist', (e) => e.isActive('taskList')],
  ['indent-decrease', 'Decrease indent', 'home-outdent'],
  ['indent-increase', 'Increase indent', 'home-indent'],
  ['pilcrow', 'Show marks', 'home-formatmarks', () => useUIStore.getState().showFormattingMarks],
];
const PARA_ROW_2 = [
  ['align-left', 'Align left', 'home-alignleft', (e) => e.isActive({ textAlign: 'left' })],
  ['align-center', 'Center', 'home-aligncenter', (e) => e.isActive({ textAlign: 'center' })],
  ['align-right', 'Align right', 'home-alignright', (e) => e.isActive({ textAlign: 'right' })],
  ['align-justify', 'Justify', 'home-justify', (e) => e.isActive({ textAlign: 'justify' })],
  ['arrow-up-down', 'Line spacing', 'home-linespace'],
  ['quote', 'Quote', 'home-blockquote', (e) => e.isActive('blockquote')],
  ['paint-bucket', 'Shading', 'home-shading'],
];
// [name, kind, font, size, weight, style, color, apply(editorChain), isActive(editor)]
// Paragraph styles leave a quote first, as Word replaces the Quote style; character
// styles (Emphasis, Strong) keep the block. Quote turns the block into a quoted paragraph.
const STYLE_CARDS = [
  ['Normal', 'Paragraph', 'Inter', '12px', 400, 'normal', 'var(--t20,#e8e6e1)', (c) => c.lift('blockquote').setParagraph(), (e) => e.isActive('paragraph') && !e.isActive('blockquote')],
  ['Heading 1', 'Heading', 'Lora,serif', '15px', 600, 'normal', 'var(--t32,#e3c378)', (c) => c.lift('blockquote').setHeading({ level: 1 }), (e) => e.isActive('heading', { level: 1 })],
  ['Heading 2', 'Heading', 'Lora,serif', '14px', 600, 'normal', 'var(--t32,#e3c378)', (c) => c.lift('blockquote').setHeading({ level: 2 }), (e) => e.isActive('heading', { level: 2 })],
  ['Heading 3', 'Heading', 'Lora,serif', '13px', 600, 'normal', 'var(--t31,#d6b25e)', (c) => c.lift('blockquote').setHeading({ level: 3 }), (e) => e.isActive('heading', { level: 3 })],
  ['Title', 'Style', 'Lora,serif', '17px', 600, 'normal', 'var(--t18,#f1efea)', (c) => c.lift('blockquote').setHeading({ level: 1 }).setFontSize('26pt')],
  ['Subtitle', 'Style', 'Inter', '12px', 400, 'normal', 'var(--t23,#a19f99)', (c) => c.lift('blockquote').setHeading({ level: 2 }).setItalic()],
  ['Emphasis', 'Style', 'Inter', '12px', 400, 'italic', 'var(--t20,#e8e6e1)', (c) => c.toggleItalic()],
  ['Strong', 'Style', 'Inter', '12px', 600, 'normal', 'var(--t18,#f1efea)', (c) => c.toggleBold()],
  ['Quote', 'Style', 'Lora,serif', '14px', 400, 'italic', 'var(--t23,#a19f99)', (c) => c.setParagraph().toggleBlockquote(), (e) => e.isActive('blockquote')],
];
// Home ribbon buttons the design leaves unbound, by title.
const HOME_ACTIONS = {
  Paste: 'home-paste', Cut: 'home-cut', Copy: 'home-copy', 'Format painter': 'home-fpaint',
  History: 'home-clipboard-history', 'Grow font': 'home-growfont', 'Shrink font': 'home-shrinkfont',
  'Clear formatting': 'home-clearfmt', 'Find & Replace': 'home-find',
  Select: 'home-selectall', Dictate: 'rev-dictate',
  Pragna: 'home-ai-pragna',
};

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

// Vertical wheel scrolls the ribbon sideways when it overflows (design behaviour).
function wheelX(el) {
  if (!el || el.__wx) return;
  el.__wx = 1;
  el.addEventListener('wheel', (e) => {
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, { passive: false });
}

function useWideLabels() {
  const [wide, setWide] = useState(() => window.innerWidth >= 1180);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1180);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

// Re-render on every editor transaction so active states stay current.
function useEditorTick(editor) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return undefined;
    const bump = () => setTick((t) => t + 1);
    editor.on('transaction', bump);
    return () => editor.off('transaction', bump);
  }, [editor]);
}

const selectStyle = {
  height: 26, boxSizing: 'border-box', padding: '0 8px', borderRadius: 6, background: 'var(--t10,#1a1a1d)',
  border: '1px solid rgba(var(--ink,255,255,255),0.06)', color: 'var(--t20,#e8e6e1)', outline: 'none', cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center',
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236f6d68%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")',
};

export function Ribbon() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const openDialog = useUIStore((s) => s.openDialog);
  const ribbonCollapsed = useUIStore((s) => s.ribbonCollapsed);
  const toggleRibbon = useUIStore((s) => s.toggleRibbon);
  const copilotOpen = useUIStore((s) => s.copilotOpen);
  const toggleCopilot = useUIStore((s) => s.toggleCopilot);
  const editor = useEditorStore((s) => s.editor);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const { applyFontFamily, applyFontSize, snapshotSelection } = useFontFormattingControls(editor);
  const [imageSelected, setImageSelected] = useState(false);
  const [tableSelected, setTableSelected] = useState(false);
  const [isShape, setIsShape] = useState(false);
  const wideLabels = useWideLabels();
  const [viewMenu, setViewMenu] = useState(null);
  const referenceActions = useRef({});
  useEditorTick(editor);

  useEffect(() => {
    const open = (event) => {
      const name = event.detail;
      const anchor = document.querySelector(`.etherx-ribbon button[title="${name}"]`);
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 200;
      setViewMenu((current) => current?.name === name ? null : { name, top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 16)) });
    };
    window.addEventListener('etherx:ribbon-menu', open);
    return () => window.removeEventListener('etherx:ribbon-menu', open);
  }, []);

  useEffect(() => {
    if (!viewMenu) return;
    const dismiss = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.target?.closest?.('[data-view-ribbon-menu], button[title="Reader"], button[title="Page Movement"], button[title="Tracking"], button[title="View"]')) return;
      setViewMenu(null);
    };
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => { window.removeEventListener('mousedown', dismiss); window.removeEventListener('keydown', dismiss); };
  }, [viewMenu]);

  useEffect(() => {
    if (!editor) return undefined;
    let wasInTable = false;
    const checkTable = () => {
      const inTable = editor.isActive('table');
      setTableSelected(inTable);
      if (inTable && !wasInTable) setActiveTab('tableFormat');
      else if (!inTable && useUIStore.getState().activeTab === 'tableFormat') setActiveTab('home');
      wasInTable = inTable;
    };
    checkTable();
    editor.on('transaction', checkTable);
    return () => editor.off('transaction', checkTable);
  }, [editor, setActiveTab]);

  useEffect(() => {
    if (!editor) return undefined;
    const checkSelection = () => {
      const isImg = isImageSelection(editor);
      setImageSelected(isImg);
      if (isImg) setIsShape(isShapeSrc((editor.getAttributes('image') || {}).src));
    };
    checkSelection();
    editor.on('selectionUpdate', checkSelection);
    return () => editor.off('selectionUpdate', checkSelection);
  }, [editor]);

  useEffect(() => {
    const open = () => setActiveTab('pictureFormat');
    window.addEventListener('open-image-edit-panel', open);
    return () => window.removeEventListener('open-image-edit-panel', open);
  }, [setActiveTab]);

  const run = useCallback((id) => runCommand(id, { navigate }), [navigate]);
  // Toolbar buttons fire on mousedown so the editor keeps its selection.
  const onDown = (id) => () => run(id);
  const design = useDocumentStore((s) => s.design);
  const setDesign = useDocumentStore((s) => s.setDesign);
  const ui = useUIStore();

  const tabName = NAME_OF[activeTab];
  const contextual = imageSelected || activeTab === 'pictureFormat';
  const tabs = TABS.map(([name, id]) => ({ name, id }));
  if (activeTab === 'draw' || activeTab === 'ai') tabs.push({ name: activeTab === 'draw' ? 'Draw' : 'AI', id: activeTab });
  if (contextual) tabs.push({ name: isShape ? 'Shape Format' : 'Picture Format', id: 'pictureFormat' });
  if (tableSelected) tabs.push({ name: 'Table Format', id: 'tableFormat' });

  const tabV = {
    openStart: () => {
      if (editor && !editor.isDestroyed) {
        const html = editor.getHTML();
        if (html !== useDocumentStore.getState().content) useDocumentStore.getState().setContent(html);
      }
      navigate('/home', { state: { returnTo: location.pathname } });
    },
    tabs: tabs.map(({ name, id }) => {
      const on = id === activeTab;
      return {
        key: id, name,
        select: () => { setActiveTab(id); if (ribbonCollapsed) toggleRibbon(); },
        color: on ? 'var(--t18,#f1efea)' : 'var(--t25,#8b8984)',
        weight: on ? 500 : 400,
        line: on ? (id === 'pictureFormat' ? '#5b8def' : 'var(--t31,#d6b25e)') : 'transparent',
      };
    }),
    wheelX,
    ribbonClosed: ribbonCollapsed,
    toggleRibbon,
    wideLabels: wideLabels ? 'inline' : 'none',
    openComments: () => openDialog('comments'),
    openEditing: () => openDialog('restrictEditing'),
    openShare: () => openDialog('shareDoc'),
    togglePragna: toggleCopilot,
    pragnaOpen: copilotOpen,
  };

  const tool = ([icon, label, id, isOn]) => {
    const on = Boolean(editor && isOn?.(editor));
    return {
      key: label, icon, label, on,
      run: onDown(id),
      bg: on ? 'rgba(212,175,55,0.14)' : 'transparent',
      color: on ? 'var(--t32,#e3c378)' : 'var(--t22,#c4c2bd)',
    };
  };

  const ribbonGroups = (RIBBON_TABS[tabName] || []).map((g, i) => {
    const mk = ([icon, label, on, dd, dis]) => {
      const id = RIBBON_COMMANDS[`${tabName}/${label}`];
      const needsImage = ['Position', 'Wrap Text', 'Rotate', 'Align'].includes(label) && tabName === 'Layout';
      // Picture tools stay clickable without a picture and say what to select.
      const disabled = !id;
      const active = tabName === 'View'
        ? ({ 'Read Mode': ui.viewMode === 'read', 'Print Layout': ui.viewMode === 'print', 'Web Layout': ui.viewMode === 'web',
          Outline: ui.viewMode === 'outline', Draft: ui.viewMode === 'draft', Focus: ui.focusMode,
          Ruler: ui.rulerVisible, Gridlines: ui.gridlinesVisible, 'Navigation Pane': ui.sidebarOpen,
          Vertical: !ui.pageView, 'Side to Side': ui.pageView === 'side', 'Multiple Pages': ui.pageView === 'multiple',
          Split: ui.sidePane?.kind === 'split', 'View Side by Side': ui.sidePane?.kind === 'doc', 'Synchronous Scrolling': ui.syncScroll }[label] ?? false)
        : label === 'Track Changes' ? useDocumentStore.getState().trackChanges : Boolean(on);
      return {
        key: label, icon: ['Ruler', 'Gridlines', 'Navigation Pane'].includes(label) ? (active ? 'square-check' : 'square') : icon,
        label, dd: !!dd, disabled, on: active,
        title: disabled ? `${label} — not available in this editor` : label,
        run: disabled ? undefined : () => (needsImage && !imageSelected ? useUIStore.getState().toast('Select a picture first, then choose ' + label, 'info') : run(id)),
        op: disabled ? 0.45 : 1,
        cur: disabled ? 'default' : 'pointer',
        bg: active ? 'rgba(212,175,55,0.12)' : 'transparent',
        color: active ? 'var(--t32,#e3c378)' : 'var(--t22,#c4c2bd)',
        feature: ({ Themes: 'themes', Colours: 'colors', Fonts: 'fonts', 'Paragraph Spacing': 'spacing', Effects: 'effects',
          Watermark: 'watermark', 'Page Colour': 'pageColor' })[label],
      };
    };
    return {
      key: g.n, name: g.n, notFirst: i > 0, launch: !!g.x,
      large: (g.L || []).filter((item) => !g.G || item[1] !== 'Themes').map(mk), cols: chunk((g.S || []).map(mk), 3),
      themeHeader: Boolean(g.G),
      large2: (g.L2 || []).map(mk), cols2: chunk((g.S2 || []).map(mk), 3),
      hasChips: false, chipRows: [],
      gallery: g.G ? DOCUMENT_THEMES.map((theme) => ({
        key: theme.name, name: theme.name, color: theme.accent, isTheme: true, isTable: false, w: '96px', cardBg: '#f3f0e8',
        border: design.themeName === theme.name ? 'var(--t31,#d6b25e)' : 'rgba(var(--ink,255,255,255),0.08)',
        run: () => setDesign(getThemeAppearance(theme)),
      })) : [],
      fieldCols: chunk((g.F || []).map(([label, value]) => ({ key: label, label, value })), 2),
    };
  });

  const { family: currentFamily, options: familyOptions } = fontFamilyChoice(fontFamily);

  const ribbonV = {
    wheelX,
    isHome: activeTab === 'home',
    notHome: activeTab !== 'home',
    ribbon: ribbonGroups,
    toggleRibbon,
    fontFamily: (
      <select
        aria-label="Font"
        value={currentFamily}
        onMouseDown={snapshotSelection}
        onChange={(e) => applyFontFamily(e.target.value)}
        style={{ ...selectStyle, width: 136, fontSize: 14, fontFamily: 'Lora,serif' }}
      >
        {familyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ),
    fontSize: (
      <select
        aria-label="Font size"
        value={String(fontSize || '12')}
        onMouseDown={snapshotSelection}
        onChange={(e) => applyFontSize(e.target.value)}
        style={{ ...selectStyle, width: 56, fontSize: 12.5 }}
      >
        {(FONT_SIZE_OPTIONS.some((o) => o.value === String(fontSize)) ? FONT_SIZE_OPTIONS : [{ value: String(fontSize), label: String(fontSize) }, ...FONT_SIZE_OPTIONS])
          .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ),
    fontRow: FONT_ROW.map(tool),
    paraRow1: PARA_ROW_1.map(tool),
    paraRow2: PARA_ROW_2.map(tool),
    styleCards: STYLE_CARDS.map(([name, kind, font, size, weight, italic, color, apply, isOn]) => {
      const on = Boolean(editor && isOn?.(editor));
      return {
        key: name, name, kind, font, size, weight, italic, color, on,
        run: () => { if (editor) apply(editor.chain().focus()).run(); },
        bg: on ? 'rgba(212,175,55,0.08)' : 'transparent',
        border: on ? 'rgba(212,175,55,0.45)' : 'rgba(var(--ink,255,255,255),0.07)',
      };
    }),
    act: (title) => {
      if (HOME_ACTIONS[title]) run(HOME_ACTIONS[title]);
    },
  };

  const AppBody = activeTab === 'design' && editor?.isActive('table') ? DesignTab : APP_TAB_BODIES[activeTab];
  const referenceRenderer = (actions = {}, fields = {}) => {
    referenceActions.current = actions;
    const groups = ribbonGroups.map((group) => {
      const bind = (item) => {
        const displayedLabel = fields[item.label]?.label || item.label;
        const action = actions[`${group.name}/${item.label}`] || actions[item.label];
        const imageAction = activeTab === 'layout' && ['Position', 'Wrap Text', 'Bring Forward', 'Send Backward', 'Align', 'Group', 'Rotate'].includes(item.label);
        const needsPicture = imageAction && !imageSelected && item.label !== 'Group';
        return action ? { ...item, label: displayedLabel, run: needsPicture ? () => useUIStore.getState().toast(`Select a picture first, then choose ${item.label}`, 'info') : action, disabled: false, op: 1, cur: 'pointer', title: displayedLabel } : item;
      };
      return { ...group, large: group.large.map(bind), large2: group.large2.map(bind), cols: group.cols.map((column) => column.map(bind)), cols2: group.cols2.map((column) => column.map(bind)),
        fieldCols: group.fieldCols.map((column) => column.map((field) => ({ ...field, control: fields[field.label] ? <input aria-label={`${field.label} paragraph ${['Left','Right'].includes(field.label) ? 'indent' : 'spacing'}`} type="number" min="0" max="100" step={['Left','Right'].includes(field.label) ? '.1' : '1'} value={fields[field.label].value} onChange={(event) => fields[field.label].change(Number(event.target.value))} style={{ ...selectStyle, width: 84, fontSize: 12 }} /> : null }))),
      };
    });
    return <RibbonView v={{ ...ribbonV, ribbon: groups }} />;
  };
  const referenceBody = ['layout', 'reference', 'mailings', 'review'].includes(activeTab);

  return (
    <div className="etherx-ribbon" style={{ flexShrink: 0 }}>
      <TabStripView v={tabV} />
      {!ribbonCollapsed && (referenceBody ? <AppBody renderRibbon={referenceRenderer} /> : AppBody ? (
        <div
          ref={wheelX}
          className={`ribbon-main-row ribbon-main-${activeTab} ribbon-scroll`}
          style={{ position: 'relative', height: 101, padding: '8px 40px 3px 10px', background: 'var(--tblack,#050505)', borderTop: '1px solid rgba(var(--ink,255,255,255),0.05)', borderBottom: '1px solid rgba(var(--ink,255,255,255),0.06)', display: 'flex', alignItems: 'stretch', gap: 12, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}
        >
          <AppBody />
        </div>
      ) : <RibbonView v={ribbonV} />)}
      {AppBody !== DesignTab && <DesignTab overlaysOnly />}
      {viewMenu && createPortal(
        <div role="menu" aria-label={viewMenu.name} data-view-ribbon-menu="true" style={{ position: 'fixed', left: viewMenu.left, top: viewMenu.top, zIndex: 5000, width: 200, maxHeight: '70vh', overflowY: 'auto', padding: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
          {({
            Reader: [['Focus', 'view-focus'], ['Immersive Reader', 'view-immersive']],
            'Page Movement': [['Vertical', 'view-vertical'], ['Side to Side', 'view-sidetoside']],
            View: [['Read Mode', 'view-read'], ['Print Layout', 'view-print'], ['Web Layout', 'view-web']],
            Tracking: [['Track Changes', 'rev-trackchanges'], ['Accept', null], ['Reject', null]],
          }[viewMenu.name] || []).map(([label, command]) => (
            <button key={label} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (command) run(command); else referenceActions.current[label]?.(); setViewMenu(null); }} style={{ display: 'block', width: '100%', padding: '9px 10px', background: 'transparent', border: 0, color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', borderRadius: 5 }}>{label}</button>
          ))}
        </div>, document.body
      )}
    </div>
  );
}
