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

function sendCareerError(res, error) {
  if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
  console.error('[career] Request failed:', error);
  return res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý phân tích năng lực.' });
}

function getAdmissionRows(query = {}) {
  const clauses = ['nam = 2025'];
  const params = [];
  for (const [key, column] of [['search', 'nganh'], ['school', 'truong'], ['method', 'phuong_thuc'], ['block', 'to_hop_mon']]) {
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
  const total = Number(queryOne(`SELECT COUNT(*) AS total FROM diem_chuan WHERE ${where}`, params)?.total || 0);
  const rows = queryAll(`SELECT id, ma_truong AS schoolCode, truong AS schoolName, nganh AS majorName,
    to_hop_mon AS admissionBlock, diem_chuan AS entryScore, ghi_chu AS note,
    nam AS year, phuong_thuc AS method FROM diem_chuan WHERE ${where} ORDER BY phuong_thuc, diem_chuan DESC, truong, nganh LIMIT ? OFFSET ?`, [...params, pagination.limit, pagination.offset]);
  return { rows, total, limit: pagination.limit, offset: pagination.offset };
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
  const selectedYear = typeof req.query.schoolYear === 'string' ? req.query.schoolYear : '';
  const selectedTerm = typeof req.query.term === 'string' ? req.query.term : '';
  const selectedScores = scores.filter((score) => (!selectedYear || score.schoolYear === selectedYear) && (!selectedTerm || score.term === selectedTerm));
  const fits = [];
  const selectedSnapshotScores = selectedScores.filter((score) => score.scoreType === 'average');
  for (const [id, rows] of (selectedYear && selectedTerm ? grouped : [])) {
    const fit = calculateCareerFit(selectedSnapshotScores, rows);
    fits.push({ rubricId: id, schoolCode: rows[0].schoolCode, schoolName: rows[0].schoolName, majorName: rows[0].majorName, method: rows[0].method, admissionBlock: rows[0].admissionBlock, year: rows[0].year, ...fit });
  }
  res.json({ data: { scores, selections, fits, selectedYear, selectedTerm } });
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
  try { await removeCareerSelection(req.user.id, Number(req.params.id)); return res.status(204).end(); } catch (error) { return sendCareerError(res, error); }
});

router.get('/majors', (req, res) => {
  try {
    const result = getAdmissionRows(req.query);
    return res.json({ data: result.rows, total: result.total, limit: result.limit, offset: result.offset, year: 2025, warning: 'Điểm chuẩn hiển thị theo dữ liệu năm 2025; không phải dự báo điểm chuẩn năm 2026.' });
  } catch (error) { return sendCareerError(res, error); }
});

module.exports = router;
