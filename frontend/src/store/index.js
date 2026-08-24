// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Central State (Zustand)
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';

const DESIGN_STORAGE_PREFIX = 'etherx-doc-design:';
const HEADER_FOOTER_STORAGE_PREFIX = 'etherx-doc-header-footer:';

function getDefaultPageColor() {
  return '#1a1a1a';
}

const baseDesignState = () => ({
  pageColor: getDefaultPageColor(),
  pageColorMode: 'theme',
  pageFillImage: '',
  borderSetting: 'box',
  borderStyle: 'solid',
  borderColor: '#6f5320',
  borderWidth: 1,
  pageShadow: 'var(--shadow-page)',
  accent: '#c9a84c',
  heading: '#c9a84c',
  subtle: '#444444',
  font: 'Crimson Pro',
  spacing: '1.7',
  effect: 'none',
});

function getDefaultHeaderFooter() {
  return {
    headerText: '',
    headerAlign: 'Center',
    footerText: '',
    footerAlign: 'Center',
    pageNumberEnabled: false,
    pageNumberStyle: 'bottom-center',
    pageNumberStart: 1,
  };
}

function readStoredHeaderFooter(docId) {
  if (typeof window === 'undefined' || !docId) return null;
  try {
    const raw = window.localStorage.getItem(`${HEADER_FOOTER_STORAGE_PREFIX}${docId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredHeaderFooter(docId, headerFooter) {
  if (typeof window === 'undefined' || !docId) return;
  try {
    window.localStorage.setItem(`${HEADER_FOOTER_STORAGE_PREFIX}${docId}`, JSON.stringify(headerFooter || {}));
  } catch {
    // ignore storage errors
  }
}

const baseDocumentState = () => ({
  id: null,
  title: 'Untitled Document',
  content: '',
  design: baseDesignState(),
  headerFooter: getDefaultHeaderFooter(),
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  revision: 0,
  versions: [],
  comments: [],
  trackChanges: false,
  wordCount: 0,
  charCount: 0,
  pageCount: 1,
  readingTime: 0,
  pageOrder: [0],
  pageThumbnails: {},
});

function readStoredDesign(docId) {
  if (typeof window === 'undefined' || !docId) return null;
  try {
    const raw = window.localStorage.getItem(`${DESIGN_STORAGE_PREFIX}${docId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredDesign(docId, design) {
  if (typeof window === 'undefined' || !docId) return;
  try {
    window.localStorage.setItem(`${DESIGN_STORAGE_PREFIX}${docId}`, JSON.stringify(design || {}));
  } catch {
    // ignore storage errors
  }
}

/* ── Document Store ─────────────────────────────────────────── */
export const useDocumentStore = create((set, get) => ({
  ...baseDocumentState(),

  setId: (id) => set({ id }),
  hydrateDocument: (doc = {}) =>
    set((state) => {
      const docId = doc.id ?? doc._id ?? state.id ?? null;
      const storedDesign = readStoredDesign(docId);
      const storedHeaderFooter = readStoredHeaderFooter(docId);
      const nextDesign = {
        ...baseDesignState(),
        ...(storedDesign || {}),
        ...(doc.design || doc.pageDesign || {}),
      };
      const nextHeaderFooter = {
        ...getDefaultHeaderFooter(),
        ...(storedHeaderFooter || {}),
        ...(doc.headerFooter || {}),
      };
      return {
        ...state,
        id: docId,
        title: doc.title || 'Untitled Document',
        content: typeof doc.content === 'string' ? doc.content : '<p></p>',
        design: nextDesign,
        headerFooter: nextHeaderFooter,
        isDirty: false,
        isSaving: false,
        lastSaved: doc.updatedAt ? new Date(doc.updatedAt) : state.lastSaved,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : state.createdAt,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
        revision: Number.isFinite(Number(doc.revision)) ? Number(doc.revision) : state.revision,
        versions: Array.isArray(doc.versions) ? doc.versions : [],
        comments: Array.isArray(doc.comments) ? doc.comments : [],
        trackChanges: Boolean(doc.trackChanges),
      };
    }),
  applyRemoteUpdate: (patch = {}) =>
    set((state) => ({
      title: patch.title ?? state.title,
      content: typeof patch.content === 'string' ? patch.content : state.content,
      design: patch.design ? { ...state.design, ...patch.design } : state.design,
      headerFooter: patch.headerFooter ? { ...getDefaultHeaderFooter(), ...patch.headerFooter } : state.headerFooter,
      comments: Array.isArray(patch.comments) ? patch.comments : state.comments,
      trackChanges: typeof patch.trackChanges === 'boolean' ? patch.trackChanges : state.trackChanges,
      updatedAt: patch.updatedAt ? new Date(patch.updatedAt) : new Date(),
      revision: Number.isFinite(Number(patch.revision)) ? Number(patch.revision) : state.revision,
      lastSaved: patch.updatedAt ? new Date(patch.updatedAt) : state.lastSaved,
      isDirty: false,
    })),

  setTitle: (title) => set({ title, isDirty: true }),
  setContent: (content) => set({ content, isDirty: true, updatedAt: new Date() }),
  setDesign: (design = {}) =>
    set((state) => {
      const nextDesign = { ...state.design, ...design };
      writeStoredDesign(state.id, nextDesign);
      return {
        design: nextDesign,
        isDirty: true,
        updatedAt: new Date(),
      };
    }),
  setHeaderFooter: (headerFooter = {}) =>
    set((state) => {
      const nextHeaderFooter = { ...state.headerFooter, ...headerFooter };
      writeStoredHeaderFooter(state.id, nextHeaderFooter);
      return {
        headerFooter: nextHeaderFooter,
        isDirty: true,
        updatedAt: new Date(),
      };
    }),
  setSaving: (v) => set({ isSaving: v }),
  setRevision: (revision) =>
    set((state) => ({
      revision: Number.isFinite(Number(revision)) ? Number(revision) : state.revision,
    })),
  setLastSaved: (value = new Date()) => set({ lastSaved: value instanceof Date ? value : new Date(value), isDirty: false }),
  setStats: ({ wordCount = 0, charCount = 0, pageCount = 1 }) =>
    set((s) => {
      if (s.pageCount === pageCount) {
        return { wordCount, charCount, pageCount, readingTime: Math.ceil(wordCount / 200) };
      }
      const prev = s.pageOrder;
      const newOrder = Array.from({ length: pageCount }, (_, i) => i);
      const kept = prev.filter((p) => p < pageCount);
      const added = newOrder.filter((p) => !kept.includes(p));
      return { wordCount, charCount, pageCount, readingTime: Math.ceil(wordCount / 200), pageOrder: [...kept, ...added] };
    }),
  setThumbnail: (index, dataUrl) => set((s) => ({ pageThumbnails: { ...s.pageThumbnails, [index]: dataUrl } })),
  reorderPages: (from, to) =>
    set((s) => {
      const order = [...s.pageOrder];
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      return { pageOrder: order };
    }),
  addVersion: (snapshot) =>
    set((s) => ({ versions: [{ id: Date.now(), snapshot, savedAt: new Date(), label: `v${s.versions.length + 1}` }, ...s.versions] })),
  setComments: (comments) => set({ comments, isDirty: true, updatedAt: new Date() }),
  replaceComments: (comments) => set({ comments, isDirty: false, updatedAt: new Date() }),
  addComment: (c) => set((s) => ({ comments: [...s.comments, { id: Date.now(), ...c, resolved: false }], isDirty: true, updatedAt: new Date() })),
  deleteComment: (id) => set((s) => ({ comments: s.comments.filter((c) => c.id !== id), isDirty: true, updatedAt: new Date() })),
  resolveComment: (id) => set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, resolved: true } : c)), isDirty: true, updatedAt: new Date() })),
  toggleTrackChanges: () => set((s) => ({ trackChanges: !s.trackChanges, isDirty: true, updatedAt: new Date() })),
  reset: () => {
    const currentId = get().id;
    if (currentId) {
      try {
        window.localStorage.removeItem(`${DESIGN_STORAGE_PREFIX}${currentId}`);
        window.localStorage.removeItem(`${HEADER_FOOTER_STORAGE_PREFIX}${currentId}`);
      } catch {
        // ignore storage errors
      }
    }
    set(baseDocumentState());
  },
}));

/* ── UI Store ───────────────────────────────────────────────── */
export const useUIStore = create((set) => ({
  autoSaveEnabled: typeof localStorage !== 'undefined' ? localStorage.getItem('etherx-autosave') !== 'false' : true,
  toggleAutoSave: () =>
    set((s) => {
      const next = !s.autoSaveEnabled;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('etherx-autosave', next ? 'true' : 'false');
      }
      return { autoSaveEnabled: next };
    }),
  setAutoSaveEnabled: (enabled) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('etherx-autosave', enabled ? 'true' : 'false');
    }
    set({ autoSaveEnabled: !!enabled });
  },
  sidebarOpen: true,
  fullscreen: false,
  ribbonCollapsed: false,
  zoom: 100,
  activeTab: 'home',
  activePage: 0,
  headerFooterTab: 'header',

  rulerVisible: false,
  gridlinesVisible: false,
  pageOrientation: 'portrait',
  pageSize: 'a4',
  pageMargin: 'normal',
  pageColumns: 1,
  drawTool: 'pen',
  drawColor: '#111111',
  drawSize: 4,
  drawOpacity: 0.4,
  watermarkText: '',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
  toggleRibbon: () => set((s) => ({ ribbonCollapsed: !s.ribbonCollapsed })),
  toggleRuler: () => set((s) => ({ rulerVisible: !s.rulerVisible })),
  toggleGridlines: () => set((s) => ({ gridlinesVisible: !s.gridlinesVisible })),
  setZoom: (z) => set({ zoom: Math.min(200, Math.max(25, z)) }),
  setActiveTab: (t) => set({ activeTab: t }),
  setActivePage: (p) => set({ activePage: p }),
  setHeaderFooterTab: (t) => set({ headerFooterTab: t }),
  setPageOrientation: (o) => set({ pageOrientation: o }),
  setPageSize: (s) => set({ pageSize: s }),
  setPageMargin: (m) => set({ pageMargin: m }),
  setPageColumns: (c) => set({ pageColumns: c }),
  setDrawTool: (t) => set({ drawTool: t }),
  setDrawColor: (c) => set({ drawColor: c }),
  setDrawSize: (s) => set({ drawSize: s }),
  setDrawOpacity: (o) => set({ drawOpacity: Math.max(0.1, Math.min(1, o)) }),
  setWatermarkText: (text) => set({ watermarkText: text }),

  dialogs: {
    insertImage: false, insertTable: false, insertLink: false,
    insertChart: false, insertShape: false, insertSymbol: false,
    findReplace: false, versionHistory: false, exportDoc: false,
    shareDoc: false, drawing: false, templates: false,
    pageSetup: false, comments: false,
    lineSpacing: false, shading: false, borders: false, dictate: false,
    coverPage: false, header: false, footer: false, pageNumber: false,
    headerFooter: false,
    wordArt: false, equation: false, bookmark: false, crossReference: false,
    insertTextBox: false,
    breaks: false, selectionPane: false,
    greetingLine: false,
    tableOfContents: false, insertCitation: false, manageSources: false,
    bibliography: false, navigationPane: false,
    envelopes: false, labels: false, mailMerge: false, selectRecipients: false,
    editRecipients: false, insertMergeField: false, finishMerge: false,
    wordCount: false, language: false, reviewingPane: false,
    accessibility: false, compareDocuments: false, restrictEditing: false,
    commandMap: false,
    help: false, feedback: false, whatsNew: false, about: false,
  },
  openDialog: (name) => set((s) => ({ dialogs: { ...s.dialogs, [name]: true } })),
  closeDialog: (name) => set((s) => ({ dialogs: { ...s.dialogs, [name]: false } })),
  closeAll: () => set((s) => ({ dialogs: Object.fromEntries(Object.keys(s.dialogs).map((k) => [k, false])) })),

  toasts: [],
  toast: (message, type = 'info', duration = 3200) =>
    set((s) => ({ toasts: [...s.toasts, { id: Date.now(), message, type, duration }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  findQuery: '', replaceQuery: '',
  setFindQuery: (v) => set({ findQuery: v }),
  setReplaceQuery: (v) => set({ replaceQuery: v }),
}));

/* ── Editor Store ───────────────────────────────────────────── */
export const useEditorStore = create((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  fontFamily: 'Crimson Pro',
  fontSize: '12',
  setFontFamily: (v) => set({ fontFamily: v }),
  setFontSize: (v) => set({ fontSize: v }),
  spellCheck: true,
  toggleSpellCheck: () => set((s) => ({ spellCheck: !s.spellCheck })),
  isProgrammaticChange: false,
  programmaticContent: null,
  beginProgrammaticChange: (content = null) => set({ isProgrammaticChange: true, programmaticContent: content }),
  endProgrammaticChange: () => set({ isProgrammaticChange: false, programmaticContent: null }),
  formatPainterMarks: null,
  setFormatPainterMarks: (marks) => set({ formatPainterMarks: marks }),
}));

/* ── Collaboration Store ────────────────────────────────────── */
export const useCollaborationStore = create((set) => ({
  sessionId: null,
  connected: false,
  status: 'Not shared',
  collaborationEnabled: false,
  userName: 'You',
  role: 'editor',
  collaborators: [],
  typingUsers: [],
  lastSyncedAt: null,
  lastRemoteEditAt: null,

  configureSession: ({ sessionId, userName, role = 'editor' }) =>
    set({
      sessionId,
      userName: userName || 'You',
      role,
      status: 'Connecting…',
    }),
  enableCollaboration: () => set({ collaborationEnabled: true }),
  disableCollaboration: () => set({ collaborationEnabled: false }),
  setConnected: (connected) =>
    set({
      connected,
      status: connected ? 'Live' : 'Disconnected',
    }),
  setCollaborators: (collaborators) => set({ collaborators: Array.isArray(collaborators) ? collaborators : [] }),
  setTypingUsers: (typingUsers) => set({ typingUsers: Array.isArray(typingUsers) ? typingUsers : [] }),
  setLastSyncedAt: (value = new Date()) =>
    set({ lastSyncedAt: value instanceof Date ? value : new Date(value) }),
  setLastRemoteEditAt: (value = new Date()) =>
    set({ lastRemoteEditAt: value instanceof Date ? value : new Date(value) }),
  reset: () =>
    set({
      sessionId: null,
      connected: false,
      status: 'Not shared',
      collaborationEnabled: false,
      userName: 'You',
      role: 'editor',
      collaborators: [],
      typingUsers: [],
      lastSyncedAt: null,
      lastRemoteEditAt: null,
    }),
}));
