const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { findPriorityRow, hocLucSubjectFit } = require('../../src/career/hocLuc');
const { groupFit, loadConfig } = require('../../src/career/groupMatch');
const { getRubrics } = require('../../src/auth/career');
const { getAuthDb } = require('../../src/auth/authDb');

test('Requirement 3: Tin học actively participates in Khoa học Máy tính L_m calculation', () => {
  const { row } = findPriorityRow({ majorName: 'Khoa học Máy tính' });
  assert.ok(row, 'Khoa học Máy tính must have a priority row');
  const tinSubject = row.subjects.find((s) => s.subject === 'Tin học');
  assert.ok(tinSubject, 'Khoa học Máy tính must include Tin học');
  assert.equal(tinSubject.r, 4, 'Tin học priority must be 4 (Cốt lõi / Bộ môn chính)');

  // Baseline: Toán=8, Vật lý=8, Tin học=8 -> L = 80
  const baseFit = hocLucSubjectFit({
    row,
    scores: new Map([
      ['Toán', 8],
      ['Vật lý', 8],
      ['Tin học', 8],
    ]),
  });
  assert.equal(baseFit.value, 80);

  // When Tin học changes to 0:
  // With Toán=8 (r=4), Vật lý=8 (r=2), Tin học=0 (r=4) -> priorityTotal=10
  // L = 10 * (4*8 + 2*8 + 4*0)/10 = 10 * 48 / 10 = 48
  const lowTinFit = hocLucSubjectFit({
    row,
    scores: new Map([
      ['Toán', 8],
      ['Vật lý', 8],
      ['Tin học', 0],
    ]),
  });
  assert.equal(lowTinFit.value, 48);
  assert.notEqual(lowTinFit.value, baseFit.value);

  // When Tin học changes to 9.7:
  // L = 10 * (4*8 + 2*8 + 4*9.7)/10 = 10 * (48 + 38.8)/10 = 86.8
  const highTinFit = hocLucSubjectFit({
    row,
    scores: new Map([
      ['Toán', 8],
      ['Vật lý', 8],
      ['Tin học', 9.7],
    ]),
  });
  assert.equal(highTinFit.value, 86.8);
  assert.notEqual(highTinFit.value, baseFit.value);
});

test('Requirement 4: Excluded/invalid rubrics (isValid=false) are excluded from default getRubrics', async () => {
  await getAuthDb();
  const validRubrics = await getRubrics({ includeInvalid: false });
  const allRubrics = await getRubrics({ includeInvalid: true });

  const invalidInDefault = validRubrics.filter(
    (r) => r.majorName === 'Ngôn ngữ Trung Quốc' || r.majorName === 'Khoa học Tự nhiên'
  );
  assert.equal(invalidInDefault.length, 0, 'Invalid rubrics must not appear in default getRubrics');

  const invalidInAll = allRubrics.filter(
    (r) => r.majorName === 'Ngôn ngữ Trung Quốc' || r.majorName === 'Khoa học Tự nhiên'
  );
  assert.ok(invalidInAll.length > 0, 'Invalid rubrics must be present when includeInvalid=true');
  assert.ok(invalidInAll.every((r) => r.isValid === false), 'All excluded rubrics must have isValid === false');
});

test('Requirement 5: All 12 career group AHP weight matrices satisfy CR <= 0.10', () => {
  const RI_3 = 0.58;
  const groupsFile = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'career_group_weights.json'), 'utf8')
  );

  for (const group of groupsFile.groups) {
    const j = group.judgments;
    const a12 = j.hocLucVsHolland;
    const a13 = j.hocLucVsMbti;
    const a23 = j.hollandVsMbti;
    const A = [
      [1, a12, a13],
      [1 / a12, 1, a23],
      [1 / a13, 1 / a23, 1],
    ];
    const w = [group.wHocLuc, group.wHolland, group.wMbti];

    // Compute lambda_max = (1/n) * sum_i ((A*w)_i / w_i)
    const Aw = [
      A[0][0] * w[0] + A[0][1] * w[1] + A[0][2] * w[2],
      A[1][0] * w[0] + A[1][1] * w[1] + A[1][2] * w[2],
      A[2][0] * w[0] + A[2][1] * w[1] + A[2][2] * w[2],
    ];
    const lambdaMax = (Aw[0] / w[0] + Aw[1] / w[1] + Aw[2] / w[2]) / 3;
    const ci = (lambdaMax - 3) / 2;
    const cr = ci / RI_3;

    assert.ok(
      cr <= 0.10,
      `Group ${group.code} (${group.label}) has CR = ${cr.toFixed(4)}, which exceeds threshold 0.10`
    );
  }
});

test('Requirement 6: Provisional ("tam_tinh") Holland status causes groupFit value to be null with thieu_holland', () => {
  // Case A: Full Holland (day_du) -> F is computed
  const fullFit = groupFit({
    majorName: 'Khoa học Máy tính',
    hocLuc: 80,
    holland: 75,
    hollandStatus: 'day_du',
    mbti: 65,
  });
  assert.notEqual(fullFit.value, null, 'Full Holland must produce a non-null groupFit');
  assert.equal(fullFit.missing.includes('H'), false);

  // Case B: Provisional Holland (tam_tinh, e.g. 40% coverage) -> F value is null
  const tamTinhFit = groupFit({
    majorName: 'Khoa học Máy tính',
    hocLuc: 80,
    holland: 75,
    hollandStatus: 'tam_tinh',
    mbti: 65,
  });
  assert.equal(tamTinhFit.value, null, 'tam_tinh Holland must keep groupFit value null');
  assert.ok(tamTinhFit.missing.includes('H'), 'tam_tinh Holland must list H in missing');
  assert.ok(tamTinhFit.reasons.includes('thieu_holland'), 'tam_tinh Holland must have thieu_holland reason');
  assert.notEqual(tamTinhFit.partialValue, null, 'Partial value can still be calculated for tam_tinh');
});

test('Requirement 1: Recommendation sorting prioritizes new groupFit (F) over legacy tongHopFit', () => {
  const { sortRows } = require('../../src/career/recommendations');

  const rowA = {
    majorName: 'Ngành A',
    groupFit: 92.5,
    groupFitPartial: 92.5,
    tongHopFit: 70.0,
    entryScore: 25,
  };
  const rowB = {
    majorName: 'Ngành B',
    groupFit: 78.0,
    groupFitPartial: 78.0,
    tongHopFit: 88.0,
    entryScore: 26,
  };

  // Under legacy sorting (using tongHopFit only), Ngành B (88) would come before Ngành A (70).
  // Under new sorting (using getOverallFit -> groupFit), Ngành A (92.5) must come before Ngành B (78).
  const sortedDefault = sortRows([rowB, rowA], 'tongHop_desc');
  assert.equal(sortedDefault[0].majorName, 'Ngành A', 'tongHop_desc must sort by groupFit when available');

  const sortedExplicit = sortRows([rowB, rowA], 'groupFit_desc');
  assert.equal(sortedExplicit[0].majorName, 'Ngành A', 'groupFit_desc must sort by groupFit');

  // When groupFit is null but groupFitPartial exists:
  const rowC = {
    majorName: 'Ngành C',
    groupFit: null,
    groupFitPartial: 95.0,
    tongHopFit: 60.0,
    entryScore: 24,
  };
  const sortedPartial = sortRows([rowB, rowC], 'tongHop_desc');
  assert.equal(sortedPartial[0].majorName, 'Ngành C', 'tongHop_desc must prioritize groupFitPartial over legacy tongHopFit');
});
