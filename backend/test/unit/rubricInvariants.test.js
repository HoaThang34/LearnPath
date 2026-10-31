'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const rubrics = require('../../src/data/edumind_rubrics.json');
const { getBlockSubjects } = require('../../src/career/subjects');

const valid = rubrics.filter((rubric) => rubric.isValid !== false);
const invalid = rubrics.filter((rubric) => rubric.isValid === false);

test('M20: exactly two rubrics are excluded, 143 are computable', () => {
  assert.equal(rubrics.length, 145);
  assert.equal(invalid.length, 2);
  assert.equal(valid.length, 143);
  for (const rubric of invalid) {
    assert.ok(Number(rubric.entryScore) > 30, `${rubric.majorName} must be excluded for entryScore > 30`);
  }
});

test('M-0 A1: every valid rubric has 0 < entryScore <= 30', () => {
  for (const rubric of valid) {
    const entryScore = Number(rubric.entryScore);
    assert.ok(entryScore > 0 && entryScore <= 30, `${rubric.majorName}: ${entryScore}`);
  }
});

test('M-0 A2: every valid rubric has exactly three subjects', () => {
  for (const rubric of valid) {
    assert.equal(rubric.subjects.length, 3, rubric.majorName);
  }
});

test('M-0 A3: every valid rubric has weights summing to 1', () => {
  for (const rubric of valid) {
    const total = rubric.subjects.reduce((sum, row) => sum + Number(row.weight), 0);
    assert.ok(Math.abs(total - 1) <= 0.001, `${rubric.majorName}: ${total}`);
  }
});

test('M-0 B1: every valid rubric subject belongs to its admission block', () => {
  for (const rubric of valid) {
    const subjects = getBlockSubjects(rubric.admissionBlock);
    assert.ok(subjects, `${rubric.majorName}: unknown block ${rubric.admissionBlock}`);
    for (const row of rubric.subjects) {
      assert.ok(subjects.includes(row.subject), `${rubric.majorName}: ${row.subject} not in ${rubric.admissionBlock}`);
    }
  }
});

test('M-0 B2: every valid rubric has sum(threshold) = entryScore', () => {
  for (const rubric of valid) {
    const total = rubric.subjects.reduce((sum, row) => sum + Number(row.threshold), 0);
    assert.ok(
      Math.abs(total - Number(rubric.entryScore)) <= 0.011,
      `${rubric.majorName}: thresholds ${total} vs entryScore ${rubric.entryScore}`
    );
  }
});

test('every rubric block is known to the shared subject map', () => {
  for (const rubric of rubrics) {
    assert.ok(getBlockSubjects(rubric.admissionBlock), `${rubric.admissionBlock} is unknown`);
  }
});

test('the two invalid rubrics are the documented ones', () => {
  const names = invalid.map((rubric) => rubric.majorName).sort();
  assert.deepEqual(names, ['Khoa học Tự nhiên', 'Ngôn ngữ Trung Quốc'].sort());
});
