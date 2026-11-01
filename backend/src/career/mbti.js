'use strict';

/**
 * MBTI comparison term M_m on a 0–100 scale.
 *
 *   x_k = D_k / 24
 *   M_m = 50 × (1 + Σ_k c_mk·t_mk·x_k / Σ_k c_mk)
 *
 * `c_mk` is the relevance of axis k for the major's activity criteria and
 * `t_mk ∈ {+1, −1}` the direction being compared. That comparison profile is
 * NOT invented here: `backend/src/data/career_mbti_profile.json` records every
 * axis with `c = null, t = null, status = 'chua_xac_dinh'`. Until a reviewed
 * profile exists, `M_m` is `null` with an explicit reason — never 0, never 50.
 *
 * Missing answers are not 0: an axis whose `D` is null (an incomplete pair in
 * `interest_results`) makes `M_m` null with `thieu_du_lieu_truc`.
 */

const fs = require('fs');
const path = require('path');

function getDataFile() {
  return (
    process.env.LEARNPATH_MBTI_PROFILE_PATH ||
    path.join(__dirname, '..', 'data', 'career_mbti_profile.json')
  );
}

const AXIS_ORDER = ['EI', 'SN', 'TF', 'JP'];
const SCALE = 24;

const REASONS = {
  THIEU_HO_SO_MBTI: 'thieu_ho_so_mbti',
  THIEU_DU_LIEU_TRUC: 'thieu_du_lieu_truc',
  KHONG_CO_KET_QUA_SO_THICH: 'khong_co_ket_qua_so_thich',
};

let cache = null;

function loadProfile() {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(getDataFile(), 'utf8'));
  const axes = new Map();
  for (const axis of raw.axes || []) {
    axes.set(axis.code, {
      code: axis.code,
      first: axis.first,
      second: axis.second,
      title: axis.title,
      c: axis.c === null || axis.c === undefined ? null : Number(axis.c),
      t: axis.t === null || axis.t === undefined ? null : Number(axis.t),
    });
  }
  cache = {
    version: raw.version || 1,
    status: raw.status || 'chua_xac_dinh',
    note: raw.note || '',
    formula: raw.formula || 'x_k = D_k / 24 ; M_m = 50 × (1 + Σ c·t·x / Σ c)',
    axes,
  };
  return cache;
}

function clearCache() {
  cache = null;
}

function getMbtiProfile() {
  const profile = loadProfile();
  return {
    version: profile.version,
    status: profile.status,
    note: profile.note,
    formula: profile.formula,
    determined: isDetermined(profile),
    axes: AXIS_ORDER.map((code) => {
      const axis = profile.axes.get(code);
      return axis
        ? { ...axis }
        : { code, first: code[0], second: code[1], title: null, c: null, t: null };
    }),
  };
}

function isDetermined(profile) {
  if (!profile || profile.status !== 'xac_dinh') return false;
  for (const code of AXIS_ORDER) {
    const axis = profile.axes.get(code);
    if (!axis) return false;
    if (!Number.isFinite(axis.c) || axis.c <= 0) return false;
    if (axis.t !== 1 && axis.t !== -1) return false;
  }
  return true;
}

function readD(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < -SCALE || numeric > SCALE) return null;
  return numeric;
}

/**
 * @param {object} input
 * @param {object|null} input.result  Latest interest result (`part2.pairs` with `d`)
 * @param {object} [input.profile]    Override the JSON profile (tests only)
 */
function mbtiFit({ result, profile: override } = {}) {
  const profile = override || loadProfile();
  const determined = isDetermined(profile);
  const axesMeta = AXIS_ORDER.map((code) => {
    const axis = profile.axes.get(code) || { code, c: null, t: null };
    const pair = result?.part2?.pairs?.find((entry) => entry.code === code) || null;
    const d = readD(pair?.d);
    return {
      code,
      first: axis.first || code[0],
      second: axis.second || code[1],
      title: axis.title || null,
      c: Number.isFinite(axis.c) ? axis.c : null,
      t: axis.t === 1 || axis.t === -1 ? axis.t : null,
      d,
      lean: pair?.lean || null,
      x: d === null ? null : Math.round((d / SCALE) * 10000) / 10000,
    };
  });

  if (!result) {
    return {
      value: null,
      status: 'thieu_du_lieu',
      determined,
      reasons: [REASONS.KHONG_CO_KET_QUA_SO_THICH],
      axes: axesMeta,
      numerator: null,
      denominator: null,
    };
  }

  const missingAxes = axesMeta.filter((axis) => axis.d === null).map((axis) => axis.code);
  if (missingAxes.length > 0) {
    return {
      value: null,
      status: 'thieu_du_lieu',
      determined,
      reasons: [REASONS.THIEU_DU_LIEU_TRUC],
      missingAxes,
      axes: axesMeta,
      numerator: null,
      denominator: null,
    };
  }

  if (!determined) {
    return {
      value: null,
      status: 'chua_xac_dinh',
      determined: false,
      reasons: [REASONS.THIEU_HO_SO_MBTI],
      axes: axesMeta,
      numerator: null,
      denominator: null,
    };
  }

  let numerator = 0;
  let denominator = 0;
  for (const axis of axesMeta) {
    numerator += axis.c * axis.t * axis.x;
    denominator += axis.c;
  }
  if (!(denominator > 0)) {
    return {
      value: null,
      status: 'chua_xac_dinh',
      determined: false,
      reasons: [REASONS.THIEU_HO_SO_MBTI],
      axes: axesMeta,
      numerator: null,
      denominator: null,
    };
  }
  const raw = 50 * (1 + numerator / denominator);
  return {
    value: Math.round(Math.min(Math.max(raw, 0), 100) * 10) / 10,
    status: 'day_du',
    determined: true,
    reasons: [],
    axes: axesMeta,
    numerator: Math.round(numerator * 10000) / 10000,
    denominator: Math.round(denominator * 10000) / 10000,
  };
}

module.exports = {
  AXIS_ORDER,
  SCALE,
  REASONS,
  loadProfile,
  clearCache,
  getMbtiProfile,
  isDetermined,
  mbtiFit,
};
