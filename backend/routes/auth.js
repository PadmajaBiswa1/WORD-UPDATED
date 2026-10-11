const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const mongoose = require('mongoose');
const User    = require('../models/User');
const OTP     = require('../models/OTP');
const { generateOTP } = require('../utils/sendEmail');
const authMiddleware = require('../middleware/auth');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const OTPS_FILE  = path.join(__dirname, '..', 'data', 'otps.json');

function isMongoConnected() {
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
}

function readUsersStore() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      const defaultUsers = [
        {
          _id: 'user_demo',
          name: 'Demo User',
          email: 'demo@etherx.com',
          passwordHash: bcrypt.hashSync('password123', 10),
          isVerified: true,
          plan: 'free',
          billingCycle: 'monthly',
          subscriptionExpiresAt: null,
          role: 'Owner',
          status: 'active',
          department: 'Engineering',
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'user_padmaja',
          name: 'Padmaja Biswal',
          email: 'biswalpadmaja411@gmail.com',
          passwordHash: bcrypt.hashSync('password123', 10),
          isVerified: true,
          plan: 'free',
          billingCycle: 'monthly',
          subscriptionExpiresAt: null,
          role: 'Owner',
          status: 'active',
          department: 'Executive',
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'user_vinay',
          name: 'Vinay',
          email: 'vinaygk219@gmail.com',
          passwordHash: bcrypt.hashSync('vinay@3374', 10),
          isVerified: true,
          plan: 'free',
          billingCycle: 'monthly',
          subscriptionExpiresAt: null,
          role: 'Admin',
          status: 'active',
          department: 'Engineering',
          createdAt: new Date().toISOString(),
        },
      ];
      writeUsersStore(defaultUsers);
      return defaultUsers;
    }
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
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

function readOtpsStore() {
  try {
    if (!fs.existsSync(OTPS_FILE)) return [];
    const raw = fs.readFileSync(OTPS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

function writeOtpsStore(otps) {
  try {
    const dir = path.dirname(OTPS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OTPS_FILE, JSON.stringify(otps, null, 2), 'utf8');
  } catch {}
}

function formatUserResponse(user) {
  if (!user) return null;
  const email = String(user.email || '').toLowerCase();
  const isSeedOwner = email === 'biswalpadmaja411@gmail.com' || email === 'demo@etherx.com';
  const role = isSeedOwner ? 'Owner' : (user.role || 'Viewer');
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    plan: user.plan || (isSeedOwner ? 'pro' : 'free'),
    billingCycle: user.billingCycle || 'monthly',
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    role,
    status: user.status || 'active',
    department: user.department || (isSeedOwner ? 'Executive' : 'General'),
    organizationId: user.organizationId || 'org_etherx_pro',
  };
}

function signToken(user) {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
  const email = String(user.email || '').toLowerCase();
  const isSeedOwner = email === 'biswalpadmaja411@gmail.com' || email === 'demo@etherx.com';
  const role = isSeedOwner ? 'Owner' : (user.role || 'Viewer');
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || (isSeedOwner ? 'pro' : 'free'),
      billingCycle: user.billingCycle || 'monthly',
      role,
      status: user.status || 'active',
      department: user.department || (isSeedOwner ? 'Executive' : 'General'),
      organizationId: user.organizationId || 'org_etherx_pro',
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/demo ───────────────────────────────────────
router.post('/demo', async (req, res) => {
  try {
    const demoUser = {
      _id: 'user_demo',
      id: 'user_demo',
      name: 'Demo User',
      email: 'demo@etherx.com',
      isVerified: true,
      plan: 'free',
      billingCycle: 'monthly',
      subscriptionExpiresAt: null,
      role: 'Owner',
      status: 'active',
      department: 'Engineering',
      organizationId: 'org_etherx_pro',
    };

    if (!isMongoConnected()) {
      const users = readUsersStore();
      const existingIndex = users.findIndex((u) => u._id === 'user_demo' || u.id === 'user_demo' || u.email === 'demo@etherx.com');
      if (existingIndex >= 0) {
        users[existingIndex].role = 'Owner';
        users[existingIndex].status = 'active';
        users[existingIndex].department = 'Engineering';
        writeUsersStore(users);
      } else {
        users.push(demoUser);
        writeUsersStore(users);
      }
    }

    const token = signToken(demoUser);
    res.json({ token, user: formatUserResponse(demoUser) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/signup ─────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const normalizedEmail = email.trim().toLowerCase();

    if (isMongoConnected()) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing && existing.isVerified)
        return res.status(409).json({ message: 'Email already registered' });

      if (existing && !existing.isVerified) {
        existing.name = name;
        existing.password = password;
        existing.markModified('password');
        await existing.save();
      } else {
        await User.create({ name, email: normalizedEmail, password });
      }

      const otp = generateOTP();
      await OTP.findOneAndUpdate(
        { email: normalizedEmail, type: 'verify' },
        { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({
        message: 'Account created. Check your email for the OTP.',
        otp,
      });
    }

    // JSON storage fallback
    const users = readUsersStore();
    const existingIndex = users.findIndex((u) => u.email === normalizedEmail);

    if (existingIndex >= 0 && users[existingIndex].isVerified) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    if (existingIndex >= 0) {
      users[existingIndex].name = name;
      users[existingIndex].passwordHash = passwordHash;
    } else {
      users.push({
        _id: `user_${Date.now().toString(36)}`,
        name,
        email: normalizedEmail,
        passwordHash,
        isVerified: true, // Auto-verify in offline mode for frictionless experience
        plan: 'free',
        billingCycle: 'monthly',
        subscriptionExpiresAt: null,
        createdAt: new Date().toISOString(),
      });
    }
    writeUsersStore(users);

    const otps = readOtpsStore().filter((o) => !(o.email === normalizedEmail && o.type === 'verify'));
    otps.push({ email: normalizedEmail, otp, type: 'verify', expiresAt: Date.now() + 10 * 60 * 1000 });
    writeOtpsStore(otps);

    res.status(201).json({
      message: 'Account created successfully!',
      otp,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (isMongoConnected()) {
      const record = await OTP.findOne({ email: normalizedEmail, type: 'verify' });

      if (!record || record.otp !== otp || record.expiresAt < new Date())
        return res.status(400).json({ message: 'Invalid or expired OTP' });

      await Promise.all([
        User.updateOne({ email: normalizedEmail }, { isVerified: true }),
        OTP.deleteMany({ email: normalizedEmail, type: 'verify' }),
      ]);

      const user  = await User.findOne({ email: normalizedEmail });
      const token = signToken(user);
      return res.json({ token, user: formatUserResponse(user) });
    }

    const otps = readOtpsStore();
    const record = otps.find((o) => o.email === normalizedEmail && o.type === 'verify' && o.otp === otp);
    if (!record || record.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const users = readUsersStore();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isVerified = true;
    writeUsersStore(users);
    writeOtpsStore(otps.filter((o) => !(o.email === normalizedEmail && o.type === 'verify')));

    const token = signToken(user);
    res.json({ token, user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/resend-otp ─────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, type = 'verify' } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (isMongoConnected()) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) return res.status(404).json({ message: 'Email not found' });

      const otp = generateOTP();
      await OTP.findOneAndUpdate(
        { email: normalizedEmail, type },
        { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.json({ message: 'OTP resent', otp });
    }

    const users = readUsersStore();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) return res.status(404).json({ message: 'Email not found' });

    const otp = generateOTP();
    const otps = readOtpsStore().filter((o) => !(o.email === normalizedEmail && o.type === type));
    otps.push({ email: normalizedEmail, otp, type, expiresAt: Date.now() + 10 * 60 * 1000 });
    writeOtpsStore(otps);

    res.json({ message: 'OTP resent', otp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/signin ─────────────────────────────────────
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const suppliedPassword = String(password || '');

    if (isMongoConnected()) {
      let user = await User.findOne({ email: normalizedEmail });

      // Seamless fallback: If user was in local seed store, migrate to Mongo
      if (!user) {
        const localUsers = readUsersStore();
        const localUser = localUsers.find((candidate) => String(candidate.email || '').toLowerCase() === normalizedEmail);
        if (localUser) {
          const passMatch = await bcrypt.compare(suppliedPassword, localUser.passwordHash || localUser.password || '');
          if (passMatch) {
            try {
              user = await User.create({
                name: localUser.name,
                email: normalizedEmail,
                password: suppliedPassword,
                isVerified: localUser.isVerified ?? true,
                role: localUser.role || 'Viewer',
                plan: localUser.plan || 'free',
                department: localUser.department || 'General',
              });
            } catch {
              user = await User.findOne({ email: normalizedEmail });
            }
          }
        }
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const isMatch = await user.comparePassword(suppliedPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          message: 'Please verify your email first',
          needsVerification: true,
        });
      }

      // Opportunistically re-hash legacy cost-12 passwords to cost-10 for 4x faster future signins
      if (user.password && user.password.startsWith('$2b$12$')) {
        bcrypt.hash(suppliedPassword, 10).then((newHash) => {
          User.updateOne({ _id: user._id }, { password: newHash }).catch(() => {});
        }).catch(() => {});
      }

      const token = signToken(user);
      return res.json({
        token,
        user: formatUserResponse(user),
      });
    }

    const users = readUsersStore();
    const user = users.find((candidate) => candidate.email === normalizedEmail);
    const passwordHash = user?.passwordHash || user?.password || '';
    if (!user || !(await bcrypt.compare(suppliedPassword, passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email first',
        needsVerification: true,
      });
    }

    const token = signToken(user);
    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (isMongoConnected()) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) return res.json({ message: 'If that email exists, an OTP has been sent.', otp: null });

      const otp = generateOTP();
      await OTP.findOneAndUpdate(
        { email: normalizedEmail, type: 'reset' },
        { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.json({ message: 'If that email exists, an OTP has been sent.', otp });
    }

    const users = readUsersStore();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) return res.json({ message: 'If that email exists, an OTP has been sent.', otp: null });

    const otp = generateOTP();
    const otps = readOtpsStore().filter((o) => !(o.email === normalizedEmail && o.type === 'reset'));
    otps.push({ email: normalizedEmail, otp, type: 'reset', expiresAt: Date.now() + 10 * 60 * 1000 });
    writeOtpsStore(otps);

    res.json({ message: 'If that email exists, an OTP has been sent.', otp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/verify-reset-otp ──────────────────────────
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';

    if (isMongoConnected()) {
      const record = await OTP.findOne({ email: normalizedEmail, type: 'reset' });

      if (!record || record.otp !== otp || record.expiresAt < new Date())
        return res.status(400).json({ message: 'Invalid or expired OTP' });

      const resetToken = jwt.sign({ email: normalizedEmail, purpose: 'reset' }, secret, { expiresIn: '15m' });
      return res.json({ resetToken });
    }

    const otps = readOtpsStore();
    const record = otps.find((o) => o.email === normalizedEmail && o.type === 'reset' && o.otp === otp);
    if (!record || record.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const resetToken = jwt.sign({ email: normalizedEmail, purpose: 'reset' }, secret, { expiresIn: '15m' });
    res.json({ resetToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
    let payload;
    try {
      payload = jwt.verify(resetToken, secret);
    } catch {
      return res.status(400).json({ message: 'Reset token invalid or expired' });
    }
    if (payload.purpose !== 'reset')
      return res.status(400).json({ message: 'Invalid token purpose' });

    if (isMongoConnected()) {
      const user = await User.findOne({ email: payload.email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.password = password;
      await Promise.all([
        user.save(),
        OTP.deleteMany({ email: payload.email, type: 'reset' }),
      ]);

      return res.json({ message: 'Password reset successfully' });
    }

    const users = readUsersStore();
    const user = users.find((u) => u.email === payload.email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.passwordHash = await bcrypt.hash(password, 10);
    writeUsersStore(users);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
// ── OAuth (Google, GitHub) ────────────────────────────────────
// Flow: GET /api/auth/:provider redirects to the provider with a random `state` that is
// also stored in an httpOnly cookie; the callback checks both match (CSRF), exchanges the
// code, signs in or creates the user by verified email, then redirects to the frontend
// with the JWT in the URL fragment so it never reaches server logs.
const OAUTH_STATE_COOKIE = 'wx_oauth_state';
const OAUTH_PROVIDERS = {
  google: {
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    async exchange(code, redirectUri) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Google token exchange failed');
      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      if (!profileRes.ok || !profile.email || profile.email_verified !== true) throw new Error('Google account has no verified email');
      return { email: profile.email, name: profile.name || profile.email.split('@')[0] };
    },
  },
  github: {
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
    async exchange(code, redirectUri) {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: this.clientId(), client_secret: this.clientSecret(), code, redirect_uri: redirectUri }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) throw new Error(tokens.error_description || 'GitHub token exchange failed');
      const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'EtherxWord' };
      const [profileRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', { headers }),
        fetch('https://api.github.com/user/emails', { headers }),
      ]);
      const profile = await profileRes.json();
      const emails = await emailsRes.json();
      const primary = Array.isArray(emails) && emails.find((e) => e.primary && e.verified);
      if (!profileRes.ok || !primary) throw new Error('GitHub account has no verified primary email');
      return { email: primary.email, name: profile.name || profile.login || primary.email.split('@')[0] };
    },
  },
};

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// The provider must call back to the backend host that started the flow (that host holds the
// state cookie). BACKEND_URL pins it; otherwise use this request's host, honouring the proxy's
// forwarded protocol (Render terminates TLS in front of Node).
function oauthRedirectUri(req, provider) {
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  const base = (process.env.BACKEND_URL || `${proto}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}/api/auth/${provider}/callback`;
}

function readCookie(req, name) {
  const match = String(req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

async function findOrCreateOAuthUser({ email, name }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  // OAuth users never sign in with a password; store an unguessable one to satisfy the schema.
  const randomPassword = crypto.randomBytes(32).toString('hex');

  if (isMongoConnected()) {
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({ name, email: normalizedEmail, password: randomPassword, isVerified: true });
    } else if (!user.isVerified) {
      // The provider verified this email, which completes any pending OTP signup.
      user.isVerified = true;
      await user.save();
    }
    return user;
  }

  const users = readUsersStore();
  let user = users.find((u) => String(u.email || '').toLowerCase() === normalizedEmail);
  if (!user) {
    user = {
      _id: `user_${crypto.randomUUID()}`,
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(randomPassword, 10),
      isVerified: true,
      plan: 'free',
      billingCycle: 'monthly',
      subscriptionExpiresAt: null,
      role: 'Viewer',
      status: 'active',
      department: 'General',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
  } else {
    user.isVerified = true;
  }
  writeUsersStore(users);
  return user;
}

router.get('/:provider(google|github)', (req, res) => {
  const { provider } = req.params;
  const config = OAUTH_PROVIDERS[provider];
  if (!config.clientId() || !config.clientSecret()) {
    return res.redirect(`${frontendUrl()}/signin?error=${provider}_not_configured`);
  }
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth',
  });
  const params = new URLSearchParams({
    client_id: config.clientId(),
    redirect_uri: oauthRedirectUri(req, provider),
    response_type: 'code',
    scope: config.scope,
    state,
  });
  if (provider === 'google') params.set('prompt', 'select_account');
  res.redirect(`${config.authorizeUrl}?${params}`);
});

router.get('/:provider(google|github)/callback', async (req, res) => {
  const { provider } = req.params;
  const expectedState = readCookie(req, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth' });
  const failed = () => res.redirect(`${frontendUrl()}/signin?error=${provider}_auth_failed`);

  const { code, state } = req.query;
  if (!code || !state || !expectedState || state !== expectedState) return failed();

  try {
    const profile = await OAUTH_PROVIDERS[provider].exchange(String(code), oauthRedirectUri(req, provider));
    const user = await findOrCreateOAuthUser(profile);
    if (user.status === 'deactivated') return failed();
    res.redirect(`${frontendUrl()}/auth/callback#token=${encodeURIComponent(signToken(user))}`);
  } catch (err) {
    console.warn(`[auth] ${provider} OAuth failed:`, err.message);
    failed();
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected()) {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json({ user: formatUserResponse(user) });
    }

    const users = readUsersStore();
    const user = users.find((u) => u._id === req.user.id || u.id === req.user.id || u.email === req.user.email);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
