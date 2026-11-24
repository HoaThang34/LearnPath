'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.OLLAMA_API_KEY = 'test_key';
process.env.OLLAMA_BASE_URL = 'http://localhost:11434/v1';
process.env.OLLAMA_MODEL = 'deepseek-v4-flash';
process.env.AGENT_ENABLED = '1';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-agent-api-auth-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-agent-api-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const { after, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const initSqlJs = require('sql.js');

const authRoutes = require('../../src/routes/auth');
const agentRoutes = require('../../src/routes/agent');
const { getAuthDb } = require('../../src/auth/authDb');
const { getDb } = require('../../src/database/db');

const AUTH_DB = process.env.LEARNPATH_AUTH_DB_PATH;
const MAIN_DB = process.env.LEARNPATH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
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
  if (!headers.Origin) headers.Origin = 'http://localhost:5173';

  return fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body,
  });
}

async function registerUser(username, password = 'Password123') {
  const res = await request('/api/auth/register', {
    method: 'POST',
    body: { username, password, passwordConfirm: password },
  });
  assert.equal(res.status, 201);
  return readCookie(res);
}

before(async () => {
  await getAuthDb();

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE khoi_thi (id INTEGER PRIMARY KEY AUTOINCREMENT, ma_khoi TEXT UNIQUE NOT NULL, mon_thi TEXT, so_truong INTEGER);
    CREATE TABLE truong (id INTEGER PRIMARY KEY AUTOINCREMENT, ma_truong TEXT UNIQUE NOT NULL, ten_truong TEXT NOT NULL);
    CREATE TABLE diem_chuan (id INTEGER PRIMARY KEY AUTOINCREMENT, ma_truong TEXT, truong TEXT NOT NULL, nganh TEXT NOT NULL, to_hop_mon TEXT, diem_chuan REAL, ghi_chu TEXT, nam INTEGER, phuong_thuc TEXT);
    CREATE TABLE de_an_tuyen_sinh (id INTEGER PRIMARY KEY AUTOINCREMENT, ma_truong TEXT, ten_truong TEXT, noi_dung TEXT, nguon TEXT);
    CREATE TABLE diem_thi_thptqg (id INTEGER PRIMARY KEY AUTOINCREMENT, toan REAL, van REAL, ly REAL, hoa REAL, sinh REAL, su REAL, dia REAL, tin_hoc REAL, ngoai_ngu REAL);
  `);
  fs.writeFileSync(MAIN_DB, Buffer.from(db.export()));
  db.close();
  await getDb();

  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('agent API: requires authentication and trusted origin', async () => {
  // 401 without session
  const noAuth = await request('/api/agent/status');
  assert.equal(noAuth.status, 401);

  const cookie = await registerUser('agent_test_user1');

  // 403 with untrusted origin on mutating route
  const badOrigin = await request('/api/agent/consent', {
    method: 'POST',
    cookie,
    headers: { Origin: 'http://malicious-site.com' },
  });
  assert.equal(badOrigin.status, 403);
});

test('agent API: status and consent workflow', async () => {
  const cookie = await registerUser('agent_consent_user');

  // Initial status: not consented
  const st1 = await request('/api/agent/status', { cookie });
  assert.equal(st1.status, 200);
  const data1 = (await st1.json()).data;
  assert.equal(data1.enabled, true);
  assert.equal(data1.consented, false);

  // Attempt chat without consent -> 403 AGENT_CONSENT_REQUIRED
  const chatNoConsent = await request('/api/agent/chat', {
    method: 'POST',
    cookie,
    body: { message: 'Xin chào' },
  });
  assert.equal(chatNoConsent.status, 403);
  const errBody = await chatNoConsent.json();
  assert.equal(errBody.code, 'AGENT_CONSENT_REQUIRED');

  // Give consent
  const consentRes = await request('/api/agent/consent', { method: 'POST', cookie });
  assert.equal(consentRes.status, 200);
  assert.equal((await consentRes.json()).data.consented, true);

  // Status after consent
  const st2 = await request('/api/agent/status', { cookie });
  assert.equal((await st2.json()).data.consented, true);
});

test('agent API: chat SSE streaming and conversation management', async () => {
  const cookie = await registerUser('agent_chat_user');
  await request('/api/agent/consent', { method: 'POST', cookie });

  // Mock global fetch for Ollama backend
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/chat/completions')) {
      return new Response(
        JSON.stringify({
          model: 'deepseek-v4-flash',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: 'Chào bạn! Mình là Trợ lý LearnPath.',
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(url, opts);
  };

  try {
    const res = await request('/api/agent/chat', {
      method: 'POST',
      cookie,
      body: { message: 'Chào trợ lý!' },
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);

    const sseText = await res.text();
    assert.ok(sseText.includes('event: status'));
    assert.ok(sseText.includes('event: message'));
    assert.ok(sseText.includes('event: done'));
    assert.ok(sseText.includes('Chào bạn! Mình là Trợ lý LearnPath.'));

    // Verify conversation created in list
    const listRes = await request('/api/agent/conversations', { cookie });
    assert.equal(listRes.status, 200);
    const conversations = (await listRes.json()).data;
    assert.equal(conversations.length, 1);
    const convId = conversations[0].id;
    assert.ok(conversations[0].title.includes('Chào'));

    // Retrieve conversation details with messages
    const detailRes = await request(`/api/agent/conversations/${convId}`, { cookie });
    assert.equal(detailRes.status, 200);
    const detail = (await detailRes.json()).data;
    assert.equal(detail.messages.length, 2);
    assert.equal(detail.messages[0].role, 'user');
    assert.equal(detail.messages[0].content, 'Chào trợ lý!');
    assert.equal(detail.messages[1].role, 'assistant');
    assert.equal(detail.messages[1].content, 'Chào bạn! Mình là Trợ lý LearnPath.');

    // User isolation: register second user and ensure they cannot read conversation of user 1
    const cookie2 = await registerUser('agent_user_other');
    const isoRes = await request(`/api/agent/conversations/${convId}`, { cookie: cookie2 });
    assert.equal(isoRes.status, 404);

    // Delete conversation
    const delRes = await request(`/api/agent/conversations/${convId}`, {
      method: 'DELETE',
      cookie,
    });
    assert.equal(delRes.status, 204);

    // Check list is now empty
    const listAfter = await request('/api/agent/conversations', { cookie });
    assert.equal((await listAfter.json()).data.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

after(() => {
  if (server) server.close();
  fs.rmSync(AUTH_DB, { force: true });
  fs.rmSync(MAIN_DB, { force: true });
});
