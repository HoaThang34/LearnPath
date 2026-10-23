'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-auth-integration-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const initSqlJs = require('sql.js');

const authRoutes = require('../../src/routes/auth');

const DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', authRoutes);
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
  }
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.' });
});

let server;
let baseUrl;

function setCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function readCookie(response, name = 'lp_session') {
  for (const header of setCookies(response)) {
    const pair = header.split(';')[0];
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return null;
}

async function request(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body;

  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  if (options.cookie) {
    headers.Cookie = `lp_session=${options.cookie}`;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  return { response, data };
}

test('auth API integration', async (t) => {
  const state = {
    username: `it_user_${Date.now()}`,
    password: 'MatKhau123',
    cookie: null,
    loginCookie: null,
  };

  t.before(async () => {
    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  t.after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }

    fs.rmSync(DB_PATH, { force: true });
    const prefix = path.basename(DB_PATH);
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (name.startsWith(prefix) && name.endsWith('.tmp')) {
        fs.rmSync(path.join(os.tmpdir(), name), { force: true });
      }
    }
  });

  await t.test('rejects /me without a session', async () => {
    const { response, data } = await request('/api/auth/me');

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(data.error, /đăng nhập/i);
  });

  await t.test('registers a user, stores only a hash and sets a safe cookie', async () => {
    const { response, data } = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: state.username,
        password: state.password,
        passwordConfirm: state.password,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(data.data.user.username, state.username);
    assert.equal(typeof data.data.user.id, 'number');
    assert.equal(typeof data.data.user.createdAt, 'string');
    assert.equal(JSON.stringify(data).includes('password'), false);
    assert.equal(JSON.stringify(data).includes('scrypt$'), false);

    const cookieHeader = setCookies(response).find((value) =>
      value.startsWith('lp_session=')
    );
    assert.ok(cookieHeader, 'expected a session cookie');
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    assert.match(cookieHeader, /Path=\//i);
    assert.doesNotMatch(cookieHeader, /; Secure/i);
    assert.match(cookieHeader, /Max-Age=604800/i);

    state.cookie = readCookie(response);
    assert.ok(state.cookie);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
  });

  await t.test('returns the current user for a valid session', async () => {
    const { response, data } = await request('/api/auth/me', {
      cookie: state.cookie,
    });

    assert.equal(response.status, 200);
    assert.equal(data.data.user.username, state.username);
    assert.equal(JSON.stringify(data).includes('password'), false);
  });

  await t.test('rejects a duplicate username case-insensitively', async () => {
    const { response, data } = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: state.username.toUpperCase(),
        password: state.password,
        passwordConfirm: state.password,
      },
    });

    assert.equal(response.status, 409);
    assert.match(data.error, /đã tồn tại/i);
  });

  await t.test('rejects a mismatched password confirmation', async () => {
    const { response } = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: `${state.username}_mismatch`,
        password: state.password,
        passwordConfirm: 'MatKhau124',
      },
    });

    assert.equal(response.status, 400);
  });

  await t.test('rejects a password that does not meet the current policy', async () => {
    const { response } = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: `${state.username}_weak`,
        password: 'abcdefgh',
        passwordConfirm: 'abcdefgh',
      },
    });

    assert.equal(response.status, 400);
  });

  await t.test('rejects a wrong password with a generic message', async () => {
    const { response, data } = await request('/api/auth/login', {
      method: 'POST',
      body: { username: state.username, password: 'MatKhau124' },
    });

    assert.equal(response.status, 401);
    assert.match(data.error, /không đúng/i);
    assert.equal(JSON.stringify(data).includes('scrypt$'), false);
  });

  await t.test('logs in and issues a new session cookie', async () => {
    const { response, data } = await request('/api/auth/login', {
      method: 'POST',
      body: { username: state.username, password: state.password },
    });

    assert.equal(response.status, 200);
    assert.equal(data.data.user.username, state.username);
    state.loginCookie = readCookie(response);
    assert.ok(state.loginCookie);
    assert.notEqual(state.loginCookie, state.cookie);
    assert.match(
      setCookies(response).find((value) => value.startsWith('lp_session=')),
      /HttpOnly/i
    );
  });

  await t.test('rejects a state-changing request from an untrusted origin', async () => {
    const { response } = await request('/api/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: { username: state.username, password: state.password },
    });

    assert.equal(response.status, 403);
  });

  await t.test('logs out and invalidates the session token', async () => {
    const { response } = await request('/api/auth/logout', {
      method: 'POST',
      cookie: state.loginCookie,
    });

    assert.equal(response.status, 204);
    const cleared = setCookies(response).find((value) =>
      value.startsWith('lp_session=')
    );
    assert.ok(cleared);
    assert.match(cleared, /lp_session=;/);

    const afterLogout = await request('/api/auth/me', {
      cookie: state.loginCookie,
    });
    assert.equal(afterLogout.response.status, 401);
  });

  await t.test('returns 429 with Retry-After after repeated failed logins', async () => {
    const username = `it_rate_${Date.now()}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { response } = await request('/api/auth/login', {
        method: 'POST',
        body: { username, password: 'WrongPass1' },
      });
      assert.equal(response.status, 401);
    }

    const blocked = await request('/api/auth/login', {
      method: 'POST',
      body: { username, password: 'WrongPass1' },
    });

    assert.equal(blocked.response.status, 429);
    assert.ok(Number(blocked.response.headers.get('retry-after')) > 0);
  });

  await t.test('rejects oversized and malformed JSON bodies', async () => {
    const oversized = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'someone', password: 'a'.repeat(11000) },
    });
    assert.equal(oversized.response.status, 413);

    const malformed = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{',
    });
    assert.equal(malformed.response.status, 400);
  });

  await t.test('persists hashes, not plaintext credentials or tokens', async () => {
    assert.ok(fs.existsSync(DB_PATH), 'auth DB should be written to disk');

    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(DB_PATH));
    try {
      const users = db.exec('SELECT username, password_hash FROM users');
      assert.ok(users.length > 0);

      const rows = users[0].values;
      assert.equal(rows.length, 1, 'only one account should have been created');
      assert.equal(rows[0][0], state.username);
      assert.match(rows[0][1], /^scrypt\$/);
      assert.equal(rows[0][1].includes(state.password), false);

      const sessions = db.exec('SELECT token_hash FROM sessions');
      assert.ok(sessions.length > 0);
      const tokenHashes = sessions[0].values.map((row) => row[0]);
      assert.ok(tokenHashes.length >= 1);
      assert.equal(tokenHashes.includes(state.loginCookie), false);
      assert.equal(tokenHashes.includes(state.cookie), false);
    } finally {
      db.close();
    }
  });
});
