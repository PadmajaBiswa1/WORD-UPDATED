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
  contentFormatVersion: 2,
  contentJson: null,
  styles: [],
  references: { citations: [], captions: [], indexEntries: [] },
  security: { protected: false, keyVersion: 1, unlocked: true },
  isLocked: false,
  cryptoKey: null,
  aiProfile: null,
  accessPolicy: { allowDownload: true, allowComments: true, allowCopy: true },
  documentParts: [],
  signatures: [],
  currentUserRole: 'owner',
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
        contentFormatVersion: doc.contentFormatVersion ?? 2,
        contentJson: doc.contentJson ?? null,
        styles: Array.isArray(doc.styles) ? doc.styles : [],
        references: {
          citations: Array.isArray(doc.references?.citations) ? doc.references.citations : [],
          captions: Array.isArray(doc.references?.captions) ? doc.references.captions : [],
          indexEntries: Array.isArray(doc.references?.indexEntries) ? doc.references.indexEntries : [],
        },
        security: doc.security ?? null,
        isLocked: Boolean(doc.security && !state.cryptoKey),
        aiProfile: doc.aiProfile ?? null,
        accessPolicy: {
          allowDownload: true,
          allowComments: true,
          allowCopy: true,
          ...(doc.accessPolicy || {}),
        },
        documentParts: Array.isArray(doc.documentParts) ? doc.documentParts : [],
        signatures: Array.isArray(doc.signatures) ? doc.signatures : [],
        currentUserRole: doc.currentUserRole || doc.role || state.currentUserRole || 'owner',
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
      contentFormatVersion: patch.contentFormatVersion ?? state.contentFormatVersion,
      contentJson: patch.contentJson !== undefined ? patch.contentJson : state.contentJson,
      styles: Array.isArray(patch.styles) ? patch.styles : state.styles,
      references: patch.references
        ? {
            citations: Array.isArray(patch.references.citations) ? patch.references.citations : state.references.citations,
            captions: Array.isArray(patch.references.captions) ? patch.references.captions : state.references.captions,
            indexEntries: Array.isArray(patch.references.indexEntries) ? patch.references.indexEntries : state.references.indexEntries,
          }
        : state.references,
      security: patch.security !== undefined ? patch.security : state.security,
      isLocked: patch.security !== undefined ? Boolean(patch.security && !state.cryptoKey) : state.isLocked,
      aiProfile: patch.aiProfile !== undefined ? patch.aiProfile : state.aiProfile,
      accessPolicy: patch.accessPolicy ? { ...state.accessPolicy, ...patch.accessPolicy } : state.accessPolicy,
      documentParts: Array.isArray(patch.documentParts) ? patch.documentParts : state.documentParts,
      signatures: Array.isArray(patch.signatures) ? patch.signatures : state.signatures,
      currentUserRole: patch.currentUserRole || patch.role || state.currentUserRole,
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
  setContentJson: (contentJson) => set({ contentJson, isDirty: true, updatedAt: new Date() }),
  setStyles: (styles) => set({ styles: Array.isArray(styles) ? styles : [], isDirty: true, updatedAt: new Date() }),
  applyStyleDefinition: (styleDef) =>
    set((state) => {
      if (!styleDef || !styleDef.id) return state;
      const exists = state.styles.some((s) => s.id === styleDef.id);
      const nextStyles = exists
        ? state.styles.map((s) => (s.id === styleDef.id ? { ...s, ...styleDef } : s))
        : [...state.styles, styleDef];
      return { styles: nextStyles, isDirty: true, updatedAt: new Date() };
    }),
  setReferences: (references) =>
    set((state) => ({
      references: {
        citations: Array.isArray(references?.citations) ? references.citations : (state.references?.citations || []),
        captions: Array.isArray(references?.captions) ? references.captions : (state.references?.captions || []),
        indexEntries: Array.isArray(references?.indexEntries) ? references.indexEntries : (state.references?.indexEntries || []),
      },
      isDirty: true,
      updatedAt: new Date(),
    })),
  addCitation: (citation) =>
    set((state) => ({
      references: {
        ...state.references,
        citations: [...(state.references?.citations || []), { id: citation?.id || `cit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, ...citation }],
      },
      isDirty: true,
      updatedAt: new Date(),
    })),
  addCaption: (caption) =>
    set((state) => ({
      references: {
        ...state.references,
        captions: [...(state.references?.captions || []), { id: caption?.id || `cap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, ...caption }],
      },
      isDirty: true,
      updatedAt: new Date(),
    })),
  addIndexEntry: (entry) =>
    set((state) => ({
      references: {
        ...state.references,
        indexEntries: [...(state.references?.indexEntries || []), { id: entry?.id || `idx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, ...entry }],
      },
      isDirty: true,
      updatedAt: new Date(),
    })),
  setSecurityEnvelope: (security) =>
    set((state) => ({
      security,
      isLocked: Boolean(security && !state.cryptoKey),
      isDirty: true,
      updatedAt: new Date(),
    })),
  unlockDocument: (cryptoKey) => set({ cryptoKey, isLocked: false }),
  lockDocument: () => set({ cryptoKey: null, isLocked: true }),
  setAiProfile: (aiProfile) => set({ aiProfile, isDirty: true, updatedAt: new Date() }),
  setAccessPolicy: (accessPolicy) =>
    set((state) => ({
      accessPolicy: { ...state.accessPolicy, ...accessPolicy },
      isDirty: true,
      updatedAt: new Date(),
    })),
  setDocumentParts: (documentParts) =>
    set({
      documentParts: Array.isArray(documentParts) ? documentParts : [],
      isDirty: true,
      updatedAt: new Date(),
    }),
  setSignatures: (signatures) =>
    set({
      signatures: Array.isArray(signatures) ? signatures : [],
      isDirty: true,
      updatedAt: new Date(),
    }),
  addSignature: (signature) =>
    set((state) => {
      const current = Array.isArray(state.signatures) ? state.signatures : [];
      const idx = current.findIndex((s) => s.fieldId === signature.fieldId);
      const next = [...current];
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...signature };
      } else {
        next.push(signature);
      }
      return { signatures: next, isDirty: true, updatedAt: new Date() };
    }),
  setCurrentUserRole: (currentUserRole) => set({ currentUserRole }),
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

  copilotOpen: true,
  toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),
  setCopilotOpen: (open) => set({ copilotOpen: !!open }),
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
    tableOfFigures: false, tableOfTables: false, insertIndex: false,
    envelopes: false, labels: false, mailMerge: false, selectRecipients: false,
    editRecipients: false, insertMergeField: false, finishMerge: false,
    wordCount: false, language: false, reviewingPane: false,
    accessibility: false, compareDocuments: false, restrictEditing: false,
    commandMap: false,
    pragnaAi: false,
    help: false, feedback: false, whatsNew: false, about: false,
    security: false,
    digitalSignature: false,
    readability: false,
    buildingBlocks: false,
    shortcuts: false,
    mergeConflict: false,
    masterDoc: false,
    styleInspector: false,
  },
  pragnaInitialTab: 'ask',
  pragnaInitialPrompt: '',
  openPragna: (initialTab = 'ask', initialPrompt = '') =>
    set((s) => ({
      copilotOpen: true,
      pragnaInitialTab: initialTab,
      pragnaInitialPrompt: initialPrompt,
    })),
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

/* ── Productivity Store ─────────────────────────────────────── */
const PRODUCTIVITY_STORAGE_KEY = 'etherx-productivity';

function readStoredProductivity() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredProductivity(state) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const data = {
      buildingBlocks: state.buildingBlocks,
      autoCorrectRules: state.autoCorrectRules,
      customDictionary: state.customDictionary,
      clipboardHistory: state.clipboardHistory,
      customShortcuts: state.customShortcuts,
    };
    window.localStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

const DEFAULT_AUTOCORRECT_RULES = [
  { trigger: '(c)', replacement: '©', caseSensitive: false, enabled: true },
  { trigger: '(r)', replacement: '®', caseSensitive: false, enabled: true },
  { trigger: '(tm)', replacement: '™', caseSensitive: false, enabled: true },
  { trigger: '-->', replacement: '→', caseSensitive: false, enabled: true },
  { trigger: '<--', replacement: '←', caseSensitive: false, enabled: true },
  { trigger: 'teh', replacement: 'the', caseSensitive: false, enabled: true },
  { trigger: 'recieve', replacement: 'receive', caseSensitive: false, enabled: true },
  { trigger: 'seperate', replacement: 'separate', caseSensitive: false, enabled: true },
];

export const useProductivityStore = create((set, get) => {
  const stored = readStoredProductivity() || {};
  const initialState = {
    buildingBlocks: Array.isArray(stored.buildingBlocks) ? stored.buildingBlocks : [],
    autoCorrectRules: Array.isArray(stored.autoCorrectRules) ? stored.autoCorrectRules : DEFAULT_AUTOCORRECT_RULES,
    customDictionary: Array.isArray(stored.customDictionary) ? stored.customDictionary : [],
    clipboardHistory: Array.isArray(stored.clipboardHistory) ? stored.clipboardHistory : [],
    customShortcuts: stored.customShortcuts && typeof stored.customShortcuts === 'object' ? stored.customShortcuts : {},
  };

  const persist = (nextState) => {
    writeStoredProductivity({ ...get(), ...nextState });
    return nextState;
  };

  return {
    ...initialState,

    // Building Blocks
    addBuildingBlock: (block) =>
      set((s) => {
        const item = {
          id: block.id || `bb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: block.name || 'Untitled Block',
          category: block.category || 'General',
          contentJson: block.contentJson || null,
          previewText: block.previewText || '',
          createdAt: block.createdAt || new Date().toISOString(),
        };
        const next = { buildingBlocks: [item, ...s.buildingBlocks] };
        persist(next);
        return next;
      }),
    updateBuildingBlock: (id, patch) =>
      set((s) => {
        const next = {
          buildingBlocks: s.buildingBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        };
        persist(next);
        return next;
      }),
    deleteBuildingBlock: (id) =>
      set((s) => {
        const next = {
          buildingBlocks: s.buildingBlocks.filter((b) => b.id !== id),
        };
        persist(next);
        return next;
      }),

    // AutoCorrect Rules
    addAutoCorrectRule: (rule) =>
      set((s) => {
        const item = {
          trigger: rule.trigger || '',
          replacement: rule.replacement || '',
          caseSensitive: Boolean(rule.caseSensitive),
          enabled: rule.enabled !== false,
        };
        const next = { autoCorrectRules: [...s.autoCorrectRules, item] };
        persist(next);
        return next;
      }),
    updateAutoCorrectRule: (triggerOrIndex, patch) =>
      set((s) => {
        const next = {
          autoCorrectRules: s.autoCorrectRules.map((r, i) =>
            i === triggerOrIndex || r.trigger === triggerOrIndex ? { ...r, ...patch } : r
          ),
        };
        persist(next);
        return next;
      }),
    deleteAutoCorrectRule: (triggerOrIndex) =>
      set((s) => {
        const next = {
          autoCorrectRules: s.autoCorrectRules.filter((r, i) =>
            i !== triggerOrIndex && r.trigger !== triggerOrIndex
          ),
        };
        persist(next);
        return next;
      }),

    // Custom Dictionary
    addToCustomDictionary: (word) =>
      set((s) => {
        const trimmed = String(word || '').trim().toLowerCase();
        if (!trimmed || s.customDictionary.includes(trimmed)) return s;
        const next = { customDictionary: [...s.customDictionary, trimmed] };
        persist(next);
        return next;
      }),
    updateCustomDictionaryWord: (oldWord, newWord) =>
      set((s) => {
        const oldTrimmed = String(oldWord || '').trim().toLowerCase();
        const newTrimmed = String(newWord || '').trim().toLowerCase();
        if (!newTrimmed) return s;
        const next = {
          customDictionary: s.customDictionary.map((w) => (w === oldTrimmed ? newTrimmed : w)),
        };
        persist(next);
        return next;
      }),
    removeFromCustomDictionary: (word) =>
      set((s) => {
        const trimmed = String(word || '').trim().toLowerCase();
        const next = { customDictionary: s.customDictionary.filter((w) => w !== trimmed) };
        persist(next);
        return next;
      }),

    // Clipboard History (max 20 items)
    addClipboardItem: (item) =>
      set((s) => {
        const newItem = {
          id: item.id || `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          text: item.text || '',
          html: item.html || '',
          copiedAt: item.copiedAt || new Date().toISOString(),
          pinned: Boolean(item.pinned),
        };
        const filtered = s.clipboardHistory.filter((c) => c.text !== newItem.text);
        const combined = [newItem, ...filtered];
        const pinned = combined.filter((c) => c.pinned);
        const unpinned = combined.filter((c) => !c.pinned);
        const allowedUnpinned = Math.max(0, 20 - pinned.length);
        const trimmed = [...pinned, ...unpinned.slice(0, allowedUnpinned)].sort(
          (a, b) => new Date(b.copiedAt) - new Date(a.copiedAt)
        );
        const next = { clipboardHistory: trimmed.slice(0, 20) };
        persist(next);
        return next;
      }),
    updateClipboardItem: (id, patch) =>
      set((s) => {
        const next = {
          clipboardHistory: s.clipboardHistory.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        };
        persist(next);
        return next;
      }),
    togglePinClipboardItem: (id) =>
      set((s) => {
        const next = {
          clipboardHistory: s.clipboardHistory.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
        };
        persist(next);
        return next;
      }),
    deleteClipboardItem: (id) =>
      set((s) => {
        const next = {
          clipboardHistory: s.clipboardHistory.filter((c) => c.id !== id),
        };
        persist(next);
        return next;
      }),
    clearClipboardHistory: (keepPinned = true) =>
      set((s) => {
        const next = {
          clipboardHistory: keepPinned ? s.clipboardHistory.filter((c) => c.pinned) : [],
        };
        persist(next);
        return next;
      }),

    // Custom Shortcuts
    setCustomShortcut: (commandId, shortcutString) =>
      set((s) => {
        const next = {
          customShortcuts: { ...s.customShortcuts, [commandId]: shortcutString },
        };
        persist(next);
        return next;
      }),
    updateCustomShortcut: (commandId, shortcutString) =>
      set((s) => {
        const next = {
          customShortcuts: { ...s.customShortcuts, [commandId]: shortcutString },
        };
        persist(next);
        return next;
      }),
    removeCustomShortcut: (commandId) =>
      set((s) => {
        const copy = { ...s.customShortcuts };
        delete copy[commandId];
        const next = { customShortcuts: copy };
        persist(next);
        return next;
      }),
    resetCustomShortcuts: () =>
      set(() => {
        const next = { customShortcuts: {} };
        persist(next);
        return next;
      }),
  };
});

/* ── Offline Store ──────────────────────────────────────────── */
export const useOfflineStore = create((set) => {
  const initialOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      set({ isOnline: true, syncStatus: 'synced' });
    });
    window.addEventListener('offline', () => {
      set({ isOnline: false, syncStatus: 'offline' });
    });
  }

  return {
    isOnline: initialOnline,
    syncStatus: initialOnline ? 'synced' : 'offline',
    syncQueue: [],
    lastSyncError: null,

    setOnline: (isOnline) =>
      set({
        isOnline: Boolean(isOnline),
        syncStatus: isOnline ? 'synced' : 'offline',
      }),
    setSyncStatus: (syncStatus) => set({ syncStatus }),
    enqueueMutation: (mutation) =>
      set((s) => ({
        syncQueue: [
          ...s.syncQueue,
          {
            id: mutation?.id || `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: Date.now(),
            ...mutation,
          },
        ],
      })),
    dequeueMutation: (id) =>
      set((s) => ({
        syncQueue: id ? s.syncQueue.filter((m) => m.id !== id) : s.syncQueue.slice(1),
      })),
    clearQueue: () => set({ syncQueue: [], lastSyncError: null, syncStatus: 'synced' }),
    setLastSyncError: (lastSyncError) => set({ lastSyncError, syncStatus: 'error' }),
  };
});
