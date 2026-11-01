'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const REPO = path.join(__dirname, '..', '..');
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'learnpath-career-config-api-'));
const GROUPS_COPY = path.join(TEMP_DIR, 'career_group_weights.json');
const PRIORITIES_COPY = path.join(TEMP_DIR, 'career_subject_priorities.json');
const MBTI_COPY = path.join(TEMP_DIR, 'career_mbti_profile.json');
const BACKUP_DIR = path.join(TEMP_DIR, 'backups');

fs.copyFileSync(path.join(REPO, 'src', 'data', 'career_group_weights.json'), GROUPS_COPY);
fs.copyFileSync(path.join(REPO, 'src', 'data', 'career_subject_priorities.json'), PRIORITIES_COPY);
fs.copyFileSync(path.join(REPO, 'src', 'data', 'career_mbti_profile.json'), MBTI_COPY);

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(TEMP_DIR, 'auth.db');
process.env.LEARNPATH_GROUP_WEIGHTS_PATH = GROUPS_COPY;
process.env.LEARNPATH_SUBJECT_PRIORITIES_PATH = PRIORITIES_COPY;
process.env.LEARNPATH_MBTI_PROFILE_PATH = MBTI_COPY;
process.env.LEARNPATH_CONFIG_BACKUP_DIR = BACKUP_DIR;

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const adminRoutes = require('../../src/routes/admin');
const { createAdmin } = require('../../src/auth/adminAuth');
const { getAuthDb, queryOne } = require('../../src/auth/authDb');
const { getGroupConfig } = require('../../src/career/groupMatch');
const { getPriorityConfig, rowKey } = require('../../src/career/hocLuc');

const DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use('/api/admin', adminRoutes);
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.' });
});

let server;
let baseUrl;

function readCookie(response, name) {
  const headers =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  for (const header of headers) {
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
  if (options.cookie) headers.Cookie = `lp_admin_session=${options.cookie}`;
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

function readGroupsFile() {
  return JSON.parse(fs.readFileSync(GROUPS_COPY, 'utf8'));
}

function backupNames(prefix) {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.json'));
}

test('admin career group-config write API', async (t) => {
  const state = {
    username: `admin_config_${Date.now()}`,
    password: 'MatKhauAdmin123',
    cookie: null,
    csrf: null,
  };

  t.before(async () => {
    await getAuthDb();
    await createAdmin({ username: state.username, password: state.password });
    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const login = await request('/api/admin/auth/login', {
      method: 'POST',
      body: { username: state.username, password: state.password },
    });
    state.cookie = readCookie(login.response, 'lp_admin_session');
    state.csrf = login.data?.data?.csrfToken;
    assert.ok(state.cookie);
    assert.ok(state.csrf);
  });

  t.after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  await t.test('requires an admin session and CSRF header for writes', async () => {
    const noSession = await request('/api/admin/career/group-config/groups', {
      method: 'PUT',
      body: { groups: [] },
    });
    assert.equal(noSession.response.status, 401);

    const noCsrf = await request('/api/admin/career/group-config/groups', {
      method: 'PUT',
      cookie: state.cookie,
      body: { groups: [] },
    });
    assert.equal(noCsrf.response.status, 403);

    const read = await request('/api/admin/career/group-config/priorities', {
      cookie: state.cookie,
    });
    assert.equal(read.response.status, 200);
  });

  await t.test('lists all 143 priority rows with unique keys', async () => {
    const { response, data } = await request('/api/admin/career/group-config/priorities', {
      cookie: state.cookie,
    });
    assert.equal(response.status, 200);
    assert.equal(data.data.total, 143);
    assert.equal(data.data.rows.length, 143);
    assert.equal(new Set(data.data.rows.map((row) => row.key)).size, 143);
    assert.ok(data.data.rows.every((row) => row.subjects.length > 0));
  });

  await t.test('rejects an invalid group triple without changing the file', async () => {
    const before = fs.readFileSync(GROUPS_COPY, 'utf8');
    const { response, data } = await request('/api/admin/career/group-config/groups', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { groups: [{ code: 'cntt', wHocLuc: 0.5, wHolland: 0.3, wMbti: 0.4 }] },
    });
    assert.equal(response.status, 400, JSON.stringify(data));
    assert.match(data.error, /phải bằng 1/);
    assert.equal(fs.readFileSync(GROUPS_COPY, 'utf8'), before);
    assert.equal(backupNames('career_group_weights').length, 0);
  });

  await t.test('writes a valid group triple, audits it, and the user config follows', async () => {
    const { response, data } = await request('/api/admin/career/group-config/groups', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { groups: [{ code: 'cntt', wHocLuc: 0.5, wHolland: 0.3, wMbti: 0.2 }] },
    });
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.data.changed, true);
    assert.equal(data.data.changes.length, 1);
    assert.equal(data.data.config.updatedBy, state.username);
    assert.equal(typeof data.data.config.updatedAt, 'string');

    const file = readGroupsFile();
    const group = file.groups.find((row) => row.code === 'cntt');
    assert.equal(group.wHocLuc, 0.5);
    assert.equal(group.wHolland, 0.3);
    assert.equal(group.wMbti, 0.2);
    assert.equal(file.updatedBy, state.username);
    assert.equal(backupNames('career_group_weights').length, 1);

    const cached = getGroupConfig().groups.find((row) => row.code === 'cntt');
    assert.equal(cached.wHocLuc, 0.5);

    const read = await request('/api/admin/career/group-config', { cookie: state.cookie });
    assert.equal(read.response.status, 200);
    const fromApi = read.data.data.groups.groups.find((row) => row.code === 'cntt');
    assert.equal(fromApi.wMbti, 0.2);
    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.group_weights.update'"
        ).total
      ),
      1
    );
  });

  await t.test('a no-op group save reports changed=false and writes no audit row', async () => {
    const { response, data } = await request('/api/admin/career/group-config/groups', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { groups: [{ code: 'cntt', wHocLuc: 0.5, wHolland: 0.3, wMbti: 0.2 }] },
    });
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.data.changed, false);
    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.group_weights.update'"
        ).total
      ),
      1
    );
  });

  await t.test('rejects an invalid priority value and an unknown row', async () => {
    const list = await request('/api/admin/career/group-config/priorities', { cookie: state.cookie });
    const row = list.data.data.rows[0];
    const values = Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r]));
    const first = row.subjects[0].subject;

    const invalid = await request('/api/admin/career/group-config/priorities', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { key: row.key, priorities: { ...values, [first]: 5 } },
    });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.data.error, /1–4/);

    const unknown = await request('/api/admin/career/group-config/priorities', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { key: 'khong|co|dong|nay', priorities: values },
    });
    assert.equal(unknown.response.status, 404);
  });

  await t.test('writes one priority row, audits it, and the L config reflects it', async () => {
    const list = await request('/api/admin/career/group-config/priorities', { cookie: state.cookie });
    const row = list.data.data.rows.find((entry) => entry.subjects.length >= 2);
    const values = Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r]));
    const first = row.subjects[0].subject;
    values[first] = values[first] === 4 ? 1 : Number(values[first]) + 1;

    const { response, data } = await request('/api/admin/career/group-config/priorities', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { key: row.key, priorities: values },
    });
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.data.changed, true);
    assert.equal(data.data.row.key, row.key);
    assert.equal(data.data.row.subjects.find((subject) => subject.subject === first).r, values[first]);
    assert.equal(backupNames('career_subject_priorities').length, 1);

    const file = JSON.parse(fs.readFileSync(PRIORITIES_COPY, 'utf8'));
    const saved = file.rows.find((entry) => rowKey(entry) === row.key);
    assert.equal(saved.subjects.find((subject) => subject.subject === first).r, values[first]);
    assert.equal(file.updatedBy, state.username);

    const config = getPriorityConfig();
    assert.equal(typeof config.updatedAt, 'string');
    assert.equal(config.updatedBy, state.username);
    assert.equal(config.rowCount, 143);

    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.subject_priorities.update'"
        ).total
      ),
      1
    );
  });

  await t.test('a no-op priority save reports changed=false and writes no audit row', async () => {
    const list = await request('/api/admin/career/group-config/priorities', { cookie: state.cookie });
    const row = list.data.data.rows[0];
    const values = Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r]));
    const backupsBefore = backupNames('career_subject_priorities').length;

    const { response, data } = await request('/api/admin/career/group-config/priorities', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { key: row.key, priorities: values },
    });
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.data.changed, false);
    assert.equal(backupNames('career_subject_priorities').length, backupsBefore);
    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.subject_priorities.update'"
        ).total
      ),
      1
    );
  });

  await t.test('reads and updates the MBTI profile through the admin API', async () => {
    const initial = await request('/api/admin/career/group-config/mbti', { cookie: state.cookie });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.data.data.axes.length, 4);

    // Reject invalid values
    const bad = await request('/api/admin/career/group-config/mbti', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { status: 'xac_dinh', axes: [{ code: 'EI', c: -5, t: 1 }] },
    });
    assert.equal(bad.response.status, 400);

    // Valid update
    const { response, data } = await request('/api/admin/career/group-config/mbti', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        status: 'xac_dinh',
        note: 'Đã thẩm định kiểm thử',
        axes: [
          { code: 'EI', c: 1, t: 1 },
          { code: 'SN', c: 1, t: -1 },
          { code: 'TF', c: 1.5, t: 1 },
          { code: 'JP', c: 1, t: 1 },
        ],
      },
    });
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.data.changed, true);
    assert.equal(data.data.profile.status, 'xac_dinh');
    assert.equal(data.data.profile.determined, true);

    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.mbti_profile.update'"
        ).total
      ),
      1
    );

    // No-op update
    const noop = await request('/api/admin/career/group-config/mbti', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        status: data.data.profile.status,
        note: data.data.profile.note,
        axes: data.data.profile.axes,
      },
    });
    assert.equal(noop.response.status, 200);
    assert.equal(noop.data.data.changed, false);
    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.mbti_profile.update'"
        ).total
      ),
      1
    );
  });
});
