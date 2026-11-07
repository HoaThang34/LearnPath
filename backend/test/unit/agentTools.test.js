'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-agent-tools-auth-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-agent-tools-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

const { getAuthDb, runSql, lastInsertId } = require('../../src/auth/authDb');
const { getDb } = require('../../src/database/db');
const { saveAcademicScores, saveRubric } = require('../../src/auth/career');
const { saveUserProfile } = require('../../src/auth/userProfile');
const { saveExamScores } = require('../../src/career/examScores');
const {
  tools,
  getToolDefinitions,
  executeTool,
  ToolInputError,
} = require('../../src/agent/tools');

const AUTH_DB = process.env.LEARNPATH_AUTH_DB_PATH;
const MAIN_DB = process.env.LEARNPATH_DB_PATH;

async function setupMainDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE khoi_thi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_khoi TEXT UNIQUE NOT NULL,
      mon_thi TEXT,
      so_truong INTEGER
    );
    CREATE TABLE truong (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT UNIQUE NOT NULL,
      ten_truong TEXT NOT NULL
    );
    CREATE TABLE diem_chuan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT,
      truong TEXT NOT NULL,
      nganh TEXT NOT NULL,
      to_hop_mon TEXT,
      diem_chuan REAL,
      ghi_chu TEXT,
      nam INTEGER,
      phuong_thuc TEXT
    );
    CREATE TABLE de_an_tuyen_sinh (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT,
      ten_truong TEXT,
      noi_dung TEXT,
      nguon TEXT
    );
    CREATE TABLE diem_thi_thptqg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toan REAL, van REAL, ly REAL, hoa REAL, sinh REAL, su REAL, dia REAL, tin_hoc REAL, ngoai_ngu REAL
    );
  `);

  db.run("INSERT INTO khoi_thi (ma_khoi, mon_thi, so_truong) VALUES ('A00', 'Toán, Vật lí, Hóa học', 232)");
  db.run("INSERT INTO truong (ma_truong, ten_truong) VALUES ('BKA', 'Đại học Bách Khoa Hà Nội')");
  db.run(
    `INSERT INTO diem_chuan (ma_truong, truong, nganh, to_hop_mon, diem_chuan, nam, phuong_thuc)
     VALUES ('BKA', 'Đại học Bách Khoa Hà Nội', 'Khoa học máy tính', 'A00', 28.5, 2025, 'Điểm thi THPT')`
  );
  db.run(
    `INSERT INTO de_an_tuyen_sinh (ma_truong, ten_truong, noi_dung)
     VALUES ('BKA', 'Đại học Bách Khoa Hà Nội', '# Đề án tuyển sinh BKA 2026\nChỉ tiêu tuyển sinh 8000 sinh viên.')`
  );

  // 5 candidate rows for ranking
  const candidateScores = [
    [8, 8, 8, 8, 0, 0, 0, 0, 0], // total 32
    [7, 7, 7, 7, 0, 0, 0, 0, 0], // total 28
    [9, 9, 9, 9, 0, 0, 0, 0, 0], // total 36
    [6, 6, 6, 6, 0, 0, 0, 0, 0], // total 24
    [5, 5, 5, 5, 0, 0, 0, 0, 0], // total 20
  ];
  for (const s of candidateScores) {
    db.run(
      'INSERT INTO diem_thi_thptqg (toan, van, ly, hoa, sinh, su, dia, tin_hoc, ngoai_ngu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      s
    );
  }

  fs.writeFileSync(MAIN_DB, Buffer.from(db.export()));
  db.close();
}

function createUser(username) {
  const now = Date.now();
  runSql(
    `INSERT INTO users (username, username_lower, password_hash, created_at, status, updated_at, survey_completed, interest_completed)
     VALUES (?, ?, 'scrypt$dummy', ?, 'active', ?, 1, 1)`,
    [username, username.toLowerCase(), now, now]
  );
  return Number(lastInsertId());
}

test('tools registry definition format', () => {
  const defs = getToolDefinitions();
  assert.ok(defs.length >= 10);
  for (const def of defs) {
    assert.equal(def.type, 'function');
    assert.ok(def.function.name);
    assert.ok(def.function.description);
    assert.equal(typeof def.function.parameters, 'object');
  }
});

test('get_user_overview returns profile status and missing items', async () => {
  await getAuthDb();
  await setupMainDb();
  await getDb();

  const userId = createUser('test_overview_user');
  await saveUserProfile(userId, {
    lop: '12A1',
    to_hop_mong_muon: ['A00'],
    truong_muc_tieu: 'Đại học Bách Khoa Hà Nội',
    nganh_muc_tieu: 'Khoa học máy tính',
  });

  const res = await executeTool('get_user_overview', {}, { userId });
  assert.equal(res.ok, true);
  assert.equal(res.data.lop, '12A1');
  assert.deepEqual(res.data.toHopMongMuon, ['A00']);
  assert.ok(res.data.duLieuConThieu.includes('chua_nhap_diem_hoc_ba'));
  assert.ok(res.data.duLieuConThieu.includes('chua_lam_trac_nghiem_so_thich'));
  assert.ok(res.artifacts.length > 0);
  assert.equal(res.artifacts[0].type, 'links');
});

test('get_academic_scores returns scores and artifact', async () => {
  const userId = createUser('test_academic_user');
  await saveAcademicScores(userId, [
    { subject: 'Toán', term: 'Kỳ 1', classLevel: '12', scoreType: 'average', score: 9.0 },
    { subject: 'Vật lí', term: 'Kỳ 1', classLevel: '12', scoreType: 'average', score: 8.5 },
  ]);

  const res = await executeTool('get_academic_scores', {}, { userId });
  assert.equal(res.ok, true);
  assert.equal(res.data.coDuLieu, true);
  assert.equal(res.data.lop, '12');
  assert.equal(res.data.diem.length, 2);
  assert.equal(res.artifacts.length, 1);
  assert.equal(res.artifacts[0].type, 'academic_scores');
});

test('get_career_recommendations returns recommendations and fit artifacts', async () => {
  const userId = createUser('test_rec_user');
  // Seed sample rubric in authDb
  await saveRubric({
    schoolCode: 'BKA',
    schoolName: 'Đại học Bách Khoa Hà Nội',
    majorName: 'Khoa học máy tính',
    method: 'Điểm thi THPT',
    admissionBlock: 'A00',
    year: 2025,
    majorGroup: 'Máy tính và Công nghệ thông tin',
    entryScore: 28.5,
    subjects: [
      { subject: 'Toán', weight: 0.5, threshold: 8.0 },
      { subject: 'Vật lí', weight: 0.25, threshold: 7.0 },
      { subject: 'Hóa học', weight: 0.25, threshold: 7.0 },
    ],
  });

  await saveExamScores(userId, [{ block: 'A00', score: 27.5 }]);

  const res = await executeTool('get_career_recommendations', { limit: 5 }, { userId });
  assert.equal(res.ok, true);
  assert.ok(res.data.nganh.length > 0);
  assert.equal(res.data.nganh[0].truong, 'Đại học Bách Khoa Hà Nội');
  assert.equal(res.data.nganh[0].diemCuaHocSinh, 27.5);
  // Verify artifacts (fit_ranking and fit_detail)
  assert.ok(res.artifacts.some((a) => a.type === 'fit_ranking'));
  assert.ok(res.artifacts.some((a) => a.type === 'fit_detail'));
});

test('search_diem_chuan finds majors and builds table artifact', async () => {
  const userId = createUser('test_search_user');
  const res = await executeTool('search_diem_chuan', { major: 'Khoa học máy tính' }, { userId });
  assert.equal(res.ok, true);
  assert.equal(res.data.tong, 1);
  assert.equal(res.data.ketQua[0].ma_truong, 'BKA');
  assert.equal(res.artifacts.length, 1);
  assert.equal(res.artifacts[0].type, 'table');
});

test('rank_thpt_score calculates rank on 4 subjects', async () => {
  const userId = createUser('test_rank_user');
  const res = await executeTool(
    'rank_thpt_score',
    { toan: 8, van: 8, electives: { ly: 8, hoa: 8 } },
    { userId }
  );
  assert.equal(res.ok, true);
  assert.equal(res.data.tongDiem, 32);
  assert.ok(res.data.thuHang > 0);
  assert.equal(res.artifacts.length, 2);
  assert.equal(res.artifacts[0].type, 'rank');
});

test('get_de_an_excerpt safely retrieves text without evaluating instructions', async () => {
  const userId = createUser('test_dean_user');
  const res = await executeTool('get_de_an_excerpt', { schoolCode: 'BKA' }, { userId });
  assert.equal(res.ok, true);
  assert.equal(res.data.maTruong, 'BKA');
  assert.ok(res.data.trichDoan.includes('DU_LIEU_DE_AN'));
});

test('tool input validation and error handling', async () => {
  const userId = createUser('test_err_user');
  // Unknown tool
  const unknown = await executeTool('non_existent_tool', {}, { userId });
  assert.equal(unknown.ok, false);
  assert.match(unknown.data.error, /không tồn tại/);

  // Missing required parameter in rank_thpt_score
  const badRank = await executeTool('rank_thpt_score', { toan: 8 }, { userId });
  assert.equal(badRank.ok, false);
  assert.match(badRank.data.error, /Cần/);

  // Invalid JSON argument
  const badJson = await executeTool('get_khoi_thi', '{invalid_json', { userId });
  assert.equal(badJson.ok, false);
  assert.match(badJson.data.error, /JSON/);
});

after(() => {
  fs.rmSync(AUTH_DB, { force: true });
  fs.rmSync(MAIN_DB, { force: true });
});
