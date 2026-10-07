const rooms = new Map();

function getRoom(docId) {
  if (!rooms.has(docId)) {
    rooms.set(docId, { clients: new Map(), collaborators: new Map() });
  }
  return rooms.get(docId);
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function listCollaborators(docId) {
  return Array.from(getRoom(docId).collaborators.values());
}

function registerClient(docId, session, res) {
  const room = getRoom(docId);
  const collaborator = {
    sessionId: session.sessionId,
    id: session.user.id,
    name: session.user.name,
    email: session.user.email || '',
    role: session.role || 'editor',
    status: 'active',
    cursor: null,
    joinedAt: new Date().toISOString(),
  };

  room.clients.set(session.sessionId, res);
  room.collaborators.set(session.sessionId, collaborator);
}

function updatePresence(docId, sessionId, patch = {}) {
  const room = getRoom(docId);
  const current = room.collaborators.get(sessionId);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    status: patch.status || 'active',
  };
  room.collaborators.set(sessionId, next);
  return next;
}

function broadcast(docId, event, payload, options = {}) {
  const room = getRoom(docId);
  room.clients.forEach((client, sessionId) => {
    if (options.excludeSessionId && sessionId === options.excludeSessionId) return;
    writeEvent(client, event, payload);
  });
}

function broadcastPresence(docId) {
  broadcast(docId, 'presence', {
    collaborators: listCollaborators(docId),
    updatedAt: new Date().toISOString(),
  });
}

function unregisterClient(docId, sessionId) {
  const room = getRoom(docId);
  room.clients.delete(sessionId);
  room.collaborators.delete(sessionId);

  if (!room.clients.size) {
    rooms.delete(docId);
    return;
  }

  broadcastPresence(docId);
}

const lastEditSessions = new Map();

function getLastEditSession(docId) {
  return lastEditSessions.get(docId) || null;
}

function setLastEditSession(docId, sessionId) {
  if (sessionId) {
    lastEditSessions.set(docId, sessionId);
  }
}

module.exports = {
  broadcast,
  broadcastPresence,
  listCollaborators,
  registerClient,
  unregisterClient,
  updatePresence,
  writeEvent,
  getLastEditSession,
  setLastEditSession,
};
