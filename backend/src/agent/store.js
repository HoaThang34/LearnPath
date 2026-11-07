'use strict';

const { queryAll, queryOne, runSql, lastInsertId, runAuthMutation } = require('../auth/authDb');

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function parseJson(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('[agent] Corrupt JSON in chat_messages:', error.message);
    return fallback;
  }
}

function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- consent

function hasConsent(userId) {
  return Boolean(queryOne('SELECT 1 AS ok FROM agent_consents WHERE user_id = ?', [userId]));
}

async function giveConsent(userId) {
  await runAuthMutation(() => {
    runSql(
      'INSERT INTO agent_consents (user_id, consented_at) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING',
      [userId, Date.now()]
    );
  });
}

// ------------------------------------------------------------------ usage

function getUsage(userId, now = new Date()) {
  const row = queryOne('SELECT requests, tokens FROM agent_usage WHERE user_id = ? AND day = ?', [userId, dayKey(now)]);
  return { requests: Number(row?.requests || 0), tokens: Number(row?.tokens || 0) };
}

// ---------------------------------------------------------- conversations

function serializeConversation(row) {
  return {
    id: Number(row.id),
    title: row.title,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function listConversations(userId) {
  return queryAll(
    'SELECT id, title, created_at, updated_at FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 100',
    [userId]
  ).map(serializeConversation);
}

function getConversationRow(userId, conversationId) {
  return queryOne(
    'SELECT id, title, created_at, updated_at FROM chat_conversations WHERE id = ? AND user_id = ?',
    [conversationId, userId]
  );
}

function getMessages(conversationId) {
  return queryAll(
    'SELECT id, role, content, artifacts_json, tool_trace_json, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY id',
    [conversationId]
  ).map((row) => ({
    id: Number(row.id),
    role: row.role,
    content: row.content,
    artifacts: parseJson(row.artifacts_json, []),
    trace: parseJson(row.tool_trace_json, []),
    createdAt: Number(row.created_at),
  }));
}

function getConversation(userId, conversationId) {
  const row = getConversationRow(userId, conversationId);
  if (!row) throw httpError(404, 'Không tìm thấy cuộc trò chuyện.');
  return { ...serializeConversation(row), messages: getMessages(conversationId) };
}

function getHistoryForModel(conversationId, turns) {
  if (!turns) return [];
  const rows = queryAll(
    'SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?',
    [conversationId, turns * 2]
  );
  return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
}

async function deleteConversation(userId, conversationId) {
  const row = getConversationRow(userId, conversationId);
  if (!row) throw httpError(404, 'Không tìm thấy cuộc trò chuyện.');
  await runAuthMutation(() => {
    runSql('DELETE FROM chat_messages WHERE conversation_id = ?', [conversationId]);
    runSql('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
  });
}

function makeTitle(message) {
  const text = String(message).replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text || 'Cuộc trò chuyện mới';
}

/**
 * Persist one finished exchange (user + assistant) and count usage, in one
 * transaction. Creates the conversation when `conversationId` is null.
 */
async function saveExchange({ userId, conversationId, userMessage, assistant, now = new Date() }) {
  const ts = now.getTime();
  return runAuthMutation(() => {
    let id = conversationId;
    if (!id) {
      runSql(
        'INSERT INTO chat_conversations (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [userId, makeTitle(userMessage), ts, ts]
      );
      id = lastInsertId();
    } else {
      runSql('UPDATE chat_conversations SET updated_at = ? WHERE id = ? AND user_id = ?', [ts, id, userId]);
    }
    runSql(
      'INSERT INTO chat_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      [id, 'user', userMessage, ts]
    );
    runSql(
      `INSERT INTO chat_messages (conversation_id, role, content, artifacts_json, tool_trace_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, 'assistant', assistant.content, JSON.stringify(assistant.artifacts || []), JSON.stringify(assistant.trace || []), ts + 1]
    );
    const assistantMessageId = lastInsertId();
    runSql(
      `INSERT INTO agent_usage (user_id, day, requests, tokens) VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET requests = requests + 1, tokens = tokens + excluded.tokens`,
      [userId, dayKey(now), Number(assistant.tokens || 0)]
    );
    return { conversationId: Number(id), assistantMessageId: Number(assistantMessageId) };
  });
}

/** Count a failed upstream request toward the daily limit (prevents retry abuse). */
async function recordFailedRequest(userId, now = new Date()) {
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO agent_usage (user_id, day, requests, tokens) VALUES (?, ?, 1, 0)
       ON CONFLICT(user_id, day) DO UPDATE SET requests = requests + 1`,
      [userId, dayKey(now)]
    );
  });
}

module.exports = {
  httpError,
  hasConsent,
  giveConsent,
  getUsage,
  listConversations,
  getConversation,
  getConversationRow,
  getHistoryForModel,
  deleteConversation,
  saveExchange,
  recordFailedRequest,
  makeTitle,
};
