'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-thpt-integration-${process.pid}-${Date.now()}.db`
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

test('THPTQG ranking API validates 4 subjects (Toan, Van + 2 electives) and calculates ranking', async () => {
  // 1. Unauthenticated request to /api/diem-thi/ranking returns 401
  const unauthRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=8&van=8&ly=8&hoa=8`);
  assert.equal(unauthRes.status, 401);

  // 2. Register user for testing
  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify({
      username: 'thpttester',
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

  // 3. Thiếu môn Toán -> 400
  const noToanRes = await fetch(`${baseUrl}/api/diem-thi/ranking?van=8&ly=8&hoa=8`, { headers: authHeaders });
  assert.equal(noToanRes.status, 400);
  const noToanBody = await noToanRes.json();
  assert.match(noToanBody.error, /Toán/i);

  // 4. Điểm Toán ngoài khoảng 0-10 -> 400
  const invalidToanRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=11&van=8&ly=8&hoa=8`, { headers: authHeaders });
  assert.equal(invalidToanRes.status, 400);

  // 5. Thiếu môn Ngữ văn -> 400
  const noVanRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=8&ly=8&hoa=8`, { headers: authHeaders });
  assert.equal(noVanRes.status, 400);
  const noVanBody = await noVanRes.json();
  assert.match(noVanBody.error, /Ngữ văn/i);

  // 6. Chỉ có 1 môn tự chọn -> 400
  const oneElectiveRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=8&van=8&ly=8`, { headers: authHeaders });
  assert.equal(oneElectiveRes.status, 400);
  const oneElectiveBody = await oneElectiveRes.json();
  assert.match(oneElectiveBody.error, /2 môn tự chọn/i);

  // 7. Có 3 môn tự chọn -> 400
  const threeElectivesRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=8&van=8&ly=8&hoa=8&sinh=8`, { headers: authHeaders });
  assert.equal(threeElectivesRes.status, 400);
  const threeElectivesBody = await threeElectivesRes.json();
  assert.match(threeElectivesBody.error, /2 môn tự chọn/i);

  // 8. Điểm môn tự chọn không hợp lệ -> 400
  const invalidElectiveRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=8&van=8&ly=-1&hoa=8`, { headers: authHeaders });
  assert.equal(invalidElectiveRes.status, 400);

  // 9. Đúng 4 môn hợp lệ (Toán, Văn, Lý, Hóa) -> 200
  const validRes = await fetch(`${baseUrl}/api/diem-thi/ranking?toan=8.5&van=7.5&ly=9&hoa=8`, { headers: authHeaders });
  assert.equal(validRes.status, 200);
  const validBody = await validRes.json();
  assert.ok(validBody.data);
  assert.equal(validBody.data.soMon, 4);
  assert.equal(validBody.data.tongDiem, 33);
  assert.deepEqual(validBody.data.monBatBuoc, ['toan', 'van']);
  assert.deepEqual(validBody.data.monTuChon, ['ly', 'hoa']);
  assert.equal(validBody.data.diemNhap.toan, 8.5);
  assert.equal(validBody.data.diemNhap.van, 7.5);
  assert.equal(validBody.data.diemNhap.ly, 9);
  assert.equal(validBody.data.diemNhap.hoa, 8);
  assert.equal(validBody.data.diemNhap.sinh, null);
  assert.ok(validBody.data.thuHang > 0);
  assert.ok(validBody.data.tongThiSinh > 1000000);
  assert.ok(validBody.data.tyLePhanTram > 0);
  assert.equal(validBody.data.phanBoDiem.length, 7);
  assert.equal(validBody.data.phanBoDiem[0].khoang_diem, '35-40');
});
