const { queryAll, queryOne, runSql, lastInsertId, runAuthMutation } = require('./authDb');

const SCORE_TYPES = new Set(['average', 'tx', 'gk', 'hk']);
const MAX_PINS = 5;
const SUBJECT_ALIASES = {
  Toán: ['toán', 'toan'],
  'Ngữ văn': ['ngữ văn', 'ngu van', 'văn', 'van'],
  'Vật lý': ['vật lý', 'vat ly', 'lý', 'ly'],
  'Hóa học': ['hóa học', 'hoa hoc', 'hóa', 'hoa'],
  'Sinh học': ['sinh học', 'sinh hoc', 'sinh'],
  'Tiếng Anh': ['tiếng anh', 'tieng anh', 'anh'],
  'Lịch sử': ['lịch sử', 'lich su', 'sử', 'su'],
  'Địa lý': ['địa lý', 'dia ly', 'địa', 'dia'],
  'Tin học': ['tin học', 'tin hoc'],
};

function normalizeSubject(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('vi');
  if (!normalized) return '';
  for (const [canonical, aliases] of Object.entries(SUBJECT_ALIASES)) {
    if (aliases.some((alias) => alias.toLocaleLowerCase('vi') === normalized)) return canonical;
  }
  return String(value).trim().slice(0, 100);
}

function validateScoreRows(input) {
  if (!Array.isArray(input) || input.length > 100) return { error: 'Danh sách điểm không hợp lệ (tối đa 100 dòng).' };
  const rows = [];
  const seen = new Set();
  for (const item of input) {
    const subject = normalizeSubject(item?.subject);
    const term = String(item?.term || '').trim();
    const schoolYear = String(item?.schoolYear || '').trim();
    const scoreType = String(item?.scoreType || 'average').trim();
    const score = Number(item?.score);
    if (!subject || !/^([1-3]|HK[1-3]|CN)$/i.test(term) || !/^\d{4}-\d{4}$/.test(schoolYear) || !SCORE_TYPES.has(scoreType)) {
      return { error: 'Môn học, kỳ, năm học hoặc loại điểm không hợp lệ.' };
    }
    if (!Number.isFinite(score) || score < 0 || score > 10) return { error: `Điểm môn "${subject}" phải từ 0 đến 10.` };
    const key = [subject, term, schoolYear, scoreType].join('|');
    if (seen.has(key)) return { error: `Bị trùng điểm môn "${subject}" trong cùng kỳ/năm học/loại điểm.` };
    seen.add(key);
    rows.push({ subject, term, schoolYear, score: Math.round(score * 100) / 100, scoreType, source: String(item?.source || 'Học sinh tự nhập').trim().slice(0, 100) });
  }
  return { rows };
}

function getAcademicScores(userId) {
  return queryAll('SELECT id, subject_name AS subject, term, school_year AS schoolYear, score_type AS scoreType, score, source, updated_at AS updatedAt FROM academic_scores WHERE user_id = ? ORDER BY school_year DESC, term, subject_name', [userId]);
}

async function saveAcademicScores(userId, input) {
  const validated = validateScoreRows(input);
  if (validated.error) {
    const error = new Error(validated.error);
    error.statusCode = 400;
    throw error;
  }
  const now = Date.now();
  await runAuthMutation(() => {
    runSql('DELETE FROM academic_scores WHERE user_id = ?', [userId]);
    for (const row of validated.rows) {
      runSql(`INSERT INTO academic_scores (user_id, subject_name, term, school_year, score_type, score, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, row.subject, row.term, row.schoolYear, row.scoreType, row.score, row.source, now]);
    }
  });
  return getAcademicScores(userId);
}

function validateSelection(input) {
  if (!input || typeof input !== 'object') return { error: 'Lựa chọn ngành không hợp lệ.' };
  const schoolName = String(input.schoolName || '').trim().slice(0, 255);
  const majorName = String(input.majorName || '').trim().slice(0, 255);
  const method = String(input.method || '').trim().slice(0, 100);
  const schoolCode = String(input.schoolCode || '').trim().slice(0, 32) || null;
  const block = String(input.admissionBlock || '').trim().slice(0, 32) || null;
  const year = Number(input.year);
  const kind = input.kind;
  if (!schoolName || !majorName || !method || !Number.isInteger(year) || year !== 2025 || !['target', 'pinned'].includes(kind)) {
    return { error: 'Trường, ngành, phương thức, năm 2025 và loại lựa chọn là bắt buộc.' };
  }
  return { value: { schoolName, majorName, method, schoolCode, block, year, kind } };
}

function getCareerSelections(userId) {
  return queryAll(`SELECT id, school_code AS schoolCode, school_name AS schoolName, major_name AS majorName,
      method, admission_block AS admissionBlock, year, kind, created_at AS createdAt
    FROM career_selections WHERE user_id = ? ORDER BY kind, created_at`, [userId]);
}

async function addCareerSelection(userId, input) {
  const { error, value } = validateSelection(input);
  if (error) { const e = new Error(error); e.statusCode = 400; throw e; }
  const now = Date.now();
  await runAuthMutation(() => {
    const existing = queryOne('SELECT id FROM career_selections WHERE user_id = ? AND kind = ? AND school_name = ? AND major_name = ? AND method = ? AND COALESCE(admission_block, \'\') = COALESCE(?, \'\') AND year = ?', [userId, value.kind, value.schoolName, value.majorName, value.method, value.block, value.year]);
    if (existing) return;
    const count = queryOne('SELECT COUNT(*) AS total FROM career_selections WHERE user_id = ? AND kind = ?', [userId, value.kind]);
    if (value.kind === 'target' && Number(count.total) >= 1) { const e = new Error('Bạn chỉ có thể lưu một ngành mục tiêu.'); e.statusCode = 409; throw e; }
    if (value.kind === 'pinned' && Number(count.total) >= MAX_PINS) { const e = new Error(`Bạn chỉ có thể lưu tối đa ${MAX_PINS} ngành quan tâm.`); e.statusCode = 409; throw e; }
    runSql(`INSERT INTO career_selections
      (user_id, school_code, school_name, major_name, method, admission_block, year, kind, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, value.schoolCode, value.schoolName, value.majorName, value.method, value.block, value.year, value.kind, now, now]);
  });
  return getCareerSelections(userId);
}

async function removeCareerSelection(userId, id) {
  const row = queryOne('SELECT id FROM career_selections WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return false;
  await runAuthMutation(() => runSql('DELETE FROM career_selections WHERE id = ? AND user_id = ?', [id, userId]));
  return true;
}

function validateRubric(input) {
  const schoolName = String(input?.schoolName || '').trim().slice(0, 255);
  const majorName = String(input?.majorName || '').trim().slice(0, 255);
  const method = String(input?.method || '').trim().slice(0, 100);
  const schoolCode = String(input?.schoolCode || '').trim().slice(0, 32) || null;
  const block = String(input?.admissionBlock || '').trim().slice(0, 32) || null;
  const year = Number(input?.year);
  if (!schoolName || !majorName || !method || !Number.isInteger(year) || year !== 2025) return { error: 'Định danh lựa chọn tuyển sinh năm 2025 chưa hợp lệ.' };
  if (!Array.isArray(input.subjects) || input.subjects.length < 1 || input.subjects.length > 20) return { error: 'Rubric cần từ 1 đến 20 môn.' };
  const subjects = [];
  const seen = new Set();
  for (const item of input.subjects) {
    const subject = normalizeSubject(item?.subject);
    const weight = Number(item?.weight);
    const threshold = Number(item?.threshold);
    if (!subject || !Number.isFinite(weight) || weight <= 0 || weight > 1 || !Number.isFinite(threshold) || threshold < 0 || threshold > 10 || seen.has(subject)) return { error: 'Mỗi môn cần tên riêng, trọng số lớn hơn 0 và ngưỡng từ 0 đến 10.' };
    seen.add(subject);
    subjects.push({ subject, weight, threshold });
  }
  const total = subjects.reduce((sum, row) => sum + row.weight, 0);
  if (Math.abs(total - 1) > 0.001) return { error: `Tổng trọng số phải bằng 1 (hiện tại ${total.toFixed(3)}).` };
  return { value: { schoolName, majorName, method, schoolCode, block, year, subjects } };
}

function getRubrics() {
  return queryAll(`SELECT r.id, r.school_code AS schoolCode, r.school_name AS schoolName, r.major_name AS majorName,
      r.method, r.admission_block AS admissionBlock, r.year, r.updated_at AS updatedAt,
      s.subject_name AS subject, s.weight, s.threshold
    FROM career_rubrics r JOIN career_rubric_subjects s ON s.rubric_id = r.id
    ORDER BY r.school_name, r.major_name, r.method, r.admission_block, s.subject_name`);
}

async function saveRubric(input) {
  const { error, value } = validateRubric(input);
  if (error) { const e = new Error(error); e.statusCode = 400; throw e; }
  const existing = queryOne(`SELECT id FROM career_rubrics WHERE school_name = ? AND major_name = ? AND method = ?
    AND COALESCE(school_code, '') = COALESCE(?, '') AND COALESCE(admission_block, '') = COALESCE(?, '') AND year = ?`,
  [value.schoolName, value.majorName, value.method, value.schoolCode, value.block, value.year]);
  const now = Date.now();
  let rubricId;
  await runAuthMutation(() => {
    if (existing) {
      rubricId = Number(existing.id);
      runSql('UPDATE career_rubrics SET updated_at = ? WHERE id = ?', [now, rubricId]);
      runSql('DELETE FROM career_rubric_subjects WHERE rubric_id = ?', [rubricId]);
    } else {
      runSql(`INSERT INTO career_rubrics (school_code, school_name, major_name, method, admission_block, year, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [value.schoolCode, value.schoolName, value.majorName, value.method, value.block, value.year, now, now]);
      rubricId = lastInsertId();
    }
    for (const subject of value.subjects) runSql('INSERT INTO career_rubric_subjects (rubric_id, subject_name, weight, threshold) VALUES (?, ?, ?, ?)', [rubricId, subject.subject, subject.weight, subject.threshold]);
  });
  return rubricId;
}

async function deleteRubric(id) {
  const row = queryOne('SELECT id FROM career_rubrics WHERE id = ?', [id]);
  if (!row) return false;
  await runAuthMutation(() => runSql('DELETE FROM career_rubrics WHERE id = ?', [id]));
  return true;
}

function calculateCareerFit(scores, rubricRows) {
  const scoreBySubject = new Map(scores.map((row) => [`${normalizeSubject(row.subject || row.subject_name)}|${row.scoreType || row.score_type || 'average'}`, Number(row.score)]));
  const details = rubricRows.map((row) => {
    const subject = row.subject || row.subject_name;
    const score = scoreBySubject.get(`${normalizeSubject(subject)}|average`);
    return { subject, score: Number.isFinite(score) ? score : null, threshold: Number(row.threshold), weight: Number(row.weight), gap: Number.isFinite(score) ? Math.round((score - row.threshold) * 100) / 100 : null };
  });
  const present = details.filter((row) => row.score !== null);
  const coverage = Math.round(present.reduce((sum, row) => sum + row.weight, 0) * 1000) / 10;
  if (!present.length) return { fitPct: null, coveragePct: 0, status: 'insufficient_data', details };
  const denominator = present.reduce((sum, row) => sum + row.weight, 0);
  const numerator = present.reduce((sum, row) => sum + (row.threshold > 0 ? Math.min(row.score / row.threshold, 1) : 1) * row.weight, 0);
  const fitPct = Math.round((numerator / denominator) * 1000) / 10;
  return { fitPct, coveragePct: coverage, status: coverage < 100 ? 'partial_data' : 'complete', details };
}

module.exports = { getAcademicScores, saveAcademicScores, getCareerSelections, addCareerSelection, removeCareerSelection, getRubrics, saveRubric, deleteRubric, calculateCareerFit, validateScoreRows, validateRubric };
