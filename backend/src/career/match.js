'use strict';

const { queryAll } = require('../auth/authDb');
const { runSql, runAuthMutation } = require('../auth/authDb');
const { getBlockSubjects, SUBJECT_COLUMNS } = require('./subjects');
const { GROUP_ORDER } = require('../interest/content');

const CACHE_TTL_MS = 10 * 60 * 1000;
const statsCache = new Map();

// Column order of the SELECT used by getStatsForCombos().
const SCAN_COLUMN_INDEX = {
  toan: 0,
  van: 1,
  ly: 2,
  hoa: 3,
  sinh: 4,
  su: 5,
  dia: 6,
  tin_hoc: 7,
  ngoai_ngu: 8,
};

const DEFAULT_CONFIG = {
  w_hoc_luc: 0.6,
  w_tinh_cach: 0.4,
  matrix_hoc_luc_high: 70,
  matrix_hoc_luc_low: 50,
  matrix_tinh_cach: 65,
  do_phu_min: 80,
  hoc_luc_mode: 0,
};

const REASONS = {
  THIEU_DIEM_MON: 'thieu_diem_mon',
  THIEU_TO_HOP: 'thieu_to_hop',
  THIEU_DIEM_CHUAN: 'thieu_diem_chuan',
  DIEM_CHUAN_KHONG_HOP_LE: 'diem_chuan_khong_hop_le',
  DIEM_CHUAN_NGOAI_PHAN_BO: 'diem_chuan_ngoai_phan_bo',
  THIEU_TRONG_SO_TINH_CACH: 'thieu_trong_so_tinh_cach',
  CHUA_DU_CAU_TRA_LOI: 'chua_du_cau_tra_loi',
  THIEU_DIEM_THI: 'thieu_diem_thi',
  THIEU_HOC_LUC: 'thieu_hoc_luc',
  THIEU_TINH_CACH: 'thieu_tinh_cach',
  PHUONG_THUC_KHAC: 'phuong_thuc_khac',
  MAPPING_CHUA_DOI_CHIEU: 'mapping_chua_doi_chieu',
};

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finalizeDistribution(combo, totals) {
  const sorted = totals.sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return { combo, n: 0, mean: null, sd: null, median: null, min: null, max: null, sorted };
  }
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = sum / n;
  const variance = sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / n;
  const middle = Math.floor(n / 2);
  const median = n % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    combo,
    n,
    mean: round(mean, 4),
    sd: round(Math.sqrt(variance), 4),
    median: round(median, 2),
    min: round(sorted[0], 2),
    max: round(sorted[n - 1], 2),
    sorted,
  };
}

function buildDistribution(rows, combo) {
  const subjects = getBlockSubjects(combo);
  if (!subjects) throw new Error(`Unknown admission block: ${combo}`);
  const columns = subjects.map((subject) => SUBJECT_COLUMNS[subject]);
  const totals = [];
  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    if (values.some((value) => value === null || value === undefined || !Number.isFinite(Number(value)))) {
      continue;
    }
    totals.push(values.reduce((sum, value) => sum + Number(value), 0));
  }
  return finalizeDistribution(combo, totals);
}

function countBelow(sorted, threshold) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < threshold) low = middle + 1;
    else high = middle;
  }
  return low;
}

function countAtOrAbove(sorted, threshold) {
  return sorted.length - countBelow(sorted, threshold);
}

// P is the LOWER tail: share of candidates with a total strictly below `threshold`.
function P(threshold, stats) {
  if (!stats || !stats.n) return null;
  return countBelow(stats.sorted, threshold) / stats.n;
}

// pBench is the UPPER tail: share of candidates with a total >= `threshold`.
function pBench(threshold, stats) {
  if (!stats || !stats.n) return null;
  return countAtOrAbove(stats.sorted, threshold) / stats.n;
}

function percentile(score, stats) {
  const value = P(score, stats);
  return value === null ? null : round(value * 100, 2);
}

function zScore(score, stats) {
  if (!stats || !Number.isFinite(stats.mean) || !Number.isFinite(stats.sd) || stats.sd === 0) return null;
  return round((score - stats.mean) / stats.sd, 4);
}

async function getDbForStats() {
  // Lazy require keeps pure unit tests independent from the admission DB.
  const { getDb } = require('../database/db');
  return getDb();
}

async function getStatsForCombos(combos) {
  const now = Date.now();
  const requested = [...new Set((combos || []).filter((combo) => getBlockSubjects(combo)))];
  const missing = requested.filter((combo) => {
    const cached = statsCache.get(combo);
    return !cached || now - cached.loadedAt > CACHE_TTL_MS;
  });

  if (missing.length > 0) {
    const db = await getDbForStats();
    const sets = missing.map((combo) => ({
      combo,
      columns: getBlockSubjects(combo).map((subject) => SUBJECT_COLUMNS[subject]),
    }));
    const totals = new Map(missing.map((combo) => [combo, []]));
    const stmt = db.prepare(
      'SELECT toan, van, ly, hoa, sinh, su, dia, tin_hoc, ngoai_ngu FROM diem_thi_thptqg'
    );
    try {
      while (stmt.step()) {
        const row = stmt.get();
        for (const set of sets) {
          let total = 0;
          let complete = true;
          for (const column of set.columns) {
            const value = row[SCAN_COLUMN_INDEX[column]];
            if (value === null || value === undefined || !Number.isFinite(Number(value))) {
              complete = false;
              break;
            }
            total += Number(value);
          }
          if (complete) totals.get(set.combo).push(total);
        }
      }
    } finally {
      stmt.free();
    }
    for (const set of sets) {
      statsCache.set(set.combo, {
        loadedAt: Date.now(),
        stats: finalizeDistribution(set.combo, totals.get(set.combo)),
      });
    }
  }

  const result = new Map();
  for (const combo of requested) result.set(combo, statsCache.get(combo).stats);
  return result;
}

async function getComboStats(combo) {
  const map = await getStatsForCombos([combo]);
  return map.get(combo) || null;
}

function publicStats(stats) {
  if (!stats) return null;
  return {
    combo: stats.combo,
    n: stats.n,
    mean: stats.mean,
    sd: stats.sd,
    median: stats.median,
    min: stats.min,
    max: stats.max,
  };
}

function buildBenchmark(combo, score, stats) {
  const p = P(score, stats);
  const upper = pBench(score, stats);
  return {
    combo,
    threshold: round(score, 2),
    year: null,
    pBench: round(upper, 6),
    percentile: round(p * 100, 2),
    zScore: zScore(score, stats),
    numerator: countAtOrAbove(stats.sorted, score),
    denominator: stats.n,
    mean: stats.mean,
    sd: stats.sd,
    median: stats.median,
    n: stats.n,
    note: `Tỉ lệ thí sinh toàn quốc có tổng ${combo} ≥ ${round(score, 2)}. Không phải tỉ lệ trúng tuyển.`,
  };
}

function getRiasecMap(groups) {
  const map = new Map();
  for (const group of groups || []) map.set(group.code, group);
  return map;
}

function tinhCachFit(groups, weights, options = {}) {
  const doPhuMin = Number(options.doPhuMin ?? DEFAULT_CONFIG.do_phu_min);
  if (!weights) {
    return { value: null, doPhu: null, status: 'thieu_du_lieu', reasons: [REASONS.THIEU_TRONG_SO_TINH_CACH] };
  }
  const complete = (groups || []).filter((group) => group.status === 'complete');
  if (complete.length < 4) {
    return { value: null, doPhu: null, status: 'thieu_du_lieu', reasons: [REASONS.CHUA_DU_CAU_TRA_LOI] };
  }
  const sum = complete.reduce((acc, group) => acc + Number(group.sum), 0);
  if (!(sum > 0)) {
    return { value: null, doPhu: null, status: 'thieu_du_lieu', reasons: [REASONS.CHUA_DU_CAU_TRA_LOI] };
  }
  const weightKey = { R: 'wR', I: 'wI', A: 'wA', S: 'wS', E: 'wE', C: 'wC' };
  const weightSum = complete.reduce((acc, group) => acc + Number(weights[weightKey[group.code]] || 0), 0);
  if (!(weightSum > 0)) {
    return { value: null, doPhu: null, status: 'thieu_du_lieu', reasons: [REASONS.THIEU_TRONG_SO_TINH_CACH] };
  }
  let fit = 0;
  for (const group of complete) {
    const s = Number(group.sum) / sum;
    const w = Number(weights[weightKey[group.code]] || 0) / weightSum;
    fit += Math.min(s, w);
  }
  const doPhu = 100 * weightSum;
  return {
    value: round(fit * 100, 1),
    doPhu: round(doPhu, 1),
    status: doPhu >= doPhuMin ? 'day_du' : 'tam_tinh',
    reasons: [],
  };
}

function hocLucFit({ tStudent, combo, entryScore, stats, legacyFitPct, mode }) {
  const entry = Number(entryScore);
  if (entryScore === null || entryScore === undefined || entryScore === '') {
    return { value: null, coveragePct: 0, reasons: [REASONS.THIEU_DIEM_CHUAN], method: null, diemVuotChuan: null };
  }
  if (!Number.isFinite(entry) || entry <= 0 || entry > 30) {
    return { value: null, coveragePct: 0, reasons: [REASONS.DIEM_CHUAN_KHONG_HOP_LE], method: null, diemVuotChuan: null };
  }
  if (mode === 1) {
    if (legacyFitPct === null || legacyFitPct === undefined) {
      return { value: null, coveragePct: 0, reasons: [REASONS.THIEU_DIEM_THI], method: 'legacy', diemVuotChuan: null };
    }
    return {
      value: round(Number(legacyFitPct), 1),
      coveragePct: 100,
      reasons: [],
      method: 'legacy',
      diemVuotChuan: null,
    };
  }
  if (!combo || !getBlockSubjects(combo)) {
    return { value: null, coveragePct: 0, reasons: [REASONS.THIEU_TO_HOP], method: null, diemVuotChuan: null };
  }
  if (tStudent === null || tStudent === undefined || !Number.isFinite(Number(tStudent))) {
    return { value: null, coveragePct: 0, reasons: [REASONS.THIEU_DIEM_THI], method: null, diemVuotChuan: null };
  }
  if (!stats || !stats.n) {
    return { value: null, coveragePct: 0, reasons: [REASONS.DIEM_CHUAN_NGOAI_PHAN_BO], method: null, diemVuotChuan: null };
  }
  const pStudent = P(Number(tStudent), stats);
  const pEntry = P(entry, stats);
  if (!(pEntry > 0)) {
    return { value: null, coveragePct: 0, reasons: [REASONS.DIEM_CHUAN_NGOAI_PHAN_BO], method: 'percentile', diemVuotChuan: null };
  }
  return {
    value: round(100 * Math.min(pStudent / pEntry, 1), 1),
    coveragePct: 100,
    reasons: [],
    method: 'percentile',
    diemVuotChuan: round(Number(tStudent) - entry, 2),
    pStudent: round(pStudent, 6),
    pEntry: round(pEntry, 6),
  };
}

function tongHopFit(hocLuc, tinhCach, config = {}) {
  const wHoc = Number(config.w_hoc_luc ?? DEFAULT_CONFIG.w_hoc_luc);
  const wTinh = Number(config.w_tinh_cach ?? DEFAULT_CONFIG.w_tinh_cach);
  if (hocLuc === null || hocLuc === undefined) {
    return { value: null, reasons: [REASONS.THIEU_HOC_LUC] };
  }
  if (tinhCach === null || tinhCach === undefined) {
    return { value: null, reasons: [REASONS.THIEU_TINH_CACH] };
  }
  if (tinhCach.status !== 'day_du') {
    return { value: null, reasons: [REASONS.CHUA_DU_CAU_TRA_LOI] };
  }
  const total = wHoc + wTinh;
  if (!(total > 0)) return { value: null, reasons: [REASONS.THIEU_HOC_LUC] };
  return {
    value: round((wHoc * Number(hocLuc) + wTinh * Number(tinhCach.value)) / total, 1),
    reasons: [],
  };
}

function matrixCell(hocLuc, tinhCach, config = {}) {
  if (hocLuc === null || hocLuc === undefined || tinhCach === null || tinhCach === undefined) return null;
  const high = Number(config.matrix_hoc_luc_high ?? DEFAULT_CONFIG.matrix_hoc_luc_high);
  const low = Number(config.matrix_hoc_luc_low ?? DEFAULT_CONFIG.matrix_hoc_luc_low);
  const tinh = Number(config.matrix_tinh_cach ?? DEFAULT_CONFIG.matrix_tinh_cach);
  const hoc = Number(hocLuc);
  const tc = Number(tinhCach.value ?? tinhCach);
  if (hoc >= high) return tc >= tinh ? 1 : 2;
  if (hoc >= low) return tc >= tinh ? 3 : 4;
  return tc >= tinh ? 5 : 6;
}

function getWeightsMap() {
  const map = new Map();
  for (const row of queryAll(
    `SELECT major_group AS majorGroup, w_r AS wR, w_i AS wI, w_a AS wA,
            w_s AS wS, w_e AS wE, w_c AS wC
       FROM interest_group_weights WHERE is_active = 1`
  )) {
    map.set(row.majorGroup, row);
  }
  return map;
}

function getMatchConfig() {
  const config = { ...DEFAULT_CONFIG };
  for (const row of queryAll('SELECT key, value FROM career_match_config')) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, row.key)) {
      config[row.key] = Number(row.value);
    }
  }
  return config;
}

function getMatchConfigRows() {
  return queryAll(
    'SELECT key, value, note, updated_at AS updatedAt FROM career_match_config ORDER BY key'
  );
}

function validateMatchConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Tham số tổng thể không hợp lệ.'), { statusCode: 400 });
  }
  const updates = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key)) {
      throw Object.assign(new Error(`Tham số "${key}" không được hỗ trợ.`), { statusCode: 400 });
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(new Error(`Giá trị của "${key}" phải là số.`), { statusCode: 400 });
    }
    updates[key] = numeric;
  }
  const merged = { ...getMatchConfig(), ...updates };
  if (!(merged.w_hoc_luc > 0) || !(merged.w_tinh_cach > 0)) {
    throw Object.assign(new Error('w_hoc_luc và w_tinh_cach phải lớn hơn 0.'), { statusCode: 400 });
  }
  if (!(merged.matrix_hoc_luc_low < merged.matrix_hoc_luc_high)) {
    throw Object.assign(new Error('matrix_hoc_luc_low phải nhỏ hơn matrix_hoc_luc_high.'), { statusCode: 400 });
  }
  if (merged.do_phu_min < 0 || merged.do_phu_min > 100) {
    throw Object.assign(new Error('do_phu_min phải trong khoảng 0–100.'), { statusCode: 400 });
  }
  if (![0, 1].includes(Number(merged.hoc_luc_mode))) {
    throw Object.assign(new Error('hoc_luc_mode chỉ nhận 0 hoặc 1.'), { statusCode: 400 });
  }
  return updates;
}

async function updateMatchConfig(input) {
  const updates = validateMatchConfig(input);
  const before = getMatchConfig();
  const now = Date.now();
  await runAuthMutation(() => {
    for (const [key, value] of Object.entries(updates)) {
      const existing = queryAll('SELECT key FROM career_match_config WHERE key = ?', [key]);
      if (existing.length) {
        runSql('UPDATE career_match_config SET value = ?, updated_at = ? WHERE key = ?', [value, now, key]);
      } else {
        runSql(
          'INSERT INTO career_match_config (key, value, note, updated_at) VALUES (?, ?, NULL, ?)',
          [key, value, now]
        );
      }
    }
  });
  const changes = Object.entries(updates).map(([key, value]) => ({
    key,
    oldValue: before[key],
    newValue: value,
  }));
  return { config: getMatchConfig(), rows: getMatchConfigRows(), changes };
}

function clearStatsCache() {
  statsCache.clear();
}

module.exports = {
  CACHE_TTL_MS,
  DEFAULT_CONFIG,
  REASONS,
  buildDistribution,
  finalizeDistribution,
  countBelow,
  countAtOrAbove,
  P,
  pBench,
  percentile,
  zScore,
  getStatsForCombos,
  getComboStats,
  publicStats,
  buildBenchmark,
  tinhCachFit,
  hocLucFit,
  tongHopFit,
  matrixCell,
  getWeightsMap,
  getMatchConfig,
  getMatchConfigRows,
  validateMatchConfig,
  updateMatchConfig,
  clearStatsCache,
  GROUP_ORDER,
};
