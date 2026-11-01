const express = require('express');
const { requireAuth, requirePasswordChanged } = require('../auth/session');
const { queryAll, queryOne } = require('../database/db');
const { parsePagination } = require('./queryParams');
const {
  getAcademicScores, saveAcademicScores, getCareerSelections, addCareerSelection,
  removeCareerSelection, getRubrics, calculateCareerFit, seedSampleRubrics,
} = require('../auth/career');
const { ADMISSION_SUBJECTS, BLOCK_CODES, getBlockSubjects } = require('../career/subjects');
const { getExamScores, saveExamScores } = require('../career/examScores');
const { getComboStats, buildBenchmark } = require('../career/match');
const { buildRecommendations } = require('../career/recommendations');
const { getGroupConfig } = require('../career/groupMatch');
const { getMbtiProfile } = require('../career/mbti');
const { getPriorityConfig } = require('../career/hocLuc');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged);

function normalizeSubject(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('vi');
  const aliases = {
    toan: 'Toán', 'toán': 'Toán', 'vật lý': 'Vật lý', 'vat ly': 'Vật lý', lý: 'Vật lý', ly: 'Vật lý',
    'hóa học': 'Hóa học', 'hoa hoc': 'Hóa học', hóa: 'Hóa học', hoa: 'Hóa học',
    'sinh học': 'Sinh học', 'sinh hoc': 'Sinh học', sinh: 'Sinh học',
    'ngữ văn': 'Ngữ văn', 'ngu van': 'Ngữ văn', văn: 'Ngữ văn', van: 'Ngữ văn',
    'tiếng anh': 'Tiếng Anh', 'tieng anh': 'Tiếng Anh', anh: 'Tiếng Anh',
    'lịch sử': 'Lịch sử', 'lich su': 'Lịch sử', sử: 'Lịch sử', su: 'Lịch sử',
    'địa lý': 'Địa lý', 'dia ly': 'Địa lý', địa: 'Địa lý', dia: 'Địa lý',
  };
  return aliases[normalized] || String(value || '').trim();
}

function getDistanceRate(admissionBlock, entryScore, scores) {
  const scoreBySubject = new Map(scores.map((row) => [normalizeSubject(row.subject), Number(row.score)]));
  const codes = String(admissionBlock || '').toUpperCase().match(/[A-Z][0-9]{2}/g) || [];
  const combinations = [...new Set(codes)].map((code) => ADMISSION_SUBJECTS[code]).filter(Boolean);
  if (!combinations.length || !Number.isFinite(Number(entryScore)) || Number(entryScore) <= 0) return null;
  const totals = combinations
    .filter((subjects) => subjects.every((subject) => Number.isFinite(scoreBySubject.get(subject))))
    .map((subjects) => subjects.reduce((sum, subject) => sum + scoreBySubject.get(subject), 0));
  if (!totals.length) return null;
  return Math.round(Math.min(Math.max(Math.max(...totals) / Number(entryScore) * 100, 0), 100) * 10) / 10;
}

function normalizeStr(s) {
  return String(s || '').trim().toLowerCase();
}

function matchesSelection(sel, rub) {
  if (normalizeStr(sel.schoolName) !== normalizeStr(rub.schoolName)) return false;
  if (normalizeStr(sel.majorName) !== normalizeStr(rub.majorName)) return false;
  if (sel.method && rub.method && normalizeStr(sel.method) !== normalizeStr(rub.method)) return false;
  if (sel.year && rub.year && Number(sel.year) !== Number(rub.year)) return false;
  return true;
}

function getMapData(userId, query = {}) {
  const scores = getAcademicScores(userId);
  const selections = getCareerSelections(userId);
  const rubrics = getRubrics();

  const grouped = new Map();
  for (const rubric of rubrics) {
    if (!grouped.has(rubric.id)) grouped.set(rubric.id, []);
    grouped.get(rubric.id).push(rubric);
  }

  let selectedClassLevel = typeof query.classLevel === 'string' ? query.classLevel : '';
  let selectedTerm = typeof query.term === 'string' ? query.term : '';
  if (!selectedClassLevel && !selectedTerm && scores.length > 0) {
    selectedClassLevel = scores[0].classLevel;
    selectedTerm = scores[0].term;
  }

  const selectedScores = scores.filter((score) => (!selectedClassLevel || score.classLevel === selectedClassLevel) && (!selectedTerm || score.term === selectedTerm));
  const selectedSnapshotScores = selectedScores.filter((score) => score.scoreType === 'average');

  const studentVector = {};
  for (const row of selectedSnapshotScores) {
    if (row.subject && Number.isFinite(Number(row.score))) {
      studentVector[row.subject] = Number(row.score);
    }
  }

  const majors = [];
  for (const [id, rows] of grouped) {
    const rub = rows[0];
    const fit = calculateCareerFit(selectedSnapshotScores, rows);
    const weightVector = {};
    for (const r of rows) {
      if (r.subject) {
        weightVector[r.subject] = Number(r.weight);
      }
    }
    const matchedSel = selections.find((sel) => matchesSelection(sel, rub));
    const isTarget = matchedSel?.kind === 'target';
    const isPinned = matchedSel?.kind === 'pinned';
    const selectionKind = matchedSel ? matchedSel.kind : null;
    const selectionId = matchedSel ? matchedSel.id : null;

    majors.push({
      id,
      schoolCode: rub.schoolCode,
      schoolName: rub.schoolName,
      majorName: rub.majorName,
      majorGroup: rub.majorGroup || 'Khác',
      admissionBlock: rub.admissionBlock,
      entryScore: rub.entryScore !== null && rub.entryScore !== undefined ? Number(rub.entryScore) : null,
      method: rub.method,
      year: rub.year,
      fitPct: fit.fitPct,
      coveragePct: fit.coveragePct,
      status: fit.status,
      weightVector,
      prioritySubject: fit.prioritySubject,
      details: fit.details,
      isTarget,
      isPinned,
      selectionKind,
      selectionId,
    });
  }

  return { majors, studentVector, selectedClassLevel, selectedTerm };
}

function sendCareerError(res, error) {
  if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
  console.error('[career] Request failed:', error);
  return res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý phân tích năng lực.' });
}

function getAdmissionRows(query = {}) {
  const clauses = ['nam = 2025', 'phuong_thuc = ?'];
  const params = ['Điểm thi THPT'];
  for (const [key, column] of [['search', 'nganh'], ['school', 'truong'], ['block', 'to_hop_mon']]) {
    if (typeof query[key] === 'string' && query[key].trim()) {
      clauses.push(`${column} LIKE ?`);
      params.push(`%${query[key].trim().slice(0, 100)}%`);
    }
  }
  const pagination = parsePagination(query, { defaultLimit: 50, maxLimit: 100 });
  if (pagination.error) {
    const error = new Error(pagination.error);
    error.statusCode = 400;
    throw error;
  }
  const where = clauses.join(' AND ');
  const scores = query && query.userId ? getAcademicScores(query.userId).filter((score) => score.classLevel === query.classLevel && score.term === query.term && score.scoreType === 'average') : [];
  const allRows = queryAll(`SELECT id, ma_truong AS schoolCode, truong AS schoolName, nganh AS majorName,
    to_hop_mon AS admissionBlock, diem_chuan AS entryScore, ghi_chu AS note,
    nam AS year, phuong_thuc AS method FROM diem_chuan WHERE ${where}`, params)
    .map((row) => ({ ...row, distanceRate: getDistanceRate(row.admissionBlock, row.entryScore, scores) }));

  const total = allRows.length;
  const sort = typeof query.sort === 'string' ? query.sort.trim() : 'score_desc';

  allRows.sort((a, b) => {
    switch (sort) {
      case 'rate_desc': {
        if (a.distanceRate !== null && b.distanceRate === null) return -1;
        if (a.distanceRate === null && b.distanceRate !== null) return 1;
        if (a.distanceRate !== null && b.distanceRate !== null && b.distanceRate !== a.distanceRate) {
          return b.distanceRate - a.distanceRate;
        }
        return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0) || String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi');
      }
      case 'rate_asc': {
        if (a.distanceRate !== null && b.distanceRate === null) return -1;
        if (a.distanceRate === null && b.distanceRate !== null) return 1;
        if (a.distanceRate !== null && b.distanceRate !== null && a.distanceRate !== b.distanceRate) {
          return a.distanceRate - b.distanceRate;
        }
        return (Number(a.entryScore) || 0) - (Number(b.entryScore) || 0) || String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi');
      }
      case 'score_asc': {
        return (Number(a.entryScore) || 0) - (Number(b.entryScore) || 0) || String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi') || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi');
      }
      case 'school_asc': {
        return String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi') || (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0) || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi');
      }
      case 'school_desc': {
        return String(b.schoolName || '').localeCompare(String(a.schoolName || ''), 'vi') || (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0) || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi');
      }
      case 'score_desc':
      default: {
        return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0) || String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi') || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi');
      }
    }
  });

  const rows = allRows.slice(pagination.offset, pagination.offset + pagination.limit);
  return { rows, total, limit: pagination.limit, offset: pagination.offset, sort };
}

router.get('/overview', async (req, res) => {
  try {
    const scores = getAcademicScores(req.user.id);
    const selections = getCareerSelections(req.user.id);
    let rubrics = getRubrics();
    if (rubrics.length === 0) {
      try {
        rubrics = await seedSampleRubrics(false);
      } catch (e) {
        console.warn('[career] Auto-seed rubrics failed:', e.message);
      }
    }
    const grouped = new Map();
    for (const rubric of rubrics) {
      if (!grouped.has(rubric.id)) grouped.set(rubric.id, []);
      grouped.get(rubric.id).push(rubric);
    }

    let selectedClassLevel = typeof req.query.classLevel === 'string' ? req.query.classLevel : '';
    let selectedTerm = typeof req.query.term === 'string' ? req.query.term : '';
    if (!selectedClassLevel && !selectedTerm && scores.length > 0) {
      selectedClassLevel = scores[0].classLevel;
      selectedTerm = scores[0].term;
    }

    const selectedScores = scores.filter((score) => (!selectedClassLevel || score.classLevel === selectedClassLevel) && (!selectedTerm || score.term === selectedTerm));
    const selectedSnapshotScores = selectedScores.filter((score) => score.scoreType === 'average');

    const fits = [];
    for (const [id, rows] of grouped) {
      const fit = calculateCareerFit(selectedSnapshotScores, rows);
      const rub = rows[0];
      const matchedSel = selections.find((sel) => matchesSelection(sel, rub));
      const isTarget = matchedSel?.kind === 'target';
      const isPinned = matchedSel?.kind === 'pinned';
      const selectionKind = matchedSel ? matchedSel.kind : null;
      const selectionId = matchedSel ? matchedSel.id : null;

      fits.push({
        rubricId: id,
        schoolCode: rub.schoolCode,
        schoolName: rub.schoolName,
        majorName: rub.majorName,
        majorGroup: rub.majorGroup || 'Khác',
        entryScore: rub.entryScore !== null && rub.entryScore !== undefined ? Number(rub.entryScore) : null,
        method: rub.method,
        admissionBlock: rub.admissionBlock,
        year: rub.year,
        isTarget,
        isPinned,
        selectionKind,
        selectionId,
        ...fit,
      });
    }

    fits.sort((a, b) => {
      if (a.isTarget && !b.isTarget) return -1;
      if (!a.isTarget && b.isTarget) return 1;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi');
    });

    const unmatchedSelections = selections.filter((sel) => {
      return !fits.some((fit) => matchesSelection(sel, fit));
    });

    return res.json({ data: { scores, selections, fits, unmatchedSelections, selectedClassLevel, selectedTerm } });
  } catch (error) {
    return sendCareerError(res, error);
  }
});

router.get('/scores', (req, res) => res.json({ data: getAcademicScores(req.user.id) }));
router.put('/scores', async (req, res) => {
  try { return res.json({ data: { scores: await saveAcademicScores(req.user.id, req.body?.scores) } }); } catch (error) { return sendCareerError(res, error); }
});

router.get('/exam-scores', (req, res) => res.json({ data: getExamScores(req.user.id) }));
router.get('/exam-score-options', (req, res) =>
  res.json({
    data: BLOCK_CODES.map((block) => ({ block, subjects: ADMISSION_SUBJECTS[block] })),
  })
);

router.get('/benchmark', async (req, res) => {
  try {
    const combo = String(req.query.combo || '').trim().toUpperCase();
    if (!getBlockSubjects(combo)) {
      return res.status(400).json({ error: 'Tổ hợp môn không hợp lệ.' });
    }
    const score = Number(req.query.score);
    if (!Number.isFinite(score) || score < 0 || score > 30) {
      return res.status(400).json({ error: 'Điểm phải là số từ 0 đến 30.' });
    }
    const stats = await getComboStats(combo);
    if (!stats || !stats.n) {
      return res.status(404).json({ error: 'Chưa có dữ liệu điểm thi cho tổ hợp này.' });
    }
    return res.json({ data: buildBenchmark(combo, score, stats) });
  } catch (error) {
    return sendCareerError(res, error);
  }
});

router.get('/group-config', (req, res) => {
  try {
    return res.json({
      data: {
        groups: getGroupConfig(),
        mbti: getMbtiProfile(),
        priorities: getPriorityConfig(),
        formula: 'F_m = w_L·L_m + w_H·H_m + w_M·M_m (L, H, M trên thang 0–100)',
        warning:
          'Trọng số và mức ưu tiên do nhóm đề xuất, chưa kiểm định trên dữ liệu Việt Nam. ' +
          'F_m là mức đáp ứng yêu cầu của ngành, không phải xác suất trúng tuyển.',
      },
    });
  } catch (error) {
    return sendCareerError(res, error);
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const result = await buildRecommendations(req.user.id, req.query);
    return res.json(result);
  } catch (error) {
    return sendCareerError(res, error);
  }
});
router.put('/exam-scores', async (req, res) => {
  try {
    const scores = await saveExamScores(req.user.id, req.body?.scores);
    return res.json({ data: { scores } });
  } catch (error) {
    return sendCareerError(res, error);
  }
});

router.get('/selections', (req, res) => res.json({ data: getCareerSelections(req.user.id) }));
router.get('/target-options', async (req, res) => {
  try {
    let rubrics = getRubrics();
    if (rubrics.length === 0) {
      try {
        rubrics = await seedSampleRubrics(false);
      } catch (e) {
        console.warn('[career] Auto-seed rubrics failed:', e.message);
      }
    }
    const grouped = new Map();
    for (const r of rubrics) {
      if (!grouped.has(r.id)) {
        grouped.set(r.id, {
          id: r.id,
          schoolCode: r.schoolCode,
          schoolName: r.schoolName,
          majorName: r.majorName,
          majorGroup: r.majorGroup || 'Khác',
          admissionBlock: r.admissionBlock,
          entryScore: r.entryScore !== null && r.entryScore !== undefined ? Number(r.entryScore) : null,
          method: r.method,
          year: r.year,
        });
      }
    }
    const targets = Array.from(grouped.values()).sort((a, b) =>
      String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'vi') ||
      String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi')
    );
    const selections = getCareerSelections(req.user.id);
    const currentTarget = selections.find((s) => s.kind === 'target') || null;

    return res.json({
      data: {
        targets,
        currentTarget,
      },
    });
  } catch (error) {
    return sendCareerError(res, error);
  }
});
router.post('/selections', async (req, res) => {
  try { return res.status(201).json({ data: { selections: await addCareerSelection(req.user.id, req.body) } }); } catch (error) { return sendCareerError(res, error); }
});
router.delete('/selections/:id', async (req, res) => {
  try {
    const removed = await removeCareerSelection(req.user.id, Number(req.params.id));
    if (!removed) return res.status(404).json({ error: 'Không tìm thấy lựa chọn ngành.' });
    return res.status(204).end();
  } catch (error) { return sendCareerError(res, error); }
});

router.get('/majors', (req, res) => {
  try {
    const result = getAdmissionRows({ ...req.query, userId: req.user.id });
    return res.json({ data: result.rows, total: result.total, limit: result.limit, offset: result.offset, year: 2025, warning: 'Điểm chuẩn hiển thị theo dữ liệu năm 2025; không phải dự báo điểm chuẩn năm 2026.' });
  } catch (error) { return sendCareerError(res, error); }
});

router.get('/map-data', async (req, res) => {
  try {
    let rubrics = getRubrics();
    if (rubrics.length === 0) {
      try {
        await seedSampleRubrics(false);
      } catch (e) {
        console.warn('[career] Auto-seed rubrics failed:', e.message);
      }
    }
    const result = getMapData(req.user.id, req.query);
    return res.json({ data: result });
  } catch (error) {
    return sendCareerError(res, error);
  }
});

router.getAdmissionRows = getAdmissionRows;
router.getDistanceRate = getDistanceRate;
router.getMapData = getMapData;

module.exports = router;
