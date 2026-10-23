'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-admin-integration-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-admin-integration-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const adminRoutes = require('../../src/routes/admin');
const authRoutes = require('../../src/routes/auth');
const { requireAuth, requirePasswordChanged } = require('../../src/auth/session');
const { createAdmin, setAdminStatus } = require('../../src/auth/adminAuth');
const { queryOne, runSql, saveAuthDb } = require('../../src/auth/authDb');
const { resetRateLimitState } = require('../../src/auth/rateLimit');

const AUTH_DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use('/api/admin', adminRoutes);
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', authRoutes);
app.get('/api/protected', requireAuth, requirePasswordChanged, (req, res) => {
  res.json({ data: { user: req.user } });
});
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

function readCookie(response, name) {
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

  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  if (options.cookie) {
    headers.Cookie = `${options.cookieName || 'lp_admin_session'}=${options.cookie}`;
  }

  if (options.csrf) headers['X-Admin-CSRF'] = options.csrf;

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

async function adminLogin(username, password) {
  const result = await request('/api/admin/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  return {
    ...result,
    cookie: readCookie(result.response, 'lp_admin_session'),
    csrf: result.data?.data?.csrfToken || null,
  };
}

async function userLogin(username, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    cookieName: 'lp_session',
    body: { username, password },
  });
  return {
    ...result,
    cookie: readCookie(result.response, 'lp_session'),
  };
}

test('admin API integration', async (t) => {
  const state = {
    adminUsername: `admin_it_${Date.now()}`,
    adminPassword: 'MatKhauAdmin123',
    disabledUsername: `admin_disabled_${Date.now()}`,
    cookie: null,
    csrf: null,
    latestCookie: null,
    latestCsrf: null,
  };

  t.before(async () => {
    resetRateLimitState();
    await createAdmin({
      username: state.adminUsername,
      password: state.adminPassword,
    });
    await createAdmin({
      username: state.disabledUsername,
      password: 'MatKhauAdmin124',
    });
    await setAdminStatus(state.disabledUsername, 'disabled');

    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  t.after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }

    fs.rmSync(AUTH_DB_PATH, { force: true });
    const directory = path.dirname(AUTH_DB_PATH);
    const prefix = path.basename(AUTH_DB_PATH);
    for (const name of fs.readdirSync(directory)) {
      if (name.startsWith(prefix)) {
        fs.rmSync(path.join(directory, name), { force: true });
      }
    }
  });

  await t.test('rejects a disabled admin and a wrong password', async () => {
    const disabled = await adminLogin(state.disabledUsername, 'MatKhauAdmin124');
    assert.equal(disabled.response.status, 403);
    assert.match(disabled.data.error, /không khả dụng/i);

    const wrong = await adminLogin(state.adminUsername, 'SaiMatKhau123');
    assert.equal(wrong.response.status, 401);
    assert.match(wrong.data.error, /không đúng/i);
  });

  await t.test('logs in with a strict admin cookie and CSRF token', async () => {
    const result = await adminLogin(state.adminUsername, state.adminPassword);
    assert.equal(result.response.status, 200);
    assert.equal(result.data.data.admin.username, state.adminUsername);
    assert.equal(typeof result.data.data.csrfToken, 'string');
    assert.ok(result.data.data.csrfToken.length >= 32);
    assert.ok(result.cookie);

    const cookieHeader = setCookies(result.response).find((value) =>
      value.startsWith('lp_admin_session=')
    );
    assert.ok(cookieHeader);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Strict/i);
    assert.match(cookieHeader, /Path=\//i);
    assert.match(cookieHeader, /Max-Age=28800/i);
    assert.doesNotMatch(cookieHeader, /; Secure/i);

    state.cookie = result.cookie;
    state.csrf = result.csrf;

    const me = await request('/api/admin/auth/me', { cookie: state.cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.data.data.admin.username, state.adminUsername);
    assert.equal(me.data.data.csrfToken, state.csrf);
  });

  await t.test('does not mix user and admin sessions', async () => {
    const username = `mix_${Date.now()}`;
    const register = await request('/api/auth/register', {
      method: 'POST',
      body: { username, password: 'MatKhau123', passwordConfirm: 'MatKhau123' },
    });
    assert.equal(register.response.status, 201);
    const userCookie = readCookie(register.response, 'lp_session');

    const userOnAdmin = await request('/api/admin/auth/me', {
      cookie: userCookie,
      cookieName: 'lp_admin_session',
    });
    assert.equal(userOnAdmin.response.status, 401);

    const adminOnUser = await request('/api/auth/me', {
      cookie: state.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(adminOnUser.response.status, 401);
  });

  await t.test('rejects missing CSRF and an untrusted origin', async () => {
    const noCsrf = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      body: { username: `csrf_${Date.now()}` },
    });
    assert.equal(noCsrf.response.status, 403);
    assert.match(noCsrf.data.error, /CSRF/i);

    const badOrigin = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      headers: { Origin: 'https://evil.example' },
      body: { username: `origin_${Date.now()}` },
    });
    assert.equal(badOrigin.response.status, 403);
  });

  await t.test('creates a user, forces a password change and revokes other sessions', async () => {
    const username = `created_${Date.now()}`;
    const created = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username },
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.data.data.username, username);
    assert.equal(created.data.data.password.length, 16);
    assert.equal(created.response.headers.get('cache-control'), 'no-store');

    const tempPassword = created.data.data.password;
    const firstLogin = await userLogin(username, tempPassword);
    assert.equal(firstLogin.response.status, 200);
    assert.equal(firstLogin.data.data.user.mustChangePassword, true);
    assert.ok(firstLogin.cookie);

    const secondLogin = await userLogin(username, tempPassword);
    assert.equal(secondLogin.response.status, 200);
    assert.ok(secondLogin.cookie);

    const blocked = await request('/api/protected', {
      cookie: firstLogin.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.data.code, 'PASSWORD_CHANGE_REQUIRED');

    const wrongCurrent = await request('/api/auth/change-password', {
      method: 'POST',
      cookie: firstLogin.cookie,
      cookieName: 'lp_session',
      body: {
        currentPassword: 'SaiMatKhau123',
        newPassword: 'MatKhauMoi123',
        newPasswordConfirm: 'MatKhauMoi123',
      },
    });
    assert.equal(wrongCurrent.response.status, 401);

    const changed = await request('/api/auth/change-password', {
      method: 'POST',
      cookie: firstLogin.cookie,
      cookieName: 'lp_session',
      body: {
        currentPassword: tempPassword,
        newPassword: 'MatKhauMoi123',
        newPasswordConfirm: 'MatKhauMoi123',
      },
    });
    assert.equal(changed.response.status, 200);
    assert.equal(changed.data.data.user.mustChangePassword, false);

    const stillCurrent = await request('/api/protected', {
      cookie: firstLogin.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(stillCurrent.response.status, 200);

    const revoked = await request('/api/auth/me', {
      cookie: secondLogin.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(revoked.response.status, 401);

    const oldPassword = await userLogin(username, tempPassword);
    assert.equal(oldPassword.response.status, 401);

    const newPassword = await userLogin(username, 'MatKhauMoi123');
    assert.equal(newPassword.response.status, 200);
  });

  await t.test('bulk creates users and reports invalid or duplicate entries', async () => {
    const stamp = Date.now();
    const first = `bulk_a_${stamp}`;
    const second = `bulk_b_${stamp}`;
    const existing = `bulk_existing_${stamp}`;

    const existingResult = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username: existing },
    });
    assert.equal(existingResult.response.status, 201);

    const result = await request('/api/admin/users/bulk', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        usernames: [first, second, 'ab', existing, first],
      },
    });

    assert.equal(result.response.status, 201);
    assert.equal(result.data.data.length, 2);
    assert.equal(result.data.skipped.length, 3);
    assert.ok(result.data.data.every((item) => item.password.length === 16));
    assert.equal(JSON.stringify(result.data.skipped).includes('password'), false);

    const login = await userLogin(first, result.data.data[0].password);
    assert.equal(login.response.status, 200);
    assert.equal(login.data.data.user.mustChangePassword, true);
  });

  await t.test('locks and unlocks a user and revokes its sessions', async () => {
    const username = `locked_${Date.now()}`;
    const created = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username },
    });
    const password = created.data.data.password;
    const userId = created.data.data.id;

    const login = await userLogin(username, password);
    assert.equal(login.response.status, 200);

    const locked = await request(`/api/admin/users/${userId}/lock`, {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
    });
    assert.equal(locked.response.status, 200);
    assert.equal(locked.data.data.status, 'locked');

    const lockedLogin = await userLogin(username, password);
    assert.equal(lockedLogin.response.status, 403);
    assert.equal(lockedLogin.data.code, 'ACCOUNT_LOCKED');

    const revoked = await request('/api/auth/me', {
      cookie: login.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(revoked.response.status, 401);

    const unlocked = await request(`/api/admin/users/${userId}/unlock`, {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
    });
    assert.equal(unlocked.response.status, 200);
    assert.equal(unlocked.data.data.status, 'active');

    const loginAgain = await userLogin(username, password);
    assert.equal(loginAgain.response.status, 200);
  });

  await t.test('resets a password and revokes existing sessions', async () => {
    const username = `reset_${Date.now()}`;
    const created = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username },
    });
    const userId = created.data.data.id;
    const originalPassword = created.data.data.password;

    const login = await userLogin(username, originalPassword);
    assert.equal(login.response.status, 200);

    const reset = await request(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
    });
    assert.equal(reset.response.status, 200);
    assert.equal(reset.data.data.mustChangePassword, true);
    const newPassword = reset.data.data.password;

    const oldLogin = await userLogin(username, originalPassword);
    assert.equal(oldLogin.response.status, 401);

    const oldSession = await request('/api/auth/me', {
      cookie: login.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(oldSession.response.status, 401);

    const newLogin = await userLogin(username, newPassword);
    assert.equal(newLogin.response.status, 200);
    assert.equal(newLogin.data.data.user.mustChangePassword, true);
  });

  await t.test('edits a username and rejects a case-insensitive duplicate', async () => {
    const username = `rename_${Date.now()}`;
    const renamed = `${username}_new`;
    const created = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username },
    });
    const userId = created.data.data.id;
    const password = created.data.data.password;

    const other = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username: `rename_other_${Date.now()}` },
    });
    assert.equal(other.response.status, 201);

    const duplicate = await request(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username: other.data.data.username.toUpperCase() },
    });
    assert.equal(duplicate.response.status, 409);

    const updated = await request(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username: renamed },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.data.username, renamed);

    const oldName = await userLogin(username, password);
    assert.equal(oldName.response.status, 401);

    const newName = await userLogin(renamed, password);
    assert.equal(newName.response.status, 200);
  });

  await t.test('soft deletes, blocks duplicate registration and restores a user', async () => {
    const username = `deleted_${Date.now()}`;
    const created = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username },
    });
    const userId = created.data.data.id;
    const password = created.data.data.password;

    const login = await userLogin(username, password);
    assert.equal(login.response.status, 200);

    const wrongConfirm = await request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { confirmUsername: 'wrong' },
    });
    assert.equal(wrongConfirm.response.status, 400);

    const deleted = await request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { confirmUsername: username },
    });
    assert.equal(deleted.response.status, 204);

    const deletedLogin = await userLogin(username, password);
    assert.equal(deletedLogin.response.status, 403);
    assert.equal(deletedLogin.data.code, 'ACCOUNT_DELETED');

    const oldSession = await request('/api/auth/me', {
      cookie: login.cookie,
      cookieName: 'lp_session',
    });
    assert.equal(oldSession.response.status, 401);

    const duplicate = await request('/api/admin/users', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { username },
    });
    assert.equal(duplicate.response.status, 409);

    const restored = await request(`/api/admin/users/${userId}/restore`, {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
    });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.data.data.status, 'active');

    const loginAgain = await userLogin(username, password);
    assert.equal(loginAgain.response.status, 200);
  });

  await t.test('keeps at most three admin sessions and expires idle ones', async () => {
    const initialCookie = state.cookie;

    for (let index = 0; index < 3; index += 1) {
      const login = await adminLogin(state.adminUsername, state.adminPassword);
      assert.equal(login.response.status, 200);
      state.latestCookie = login.cookie;
      state.latestCsrf = login.csrf;
    }

    const count = queryOne('SELECT COUNT(*) AS total FROM admin_sessions');
    assert.equal(Number(count.total), 3);

    const first = await request('/api/admin/auth/me', { cookie: initialCookie });
    assert.equal(first.response.status, 401);

    const latest = await request('/api/admin/auth/me', { cookie: state.latestCookie });
    assert.equal(latest.response.status, 200);

    const extra = await adminLogin(state.adminUsername, state.adminPassword);
    assert.equal(extra.response.status, 200);
    runSql('UPDATE admin_sessions SET last_seen_at = ?', [
      Date.now() - 31 * 60 * 1000,
    ]);
    saveAuthDb();
    const idle = await request('/api/admin/auth/me', { cookie: extra.cookie });
    assert.equal(idle.response.status, 401);

    const fresh = await adminLogin(state.adminUsername, state.adminPassword);
    assert.equal(fresh.response.status, 200);
    state.latestCookie = fresh.cookie;
    state.latestCsrf = fresh.csrf;
  });

  await t.test('lists audit entries without secrets', async () => {
    const result = await request('/api/admin/audit?limit=100', {
      cookie: state.latestCookie,
    });

    assert.equal(result.response.status, 200);
    assert.ok(result.data.total > 0);
    const serialized = JSON.stringify(result.data);
    assert.equal(serialized.includes('MatKhauAdmin123'), false);
    assert.equal(serialized.includes('scrypt$'), false);
    assert.equal(serialized.includes('"password":"'), false);

    const actions = result.data.data.map((entry) => entry.action);
    assert.ok(actions.includes('admin.login.success'));
    assert.ok(actions.includes('admin.user.create'));
    assert.ok(actions.includes('admin.user.delete'));
  });

  await t.test('requires CSRF to log out and invalidates the session', async () => {
    const noCsrf = await request('/api/admin/auth/logout', {
      method: 'POST',
      cookie: state.latestCookie,
    });
    assert.equal(noCsrf.response.status, 403);

    const stillValid = await request('/api/admin/auth/me', {
      cookie: state.latestCookie,
    });
    assert.equal(stillValid.response.status, 200);

    const logout = await request('/api/admin/auth/logout', {
      method: 'POST',
      cookie: state.latestCookie,
      csrf: state.latestCsrf,
    });
    assert.equal(logout.response.status, 204);
    assert.match(
      setCookies(logout.response).find((value) => value.startsWith('lp_admin_session=')),
      /lp_admin_session=;/
    );

    const afterLogout = await request('/api/admin/auth/me', {
      cookie: state.latestCookie,
    });
    assert.equal(afterLogout.response.status, 401);
  });

  await t.test('rate limits repeated admin login failures', async () => {
    const username = `admin_rate_${Date.now()}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { response } = await adminLogin(username, 'SaiMatKhau123');
      assert.equal(response.status, 401);
    }

    const blocked = await adminLogin(username, 'SaiMatKhau123');
    assert.equal(blocked.response.status, 429);
    assert.ok(Number(blocked.response.headers.get('retry-after')) > 0);
  });
});
