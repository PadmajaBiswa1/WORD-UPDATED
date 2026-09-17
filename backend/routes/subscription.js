// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Subscription & Razorpay API Routes
// ═══════════════════════════════════════════════════════════════
const router = require('express').Router();
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { SUBSCRIPTION_TIERS, getTier, TIER_ORDER } = require('../config/subscriptionTiers');
const { extractUserFromRequest } = require('../middleware/auth');
const { listDocuments } = require('../lib/documentStore');
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

function writeUsersStore(users) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.warn('writeUsersStore error:', err.message);
  }
}

function signToken(user) {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || 'free',
      billingCycle: user.billingCycle || 'monthly',
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function formatUser(user) {
  if (!user) return null;
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    plan: user.plan || 'free',
    billingCycle: user.billingCycle || 'monthly',
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
  };
}

async function findUserById(userId, userEmail) {
  if (isMongoConnected() && userId && mongoose.Types.ObjectId.isValid(userId)) {
    try {
      const user = await User.findById(userId);
      if (user) return user;
    } catch {}
  }
  if (isMongoConnected() && userEmail) {
    try {
      const user = await User.findOne({ email: userEmail.toLowerCase() });
      if (user) return user;
    } catch {}
  }

  const users = readUsersStore();
  return users.find((u) => u._id === userId || u.id === userId || (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()));
}

async function updateUserSubscription(userId, userEmail, updates = {}) {
  if (isMongoConnected()) {
    let mongoUser = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      mongoUser = await User.findById(userId);
    }
    if (!mongoUser && userEmail) {
      mongoUser = await User.findOne({ email: userEmail.toLowerCase() });
    }
    if (mongoUser) {
      Object.assign(mongoUser, updates);
      await mongoUser.save();
      return mongoUser;
    }
  }

  const users = readUsersStore();
  const index = users.findIndex((u) => u._id === userId || u.id === userId || (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()));
  if (index >= 0) {
    users[index] = { ...users[index], ...updates };
    writeUsersStore(users);
    return users[index];
  } else if (userId || userEmail) {
    const newUser = {
      _id: userId || `user_${Date.now()}`,
      id: userId || `user_${Date.now()}`,
      email: userEmail || 'user@etherx.com',
      name: 'User',
      ...updates,
    };
    users.push(newUser);
    writeUsersStore(users);
    return newUser;
  }

  return null;
}

// ── GET /api/subscription/plans ──────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({
    tiers: SUBSCRIPTION_TIERS,
    plans: SUBSCRIPTION_TIERS,
    tierOrder: TIER_ORDER,
    currency: 'INR',
    currencySymbol: '₹',
  });
});

// ── GET /api/subscription/me ─────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const reqUser = extractUserFromRequest(req);
    const user = await findUserById(reqUser.id, reqUser.email);
    const plan = user?.plan || reqUser.plan || 'free';
    const tier = getTier(plan);

    // Compute document count and estimated storage
    const allDocs = await listDocuments(reqUser);
    const ownedDocs = (allDocs || []).filter((d) => {
      const ownerId = d.owner?.id || d.owner?._id || d.owner?.email;
      const myId = reqUser.id || reqUser.email;
      return ownerId === myId;
    });

    const docCount = ownedDocs.length;
    let storageBytes = 0;
    for (const doc of ownedDocs) {
      const contentStr = typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.contentJson || '');
      storageBytes += Buffer.byteLength(contentStr, 'utf8') + 2048; // content + metadata estimate
    }

    const maxDocs = tier.limits.maxDocuments;
    const maxStorage = tier.limits.storageBytes;

    res.json({
      user: formatUser(user || reqUser),
      plan,
      tier,
      billingCycle: user?.billingCycle || 'monthly',
      subscriptionExpiresAt: user?.subscriptionExpiresAt || null,
      usage: {
        docCount,
        maxDocuments: maxDocs,
        storageBytes,
        maxStorageBytes: maxStorage,
        storageDisplay: tier.limits.storageDisplay,
        isDocLimitReached: Number.isFinite(maxDocs) && docCount >= maxDocs,
        isStorageLimitReached: Number.isFinite(maxStorage) && storageBytes >= maxStorage,
      },
    });
  } catch (err) {
    console.error('Subscription /me error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/subscription/create-order ──────────────────────
router.post('/create-order', async (req, res) => {
  try {
    const reqUser = extractUserFromRequest(req);
    const { tierId = 'pro', billingCycle = 'monthly' } = req.body || {};

    const tier = SUBSCRIPTION_TIERS[tierId.toLowerCase()];
    if (!tier || tier.id === 'free') {
      return res.status(400).json({ message: 'Invalid subscription tier for purchase' });
    }

    const price = billingCycle === 'yearly' ? tier.price.yearly : tier.price.monthly;
    const amountInPaise = Math.round(price * 100);

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    // Live Razorpay API order creation
    if (razorpayKeyId && razorpayKeySecret) {
      try {
        const authHeader = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
        const rzpResponse = await axios.post(
          'https://api.razorpay.com/v1/orders',
          {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_${Date.now()}_${tierId.slice(0, 3)}`,
            notes: {
              tierId,
              billingCycle,
              userId: reqUser.id,
              userEmail: reqUser.email,
            },
          },
          {
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return res.json({
          orderId: rzpResponse.data.id,
          amount: amountInPaise,
          currency: 'INR',
          keyId: razorpayKeyId,
          tierId,
          billingCycle,
          tierName: tier.name,
          isSandbox: false,
        });
      } catch (rzpErr) {
        console.warn('Razorpay API error, falling back to sandbox mode:', rzpErr.response?.data || rzpErr.message);
      }
    }

    // Sandbox / Local fallback order
    const mockOrderId = `order_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return res.json({
      orderId: mockOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: razorpayKeyId || 'rzp_test_mock_etherx',
      tierId,
      billingCycle,
      tierName: tier.name,
      isSandbox: true,
      notice: 'Running in sandbox mode. Set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in backend/.env for production.',
    });
  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/subscription/verify-payment ────────────────────
router.post('/verify-payment', async (req, res) => {
  try {
    const reqUser = extractUserFromRequest(req);
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      tierId = 'pro',
      billingCycle = 'monthly',
    } = req.body || {};

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    // If live keys, verify HMAC-SHA256
    if (razorpayKeySecret && !String(razorpay_order_id).startsWith('order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature' });
      }
    }

    // Calculate expiry
    const durationDays = billingCycle === 'yearly' ? 365 : 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000);

    const updatedUser = await updateUserSubscription(reqUser.id, reqUser.email, {
      plan: tierId.toLowerCase(),
      billingCycle,
      subscriptionExpiresAt: expiresAt,
      razorpayPaymentId: razorpay_payment_id || `mock_pay_${Date.now()}`,
      razorpaySubscriptionId: razorpay_order_id || null,
    });

    const finalUser = updatedUser || { ...reqUser, plan: tierId, billingCycle, subscriptionExpiresAt: expiresAt };
    const token = signToken(finalUser);

    res.json({
      success: true,
      message: `Congratulations! Your subscription has been upgraded to ${tierId.toUpperCase()}.`,
      token,
      plan: finalUser.plan,
      billingCycle: finalUser.billingCycle,
      user: formatUser(finalUser),
      tier: getTier(tierId),
    });
  } catch (err) {
    console.error('verify-payment error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/subscription/switch-tier ───────────────────────
// Quick dev/demo switch endpoint
router.post('/switch-tier', async (req, res) => {
  try {
    const reqUser = extractUserFromRequest(req);
    const { tierId = 'free', billingCycle = 'monthly' } = req.body || {};

    const validTier = getTier(tierId);
    const durationDays = billingCycle === 'yearly' ? 365 : 30;
    const expiresAt = validTier.id === 'free' ? null : new Date(Date.now() + durationDays * 24 * 3600 * 1000);

    const updatedUser = await updateUserSubscription(reqUser.id, reqUser.email, {
      plan: validTier.id,
      billingCycle,
      subscriptionExpiresAt: expiresAt,
    });

    const finalUser = updatedUser || { ...reqUser, plan: validTier.id, billingCycle, subscriptionExpiresAt: expiresAt };
    const token = signToken(finalUser);

    res.json({
      success: true,
      message: `Switched plan to ${validTier.name}`,
      token,
      plan: finalUser.plan,
      billingCycle: finalUser.billingCycle,
      user: formatUser(finalUser),
      tier: validTier,
    });
  } catch (err) {
    console.error('switch-tier error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
