const jwt = require('jsonwebtoken');
const authMiddleware = require('./auth');
const adminDataService = require('../services/adminDataService');

/**
 * Resolves the authenticated user from the request and fetches their live record from the database/store.
 * Never trusts client headers or unverified payloads.
 */
function resolveLiveAdminUser(req) {
  const token = authMiddleware.extractToken(req);
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
    const decoded = jwt.verify(token, secret);
    if (!decoded || (!decoded.id && !decoded.email)) return null;

    const email = String(decoded.email || '').toLowerCase();
    const id = decoded.id || decoded._id;

    // Check organization member store first for live role and status
    const member = adminDataService.getMember(id) || adminDataService.getMember(email);
    if (member) {
      return {
        id: member.userId || member.id,
        memberId: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
        department: member.department,
        organizationId: 'org_etherx_pro',
      };
    }

    // Default Owner fallback for primary seeded accounts
    if (email === 'biswalpadmaja411@gmail.com' || email === 'demo@etherx.com') {
      return {
        id: id || 'user_owner',
        memberId: email === 'demo@etherx.com' ? 'mem_demo' : 'mem_padmaja',
        email,
        name: decoded.name || 'Owner',
        role: 'Owner',
        status: 'active',
        department: 'Executive',
        organizationId: 'org_etherx_pro',
      };
    }

    // Fallback to decoded token role
    return {
      id,
      email,
      name: decoded.name || 'User',
      role: decoded.role || 'Viewer',
      status: decoded.status || 'active',
      department: decoded.department || 'General',
      organizationId: decoded.organizationId || 'org_etherx_pro',
    };
  } catch {
    return null;
  }
}

/**
 * Middleware: Strictly requires that the caller is authenticated and has either 'Owner' or 'Admin' role.
 */
function requireAdmin(req, res, next) {
  const liveUser = resolveLiveAdminUser(req);
  if (!liveUser) {
    return res.status(401).json({ message: 'Authentication required to access admin services', code: 'UNAUTHORIZED' });
  }

  if (liveUser.status === 'deactivated') {
    return res.status(403).json({
      message: 'Account is deactivated. Please contact an organization owner.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  if (liveUser.role !== 'Owner' && liveUser.role !== 'Admin') {
    return res.status(403).json({
      message: 'Access denied: Administrator privileges required',
      code: 'ADMIN_ACCESS_REQUIRED',
    });
  }

  req.user = liveUser;
  req.adminUser = liveUser;
  req.isOwner = liveUser.role === 'Owner';
  next();
}

/**
 * Middleware: Strictly requires that the caller is an 'Owner'.
 */
function requireOwner(req, res, next) {
  const liveUser = resolveLiveAdminUser(req);
  if (!liveUser) {
    return res.status(401).json({ message: 'Authentication required to access owner services', code: 'UNAUTHORIZED' });
  }

  if (liveUser.status === 'deactivated') {
    return res.status(403).json({
      message: 'Account is deactivated. Please contact an organization owner.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  if (liveUser.role !== 'Owner') {
    return res.status(403).json({
      message: 'Access denied: Organization Owner privileges required for this action',
      code: 'OWNER_ACCESS_REQUIRED',
    });
  }

  req.user = liveUser;
  req.adminUser = liveUser;
  req.isOwner = true;
  next();
}

module.exports = {
  resolveLiveAdminUser,
  requireAdmin,
  requireOwner,
};
