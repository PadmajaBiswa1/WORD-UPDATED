const crypto = require('crypto');
const Document = require('../models/Document');

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

function normalizeHeaderFooter(headerFooter) {
  if (!headerFooter || typeof headerFooter !== 'object') return defaultHeaderFooter();
  return { ...defaultHeaderFooter(), ...headerFooter };
}

function makeId(prefix = 'doc') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createVersion(snapshot, index) {
  return {
    id: makeId('ver'),
    snapshot,
    savedAt: new Date().toISOString(),
    label: `v${index + 1}`,
  };
}

function normalizeDoc(document) {
  const revision = Number(document.revision);
  return {
    id: document.id,
    title: document.title || 'Untitled Document',
    content: document.content || '<p></p>',
    createdAt: document.createdAt || new Date().toISOString(),
    updatedAt: document.updatedAt || new Date().toISOString(),
    revision: Number.isFinite(revision) && revision >= 0 ? revision : 0,
    owner: document.owner || null,
    sharedWith: Array.isArray(document.sharedWith) ? document.sharedWith : [],
    shareLinkEnabled: document.shareLinkEnabled === true,
    versions: Array.isArray(document.versions) ? document.versions : [],
    comments: Array.isArray(document.comments) ? document.comments : [],
    trackChanges: Boolean(document.trackChanges),
    design: document.design && typeof document.design === 'object'
      ? { ...defaultDesign(), ...document.design }
      : defaultDesign(),
    headerFooter: normalizeHeaderFooter(document.headerFooter),
    // IPFS fields
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
  const owner = document.owner || null;
  if (owner && isSameUser(owner, user)) return true;
  if (document.shareLinkEnabled === true) return true;

  const email = String(user.email || '').trim().toLowerCase();
  const id = String(user.id || '').trim().toLowerCase();
  return Array.isArray(document.sharedWith) && document.sharedWith.some((entry) => {
    const shareEmail = String(entry?.email || '').trim().toLowerCase();
    const shareId = String(entry?.id || '').trim().toLowerCase();
    return (email && shareEmail === email) || (id && shareId === id);
  });
}

function sanitizeUser(user = {}) {
  const name = user.name || user.email || 'Guest User';
  const email = user.email || '';
  const id = user.id || email || name.toLowerCase().replace(/\s+/g, '-');
  return { id, name, email };
}

async function listDocuments(user = {}) {
  const normalizedUser = sanitizeUser(user);
  const email = String(normalizedUser.email || '').trim().toLowerCase();
  const id = String(normalizedUser.id || '').trim().toLowerCase();
  
  let query;
  if (id === 'guest-user') {
    query = {
      $or: [
        { 'owner.id': 'guest-user' },
        { 'owner.id': { $exists: false } },
        { 'owner.id': null }
      ]
    };
  } else {
    query = {
      $or: [
        { 'owner.id': id },
        { 'sharedWith.email': email },
        { 'sharedWith.id': id }
      ]
    };
  }

  const docs = await Document.find(query).sort({ updatedAt: -1 });
  return docs.map((d) => normalizeDoc(d.toObject()));
}

async function getDocument(id, user = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;
  const normalized = normalizeDoc(doc.toObject());
  if (!normalized.owner) return normalized;
  return canAccessDocument(normalized, user) ? normalized : null;
}

async function createDocument(input = {}, user = {}) {
  const now = new Date().toISOString();
  const docData = normalizeDoc({
    id: makeId(),
    title: input.title || 'Untitled Document',
    content: input.content || '<p></p>',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    owner: sanitizeUser(user),
    sharedWith: [],
    versions: [],
    comments: Array.isArray(input.comments) ? input.comments : [],
    trackChanges: Boolean(input.trackChanges),
    design: input.design && typeof input.design === 'object' ? { ...defaultDesign(), ...input.design } : defaultDesign(),
    headerFooter: normalizeHeaderFooter(input.headerFooter),
  });

  const created = await Document.create(docData);
  return normalizeDoc(created.toObject());
}

async function updateDocument(id, input = {}, options = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;

  const current = normalizeDoc(doc.toObject());
  const next = { ...current };
  const createVersionEntry = options.createVersion !== false;

  if (typeof input.title === 'string') next.title = input.title || 'Untitled Document';
  if (typeof input.content === 'string') next.content = input.content;
  if (Array.isArray(input.comments)) next.comments = input.comments;
  if (typeof input.trackChanges === 'boolean') next.trackChanges = input.trackChanges;
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
    || Array.isArray(input.comments)
    || typeof input.trackChanges === 'boolean'
    || (input.design && typeof input.design === 'object')
    || (input.headerFooter && typeof input.headerFooter === 'object');

  if (hasCollabMutation) {
    next.revision = Number(current.revision || 0) + 1;
  }

  next.updatedAt = new Date().toISOString();

  if (createVersionEntry && current.content !== next.content) {
    next.versions = [createVersion(current.content, current.versions.length), ...current.versions].slice(0, 40);
  }

  const updated = await Document.findOneAndUpdate({ id }, next, { new: true });
  return updated ? normalizeDoc(updated.toObject()) : null;
}

async function deleteDocument(id) {
  const result = await Document.deleteOne({ id });
  return result.deletedCount > 0;
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
  return updateDocument(id, { content: version.snapshot }, { createVersion: true });
}

async function shareDocument(id, share = {}) {
  const doc = await Document.findOne({ id });
  if (!doc) return null;

  const current = normalizeDoc(doc.toObject());
  const email = String(share.email || '').trim().toLowerCase();
  const role = share.role || 'viewer';

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

module.exports = {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  listVersions,
  restoreVersion,
  sanitizeUser,
  shareDocument,
  updateDocument,
};
