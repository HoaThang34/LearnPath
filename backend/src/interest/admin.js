'use strict';

const {
  queryAll,
  queryOne,
  runSql,
  lastInsertId,
  runAuthMutation,
} = require('../auth/authDb');
const { GROUP_ORDER, PAIR_LABELS } = require('./content');

const GROUP_SIZE = 10;
const PAIR_SIZE = 12;

function httpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  if (details) error.details = details;
  return error;
}

function parseInstrumentJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw httpError(400, 'Nội dung JSON không hợp lệ.');
    }
  }
  throw httpError(400, 'Thiếu nội dung bộ câu hỏi.');
}

function validateItems(rawItems) {
  const errors = [];
  const items = [];
  if (!Array.isArray(rawItems)) {
    return { errors: [{ line: 0, field: 'items', message: 'Danh sách câu hỏi phải là mảng.' }], items: [] };
  }

  const seenOrder = new Set();
  for (let index = 0; index < rawItems.length; index += 1) {
    const raw = rawItems[index];
    const line = index + 1;
    if (!raw || typeof raw !== 'object') {
      errors.push({ line, field: 'item', message: 'Câu hỏi không hợp lệ.' });
      continue;
    }
    const part = raw.part || (raw.pair ? 'pairs' : 'riasec');
    const itemNo = Number(raw.itemNo);
    const orderIndex = Number(raw.orderIndex);
    if (!['riasec', 'pairs'].includes(part)) {
      errors.push({ line, field: 'part', message: "part phải là 'riasec' hoặc 'pairs'." });
      continue;
    }
    if (!Number.isInteger(itemNo) || itemNo < 1) {
      errors.push({ line, field: 'itemNo', message: 'itemNo phải là số nguyên dương.' });
      continue;
    }
    if (!Number.isInteger(orderIndex) || orderIndex < 1 || orderIndex > 108) {
      errors.push({ line, field: 'orderIndex', message: 'orderIndex phải từ 1 đến 108.' });
      continue;
    }
    if (seenOrder.has(orderIndex)) {
      errors.push({ line, field: 'orderIndex', message: `orderIndex ${orderIndex} bị trùng.` });
      continue;
    }
    seenOrder.add(orderIndex);

    if (part === 'riasec') {
      const group = String(raw.group || raw.groupCode || '').toUpperCase();
      if (!GROUP_ORDER.includes(group)) {
        errors.push({ line, field: 'group', message: `Nhóm ${group || '(trống)'} không hợp lệ.` });
        continue;
      }
      const text = String(raw.text || raw.promptText || '').trim();
      if (!text) errors.push({ line, field: 'text', message: 'Nội dung câu hỏi không được để trống.' });
      items.push({
        part,
        groupCode: group,
        itemNo,
        orderIndex,
        promptText: text,
        leftText: null,
        rightText: null,
        leftKey: null,
        rightKey: null,
        isActive: raw.isActive === false ? 0 : 1,
      });
    } else {
      const pair = String(raw.pair || raw.groupCode || '').toUpperCase();
      const meta = PAIR_LABELS[pair];
      if (!meta) {
        errors.push({ line, field: 'pair', message: `Cặp ${pair || '(trống)'} không hợp lệ.` });
        continue;
      }
      const left = String(raw.left || raw.leftText || '').trim();
      const right = String(raw.right || raw.rightText || '').trim();
      const leftKey = String(raw.leftKey || '').toUpperCase();
      const rightKey = String(raw.rightKey || '').toUpperCase();
      if (!left || !right) {
        errors.push({ line, field: 'text', message: 'Hai phát biểu trái/phải không được để trống.' });
      }
      if (leftKey === rightKey || ![leftKey, rightKey].every((key) => key === meta.first || key === meta.second)) {
        errors.push({ line, field: 'keys', message: `leftKey/rightKey phải là ${meta.first}/${meta.second} và khác nhau.` });
      }
      const odd = itemNo % 2 === 1;
      if (leftKey !== (odd ? meta.first : meta.second)) {
        errors.push({
          line,
          field: 'leftKey',
          message: `Câu ${odd ? 'lẻ' : 'chẵn'} phải đặt ${odd ? meta.first : meta.second} ở bên trái.`,
        });
      }
      items.push({
        part,
        groupCode: pair,
        itemNo,
        orderIndex,
        promptText: null,
        leftText: left,
        rightText: right,
        leftKey,
        rightKey,
        isActive: raw.isActive === false ? 0 : 1,
      });
    }
  }

  const riasec = items.filter((item) => item.part === 'riasec');
  const pairs = items.filter((item) => item.part === 'pairs');
  if (riasec.length !== 60) {
    errors.push({ line: 0, field: 'part1', message: `Phần 1 phải có đúng 60 câu (hiện có ${riasec.length}).` });
  }
  if (pairs.length !== 48) {
    errors.push({ line: 0, field: 'part2', message: `Phần 2 phải có đúng 48 câu (hiện có ${pairs.length}).` });
  }
  for (const group of GROUP_ORDER) {
    const count = riasec.filter((item) => item.groupCode === group).length;
    if (count !== GROUP_SIZE) {
      errors.push({ line: 0, field: `group.${group}`, message: `Nhóm ${group} phải có ${GROUP_SIZE} câu (hiện có ${count}).` });
    }
  }
  for (const pair of Object.keys(PAIR_LABELS)) {
    const block = pairs.filter((item) => item.groupCode === pair);
    if (block.length !== PAIR_SIZE) {
      errors.push({ line: 0, field: `pair.${pair}`, message: `Cặp ${pair} phải có ${PAIR_SIZE} câu (hiện có ${block.length}).` });
    }
    const even = block.filter((item) => item.itemNo % 2 === 0).length;
    const odd = block.filter((item) => item.itemNo % 2 === 1).length;
    if (even !== 6 || odd !== 6) {
      errors.push({ line: 0, field: `pair.${pair}`, message: `Cặp ${pair} phải có 6 câu chẵn và 6 câu lẻ.` });
    }
  }
  if (items.length === 108) {
    const orders = items.map((item) => item.orderIndex).sort((a, b) => a - b);
    const continuous = orders.every((value, index) => value === index + 1);
    if (!continuous) {
      errors.push({ line: 0, field: 'orderIndex', message: 'orderIndex phải liên tục từ 1 đến 108, không có lỗ hổng.' });
    }
  }
  return { errors, items };
}

function validateInstrumentMeta(input) {
  const code = String(input?.code || '').trim();
  const title = String(input?.title || '').trim();
  const version = Number(input?.version);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(code)) {
    throw httpError(400, 'Mã bộ câu hỏi chỉ gồm chữ thường, số và dấu gạch ngang (3–64 ký tự).');
  }
  if (!title) throw httpError(400, 'Tên bộ câu hỏi không được để trống.');
  if (!Number.isInteger(version) || version < 1) throw httpError(400, 'Phiên bản phải là số nguyên dương.');
  return {
    code,
    title,
    version,
    description: String(input?.description || '').trim().slice(0, 2000) || null,
    sourceNote: String(input?.sourceNote || '').trim().slice(0, 2000) || null,
    disclaimer: String(input?.disclaimer || '').trim().slice(0, 4000) || null,
  };
}

function listInstruments() {
  return queryAll(
    `SELECT i.id, i.code, i.title, i.version, i.status, i.source_note AS sourceNote,
            i.part1_item_count AS part1ItemCount, i.part2_item_count AS part2ItemCount,
            i.created_at AS createdAt, i.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM interest_items it WHERE it.instrument_id = i.id AND it.part = 'riasec') AS riasecCount,
            (SELECT COUNT(*) FROM interest_items it WHERE it.instrument_id = i.id AND it.part = 'pairs') AS pairsCount
       FROM interest_instruments i
      ORDER BY i.code, i.version DESC`
  ).map((row) => ({
    ...row,
    id: Number(row.id),
    version: Number(row.version),
    riasecCount: Number(row.riasecCount || 0),
    pairsCount: Number(row.pairsCount || 0),
  }));
}

function getInstrument(id) {
  const row = queryOne(
    `SELECT id, code, title, description, version, status, source_note AS sourceNote,
            disclaimer, part1_item_count AS part1ItemCount,
            part2_item_count AS part2ItemCount, created_at AS createdAt,
            updated_at AS updatedAt
       FROM interest_instruments WHERE id = ?`,
    [id]
  );
  if (!row) throw httpError(404, 'Không tìm thấy bộ câu hỏi.');
  return row;
}

function getItems(id) {
  return queryAll(
    `SELECT id, instrument_id AS instrumentId, part, group_code AS groupCode,
            item_no AS itemNo, order_index AS orderIndex, prompt_text AS promptText,
            left_text AS leftText, right_text AS rightText, left_key AS leftKey,
            right_key AS rightKey, is_active AS isActive
       FROM interest_items WHERE instrument_id = ?
      ORDER BY order_index ASC, item_no ASC`,
    [id]
  ).map((row) => ({ ...row, isActive: Boolean(Number(row.isActive)) }));
}

function insertItems(instrumentId, items) {
  const now = Date.now();
  for (const item of items) {
    runSql(
      `INSERT INTO interest_items
         (instrument_id, part, group_code, item_no, order_index, prompt_text,
          left_text, right_text, left_key, right_key, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        instrumentId,
        item.part,
        item.groupCode,
        item.itemNo,
        item.orderIndex,
        item.promptText,
        item.leftText,
        item.rightText,
        item.leftKey,
        item.rightKey,
        item.isActive === 0 ? 0 : 1,
        now,
        now,
      ]
    );
  }
}

async function createInstrument(input = {}) {
  const meta = validateInstrumentMeta(input);
  const existing = queryOne(
    'SELECT id FROM interest_instruments WHERE code = ? AND version = ?',
    [meta.code, meta.version]
  );
  if (existing) throw httpError(409, `Bộ câu hỏi ${meta.code} v${meta.version} đã tồn tại.`);

  let copyItems = null;
  if (input.copyFromId) {
    const source = getInstrument(Number(input.copyFromId));
    copyItems = getItems(source.id);
  }

  const now = Date.now();
  let id;
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO interest_instruments
         (code, title, description, version, status, source_note, disclaimer,
          part1_item_count, part2_item_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, 60, 48, ?, ?)`,
      [meta.code, meta.title, meta.description, meta.version, meta.sourceNote, meta.disclaimer, now, now]
    );
    id = lastInsertId();
    if (copyItems) insertItems(id, copyItems);
  });
  return { instrument: getInstrument(id), items: getItems(id) };
}

async function updateInstrument(id, input = {}) {
  const instrument = getInstrument(id);
  if (instrument.status !== 'draft') {
    throw httpError(409, 'Chỉ sửa được bộ câu hỏi ở trạng thái nháp. Hãy tạo bản nháp từ phiên bản này.');
  }
  const title = String(input.title ?? instrument.title).trim();
  if (!title) throw httpError(400, 'Tên bộ câu hỏi không được để trống.');
  const description =
    input.description === undefined ? instrument.description : String(input.description || '').trim().slice(0, 2000);
  const sourceNote =
    input.sourceNote === undefined ? instrument.sourceNote : String(input.sourceNote || '').trim().slice(0, 2000);
  const disclaimer =
    input.disclaimer === undefined ? instrument.disclaimer : String(input.disclaimer || '').trim().slice(0, 4000);
  const now = Date.now();
  await runAuthMutation(() => {
    runSql(
      `UPDATE interest_instruments
          SET title = ?, description = ?, source_note = ?, disclaimer = ?, updated_at = ?
        WHERE id = ?`,
      [title, description, sourceNote, disclaimer, now, id]
    );
  });
  return getInstrument(id);
}

async function replaceItems(id, rawItems) {
  const instrument = getInstrument(id);
  if (instrument.status !== 'draft') {
    throw httpError(409, 'Chỉ sửa được câu hỏi của bộ đang nháp.');
  }
  const { errors, items } = validateItems(rawItems);
  if (errors.length) throw httpError(400, 'Dữ liệu câu hỏi chưa hợp lệ.', errors);
  await runAuthMutation(() => {
    runSql('DELETE FROM interest_items WHERE instrument_id = ?', [id]);
    insertItems(id, items);
    runSql('UPDATE interest_instruments SET updated_at = ? WHERE id = ?', [Date.now(), id]);
  });
  return getItems(id);
}

async function importInstrument(payload) {
  const input = parseInstrumentJson(payload?.instrument ?? payload?.json ?? payload);
  const meta = validateInstrumentMeta(input);
  const part1 = Array.isArray(input.part1) ? input.part1.map((item) => ({ ...item, part: 'riasec' })) : [];
  const part2 = Array.isArray(input.part2) ? input.part2.map((item) => ({ ...item, part: 'pairs' })) : [];
  const { errors, items } = validateItems([...part1, ...part2]);
  if (errors.length) throw httpError(400, 'Dữ liệu nhập chưa hợp lệ; không có dòng nào được ghi.', errors);

  const existing = queryOne(
    'SELECT id FROM interest_instruments WHERE code = ? AND version = ?',
    [meta.code, meta.version]
  );
  if (existing) throw httpError(409, `Bộ câu hỏi ${meta.code} v${meta.version} đã tồn tại.`);

  const now = Date.now();
  let id;
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO interest_instruments
         (code, title, description, version, status, source_note, disclaimer,
          part1_item_count, part2_item_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, 60, 48, ?, ?)`,
      [
        meta.code,
        meta.title,
        meta.description || input.description || null,
        meta.version,
        meta.sourceNote || input.sourceNote || null,
        meta.disclaimer || input.disclaimer || null,
        now,
        now,
      ]
    );
    id = lastInsertId();
    insertItems(id, items);
  });
  return { instrument: getInstrument(id), items: getItems(id), counts: { total: items.length, part1: 60, part2: 48 } };
}

async function activateInstrument(id) {
  const instrument = getInstrument(id);
  const items = getItems(id).filter((item) => item.isActive);
  const riasec = items.filter((item) => item.part === 'riasec').length;
  const pairs = items.filter((item) => item.part === 'pairs').length;
  if (riasec !== 60 || pairs !== 48) {
    throw httpError(400, `Bộ câu hỏi chưa đủ 60 + 48 câu (hiện có ${riasec} + ${pairs}).`);
  }
  if (!/tự biên soạn/i.test(instrument.sourceNote || '')) {
    throw httpError(400, 'Cần ghi rõ "tự biên soạn" trong nguồn trước khi kích hoạt (D2).');
  }
  const now = Date.now();
  await runAuthMutation(() => {
    runSql("UPDATE interest_instruments SET status = 'archived', updated_at = ? WHERE status = 'active' AND id != ?", [now, id]);
    runSql("UPDATE interest_instruments SET status = 'active', updated_at = ? WHERE id = ?", [now, id]);
  });
  return getInstrument(id);
}

function getWeights() {
  return queryAll(
    `SELECT id, major_group AS majorGroup, w_r AS wR, w_i AS wI, w_a AS wA,
            w_s AS wS, w_e AS wE, w_c AS wC, note, is_active AS isActive,
            updated_at AS updatedAt
       FROM interest_group_weights ORDER BY major_group`
  ).map((row) => ({ ...row, isActive: Boolean(Number(row.isActive)) }));
}

function validateWeights(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw httpError(400, 'Danh sách trọng số không hợp lệ.');
  }
  const rows = [];
  for (const item of input) {
    const majorGroup = String(item?.majorGroup || '').trim();
    const values = ['wR', 'wI', 'wA', 'wS', 'wE', 'wC'].map((key) => Number(item?.[key]));
    if (!majorGroup || values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw httpError(400, `Trọng số của nhóm "${majorGroup || '(trống)'}" không hợp lệ.`);
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.001) {
      throw httpError(400, `Tổng trọng số của nhóm "${majorGroup}" phải bằng 1 (hiện tại ${total.toFixed(3)}).`);
    }
    rows.push({ majorGroup, values, note: String(item?.note || '').trim().slice(0, 1000) || null });
  }
  return rows;
}

async function updateWeights(input) {
  const rows = validateWeights(input);
  const now = Date.now();
  await runAuthMutation(() => {
    for (const row of rows) {
      const existing = queryOne('SELECT id FROM interest_group_weights WHERE major_group = ?', [row.majorGroup]);
      if (existing) {
        runSql(
          `UPDATE interest_group_weights
              SET w_r = ?, w_i = ?, w_a = ?, w_s = ?, w_e = ?, w_c = ?, note = ?, updated_at = ?
            WHERE id = ?`,
          [...row.values, row.note, now, existing.id]
        );
      } else {
        runSql(
          `INSERT INTO interest_group_weights
             (major_group, w_r, w_i, w_a, w_s, w_e, w_c, note, is_active, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [row.majorGroup, ...row.values, row.note, now]
        );
      }
    }
  });
  return getWeights();
}

function getStats() {
  const attempts = queryOne(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts
       FROM interest_attempts`
  );
  const results = queryOne('SELECT COUNT(*) AS total FROM interest_results');
  const distribution = new Map();
  for (const row of queryAll('SELECT top_groups FROM interest_results')) {
    let top = [];
    try {
      top = JSON.parse(row.top_groups || '[]');
    } catch (error) {
      top = [];
    }
    if (Array.isArray(top) && top.length) {
      const code = top[0];
      distribution.set(code, (distribution.get(code) || 0) + 1);
    }
  }
  const totalAttempts = Number(attempts?.total || 0);
  const submitted = Number(attempts?.submitted || 0);
  return {
    totalAttempts,
    submitted,
    drafts: Number(attempts?.drafts || 0),
    resultCount: Number(results?.total || 0),
    completionRate: totalAttempts > 0 ? Math.round((submitted / totalAttempts) * 1000) / 10 : 0,
    topGroupDistribution: [...distribution.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    recent: queryAll(
      `SELECT id, status, submitted_at AS submittedAt, started_at AS startedAt,
              last_saved_at AS lastSavedAt
         FROM interest_attempts ORDER BY started_at DESC LIMIT 20`
    ).map((row) => ({
      id: Number(row.id),
      status: row.status,
      submittedAt: row.submittedAt ? Number(row.submittedAt) : null,
      startedAt: Number(row.startedAt),
      lastSavedAt: row.lastSavedAt ? Number(row.lastSavedAt) : null,
    })),
  };
}

function getResultDetail(attemptId) {
  const row = queryOne(
    `SELECT res.*, a.submitted_at, a.started_at, u.username
       FROM interest_results res
       JOIN interest_attempts a ON a.id = res.attempt_id
       JOIN users u ON u.id = res.user_id
      WHERE res.attempt_id = ?`,
    [attemptId]
  );
  if (!row) throw httpError(404, 'Không tìm thấy kết quả.');
  return row;
}

function getExportRows() {
  return queryAll(
    `SELECT attempt_id AS attemptId, computed_at AS computedAt, algorithm_version AS algorithmVersion,
            r, i, a, s, e, c, d_ei AS dEI, d_sn AS dSN, d_tf AS dTF, d_jp AS dJP,
            code, completeness, unanswered_count AS unansweredCount
       FROM interest_results ORDER BY computed_at DESC`
  );
}

function toCsv(rows) {
  const columns = [
    'attemptId',
    'computedAt',
    'algorithmVersion',
    'r',
    'i',
    'a',
    's',
    'e',
    'c',
    'dEI',
    'dSN',
    'dTF',
    'dJP',
    'code',
    'completeness',
    'unansweredCount',
  ];
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => escape(row[column])).join(','));
  return lines.join('\n');
}

module.exports = {
  listInstruments,
  getInstrument,
  getItems,
  createInstrument,
  updateInstrument,
  replaceItems,
  importInstrument,
  activateInstrument,
  getWeights,
  updateWeights,
  getStats,
  getResultDetail,
  getExportRows,
  toCsv,
  validateItems,
  validateWeights,
};
