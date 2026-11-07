const express = require('express');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const { asyncRoute, parseId } = require('../admin/routeUtils');
const { HttpError } = require('../admin/errors');
const {
  listCurriculums,
  getCurriculumById,
  getCurriculumOptions,
  createCurriculum,
  updateCurriculum,
  deleteCurriculum,
} = require('../curriculum/curriculumStore');

const router = express.Router();

router.use(requireAdmin);
router.use(requireAdminCsrf);

function requireCurriculumId(req) {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(400, 'Mã chương trình học không hợp lệ.');
  return id;
}

async function audit(req, action, entityId, details = null) {
  await writeAudit({
    adminId: req.admin.id,
    adminUsername: req.admin.username,
    action,
    entity: 'curriculum',
    entityId: String(entityId),
    details,
    ip: getClientIp(req),
  });
}

// GET /api/admin/curriculum/options
router.get(
  '/options',
  asyncRoute(async (req, res) => {
    const options = getCurriculumOptions();
    return res.json({ data: options });
  })
);

// GET /api/admin/curriculum/:id
router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = requireCurriculumId(req);
    const item = getCurriculumById(id);
    if (!item) {
      throw new HttpError(404, 'Không tìm thấy chương trình học.');
    }
    return res.json({ data: item });
  })
);

// GET /api/admin/curriculum
router.get(
  '/',
  asyncRoute(async (req, res) => {
    const { search, school, major, limit, offset } = req.query;
    const result = listCurriculums({ search, school, major, limit, offset });
    return res.json({
      data: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  })
);

// POST /api/admin/curriculum
router.post(
  '/',
  asyncRoute(async (req, res) => {
    try {
      const created = await createCurriculum(req.body);
      await audit(req, 'admin.curriculum.create', created.id, {
        schoolName: created.schoolName,
        majorName: created.majorName,
        degreeLevel: created.degreeLevel,
        durationYears: created.durationYears,
      });
      return res.status(201).json({ data: created });
    } catch (err) {
      if (err.statusCode) {
        throw new HttpError(err.statusCode, err.message);
      }
      throw err;
    }
  })
);

// PUT /api/admin/curriculum/:id
router.put(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = requireCurriculumId(req);
    try {
      const updated = await updateCurriculum(id, req.body);
      await audit(req, 'admin.curriculum.update', id, {
        schoolName: updated.schoolName,
        majorName: updated.majorName,
        degreeLevel: updated.degreeLevel,
      });
      return res.json({ data: updated });
    } catch (err) {
      if (err.statusCode) {
        throw new HttpError(err.statusCode, err.message);
      }
      throw err;
    }
  })
);

// DELETE /api/admin/curriculum/:id
router.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = requireCurriculumId(req);
    try {
      const deleted = await deleteCurriculum(id);
      await audit(req, 'admin.curriculum.delete', id, {
        schoolName: deleted.schoolName,
        majorName: deleted.majorName,
      });
      return res.status(204).end();
    } catch (err) {
      if (err.statusCode) {
        throw new HttpError(err.statusCode, err.message);
      }
      throw err;
    }
  })
);

module.exports = router;
