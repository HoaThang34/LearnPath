'use strict';

/**
 * Academic index L_m on a 0–100 scale, weighted by the per-major subject
 * priorities r_mj (4 = cốt lõi, 3 = quan trọng, 2 = liên quan, 1 = hỗ trợ).
 *
 *   a_mj = r_mj / Σ_j r_mj
 *   L_m  = 10 × Σ_j a_mj · x_j        (x_j on the 0–10 scale)
 *
 * The data lives in `backend/src/data/career_subject_priorities.json`, which is
 * derived from the normalised subject weights of `edumind_rubrics.json` by
 * `backend/scripts/derive-career-weights.js`.
 */

const fs = require('fs');
const path = require('path');

// Env override exists so tests can point at a temporary copy. Production keeps
// the tracked data file as the single source of truth.
const DATA_FILE =
  process.env.LEARNPATH_SUBJECT_PRIORITIES_PATH ||
  path.join(__dirname, '..', 'data', 'career_subject_priorities.json');

const PRIORITY_LABELS = { 4: 'Cốt lõi', 3: 'Quan trọng', 2: 'Liên quan', 1: 'Hỗ trợ' };
const PRIORITY_MIN = 1;
const PRIORITY_MAX = 4;

const REASONS = {
  THIEU_DIEM_MON: 'thieu_diem_mon',
  KHONG_CO_BO_TRONG_SO: 'khong_co_bo_trong_so',
  BO_TRONG_SO_KHONG_HOP_LE: 'bo_trong_so_khong_hop_le',
};

let cache = null;

function normalizeSubject(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ');
}

function rowKey(row) {
  return [
    String(row.schoolCode || ''),
    String(row.majorName || ''),
    String(row.admissionBlock || ''),
    String(row.method || ''),
    String(row.year || ''),
    row.entryScore === null || row.entryScore === undefined ? '' : String(Number(row.entryScore)),
  ].join('|');
}

function loadPriorities() {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const byKey = new Map();
  const byMajor = new Map();
  let skipped = 0;
  for (const row of raw.rows || []) {
    const subjects = (row.subjects || []).filter(
      (subject) => Number.isFinite(Number(subject.r)) && Number(subject.r) >= PRIORITY_MIN && Number(subject.r) <= PRIORITY_MAX
    );
    if (subjects.length === 0) {
      skipped += 1;
      continue;
    }
    const entry = {
      schoolCode: row.schoolCode || null,
      schoolName: row.schoolName || null,
      majorName: row.majorName,
      admissionBlock: row.admissionBlock || null,
      method: row.method || null,
      year: row.year || null,
      entryScore: row.entryScore === null || row.entryScore === undefined ? null : Number(row.entryScore),
      subjects: subjects.map((subject) => ({
        subject: subject.subject,
        weight: Number(subject.weight),
        r: Number(subject.r),
      })),
    };
    const priorityTotal = entry.subjects.reduce((sum, subject) => sum + subject.r, 0);
    entry.priorityTotal = priorityTotal;
    entry.weights = entry.subjects.map((subject) => ({
      subject: subject.subject,
      r: subject.r,
      a: Math.round((subject.r / priorityTotal) * 10000) / 10000,
    }));
    byKey.set(rowKey(entry), entry);
    if (!byMajor.has(entry.majorName)) byMajor.set(entry.majorName, entry);
  }
  cache = {
    meta: {
      version: raw.version,
      scale: raw.scale,
      formula: raw.formula,
      updatedAt: raw.updatedAt || null,
      updatedBy: raw.updatedBy || null,
    },
    byKey,
    byMajor,
    skipped,
  };
  return cache;
}

function clearCache() {
  cache = null;
}

function getPriorityConfig() {
  const { meta, byKey, skipped } = loadPriorities();
  return {
    version: meta.version || 1,
    scale: meta.scale || PRIORITY_LABELS,
    formula: meta.formula || 'a_mj = r_mj / Σ_j r_mj ; L_m = 10 × Σ_j a_mj x_j',
    updatedAt: meta.updatedAt || null,
    updatedBy: meta.updatedBy || null,
    rowCount: byKey.size,
    skippedRows: skipped,
  };
}

function findPriorityRow({ schoolCode, majorName, admissionBlock, method, year, entryScore }) {
  const { byKey, byMajor } = loadPriorities();
  const exact = byKey.get(
    rowKey({ schoolCode, majorName, admissionBlock, method, year, entryScore })
  );
  if (exact) return { row: exact, matchedBy: 'exact' };
  const fallback = byMajor.get(majorName);
  return fallback ? { row: fallback, matchedBy: 'major' } : { row: null, matchedBy: null };
}

/**
 * @param {object} input
 * @param {object} input.row      Priority row (already resolved)
 * @param {Map<string,number>} input.scores  Subject → score on the 0–10 scale
 */
function hocLucSubjectFit({ row, scores }) {
  if (!row) {
    return {
      value: null,
      coveragePct: 0,
      method: 'subject_priority',
      reasons: [REASONS.KHONG_CO_BO_TRONG_SO],
      weights: [],
      missing: [],
    };
  }
  const scoreMap = scores instanceof Map ? scores : new Map(Object.entries(scores || {}));
  // The caller may key scores by canonical names ("Toán") while this module
  // normalises to lower case. Build a case-insensitive index once.
  const loweredScores = new Map();
  for (const [key, value] of scoreMap.entries()) {
    loweredScores.set(normalizeSubject(key), value);
  }
  const lookup = (subject) => loweredScores.get(normalizeSubject(subject));
  let weighted = 0;
  let presentPriority = 0;
  const missing = [];
  for (const subject of row.subjects) {
    const score = lookup(subject.subject);
    if (score === undefined || score === null || !Number.isFinite(Number(score))) {
      missing.push(subject.subject);
      continue;
    }
    const value = Number(score);
    weighted += (subject.r / row.priorityTotal) * value;
    presentPriority += subject.r;
  }
  const coveragePct = Math.round((presentPriority / row.priorityTotal) * 1000) / 10;
  const weights = row.weights.map((subject) => ({
    subject: subject.subject,
    r: subject.r,
    a: subject.a,
    label: PRIORITY_LABELS[subject.r] || null,
    score: lookup(subject.subject) ?? null,
  }));
  if (missing.length > 0) {
    return {
      value: null,
      coveragePct,
      method: 'subject_priority',
      reasons: [REASONS.THIEU_DIEM_MON],
      weights,
      missing,
    };
  }
  return {
    value: Math.round(10 * weighted * 10) / 10,
    coveragePct: 100,
    method: 'subject_priority',
    reasons: [],
    weights,
    missing: [],
  };
}

module.exports = {
  PRIORITY_LABELS,
  PRIORITY_MIN,
  PRIORITY_MAX,
  REASONS,
  loadPriorities,
  clearCache,
  getPriorityConfig,
  findPriorityRow,
  hocLucSubjectFit,
  normalizeSubject,
  rowKey,
};
