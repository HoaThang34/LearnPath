'use strict';

const express = require('express');
const { requireAuth, requirePasswordChanged } = require('../auth/session');
const { requireTrustedOrigin } = require('../auth/origin');
const { getAgentConfig } = require('../agent/config');
const { runAgentTurn } = require('../agent/loop');
const { AgentUpstreamError } = require('../agent/ollama');
const store = require('../agent/store');

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth, requirePasswordChanged, requireTrustedOrigin);

// In-memory burst limiter and one-run-per-user guard (single process, like auth rate limits).
const burstBuckets = new Map();
const activeRuns = new Set();

function checkBurst(userId, cfg, now = Date.now()) {
  let bucket = burstBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + cfg.burstWindowMs };
    burstBuckets.set(userId, bucket);
  }
  if (bucket.count >= cfg.burstLimit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function sendError(res, error, fallback) {
  if (error && error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  console.error(`[agent] ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/status', (req, res) => {
  try {
    const cfg = getAgentConfig();
    const usage = store.getUsage(req.user.id);
    return res.json({
      data: {
        enabled: cfg.enabled,
        configured: cfg.configured,
        consented: store.hasConsent(req.user.id),
        usage: { today: usage.requests, dailyLimit: cfg.dailyRequestLimit },
        maxMessageLength: cfg.maxMessageLength,
      },
    });
  } catch (error) {
    return sendError(res, error, 'Không thể tải trạng thái trợ lý AI.');
  }
});

router.post('/consent', async (req, res) => {
  try {
    await store.giveConsent(req.user.id);
    return res.json({ data: { consented: true } });
  } catch (error) {
    return sendError(res, error, 'Không thể lưu xác nhận đồng ý.');
  }
});

router.get('/conversations', (req, res) => {
  try {
    return res.json({ data: store.listConversations(req.user.id) });
  } catch (error) {
    return sendError(res, error, 'Không thể tải danh sách cuộc trò chuyện.');
  }
});

router.get('/conversations/:id', (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Mã cuộc trò chuyện không hợp lệ.' });
    return res.json({ data: store.getConversation(req.user.id, id) });
  } catch (error) {
    return sendError(res, error, 'Không thể tải cuộc trò chuyện.');
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Mã cuộc trò chuyện không hợp lệ.' });
    await store.deleteConversation(req.user.id, id);
    return res.status(204).end();
  } catch (error) {
    return sendError(res, error, 'Không thể xoá cuộc trò chuyện.');
  }
});

/**
 * POST /api/agent/chat  body: { conversationId?, message }
 * Responds with Server-Sent Events: status, artifact, message, done, error.
 * Validation errors before streaming use normal JSON status codes.
 */
router.post('/chat', async (req, res) => {
  const cfg = getAgentConfig();
  const userId = req.user.id;

  if (!cfg.enabled) return res.status(503).json({ error: 'Trợ lý AI đang tạm tắt.', code: 'AGENT_DISABLED' });
  if (!cfg.configured) return res.status(503).json({ error: 'Trợ lý AI chưa được cấu hình.', code: 'AGENT_NOT_CONFIGURED' });

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Vui lòng nhập câu hỏi.' });
  if (message.length > cfg.maxMessageLength) {
    return res.status(400).json({ error: `Câu hỏi tối đa ${cfg.maxMessageLength} ký tự.` });
  }

  let conversationId = null;
  if (req.body?.conversationId !== undefined && req.body?.conversationId !== null) {
    conversationId = parseId(req.body.conversationId);
    if (!conversationId) return res.status(400).json({ error: 'Mã cuộc trò chuyện không hợp lệ.' });
  }

  try {
    if (!store.hasConsent(userId)) {
      return res.status(403).json({ error: 'Bạn cần đồng ý điều khoản sử dụng trợ lý AI trước.', code: 'AGENT_CONSENT_REQUIRED' });
    }
    if (conversationId && !store.getConversationRow(userId, conversationId)) {
      return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' });
    }
    if (store.getUsage(userId).requests >= cfg.dailyRequestLimit) {
      return res.status(429).json({ error: 'Bạn đã dùng hết lượt hỏi trong hôm nay. Vui lòng quay lại vào ngày mai.', code: 'AGENT_DAILY_LIMIT' });
    }
  } catch (error) {
    return sendError(res, error, 'Không thể kiểm tra trạng thái trợ lý AI.');
  }

  if (activeRuns.has(userId)) {
    return res.status(409).json({ error: 'Trợ lý đang trả lời câu hỏi trước, vui lòng chờ.', code: 'AGENT_BUSY' });
  }
  const burst = checkBurst(userId, cfg);
  if (!burst.allowed) {
    res.setHeader('Retry-After', String(burst.retryAfter));
    return res.status(429).json({ error: 'Bạn gửi quá nhiều câu hỏi, vui lòng thử lại sau ít phút.', code: 'AGENT_RATE_LIMIT' });
  }

  activeRuns.add(userId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), cfg.timeoutMs);
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      controller.abort(new Error('client_closed'));
    }
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    if (clientGone || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const history = conversationId ? store.getHistoryForModel(conversationId, cfg.historyTurns) : [];
    const result = await runAgentTurn({
      userId,
      history,
      message,
      signal: controller.signal,
      config: cfg,
      onEvent: (event) => {
        if (event.type === 'status') send('status', { text: event.text, tool: event.tool || null });
        if (event.type === 'artifact') send('artifact', event.artifact);
      },
    });
    const saved = await store.saveExchange({ userId, conversationId, userMessage: message, assistant: result });
    send('message', { content: result.content });
    send('done', {
      conversationId: saved.conversationId,
      messageId: saved.assistantMessageId,
      tools: result.trace.map((t) => t.tool),
      trace: result.trace,
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    const timedOut = aborted && !clientGone;
    if (!aborted && !(error instanceof AgentUpstreamError)) {
      console.error('[agent] Chat turn failed:', error);
    }
    try {
      await store.recordFailedRequest(userId);
    } catch (usageError) {
      console.error('[agent] Failed to record usage after error:', usageError);
    }
    send('error', {
      error: timedOut
        ? 'Trợ lý AI phản hồi quá lâu, vui lòng thử lại.'
        : error instanceof AgentUpstreamError
          ? error.message
          : 'Đã xảy ra lỗi khi trợ lý AI xử lý câu hỏi.',
    });
  } finally {
    clearTimeout(timeout);
    activeRuns.delete(userId);
    if (!res.writableEnded) res.end();
  }
});

// Test-only hook.
router._resetState = () => {
  burstBuckets.clear();
  activeRuns.clear();
};

module.exports = router;
