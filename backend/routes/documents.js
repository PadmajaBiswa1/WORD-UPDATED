const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  addDocumentPart,
  canAccessDocument,
  createDocument,
  deleteDocument,
  getAiProfile,
  getDocument,
  getRevisions,
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
} = require('../lib/documentStore');
const { getEffectiveRole, checkPermission } = require('../lib/authorization');
const { createNotification } = require('./notifications');
const ipfsService = require('../utils/ipfsService');
const {
  broadcast,
  broadcastPresence,
  listCollaborators,
  registerClient,
  unregisterClient,
  updatePresence,
  writeEvent,
} = require('../lib/collaborationHub');

const User = require('../models/User');
const { extractUserFromRequest } = require('../middleware/auth');

function requestUser(req) {
  if (req.user && req.user.id && req.isAuthenticated) {
    return sanitizeUser(req.user);
  }
  return sanitizeUser(extractUserFromRequest(req));
}

/**
 * Dispatches in-app notifications for @mentions in comments.
 * Handles both explicit comment.mentions and regex-parsed @username in comment text.
 */
async function dispatchCommentNotifications(document, comments = [], sender = {}) {
  if (!document || !Array.isArray(comments)) return;

  for (const comment of comments) {
    if (!comment) continue;

    const explicitMentions = Array.isArray(comment.mentions) ? comment.mentions : [];
    const text = String(comment.text || comment.body || '');
    const regex = /@([a-zA-Z0-9._-]+)/g;
    let match;
    const detectedHandles = new Set();
    while ((match = regex.exec(text)) !== null) {
      const handle = match[1];
      if (handle && handle.length >= 2) {
        detectedHandles.add(handle.toLowerCase());
      }
    }

    const allMentionTargets = [...explicitMentions];
    for (const handle of detectedHandles) {
      if (!allMentionTargets.some((m) => (m.userId === handle || m.displayName === handle || m.email === handle))) {
        allMentionTargets.push({ userId: handle, displayName: handle });
      }
    }

    if (allMentionTargets.length === 0) continue;

    for (const mention of allMentionTargets) {
      if (mention && (mention.userId || mention.displayName)) {
        try {
          const target = String(mention.userId || mention.displayName || '').trim();
          if (!target) continue;

          let userRecord = null;
          try {
            userRecord = await User.findOne({
              $or: [
                { email: target.toLowerCase() },
                { name: new RegExp(`^${target}$`, 'i') },
                { email: new RegExp(`^${target}@`, 'i') },
              ],
            });
          } catch {
            // ignore find errors
          }

          const recipientId = userRecord ? String(userRecord._id) : target;
          const recipientEmail = userRecord?.email || (target.includes('@') ? target : '');

          await createNotification({
            recipientId,
            recipientEmail,
            sender: {
              id: sender.id || '',
              name: sender.name || 'Someone',
              email: sender.email || '',
            },
            documentId: document.id,
            documentTitle: document.title || 'Untitled Document',
            threadId: comment.threadId || null,
            commentId: comment.id,
            type: 'mention',
            message: `${sender.name || 'Someone'} mentioned you in a comment on "${document.title || 'Untitled Document'}": "${text.slice(0, 80)}"`,
          });
        } catch (err) {
          console.error('Failed to create mention notification:', err.message);
        }
      }
    }
  }
}

// ── GET /api/documents ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const docs = await listDocuments(requestUser(req));
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/documents ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const document = await createDocument(req.body || {}, requestUser(req));
    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Test email endpoint ────────────────────────────────────────
router.post('/test/send-email', async (req, res) => {
  const { testEmail } = req.body || {};
  if (!testEmail) {
    return res.status(400).json({ message: 'testEmail is required' });
  }

  res.json({
    ok: true,
    message: 'EmailJS sending now happens in the browser. Use the app UI to send test mail.',
    testEmail,
    details: {
      emailjsServiceId: process.env.EMAILJS_SERVICE_ID ? '✓ Set' : '✗ Missing',
      emailjsTemplateId: process.env.EMAILJS_TEMPLATE_ID ? '✓ Set' : '✗ Missing',
      emailjsPublicKey: process.env.EMAILJS_PUBLIC_KEY ? '✓ Set' : '✗ Missing',
      emailjsPrivateKey: process.env.EMAILJS_PRIVATE_KEY ? '✓ Set' : '✗ Missing',
    },
  });
});

// ── IPFS status check ──────────────────────────────────────────
router.get('/test/ipfs-status', async (req, res) => {
  const enabled = process.env.IPFS_ENABLED === 'true';
  const hasCredentials = !!process.env.PINATA_JWT;

  if (!enabled) {
    return res.json({
      ok: false,
      enabled: false,
      message: 'IPFS integration is disabled',
    });
  }

  try {
    const connected = await ipfsService.verifyConnection();
    res.json({
      ok: connected,
      enabled: true,
      connected,
      message: connected ? 'IPFS service is ready' : 'IPFS connection failed',
      hasCredentials,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      enabled: true,
      connected: false,
      message: 'Failed to verify IPFS connection',
      error: error?.message,
      hasCredentials,
    });
  }
});

// ── Access Control Endpoints ───────────────────────────────────
router.get('/:id/access', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'read');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Access denied', reason: perm.reason });
    }

    res.json({
      owner: document.owner,
      sharedWith: document.sharedWith,
      shareLinkEnabled: document.shareLinkEnabled,
      accessPolicy: document.accessPolicy,
      effectiveRole: perm.role,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/access', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'share');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Share permission denied', reason: perm.reason });
    }

    const { email, id, role = 'viewer' } = req.body || {};
    const validRoles = ['owner', 'editor', 'commenter', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const shareResult = await shareDocument(req.params.id, { email, id, role });
    res.json({
      ok: true,
      share: shareResult.share,
      sharedWith: shareResult.document.sharedWith,
      accessPolicy: shareResult.document.accessPolicy,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/access/:entryId', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'share');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Share permission denied', reason: perm.reason });
    }

    const { entryId } = req.params;

    // Special entryId 'policy' allows updating document access policy
    if (entryId === 'policy') {
      const policyInput = req.body.accessPolicy || req.body;
      const updatedPolicy = {
        allowDownload: policyInput.allowDownload !== undefined ? Boolean(policyInput.allowDownload) : document.accessPolicy.allowDownload,
        allowComments: policyInput.allowComments !== undefined ? Boolean(policyInput.allowComments) : document.accessPolicy.allowComments,
        allowCopy: policyInput.allowCopy !== undefined ? Boolean(policyInput.allowCopy) : document.accessPolicy.allowCopy,
      };
      const updated = await updateDocument(req.params.id, { accessPolicy: updatedPolicy }, { createVersion: false });
      return res.json({ ok: true, accessPolicy: updated.accessPolicy });
    }

    const { role } = req.body || {};
    const validRoles = ['owner', 'editor', 'commenter', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const targetIdx = document.sharedWith.findIndex(
      (e) => e.id === entryId || String(e.email || '').toLowerCase() === entryId.toLowerCase()
    );

    if (targetIdx === -1) {
      return res.status(404).json({ message: 'Access entry not found' });
    }

    const updatedSharedWith = [...document.sharedWith];
    updatedSharedWith[targetIdx] = {
      ...updatedSharedWith[targetIdx],
      role: role || updatedSharedWith[targetIdx].role,
    };

    const updated = await updateDocument(req.params.id, { sharedWith: updatedSharedWith }, { createVersion: false });
    res.json({ ok: true, sharedWith: updated.sharedWith, accessPolicy: updated.accessPolicy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id/access/:entryId', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'share');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Share permission denied', reason: perm.reason });
    }

    const { entryId } = req.params;
    const updatedSharedWith = document.sharedWith.filter(
      (e) => e.id !== entryId && String(e.email || '').toLowerCase() !== entryId.toLowerCase()
    );

    const updated = await updateDocument(req.params.id, { sharedWith: updatedSharedWith }, { createVersion: false });
    res.json({ ok: true, sharedWith: updated.sharedWith });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Security Envelope Rotation ─────────────────────────────────
router.post('/:id/security/rotate', async (req, res) => {
  try {
    const user = requestUser(req);
    const updated = await updateSecurityEnvelope(req.params.id, req.body || {}, user);
    if (!updated) return res.status(404).json({ message: 'Document not found' });
    res.json({ ok: true, security: updated.security });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ── Digital Signatures ─────────────────────────────────────────
router.post('/:id/signatures/:fieldId/verify', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'sign');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Sign permission denied', reason: perm.reason });
    }

    const { fieldId } = req.params;
    const { signer, signature, publicKey, contentHash, reason, status, documentContent } = req.body || {};

    const canonicalContent = documentContent !== undefined
      ? (typeof documentContent === 'string' ? documentContent : JSON.stringify(documentContent))
      : (document.contentJson ? JSON.stringify(document.contentJson) : (document.content || ''));
    const currentHash = crypto.createHash('sha256').update(canonicalContent).digest('hex');

    const isMatch = contentHash ? (contentHash === currentHash) : true;
    const determinedStatus = status || (isMatch ? 'valid' : 'invalid');

    const signatureRecord = {
      fieldId,
      signer: signer || user,
      signature: signature || '',
      publicKey: publicKey || '',
      contentHash: contentHash || currentHash,
      status: determinedStatus,
      signedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      reason: reason || 'Document approved',
    };

    const existingIndex = document.signatures.findIndex((s) => s.fieldId === fieldId);
    const updatedSignatures = [...document.signatures];
    if (existingIndex >= 0) {
      updatedSignatures[existingIndex] = { ...updatedSignatures[existingIndex], ...signatureRecord };
    } else {
      updatedSignatures.push(signatureRecord);
    }

    await updateDocument(req.params.id, { signatures: updatedSignatures }, { createVersion: false });

    res.json({
      ok: true,
      signature: signatureRecord,
      isValid: signatureRecord.status === 'valid',
      currentHash,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── AI Profile Endpoints ───────────────────────────────────────
router.get('/:id/ai-profile', async (req, res) => {
  try {
    const user = requestUser(req);
    const aiProfile = await getAiProfile(req.params.id, user);
    if (!aiProfile) return res.status(404).json({ message: 'Document or AI profile not found' });
    res.json({ ok: true, aiProfile });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.put('/:id/ai-profile', async (req, res) => {
  try {
    const user = requestUser(req);
    const updated = await updateAiProfile(req.params.id, req.body || {}, user);
    if (!updated) return res.status(404).json({ message: 'Document not found' });
    res.json({ ok: true, aiProfile: updated.aiProfile });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ── Master / Subdocument Parts Endpoints ───────────────────────
router.get('/:id/parts', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'read');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Access denied', reason: perm.reason });
    }

    res.json({ ok: true, parts: document.documentParts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/parts', async (req, res) => {
  try {
    const user = requestUser(req);
    const updated = await addDocumentPart(req.params.id, req.body || {}, user);
    if (!updated) return res.status(404).json({ message: 'Document not found' });
    res.json({ ok: true, documentParts: updated.documentParts });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.delete('/:id/parts/:partId', async (req, res) => {
  try {
    const user = requestUser(req);
    const updated = await removeDocumentPart(req.params.id, req.params.partId, user);
    if (!updated) return res.status(404).json({ message: 'Document not found' });
    res.json({ ok: true, documentParts: updated.documentParts });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ── Conflict Resolution & Merge Endpoints ──────────────────────
router.post('/:id/merge/preview', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'edit');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Edit permission required for merge preview', reason: perm.reason });
    }

    const { baseRevision, localContent, localContentJson } = req.body || {};
    const baseSnapshot = await getRevisions(req.params.id, baseRevision, user);

    const baseRevNum = Number(baseRevision);
    const serverRevNum = Number(document.revision || 0);
    const hasConflicts = baseRevNum !== serverRevNum;

    res.json({
      ok: true,
      baseRevision: baseRevNum,
      serverRevision: serverRevNum,
      hasConflicts,
      base: baseSnapshot,
      remote: {
        revision: document.revision,
        content: document.content,
        contentJson: document.contentJson,
        updatedAt: document.updatedAt,
      },
      local: {
        content: localContent,
        contentJson: localContentJson,
      },
      conflicts: hasConflicts
        ? [
            {
              type: 'revision_mismatch',
              baseRevision: baseRevNum,
              serverRevision: serverRevNum,
              message: `Document has evolved on server from r${baseRevNum} to r${serverRevNum}. Three-way merge resolution required.`,
            },
          ]
        : [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/merge/commit', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'edit');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Edit permission required for merge commit', reason: perm.reason });
    }

    const {
      reconciledRevision,
      content,
      contentJson,
      title,
      comments,
      styles,
      references,
      documentParts,
    } = req.body || {};

    const updated = await updateDocument(
      req.params.id,
      {
        title: typeof title === 'string' ? title : document.title,
        content: typeof content === 'string' ? content : document.content,
        contentJson: contentJson !== undefined ? contentJson : document.contentJson,
        comments: Array.isArray(comments) ? comments : undefined,
        styles: Array.isArray(styles) ? styles : undefined,
        references: references && typeof references === 'object' ? references : undefined,
        documentParts: Array.isArray(documentParts) ? documentParts : undefined,
      },
      { createVersion: true }
    );

    broadcast(
      req.params.id,
      'change',
      {
        sessionId: req.body.sessionId || 'merge-commit',
        user,
        payload: updated,
        revision: updated.revision,
        merge: {
          reconciledRevision,
        },
      },
      { excludeSessionId: req.body.sessionId }
    );

    res.json({
      ok: true,
      document: updated,
      revision: updated.revision,
      reconciledRevision,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Revision Snapshot Endpoint ─────────────────────────────────
router.get('/:id/revisions/:revision', async (req, res) => {
  try {
    const user = requestUser(req);
    const snapshot = await getRevisions(req.params.id, req.params.revision, user);
    if (!snapshot) return res.status(404).json({ message: 'Revision snapshot not found' });
    res.json({ ok: true, revision: req.params.revision, snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ── Version History Endpoints ──────────────────────────────────
router.get('/:id/versions', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'read');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Access denied', reason: perm.reason });
    }

    const versions = await listVersions(req.params.id);
    res.json({ versions: versions || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/versions/:vid/restore', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'edit');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Edit permission required to restore version', reason: perm.reason });
    }

    const restored = await restoreVersion(req.params.id, req.params.vid);
    if (!restored) return res.status(404).json({ message: 'Version not found' });
    res.json(restored);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Sharing Handler ────────────────────────────────────────────
async function handleShareDocument(req, res) {
  const shareRequestId = `share-${Date.now()}`;
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const perm = checkPermission(document, user, 'share');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Share permission denied', reason: perm.reason });
    }

    const shareResult = await shareDocument(req.params.id, req.body || {});
    if (!shareResult) {
      return res.status(404).json({ message: 'Failed to update share settings' });
    }

    const { share, document: updatedDocument } = shareResult;
    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareUrl = `${origin.replace(/\/$/, '')}/shared/${req.params.id}`;

    res.json({
      share,
      shareUrl,
      sharedWith: Array.isArray(updatedDocument?.sharedWith) ? updatedDocument.sharedWith : [],
      inviteEmailSent: false,
      inviteEmailQueued: false,
      inviteEmailError: null,
    });
  } catch (mainError) {
    res.status(500).json({
      message: 'Error processing share request',
      error: mainError?.message || 'Unknown error',
      requestId: shareRequestId,
    });
  }
}

router.post('/:id/share', handleShareDocument);
router.post('/:id/invite', handleShareDocument);

// ── Collaboration SSE Stream ───────────────────────────────────
router.get('/:id/collaboration/stream', async (req, res) => {
  try {
    const docId = req.params.id;
    const user = requestUser(req);
    const document = await getDocument(docId, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'read');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Access denied to stream', reason: perm.reason });
    }

    const session = {
      sessionId: req.query.sessionId || `session-${Date.now()}`,
      role: perm.role || 'viewer',
      user,
    };

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write(': connected\n\n');

    registerClient(docId, session, res);
    writeEvent(res, 'ready', {
      sessionId: session.sessionId,
      role: session.role,
      collaborators: listCollaborators(docId),
    });
    writeEvent(res, 'snapshot', {
      document,
      collaborators: listCollaborators(docId),
    });

    broadcastPresence(docId);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unregisterClient(docId, session.sessionId);
      res.end();
    });
  } catch (err) {
    console.error('collab stream error:', err.message);
    res.end();
  }
});

// ── Collaboration Publish ──────────────────────────────────────
router.post('/:id/collaboration/publish', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const { type, payload = {}, sessionId } = req.body || {};
    if (!type || !sessionId) {
      return res.status(400).json({ message: 'type and sessionId are required' });
    }

    if (type === 'presence') {
      updatePresence(req.params.id, sessionId, {
        cursor: payload.cursor ?? null,
        status: payload.status || 'active',
      });
      broadcastPresence(req.params.id);
      return res.json({ ok: true });
    }

    if (type === 'leave') {
      unregisterClient(req.params.id, sessionId);
      return res.json({ ok: true });
    }

    if (type === 'change') {
      const editPerm = checkPermission(document, user, 'edit');
      if (!editPerm.allowed) {
        return res.status(403).json({ message: 'Edit permission denied', reason: editPerm.reason });
      }

      const baseRevision = Number(payload.baseRevision);
      if (Number.isFinite(baseRevision) && baseRevision !== Number(document.revision || 0)) {
        return res.status(409).json({
          message: 'Revision conflict',
          document,
          expectedRevision: document.revision || 0,
        });
      }

      const nextDocument = await updateDocument(
        req.params.id,
        {
          title: payload.title,
          content: payload.content,
          contentJson: payload.contentJson,
          comments: Array.isArray(payload.comments) ? payload.comments : undefined,
          trackChanges: typeof payload.trackChanges === 'boolean' ? payload.trackChanges : undefined,
          styles: Array.isArray(payload.styles) ? payload.styles : undefined,
          references: payload.references && typeof payload.references === 'object' ? payload.references : undefined,
        },
        { createVersion: false }
      );

      broadcast(req.params.id, 'change', {
        sessionId,
        user,
        payload: nextDocument,
        revision: nextDocument?.revision || 0,
      }, { excludeSessionId: sessionId });

      return res.json({ ok: true, document: nextDocument, revision: nextDocument?.revision || 0 });
    }

    if (type === 'comment') {
      const commentPerm = checkPermission(document, user, 'comment');
      if (!commentPerm.allowed) {
        return res.status(403).json({ message: 'Comment permission denied', reason: commentPerm.reason });
      }

      const baseRevision = Number(payload.baseRevision);
      if (Number.isFinite(baseRevision) && baseRevision !== Number(document.revision || 0)) {
        return res.status(409).json({
          message: 'Revision conflict',
          document,
          expectedRevision: document.revision || 0,
        });
      }

      const updatedComments = Array.isArray(payload.comments) ? payload.comments : document.comments;
      const nextDocument = await updateDocument(
        req.params.id,
        { comments: updatedComments },
        { createVersion: false }
      );

      // Dispatch mention notifications if any
      await dispatchCommentNotifications(nextDocument, updatedComments, user);

      broadcast(req.params.id, 'comment', {
        sessionId,
        user,
        payload: {
          comments: nextDocument.comments,
          updatedAt: nextDocument.updatedAt,
          revision: nextDocument.revision || 0,
        },
      }, { excludeSessionId: sessionId });

      return res.json({ ok: true, document: nextDocument, revision: nextDocument?.revision || 0 });
    }

    broadcast(req.params.id, type, { sessionId, user, payload }, { excludeSessionId: sessionId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── IPFS Operations ────────────────────────────────────────────
router.post('/:id/pin', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const pinResult = await ipfsService.pinDocument({
      id: document.id,
      title: document.title,
      content: document.content,
      author: user?.name || 'Anonymous',
      createdAt: document.createdAt,
    });

    await updateDocument(req.params.id, {
      ipfsHash: pinResult.ipfsHash,
      ipfsGatewayUrl: pinResult.gatewayUrl,
      ipfsPinnedAt: pinResult.timestamp,
    });

    res.json({
      ok: true,
      ipfsHash: pinResult.ipfsHash,
      gatewayUrl: pinResult.gatewayUrl,
      gatewayDirectUrl: `${pinResult.gatewayUrl}?download=true`,
      timestamp: pinResult.timestamp,
      size: pinResult.size,
      message: `Document pinned to IPFS: ${pinResult.ipfsHash}`,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'Failed to pin document to IPFS',
      error: error?.message || 'Unknown error',
    });
  }
});

router.post('/:id/unpin', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (!document.ipfsHash) {
      return res.status(400).json({ message: 'Document is not pinned to IPFS' });
    }

    const success = await ipfsService.unpinDocument(document.ipfsHash);
    if (success) {
      await updateDocument(req.params.id, {
        ipfsHash: null,
        ipfsGatewayUrl: null,
        ipfsPinnedAt: null,
      });

      res.json({
        ok: true,
        message: `Document unpinned from IPFS: ${document.ipfsHash}`,
      });
    } else {
      res.status(500).json({
        ok: false,
        message: 'Failed to unpin document',
      });
    }
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'Failed to unpin document from IPFS',
      error: error?.message || 'Unknown error',
    });
  }
});

router.get('/:id/ipfs-info', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (!document.ipfsHash) {
      return res.status(404).json({
        message: 'Document is not pinned to IPFS',
        ipfsEnabled: process.env.IPFS_ENABLED === 'true',
      });
    }

    res.json({
      ok: true,
      ipfsHash: document.ipfsHash,
      gatewayUrl: document.ipfsGatewayUrl,
      gatewayDirectUrl: `${document.ipfsGatewayUrl}?download=true`,
      pinnedAt: document.ipfsPinnedAt,
      isValid: ipfsService.isValidIPFSHash(document.ipfsHash),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Document CRUD: GET /:id, PUT /:id, DELETE /:id ─────────────
router.get('/:id', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'read');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Access denied', reason: perm.reason });
    }

    res.json({
      ...document,
      effectiveRole: perm.role,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'edit');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Edit permission denied', reason: perm.reason });
    }

    const updated = await updateDocument(req.params.id, req.body || {}, { createVersion: true });
    if (!updated) return res.status(404).json({ message: 'Document not found' });

    if (Array.isArray(req.body?.comments)) {
      await dispatchCommentNotifications(updated, req.body.comments, user);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = requestUser(req);
    const document = await getDocument(req.params.id, user);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const perm = checkPermission(document, user, 'delete');
    if (!perm.allowed) {
      return res.status(403).json({ message: 'Delete permission denied', reason: perm.reason });
    }

    const removed = await deleteDocument(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Document not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
