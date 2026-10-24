'use strict';

const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(os.tmpdir(), `learnpath-career-unit-${process.pid}-${Date.now()}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCareerFit, validateScoreRows, validateRubric } = require('../../src/auth/career');

test('validates structured academic scores and rejects invalid ranges and duplicates', () => {
  const valid = validateScoreRows([{ subject: 'toan', term: '1', schoolYear: '2025-2026', scoreType: 'average', score: 8.25 }]);
  assert.equal(valid.rows[0].subject, 'Toán');
  assert.equal(valid.rows[0].score, 8.25);
  assert.match(validateScoreRows([{ subject: 'Toán', term: '1', schoolYear: '2025-2026', score: 11 }]).error, /0 đến 10/);
  assert.match(validateScoreRows([
    { subject: 'Toán', term: '1', schoolYear: '2025-2026', score: 8 },
    { subject: 'toan', term: '1', schoolYear: '2025-2026', score: 9 },
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
