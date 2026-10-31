'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-career-rec-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-career-rec-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

const { getAuthDb, queryOne, runSql, lastInsertId } = require('../../src/auth/authDb');
const { saveRubric, saveAcademicScores } = require('../../src/auth/career');
const { saveExamScores } = require('../../src/career/examScores');
const { buildRecommendations } = require('../../src/career/recommendations');
const { REASONS } = require('../../src/career/match');

const AUTH_DB = process.env.LEARNPATH_AUTH_DB_PATH;
const MAIN_DB = process.env.LEARNPATH_DB_PATH;

async function createAdmissionFixture() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE diem_thi_thptqg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toan REAL, van REAL, ly REAL, hoa REAL, sinh REAL, su REAL, dia REAL, tin_hoc REAL, ngoai_ngu REAL
    );
  `);
  const rows = [
    [8, 7, 8, 8, null, null, null, null, 7],
    [7, 6, 7, 7, null, null, null, null, 6],
    [9, 8, 9, 9, null, null, null, null, 8],
    [6, 6, 6, 6, null, null, null, null, 6],
    [5, 5, 5, 5, null, null, null, null, 5],
    [8, 8, 8, 8, null, null, null, null, 8],
    [7, 7, 7, 7, null, null, null, null, 7],
    [9, 9, 9, 9, null, null, null, null, 9],
    [4, 4, 4, 4, null, null, null, null, 4],
    [10, 9, 10, 10, null, null, null, null, 9],
  ];
  for (const row of rows) {
    db.run(
      `INSERT INTO diem_thi_thptqg (toan, van, ly, hoa, sinh, su, dia, tin_hoc, ngoai_ngu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row
    );
  }
  fs.writeFileSync(MAIN_DB, Buffer.from(db.export()));
  db.close();
}

function insertUser(username) {
  const now = Date.now();
  runSql(
    `INSERT INTO users (username, username_lower, password_hash, created_at, status, updated_at, survey_completed, interest_completed)
     VALUES (?, ?, 'scrypt$test$hash', ?, 'active', ?, 1, 1)`,
    [username, username.toLowerCase(), now, now]
  );
  return Number(lastInsertId());
}

function insertInterestResult(userId, groups, { complete = true } = {}) {
  const instrument = queryOne("SELECT id FROM interest_instruments WHERE status = 'active'");
  const now = Date.now();
  runSql(
    `INSERT INTO interest_attempts (user_id, instrument_id, status, started_at, last_saved_at, submitted_at)
     VALUES (?, ?, 'submitted', ?, ?, ?)`,
    [userId, instrument.id, now, now, now]
  );
  const attemptId = Number(lastInsertId());
  const get = (code) => groups[code] || 0;
  const answered = (code) => (complete || get(code) > 0 ? 10 : 0);
  runSql(
    `INSERT INTO interest_results
       (attempt_id, user_id, instrument_id, algorithm_version, r, i, a, s, e, c,
        r_answered, i_answered, a_answered, s_answered, e_answered, c_answered,
        d_ei, d_sn, d_tf, d_jp, code, top_groups, ties, completeness, unanswered_count, computed_at)
     VALUES (?, ?, ?, 'holland-pairs/1.0.0', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 12, -12, 0, 24,
             'R-I-A', '["R","I","A"]', '[]', 'full', 0, ?)`,
    [
      attemptId,
      userId,
      instrument.id,
      get('R'),
      get('I'),
      get('A'),
      get('S'),
      get('E'),
      get('C'),
      answered('R'),
      answered('I'),
      answered('A'),
      answered('S'),
      answered('E'),
      answered('C'),
      now,
    ]
  );
}

test('career recommendations use only the current user and expose null reasons', async (t) => {
  await createAdmissionFixture();
  await getAuthDb();

  t.after(() => {
    fs.rmSync(AUTH_DB, { force: true });
    fs.rmSync(MAIN_DB, { force: true });
    const prefix = path.basename(AUTH_DB);
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (name.startsWith(prefix) && (name.endsWith('.tmp') || name.endsWith('.previous'))) {
        fs.rmSync(path.join(os.tmpdir(), name), { force: true });
      }
    }
  });

  await saveRubric({
    schoolCode: 'BKA',
    schoolName: 'ĐHBK Hà Nội',
    majorName: 'Kỹ thuật Điều khiển',
    method: 'Điểm thi THPT',
    admissionBlock: 'A00',
    majorGroup: 'Kỹ thuật - Công nghệ',
    entryScore: 24,
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.4, threshold: 9 },
      { subject: 'Vật lý', weight: 0.3, threshold: 8 },
      { subject: 'Hóa học', weight: 0.3, threshold: 7 },
    ],
  });
  await saveRubric({
    schoolCode: 'KHA',
    schoolName: 'ĐH Kinh tế Quốc dân',
    majorName: 'Kinh tế quốc tế',
    method: 'Điểm thi THPT',
    admissionBlock: 'D01',
    majorGroup: 'Kinh tế - Quản trị',
    entryScore: 22,
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.4, threshold: 8 },
      { subject: 'Ngữ văn', weight: 0.3, threshold: 7 },
      { subject: 'Tiếng Anh', weight: 0.3, threshold: 7 },
    ],
  });
  await saveRubric({
    schoolCode: 'SAT',
    schoolName: 'Trường SAT',
    majorName: 'Ngành SAT',
    method: 'SAT',
    admissionBlock: 'A00',
    majorGroup: 'Kỹ thuật - Công nghệ',
    entryScore: 25,
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.4, threshold: 9 },
      { subject: 'Vật lý', weight: 0.3, threshold: 8 },
      { subject: 'Hóa học', weight: 0.3, threshold: 8 },
    ],
  });

  const userA = insertUser('rec_a');
  await saveExamScores(userA, [{ block: 'A00', score: 24 }]);
  insertInterestResult(userA, { R: 45, I: 40, A: 30, S: 20, E: 15, C: 10 });

  const userB = insertUser('rec_b');
  await saveExamScores(userB, [{ block: 'A00', score: 18 }]);
  insertInterestResult(userB, { R: 10, I: 10, A: 10, S: 10, E: 45, C: 45 });

  const a = await buildRecommendations(userA, {});
  const b = await buildRecommendations(userB, {});
  const aEng = a.data.find((row) => row.majorName === 'Kỹ thuật Điều khiển');
  const bEng = b.data.find((row) => row.majorName === 'Kỹ thuật Điều khiển');

  assert.ok(aEng);
  assert.ok(bEng);
  assert.ok(aEng.hocLucFit > bEng.hocLucFit, 'higher exam total must not lower hocLucFit');
  assert.ok(aEng.tinhCachFit > bEng.tinhCachFit, 'different interest profiles must not leak');
  assert.equal(aEng.matrixCell, 1);
  assert.equal(aEng.reasons.length, 0);

  const sat = a.data.find((row) => row.majorName === 'Ngành SAT');
  assert.ok(sat);
  assert.notEqual(sat.hocLucFit, null);
  assert.equal(sat.pBench, null);
  assert.ok(sat.reasons.includes(REASONS.PHUONG_THUC_KHAC));

  const userC = insertUser('rec_c');
  await saveExamScores(userC, [{ block: 'A00', score: 24 }]);
  insertInterestResult(userC, { R: 45, I: 40, A: 30, S: 20, E: 0, C: 0 }, { complete: false });
  const c = await buildRecommendations(userC, {});
  const cEng = c.data.find((row) => row.majorName === 'Kỹ thuật Điều khiển');
  assert.equal(cEng.tongHopFit, null);
  assert.ok(cEng.reasons.includes(REASONS.CHUA_DU_CAU_TRA_LOI));

  const userD = insertUser('rec_d');
  const d = await buildRecommendations(userD, {});
  const dEng = d.data.find((row) => row.majorName === 'Kỹ thuật Điều khiển');
  assert.equal(dEng.tinhCachFit, null);
  assert.notEqual(dEng.tinhCachFit, 0);
  assert.ok(dEng.reasons.includes(REASONS.CHUA_DU_CAU_TRA_LOI));
  assert.equal(dEng.hocLucFit, null);
  assert.ok(dEng.reasons.includes(REASONS.THIEU_DIEM_THI));

  const userE = insertUser('rec_e');
  await saveAcademicScores(userE, [
    { subject: 'Toán', term: 'Cả năm', classLevel: '12', score: 8, scoreType: 'average' },
    { subject: 'Vật lý', term: 'Cả năm', classLevel: '12', score: 8, scoreType: 'average' },
    { subject: 'Hóa học', term: 'Cả năm', classLevel: '12', score: 8, scoreType: 'average' },
  ]);
  insertInterestResult(userE, { R: 45, I: 40, A: 30, S: 20, E: 15, C: 10 });
  const e = await buildRecommendations(userE, {});
  const eEng = e.data.find((row) => row.majorName === 'Kỹ thuật Điều khiển');
  assert.ok(eEng);
  assert.notEqual(eEng.hocLucFit, null, 'derived tStudent from academic scores should calculate hocLucFit');
  assert.equal(eEng.tStudent, 24);
  assert.equal(eEng.tStudentSource, 'academic_scores');
  assert.notEqual(eEng.tongHopFit, null);
  assert.equal(eEng.reasons.length, 0);
});
