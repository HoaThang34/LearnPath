'use strict';

const { getAcademicScores, getCareerSelections, getRubrics, calculateCareerFit, normalizeSubject } = require('../auth/career');
const { getExamScoreMap } = require('./examScores');
const { getBlockSubjects } = require('./subjects');
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
  let selectedClassLevel = typeof query.classLevel === 'string' ? query.classLevel.trim() : '';
  let selectedTerm = typeof query.term === 'string' ? query.term.trim() : '';
  if (!selectedClassLevel && !selectedTerm && scores.length > 0) {
    selectedClassLevel = scores[0].classLevel;
    selectedTerm = scores[0].term;
  }
  const legacyScores = scores.filter(
    (row) => (!selectedClassLevel || row.classLevel === selectedClassLevel) && (!selectedTerm || row.term === selectedTerm)
  );

  const academicScoreBySubject = new Map();
  for (const row of legacyScores) {
    const sub = normalizeSubject(row.subject || row.subject_name);
    if (sub && Number.isFinite(Number(row.score))) {
      academicScoreBySubject.set(sub, Number(row.score));
    }
  }

  const rows = [];
  for (const [id, rubricRows] of grouped) {
    const rubric = rubricRows[0];
    const combo = rubricBlock(rubric);
    const entryScore =
      rubric.entryScore === null || rubric.entryScore === undefined ? null : Number(rubric.entryScore);

    let tStudent = combo ? examScores.get(combo) ?? null : null;
    let tStudentSource = tStudent !== null ? 'exam_scores' : null;

    if (tStudent === null && combo) {
      const comboSubjects = getBlockSubjects(combo);
      if (comboSubjects && comboSubjects.length > 0) {
        const studentSubjectScores = comboSubjects.map((sub) => academicScoreBySubject.get(normalizeSubject(sub)));
        const allPresent = studentSubjectScores.every((sc) => sc !== undefined && sc !== null && Number.isFinite(sc));
        if (allPresent) {
          tStudent = Math.round(studentSubjectScores.reduce((acc, sc) => acc + sc, 0) * 100) / 100;
          tStudentSource = 'academic_scores';
        }
      }
    }

    let effectiveEntryScore = entryScore;
    let isScale40 = false;
    if (entryScore !== null && entryScore > 30 && entryScore <= 40) {
      effectiveEntryScore = Math.round((entryScore * 30 / 40) * 100) / 100;
      isScale40 = true;
    }

    const stats = combo ? statsMap.get(combo) || null : null;
    const legacyFitPct = calculateCareerFit(legacyScores, rubricRows).fitPct;

    const hoc = hocLucFit({
      tStudent,
      combo,
      entryScore: effectiveEntryScore,
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
      else if (tStudent === null) reasons.push(REASONS.THIEU_DIEM_THI);
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
      effectiveEntryScore,
      isScale40,
      tStudent,
      tStudentSource,
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
