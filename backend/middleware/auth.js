const jwt = require('jsonwebtoken');

/**
 * Extracts a JWT token from Authorization header or cookie session.
 * Replaces spoofable header/query parameters.
 */
function extractToken(req) {
  if (!req) return null;

  // 1. Authorization: Bearer <token>
  const header = req.headers?.authorization;
  if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
    const candidate = header.slice(7).trim();
    if (candidate) return candidate;
  }

  // 2. Query param for EventSource/SSE (browser EventSource cannot set custom headers)
  if (req.query?.token && typeof req.query.token === 'string') {
    const candidate = req.query.token.trim();
    if (candidate) return candidate;
  }

  // 3. Verified cookie session (cookie: token=...; etherx_token=...; session=...)
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const parts = cookie.trim().split('=');
      const name = parts[0];
      const val = parts.slice(1).join('=');
      if (['etherx_token', 'token', 'jwt', 'session'].includes(name.toLowerCase())) {
        const decoded = decodeURIComponent(val || '').trim();
        if (decoded) return decoded;
      }
    }
  }

  return null;
}

/**
 * Verifies JWT token and returns user payload or null if invalid/missing.
 */
function verifyTokenFromRequest(req) {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.warn('⚠️ JWT_SECRET not configured');
      return null;
    }
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts verified user identity.
 * If token is missing/invalid, returns a guest representation without trusting spoofable headers.
 */
function extractUserFromRequest(req) {
  const verified = verifyTokenFromRequest(req);
  if (verified && (verified.id || verified._id || verified.email)) {
    return {
      id: String(verified.id || verified._id || '').trim(),
      email: String(verified.email || '').trim().toLowerCase(),
      name: String(verified.name || verified.email || 'Authenticated User').trim(),
      isGuest: false,
      isAuthenticated: true,
    };
  }

  // Fallback: guest user with request headers / query info if available
  const guestId = req.headers?.['x-etherx-user-id'] || req.headers?.['x-user-id'] || req.query?.id || 'guest-user';
  const guestName = req.headers?.['x-etherx-user-name'] || req.headers?.['x-user-name'] || req.query?.name || 'Guest User';
  const guestEmail = req.headers?.['x-etherx-user-email'] || req.headers?.['x-user-email'] || req.query?.email || '';

  return {
    id: String(guestId).trim(),
    name: String(guestName).trim(),
    email: String(guestEmail).trim().toLowerCase(),
    isGuest: true,
    isAuthenticated: false,
  };
}

/**
 * Middleware: Strictly requires valid verified JWT token.
 */
function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    req.isAuthenticated = true;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Middleware: Optional authentication. Sets req.user if valid token, otherwise sets guest.
 */
function optionalAuth(req, res, next) {
  const user = extractUserFromRequest(req);
  req.user = user;
  req.isAuthenticated = Boolean(user.isAuthenticated);
  next();
}

authMiddleware.extractToken = extractToken;
authMiddleware.verifyTokenFromRequest = verifyTokenFromRequest;
authMiddleware.extractUserFromRequest = extractUserFromRequest;
authMiddleware.optionalAuth = optionalAuth;

module.exports = authMiddleware;
