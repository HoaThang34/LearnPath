'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-admin-interest-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const adminRoutes = require('../../src/routes/admin');
const { createAdmin } = require('../../src/auth/adminAuth');
const {
  getAuthDb,
  queryOne,
  queryAll,
  runSql,
  lastInsertId,
} = require('../../src/auth/authDb');
const instrumentSource = require('../../src/data/interest_instrument_v1.json');

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

test('admin interest API integration', async (t) => {
  const state = { username: `admin_interest_${Date.now()}`, password: 'MatKhauAdmin123', cookie: null, csrf: null };

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
    fs.rmSync(DB_PATH, { force: true });
    const prefix = path.basename(DB_PATH);
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (name.startsWith(prefix) && (name.endsWith('.tmp') || name.endsWith('.previous'))) {
        fs.rmSync(path.join(os.tmpdir(), name), { force: true });
      }
    }
  });

  await t.test('requires the admin CSRF header for writes', async () => {
    const { response } = await request('/api/admin/interest/instruments', {
      method: 'POST',
      cookie: state.cookie,
      body: { code: 'x', title: 'x', version: 1 },
    });
    assert.equal(response.status, 403);
  });

  await t.test('lists the seeded active instrument', async () => {
    const { response, data } = await request('/api/admin/interest/instruments', { cookie: state.cookie });
    assert.equal(response.status, 200);
    const active = data.data.find((row) => row.status === 'active');
    assert.equal(active.code, 'holland-pairs-v1');
    assert.equal(active.riasecCount, 60);
    assert.equal(active.pairsCount, 48);
  });

  await t.test('rejects an invalid import without writing anything', async () => {
    const broken = JSON.parse(JSON.stringify(instrumentSource));
    broken.code = 'holland-pairs-v2';
    broken.version = 2;
    broken.part1.pop();
    const { response, data } = await request('/api/admin/interest/instruments/import', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { instrument: broken },
    });
    assert.equal(response.status, 400, JSON.stringify(data));
    assert.ok(Array.isArray(data.details));
    assert.equal(
      Number(queryOne("SELECT COUNT(*) AS total FROM interest_instruments WHERE code = 'holland-pairs-v2'").total),
      0
    );
  });

  let importedId;
  await t.test('imports a valid 108-item instrument as a draft', async () => {
    const copy = JSON.parse(JSON.stringify(instrumentSource));
    copy.code = 'holland-pairs-v2';
    copy.version = 2;
    copy.title = 'Khám phá sở thích nghề nghiệp (bản 2)';
    const { response, data } = await request('/api/admin/interest/instruments/import', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { instrument: copy },
    });
    assert.equal(response.status, 201, JSON.stringify(data));
    importedId = data.data.instrument.id;
    assert.equal(data.data.instrument.status, 'draft');
    assert.equal(data.data.items.length, 108);
    assert.equal(data.data.counts.total, 108);
  });

  await t.test('activates the imported version and archives the old one', async () => {
    const { response, data } = await request(
      `/api/admin/interest/instruments/${importedId}/activate`,
      { method: 'POST', cookie: state.cookie, csrf: state.csrf, body: {} }
    );
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.data.status, 'active');
    assert.equal(
      queryOne("SELECT status FROM interest_instruments WHERE code = 'holland-pairs-v1'").status,
      'archived'
    );
  });

  await t.test('refuses to edit an active instrument', async () => {
    const { response } = await request(`/api/admin/interest/instruments/${importedId}/items`, {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { items: [] },
    });
    assert.equal(response.status, 409);
  });

  await t.test('creates a draft copy and keeps item keys', async () => {
    const { response, data } = await request('/api/admin/interest/instruments', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        code: 'holland-pairs-v3',
        title: 'Bản nháp 3',
        version: 3,
        sourceNote: 'Câu hỏi tự biên soạn; chấm điểm theo hợp đồng nội bộ.',
        copyFromId: importedId,
      },
    });
    assert.equal(response.status, 201, JSON.stringify(data));
    assert.equal(data.data.items.length, 108);
    const pair = data.data.items.find((item) => item.part === 'pairs' && item.itemNo === 2);
    assert.equal(pair.leftKey, 'I');
    assert.equal(pair.rightKey, 'E');
  });

  await t.test('validates weights sum and records audit on update', async () => {
    const list = await request('/api/admin/interest/weights', { cookie: state.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.data.length, 8);
    const weights = list.data.data.map((row) => ({
      majorGroup: row.majorGroup,
      wR: row.wR,
      wI: row.wI,
      wA: row.wA,
      wS: row.wS,
      wE: row.wE,
      wC: row.wC,
      note: row.note,
    }));
    const invalid = weights.map((row) => ({ ...row, wR: row.wR + 0.1 }));
    const bad = await request('/api/admin/interest/weights', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { weights: invalid },
    });
    assert.equal(bad.response.status, 400);

    const good = await request('/api/admin/interest/weights', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { weights },
    });
    assert.equal(good.response.status, 200, JSON.stringify(good.data));
    assert.equal(
      Number(queryOne("SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.interest.weights.update'").total),
      1
    );
  });

  await t.test('returns aggregate stats, audited detail, and anonymous CSV', async () => {
    const instrument = queryOne("SELECT id FROM interest_instruments WHERE status = 'active'");
    const now = Date.now();
    runSql(
      `INSERT INTO users (username, username_lower, password_hash, created_at, status, updated_at, survey_completed, interest_completed)
       VALUES ('stats_user', 'stats_user', 'scrypt$test$hash', ?, 'active', ?, 1, 1)`,
      [now, now]
    );
    const userId = lastInsertId();
    runSql(
      `INSERT INTO interest_attempts (user_id, instrument_id, status, started_at, last_saved_at, submitted_at)
       VALUES (?, ?, 'submitted', ?, ?, ?)`,
      [userId, instrument.id, now, now, now]
    );
    const attemptId = lastInsertId();
    runSql(
      `INSERT INTO interest_results
         (attempt_id, user_id, instrument_id, algorithm_version, r, i, a, s, e, c,
          r_answered, i_answered, a_answered, s_answered, e_answered, c_answered,
          d_ei, d_sn, d_tf, d_jp, code, top_groups, ties, completeness, unanswered_count, computed_at)
       VALUES (?, ?, ?, 'holland-pairs/1.0.0', 42, 38, 30, 20, 15, 10,
               10, 10, 10, 10, 10, 10, 12, -12, 0, 24, 'R-I-A', '["R","I","A"]', '[]', 'full', 0, ?)`,
      [attemptId, userId, instrument.id, now]
    );

    const stats = await request('/api/admin/interest/results', { cookie: state.cookie });
    assert.equal(stats.response.status, 200);
    assert.equal(stats.data.data.submitted, 1);
    assert.deepEqual(stats.data.data.topGroupDistribution, [{ code: 'R', count: 1 }]);

    const detail = await request(`/api/admin/interest/results/${attemptId}`, { cookie: state.cookie });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.data.data.username, 'stats_user');
    assert.equal(
      Number(queryOne("SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.interest.result.view'").total),
      1
    );

    const exported = await fetch(`${baseUrl}/api/admin/interest/results/export`, {
      headers: { Cookie: `lp_admin_session=${state.cookie}` },
    });
    const csv = await exported.text();
    assert.equal(exported.status, 200);
    assert.match(csv, /attemptId/);
    assert.ok(csv.includes(String(attemptId)));
    assert.equal(csv.includes('stats_user'), false);
  });

  await t.test('validates and updates the overall match configuration', async () => {
    const list = await request('/api/admin/career/match-config', { cookie: state.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.data.length, 7);

    const bad = await request('/api/admin/career/match-config', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { config: { matrix_hoc_luc_low: 80, matrix_hoc_luc_high: 70 } },
    });
    assert.equal(bad.response.status, 400);

    const good = await request('/api/admin/career/match-config', {
      method: 'PUT',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { config: { w_hoc_luc: 0.7, w_tinh_cach: 0.3 } },
    });
    assert.equal(good.response.status, 200, JSON.stringify(good.data));
    assert.equal(good.data.data.config.w_hoc_luc, 0.7);
    assert.equal(
      Number(queryOne("SELECT COUNT(*) AS total FROM admin_audit WHERE action = 'admin.career.match_config.update'").total),
      1
    );
  });

  await t.test('audit contains instrument import and activation actions', async () => {
    const actions = queryAll('SELECT action FROM admin_audit').map((row) => row.action);
    assert.ok(actions.includes('admin.interest.instrument.import'));
    assert.ok(actions.includes('admin.interest.instrument.activate'));
    assert.ok(actions.includes('admin.interest.instrument.create'));
  });
});
