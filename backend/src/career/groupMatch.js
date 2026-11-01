'use strict';

/**
 * Three-component major fit for the 12 major groups:
 *
 *   F_m = w_L,g · L_m + w_H,g · H_m + w_M,g · M_m
 *
 * with L = academic index (career/hocLuc.js), H = Holland fit (the existing
 * RIASEC histogram intersection) and M = the MBTI comparison term
 * (career/mbti.js). All three components are on a 0–100 scale and every weight
 * is positive.
 *
 * Degradation is explicit, never silent:
 *  - a null component keeps `value` null;
 *  - `partialValue` re-normalises the remaining weights so the UI can still
 *    show a number, but it always carries the missing components and a note;
 *  - `contributions` lists each term so the UI can print the arithmetic.
 */

const fs = require('fs');
const path = require('path');

// Env overrides exist so tests can point at temporary copies. Production keeps
// the tracked data files as the single source of truth.
const GROUPS_FILE =
  process.env.LEARNPATH_GROUP_WEIGHTS_PATH ||
  path.join(__dirname, '..', 'data', 'career_group_weights.json');
const MAPPING_FILE =
  process.env.LEARNPATH_MAJOR_GROUPS_PATH ||
  path.join(__dirname, '..', 'data', 'career_major_groups.json');

const COMPONENTS = ['L', 'H', 'M'];
const COMPONENT_LABELS = { L: 'Học lực', H: 'Holland', M: 'MBTI' };

const REASONS = {
  THIEU_HOC_LUC: 'thieu_hoc_luc',
  THIEU_HOLLAND: 'thieu_holland',
  THIEU_MBTI: 'thieu_mbti',
  KHONG_XAC_DINH_DUOC_KHOI: 'khong_xac_dinh_duoc_khoi',
  TRONG_SO_KHONG_HOP_LE: 'trong_so_khong_hop_le',
};

let cache = null;

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function loadConfig() {
  if (cache) return cache;
  const groupsRaw = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  const mappingRaw = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const groups = new Map();
  const invalidGroups = [];
  for (const group of groupsRaw.groups || []) {
    const wHocLuc = Number(group.wHocLuc);
    const wHolland = Number(group.wHolland);
    const wMbti = Number(group.wMbti);
    const total = wHocLuc + wHolland + wMbti;
    if (!Number.isFinite(total) || Math.abs(total - 1) > 0.002 || [wHocLuc, wHolland, wMbti].some((w) => w < 0)) {
      invalidGroups.push(group.code);
      continue;
    }
    groups.set(group.code, {
      code: group.code,
      label: group.label,
      riasecGroup: group.riasecGroup || null,
      judgments: group.judgments || null,
      wHocLuc,
      wHolland,
      wMbti,
      note: group.note || '',
    });
  }
  const majorToGroup = new Map();
  for (const row of mappingRaw.majors || []) {
    if (row.groupCode && groups.has(row.groupCode)) majorToGroup.set(row.majorName, row.groupCode);
  }
  cache = {
    method: groupsRaw.method || '',
    note: groupsRaw.note || '',
    version: groupsRaw.version || 1,
    updatedAt: groupsRaw.updatedAt || null,
    updatedBy: groupsRaw.updatedBy || null,
    groups,
    majorToGroup,
    invalidGroups,
  };
  return cache;
}

function clearCache() {
  cache = null;
}

function getGroupConfig() {
  const config = loadConfig();
  return {
    version: config.version,
    method: config.method,
    note: config.note,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    components: COMPONENTS.map((code) => ({ code, label: COMPONENT_LABELS[code] })),
    groups: [...config.groups.values()].map((group) => ({
      code: group.code,
      label: group.label,
      riasecGroup: group.riasecGroup,
      judgments: group.judgments,
      wHocLuc: group.wHocLuc,
      wHolland: group.wHolland,
      wMbti: group.wMbti,
      note: group.note,
      majorCount: [...config.majorToGroup.values()].filter((code) => code === group.code).length,
    })),
    invalidGroups: config.invalidGroups,
    mappedMajors: config.majorToGroup.size,
  };
}

function resolveGroup(majorName) {
  const config = loadConfig();
  const code = config.majorToGroup.get(String(majorName || ''));
  return code ? config.groups.get(code) : null;
}

function normalizeComponent(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

/**
 * @param {object} input
 * @param {string} input.majorName
 * @param {number|null} input.hocLuc
 * @param {number|null} input.holland
 * @param {number|null} input.mbti
 * @param {string} [input.groupCode] override resolution (admin preview/tests)
 */
function groupFit({ majorName, hocLuc, holland, hollandStatus, mbti, groupCode } = {}) {
  const config = loadConfig();
  const group = groupCode ? config.groups.get(groupCode) || null : resolveGroup(majorName);
  if (!group) {
    return {
      groupCode: null,
      groupLabel: null,
      value: null,
      partialValue: null,
      coverageWeight: 0,
      reasons: [REASONS.KHONG_XAC_DINH_DUOC_KHOI],
      missing: COMPONENTS.slice(),
      contributions: [],
      weights: null,
    };
  }

  const hollandVal = normalizeComponent(holland);
  const isHollandComplete = hollandVal !== null && (!hollandStatus || hollandStatus === 'day_du');

  const values = {
    L: normalizeComponent(hocLuc),
    H: isHollandComplete ? hollandVal : null,
    M: normalizeComponent(mbti),
  };
  const weights = { L: group.wHocLuc, H: group.wHolland, M: group.wMbti };
  const reasonByComponent = {
    L: REASONS.THIEU_HOC_LUC,
    H: REASONS.THIEU_HOLLAND,
    M: REASONS.THIEU_MBTI,
  };

  const contributions = [];
  const missing = [];
  const reasons = [];
  let weightedSum = 0;
  let presentWeight = 0;
  for (const component of COMPONENTS) {
    const value = values[component];
    const weight = weights[component];
    if (value === null) {
      missing.push(component);
      reasons.push(reasonByComponent[component]);
      contributions.push({
        component,
        label: COMPONENT_LABELS[component],
        weight: round(weight, 8),
        value: null,
        contribution: null,
      });
      continue;
    }
    const contribution = weight * value;
    weightedSum += contribution;
    presentWeight += weight;
    contributions.push({
      component,
      label: COMPONENT_LABELS[component],
      weight: round(weight, 8),
      value: round(value, 2),
      contribution: round(contribution, 4),
    });
  }

  const complete = missing.length === 0 && presentWeight > 0;
  const partialValue = presentWeight > 0 ? round(weightedSum / presentWeight, 1) : null;

  return {
    groupCode: group.code,
    groupLabel: group.label,
    riasecGroup: group.riasecGroup,
    value: complete ? round(weightedSum, 1) : null,
    partialValue,
    coverageWeight: round(presentWeight, 4),
    reasons,
    missing,
    contributions,
    weights: { wHocLuc: round(weights.L, 8), wHolland: round(weights.H, 8), wMbti: round(weights.M, 8) },
    formula: 'F_m = w_L·L + w_H·H + w_M·M (mọi thành phần thang 0–100)',
  };
}

module.exports = {
  COMPONENTS,
  COMPONENT_LABELS,
  REASONS,
  loadConfig,
  clearCache,
  getGroupConfig,
  resolveGroup,
  groupFit,
};
