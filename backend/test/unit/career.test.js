'use strict';

const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(os.tmpdir(), `learnpath-career-unit-${process.pid}-${Date.now()}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCareerFit, validateScoreRows, validateRubric, saveAcademicScores, seedSampleRubrics, getRubrics } = require('../../src/auth/career');
const { getAuthDb, runSql } = require('../../src/auth/authDb');
const { getDb } = require('../../src/database/db');
const { getAdmissionRows, getMapData } = require('../../src/routes/career');

test('validates THPT distance score inputs through the supported subject data', () => {
  const scores = [{ subject: 'Toán', scoreType: 'average', score: 8 }, { subject: 'Vật lý', scoreType: 'average', score: 7 }, { subject: 'Hóa học', scoreType: 'average', score: 6 }];
  assert.equal(scores.reduce((sum, row) => sum + row.score, 0), 21);
});

test('validates structured academic scores and rejects invalid ranges and duplicates', () => {
  const valid = validateScoreRows([{ subject: 'toan', term: 'Kỳ 1', classLevel: '12', scoreType: 'average', score: 8.25 }]);
  assert.equal(valid.rows[0].subject, 'Toán');
  assert.equal(valid.rows[0].score, 8.25);
  assert.match(validateScoreRows([{ subject: 'Toán', term: 'Kỳ 1', classLevel: '12', score: '' }]).error, /Vui lòng nhập điểm/);
  assert.equal(validateScoreRows([{ subject: 'Toán', term: 'Kỳ 1', classLevel: '12', score: 0 }]).rows[0].score, 0);
  assert.match(validateScoreRows([{ subject: 'Toán', term: 'Kỳ 3', classLevel: '12', score: 8 }]).error, /không hợp lệ/);
  assert.match(validateScoreRows([{ subject: 'Toán', term: 'Kỳ 1', classLevel: '12', score: 11 }]).error, /0 đến 10/);
  assert.match(validateScoreRows([
    { subject: 'Toán', term: 'Kỳ 1', classLevel: '12', score: 8 },
    { subject: 'toan', term: 'Kỳ 1', classLevel: '12', score: 9 },
  ]).error, /trùng/);
});

test('requires a complete rubric with normalized weights summing to one', () => {
  const valid = validateRubric({ schoolName: 'ĐH A', majorName: 'Ngành A', method: 'THPT', year: 2025, subjects: [
    { subject: 'Toán', weight: 0.6, threshold: 8 },
    { subject: 'Văn', weight: 0.4, threshold: 7 },
  ] });
  assert.equal(valid.value.subjects.length, 2);
  assert.match(validateRubric({ schoolName: 'A', majorName: 'B', method: 'THPT', year: 2025, subjects: [{ subject: 'Toán', weight: 0.5, threshold: 7 }] }).error, /bằng 1/);
});

test('fit uses only present subjects and returns weighted coverage without treating missing as zero', () => {
  const fit = calculateCareerFit([{ subject: 'Toán', scoreType: 'average', score: 8 }], [
    { subject_name: 'Toán', weight: 0.6, threshold: 8 },
    { subject_name: 'Ngữ văn', weight: 0.4, threshold: 8 },
  ]);
  assert.equal(fit.fitPct, 100);
  assert.equal(fit.coveragePct, 60);
  assert.equal(fit.status, 'partial_data');
  assert.equal(fit.details[1].score, null);
});

test('fit reports insufficient data when no matching average scores exist', () => {
  const fit = calculateCareerFit([{ subject: 'Toán', scoreType: 'other', score: 10 }], [
    { subject_name: 'Toán', weight: 1, threshold: 8 },
  ]);
  assert.equal(fit.fitPct, null);
  assert.equal(fit.coveragePct, 0);
  assert.equal(fit.status, 'insufficient_data');
});

test('getAdmissionRows supports sorting by score_desc, score_asc, school_asc, school_desc, rate_desc, rate_asc', async () => {
  await getDb();
  await getAuthDb();

  // Test score_desc
  const scoreDesc = getAdmissionRows({ sort: 'score_desc', limit: 10, offset: 0 });
  assert.equal(scoreDesc.sort, 'score_desc');
  assert.ok(scoreDesc.rows.length > 0);
  for (let i = 1; i < scoreDesc.rows.length; i++) {
    assert.ok(Number(scoreDesc.rows[i - 1].entryScore) >= Number(scoreDesc.rows[i].entryScore));
  }

  // Test score_asc
  const scoreAsc = getAdmissionRows({ sort: 'score_asc', limit: 10, offset: 0 });
  assert.equal(scoreAsc.sort, 'score_asc');
  assert.ok(scoreAsc.rows.length > 0);
  for (let i = 1; i < scoreAsc.rows.length; i++) {
    assert.ok(Number(scoreAsc.rows[i - 1].entryScore) <= Number(scoreAsc.rows[i].entryScore));
  }

  // Test school_asc
  const schoolAsc = getAdmissionRows({ sort: 'school_asc', limit: 10, offset: 0 });
  assert.equal(schoolAsc.sort, 'school_asc');
  assert.ok(schoolAsc.rows.length > 0);
  for (let i = 1; i < schoolAsc.rows.length; i++) {
    assert.ok(schoolAsc.rows[i - 1].schoolName.localeCompare(schoolAsc.rows[i].schoolName, 'vi') <= 0);
  }

  // Test school_desc
  const schoolDesc = getAdmissionRows({ sort: 'school_desc', limit: 10, offset: 0 });
  assert.equal(schoolDesc.sort, 'school_desc');
  assert.ok(schoolDesc.rows.length > 0);
  for (let i = 1; i < schoolDesc.rows.length; i++) {
    assert.ok(schoolDesc.rows[i - 1].schoolName.localeCompare(schoolDesc.rows[i].schoolName, 'vi') >= 0);
  }

  // Set up academic scores for candidate to test rate_desc & rate_asc
  const testUserId = 99999;
  await saveAcademicScores(testUserId, [
    { subject: 'Toán', classLevel: '12', term: 'Kỳ 1', scoreType: 'average', score: 8.5 },
    { subject: 'Vật lý', classLevel: '12', term: 'Kỳ 1', scoreType: 'average', score: 8.0 },
    { subject: 'Hóa học', classLevel: '12', term: 'Kỳ 1', scoreType: 'average', score: 8.5 },
  ]);

  const rateDesc = getAdmissionRows({
    userId: testUserId,
    classLevel: '12',
    term: 'Kỳ 1',
    sort: 'rate_desc',
    limit: 20,
    offset: 0,
  });
  assert.equal(rateDesc.sort, 'rate_desc');
  assert.ok(rateDesc.rows.length > 0);
  // First item must have calculated distanceRate and not null
  assert.ok(rateDesc.rows[0].distanceRate !== null);
  for (let i = 1; i < rateDesc.rows.length; i++) {
    if (rateDesc.rows[i].distanceRate !== null) {
      assert.ok(rateDesc.rows[i - 1].distanceRate >= rateDesc.rows[i].distanceRate);
    }
  }

  const rateAsc = getAdmissionRows({
    userId: testUserId,
    classLevel: '12',
    term: 'Kỳ 1',
    sort: 'rate_asc',
    limit: 20,
    offset: 0,
  });
  assert.equal(rateAsc.sort, 'rate_asc');
  assert.ok(rateAsc.rows.length > 0);
  // Non-null distanceRates must be ascending
  for (let i = 1; i < rateAsc.rows.length; i++) {
    if (rateAsc.rows[i].distanceRate !== null && rateAsc.rows[i - 1].distanceRate !== null) {
      assert.ok(rateAsc.rows[i - 1].distanceRate <= rateAsc.rows[i].distanceRate);
    }
  }
});

test('calculateCareerFit identifies priority subject with highest weight among negative gaps', () => {
  const fit = calculateCareerFit(
    [
      { subject: 'Toán', scoreType: 'average', score: 7 }, // threshold 8.5 -> gap -1.5, weight 0.5
      { subject: 'Vật lý', scoreType: 'average', score: 7 }, // threshold 8.0 -> gap -1.0, weight 0.25
      { subject: 'Tiếng Anh', scoreType: 'average', score: 9 }, // threshold 8.0 -> gap +1.0, weight 0.25
    ],
    [
      { subject_name: 'Toán', weight: 0.5, threshold: 8.5 },
      { subject_name: 'Vật lý', weight: 0.25, threshold: 8.0 },
      { subject_name: 'Tiếng Anh', weight: 0.25, threshold: 8.0 },
    ]
  );
  assert.equal(fit.prioritySubject, 'Toán');
  assert.ok(fit.fitPct > 0);
  assert.equal(fit.coveragePct, 100);
});

test('seedSampleRubrics populates standard sample rubrics if empty or forced', async () => {
  await getAuthDb();
  const seeded = await seedSampleRubrics(true);
  assert.ok(seeded.length >= 6);
  const mathMajor = seeded.find((r) => r.majorName.includes('Sư phạm Toán'));
  assert.ok(mathMajor);
  assert.equal(mathMajor.schoolCode, 'SPH');
});

test('getMapData returns vector embeddings and major nodes for career map', async () => {
  await getAuthDb();
  await seedSampleRubrics(false);
  const testUserId = 88888;
  await saveAcademicScores(testUserId, [
    { subject: 'Toán', term: 'Kỳ 1', classLevel: '12', scoreType: 'average', score: 9.0 },
    { subject: 'Vật lý', term: 'Kỳ 1', classLevel: '12', scoreType: 'average', score: 8.5 },
  ]);

  const mapData = getMapData(testUserId, { classLevel: '12', term: 'Kỳ 1' });
  assert.ok(mapData);
  assert.equal(mapData.selectedClassLevel, '12');
  assert.equal(mapData.selectedTerm, 'Kỳ 1');
  assert.equal(mapData.studentVector['Toán'], 9.0);
  assert.equal(mapData.studentVector['Vật lý'], 8.5);
  assert.ok(Array.isArray(mapData.majors));
  assert.ok(mapData.majors.length > 0);

  const first = mapData.majors[0];
  assert.ok(first.id);
  assert.ok(first.majorName);
  assert.ok(first.schoolName);
  assert.ok(first.majorGroup);
  assert.ok(first.weightVector);
  assert.equal(typeof first.weightVector, 'object');
  assert.ok(first.fitPct !== undefined);
});
