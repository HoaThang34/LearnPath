'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-career-match-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDistribution,
  P,
  pBench,
  percentile,
  zScore,
  buildBenchmark,
  tinhCachFit,
  hocLucFit,
  tongHopFit,
  matrixCell,
  getWeightsMap,
  getComboStats,
  DEFAULT_CONFIG,
  REASONS,
} = require('../../src/career/match');
const { getAuthDb } = require('../../src/auth/authDb');
const { calculateCareerFit } = require('../../src/auth/career');
const rubrics = require('../../src/data/edumind_rubrics.json');

const A00_ROWS = [
  { toan: 8, ly: 8, hoa: 8 },
  { toan: 7, ly: 7, hoa: 7 },
  { toan: 9, ly: 9, hoa: 9 },
  { toan: 6, ly: 6, hoa: 6 },
  { toan: 8, ly: 8, hoa: null },
];

function groupsFromSums(sums, statuses = {}) {
  return Object.entries(sums).map(([code, sum]) => ({
    code,
    sum,
    answered: 10,
    status: statuses[code] || 'complete',
  }));
}

const KY_THUAT = { wR: 0.35, wI: 0.35, wA: 0.05, wS: 0.03, wE: 0.07, wC: 0.15 };
const NGHE_THUAT = { wR: 0.05, wI: 0.1, wA: 0.5, wS: 0.18, wE: 0.14, wC: 0.03 };

test('M1: pBench uses only candidates with all three subjects', () => {
  const stats = buildDistribution(A00_ROWS, 'A00');
  assert.equal(stats.n, 4);
  assert.equal(stats.sorted.length, 4);
  assert.equal(pBench(21, stats), 0.75);
  assert.equal(P(21, stats), 0.25);
  assert.equal(percentile(21, stats), 25);
});

test('M2: pBench, percentile and zScore are monotonic in the total', () => {
  const stats = buildDistribution(A00_ROWS, 'A00');
  let previousP = 1;
  let previousPercentile = -1;
  let previousZ = -Infinity;
  for (let score = 0; score <= 30; score += 1) {
    const upper = pBench(score, stats);
    const lower = percentile(score, stats);
    const z = zScore(score, stats);
    assert.ok(upper <= previousP);
    assert.ok(lower >= previousPercentile);
    assert.ok(z >= previousZ);
    previousP = upper;
    previousPercentile = lower;
    previousZ = z;
  }
});

test('M3: identical profile and weights give 100', () => {
  const groups = groupsFromSums({ R: 35, I: 35, A: 5, S: 3, E: 7, C: 15 });
  const fit = tinhCachFit(groups, KY_THUAT, { doPhuMin: 80 });
  assert.equal(fit.value, 100);
  assert.equal(fit.doPhu, 100);
});

test('M4: disjoint profiles give 0', () => {
  const groups = groupsFromSums({ R: 0, I: 0, A: 50, S: 0, E: 0, C: 0 });
  const weights = { wR: 1, wI: 0, wA: 0, wS: 0, wE: 0, wC: 0 };
  const fit = tinhCachFit(groups, weights, { doPhuMin: 80 });
  assert.equal(fit.value, 0);
});

test('M5: worked example gives 74.4 for engineering and 58.6 for art', () => {
  const groups = groupsFromSums({ R: 45, I: 40, A: 30, S: 20, E: 15, C: 10 });
  assert.equal(tinhCachFit(groups, KY_THUAT).value, 74.4);
  assert.equal(tinhCachFit(groups, NGHE_THUAT).value, 58.6);
});

test('M6: histogram intersection equals 1 - half the total variation', () => {
  let seed = 123456789;
  const random = () => {
    seed = (1103515245 * seed + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let run = 0; run < 1000; run += 1) {
    const s = Array.from({ length: 6 }, () => random() + 0.0001);
    const w = Array.from({ length: 6 }, () => random() + 0.0001);
    const sTotal = s.reduce((sum, value) => sum + value, 0);
    const wTotal = w.reduce((sum, value) => sum + value, 0);
    const sn = s.map((value) => value / sTotal);
    const wn = w.map((value) => value / wTotal);
    const intersection = sn.reduce((sum, value, index) => sum + Math.min(value, wn[index]), 0);
    const variation = sn.reduce((sum, value, index) => sum + Math.abs(value - wn[index]), 0);
    assert.ok(Math.abs(intersection - (1 - 0.5 * variation)) < 1e-9);
  }
});

test('M7: a flat profile is below 90 for every seeded major group', async () => {
  await getAuthDb();
  const groups = groupsFromSums({ R: 50, I: 50, A: 50, S: 50, E: 50, C: 50 });
  const weights = [...getWeightsMap().values()];
  assert.equal(weights.length, 8);
  for (const row of weights) {
    const fit = tinhCachFit(groups, row);
    assert.ok(fit.value < 90, `${row.majorGroup}: ${fit.value}`);
  }
});

test('M8: a missing weight row returns null with a reason', () => {
  const groups = groupsFromSums({ R: 10, I: 10, A: 10, S: 10, E: 10, C: 10 });
  const fit = tinhCachFit(groups, null);
  assert.equal(fit.value, null);
  assert.deepEqual(fit.reasons, [REASONS.THIEU_TRONG_SO_TINH_CACH]);
});

test('M9: coverage below the threshold makes tongHopFit null', () => {
  const groups = groupsFromSums(
    { R: 50, I: 50, A: 50, S: 50, E: 0, C: 0 },
    { E: 'empty', C: 'empty' }
  );
  const fit = tinhCachFit(groups, KY_THUAT, { doPhuMin: 80 });
  assert.equal(fit.status, 'tam_tinh');
  assert.ok(fit.value !== null);
  const total = tongHopFit(80, fit, DEFAULT_CONFIG);
  assert.equal(total.value, null);
  assert.deepEqual(total.reasons, [REASONS.CHUA_DU_CAU_TRA_LOI]);
});

test('M10/M11: missing components make tongHopFit null', () => {
  assert.deepEqual(tongHopFit(null, { value: 80, status: 'day_du' }).reasons, [REASONS.THIEU_HOC_LUC]);
  assert.deepEqual(tongHopFit(80, null).reasons, [REASONS.THIEU_TINH_CACH]);
});

test('M12: the 3x2 matrix maps all six cells', () => {
  const config = { matrix_hoc_luc_high: 70, matrix_hoc_luc_low: 50, matrix_tinh_cach: 65 };
  assert.equal(matrixCell(80, { value: 70 }, config), 1);
  assert.equal(matrixCell(80, { value: 60 }, config), 2);
  assert.equal(matrixCell(60, { value: 70 }, config), 3);
  assert.equal(matrixCell(60, { value: 60 }, config), 4);
  assert.equal(matrixCell(40, { value: 70 }, config), 5);
  assert.equal(matrixCell(40, { value: 60 }, config), 6);
  assert.equal(matrixCell(null, { value: 70 }, config), null);
});

test('M13: hocLucFit is monotonic in the student total and non-increasing in entryScore', () => {
  const stats = buildDistribution(A00_ROWS, 'A00');
  let previous = -1;
  for (const total of [18, 21, 24, 27]) {
    const fit = hocLucFit({ tStudent: total, combo: 'A00', entryScore: 21, stats });
    assert.ok(fit.value >= previous);
    previous = fit.value;
  }
  const easy = hocLucFit({ tStudent: 24, combo: 'A00', entryScore: 21, stats });
  const hard = hocLucFit({ tStudent: 24, combo: 'A00', entryScore: 27, stats });
  assert.ok(easy.value >= hard.value);
});

test('M13: legacy mode matches calculateCareerFit', () => {
  const scores = [
    { subject: 'Toán', scoreType: 'average', score: 8 },
    { subject: 'Vật lý', scoreType: 'average', score: 8 },
    { subject: 'Hóa học', scoreType: 'average', score: 8 },
  ];
  const rows = [
    { subject_name: 'Toán', weight: 0.4, threshold: 9 },
    { subject_name: 'Vật lý', weight: 0.35, threshold: 8.5 },
    { subject_name: 'Hóa học', weight: 0.25, threshold: 8 },
  ];
  const legacy = calculateCareerFit(scores, rows).fitPct;
  const fit = hocLucFit({ mode: 1, legacyFitPct: legacy, entryScore: 25, combo: 'A00' });
  assert.equal(fit.value, legacy);
  assert.equal(fit.method, 'legacy');
});

test('M17: entryScore above 30 is excluded', () => {
  const fit = hocLucFit({ tStudent: 25, combo: 'D01', entryScore: 34.35, stats: null });
  assert.equal(fit.value, null);
  assert.deepEqual(fit.reasons, [REASONS.DIEM_CHUAN_KHONG_HOP_LE]);
});

test('M21: P_entry = 0 returns a reason instead of dividing by zero', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ toan: 15 + (index % 10), ly: 6, hoa: 6 }));
  const stats = buildDistribution(rows, 'A00');
  const fit = hocLucFit({ tStudent: 27, combo: 'A00', entryScore: 10, stats });
  assert.equal(fit.value, null);
  assert.deepEqual(fit.reasons, [REASONS.DIEM_CHUAN_NGOAI_PHAN_BO]);
});

test('M19: the same student drops at least 20 points when the entry score moves from P60 to P97', () => {
  const rows = Array.from({ length: 3001 }, (_, index) => {
    const total = index / 100;
    return { toan: total / 3, ly: total / 3, hoa: total / 3 };
  });
  const stats = buildDistribution(rows, 'A00');
  const student = hocLucFit({ tStudent: 23.1, combo: 'A00', entryScore: 29.1, stats });
  const lowerEntry = hocLucFit({ tStudent: 23.1, combo: 'A00', entryScore: 18, stats });
  assert.ok(student.value !== null);
  assert.equal(lowerEntry.value, 100);
  assert.ok(lowerEntry.value - student.value >= 20, `${lowerEntry.value} - ${student.value}`);
});

test('M22: ties at 100 are broken by diemVuotChuan deterministically', () => {
  const items = [
    { name: 'A', value: 100, diemVuotChuan: 1 },
    { name: 'B', value: 100, diemVuotChuan: 5 },
    { name: 'C', value: 100, diemVuotChuan: 3 },
  ];
  items.sort((a, b) => b.value - a.value || b.diemVuotChuan - a.diemVuotChuan || a.name.localeCompare(b.name));
  assert.deepEqual(items.map((item) => item.name), ['B', 'C', 'A']);
});

test('M23: fewer than four complete groups gives null with a reason', () => {
  const groups = groupsFromSums(
    { R: 50, I: 50, A: 0, S: 0, E: 0, C: 0 },
    { A: 'empty', S: 'empty', E: 'empty', C: 'empty' }
  );
  const fit = tinhCachFit(groups, KY_THUAT);
  assert.equal(fit.value, null);
  assert.deepEqual(fit.reasons, [REASONS.CHUA_DU_CAU_TRA_LOI]);
});

test('M18: the percentile formula reduces mid-range saturation on the real distribution', async (t) => {
  const dbPath = path.join(__dirname, '../../database/learnpath.db');
  if (!fs.existsSync(dbPath)) {
    t.skip('admission database is not present');
    return;
  }
  const valid = rubrics.filter((rubric) => rubric.isValid !== false);
  const combos = [...new Set(valid.map((rubric) => rubric.admissionBlock))];
  const statsByCombos = await (async () => {
    const { getStatsForCombos } = require('../../src/career/match');
    return getStatsForCombos(combos);
  })();
  const values = [];
  for (const rubric of valid) {
    const stats = statsByCombos.get(rubric.admissionBlock);
    const fit = hocLucFit({
      tStudent: 21,
      combo: rubric.admissionBlock,
      entryScore: rubric.entryScore,
      stats,
    });
    if (fit.value !== null) values.push(fit.value);
  }
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  const saturated = values.filter((value) => value >= 95).length;
  console.log(`M18: ${values.length} rubrics, median=${median}, >=95=${saturated}`);
  assert.ok(values.length >= 135, `expected at least 135 computable rubrics, got ${values.length}`);
  assert.ok(median >= 72 && median <= 82, `median ${median}`);
  assert.ok(saturated >= 25 && saturated <= 45, `saturated ${saturated}`);
});
