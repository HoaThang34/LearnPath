'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-groupfit-auth-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-groupfit-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

const { getAuthDb, queryOne, runSql, lastInsertId } = require('../../src/auth/authDb');
const { saveRubric, saveAcademicScores } = require('../../src/auth/career');
const { saveExamScores } = require('../../src/career/examScores');
const { buildRecommendations } = require('../../src/career/recommendations');

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
  for (const total of [15, 18, 21, 24, 27]) {
    const part = total / 3;
    db.run(
      `INSERT INTO diem_thi_thptqg (toan, van, ly, hoa, sinh, su, dia, tin_hoc, ngoai_ngu)
       VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      [part, part, part]
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

function insertInterestResult(userId) {
  const instrument = queryOne("SELECT id FROM interest_instruments WHERE status = 'active'");
  const now = Date.now();
  runSql(
    `INSERT INTO interest_attempts (user_id, instrument_id, status, started_at, last_saved_at, submitted_at)
     VALUES (?, ?, 'submitted', ?, ?, ?)`,
    [userId, instrument.id, now, now, now]
  );
  const attemptId = Number(lastInsertId());
  runSql(
    `INSERT INTO interest_results
       (attempt_id, user_id, instrument_id, algorithm_version, r, i, a, s, e, c,
        r_answered, i_answered, a_answered, s_answered, e_answered, c_answered,
        d_ei, d_sn, d_tf, d_jp, code, top_groups, ties, completeness, unanswered_count, computed_at)
     VALUES (?, ?, ?, 'holland-pairs/1.0.0', 42, 38, 20, 15, 12, 10,
             10, 10, 10, 10, 10, 10, 12, -6, 0, 18, 'R-I-A', '["R","I","A"]', '[]', 'full', 0, ?)`,
    [attemptId, userId, instrument.id, now]
  );
}

test('G1: a mapped major gets L from subject priorities, H from RIASEC, and M = null with a reason', async (t) => {
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

  // The real priority row for this major is D01 with r = Toán 4, Ngữ văn 3, Tiếng Anh 3.
  await saveRubric({
    schoolCode: 'BKA',
    schoolName: 'ĐHBK Hà Nội',
    majorName: 'Kỹ thuật Phần mềm',
    method: 'Điểm thi THPT',
    admissionBlock: 'D01',
    majorGroup: 'Kỹ thuật - Công nghệ',
    entryScore: 21,
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.4, threshold: 8 },
      { subject: 'Ngữ văn', weight: 0.3, threshold: 7 },
      { subject: 'Tiếng Anh', weight: 0.3, threshold: 7 },
    ],
  });

  const userId = insertUser('groupfit_a');
  await saveAcademicScores(userId, [
    { subject: 'Toán', term: 'Cả năm', classLevel: '12', score: 8.5, scoreType: 'average' },
    { subject: 'Ngữ văn', term: 'Cả năm', classLevel: '12', score: 7.5, scoreType: 'average' },
    { subject: 'Tiếng Anh', term: 'Cả năm', classLevel: '12', score: 9, scoreType: 'average' },
  ]);
  await saveExamScores(userId, [{ block: 'D01', score: 25 }]);
  insertInterestResult(userId);

  const result = await buildRecommendations(userId, {});
  const row = result.data.find((entry) => entry.majorName === 'Kỹ thuật Phần mềm');
  assert.ok(row);

  // L = 10 × (0.4·8.5 + 0.3·7.5 + 0.3·9) = 83.5
  assert.equal(row.hocLucIndex, 83.5);
  assert.equal(row.hocLucIndexCoverage, 100);
  // The real priority row for this major has no school code, so the lookup
  // matches by major name rather than by the full school key.
  assert.ok(['exact', 'major'].includes(row.hocLucIndexSource), row.hocLucIndexSource);
  assert.deepEqual(
    row.hocLucIndexWeights.map((weight) => `${weight.subject}:${weight.r}:${weight.a}`),
    ['Toán:4:0.4', 'Ngữ văn:3:0.3', 'Tiếng Anh:3:0.3']
  );

  // H reuses tinhCachFit.
  assert.equal(row.hollandIndex, row.tinhCachFit);
  assert.ok(row.hollandIndex > 0);

  // The MBTI profile is deliberately absent, so M is null with a reason.
  assert.equal(row.mbtiIndex, null);
  assert.equal(row.mbtiStatus, 'chua_xac_dinh');
  assert.equal(result.mbti.determined, false);
  // All four pairs have a D, so the only missing piece is the c/t profile.
  assert.deepEqual(result.mbti.reasons, ['thieu_ho_so_mbti']);
  assert.equal(result.mbti.axes.length, 4);
  assert.ok(result.mbti.axes.every((axis) => axis.d !== null));

  // F is null, with a labelled partial value and the exact CNTT weights.
  assert.equal(row.groupCode, 'cntt');
  assert.equal(row.groupLabel, 'CNTT – dữ liệu – AI');
  assert.equal(row.groupFit, null);
  assert.deepEqual(row.groupFitMissing, ['M']);
  assert.deepEqual(row.groupReasons, ['thieu_mbti']);
  const expectedPartial = Math.round(
    ((0.54994561 * row.hocLucIndex + 0.24021087 * row.hollandIndex) / (0.54994561 + 0.24021087)) * 10
  ) / 10;
  assert.equal(row.groupFitPartial, expectedPartial);
  assert.equal(row.groupFitCoverage, 0.7902);
  assert.deepEqual(
    row.groupFitContributions.map((entry) => entry.component),
    ['L', 'H', 'M']
  );
  assert.equal(row.groupFitContributions[2].value, null);
  assert.equal(row.groupFitContributions[2].contribution, null);

  // The legacy contract is untouched: a fully-scored rubric has no reasons.
  assert.deepEqual(row.reasons, []);
  assert.notEqual(row.hocLucFit, null);
  assert.notEqual(row.tongHopFit, null);
});
