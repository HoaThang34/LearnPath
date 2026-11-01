const express = require('express');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const { getRubrics, saveRubric, deleteRubric, seedSampleRubrics } = require('../auth/career');
const { getMatchConfigRows, updateMatchConfig } = require('../career/match');
const { getGroupConfig } = require('../career/groupMatch');
const { getMbtiProfile } = require('../career/mbti');
const { getPriorityConfig } = require('../career/hocLuc');
const {
  listPriorityRows,
  updateGroupWeights,
  updatePriorityRow,
  getMbtiProfileConfig,
  updateMbtiProfile,
} = require('../career/configStore');
const { queryAll } = require('../database/db');
const { asyncRoute, parseId } = require('../admin/routeUtils');
const { HttpError } = require('../admin/errors');

const router = express.Router();
router.use(requireAdmin, requireAdminCsrf);

async function audit(req, action, id, details) {
  await writeAudit({ adminId: req.admin.id, adminUsername: req.admin.username, action, entity: 'career_rubric', entityId: id, details, ip: getClientIp(req) });
}

router.get('/rubrics', asyncRoute(async (req, res) => res.json({ data: getRubrics({ includeInvalid: true }) })));

router.get('/group-config', asyncRoute(async (req, res) =>
  res.json({
    data: {
      groups: getGroupConfig(),
      mbti: getMbtiProfile(),
      priorities: getPriorityConfig(),
      formula: 'F_m = w_L·L_m + w_H·H_m + w_M·M_m (L, H, M trên thang 0–100)',
      warning:
        'Trọng số và mức ưu tiên do nhóm đề xuất, chưa kiểm định trên dữ liệu Việt Nam. ' +
        'F_m là mức đáp ứng yêu cầu của ngành, không phải xác suất trúng tuyển.',
    },
  })
));

router.get('/group-config/priorities', asyncRoute(async (req, res) =>
  res.json({ data: listPriorityRows() })
));

router.get('/group-config/mbti', asyncRoute(async (req, res) =>
  res.json({ data: getMbtiProfileConfig() })
));

router.put('/group-config/mbti', asyncRoute(async (req, res) => {
  const result = updateMbtiProfile(req.body, { updatedBy: req.admin.username });
  if (result.changed) {
    await writeAudit({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'admin.career.mbti_profile.update',
      entity: 'career_mbti_profile',
      entityId: null,
      details: {
        status: result.profile.status,
        updatedAt: result.updatedAt,
        changes: result.changes,
      },
      ip: getClientIp(req),
    });
  }
  return res.json({ data: result });
}));

router.put('/group-config/groups', asyncRoute(async (req, res) => {
  const result = updateGroupWeights(req.body, { updatedBy: req.admin.username });
  if (result.changed) {
    await writeAudit({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'admin.career.group_weights.update',
      entity: 'career_group_weights',
      entityId: null,
      details: { updatedAt: result.updatedAt, changes: result.changes },
      ip: getClientIp(req),
    });
  }
  return res.json({ data: result });
}));

router.put('/group-config/priorities', asyncRoute(async (req, res) => {
  const result = updatePriorityRow(req.body, { updatedBy: req.admin.username });
  if (result.changed) {
    await writeAudit({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'admin.career.subject_priorities.update',
      entity: 'career_subject_priorities',
      entityId: req.body?.key || null,
      details: {
        key: req.body?.key || null,
        updatedAt: result.updatedAt,
        changes: result.changes,
      },
      ip: getClientIp(req),
    });
  }
  return res.json({ data: result });
}));

router.get('/match-config', asyncRoute(async (req, res) =>
  res.json({ data: getMatchConfigRows() })
));

router.put('/match-config', asyncRoute(async (req, res) => {
  const input = req.body?.config && typeof req.body.config === 'object' ? req.body.config : req.body;
  let result;
  try {
    result = await updateMatchConfig(input || {});
  } catch (error) {
    if (error.statusCode) throw new HttpError(error.statusCode, error.message);
    throw error;
  }
  await writeAudit({
    adminId: req.admin.id,
    adminUsername: req.admin.username,
    action: 'admin.career.match_config.update',
    entity: 'career_match_config',
    entityId: null,
    details: { changes: result.changes },
    ip: getClientIp(req),
  });
  return res.json({ data: result });
}));

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
