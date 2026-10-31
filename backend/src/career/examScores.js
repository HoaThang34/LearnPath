'use strict';

const { queryAll, runSql, runAuthMutation } = require('../auth/authDb');
const { getBlockSubjects, BLOCK_CODES } = require('./subjects');

function getExamScores(userId) {
  return queryAll(
    `SELECT id, block, score, source, updated_at AS updatedAt
       FROM user_exam_scores WHERE user_id = ? ORDER BY block`,
    [userId]
  ).map((row) => ({
    id: Number(row.id),
    block: row.block,
    score: Number(row.score),
    source: row.source,
    updatedAt: Number(row.updatedAt),
  }));
}

function getExamScoreMap(userId) {
  const map = new Map();
  for (const row of getExamScores(userId)) map.set(row.block, row.score);
  return map;
}

function validateExamScores(input) {
  if (!Array.isArray(input)) return { error: 'Danh sách điểm thi không hợp lệ.' };
  if (input.length > 10) return { error: 'Chỉ lưu tối đa 10 tổ hợp điểm thi.' };
  const rows = [];
  const seen = new Set();
  for (const item of input) {
    const block = String(item?.block || '').trim().toUpperCase();
    const score = Number(item?.score);
    if (!BLOCK_CODES.includes(block)) {
      return { error: `Tổ hợp "${block || '(trống)'}" không được hỗ trợ.` };
    }
    if (!Number.isFinite(score) || score < 0 || score > 30) {
      return { error: `Điểm của tổ hợp ${block} phải từ 0 đến 30.` };
    }
    if (seen.has(block)) return { error: `Tổ hợp ${block} bị lặp.` };
    seen.add(block);
    rows.push({
      block,
      score: Math.round(score * 100) / 100,
      source: String(item?.source || 'tự khai').trim().slice(0, 100) || 'tự khai',
    });
  }
  return { rows };
}

async function saveExamScores(userId, input) {
  const validation = validateExamScores(input);
  if (validation.error) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }
  const now = Date.now();
  await runAuthMutation(() => {
    runSql('DELETE FROM user_exam_scores WHERE user_id = ?', [userId]);
    for (const row of validation.rows) {
      runSql(
        `INSERT INTO user_exam_scores (user_id, block, score, source, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, row.block, row.score, row.source, now]
      );
    }
  });
  return getExamScores(userId);
}

function describeExamScore(block) {
  const subjects = getBlockSubjects(block);
  return subjects ? subjects.join(' + ') : '';
}

module.exports = {
  getExamScores,
  getExamScoreMap,
  validateExamScores,
  saveExamScores,
  describeExamScore,
};
