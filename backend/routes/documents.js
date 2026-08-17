const router = require('express').Router();
const {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  listVersions,
  restoreVersion,
  sanitizeUser,
  shareDocument,
  updateDocument,
} = require('../lib/documentStore');
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

function requestUser(req) {
  return sanitizeUser({
    id: req.get('X-EtherX-User-Id') || req.body?.user?.id || req.query?.id || req.query?.sessionId,
    name: req.get('X-EtherX-User-Name') || req.body?.user?.name || req.query?.name,
    email: req.get('X-EtherX-User-Email') || req.body?.user?.email || req.query?.email,
  });
}

router.get('/', (_req, res) => {
  res.json({ documents: listDocuments(requestUser(_req)) });
});

router.post('/', (req, res) => {
  const document = createDocument(req.body || {}, requestUser(req));
  res.status(201).json(document);
});

router.get('/:id', (req, res) => {
  const document = getDocument(req.params.id, requestUser(req));
  if (!document) return res.status(404).json({ message: 'Document not found' });
  res.json(document);
});

router.put('/:id', (req, res) => {
  const document = updateDocument(req.params.id, req.body || {}, { createVersion: true });
  if (!document) return res.status(404).json({ message: 'Document not found' });
  res.json(document);
});

router.delete('/:id', (req, res) => {
  const removed = deleteDocument(req.params.id);
  if (!removed) return res.status(404).json({ message: 'Document not found' });
  res.json({ ok: true });
});

router.get('/:id/versions', (req, res) => {
  const versions = listVersions(req.params.id);
  if (!versions) return res.status(404).json({ message: 'Document not found' });
  res.json({ versions });
});

router.post('/:id/versions/:vid/restore', (req, res) => {
  const document = restoreVersion(req.params.id, req.params.vid);
  if (!document) return res.status(404).json({ message: 'Version not found' });
  res.json(document);
});

// Test email endpoint - verify SMTP is working (MUST come before /:id routes)
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

// IPFS — Test connection and status (MUST come before /:id routes)
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

async function handleShareDocument(req, res) {
  let shareRequestId = `share-${Date.now()}`;
  
  try {
    console.log(`[${shareRequestId}] 📤 Share request received for document: ${req.params.id}`);
    
    const document = getDocument(req.params.id, requestUser(req));
    if (!document) {
      console.log(`[${shareRequestId}] ❌ Document not found`);
      return res.status(404).json({ message: 'Document not found' });
    }
    console.log(`[${shareRequestId}] ✓ Document found`);

    const shareResult = shareDocument(req.params.id, req.body || {});
    if (!shareResult) {
      console.log(`[${shareRequestId}] ❌ Share document function failed`);
      return res.status(404).json({ message: 'Document not found' });
    }
    console.log(`[${shareRequestId}] ✓ Document marked as shared`);

    const { share, document: updatedDocument } = shareResult;
    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareUrl = `${origin.replace(/\/$/, '')}/shared/${req.params.id}`;
    
    // Capture inviter info BEFORE async task
    const inviter = requestUser(req);

    // Build response immediately
    const response = {
      share,
      shareUrl,
      sharedWith: Array.isArray(updatedDocument?.sharedWith) ? updatedDocument.sharedWith : [],
      inviteEmailSent: false,
      inviteEmailQueued: false,
      inviteEmailError: null,
    };

    // Send response immediately - don't wait for email
    console.log(`[${shareRequestId}] ✓ Sending response with status 200`);
    res.json(response);
    console.log(`[${shareRequestId}] ✅ Response sent to client`);

  } catch (mainError) {
    try {
      const errorMsg = mainError?.message || 'Unknown error';
      const errorStack = mainError?.stack || '';
      console.error(`[${shareRequestId}] ❌ UNEXPECTED ERROR in share route: ${errorMsg}`);
      console.error(`[${shareRequestId}] ❌ Stack: ${typeof errorStack === 'string' ? errorStack.substring(0, 500) : 'unknown'}`);
    } catch (logError) {
      console.error(`[${shareRequestId}] ❌ Error in share route (logging failed)`);
    }
    
    try {
      // Send error response
      res.status(500).json({
        message: 'Error processing share request',
        error: mainError?.message || 'Unknown error',
        requestId: shareRequestId
      });
    } catch (responseError) {
      console.error(`[${shareRequestId}] ❌ Failed to send error response:`, responseError?.message);
      // If response sending fails, try a minimal response
      try {
        res.status(500).json({ error: 'Internal server error' });
      } catch (finalError) {
        // Last resort - if all else fails, just close the connection
        res.end('Internal server error');
      }
    }
  }
}

// Share and invite routes (must come after /test/* routes)
router.post('/:id/share', handleShareDocument);
router.post('/:id/invite', handleShareDocument);

router.get('/:id/collaboration/stream', (req, res) => {
  const docId = req.params.id;
  const document = getDocument(docId, requestUser(req));
  if (!document) return res.status(404).json({ message: 'Document not found' });

  const session = {
    sessionId: req.query.sessionId || `session-${Date.now()}`,
    role: req.query.role || 'editor',
    user: requestUser(req),
  };

  console.log('[COLLAB STREAM] 🔗 New stream connection');
  console.log('[COLLAB STREAM]   Document:', docId);
  console.log('[COLLAB STREAM]   User:', session.user.name, session.user.email);
  console.log('[COLLAB STREAM]   SessionId:', session.sessionId);

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
    collaborators: listCollaborators(docId),
  });
  writeEvent(res, 'snapshot', {
    document,
    collaborators: listCollaborators(docId),
  });
  
  console.log('[COLLAB STREAM] ✅ Ready and snapshot sent. Collaborators:', listCollaborators(docId).length);
  
  broadcastPresence(docId);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    console.log('[COLLAB STREAM] 🔌 Connection closed for:', session.sessionId);
    clearInterval(heartbeat);
    unregisterClient(docId, session.sessionId);
    res.end();
  });
});

router.post('/:id/collaboration/publish', (req, res) => {
  const user = requestUser(req);
  const document = getDocument(req.params.id, user);
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
    const baseRevision = Number(payload.baseRevision);
    if (Number.isFinite(baseRevision) && baseRevision !== Number(document.revision || 0)) {
      return res.status(409).json({
        message: 'Revision conflict',
        document,
        expectedRevision: document.revision || 0,
      });
    }

    const nextDocument = updateDocument(
      req.params.id,
      {
        title: payload.title,
        content: payload.content,
        comments: Array.isArray(payload.comments) ? payload.comments : undefined,
        trackChanges: typeof payload.trackChanges === 'boolean' ? payload.trackChanges : undefined,
      },
      { createVersion: false },
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
    const baseRevision = Number(payload.baseRevision);
    if (Number.isFinite(baseRevision) && baseRevision !== Number(document.revision || 0)) {
      return res.status(409).json({
        message: 'Revision conflict',
        document,
        expectedRevision: document.revision || 0,
      });
    }

    const nextDocument = updateDocument(
      req.params.id,
      {
        comments: Array.isArray(payload.comments) ? payload.comments : document.comments,
      },
      { createVersion: false },
    );

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
});



// IPFS — Pin document to IPFS via Pinata
router.post('/:id/pin', async (req, res) => {
  const document = getDocument(req.params.id);
  if (!document) return res.status(404).json({ message: 'Document not found' });

  try {
    const user = requestUser(req);
    const pinResult = await ipfsService.pinDocument({
      id: document.id,
      title: document.title,
      content: document.content,
      author: user?.name || 'Anonymous',
      createdAt: document.createdAt,
    });

    // Store IPFS hash in document metadata
    const updated = updateDocument(req.params.id, {
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

// IPFS — Unpin document from IPFS
router.post('/:id/unpin', async (req, res) => {
  const document = getDocument(req.params.id);
  if (!document) return res.status(404).json({ message: 'Document not found' });

  if (!document.ipfsHash) {
    return res.status(400).json({ message: 'Document is not pinned to IPFS' });
  }

  try {
    const success = await ipfsService.unpinDocument(document.ipfsHash);

    if (success) {
      // Remove IPFS metadata from document
      updateDocument(req.params.id, {
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

// IPFS — Get document IPFS info
router.get('/:id/ipfs-info', async (req, res) => {
  const document = getDocument(req.params.id);
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
});



module.exports = router;
