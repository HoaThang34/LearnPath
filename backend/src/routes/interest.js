'use strict';

const express = require('express');
const { requireAuth, requirePasswordChanged } = require('../auth/session');
const {
  getInstrumentPayload,
  getAttemptState,
  getAttemptRow,
  createDraft,
  updateAttemptMeta,
  saveResponses,
  submitAttempt,
  deleteAttempt,
  resetUser,
  getLatestResult,
  getResult,
  getStatus,
} = require('../interest/store');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged);

function sendError(res, error, fallback) {
  if (error && error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  console.error(`[interest] ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

function parseAttemptId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/instrument', (req, res) => {
  try {
    return res.json({ data: getInstrumentPayload() });
  } catch (error) {
    return sendError(res, error, 'Không thể tải bộ câu hỏi sở thích.');
  }
});

router.get('/attempt', (req, res) => {
  try {
    const state = getAttemptState(req.user.id);
    return res.json({
      data: { ...state, status: getStatus(req.user.id) },
    });
  } catch (error) {
    return sendError(res, error, 'Không thể tải bài làm sở thích.');
  }
});

router.post('/attempt', async (req, res) => {
  try {
    const result = await createDraft(req.user.id, req.body || {});
    return res.status(result.created ? 201 : 200).json({ data: result });
  } catch (error) {
    return sendError(res, error, 'Không thể tạo bài làm sở thích.');
  }
});

router.patch('/attempt/:id', async (req, res) => {
  try {
    const attemptId = parseAttemptId(req.params.id);
    if (!attemptId) return res.status(400).json({ error: 'Mã bài làm không hợp lệ.' });
    const draft = await updateAttemptMeta(req.user.id, attemptId, req.body || {});
    return res.json({ data: { draft } });
  } catch (error) {
    return sendError(res, error, 'Không thể lưu thông tin đầu bài.');
  }
});

router.patch('/attempt/:id/responses', async (req, res) => {
  try {
    const attemptId = parseAttemptId(req.params.id);
    if (!attemptId) return res.status(400).json({ error: 'Mã bài làm không hợp lệ.' });
    const result = await saveResponses(req.user.id, attemptId, req.body?.responses);
    return res.json({ data: result });
  } catch (error) {
    return sendError(res, error, 'Không thể lưu câu trả lời.');
  }
});

router.post('/attempt/:id/submit', async (req, res) => {
  try {
    const attemptId = parseAttemptId(req.params.id);
    if (!attemptId) return res.status(400).json({ error: 'Mã bài làm không hợp lệ.' });
    const result = await submitAttempt(req.user.id, attemptId, req.body || {});
    return res.json({ data: result });
  } catch (error) {
    return sendError(res, error, 'Không thể nộp bài làm sở thích.');
  }
});

router.get('/results/latest', (req, res) => {
  try {
    return res.json({ data: getLatestResult(req.user.id) });
  } catch (error) {
    return sendError(res, error, 'Không thể tải kết quả sở thích.');
  }
});

router.get('/results/:attemptId', (req, res) => {
  try {
    const attemptId = parseAttemptId(req.params.attemptId);
    if (!attemptId) return res.status(400).json({ error: 'Mã bài làm không hợp lệ.' });
    return res.json({ data: getResult(req.user.id, attemptId) });
  } catch (error) {
    return sendError(res, error, 'Không thể tải kết quả sở thích.');
  }
});

router.delete('/attempt/:id', async (req, res) => {
  try {
    const attemptId = parseAttemptId(req.params.id);
    if (!attemptId) return res.status(400).json({ error: 'Mã bài làm không hợp lệ.' });
    const attempt = getAttemptRow(req.user.id, attemptId);
    if (!attempt) return res.status(404).json({ error: 'Không tìm thấy bài làm.' });
    await deleteAttempt(req.user.id, attemptId);
    return res.status(204).end();
  } catch (error) {
    return sendError(res, error, 'Không thể xoá bài làm sở thích.');
  }
});

router.post('/reset', async (req, res) => {
  try {
    await resetUser(req.user.id);
    return res.json({ data: { reset: true } });
  } catch (error) {
    return sendError(res, error, 'Không thể đặt lại kết quả sở thích.');
  }
});

module.exports = router;
