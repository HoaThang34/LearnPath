'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-hsa-integration-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const authRoutes = require('../../src/routes/auth');
const diemThiRoutes = require('../../src/routes/diemThi');
const { requireAuth, requirePasswordChanged } = require('../../src/auth/session');

const DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/diem-thi', requireAuth, requirePasswordChanged, diemThiRoutes);
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

test.before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  for (const suffix of ['', '-journal', '-wal']) {
    const file = `${DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch {}
    }
  }
});

test('HSA ranking API requires auth and responds correctly', async () => {
  // 1. Unauthenticated request to /hsa/exams returns 401
  const unauthRes = await fetch(`${baseUrl}/api/diem-thi/hsa/exams`);
  assert.equal(unauthRes.status, 401);

  // 2. Register a new user
  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify({
      username: 'hsatester',
      password: 'Password123',
      passwordConfirm: 'Password123',
    }),
  });
  assert.equal(registerRes.status, 201);
  const sessionToken = readCookie(registerRes);
  assert.ok(sessionToken);

  const authHeaders = {
    Cookie: `lp_session=${sessionToken}`,
    Origin: 'http://localhost:5173',
  };

  // 3. Authenticated request to /hsa/exams returns 200 and exams
  const examsRes = await fetch(`${baseUrl}/api/diem-thi/hsa/exams`, { headers: authHeaders });
  assert.equal(examsRes.status, 200);
  const examsBody = await examsRes.json();
  assert.ok(Array.isArray(examsBody.data));
  assert.ok(examsBody.data.length >= 5);

  // 4. Invalid score returns 400
  const invalidScoreRes = await fetch(`${baseUrl}/api/diem-thi/hsa/ranking?your_score=999`, { headers: authHeaders });
  assert.equal(invalidScoreRes.status, 400);

  // 5. Valid score returns 200 with rank data
  const validRankRes = await fetch(`${baseUrl}/api/diem-thi/hsa/ranking?your_score=90&exam_id=25`, { headers: authHeaders });
  assert.equal(validRankRes.status, 200);
  const rankBody = await validRankRes.json();
  assert.ok(rankBody.data);
  assert.equal(rankBody.data.diem, 90);
  assert.ok(rankBody.data.tongThiSinh > 0);
  assert.ok(rankBody.data.thuHangTu > 0);
  assert.ok(rankBody.data.tyLePhanTram > 0);
  assert.ok(rankBody.data.image);
  assert.ok(Array.isArray(rankBody.data.phanBoDiem) && rankBody.data.phanBoDiem.length > 0);

  // 6. Image endpoint returns image binary with 200
  const imageRes = await fetch(`${baseUrl}/api/diem-thi/hsa/image/25`, { headers: authHeaders });
  assert.equal(imageRes.status, 200);
  assert.ok(imageRes.headers.get('content-type').startsWith('image/'));
  await imageRes.arrayBuffer();
});
