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
  assert.deepEqual(payload.user, {
    id: 'user_demo',
    name: 'Demo User',
    email: 'demo@etherx.com',
  });
});
