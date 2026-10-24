const express = require('express');
const { requireAuth, requirePasswordChanged } = require('../auth/session');
const { queryAll, queryOne } = require('../database/db');
const { parsePagination } = require('./queryParams');
const {
  getAcademicScores, saveAcademicScores, getCareerSelections, addCareerSelection,
  removeCareerSelection, getRubrics, calculateCareerFit,
} = require('../auth/career');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged);

const ADMISSION_SUBJECTS = {
  A00: ['Toán', 'Vật lý', 'Hóa học'], A01: ['Toán', 'Vật lý', 'Tiếng Anh'],
  A02: ['Toán', 'Vật lý', 'Sinh học'], A03: ['Toán', 'Vật lý', 'Lịch sử'],
  B00: ['Toán', 'Hóa học', 'Sinh học'], B08: ['Toán', 'Sinh học', 'Tiếng Anh'],
  C00: ['Ngữ văn', 'Lịch sử', 'Địa lý'], C03: ['Ngữ văn', 'Toán', 'Lịch sử'],
  C04: ['Ngữ văn', 'Toán', 'Địa lý'], D01: ['Toán', 'Ngữ văn', 'Tiếng Anh'],
  D07: ['Toán', 'Hóa học', 'Tiếng Anh'], D14: ['Ngữ văn', 'Lịch sử', 'Tiếng Anh'],
};

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

router.get('/overview', (req, res) => {
  const scores = getAcademicScores(req.user.id);
  const selections = getCareerSelections(req.user.id);
  const rubrics = getRubrics();
  const grouped = new Map();
  for (const rubric of rubrics) {
    if (!grouped.has(rubric.id)) grouped.set(rubric.id, []);
    grouped.get(rubric.id).push(rubric);
  }
  const selectedClassLevel = typeof req.query.classLevel === 'string' ? req.query.classLevel : '';
  const selectedTerm = typeof req.query.term === 'string' ? req.query.term : '';
  const selectedScores = scores.filter((score) => (!selectedClassLevel || score.classLevel === selectedClassLevel) && (!selectedTerm || score.term === selectedTerm));
  const fits = [];
  const selectedSnapshotScores = selectedScores.filter((score) => score.scoreType === 'average');
  for (const [id, rows] of (selectedClassLevel && selectedTerm ? grouped : [])) {
    const fit = calculateCareerFit(selectedSnapshotScores, rows);
    fits.push({ rubricId: id, schoolCode: rows[0].schoolCode, schoolName: rows[0].schoolName, majorName: rows[0].majorName, method: rows[0].method, admissionBlock: rows[0].admissionBlock, year: rows[0].year, ...fit });
  }
  res.json({ data: { scores, selections, fits, selectedClassLevel, selectedTerm } });
});

router.get('/scores', (req, res) => res.json({ data: getAcademicScores(req.user.id) }));
router.put('/scores', async (req, res) => {
  try { return res.json({ data: { scores: await saveAcademicScores(req.user.id, req.body?.scores) } }); } catch (error) { return sendCareerError(res, error); }
});

router.get('/selections', (req, res) => res.json({ data: getCareerSelections(req.user.id) }));
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

router.getAdmissionRows = getAdmissionRows;
router.getDistanceRate = getDistanceRate;

module.exports = router;
