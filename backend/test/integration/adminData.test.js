'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-admin-data-auth-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-admin-data-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const initSqlJs = require('sql.js');

const adminRoutes = require('../../src/routes/admin');
const { createAdmin } = require('../../src/auth/adminAuth');
const { getDb, queryOne, runSql, reloadDb } = require('../../src/database/db');
const { writeAdmission, BACKUP_DIR, getWriteState } = require('../../src/admin/admissionWrite');

const AUTH_DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;
const ADMISSION_DB_PATH = process.env.LEARNPATH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use('/api/admin', adminRoutes);
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
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
    headers.Cookie = `lp_admin_session=${options.cookie}`;
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

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function createAdmissionFixture() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE khoi_thi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_khoi TEXT UNIQUE NOT NULL,
      mon_thi TEXT,
      so_truong INTEGER DEFAULT 0
    );
  `);
  db.run(`
    CREATE TABLE truong (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT UNIQUE NOT NULL,
      ten_truong TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE diem_chuan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT,
      truong TEXT NOT NULL,
      nganh TEXT NOT NULL,
      to_hop_mon TEXT,
      diem_chuan REAL,
      ghi_chu TEXT,
      nam INTEGER DEFAULT 2025,
      phuong_thuc TEXT
    );
  `);
  db.run(`
    CREATE TABLE diem_thi_thptqg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sbd TEXT UNIQUE,
      tinh TEXT,
      toan REAL, van REAL, ly REAL, hoa REAL, sinh REAL,
      su REAL, dia REAL, gd_kt_pl TEXT,
      tin_hoc REAL, cong_nghe REAL, ngoai_ngu REAL
    );
  `);
  db.run(`
    CREATE TABLE de_an_tuyen_sinh (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT,
      ten_truong TEXT,
      noi_dung TEXT,
      nguon TEXT
    );
  `);

  db.run("INSERT INTO khoi_thi (ma_khoi, mon_thi, so_truong) VALUES ('A00', 'Toán, Lý, Hóa', 100)");
  db.run("INSERT INTO khoi_thi (ma_khoi, mon_thi, so_truong) VALUES ('B00', 'Toán, Hóa, Sinh', 80)");
  db.run("INSERT INTO truong (ma_truong, ten_truong) VALUES ('BKA', 'Đại học Bách khoa Hà Nội')");
  db.run("INSERT INTO truong (ma_truong, ten_truong) VALUES ('XYZ', 'Trường XYZ')");
  db.run(
    "INSERT INTO diem_chuan (ma_truong, truong, nganh, to_hop_mon, diem_chuan, nam, phuong_thuc) VALUES ('BKA', 'Đại học Bách khoa Hà Nội', 'Khoa học máy tính', 'A00', 27.5, 2025, 'THPT')"
  );
  db.run(
    "INSERT INTO diem_chuan (ma_truong, truong, nganh, to_hop_mon, diem_chuan, nam, phuong_thuc) VALUES ('ORPHAN', 'Trường không tồn tại', 'Ngành X', 'A01', 20, 2024, 'THPT')"
  );
  db.run(
    "INSERT INTO diem_thi_thptqg (sbd, tinh, toan, van, ly, hoa, sinh, ngoai_ngu) VALUES ('01000001', 'Hà Nội', 9, 8, 8.5, 7, 6, 9.5)"
  );
  db.run(
    "INSERT INTO de_an_tuyen_sinh (ma_truong, ten_truong, noi_dung, nguon) VALUES ('BKA', 'Đại học Bách khoa Hà Nội', '# Đề án BKA\nNội dung đầy đủ.', 'https://example.test/bka')"
  );

  fs.writeFileSync(ADMISSION_DB_PATH, Buffer.from(db.export()));
  db.close();
}

test('admin data API integration', async (t) => {
  const state = {
    adminUsername: `admin_data_${Date.now()}`,
    adminPassword: 'MatKhauAdmin123',
    cookie: null,
    csrf: null,
  };

  t.before(async () => {
    await createAdmissionFixture();
    await createAdmin({
      username: state.adminUsername,
      password: state.adminPassword,
    });

    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const login = await request('/api/admin/auth/login', {
      method: 'POST',
      body: { username: state.adminUsername, password: state.adminPassword },
    });
    assert.equal(login.response.status, 200);
    state.cookie = readCookie(login.response, 'lp_admin_session');
    state.csrf = login.data.data.csrfToken;
  });

  t.after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }

    for (const filePath of [AUTH_DB_PATH, ADMISSION_DB_PATH]) {
      fs.rmSync(filePath, { force: true });
      const directory = path.dirname(filePath);
      const prefix = path.basename(filePath);
      for (const name of fs.readdirSync(directory)) {
        if (name.startsWith(prefix)) {
          fs.rmSync(path.join(directory, name), { force: true });
        }
      }
    }
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  });

  await t.test('returns metadata for exactly five admission tables', async () => {
    const result = await request('/api/admin/data/tables', { cookie: state.cookie });
    assert.equal(result.response.status, 200);
    assert.deepEqual(
      result.data.data.map((table) => table.table).sort(),
      ['de_an_tuyen_sinh', 'diem_chuan', 'diem_thi_thptqg', 'khoi_thi', 'truong']
    );
  });

  await t.test('returns an overview with integrity and write state', async () => {
    const result = await request('/api/admin/overview', { cookie: state.cookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.data.database.integrity, 'ok');
    assert.equal(result.data.data.database.writeBlocked, false);
    assert.equal(result.data.data.users.total >= 0, true);
    assert.ok(result.data.data.database.size > 0);
    assert.equal(result.data.data.tables.length, 5);
  });

  await t.test('lists, searches and paginates rows', async () => {
    const list = await request('/api/admin/data/diem_chuan?limit=1&page=1', {
      cookie: state.cookie,
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.total, 2);
    assert.equal(list.data.data.length, 1);
    assert.equal(list.data.limit, 1);

    const search = await request('/api/admin/data/diem_chuan?search=BKA', {
      cookie: state.cookie,
    });
    assert.equal(search.data.total, 1);
    assert.equal(search.data.data[0].ma_truong, 'BKA');

    const injection = await request(
      "/api/admin/data/diem_chuan?search=%27%20OR%201%3D1%20--",
      { cookie: state.cookie }
    );
    assert.equal(injection.response.status, 200);
    assert.equal(injection.data.total, 0);

    const badSort = await request('/api/admin/data/diem_chuan?sort=id%3B%20DROP%20TABLE', {
      cookie: state.cookie,
    });
    assert.equal(badSort.response.status, 200);
    assert.equal(badSort.data.total, 2);
  });

  await t.test('omits large proposal content from lists and returns it in detail', async () => {
    const list = await request('/api/admin/data/de_an_tuyen_sinh', { cookie: state.cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.data[0].noi_dung, undefined);
    assert.match(list.data.data[0].noi_dung_preview, /Đề án BKA/);

    const detail = await request('/api/admin/data/de_an_tuyen_sinh/1', {
      cookie: state.cookie,
    });
    assert.equal(detail.response.status, 200);
    assert.match(detail.data.data.noi_dung, /Nội dung đầy đủ/);
  });

  await t.test('creates, validates and rejects duplicates', async () => {
    const missingRequired = await request('/api/admin/data/khoi_thi', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { mon_thi: 'Thiếu mã' },
    });
    assert.equal(missingRequired.response.status, 400);

    const unknownColumn = await request('/api/admin/data/khoi_thi', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { ma_khoi: 'C00', mon_thi: 'Văn, Sử, Địa', unknown: 1 },
    });
    assert.equal(unknownColumn.response.status, 400);

    const created = await request('/api/admin/data/khoi_thi', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { ma_khoi: 'C00', mon_thi: 'Văn, Sử, Địa', so_truong: 50 },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.data.ma_khoi, 'C00');
    assert.equal(created.data.data.so_truong, 50);

    const duplicate = await request('/api/admin/data/khoi_thi', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { ma_khoi: 'C00', mon_thi: 'Trùng' },
    });
    assert.equal(duplicate.response.status, 409);
  });

  await t.test('updates and deletes a row', async () => {
    const updated = await request('/api/admin/data/khoi_thi/3', {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { mon_thi: 'Văn, Sử, Địa lí', so_truong: 55 },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.data.mon_thi, 'Văn, Sử, Địa lí');
    assert.equal(updated.data.data.so_truong, 55);

    const deleted = await request('/api/admin/data/khoi_thi/3', {
      method: 'DELETE',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { confirm: true },
    });
    assert.equal(deleted.response.status, 204);

    const detail = await request('/api/admin/data/khoi_thi/3', { cookie: state.cookie });
    assert.equal(detail.response.status, 404);
  });

  await t.test('updates admission proposal (chỉnh sửa đề án tuyển sinh)', async () => {
    const updated = await request('/api/admin/data/de_an_tuyen_sinh/1', {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        noi_dung: '# Đề án BKA 2026 (Đã cập nhật)\nNội dung chi tiết được chỉnh sửa bởi quản trị viên.',
        nguon: 'https://ts.hust.edu.vn/de-an-2026',
      },
    });
    assert.equal(updated.response.status, 200);
    assert.match(updated.data.data.noi_dung, /Đã cập nhật/);
    assert.equal(updated.data.data.nguon, 'https://ts.hust.edu.vn/de-an-2026');

    const detail = await request('/api/admin/data/de_an_tuyen_sinh/1', {
      cookie: state.cookie,
    });
    assert.equal(detail.response.status, 200);
    assert.match(detail.data.data.noi_dung, /chỉnh sửa bởi quản trị viên/);
  });

  await t.test('updates benchmark score (chỉnh sửa điểm chuẩn)', async () => {
    const updated = await request('/api/admin/data/diem_chuan/1', {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        diem_chuan: 28.65,
        ghi_chu: 'Tiêu chí phụ: Điểm Toán >= 9.2',
        nam: 2026,
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.data.diem_chuan, 28.65);
    assert.equal(updated.data.data.ghi_chu, 'Tiêu chí phụ: Điểm Toán >= 9.2');
    assert.equal(updated.data.data.nam, 2026);

    const detail = await request('/api/admin/data/diem_chuan/1', {
      cookie: state.cookie,
    });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.data.data.diem_chuan, 28.65);
  });

  await t.test('manually creates new proposal and benchmark score (thêm dữ liệu mới thủ công)', async () => {
    const newProposal = await request('/api/admin/data/de_an_tuyen_sinh', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        ma_truong: 'XYZ',
        ten_truong: 'Trường XYZ',
        noi_dung: '# Đề án tuyển sinh Trường XYZ\nNội dung tuyển sinh mới được thêm thủ công.',
        nguon: 'https://xyz.edu.vn/tuyensinh',
      },
    });
    assert.equal(newProposal.response.status, 201);
    assert.equal(newProposal.data.data.ma_truong, 'XYZ');
    assert.match(newProposal.data.data.noi_dung, /thêm thủ công/);

    const newScore = await request('/api/admin/data/diem_chuan', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        ma_truong: 'XYZ',
        truong: 'Trường XYZ',
        nganh: 'Kỹ thuật Phần mềm',
        to_hop_mon: 'A00',
        diem_chuan: 26.5,
        ghi_chu: 'Chỉ tiêu 120',
        nam: 2026,
        phuong_thuc: 'THPT',
      },
    });
    assert.equal(newScore.response.status, 201);
    assert.equal(newScore.data.data.ma_truong, 'XYZ');
    assert.equal(newScore.data.data.nganh, 'Kỹ thuật Phần mềm');
    assert.equal(newScore.data.data.diem_chuan, 26.5);
  });

  await t.test('blocks a school code change with dependencies and allows an explicit force update', async () => {
    const school = await request('/api/admin/data/truong', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { ma_truong: 'UPD', ten_truong: 'Trường cần đổi mã' },
    });
    assert.equal(school.response.status, 201);

    const score = await request('/api/admin/data/diem_chuan', {
      method: 'POST',
      cookie: state.cookie,
      csrf: state.csrf,
      body: {
        ma_truong: 'UPD',
        truong: 'Trường cần đổi mã',
        nganh: 'Ngành thử nghiệm',
        nam: 2025,
      },
    });
    assert.equal(score.response.status, 201);

    const blocked = await request(`/api/admin/data/truong/${school.data.data.id}`, {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { ma_truong: 'UPD2' },
    });
    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.data.code, 'DEPENDENCIES_EXIST');

    const forced = await request(`/api/admin/data/truong/${school.data.data.id}`, {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { ma_truong: 'UPD2', force: true },
    });
    assert.equal(forced.response.status, 200);
    assert.equal(forced.data.data.ma_truong, 'UPD2');

    const orphan = await request('/api/admin/data/diem_chuan?search=UPD', {
      cookie: state.cookie,
    });
    assert.equal(orphan.data.total, 1);
    assert.equal(orphan.data.data[0].ma_truong, 'UPD');
  });

  await t.test('blocks deleting a referenced school and allows an explicit force delete', async () => {
    const blocked = await request('/api/admin/data/truong/1', {
      method: 'DELETE',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { confirm: true },
    });
    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.data.code, 'DEPENDENCIES_EXIST');
    assert.match(blocked.data.error, /tham chiếu/i);

    const forced = await request('/api/admin/data/truong/1', {
      method: 'DELETE',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { confirm: true, force: true },
    });
    assert.equal(forced.response.status, 204);

    const details = await request('/api/admin/data/diem_chuan?search=BKA', {
      cookie: state.cookie,
    });
    assert.equal(details.data.total, 1, 'related score rows must remain as orphans');
    assert.match(details.data.data[0].ma_truong, /BKA/);
  });

  await t.test('rolls back a failed transaction without changing the file', async () => {
    await getDb();
    const before = hashFile(ADMISSION_DB_PATH);

    await assert.rejects(
      writeAdmission(() => {
        runSql("INSERT INTO khoi_thi (ma_khoi, mon_thi) VALUES ('ROLLBACK', 'x')");
        throw new Error('forced failure');
      }),
      /forced failure/
    );

    const row = queryOne("SELECT id FROM khoi_thi WHERE ma_khoi = 'ROLLBACK'");
    assert.equal(row, null);
    assert.equal(hashFile(ADMISSION_DB_PATH), before);

    const db = await getDb();
    const check = db.exec('PRAGMA quick_check');
    assert.equal(check[0].values[0][0], 'ok');
  });

  await t.test('rejects a body larger than the admin limit', async () => {
    const oversized = await request('/api/admin/data/de_an_tuyen_sinh/1', {
      method: 'PATCH',
      cookie: state.cookie,
      csrf: state.csrf,
      body: { noi_dung: 'a'.repeat(2 * 1024 * 1024 + 100) },
    });
    assert.equal(oversized.response.status, 413);
  });

  await t.test('persists data atomically and records audit entries', async () => {
    const diskHash = hashFile(ADMISSION_DB_PATH);
    assert.ok(diskHash);

    const SQL = await initSqlJs();
    const disk = new SQL.Database(fs.readFileSync(ADMISSION_DB_PATH));
    try {
      const check = disk.exec('PRAGMA quick_check');
      assert.equal(check[0].values[0][0], 'ok');
      const created = disk.exec("SELECT ma_khoi FROM khoi_thi WHERE ma_khoi = 'C00'");
      assert.equal(created.length, 0, 'the deleted row must stay deleted on disk');
    } finally {
      disk.close();
    }

    const backups = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR) : [];
    assert.ok(backups.length >= 1, 'a backup should exist after the first write');
    assert.ok(backups.length <= 5);

    const writeState = getWriteState();
    assert.equal(writeState.blocked, false);
    assert.ok(writeState.lastWriteAt);

    const audit = await request('/api/admin/audit?limit=100', { cookie: state.cookie });
    assert.equal(audit.response.status, 200);
    const actions = audit.data.data.map((entry) => entry.action);
    assert.ok(actions.includes('admin.data.create'));
    assert.ok(actions.includes('admin.data.update'));
    assert.ok(actions.includes('admin.data.force_delete'));

    await reloadDb();
  });
});
