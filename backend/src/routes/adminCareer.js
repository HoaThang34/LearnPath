const express = require('express');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const { getRubrics, saveRubric, deleteRubric, seedSampleRubrics } = require('../auth/career');
const { queryAll } = require('../database/db');
const { asyncRoute, parseId } = require('../admin/routeUtils');
const { HttpError } = require('../admin/errors');

const router = express.Router();
router.use(requireAdmin, requireAdminCsrf);

async function audit(req, action, id, details) {
  await writeAudit({ adminId: req.admin.id, adminUsername: req.admin.username, action, entity: 'career_rubric', entityId: id, details, ip: getClientIp(req) });
}

router.get('/rubrics', asyncRoute(async (req, res) => res.json({ data: getRubrics() })));
router.post('/rubrics/seed', asyncRoute(async (req, res) => {
  const rubrics = await seedSampleRubrics(true);
  await audit(req, 'admin.career_rubric.seed', null, { seededCount: rubrics.length });
  return res.json({ data: { rubrics } });
}));
router.get('/admission-majors', asyncRoute(async (req, res) => {
  try {
    await getDb();
  } catch (e) {
    return res.json({ data: [] });
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const clauses = ['nam = 2025', "phuong_thuc = 'Điểm thi THPT'"];
  const params = [];
  if (search) {
    clauses.push('(nganh LIKE ? OR truong LIKE ? OR ma_truong LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  let rows = [];
  try {
    rows = queryAll(`SELECT DISTINCT ma_truong AS schoolCode, truong AS schoolName, nganh AS majorName,
      to_hop_mon AS admissionBlock, phuong_thuc AS method, diem_chuan AS entryScore
      FROM diem_chuan WHERE ${clauses.join(' AND ')} ORDER BY truong, nganh LIMIT 50`, params);
  } catch (err) {
    rows = [];
  }
  return res.json({ data: rows });
}));
router.put('/rubrics', asyncRoute(async (req, res) => {
  let id;
  try {
    id = await saveRubric(req.body);
  } catch (error) {
    if (error.statusCode) throw new HttpError(error.statusCode, error.message);
    throw error;
  }
  await audit(req, 'admin.career_rubric.upsert', id, { schoolName: req.body.schoolName, majorName: req.body.majorName, method: req.body.method, year: req.body.year, subjectCount: req.body.subjects?.length });
  return res.json({ data: { id, rubrics: getRubrics() } });
}));
router.delete('/rubrics/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(400, 'Mã rubric không hợp lệ.');
  if (!(await deleteRubric(id))) throw new HttpError(404, 'Không tìm thấy rubric.');
  await audit(req, 'admin.career_rubric.delete', id, null);
  return res.status(204).end();
}));

module.exports = router;
