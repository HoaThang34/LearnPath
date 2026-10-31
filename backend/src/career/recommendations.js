'use strict';

const { getAcademicScores, getCareerSelections, getRubrics, calculateCareerFit } = require('../auth/career');
const { getExamScoreMap } = require('./examScores');
const { getLatestResult } = require('../interest/store');
const {
  getWeightsMap,
  getMatchConfig,
  getStatsForCombos,
  publicStats,
  hocLucFit,
  tinhCachFit,
  tongHopFit,
  matrixCell,
  pBench,
  REASONS,
} = require('./match');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function rubricBlock(rubric) {
  const match = String(rubric.admissionBlock || '').toUpperCase().match(/[A-Z][0-9]{2}/);
  return match ? match[0] : null;
}

function sortRows(rows, sort) {
  const key = sort === 'tinhCach_desc' ? 'tinhCachFit' : sort === 'hocLuc_desc' ? 'hocLucFit' : 'tongHopFit';
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    if (av !== null && bv !== null && bv !== av) return bv - av;
    const am = a.diemVuotChuan ?? -Infinity;
    const bm = b.diemVuotChuan ?? -Infinity;
    if (bm !== am) return bm - am;
    const ae = a.entryScore ?? 0;
    const be = b.entryScore ?? 0;
    if (be !== ae) return be - ae;
    return (
      String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi') ||
      String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi')
    );
  });
}

async function buildRecommendations(userId, query = {}) {
  const config = getMatchConfig();
  const rubrics = getRubrics();
  const grouped = new Map();
  for (const row of rubrics) {
    if (!grouped.has(row.id)) grouped.set(row.id, []);
    grouped.get(row.id).push(row);
  }

  const examScores = getExamScoreMap(userId);
  const interest = getLatestResult(userId);
  const groups = interest?.part1?.groups || [];
  const weightsMap = getWeightsMap();

  const combos = [...new Set([...grouped.values()].map((rows) => rubricBlock(rows[0])).filter(Boolean))];
  const statsMap = combos.length ? await getStatsForCombos(combos) : new Map();

  const scores = getAcademicScores(userId).filter((row) => (row.scoreType || 'average') === 'average');
  const selectionKey = (row) =>
    [row.schoolCode || '', row.majorName || '', row.method || '', row.admissionBlock || '', row.year].join('|');
  const selections = getCareerSelections(userId);
  const targetKeys = new Set(
    selections.filter((row) => row.kind === 'target').map(selectionKey)
  );
  const pinnedKeys = new Set(
    selections.filter((row) => row.kind === 'pinned').map(selectionKey)
  );
  const classLevel = typeof query.classLevel === 'string' ? query.classLevel.trim() : '';
  const term = typeof query.term === 'string' ? query.term.trim() : '';
  const legacyScores = scores.filter(
    (row) => (!classLevel || row.classLevel === classLevel) && (!term || row.term === term)
  );

  const rows = [];
  for (const [id, rubricRows] of grouped) {
    const rubric = rubricRows[0];
    const combo = rubricBlock(rubric);
    const entryScore =
      rubric.entryScore === null || rubric.entryScore === undefined ? null : Number(rubric.entryScore);
    const tStudent = combo ? examScores.get(combo) ?? null : null;
    const stats = combo ? statsMap.get(combo) || null : null;
    const legacyFitPct = calculateCareerFit(legacyScores, rubricRows).fitPct;

    const hoc = hocLucFit({
      tStudent,
      combo,
      entryScore,
      stats,
      legacyFitPct,
      mode: Number(config.hoc_luc_mode),
    });
    const weights = weightsMap.get(rubric.majorGroup) || null;
    const tinh = tinhCachFit(groups, weights, { doPhuMin: config.do_phu_min });
    const tong = tongHopFit(hoc.value, tinh, config);
    const matrix = matrixCell(hoc.value, tinh, config);

    const reasons = [...hoc.reasons, ...tinh.reasons, ...tong.reasons];
    let pBenchValue = null;
    if (rubric.method === 'Điểm thi THPT') {
      if (tStudent !== null && stats) pBenchValue = pBench(tStudent, stats);
      else reasons.push(REASONS.THIEU_DIEM_THI);
    } else {
      reasons.push(REASONS.PHUONG_THUC_KHAC);
    }

    const selection = selectionKey(rubric);
    rows.push({
      rubricId: Number(id),
      schoolCode: rubric.schoolCode,
      schoolName: rubric.schoolName,
      majorName: rubric.majorName,
      majorGroup: rubric.majorGroup || 'Khác',
      admissionBlock: rubric.admissionBlock,
      method: rubric.method,
      year: rubric.year,
      entryScore,
      hocLucFit: hoc.value,
      coveragePct: hoc.coveragePct,
      hocLucMethod: hoc.method,
      diemVuotChuan: hoc.diemVuotChuan,
      tinhCachFit: tinh.value,
      doPhuTinhCach: tinh.doPhu,
      tinhCachStatus: tinh.status,
      tongHopFit: tong.value,
      matrixCell: matrix,
      pBench: pBenchValue,
      pStudent: hoc.pStudent ?? null,
      pEntry: hoc.pEntry ?? null,
      legacyFitPct,
      reasons: unique(reasons),
      isTarget: targetKeys.has(selection),
      isPinned: pinnedKeys.has(selection),
    });
  }

  const sort = ['tongHop_desc', 'tinhCach_desc', 'hocLuc_desc'].includes(query.sort)
    ? query.sort
    : 'tongHop_desc';
  const sorted = sortRows(rows, sort);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(Number(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const stats = {};
  for (const [combo, value] of statsMap.entries()) stats[combo] = publicStats(value);

  return {
    data: sorted.slice(offset, offset + limit),
    total: sorted.length,
    page,
    limit,
    sort,
    year: 2025,
    warning:
      'Điểm chuẩn hiển thị là dữ liệu năm 2025; ba tỉ lệ phù hợp là mức đáp ứng yêu cầu của ngành, ' +
      'không phải xác suất trúng tuyển.',
    config: {
      w_hoc_luc: config.w_hoc_luc,
      w_tinh_cach: config.w_tinh_cach,
      matrix_hoc_luc_high: config.matrix_hoc_luc_high,
      matrix_hoc_luc_low: config.matrix_hoc_luc_low,
      matrix_tinh_cach: config.matrix_tinh_cach,
      do_phu_min: config.do_phu_min,
      hoc_luc_mode: config.hoc_luc_mode,
    },
    stats,
  };
}

module.exports = {
  buildRecommendations,
  sortRows,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
