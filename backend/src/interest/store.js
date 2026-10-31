'use strict';

const {
  queryAll,
  queryOne,
  runSql,
  lastInsertId,
  runAuthMutation,
} = require('../auth/authDb');
const {
  scoreAttempt,
  checkSubmissionPolicy,
  normalizeItems,
  normalizeResponses,
  ALGORITHM_VERSION,
} = require('./scoring');
const { buildInterpretation, buildSummaryText } = require('./interpretation');
const {
  DISCLAIMER,
  GROUP_LABELS,
  GROUP_ORDER,
  PAIR_LABELS,
  PAIR_ORDER,
  LIKERT_LABELS,
  BIPOLAR_LABELS,
} = require('./content');

const MAX_RESPONSES_PER_PATCH = 30;
const MIN_GROUP_ANSWERED = 8;

function httpError(statusCode, message, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
}

function getActiveInstrumentRow() {
  return queryOne(
    `SELECT id, code, title, description, version, status, source_note AS sourceNote,
            disclaimer, part1_item_count AS part1ItemCount,
            part2_item_count AS part2ItemCount, created_at AS createdAt,
            updated_at AS updatedAt
       FROM interest_instruments
      WHERE status = 'active'
      ORDER BY version DESC
      LIMIT 1`
  );
}

function getInstrumentRow(id) {
  return queryOne(
    `SELECT id, code, title, description, version, status, source_note AS sourceNote,
            disclaimer, part1_item_count AS part1ItemCount,
            part2_item_count AS part2ItemCount, created_at AS createdAt,
            updated_at AS updatedAt
       FROM interest_instruments WHERE id = ?`,
    [id]
  );
}

function getItems(instrumentId, { activeOnly = true } = {}) {
  const where = activeOnly ? 'AND is_active = 1' : '';
  return queryAll(
    `SELECT id, instrument_id AS instrumentId, part, group_code AS groupCode,
            item_no AS itemNo, order_index AS orderIndex, prompt_text AS promptText,
            left_text AS leftText, right_text AS rightText, left_key AS leftKey,
            right_key AS rightKey, is_active AS isActive
       FROM interest_items
      WHERE instrument_id = ? ${where}
      ORDER BY order_index ASC, item_no ASC`,
    [instrumentId]
  ).map((row) => ({ ...row, isActive: Boolean(Number(row.isActive)) }));
}

function publicItem(item) {
  return {
    id: Number(item.id),
    part: item.part,
    groupCode: item.groupCode,
    itemNo: Number(item.itemNo),
    orderIndex: Number(item.orderIndex),
    promptText: item.promptText,
    leftText: item.leftText,
    rightText: item.rightText,
  };
}

function getInstrumentPayload() {
  const instrument = getActiveInstrumentRow();
  if (!instrument) {
    throw httpError(503, 'Chưa có bộ câu hỏi sở thích đang hoạt động.');
  }
  const items = getItems(instrument.id);
  return {
    id: Number(instrument.id),
    code: instrument.code,
    title: instrument.title,
    description: instrument.description,
    version: Number(instrument.version),
    sourceNote: instrument.sourceNote,
    disclaimer: instrument.disclaimer || DISCLAIMER,
    part1ItemCount: Number(instrument.part1ItemCount),
    part2ItemCount: Number(instrument.part2ItemCount),
    groups: GROUP_ORDER.map((code) => ({ code, label: GROUP_LABELS[code] })),
    pairs: PAIR_ORDER.map((code) => ({
      code,
      first: PAIR_LABELS[code].first,
      second: PAIR_LABELS[code].second,
      title: PAIR_LABELS[code].title,
    })),
    likertLabels: LIKERT_LABELS,
    bipolarLabels: BIPOLAR_LABELS,
    items: items.map(publicItem),
  };
}

function getAttemptRow(userId, attemptId) {
  return queryOne(
    `SELECT id, user_id AS userId, instrument_id AS instrumentId, status,
            giai_doan_hoc_tap AS giaiDoanHocTap, cau_hoi_nghe_nghiep AS cauHoiNgheNghiep,
            notes, summary_text AS summaryText, started_at AS startedAt,
            last_saved_at AS lastSavedAt, submitted_at AS submittedAt
       FROM interest_attempts
      WHERE id = ? AND user_id = ?`,
    [attemptId, userId]
  );
}

function getDraftRow(userId) {
  return queryOne(
    `SELECT id, user_id AS userId, instrument_id AS instrumentId, status,
            giai_doan_hoc_tap AS giaiDoanHocTap, cau_hoi_nghe_nghiep AS cauHoiNgheNghiep,
            notes, summary_text AS summaryText, started_at AS startedAt,
            last_saved_at AS lastSavedAt, submitted_at AS submittedAt
       FROM interest_attempts
      WHERE user_id = ? AND status = 'draft'
      ORDER BY started_at DESC
      LIMIT 1`,
    [userId]
  );
}

function serializeAttempt(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    instrumentId: Number(row.instrumentId),
    status: row.status,
    giaiDoanHocTap: row.giaiDoanHocTap || '',
    cauHoiNgheNghiep: row.cauHoiNgheNghiep || '',
    notes: parseJson(row.notes, []),
    startedAt: Number(row.startedAt),
    lastSavedAt: row.lastSavedAt ? Number(row.lastSavedAt) : null,
    submittedAt: row.submittedAt ? Number(row.submittedAt) : null,
  };
}

function getResponses(attemptId) {
  return queryAll(
    `SELECT item_id AS itemId, value, answered_at AS answeredAt
       FROM interest_responses WHERE attempt_id = ? ORDER BY item_id`,
    [attemptId]
  ).map((row) => ({
    itemId: Number(row.itemId),
    value: Number(row.value),
    answeredAt: Number(row.answeredAt),
  }));
}

function getAttemptState(userId) {
  const draft = getDraftRow(userId);
  if (!draft) return { draft: null, responses: [] };
  return { draft: serializeAttempt(draft), responses: getResponses(draft.id) };
}

async function createDraft(userId, input = {}) {
  const existing = getDraftRow(userId);
  if (existing) return { draft: serializeAttempt(existing), responses: getResponses(existing.id), created: false };

  const instrument = getActiveInstrumentRow();
  if (!instrument) throw httpError(503, 'Chưa có bộ câu hỏi sở thích đang hoạt động.');

  const giaiDoan = typeof input.giaiDoanHocTap === 'string' ? input.giaiDoanHocTap.trim().slice(0, 100) : '';
  const cauHoi = typeof input.cauHoiNgheNghiep === 'string' ? input.cauHoiNgheNghiep.trim().slice(0, 1000) : '';
  const now = Date.now();
  let attemptId;
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO interest_attempts
         (user_id, instrument_id, status, giai_doan_hoc_tap, cau_hoi_nghe_nghiep,
          notes, summary_text, started_at, last_saved_at, submitted_at)
       VALUES (?, ?, 'draft', ?, ?, '[]', NULL, ?, ?, NULL)`,
      [userId, instrument.id, giaiDoan, cauHoi, now, now]
    );
    attemptId = lastInsertId();
  });
  const row = getAttemptRow(userId, attemptId);
  return { draft: serializeAttempt(row), responses: [], created: true };
}

async function updateAttemptMeta(userId, attemptId, input = {}) {
  const attempt = getAttemptRow(userId, attemptId);
  if (!attempt) throw httpError(404, 'Không tìm thấy bài làm.');
  if (attempt.status !== 'draft') throw httpError(409, 'Bài làm đã nộp, không thể sửa thông tin đầu bài.');
  const giaiDoan =
    input.giaiDoanHocTap === undefined
      ? attempt.giaiDoanHocTap
      : String(input.giaiDoanHocTap || '').trim().slice(0, 100);
  const cauHoi =
    input.cauHoiNgheNghiep === undefined
      ? attempt.cauHoiNgheNghiep
      : String(input.cauHoiNgheNghiep || '').trim().slice(0, 1000);
  const notes =
    input.notes === undefined
      ? attempt.notes
      : JSON.stringify(
          (Array.isArray(input.notes) ? input.notes : [])
            .filter((note) => note && typeof note.text === 'string' && note.text.trim())
            .slice(0, 5)
            .map((note) => ({
              afterItem: Number(note.afterItem) || null,
              text: note.text.trim().slice(0, 2000),
            }))
        );
  const now = Date.now();
  await runAuthMutation(() => {
    runSql(
      'UPDATE interest_attempts SET giai_doan_hoc_tap = ?, cau_hoi_nghe_nghiep = ?, notes = ?, last_saved_at = ? WHERE id = ? AND user_id = ?',
      [giaiDoan, cauHoi, notes, now, attemptId, userId]
    );
  });
  return serializeAttempt(getAttemptRow(userId, attemptId));
}

function validateResponseValue(part, value) {
  if (!Number.isInteger(value)) return false;
  if (part === 'riasec') return value >= 1 && value <= 5;
  if (part === 'pairs') return value >= -2 && value <= 2;
  return false;
}

async function saveResponses(userId, attemptId, input) {  const attempt = getAttemptRow(userId, attemptId);
  if (!attempt) throw httpError(404, 'Không tìm thấy bài làm.');
  if (attempt.status !== 'draft') throw httpError(409, 'Bài làm đã nộp, không thể sửa câu trả lời.');

  if (!Array.isArray(input)) throw httpError(400, 'Danh sách câu trả lời không hợp lệ.');
  if (input.length > MAX_RESPONSES_PER_PATCH) {
    throw httpError(400, `Mỗi lần chỉ được lưu tối đa ${MAX_RESPONSES_PER_PATCH} câu trả lời.`);
  }

  const items = getItems(attempt.instrumentId, { activeOnly: false });
  const itemById = new Map(items.map((item) => [Number(item.id), item]));
  const rows = [];
  const seen = new Set();
  for (const entry of input) {
    const itemId = Number(entry?.itemId ?? entry?.item_id);
    const value = Number(entry?.value);
    if (!Number.isInteger(itemId) || !itemById.has(itemId)) {
      throw httpError(400, `Câu hỏi ${entry?.itemId ?? ''} không thuộc bộ câu hỏi này.`);
    }
    const item = itemById.get(itemId);
    if (!validateResponseValue(item.part, value)) {
      const range = item.part === 'riasec' ? '1 đến 5' : '−2 đến +2';
      throw httpError(400, `Giá trị trả lời của câu ${item.itemNo} phải từ ${range}.`);
    }
    if (seen.has(itemId)) throw httpError(400, `Câu hỏi ${item.itemNo} bị lặp trong một lần lưu.`);
    seen.add(itemId);
    rows.push({ itemId, value });
  }

  const now = Date.now();
  await runAuthMutation(() => {
    for (const row of rows) {
      runSql(
        `INSERT INTO interest_responses (attempt_id, item_id, value, answered_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(attempt_id, item_id) DO UPDATE SET value = excluded.value,
           answered_at = excluded.answered_at`,
        [attemptId, row.itemId, row.value, now]
      );
    }
    runSql('UPDATE interest_attempts SET last_saved_at = ? WHERE id = ?', [now, attemptId]);
  });

  return { saved: rows.length, lastSavedAt: now };
}

function buildScore(userId, attempt) {
  const instrument = getInstrumentRow(attempt.instrumentId);
  if (!instrument) throw httpError(500, 'Không tìm thấy bộ câu hỏi của bài làm.');
  const items = getItems(attempt.instrumentId, { activeOnly: false });
  const responses = getResponses(attempt.id);
  const score = scoreAttempt({ instrument, items, responses });
  return { instrument, items, responses, score };
}

function groupValue(score, code) {
  return score.part1.groups.find((group) => group.code === code) || null;
}

function serializeResultRow(row) {
  const groups = GROUP_ORDER.map((code) => {
    const lower = code.toLowerCase();
    const answered = Number(row[`${lower}_answered`] || 0);
    const sum = Number(row[lower] || 0);
    const status = answered === 10 ? 'complete' : answered === 0 ? 'empty' : 'partial';
    return {
      code,
      label: GROUP_LABELS[code],
      sum,
      answered,
      max: answered * 5,
      status,
      mean: answered > 0 ? Math.round((sum / answered) * 100) / 100 : null,
      expected: 10,
    };
  });
  const topGroups = parseJson(row.top_groups, []);
  const ranking = Array.isArray(topGroups) ? topGroups : [];
  const ties = parseJson(row.ties, []);
  const part1 = {
    groups,
    ranking,
    ties: Array.isArray(ties) ? ties : [],
    rankingAvailable: ranking.length > 0,
    code: row.code || (ranking.length ? ranking.join('-') : null),
  };

  const pairColumn = { EI: 'd_ei', SN: 'd_sn', TF: 'd_tf', JP: 'd_jp' };
  const pairs = PAIR_ORDER.map((code) => {
    const meta = PAIR_LABELS[code];
    const raw = row[pairColumn[code]];
    const d = raw === null || raw === undefined ? null : Number(raw);
    let lean = null;
    if (d !== null) {
      if (d > 0) lean = meta.first;
      else if (d < 0) lean = meta.second;
    }
    return {
      code,
      first: meta.first,
      second: meta.second,
      title: meta.title,
      d,
      status: d === null ? 'thieu_du_lieu' : 'complete',
      lean,
    };
  });
  const part2 = {
    pairs,
    referenceCode: pairs.map((pair) => pair.lean || '?').join(''),
  };

  const scoreLike = { part1, part2 };
  const interpretation = buildInterpretation(scoreLike);
  return {
    attemptId: Number(row.attempt_id),
    submittedAt: row.submitted_at ? Number(row.submitted_at) : null,
    algorithmVersion: row.algorithm_version,
    completeness: row.completeness,
    unansweredCount: Number(row.unanswered_count || 0),
    part1,
    part2,
    interpretation,
  };
}

function getResultRow(userId, attemptId) {
  return queryOne(
    `SELECT res.*, a.submitted_at
       FROM interest_results res
       JOIN interest_attempts a ON a.id = res.attempt_id
      WHERE res.attempt_id = ? AND res.user_id = ?`,
    [attemptId, userId]
  );
}

function getLatestResultRow(userId) {
  return queryOne(
    `SELECT res.*, a.submitted_at
       FROM interest_results res
       JOIN interest_attempts a ON a.id = res.attempt_id
      WHERE res.user_id = ?
      ORDER BY res.computed_at DESC, res.attempt_id DESC
      LIMIT 1`,
    [userId]
  );
}

function getLatestResult(userId) {
  const row = getLatestResultRow(userId);
  return row ? serializeResultRow(row) : null;
}

function getResult(userId, attemptId) {
  const row = getResultRow(userId, attemptId);
  if (!row) throw httpError(404, 'Không tìm thấy kết quả.');
  return serializeResultRow(row);
}

function setInterestCompleted(userId, completed) {
  runSql('UPDATE users SET interest_completed = ?, updated_at = ? WHERE id = ?', [
    completed ? 1 : 0,
    Date.now(),
    userId,
  ]);
}

async function submitAttempt(userId, attemptId, input = {}) {
  const attempt = getAttemptRow(userId, attemptId);
  if (!attempt) throw httpError(404, 'Không tìm thấy bài làm.');

  const { instrument, items, responses, score } = buildScore(userId, attempt);
  const policy = checkSubmissionPolicy(score);
  if (!policy.ok) {
    throw httpError(
      409,
      'Chưa đủ câu trả lời để nộp. Mỗi nhóm cần ít nhất 8/10 câu và mỗi cặp cần đủ 12/12 câu.',
      { details: policy }
    );
  }

  const interpretation = buildInterpretation(score);
  const summaryText = buildSummaryText(score, interpretation);
  const notes = Array.isArray(input.notes)
    ? input.notes
        .filter((note) => note && typeof note.text === 'string' && note.text.trim())
        .slice(0, 5)
        .map((note) => ({
          afterItem: Number(note.afterItem) || null,
          text: note.text.trim().slice(0, 2000),
        }))
    : parseJson(attempt.notes, []);

  const group = (code) => groupValue(score, code);
  const pair = (code) => score.part2.pairs.find((entry) => entry.code === code);
  const now = Date.now();
  const submittedAt = attempt.submittedAt || now;

  await runAuthMutation(() => {
    runSql(
      `INSERT INTO interest_results
         (attempt_id, user_id, instrument_id, algorithm_version,
          r, i, a, s, e, c,
          r_answered, i_answered, a_answered, s_answered, e_answered, c_answered,
          d_ei, d_sn, d_tf, d_jp, code, top_groups, ties, completeness,
          unanswered_count, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id) DO UPDATE SET
         algorithm_version = excluded.algorithm_version,
         r = excluded.r, i = excluded.i, a = excluded.a, s = excluded.s,
         e = excluded.e, c = excluded.c,
         r_answered = excluded.r_answered, i_answered = excluded.i_answered,
         a_answered = excluded.a_answered, s_answered = excluded.s_answered,
         e_answered = excluded.e_answered, c_answered = excluded.c_answered,
         d_ei = excluded.d_ei, d_sn = excluded.d_sn, d_tf = excluded.d_tf, d_jp = excluded.d_jp,
         code = excluded.code, top_groups = excluded.top_groups, ties = excluded.ties,
         completeness = excluded.completeness, unanswered_count = excluded.unanswered_count,
         computed_at = excluded.computed_at`,
      [
        attemptId,
        userId,
        instrument.id,
        ALGORITHM_VERSION,
        group('R').sum,
        group('I').sum,
        group('A').sum,
        group('S').sum,
        group('E').sum,
        group('C').sum,
        group('R').answered,
        group('I').answered,
        group('A').answered,
        group('S').answered,
        group('E').answered,
        group('C').answered,
        pair('EI').d,
        pair('SN').d,
        pair('TF').d,
        pair('JP').d,
        score.part1.code,
        JSON.stringify(score.part1.ranking),
        JSON.stringify(score.part1.ties),
        score.completeness,
        score.unansweredCount,
        now,
      ]
    );
    runSql(
      `UPDATE interest_attempts
          SET status = 'submitted', submitted_at = ?, last_saved_at = ?, notes = ?, summary_text = ?
        WHERE id = ? AND user_id = ?`,
      [submittedAt, now, JSON.stringify(notes), summaryText.slice(0, 20000), attemptId, userId]
    );
    setInterestCompleted(userId, true);
  });

  return getResult(userId, attemptId);
}

async function deleteAttempt(userId, attemptId) {
  const attempt = getAttemptRow(userId, attemptId);
  if (!attempt) return false;
  await runAuthMutation(() => {
    runSql('DELETE FROM interest_attempts WHERE id = ? AND user_id = ?', [attemptId, userId]);
    const remaining = queryOne(
      `SELECT COUNT(*) AS total FROM interest_results WHERE user_id = ?`,
      [userId]
    );
    setInterestCompleted(userId, Number(remaining?.total || 0) > 0);
  });
  return true;
}

async function resetUser(userId) {
  await runAuthMutation(() => {
    runSql('DELETE FROM interest_attempts WHERE user_id = ?', [userId]);
    setInterestCompleted(userId, false);
  });
}

function getStatus(userId) {
  const draft = getDraftRow(userId);
  const latest = getLatestResultRow(userId);
  const user = queryOne('SELECT interest_completed AS interestCompleted FROM users WHERE id = ?', [userId]);
  return {
    hasDraft: Boolean(draft),
    draftId: draft ? Number(draft.id) : null,
    hasResult: Boolean(latest),
    latestAttemptId: latest ? Number(latest.attempt_id) : null,
    interestCompleted: Boolean(Number(user?.interestCompleted || 0)),
    submittedCount: Number(
      queryOne('SELECT COUNT(*) AS total FROM interest_results WHERE user_id = ?', [userId])?.total || 0
    ),
  };
}

module.exports = {
  MAX_RESPONSES_PER_PATCH,
  MIN_GROUP_ANSWERED,
  getActiveInstrumentRow,
  getInstrumentRow,
  getItems,
  getInstrumentPayload,
  getAttemptState,
  getAttemptRow,
  getDraftRow,
  createDraft,
  updateAttemptMeta,
  saveResponses,
  submitAttempt,
  deleteAttempt,
  resetUser,
  getLatestResult,
  getResult,
  getStatus,
  validateResponseValue,
  normalizeItems,
  normalizeResponses,
  parseJson,
};
