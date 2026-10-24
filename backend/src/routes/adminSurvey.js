const express = require('express');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const {
  getAllAdminSurveyQuestions,
  createAdminSurveyQuestion,
  updateAdminSurveyQuestion,
  deleteAdminSurveyQuestion,
  seedSampleSurveyQuestions,
} = require('../auth/survey');
const { parseId, asyncRoute } = require('../admin/routeUtils');
const { HttpError } = require('../admin/errors');

const router = express.Router();

router.use(requireAdmin);
router.use(requireAdminCsrf);

function requireQuestionId(req) {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(400, 'Mã câu hỏi khảo sát không hợp lệ.');
  return id;
}

async function audit(req, action, entityId, details = null) {
  await writeAudit({
    adminId: req.admin.id,
    adminUsername: req.admin.username,
    action,
    entity: 'survey_question',
    entityId: String(entityId),
    details,
    ip: getClientIp(req),
  });
}

router.get(
  '/questions',
  asyncRoute(async (req, res) => {
    const questions = getAllAdminSurveyQuestions();
    return res.json({ data: questions });
  })
);

router.post(
  '/questions',
  asyncRoute(async (req, res) => {
    const created = await createAdminSurveyQuestion(req.body);
    await audit(req, 'admin.survey_question.create', created.id, {
      question: created.question,
      questionType: created.questionType,
      isRequired: created.isRequired,
      orderIndex: created.orderIndex,
      isActive: created.isActive,
    });
    return res.status(201).json({ data: created });
  })
);

router.post(
  '/questions/sample',
  asyncRoute(async (req, res) => {
    const created = await seedSampleSurveyQuestions();
    await audit(req, 'admin.survey_question.seed_sample', 'bulk', {
      count: created.length,
    });
    return res.status(201).json({ data: created, count: created.length });
  })
);

router.put(
  '/questions/:id',
  asyncRoute(async (req, res) => {
    const id = requireQuestionId(req);
    const updated = await updateAdminSurveyQuestion(id, req.body);
    await audit(req, 'admin.survey_question.update', id, {
      question: updated.question,
      questionType: updated.questionType,
      isRequired: updated.isRequired,
      orderIndex: updated.orderIndex,
      isActive: updated.isActive,
    });
    return res.json({ data: updated });
  })
);

router.delete(
  '/questions/:id',
  asyncRoute(async (req, res) => {
    const id = requireQuestionId(req);
    const deleted = await deleteAdminSurveyQuestion(id);
    await audit(req, 'admin.survey_question.delete', id, {
      question: deleted.question,
    });
    return res.status(204).end();
  })
);

module.exports = router;
