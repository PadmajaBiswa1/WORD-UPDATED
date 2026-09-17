// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Backend Subscription Gate Middleware
// ═══════════════════════════════════════════════════════════════
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { getTier, TIER_ORDER } = require('../config/subscriptionTiers');
const { extractUserFromRequest } = require('./auth');
const User = require('../models/User');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function isMongoConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
}

function readUsersStore() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

/**
 * Resolves the live user record and subscription plan.
 */
async function resolveUserPlan(reqUser) {
  if (!reqUser || reqUser.isGuest) return 'free';

  const userId = reqUser.id || reqUser._id;
  const userEmail = reqUser.email ? reqUser.email.toLowerCase() : '';

  if (isMongoConnected() && userId && mongoose.Types.ObjectId.isValid(userId)) {
    try {
      const user = await User.findById(userId).select('plan subscriptionExpiresAt');
      if (user && user.plan) return user.plan;
    } catch {
      // ignore
    }
  }

  // Check JSON store
  const localUsers = readUsersStore();
  const found = localUsers.find((u) => (u._id === userId || u.id === userId || (userEmail && u.email?.toLowerCase() === userEmail)));
  if (found && found.plan) return found.plan;

  // Fallback to token payload or default
  return reqUser.plan || 'free';
}

/**
 * Middleware: Requires a specific feature flag on the user's active subscription tier.
 */
function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const reqUser = extractUserFromRequest(req);
      const plan = await resolveUserPlan(reqUser);
      const tier = getTier(plan);

      if (!tier.features || !tier.features[featureKey]) {
        const requiredTier = featureKey === 'aiWritingTools' ? 'pro' : 'basic';
        return res.status(403).json({
          error: 'UPGRADE_REQUIRED',
          upgradeRequired: true,
          code: 'FEATURE_GATED',
          feature: featureKey,
          currentPlan: plan,
          requiredTier,
          message: `Access to ${featureKey} requires an active ${requiredTier.toUpperCase()} subscription.`,
        });
      }

      req.userPlan = plan;
      req.userTier = tier;
      next();
    } catch (err) {
      console.error('Subscription gate error:', err.message);
      next();
    }
  };
}

/**
 * Middleware: Requires a minimum plan level ('basic' or 'pro').
 */
function requirePlan(minPlan = 'basic') {
  return async (req, res, next) => {
    try {
      const reqUser = extractUserFromRequest(req);
      const plan = await resolveUserPlan(reqUser);

      const userPlanIndex = TIER_ORDER.indexOf(plan);
      const minPlanIndex = TIER_ORDER.indexOf(minPlan);

      if (userPlanIndex < minPlanIndex) {
        return res.status(403).json({
          error: 'UPGRADE_REQUIRED',
          upgradeRequired: true,
          code: 'TIER_GATED',
          currentPlan: plan,
          requiredTier: minPlan,
          message: `This action requires an active ${minPlan.toUpperCase()} subscription.`,
        });
      }

      req.userPlan = plan;
      req.userTier = getTier(plan);
      next();
    } catch (err) {
      console.error('requirePlan error:', err.message);
      next();
    }
  };
}

module.exports = {
  resolveUserPlan,
  requireFeature,
  requirePlan,
};
