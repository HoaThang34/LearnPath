'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getGroupConfig,
  groupFit,
  resolveGroup,
  REASONS,
} = require('../../src/career/groupMatch');
const { getMbtiProfile, mbtiFit } = require('../../src/career/mbti');
const {
  findPriorityRow,
  hocLucSubjectFit,
  getPriorityConfig,
  PRIORITY_MAX,
  PRIORITY_MIN,
} = require('../../src/career/hocLuc');
const rubrics = require('../../src/data/edumind_rubrics.json');
const groupFile = require('../../src/data/career_group_weights.json');

function close(actual, expected, epsilon = 0.05) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected} ± ${epsilon}`);
}

test('W1: every group weight row is positive and sums to 1', () => {
  const config = getGroupConfig();
  assert.equal(config.groups.length, 12);
  for (const group of config.groups) {
    assert.ok(group.wHocLuc > 0 && group.wHolland > 0 && group.wMbti > 0, group.code);
    close(group.wHocLuc + group.wHolland + group.wMbti, 1, 0.002);
  }
  assert.deepEqual(config.invalidGroups, []);
});

test('W2: CNTT reproduces the worked example exactly', () => {
  const group = groupFile.groups.find((row) => row.code === 'cntt');
  assert.equal(group.wHocLuc, 0.54994561);
  assert.equal(group.wHolland, 0.24021087);
  assert.equal(group.wMbti, 0.20984352);
  // A 20-point increase in M moves F by 20 × wMbti.
  close(20 * group.wMbti, 4.1969, 0.0001);
});

test('W3: the 12 published weight triples match the specification', () => {
  const expected = {
    cntt: [54.99, 24.02, 20.98],
    ky_thuat: [64.83, 22.97, 12.2],
    toan_khoa_hoc: [57.14, 28.57, 14.29],
    y_duoc: [63.37, 19.19, 17.44],
    kinh_te: [60, 20, 20],
    kinh_doanh: [40, 40, 20],
    luat: [50, 25, 25],
    ngon_ngu: [53.96, 29.7, 16.34],
    xa_hoi: [37.5, 37.5, 25],
    su_pham: [46, 31.89, 22.11],
    nghe_thuat: [27.27, 54.55, 18.18],
    nong_lam: [54.55, 27.27, 18.18],
  };
  for (const group of groupFile.groups) {
    const target = expected[group.code];
    assert.ok(target, `unknown group ${group.code}`);
    close(group.wHocLuc * 100, target[0], 0.02);
    close(group.wHolland * 100, target[1], 0.02);
    close(group.wMbti * 100, target[2], 0.02);
  }
});

test('W4: F_m uses all three components on the 0–100 scale', () => {
  const fit = groupFit({ majorName: 'Kỹ thuật Phần mềm', hocLuc: 80, holland: 60, mbti: 70 });
  assert.equal(fit.groupCode, 'cntt');
  const expected = 0.54994561 * 80 + 0.24021087 * 60 + 0.20984352 * 70;
  close(fit.value, Math.round(expected * 10) / 10);
  assert.deepEqual(fit.missing, []);
  assert.equal(fit.contributions.length, 3);
});

test('W5: a missing component makes F_m null but keeps a labelled partial value', () => {
  const fit = groupFit({ majorName: 'Kỹ thuật Phần mềm', hocLuc: 80, holland: 60, mbti: null });
  assert.equal(fit.value, null);
  assert.notEqual(fit.partialValue, null);
  assert.deepEqual(fit.missing, ['M']);
  assert.deepEqual(fit.reasons, [REASONS.THIEU_MBTI]);
  close(fit.coverageWeight, 0.54994561 + 0.24021087, 0.0001);
});

test('W6: an unmapped major returns a reason instead of a silent 0', () => {
  const fit = groupFit({ majorName: 'Ngành Không Tồn Tại', hocLuc: 80, holland: 60, mbti: 70 });
  assert.equal(fit.value, null);
  assert.equal(fit.partialValue, null);
  assert.deepEqual(fit.reasons, [REASONS.KHONG_XAC_DINH_DUOC_KHOI]);
});

test('W7: every valid rubric major resolves to exactly one group', () => {
  const valid = rubrics.filter((row) => row.isValid !== false);
  const missing = [];
  for (const row of valid) {
    const group = resolveGroup(row.majorName);
    if (!group) missing.push(row.majorName);
  }
  assert.deepEqual(missing, []);
});

test('W8: the MBTI profile is determined with calibrated c and t values', () => {
  const profile = getMbtiProfile();
  assert.equal(profile.determined, true);
  assert.equal(profile.status, 'xac_dinh');
  assert.equal(profile.axes.length, 4);
  for (const axis of profile.axes) {
    assert.equal(axis.c, 1.0);
    assert.equal(axis.t, 1);
  }
});

test('W9: M is null with a reason while the profile is undetermined', () => {
  const undeterminedProfile = {
    status: 'chua_xac_dinh',
    axes: new Map([
      ['EI', { code: 'EI', first: 'E', second: 'I', c: null, t: null }],
      ['SN', { code: 'SN', first: 'S', second: 'N', c: null, t: null }],
      ['TF', { code: 'TF', first: 'T', second: 'F', c: null, t: null }],
      ['JP', { code: 'JP', first: 'J', second: 'P', c: null, t: null }],
    ]),
  };
  const result = {
    part2: {
      pairs: [
        { code: 'EI', d: 12, lean: 'E' },
        { code: 'SN', d: -6, lean: 'N' },
        { code: 'TF', d: 0, lean: null },
        { code: 'JP', d: 18, lean: 'J' },
      ],
    },
  };
  const fit = mbtiFit({ result, profile: undeterminedProfile });
  assert.equal(fit.value, null);
  assert.deepEqual(fit.reasons, ['thieu_ho_so_mbti']);
  assert.equal(fit.axes.find((axis) => axis.code === 'EI').x, 0.5);
});

test('W10: M ignores missing pairs instead of treating D = 0', () => {
  const result = {
    part2: {
      pairs: [
        { code: 'EI', d: 12 },
        { code: 'SN', d: null },
        { code: 'TF', d: 0 },
        { code: 'JP', d: 18 },
      ],
    },
  };
  const fit = mbtiFit({ result });
  assert.equal(fit.value, null);
  assert.deepEqual(fit.reasons, ['thieu_du_lieu_truc']);
  assert.deepEqual(fit.missingAxes, ['SN']);
});

test('W11: M computes the documented formula once a profile is supplied', () => {
  const profile = {
    status: 'xac_dinh',
    axes: new Map([
      ['EI', { code: 'EI', first: 'E', second: 'I', c: 1, t: 1 }],
      ['SN', { code: 'SN', first: 'S', second: 'N', c: 1, t: 1 }],
      ['TF', { code: 'TF', first: 'T', second: 'F', c: 1, t: 1 }],
      ['JP', { code: 'JP', first: 'J', second: 'P', c: 1, t: 1 }],
    ]),
  };
  const result = {
    part2: {
      pairs: [
        { code: 'EI', d: 24 },
        { code: 'SN', d: 12 },
        { code: 'TF', d: 0 },
        { code: 'JP', d: -12 },
      ],
    },
  };
  const fit = mbtiFit({ result, profile });
  // x = 1, 0.5, 0, −0.5 → mean = 0.25 → M = 50 × 1.25 = 62.5
  assert.equal(fit.value, 62.5);
  assert.deepEqual(fit.reasons, []);
});

test('W12: L_m normalises subject priorities and scores on the 0–100 scale', () => {
  const { row } = findPriorityRow({ majorName: 'Kỹ thuật Phần mềm' });
  assert.ok(row);
  const scores = new Map([
    ['Toán', 8],
    ['Tin học', 8],
    ['Tiếng Anh', 8],
  ]);
  const fit = hocLucSubjectFit({ row, scores });
  // r = 4,3,2 → a = 4/9, 3/9, 2/9 → 10 × (4/9·8 + 3/9·8 + 2/9·8) = 80
  assert.equal(fit.value, 80);
  assert.equal(fit.coveragePct, 100);
});

test('W13: a missing subject keeps L_m null and reports coverage', () => {
  const { row } = findPriorityRow({ majorName: 'Kỹ thuật Phần mềm' });
  const fit = hocLucSubjectFit({ row, scores: new Map([['Toán', 8]]) });
  assert.equal(fit.value, null);
  assert.ok(fit.coveragePct > 0 && fit.coveragePct < 100);
  assert.deepEqual(fit.reasons, ['thieu_diem_mon']);
  assert.deepEqual(fit.missing, ['Tin học', 'Tiếng Anh']);
});

test('W14: every priority row uses integer priorities within 1–4', () => {
  const config = getPriorityConfig();
  assert.equal(config.rowCount, 143);
  for (const row of require('../../src/data/career_subject_priorities.json').rows) {
    for (const subject of row.subjects) {
      assert.ok(Number.isInteger(subject.r));
      assert.ok(subject.r >= PRIORITY_MIN && subject.r <= PRIORITY_MAX);
    }
  }
});
