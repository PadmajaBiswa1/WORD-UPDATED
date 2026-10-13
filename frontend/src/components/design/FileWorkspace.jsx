import { useEffect, useMemo, useState } from 'react';
import * as Views from './DesignViews';
import { getReferenceValues } from './referenceValues';
import { applyDesignTheme, getUiTheme } from '@/theme/tokens';
import { useUIStore, useEditorStore } from '@/store';
import EtherxWordLogo from '@/components/brand/EtherxWordLogo';
import { printableHtml } from '@/utils/printUtils';
import { PAGE_SIZES, MARGIN_MAP } from '@/utils/pageLayout';

const PAGE_NAMES = { home: 'Home', new: 'New', open: 'Open', save: 'Save', saveAs: 'Save As', print: 'Print', export: 'Export', share: 'Share', info: 'Info', statistics: 'Statistics', ai: 'Pragna AI', pricing: 'Plans & Pricing', admin: 'Admin Console', settings: 'Settings' };
const KEY_OF = Object.fromEntries(Object.entries(PAGE_NAMES).map(([key, name]) => [name, key]));
const TEMPLATE_KEYS = ['blank', 'business', 'letter', 'resume', 'proposal', 'invoice'];

export function FileWorkspace({ page, setPage, docs, document, search, onSearch, openDoc, createTemplate, back,
  browse, saveName, setSaveName, saveFormat, setSaveFormat, saveLocation, setSaveLocation, saveAs, saveBusy,
  exportFormat, setExportFormat, exportDocument, exportBusy, plan, user, stats, isAdmin, onMenuAction,
  requestDelete, share, copyShareLink, onSaveTitle, children }) {
  const autoSaveEnabled = useUIStore((s) => s.autoSaveEnabled);
  const spellCheck = useEditorStore((s) => s.spellCheck);
  const [local, setLocal] = useState({ rtab: 'Recent', openLoc: 'Recent', openSel: 0, annual: false, dark: getUiTheme() !== 'light' });
  const [selectedId, setSelectedId] = useState(document?.id);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  // Share pane: General access starts from the document's share link.
  const [linkRole, setLinkRole] = useState('viewer');
  useEffect(() => {
    setLinkRole(document?.shareLinkEnabled ? (document.shareLinkRole || 'editor') : 'restricted');
  }, [document?.id, document?.shareLinkEnabled, document?.shareLinkRole]);
  // Print pane page settings start from the document's own page setup.
  const [printLayout, setPrintLayout] = useState({});
  useEffect(() => {
    const l = document?.layout || {};
    setPrintLayout({ pageSize: l.pageSize || 'a4', pageOrientation: l.pageOrientation || 'portrait', pageMargin: l.pageMargin || 'normal', pageColumns: l.pageColumns || 1 });
  }, [document?.id, document?.layout]);
  const [starred, setStarred] = useState(() => { try { return JSON.parse(localStorage.getItem('etherx.starredDocs') || '[]'); } catch { return []; } });
  const [preferences, setPreferences] = useState(() => { try { return JSON.parse(localStorage.getItem('etherx.preferences') || '{}'); } catch { return {}; } });
  const preference = (key, value) => { setPreferences((previous) => { const next = { ...previous, [key]: value }; localStorage.setItem('etherx.preferences', JSON.stringify(next)); return next; }); };
  useEffect(() => { const sync = () => setLocal((s) => ({ ...s, dark: getUiTheme() !== 'light' })); window.addEventListener('etherx:theme-change', sync); return () => window.removeEventListener('etherx:theme-change', sync); }, []);
  const update = (patch) => {
    if (typeof patch === 'function') patch = patch(local);
    if (patch.fpage) setPage(KEY_OF[patch.fpage] || 'home');
    setLocal((s) => ({ ...s, ...patch }));
  };
  const values = getReferenceValues({ ...local, view: 'start', fpage: PAGE_NAMES[page], saveLoc: { thisPc: 'This PC', cloud: 'EtherX Cloud', recent: 'Recent', share: 'Share Document' }[saveLocation] || 'This PC', fmt: saveFormat, exp: exportFormat, words: stats.words }, update);
  const toggleStar = (id) => {
    setStarred((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem('etherx.starredDocs', JSON.stringify(next)); return next; });
  };
  const selected = docs.find((doc) => doc.id === selectedId) || document;
  const own = (doc) => !doc.owner || doc.owner?.id === user?.id || doc.owner === user?.id || doc.owner?.email === user?.email;
  const visible = docs.filter((doc) => !search || doc.title?.toLowerCase().includes(search.toLowerCase()));
  const recent = visible.filter((doc) => local.rtab === 'Starred' ? starred.includes(doc.id) : local.rtab === 'Shared with me' ? !own(doc) : true);
  const describeTime = (date) => { const minutes = Math.max(0, Math.floor((Date.now() - new Date(date || Date.now()).getTime()) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} minutes ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hours ago` : `${Math.floor(minutes / 1440)} days ago`; };
  const setting = (label, desc, on, toggle) => ({ label, desc, on, isToggle: true, toggle, track: on ? 'var(--t31)' : 'var(--t15)', knobLeft: on ? '19px' : '3px', knob: on ? '#1a1405' : 'var(--t25)' });
  const v = { ...values,
    brand: <button className="file-brand" type="button" aria-label="EtherX Word home" onClick={() => setPage('home')}><EtherxWordLogo title="EtherX Word" /></button>,
    planLabel: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`, documentCount: `${docs.length} documents`,
    documentTitle: document?.title || 'Untitled Document',
    onDocumentTitle: (event) => onSaveTitle?.(event.target.value),
    saveStatus: document?.isSaving ? 'Saving…' : document?.isDirty ? 'Unsaved changes' : 'All changes saved',
    saveDescription: autoSaveEnabled ? 'Save your document to EtherX Cloud' : 'AutoSave is off. Save your changes manually.',
    savedTime: document?.isDirty ? 'Changes waiting to save' : `EtherX Cloud · My Documents · ${describeTime(document?.lastSaved || document?.updatedAt)}`,
    openEditor: back, openSelected: () => selected && openDoc(selected), browse,
    goOpen: () => setPage('open'), goNew: () => setPage('new'), goHome: () => setPage('home'),
    saveNow: () => onMenuAction('save'),
    goSaveAs: () => { setSaveName(`Copy of ${document?.title || 'Untitled Document'}`); setPage('saveAs'); },
    goPlans: () => setPage('pricing'),
    templates: values.templates.map((template, index) => ({ ...template, key: TEMPLATE_KEYS[index], run: () => createTemplate(TEMPLATE_KEYS[index]) })),
    templatesAll: values.templatesAll.map((template, index) => ({ ...template, key: TEMPLATE_KEYS[index], run: () => createTemplate(TEMPLATE_KEYS[index]) })),
    recent: recent.slice(0, 4).map((doc) => ({ key: doc.id, name: doc.title, owner: own(doc) ? 'You' : doc.owner?.name || 'Shared', time: describeTime(doc.updatedAt), pages: String(doc.pageCount || 1), run: () => openDoc(doc), starred: starred.includes(doc.id), star: (event) => { event.stopPropagation(); toggleStar(doc.id); }, more: (event) => { event.stopPropagation(); requestDelete(doc); } })),
    openDocs: visible.filter((doc) => local.openLoc === 'Starred' ? starred.includes(doc.id) : local.openLoc === 'Shared with me' ? !own(doc) : true).map((doc) => ({ key: doc.id, name: doc.title, time: describeTime(doc.updatedAt), select: () => setSelectedId(doc.id), run: () => openDoc(doc), bg: doc.id === selected?.id ? 'rgba(212,175,55,0.07)' : 'transparent', ring: doc.id === selected?.id ? 'var(--t31)' : 'var(--t29)', dot: doc.id === selected?.id ? 'var(--t31)' : 'transparent', color: doc.id === selected?.id ? 'var(--t32)' : 'var(--t19)' })),
    openCount: `${visible.length} documents`, search, onSearch: (event) => onSearch(event.target.value),
    fileSearch: <input aria-label="Search documents" placeholder="Search" value={search} onChange={(event) => onSearch(event.target.value)} style={{ flex: 1, minWidth: 0, background: 'transparent', color: 'var(--t19)', border: 0, outline: 0, fontSize: 13 }} />,
    saveName, onSaveName: (event) => setSaveName(event.target.value), saveFormat, pickFormat: (event) => setSaveFormat(event.target.value), saveAs, saveBusy: saveBusy || document?.isSaving,
    saveLocs: values.saveLocs.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, select: () => item.name === 'Share Document' ? share() : setSaveLocation({ 'This PC': 'thisPc', 'EtherX Cloud': 'cloud', Recent: 'thisPc' }[item.name] || 'thisPc') })) })),
    exportFormats: values.exportFormats.map((item, index) => ({ ...item, select: () => setExportFormat(['pdf', 'docx', 'odt', 'md', 'html', 'txt'][index]) })), exportDocument, exportBusy,
    infoActions: values.infoActions.map((action, index) => ({ ...action, run: () => { useUIStore.getState().openDialog(['restrictEditing', 'accessibility', 'versionHistory', 'pageSetup'][index]); } })),
    props: [['Size', `${Math.max(1, Math.round(new Blob([document?.content || '']).size / 1024))} KB`], ['Pages', String(stats.pages || 1)], ['Words', String(stats.words)], ['Title', document?.title || 'Untitled Document'], ['Created', document?.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Today'], ['Last modified', describeTime(document?.updatedAt)], ['Author', user?.name || 'You']].map(([k, v]) => ({ k, v })),
    stats: [['Pages', stats.pages || 1], ['Words', stats.words], ['Characters', stats.chars], ['Paragraphs', (document?.content?.match(/<p\b/g) || []).length], ['Reading time', `${Math.max(1, Math.ceil(stats.words / 238))} min`], ['Speaking time', `${Math.max(1, Math.ceil(stats.words / 130))} min`]].map(([k, v]) => ({ k, v: String(v) })),
    settingsRows: [
      { title: 'Appearance', rows: [setting('Dark mode', 'Use the dark interface', local.dark, () => applyDesignTheme(local.dark ? 'light' : 'dark')), { label: 'Language', desc: 'Document proofing language', isSelect: true, options: ['English (United States)', 'English (United Kingdom)', 'हिन्दी', 'ಕನ್ನಡ'], value: preferences.language || 'English (United States)', change: (event) => { preference('language', event.target.value); localStorage.setItem('etherx-language', { 'English (United States)': 'en-US', 'English (United Kingdom)': 'en-GB', 'हिन्दी': 'hi-IN', 'ಕನ್ನಡ': 'kn-IN' }[event.target.value]); } }] },
      { title: 'Editor', rows: [setting('AutoSave', 'Save changes to EtherX Cloud as you type', autoSaveEnabled, () => useUIStore.getState().toggleAutoSave()), setting('Check spelling as you type', 'Underline misspelled words', spellCheck, () => useEditorStore.getState().toggleSpellCheck()),
        { label: 'Default font', desc: 'Used for new documents', isSelect: true, options: ['Lora', 'Crimson Pro', 'Inter', 'Georgia', 'Times New Roman'], value: preferences.font || 'Lora', change: (event) => { preference('font', event.target.value); localStorage.setItem('etherx.defaultFont', event.target.value); } },
        { label: 'Default size', desc: 'Body text size', isSelect: true, options: ['11', '12', '14', '16'], value: preferences.fontSize || '12', change: (event) => { preference('fontSize', event.target.value); localStorage.setItem('etherx.defaultFontSize', event.target.value); } }] },
      { title: 'Pragna', rows: [setting('Web access', 'Allow Pragna to research the live web', preferences.web !== false, () => preference('web', preferences.web === false)), { label: 'Response style', desc: 'How Pragna writes by default', isSelect: true, options: ['Balanced', 'Precise', 'Creative'], value: preferences.responseStyle || 'Balanced', change: (event) => preference('responseStyle', event.target.value) }] },
    ],
    aiActions: values.aiActions.map((action) => ({ ...action, run: () => { useUIStore.getState().openPragna('ask', action.title + ': ' + action.desc); back(); } })),
    printDocument: () => onMenuAction('print', { layout: printLayout }),
    printOrientation: printLayout.pageOrientation, onPrintOrientation: (event) => setPrintLayout((l) => ({ ...l, pageOrientation: event.target.value })),
    printSize: printLayout.pageSize, onPrintSize: (event) => setPrintLayout((l) => ({ ...l, pageSize: event.target.value })),
    printMargin: printLayout.pageMargin, onPrintMargin: (event) => setPrintLayout((l) => ({ ...l, pageMargin: event.target.value })),
    printPreview: <PrintPreview html={document?.content} layout={printLayout} />, sendInvite: () => share({ email: inviteEmail, role: inviteRole }), copyShareLink: () => copyShareLink(linkRole),
    linkRole, onLinkRole: (event) => setLinkRole(event.target.value),
    people: sharePeople(document, user),
    inviteEmail, onInviteEmail: (event) => setInviteEmail(event.target.value), inviteRole, onInviteRole: (event) => setInviteRole(event.target.value),
    plans: values.plans.map((item) => ({ ...item, btn: plan === item.name.toLowerCase() ? 'Current plan' : `Upgrade to ${item.name} via Razorpay`, run: () => onMenuAction('pricing') })),
    navGroups: values.navGroups.map((group) => ({ ...group, items: group.items.filter((item) => isAdmin || item.label !== 'Admin Console').map((item) => ({ ...item, select: () => item.label === 'Close' ? back() : item.label === 'Admin Console' ? onMenuAction('admin') : setPage(KEY_OF[item.label] || 'home') })) })),
  };
  const pageView = { home: Views.BackstageHomeView, new: Views.BackstageNewView, open: Views.BackstageOpenView, save: Views.BackstageSaveView, saveAs: Views.BackstageSaveAsView, print: Views.BackstagePrintView, export: Views.BackstageExportView, share: Views.BackstageShareView, ai: Views.BackstagePragnaView, pricing: Views.BackstagePlansView, info: Views.BackstageInfoView, statistics: Views.BackstageStatsView, settings: Views.BackstageSettingsView }[page];
  const Page = pageView;
  return <div className="reference-file-workspace" style={{ height: '100dvh', display: 'flex', background: 'var(--t0)', color: 'var(--t19)', fontSize: 13 }}>
    <Views.BackstageNavView v={v} />
    <main className="reference-file-main" style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>{Page ? <Page v={v} /> : children}</main>
  </div>;
}

// First page of the document as it will print: real paper proportions and
// margins, content scaled down to fit the preview card.
function PrintPreview({ html, layout }) {
  const dims = PAGE_SIZES[layout.pageSize] || PAGE_SIZES.a4;
  const landscape = layout.pageOrientation === 'landscape';
  const width = landscape ? dims.h : dims.w;
  const height = landscape ? dims.w : dims.h;
  const scale = Math.min(340 / width, 440 / height);
  const margin = MARGIN_MAP[layout.pageMargin] ?? MARGIN_MAP.normal;
  const content = useMemo(() => printableHtml(html || ''), [html]);
  return (
    <>
      <div aria-label="Print preview" style={{ width: width * scale, height: height * scale, overflow: 'hidden', background: '#fff', borderRadius: 2, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
        <div className="print-preview-page" style={{ width, height, padding: margin, boxSizing: 'border-box', transform: `scale(${scale})`, transformOrigin: 'top left', color: '#111', fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif", fontSize: '12pt', lineHeight: 1.6, columnCount: Number(layout.pageColumns) > 1 ? Number(layout.pageColumns) : undefined, columnGap: '0.5in', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: content }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--t27,#7d7b76)' }}>{dims.label} · {landscape ? 'Landscape' : 'Portrait'} · first page</span>
    </>
  );
}

const initialsOf = (text) => (text || 'U').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const ROLE_NAMES = { owner: 'Owner', editor: 'Can edit', commenter: 'Can comment', viewer: 'Can view' };

// Owner first, then everyone invited by email (the share link's own entry has no email).
function sharePeople(doc, user) {
  const owner = doc?.owner || user || {};
  const isMe = (person) => Boolean(user) && ((person.id && person.id === user.id) || (person.email && person.email === user.email));
  const people = [{ key: 'owner', name: isMe(owner) || !doc?.owner ? 'You' : (owner.name || owner.email || 'Owner'), initials: initialsOf(owner.name || owner.email || user?.name), role: 'Owner' }];
  (doc?.sharedWith || []).filter((entry) => entry?.email).forEach((entry) => {
    people.push({ key: entry.email, name: isMe(entry) ? `${entry.email} (you)` : entry.email, initials: initialsOf(entry.email.split('@')[0]), role: ROLE_NAMES[entry.role] || 'Can view' });
  });
  return people;
}
