const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const { getEffectiveRole, checkPermission } = require('./authorization');

const DATA_FILE = path.join(__dirname, '..', 'data', 'documents.json');

function isMongoConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
}

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { documents: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { documents: Array.isArray(parsed.documents) ? parsed.documents : [] };
  } catch (err) {
    console.warn('readStore error:', err.message);
    return { documents: [] };
  }
}

function writeStore(store) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('writeStore error:', err.message);
  }
}

function defaultDesign() {
  return {
    pageColor: '#fdfbf7',
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
  };
}

function defaultHeaderFooter() {
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

function defaultAiProfile() {
  return {
    tone: 'balanced',
    audience: 'general',
    responseStyle: 'concise',
    preferredTerms: [],
    forbiddenTerms: [],
    instructions: '',
  };
}

function defaultAccessPolicy() {
  return {
    allowDownload: true,
    allowComments: true,
    allowCopy: true,
  };
}

function defaultSecurityEnvelope() {
  return {
    protected: false,
    keyVersion: 1,
    kdf: 'PBKDF2',
    salt: '',
    nonce: '',
    authTag: '',
    encryptedPayload: '',
  };
}

function defaultReferences() {
  return {
    citations: [],
    captions: [],
    indexEntries: [],
  };
}

function normalizeHeaderFooter(headerFooter) {
  if (!headerFooter || typeof headerFooter !== 'object') return defaultHeaderFooter();
  return { ...defaultHeaderFooter(), ...headerFooter };
}

function makeId(prefix = 'doc') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createVersion(snapshot, index, meta = {}) {
  return {
    id: makeId('ver'),
    snapshot,
    contentJson: meta.contentJson !== undefined ? meta.contentJson : null,
    revision: typeof meta.revision === 'number' ? meta.revision : index,
    savedAt: new Date().toISOString(),
    label: meta.label || `v${index + 1}`,
  };
}

function normalizeComment(comment) {
  if (!comment || typeof comment !== 'object') {
    return {
      id: makeId('comm'),
      threadId: makeId('th'),
      parentId: null,
      text: '',
      body: '',
      author: 'Anonymous',
      anchor: null,
      mentions: [],
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const commentId = comment.id !== undefined ? comment.id : makeId('comm');
  const text = comment.text || comment.body || '';
  const body = comment.body || comment.text || '';
  const parentId = comment.parentId || null;
  const threadId = comment.threadId || (parentId ? null : String(commentId));

  let anchor = null;
  if (comment.anchor && typeof comment.anchor === 'object') {
    anchor = {
      nodeId: comment.anchor.nodeId || '',
      from: typeof comment.anchor.from === 'number' ? comment.anchor.from : 0,
      to: typeof comment.anchor.to === 'number' ? comment.anchor.to : 0,
      quotedText: comment.anchor.quotedText || '',
    };
  }

  return {
    id: commentId,
    threadId,
    parentId,
    text,
    body,
    author: comment.author || 'Anonymous',
    anchor,
    mentions: Array.isArray(comment.mentions) ? comment.mentions : [],
    resolved: Boolean(comment.resolved),
    createdAt: comment.createdAt || new Date().toISOString(),
    updatedAt: comment.updatedAt || comment.createdAt || new Date().toISOString(),
  };
}

function normalizeDoc(document) {
  if (!document) return null;
  const revision = Number(document.revision);

  return {
    id: document.id,
    title: document.title || 'Untitled Document',
    contentFormatVersion: typeof document.contentFormatVersion === 'number' ? document.contentFormatVersion : 2,
    contentJson: document.contentJson !== undefined ? document.contentJson : null,
    content: document.content || '<p></p>',
    createdAt: document.createdAt || new Date().toISOString(),
    updatedAt: document.updatedAt || new Date().toISOString(),
    revision: Number.isFinite(revision) && revision >= 0 ? revision : 0,
    owner: document.owner || null,
    sharedWith: Array.isArray(document.sharedWith)
      ? document.sharedWith.map((entry) => ({
          id: entry?.id || '',
          email: entry?.email || '',
          role: entry?.role || 'viewer',
          sharedAt: entry?.sharedAt || new Date().toISOString(),
        }))
      : [],
    shareLinkEnabled: document.shareLinkEnabled === true,
    versions: Array.isArray(document.versions) ? document.versions : [],
    comments: Array.isArray(document.comments) ? document.comments.map(normalizeComment) : [],
    trackChanges: Boolean(document.trackChanges),
    styles: Array.isArray(document.styles) ? document.styles : [],
    references: document.references && typeof document.references === 'object'
      ? {
          citations: Array.isArray(document.references.citations) ? document.references.citations : [],
          captions: Array.isArray(document.references.captions) ? document.references.captions : [],
          indexEntries: Array.isArray(document.references.indexEntries) ? document.references.indexEntries : [],
        }
      : defaultReferences(),
    security: document.security && typeof document.security === 'object'
      ? {
          protected: Boolean(document.security.protected),
          keyVersion: typeof document.security.keyVersion === 'number' ? document.security.keyVersion : 1,
          kdf: document.security.kdf || 'PBKDF2',
          salt: document.security.salt || '',
          nonce: document.security.nonce || '',
          authTag: document.security.authTag || '',
          encryptedPayload: document.security.encryptedPayload || '',
        }
      : defaultSecurityEnvelope(),
    aiProfile: document.aiProfile && typeof document.aiProfile === 'object'
      ? {
          tone: document.aiProfile.tone || 'balanced',
          audience: document.aiProfile.audience || 'general',
          responseStyle: document.aiProfile.responseStyle || 'concise',
          preferredTerms: Array.isArray(document.aiProfile.preferredTerms) ? document.aiProfile.preferredTerms : [],
          forbiddenTerms: Array.isArray(document.aiProfile.forbiddenTerms) ? document.aiProfile.forbiddenTerms : [],
          instructions: document.aiProfile.instructions || '',
        }
      : defaultAiProfile(),
    accessPolicy: document.accessPolicy && typeof document.accessPolicy === 'object'
      ? {
          allowDownload: document.accessPolicy.allowDownload !== false,
          allowComments: document.accessPolicy.allowComments !== false,
          allowCopy: document.accessPolicy.allowCopy !== false,
        }
      : defaultAccessPolicy(),
    documentParts: Array.isArray(document.documentParts)
      ? document.documentParts.map((part) => ({
          partId: part.partId || makeId('part'),
          partType: part.partType || 'subdocument',
          title: part.title || '',
          linkedDocumentId: part.linkedDocumentId || '',
          includeMode: part.includeMode || 'linked',
          order: typeof part.order === 'number' ? part.order : 0,
        }))
      : [],
    signatures: Array.isArray(document.signatures) ? document.signatures : [],
    design: document.design && typeof document.design === 'object'
      ? { ...defaultDesign(), ...document.design }
      : defaultDesign(),
    headerFooter: normalizeHeaderFooter(document.headerFooter),
    ipfsHash: document.ipfsHash || null,
    ipfsGatewayUrl: document.ipfsGatewayUrl || null,
    ipfsPinnedAt: document.ipfsPinnedAt || null,
  };
}

function isSameUser(a = {}, b = {}) {
  const left = sanitizeUser(a);
  const right = sanitizeUser(b);
  return Boolean(left.id && right.id) && left.id === right.id;
}

function canAccessDocument(document, user = {}) {
  if (!document) return false;
  return checkPermission(document, user, 'read').allowed;
}

function sanitizeUser(user = {}) {
  const name = user.name || user.email || 'Guest User';
  const email = user.email || '';
  const id = user.id || email || name.toLowerCase().replace(/\s+/g, '-');
  return { id, name, email };
}

async function listDocuments(user = {}) {
  const normalizedUser = sanitizeUser(user);

  if (!isMongoConnected()) {
    const store = readStore();
    return store.documents
      .map(normalizeDoc)
      .filter((document) => !document.owner || canAccessDocument(document, normalizedUser))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const email = String(normalizedUser.email || '').trim().toLowerCase();
  const id = String(normalizedUser.id || '').trim().toLowerCase();

  let query;
  if (id === 'guest-user') {
    query = {
      $or: [
        { 'owner.id': 'guest-user' },
        { 'owner.id': { $exists: false } },
        { 'owner.id': null },
      ],
    };
  } else {
    query = {
      $or: [
        { 'owner.id': id },
        { 'owner.email': email },
        { 'sharedWith.email': email },
        { 'sharedWith.id': id },
      ],
    };
  }

  try {
    const docs = await Document.find(query).sort({ updatedAt: -1 });
    return docs.map((d) => normalizeDoc(d.toObject()));
  } catch (err) {
    console.warn('MongoDB find failed, falling back to local store:', err.message);
    const store = readStore();
    return store.documents
      .map(normalizeDoc)
      .filter((document) => !document.owner || canAccessDocument(document, normalizedUser))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

async function getDocument(id, user = {}) {
  if (!isMongoConnected()) {
    const store = readStore();
    const document = store.documents.find((entry) => entry.id === id);
    const normalized = document ? normalizeDoc(document) : null;
    if (!normalized) return null;
    if (!normalized.owner) return normalized;
    return canAccessDocument(normalized, user) ? normalized : null;
  }

  try {
    const doc = await Document.findOne({ id });
    if (!doc) return null;
    const normalized = normalizeDoc(doc.toObject());
    if (!canAccessDocument(normalized, user)) return null;
    return normalized;
  } catch (err) {
    console.warn('MongoDB findOne failed, falling back to local store:', err.message);
    const store = readStore();
    const document = store.documents.find((entry) => entry.id === id);
    const normalized = document ? normalizeDoc(document) : null;
    if (!normalized) return null;
    if (!normalized.owner) return normalized;
    return canAccessDocument(normalized, user) ? normalized : null;
  }
}

async function createDocument(input = {}, user = {}) {
  const now = new Date().toISOString();
  const docData = normalizeDoc({
    id: makeId(),
    title: input.title || 'Untitled Document',
    contentFormatVersion: typeof input.contentFormatVersion === 'number' ? input.contentFormatVersion : 2,
    contentJson: input.contentJson !== undefined ? input.contentJson : null,
    content: input.content || '<p></p>',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    owner: sanitizeUser(user),
    sharedWith: [],
    versions: [],
    comments: Array.isArray(input.comments) ? input.comments.map(normalizeComment) : [],
    trackChanges: Boolean(input.trackChanges),
    styles: Array.isArray(input.styles) ? input.styles : [],
    references: input.references || defaultReferences(),
    security: input.security || defaultSecurityEnvelope(),
    aiProfile: input.aiProfile || defaultAiProfile(),
    accessPolicy: input.accessPolicy || defaultAccessPolicy(),
    documentParts: Array.isArray(input.documentParts) ? input.documentParts : [],
    signatures: Array.isArray(input.signatures) ? input.signatures : [],
    design: input.design && typeof input.design === 'object' ? { ...defaultDesign(), ...input.design } : defaultDesign(),
    headerFooter: normalizeHeaderFooter(input.headerFooter),
  });

  if (!isMongoConnected()) {
    const store = readStore();
    store.documents.unshift(docData);
    writeStore(store);
    return docData;
  }

  try {
    const created = await Document.create(docData);
    return normalizeDoc(created.toObject());
  } catch (err) {
    console.warn('MongoDB create failed, falling back to local store:', err.message);
    const store = readStore();
    store.documents.unshift(docData);
    writeStore(store);
    return docData;
  }
}

async function updateDocument(id, input = {}, options = {}) {
  let current;
  if (!isMongoConnected()) {
    const store = readStore();
    const index = store.documents.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    current = normalizeDoc(store.documents[index]);
  } else {
    try {
      const doc = await Document.findOne({ id });
      if (!doc) return null;
      current = normalizeDoc(doc.toObject());
    } catch (err) {
      console.warn('MongoDB findOne in update failed, falling back to local store:', err.message);
      const store = readStore();
      const index = store.documents.findIndex((entry) => entry.id === id);
      if (index === -1) return null;
      current = normalizeDoc(store.documents[index]);
    }
  }

  const next = { ...current };
  const createVersionEntry = options.createVersion !== false;

  if (typeof input.title === 'string') next.title = input.title || 'Untitled Document';
  if (typeof input.content === 'string') next.content = input.content;
  if (input.contentJson !== undefined) next.contentJson = input.contentJson;
  if (typeof input.contentFormatVersion === 'number') next.contentFormatVersion = input.contentFormatVersion;
  if (Array.isArray(input.comments)) next.comments = input.comments.map(normalizeComment);
  if (typeof input.trackChanges === 'boolean') next.trackChanges = input.trackChanges;
  if (Array.isArray(input.styles)) next.styles = input.styles;
  if (input.references && typeof input.references === 'object') {
    next.references = {
      citations: Array.isArray(input.references.citations) ? input.references.citations : next.references.citations,
      captions: Array.isArray(input.references.captions) ? input.references.captions : next.references.captions,
      indexEntries: Array.isArray(input.references.indexEntries) ? input.references.indexEntries : next.references.indexEntries,
    };
  }
  if (input.security && typeof input.security === 'object') {
    next.security = { ...next.security, ...input.security };
  }
  if (input.aiProfile && typeof input.aiProfile === 'object') {
    next.aiProfile = { ...next.aiProfile, ...input.aiProfile };
  }
  if (input.accessPolicy && typeof input.accessPolicy === 'object') {
    next.accessPolicy = { ...next.accessPolicy, ...input.accessPolicy };
  }
  if (Array.isArray(input.documentParts)) next.documentParts = input.documentParts;
  if (Array.isArray(input.signatures)) next.signatures = input.signatures;

  if (input.design && typeof input.design === 'object') {
    next.design = { ...defaultDesign(), ...(current.design || {}), ...input.design };
  }
  if (input.headerFooter && typeof input.headerFooter === 'object') {
    next.headerFooter = normalizeHeaderFooter({ ...(current.headerFooter || {}), ...input.headerFooter });
  }

  if (typeof input.ipfsHash === 'string' || input.ipfsHash === null) next.ipfsHash = input.ipfsHash || null;
  if (typeof input.ipfsGatewayUrl === 'string' || input.ipfsGatewayUrl === null) next.ipfsGatewayUrl = input.ipfsGatewayUrl || null;
  if (typeof input.ipfsPinnedAt === 'string' || input.ipfsPinnedAt === null) next.ipfsPinnedAt = input.ipfsPinnedAt || null;

  const hasCollabMutation =
    typeof input.title === 'string'
    || typeof input.content === 'string'
    || input.contentJson !== undefined
    || Array.isArray(input.comments)
    || typeof input.trackChanges === 'boolean'
    || Array.isArray(input.styles)
    || (input.references && typeof input.references === 'object')
    || Array.isArray(input.documentParts)
    || (input.design && typeof input.design === 'object')
    || (input.headerFooter && typeof input.headerFooter === 'object');

  if (hasCollabMutation) {
    next.revision = Number(current.revision || 0) + 1;
  }

  next.updatedAt = new Date().toISOString();

  const contentChanged = current.content !== next.content;
  const jsonChanged = JSON.stringify(current.contentJson) !== JSON.stringify(next.contentJson);

  if (createVersionEntry && (contentChanged || jsonChanged)) {
    const newVer = createVersion(current.content, current.versions.length, {
      contentJson: current.contentJson,
      revision: current.revision,
    });
    next.versions = [newVer, ...current.versions].slice(0, 40);
  }

  if (!isMongoConnected()) {
    const store = readStore();
    const index = store.documents.findIndex((entry) => entry.id === id);
    if (index !== -1) {
      store.documents[index] = next;
      writeStore(store);
    }
    return next;
  }

  try {
    const updated = await Document.findOneAndUpdate({ id }, next, { new: true });
    return updated ? normalizeDoc(updated.toObject()) : next;
  } catch (err) {
    console.warn('MongoDB update failed, saving to local store:', err.message);
    const store = readStore();
    const index = store.documents.findIndex((entry) => entry.id === id);
    if (index !== -1) {
      store.documents[index] = next;
    } else {
      store.documents.unshift(next);
    }
    writeStore(store);
    return next;
  }
}

async function deleteDocument(id) {
  if (!isMongoConnected()) {
    const store = readStore();
    const before = store.documents.length;
    store.documents = store.documents.filter((entry) => entry.id !== id);
    writeStore(store);
    return store.documents.length !== before;
  }
  try {
    const result = await Document.deleteOne({ id });
    return result.deletedCount > 0;
  } catch (err) {
    console.warn('MongoDB delete failed, falling back to local store:', err.message);
    const store = readStore();
    const before = store.documents.length;
    store.documents = store.documents.filter((entry) => entry.id !== id);
    writeStore(store);
    return store.documents.length !== before;
  }
}

async function listVersions(id) {
  const document = await getDocument(id);
  return document ? document.versions : null;
}

async function restoreVersion(id, versionId) {
  const document = await getDocument(id);
  if (!document) return null;
  const version = document.versions.find((entry) => entry.id === versionId);
  if (!version) return null;
  return updateDocument(
    id,
    {
      content: version.snapshot,
      contentJson: version.contentJson || null,
    },
    { createVersion: true }
  );
}

async function shareDocument(id, share = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;

  const current = normalizeDoc(doc.toObject());
  const email = String(share.email || '').trim().toLowerCase();
  const role = ['owner', 'editor', 'commenter', 'viewer'].includes(share.role) ? share.role : 'viewer';

  if (!email) {
    const shareEntry = {
      id: makeId('share'),
      email: '',
      role,
      sharedAt: new Date().toISOString(),
    };
    current.shareLinkEnabled = true;
    current.updatedAt = new Date().toISOString();
    const updated = await Document.findOneAndUpdate({ id }, current, { new: true });
    return { share: shareEntry, document: normalizeDoc(updated.toObject()) };
  }

  const existingIndex = current.sharedWith.findIndex((entry) => String(entry.email || '').toLowerCase() === email);
  const shareEntry = {
    id: makeId('share'),
    email,
    role,
    sharedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    current.sharedWith[existingIndex] = { ...current.sharedWith[existingIndex], ...shareEntry };
  } else {
    current.sharedWith = [shareEntry, ...current.sharedWith];
  }

  current.updatedAt = new Date().toISOString();
  const updated = await Document.findOneAndUpdate({ id }, current, { new: true });
  return { share: shareEntry, document: normalizeDoc(updated.toObject()) };
}

async function getAiProfile(id, user = {}) {
  const document = await getDocument(id, user);
  if (!document) return null;
  return document.aiProfile;
}

async function updateAiProfile(id, profileInput = {}, user = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;
  const current = normalizeDoc(doc.toObject());
  const perm = checkPermission(current, user, 'edit');
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Permission denied');
    err.status = 403;
    throw err;
  }

  const updatedProfile = {
    tone: profileInput.tone || current.aiProfile.tone,
    audience: profileInput.audience || current.aiProfile.audience,
    responseStyle: profileInput.responseStyle || current.aiProfile.responseStyle,
    preferredTerms: Array.isArray(profileInput.preferredTerms) ? profileInput.preferredTerms : current.aiProfile.preferredTerms,
    forbiddenTerms: Array.isArray(profileInput.forbiddenTerms) ? profileInput.forbiddenTerms : current.aiProfile.forbiddenTerms,
    instructions: profileInput.instructions !== undefined ? profileInput.instructions : current.aiProfile.instructions,
  };

  return updateDocument(id, { aiProfile: updatedProfile }, { createVersion: false });
}

async function updateSecurityEnvelope(id, securityInput = {}, user = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;
  const current = normalizeDoc(doc.toObject());
  const perm = checkPermission(current, user, 'security');
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Permission denied');
    err.status = 403;
    throw err;
  }

  const updatedSecurity = {
    protected: securityInput.protected !== undefined ? Boolean(securityInput.protected) : true,
    keyVersion: typeof securityInput.keyVersion === 'number' ? securityInput.keyVersion : (Number(current.security.keyVersion || 1) + 1),
    kdf: securityInput.kdf || current.security.kdf || 'PBKDF2',
    salt: securityInput.salt !== undefined ? securityInput.salt : current.security.salt,
    nonce: securityInput.nonce !== undefined ? securityInput.nonce : current.security.nonce,
    authTag: securityInput.authTag !== undefined ? securityInput.authTag : current.security.authTag,
    encryptedPayload: securityInput.encryptedPayload !== undefined ? securityInput.encryptedPayload : current.security.encryptedPayload,
  };

  const updatePayload = { security: updatedSecurity };
  // When encrypting with a payload, reset plaintext contentJson to prevent leakage
  if (updatedSecurity.protected && updatedSecurity.encryptedPayload) {
    updatePayload.contentJson = null;
  }

  return updateDocument(id, updatePayload, { createVersion: false });
}

async function addDocumentPart(id, partData = {}, user = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;
  const current = normalizeDoc(doc.toObject());
  const perm = checkPermission(current, user, 'manage_subdocuments');
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Permission denied');
    err.status = 403;
    throw err;
  }

  const targetDocId = partData.linkedDocumentId;
  if (targetDocId && targetDocId === id) {
    const err = new Error('Cannot link document to itself (circular reference detected)');
    err.status = 400;
    throw err;
  }

  if (targetDocId) {
    const targetDoc = await Document.findOne({ id: targetDocId });
    if (targetDoc && Array.isArray(targetDoc.documentParts)) {
      const hasCycle = targetDoc.documentParts.some((p) => p.linkedDocumentId === id);
      if (hasCycle) {
        const err = new Error('Circular dependency detected between documents');
        err.status = 400;
        throw err;
      }
    }
  }

  const newPart = {
    partId: partData.partId || makeId('part'),
    partType: partData.partType || 'subdocument',
    title: partData.title || 'Untitled Part',
    linkedDocumentId: targetDocId || '',
    includeMode: partData.includeMode || 'linked',
    order: typeof partData.order === 'number' ? partData.order : current.documentParts.length,
  };

  const updatedParts = [...current.documentParts, newPart];
  return updateDocument(id, { documentParts: updatedParts }, { createVersion: false });
}

async function removeDocumentPart(id, partId, user = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;
  const current = normalizeDoc(doc.toObject());
  const perm = checkPermission(current, user, 'manage_subdocuments');
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Permission denied');
    err.status = 403;
    throw err;
  }

  const updatedParts = current.documentParts.filter((p) => p.partId !== partId);
  return updateDocument(id, { documentParts: updatedParts }, { createVersion: false });
}

async function getRevisions(id, targetRevision, user = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;
  const current = normalizeDoc(doc.toObject());
  const perm = checkPermission(current, user, 'read');
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Permission denied');
    err.status = 403;
    throw err;
  }

  if (targetRevision === undefined || targetRevision === null) {
    return {
      currentRevision: current.revision,
      availableVersions: current.versions.map((v) => ({
        id: v.id,
        revision: v.revision,
        savedAt: v.savedAt,
        label: v.label,
      })),
    };
  }

  const targetRev = Number(targetRevision);
  if (Number(current.revision) === targetRev) {
    return {
      revision: current.revision,
      content: current.content,
      contentJson: current.contentJson,
      savedAt: current.updatedAt,
      label: `r${current.revision}`,
    };
  }

  const match = current.versions.find(
    (v) => Number(v.revision) === targetRev || v.label === `v${targetRev}` || v.label === `r${targetRev}`
  );

  if (match) {
    return {
      revision: match.revision !== undefined ? match.revision : targetRev,
      content: match.snapshot,
      contentJson: match.contentJson || null,
      savedAt: match.savedAt,
      label: match.label,
    };
  }

  return {
    revision: targetRev,
    content: current.content,
    contentJson: current.contentJson,
    savedAt: current.updatedAt,
    label: `r${targetRev}`,
    fallback: true,
  };
}

module.exports = {
  addDocumentPart,
  canAccessDocument,
  createDocument,
  deleteDocument,
  getAiProfile,
  getDocument,
  getRevisions,
  isSameUser,
  listDocuments,
  listVersions,
  normalizeDoc,
  removeDocumentPart,
  restoreVersion,
  sanitizeUser,
  shareDocument,
  updateAiProfile,
  updateDocument,
  updateSecurityEnvelope,
};
