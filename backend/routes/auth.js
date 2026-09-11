const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
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
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'user_padmaja',
          name: 'Padmaja Biswal',
          email: 'biswalpadmaja411@gmail.com',
          passwordHash: bcrypt.hashSync('password123', 10),
          isVerified: true,
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'user_vinay',
          name: 'Vinay',
          email: 'vinaygk219@gmail.com',
          passwordHash: bcrypt.hashSync('vinay@3374', 10),
          isVerified: true,
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

function signToken(user) {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
  return jwt.sign(
    { id: user._id || user.id, email: user.email, name: user.name },
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
    };
    const token = signToken(demoUser);
    res.json({ token, user: { id: demoUser.id, name: demoUser.name, email: demoUser.email } });
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
      await OTP.deleteMany({ email: normalizedEmail, type: 'verify' });
      await OTP.create({ email: normalizedEmail, otp, type: 'verify', expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

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

      await User.updateOne({ email: normalizedEmail }, { isVerified: true });
      await OTP.deleteMany({ email: normalizedEmail, type: 'verify' });

      const user  = await User.findOne({ email: normalizedEmail });
      const token = signToken(user);
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
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
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/resend-otp ─────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, type } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (isMongoConnected()) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) return res.status(404).json({ message: 'Email not found' });

      const otp = generateOTP();
      await OTP.deleteMany({ email: normalizedEmail, type });
      await OTP.create({ email: normalizedEmail, otp, type, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

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
      const user = await User.findOne({ email: normalizedEmail });
      if (!user || !(await user.comparePassword(suppliedPassword))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          message: 'Please verify your email first',
          needsVerification: true,
        });
      }

      const token = signToken(user);
      return res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email },
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
      user: { id: user._id || user.id, name: user.name, email: user.email },
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
      await OTP.deleteMany({ email: normalizedEmail, type: 'reset' });
      await OTP.create({ email: normalizedEmail, otp, type: 'reset', expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

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
      await user.save();
      await OTP.deleteMany({ email: payload.email, type: 'reset' });

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
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected()) {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json({ user });
    }

    const users = readUsersStore();
    const user = users.find((u) => u._id === req.user.id || u.id === req.user.id || u.email === req.user.email);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: { id: user._id || user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
