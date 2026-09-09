const router = require('express').Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { sanitizeUser } = require('../lib/documentStore');
const { extractUserFromRequest } = require('../middleware/auth');

const NOTIF_FILE = path.join(__dirname, '..', 'data', 'notifications.json');

function isMongoConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
}

function readNotifStore() {
  try {
    if (!fs.existsSync(NOTIF_FILE)) return { notifications: [] };
    const raw = fs.readFileSync(NOTIF_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [] };
  } catch (err) {
    return { notifications: [] };
  }
}

function writeNotifStore(store) {
  try {
    const dir = path.dirname(NOTIF_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('writeNotifStore error:', err.message);
  }
}

function requestUser(req) {
  if (req.user && req.user.id && req.isAuthenticated) {
    return sanitizeUser(req.user);
  }
  return sanitizeUser(extractUserFromRequest(req));
}

function makeId(prefix = 'notif') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Idempotently creates a notification (avoids duplicates for same mention event).
 */
async function createNotification(data = {}) {
  const {
    recipientId,
    recipientEmail,
    sender,
    documentId,
    documentTitle = 'Untitled Document',
    threadId,
    commentId,
    type = 'mention',
    message,
  } = data;

  if (!recipientId && !recipientEmail) return null;
  if (!documentId || !message) return null;

  if (isMongoConnected()) {
    // Deduplication check: if notification with same doc, thread, comment, recipient exists
    const existing = await Notification.findOne({
      documentId,
      ...(threadId ? { threadId } : {}),
      ...(commentId ? { commentId } : {}),
      $or: [
        ...(recipientId ? [{ recipientId }] : []),
        ...(recipientEmail ? [{ recipientEmail: recipientEmail.toLowerCase() }] : []),
      ],
    });

    if (existing) {
      return existing;
    }

    const record = await Notification.create({
      id: makeId(),
      recipientId: recipientId || recipientEmail,
      recipientEmail: recipientEmail ? recipientEmail.toLowerCase() : '',
      sender: sender || { id: '', name: 'Someone', email: '' },
      documentId,
      documentTitle,
      threadId: threadId || null,
      commentId: commentId !== undefined ? commentId : null,
      type,
      message,
      read: false,
    });

    return record;
  }

  // Fallback JSON storage
  const store = readNotifStore();
  const normalizedRecipientId = String(recipientId || recipientEmail || '').trim();
  const normalizedRecipientEmail = String(recipientEmail || '').trim().toLowerCase();

  const existing = store.notifications.find((n) => {
    const matchDoc = n.documentId === documentId;
    const matchThread = threadId ? n.threadId === threadId : true;
    const matchComment = commentId !== undefined ? n.commentId === commentId : true;
    const matchRecipient =
      (recipientId && n.recipientId === recipientId) ||
      (normalizedRecipientEmail && n.recipientEmail === normalizedRecipientEmail);
    return matchDoc && matchThread && matchComment && matchRecipient;
  });

  if (existing) return existing;

  const record = {
    id: makeId(),
    recipientId: normalizedRecipientId,
    recipientEmail: normalizedRecipientEmail,
    sender: sender || { id: '', name: 'Someone', email: '' },
    documentId,
    documentTitle,
    threadId: threadId || null,
    commentId: commentId !== undefined ? commentId : null,
    type,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };

  store.notifications.unshift(record);
  writeNotifStore(store);
  return record;
}

// ── GET /api/notifications ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user = requestUser(req);
    const userId = String(user.id || '').trim();
    const userEmail = String(user.email || '').trim().toLowerCase();

    if (!userId && !userEmail) {
      return res.json({ notifications: [] });
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    if (isMongoConnected()) {
      const query = {
        $or: [
          ...(userId ? [{ recipientId: userId }] : []),
          ...(userEmail ? [{ recipientEmail: userEmail }] : []),
          ...(userId ? [{ recipientEmail: userId }] : []),
        ],
        ...(unreadOnly ? { read: false } : {}),
      };

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

      return res.json({ notifications });
    }

    const store = readNotifStore();
    const notifications = store.notifications
      .filter((n) => {
        const matchRecipient =
          (userId && n.recipientId === userId) ||
          (userEmail && n.recipientEmail === userEmail) ||
          (userId && n.recipientEmail === userId);
        if (!matchRecipient) return false;
        if (unreadOnly && n.read) return false;
        return true;
      })
      .slice(0, limit);

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/notifications/:id/read ──────────────────────────
router.post('/:id/read', async (req, res) => {
  try {
    const user = requestUser(req);

    if (isMongoConnected()) {
      const notif = await Notification.findOne({ id: req.params.id });

      if (!notif) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      notif.read = true;
      notif.readAt = new Date().toISOString();
      await notif.save();

      return res.json({ ok: true, notification: notif });
    }

    const store = readNotifStore();
    const notif = store.notifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notif.read = true;
    notif.readAt = new Date().toISOString();
    writeNotifStore(store);

    res.json({ ok: true, notification: notif });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/notifications/mark-all-read ─────────────────────
router.post('/mark-all-read', async (req, res) => {
  try {
    const user = requestUser(req);
    const userId = String(user.id || '').trim();
    const userEmail = String(user.email || '').trim().toLowerCase();

    if (isMongoConnected()) {
      await Notification.updateMany(
        {
          $or: [
            ...(userId ? [{ recipientId: userId }] : []),
            ...(userEmail ? [{ recipientEmail: userEmail }] : []),
          ],
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date().toISOString(),
          },
        }
      );

      return res.json({ ok: true });
    }

    const store = readNotifStore();
    store.notifications.forEach((n) => {
      const matchRecipient =
        (userId && n.recipientId === userId) ||
        (userEmail && n.recipientEmail === userEmail);
      if (matchRecipient) {
        n.read = true;
        n.readAt = new Date().toISOString();
      }
    });
    writeNotifStore(store);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
