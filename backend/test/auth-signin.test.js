const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const authRoutes = require('../routes/auth');

const usersFile = path.join(__dirname, '..', 'data', 'users.json');

test('POST /api/auth/signin authenticates an offline demo user', async (t) => {
  const hadUsersFile = fs.existsSync(usersFile);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (!hadUsersFile && fs.existsSync(usersFile)) fs.unlinkSync(usersFile);
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@etherx.com', password: 'password123' }),
  });
  const responseText = await response.text();
  assert.equal(response.status, 200, responseText);
  const payload = JSON.parse(responseText);

  assert.equal(typeof payload.token, 'string');
  // Sign-in also returns role and plan, which the client uses for admin access and plan gating.
  const { id, name, email, role, plan } = payload.user;
  assert.deepEqual({ id, name, email }, { id: 'user_demo', name: 'Demo User', email: 'demo@etherx.com' });
  assert.equal(typeof role, 'string');
  assert.equal(typeof plan, 'string');
  assert.equal(payload.user.password, undefined);
  assert.equal(payload.user.passwordHash, undefined);
});

async function startAuthServer(t) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${server.address().port}/api/auth`;
}

test('production refuses the demo token endpoint and demo sign-in', async (t) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => { process.env.NODE_ENV = previous; });
  const base = await startAuthServer(t);

  const demo = await fetch(`${base}/demo`, { method: 'POST' });
  assert.equal(demo.status, 404);

  const signin = await fetch(`${base}/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@etherx.com', password: 'password123' }),
  });
  assert.equal(signin.status, 401);
});
