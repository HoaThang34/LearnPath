'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-interest-integration-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const authRoutes = require('../../src/routes/auth');
const interestRoutes = require('../../src/routes/interest');
const { getAuthDb, queryOne } = require('../../src/auth/authDb');

const DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/interest', interestRoutes);
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.' });
});

let server;
let baseUrl;

function readCookie(response, name = 'lp_session') {
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
  if (options.cookie) headers.Cookie = `lp_session=${options.cookie}`;
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

async function register(username) {
  const { response, data } = await request('/api/auth/register', {
    method: 'POST',
    body: { username, password: 'MatKhau123', passwordConfirm: 'MatKhau123' },
  });
  assert.equal(response.status, 201, JSON.stringify(data));
  return readCookie(response);
}

test('interest API integration', async (t) => {
  t.before(async () => {
    await getAuthDb();
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
      if (name.startsWith(prefix) && (name.endsWith('.tmp') || name.endsWith('.previous'))) {
        fs.rmSync(path.join(os.tmpdir(), name), { force: true });
      }
    }
  });

  await t.test('requires a session', async () => {
    const { response } = await request('/api/interest/instrument');
    assert.equal(response.status, 401);
  });

  const suffix = Date.now();
  const cookieA = await register(`interest_a_${suffix}`);
  const cookieB = await register(`interest_b_${suffix}`);

  let instrument;
  await t.test('returns the instrument without scoring keys', async () => {
    const { response, data } = await request('/api/interest/instrument', { cookie: cookieA });
    assert.equal(response.status, 200);
    instrument = data.data;
    assert.equal(instrument.items.length, 108);
    assert.equal(instrument.part1ItemCount, 60);
    assert.equal(instrument.part2ItemCount, 48);
    for (const item of instrument.items) {
      assert.equal(item.leftKey, undefined);
      assert.equal(item.rightKey, undefined);
    }
  });

  let attemptId;
  await t.test('creates a draft idempotently', async () => {
    const first = await request('/api/interest/attempt', {
      method: 'POST',
      cookie: cookieA,
      body: { giaiDoanHocTap: 'Lớp 12', cauHoiNgheNghiep: 'Nên chọn ngành gì?' },
    });
    assert.equal(first.response.status, 201, JSON.stringify(first.data));
    attemptId = first.data.data.draft.id;
    assert.equal(first.data.data.draft.giaiDoanHocTap, 'Lớp 12');

    const second = await request('/api/interest/attempt', {
      method: 'POST',
      cookie: cookieA,
      body: {},
    });
    assert.equal(second.response.status, 200);
    assert.equal(second.data.data.draft.id, attemptId);
  });

  await t.test('rejects out-of-scale values and unknown items', async () => {
    const riasec = instrument.items.find((item) => item.part === 'riasec');
    const pairs = instrument.items.find((item) => item.part === 'pairs');
    const badHigh = await request(`/api/interest/attempt/${attemptId}/responses`, {
      method: 'PATCH',
      cookie: cookieA,
      body: { responses: [{ itemId: riasec.id, value: 6 }] },
    });
    assert.equal(badHigh.response.status, 400);
    const badPair = await request(`/api/interest/attempt/${attemptId}/responses`, {
      method: 'PATCH',
      cookie: cookieA,
      body: { responses: [{ itemId: pairs.id, value: 3 }] },
    });
    assert.equal(badPair.response.status, 400);
    const unknown = await request(`/api/interest/attempt/${attemptId}/responses`, {
      method: 'PATCH',
      cookie: cookieA,
      body: { responses: [{ itemId: 999999, value: 3 }] },
    });
    assert.equal(unknown.response.status, 400);
  });

  await t.test('blocks submission until 8/10 per group and 12/12 per pair', async () => {
    const firstTen = instrument.items.filter((item) => item.part === 'riasec').slice(0, 10);
    const patch = await request(`/api/interest/attempt/${attemptId}/responses`, {
      method: 'PATCH',
      cookie: cookieA,
      body: { responses: firstTen.map((item) => ({ itemId: item.id, value: 3 })) },
    });
    assert.equal(patch.response.status, 200);
    const submit = await request(`/api/interest/attempt/${attemptId}/submit`, {
      method: 'POST',
      cookie: cookieA,
      body: {},
    });
    assert.equal(submit.response.status, 409);
    assert.ok(Array.isArray(submit.data.details.missingGroups));
  });

  await t.test('saves all answers in batches of 30 and submits', async () => {
    const responses = instrument.items.map((item) => ({
      itemId: item.id,
      value: item.part === 'riasec' ? 3 : 0,
    }));
    for (let index = 0; index < responses.length; index += 30) {
      const batch = responses.slice(index, index + 30);
      const patch = await request(`/api/interest/attempt/${attemptId}/responses`, {
        method: 'PATCH',
        cookie: cookieA,
        body: { responses: batch },
      });
      assert.equal(patch.response.status, 200, JSON.stringify(patch.data));
    }
    const submit = await request(`/api/interest/attempt/${attemptId}/submit`, {
      method: 'POST',
      cookie: cookieA,
      body: {},
    });
    assert.equal(submit.response.status, 200, JSON.stringify(submit.data));
    const result = submit.data.data;
    assert.equal(result.part1.groups.length, 6);
    assert.equal(result.completeness, 'full');
    assert.equal(result.unansweredCount, 0);
    assert.equal(result.part2.referenceCode, '????');
    assert.equal(result.part1.rankingAvailable, true);
    assert.ok(result.interpretation.disclaimer.length > 0);
    assert.equal(queryOne('SELECT interest_completed FROM users WHERE id = (SELECT user_id FROM interest_attempts WHERE id = ?)', [attemptId]).interest_completed, 1);
  });

  await t.test('re-submitting is idempotent for results and submittedAt', async () => {
    const before = queryOne('SELECT submitted_at FROM interest_attempts WHERE id = ?', [attemptId]);
    const first = await request('/api/interest/results/latest', { cookie: cookieA });
    assert.equal(first.response.status, 200);
    const submittedAt = first.data.data.submittedAt;
    const again = await request(`/api/interest/attempt/${attemptId}/submit`, {
      method: 'POST',
      cookie: cookieA,
      body: {},
    });
    assert.equal(again.response.status, 200);
    assert.equal(again.data.data.submittedAt, submittedAt);
    assert.equal(
      Number(queryOne('SELECT COUNT(*) AS total FROM interest_results WHERE attempt_id = ?', [attemptId]).total),
      1
    );
    const after = queryOne('SELECT submitted_at FROM interest_attempts WHERE id = ?', [attemptId]);
    assert.equal(after.submitted_at, before.submitted_at);
  });

  await t.test('another user cannot read or edit the attempt', async () => {
    const read = await request(`/api/interest/results/${attemptId}`, { cookie: cookieB });
    assert.equal(read.response.status, 404);
    const edit = await request(`/api/interest/attempt/${attemptId}/responses`, {
      method: 'PATCH',
      cookie: cookieB,
      body: { responses: [] },
    });
    assert.equal(edit.response.status, 404);
  });

  await t.test('reset clears attempts and interestCompleted', async () => {
    const reset = await request('/api/interest/reset', {
      method: 'POST',
      cookie: cookieA,
      body: {},
    });
    assert.equal(reset.response.status, 200);
    assert.equal(
      Number(queryOne('SELECT COUNT(*) AS total FROM interest_attempts WHERE user_id = (SELECT id FROM users WHERE username = ?)', [`interest_a_${suffix}`]).total),
      0
    );
    assert.equal(
      queryOne('SELECT interest_completed FROM users WHERE username = ?', [`interest_a_${suffix}`]).interest_completed,
      0
    );
    const latest = await request('/api/interest/results/latest', { cookie: cookieA });
    assert.equal(latest.data.data, null);
  });
});
