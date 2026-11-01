const { queryAll, queryOne, runSql, lastInsertId, runAuthMutation } = require('./authDb');

const SCORE_TYPES = new Set(['average']);
const CLASS_LEVELS = new Set(['10', '11', '12']);
const TERMS = new Set(['Kỳ 1', 'Kỳ 2', 'Cả năm']);
const MAX_PINS = 5;
const SUBJECT_ALIASES = {
  Toán: ['toán', 'toan'],
  'Ngữ văn': ['ngữ văn', 'ngu van', 'văn', 'van'],
  'Vật lý': ['vật lý', 'vat ly', 'lý', 'ly'],
  'Hóa học': ['hóa học', 'hoa hoc', 'hóa', 'hoa'],
  'Sinh học': ['sinh học', 'sinh hoc', 'sinh'],
  'Tiếng Anh': ['tiếng anh', 'tieng anh', 'anh'],
  'Lịch sử': ['lịch sử', 'lich su', 'sử', 'su'],
  'Địa lý': ['địa lý', 'dia ly', 'địa lí', 'dia li', 'địa', 'dia'],
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
    const classLevel = String(item?.classLevel || '').trim();
    const scoreType = String(item?.scoreType || 'average').trim();
    if (item?.score === '' || item?.score === null || item?.score === undefined) {
      return { error: `Vui lòng nhập điểm môn "${subject || 'chưa đặt tên'}".` };
    }
    const score = Number(item?.score);
    if (!subject || !TERMS.has(term) || !CLASS_LEVELS.has(classLevel) || !SCORE_TYPES.has(scoreType)) {
      return { error: 'Môn học, kỳ, năm học hoặc loại điểm không hợp lệ.' };
    }
    if (!Number.isFinite(score) || score < 0 || score > 10) return { error: `Điểm môn "${subject}" phải từ 0 đến 10.` };
    const key = [subject, term, classLevel, scoreType].join('|');
    if (seen.has(key)) return { error: `Bị trùng điểm môn "${subject}" trong cùng kỳ/năm học/loại điểm.` };
    seen.add(key);
    rows.push({ subject, term, classLevel, score: Math.round(score * 100) / 100, scoreType, source: String(item?.source || 'Học sinh tự nhập').trim().slice(0, 100) });
  }
  return { rows };
}

function getAcademicScores(userId) {
  return queryAll('SELECT id, subject_name AS subject, term, class_level AS classLevel, score_type AS scoreType, score, source, updated_at AS updatedAt FROM academic_scores WHERE user_id = ? ORDER BY id', [userId]);
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
      runSql(`INSERT INTO academic_scores (user_id, subject_name, term, class_level, score_type, score, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, row.subject, row.term, row.classLevel, row.scoreType, row.score, row.source, now]);
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
    if (value.kind === 'target') {
      // Replace existing target
      runSql('DELETE FROM career_selections WHERE user_id = ? AND kind = ?', [userId, 'target']);
    } else {
      const count = queryOne('SELECT COUNT(*) AS total FROM career_selections WHERE user_id = ? AND kind = ?', [userId, value.kind]);
      if (value.kind === 'pinned' && Number(count.total) >= MAX_PINS) {
        const e = new Error(`Bạn chỉ có thể lưu tối đa ${MAX_PINS} ngành quan tâm.`);
        e.statusCode = 409;
        throw e;
      }
    }
    runSql(`INSERT INTO career_selections
      (user_id, school_code, school_name, major_name, method, admission_block, year, kind, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, value.schoolCode, value.schoolName, value.majorName, value.method, value.block, value.year, value.kind, now, now]);

    if (value.kind === 'target') {
      const profileRow = queryOne('SELECT user_id FROM user_profiles WHERE user_id = ?', [userId]);
      if (profileRow) {
        runSql('UPDATE user_profiles SET truong_muc_tieu = ?, nganh_muc_tieu = ?, updated_at = ? WHERE user_id = ?',
          [value.schoolName, value.majorName, now, userId]);
      } else {
        runSql(`INSERT INTO user_profiles (user_id, ho_va_ten, lop, truong, diem_lop, chung_chi, truong_muc_tieu, nganh_muc_tieu, to_hop_mong_muon, khac, updated_at)
          VALUES (?, '', '', '', '[]', '[]', ?, ?, '[]', '', ?)`,
          [userId, value.schoolName, value.majorName, now]);
      }
    }
  });
  return getCareerSelections(userId);
}

async function removeCareerSelection(userId, id) {
  const row = queryOne('SELECT id, kind, school_name, major_name FROM career_selections WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return false;
  await runAuthMutation(() => {
    runSql('DELETE FROM career_selections WHERE id = ? AND user_id = ?', [id, userId]);
    if (row.kind === 'target') {
      runSql('UPDATE user_profiles SET truong_muc_tieu = \'\', nganh_muc_tieu = \'\', updated_at = ? WHERE user_id = ?', [Date.now(), userId]);
    }
  });
  return true;
}

function validateRubric(input) {
  const schoolName = String(input?.schoolName || '').trim().slice(0, 255);
  const majorName = String(input?.majorName || '').trim().slice(0, 255);
  const method = String(input?.method || '').trim().slice(0, 100);
  const schoolCode = String(input?.schoolCode || '').trim().slice(0, 32) || null;
  const block = String(input?.admissionBlock || '').trim().slice(0, 32) || null;
  const majorGroup = String(input?.majorGroup || '').trim().slice(0, 100) || null;
  const entryScore = (input?.entryScore !== undefined && input?.entryScore !== null && input?.entryScore !== '') ? Number(input.entryScore) : null;
  const year = Number(input?.year);
  if (!schoolName || !majorName || !method || !Number.isInteger(year) || year !== 2025) return { error: 'Định danh lựa chọn tuyển sinh năm 2025 chưa hợp lệ.' };
  if (!Array.isArray(input.subjects) || input.subjects.length < 1 || input.subjects.length > 20) return { error: 'Rubric cần từ 1 đến 20 môn.' };
  const subjects = [];
  const seen = new Set();
  for (const item of input.subjects) {
    const subject = normalizeSubject(item?.subject);
    const weight = Number(item?.weight);
    const threshold = Number(item?.threshold);
    if (!subject || !Number.isFinite(weight) || weight <= 0 || weight > 1 || !Number.isFinite(threshold) || threshold < 0 || threshold > 30 || seen.has(subject)) return { error: 'Mỗi môn cần tên riêng, trọng số lớn hơn 0 và ngưỡng từ 0 đến 30.' };
    seen.add(subject);
    subjects.push({ subject, weight, threshold });
  }
  const total = subjects.reduce((sum, row) => sum + row.weight, 0);
  if (Math.abs(total - 1) > 0.001) return { error: `Tổng trọng số phải bằng 1 (hiện tại ${total.toFixed(3)}).` };
  return { value: { schoolName, majorName, method, schoolCode, block, majorGroup, entryScore, year, subjects } };
}

function getRubrics({ includeInvalid = false } = {}) {
  const where = includeInvalid ? '' : 'WHERE COALESCE(r.is_valid, 1) = 1';
  const rows = queryAll(`SELECT r.id, r.school_code AS schoolCode, r.school_name AS schoolName, r.major_name AS majorName,
      r.method, r.admission_block AS admissionBlock, r.major_group AS majorGroup, r.entry_score AS entryScore,
      r.year, COALESCE(r.is_valid, 1) AS isValid, r.updated_at AS updatedAt,
      s.subject_name AS subject, s.weight, s.threshold
    FROM career_rubrics r JOIN career_rubric_subjects s ON s.rubric_id = r.id
    ${where}
    ORDER BY r.school_name, r.major_name, r.method, r.admission_block, s.subject_name`);
  return rows.map((r) => ({ ...r, isValid: Boolean(r.isValid) }));
}

async function saveRubric(input) {
  const { error, value } = validateRubric(input);
  if (error) { const e = new Error(error); e.statusCode = 400; throw e; }
  const isValid = (input?.isValid === false || input?.is_valid === 0) ? 0 : 1;
  const existing = queryOne(`SELECT id FROM career_rubrics WHERE school_name = ? AND major_name = ? AND method = ?
    AND COALESCE(school_code, '') = COALESCE(?, '') AND COALESCE(admission_block, '') = COALESCE(?, '') AND year = ?`,
  [value.schoolName, value.majorName, value.method, value.schoolCode, value.block, value.year]);
  const now = Date.now();
  let rubricId;
  await runAuthMutation(() => {
    if (existing) {
      rubricId = Number(existing.id);
      runSql('UPDATE career_rubrics SET major_group = ?, entry_score = ?, is_valid = ?, updated_at = ? WHERE id = ?', [value.majorGroup, value.entryScore, isValid, now, rubricId]);
      runSql('DELETE FROM career_rubric_subjects WHERE rubric_id = ?', [rubricId]);
    } else {
      runSql(`INSERT INTO career_rubrics (school_code, school_name, major_name, method, admission_block, major_group, entry_score, is_valid, year, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [value.schoolCode, value.schoolName, value.majorName, value.method, value.block, value.majorGroup, value.entryScore, isValid, value.year, now, now]);
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

const STANDARD_COMMON_SUBJECTS = [
  'Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý',
];
const FOUNDATION_THRESHOLD = 6.5;
const CORE_WEIGHT_RATIO = 0.75;
const FOUNDATION_WEIGHT_RATIO = 0.25;

function calculateCareerFit(scores, rubricRows, options = {}) {
  const foundationThreshold = options.foundationThreshold || FOUNDATION_THRESHOLD;
  const coreRatio = options.coreRatio !== undefined ? options.coreRatio : CORE_WEIGHT_RATIO;
  const foundationRatio = options.foundationRatio !== undefined ? options.foundationRatio : FOUNDATION_WEIGHT_RATIO;

  const validScores = scores.filter((row) => (row.scoreType || row.score_type || 'average') === 'average');
  const scoreBySubject = new Map(validScores
    .map((row) => [`${normalizeSubject(row.subject || row.subject_name)}|average`, Number(row.score)]));

  const coreSubjectNames = new Set();
  const details = rubricRows.map((row) => {
    const subject = row.subject || row.subject_name;
    const norm = normalizeSubject(subject);
    coreSubjectNames.add(norm);
    const score = scoreBySubject.get(`${norm}|average`);
    return {
      subject,
      score: Number.isFinite(score) ? score : null,
      threshold: Number(row.threshold),
      weight: Number(row.weight),
      gap: Number.isFinite(score) ? Math.round((score - row.threshold) * 100) / 100 : null,
      isCore: true,
    };
  });
  const present = details.filter((row) => row.score !== null);
  const coverage = Math.round(present.reduce((sum, row) => sum + row.weight, 0) * 1000) / 10;
  const needImprovement = details
    .filter((row) => row.score !== null && row.gap !== null && row.gap < 0)
    .sort((a, b) => b.weight - a.weight || a.gap - b.gap);
  const prioritySubject = needImprovement.length > 0 ? needImprovement[0].subject : null;

  let fitPct = null;
  if (present.length > 0) {
    const denominator = present.reduce((sum, row) => sum + row.weight, 0);
    const numerator = present.reduce((sum, row) => sum + (row.threshold > 0 ? Math.min(row.score / row.threshold, 1) : 1) * row.weight, 0);
    fitPct = Math.round((numerator / denominator) * 1000) / 10;
  }

  // Comprehensive details & fit (75% core combination + 25% foundation subjects with baseline 6.5)
  const nonCoreSubjectList = [];
  const addedNonCore = new Set();

  for (const s of STANDARD_COMMON_SUBJECTS) {
    const norm = normalizeSubject(s);
    if (!coreSubjectNames.has(norm) && !addedNonCore.has(norm)) {
      nonCoreSubjectList.push(s);
      addedNonCore.add(norm);
    }
  }
  for (const s of validScores) {
    const subName = s.subject || s.subject_name;
    const norm = normalizeSubject(subName);
    if (!coreSubjectNames.has(norm) && !addedNonCore.has(norm)) {
      nonCoreSubjectList.push(subName);
      addedNonCore.add(norm);
    }
  }

  const foundationCount = nonCoreSubjectList.length;
  const foundationWeightPerSubject = foundationCount > 0 ? foundationRatio / foundationCount : 0;

  const allCoreItems = details.map((d) => ({
    ...d,
    weight: Math.round(d.weight * coreRatio * 10000) / 10000,
    isCore: true,
  }));

  const foundationItems = nonCoreSubjectList.map((subject) => {
    const norm = normalizeSubject(subject);
    const score = scoreBySubject.get(`${norm}|average`);
    const numScore = Number.isFinite(score) ? score : null;
    const gap = numScore !== null ? Math.round((numScore - foundationThreshold) * 100) / 100 : null;
    return {
      subject,
      score: numScore,
      threshold: foundationThreshold,
      weight: Math.round(foundationWeightPerSubject * 10000) / 10000,
      gap,
      isCore: false,
    };
  });

  const allDetails = [...allCoreItems, ...foundationItems];
  const allPresent = allDetails.filter((row) => row.score !== null);

  let allFitPct = null;
  let allCoveragePct = 0;
  if (allPresent.length > 0) {
    const allDenominator = allPresent.reduce((sum, row) => sum + row.weight, 0);
    const allNumerator = allPresent.reduce(
      (sum, row) => sum + (row.threshold > 0 ? Math.min(row.score / row.threshold, 1) : 1) * row.weight,
      0
    );
    allFitPct = Math.round((allNumerator / allDenominator) * 1000) / 10;
    allCoveragePct = Math.round(allDenominator * 1000) / 10;
  }

  const status = !present.length ? 'insufficient_data' : coverage < 100 ? 'partial_data' : 'complete';

  return {
    fitPct,
    coveragePct: coverage,
    status,
    details,
    prioritySubject,
    allDetails,
    allFitPct,
    allCoveragePct,
  };
}

let EDUMIND_RUBRICS = [];
try {
  EDUMIND_RUBRICS = require('../data/edumind_rubrics.json');
} catch (e) {
  // fallback
}

const SAMPLE_RUBRICS = (Array.isArray(EDUMIND_RUBRICS) && EDUMIND_RUBRICS.length > 0) ? EDUMIND_RUBRICS : [
  {
    schoolCode: 'BKA',
    schoolName: 'ĐHBK Hà Nội',
    majorName: 'Kỹ thuật Điều khiển - Tự động hoá (CT tiên tiến)',
    method: 'Điểm thi THPT',
    admissionBlock: 'A00',
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.40, threshold: 8.5 },
      { subject: 'Vật lý', weight: 0.35, threshold: 8.0 },
      { subject: 'Tiếng Anh', weight: 0.25, threshold: 7.0 },
    ],
  },
  {
    schoolCode: 'BKA',
    schoolName: 'ĐHBK Hà Nội',
    majorName: 'Khoa học Dữ liệu và Trí tuệ nhân tạo (CT tiên tiến)',
    method: 'Điểm thi THPT',
    admissionBlock: 'A00',
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.45, threshold: 9.0 },
      { subject: 'Tin học', weight: 0.30, threshold: 8.5 },
      { subject: 'Tiếng Anh', weight: 0.25, threshold: 8.0 },
    ],
  },
  {
    schoolCode: 'KHA',
    schoolName: 'ĐH Kinh tế Quốc dân',
    majorName: 'Kinh tế quốc tế',
    method: 'Điểm thi THPT',
    admissionBlock: 'D01',
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.35, threshold: 8.0 },
      { subject: 'Tiếng Anh', weight: 0.40, threshold: 8.5 },
      { subject: 'Ngữ văn', weight: 0.25, threshold: 7.5 },
    ],
  },
  {
    schoolCode: 'KHA',
    schoolName: 'ĐH Kinh tế Quốc dân',
    majorName: 'Quản trị kinh doanh',
    method: 'Điểm thi THPT',
    admissionBlock: 'A00',
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.40, threshold: 7.5 },
      { subject: 'Vật lý', weight: 0.30, threshold: 7.0 },
      { subject: 'Hóa học', weight: 0.30, threshold: 7.0 },
    ],
  },
  {
    schoolCode: 'NTH',
    schoolName: 'ĐH Ngoại thương',
    majorName: 'CT TT Kinh tế đối ngoại',
    method: 'Điểm thi THPT',
    admissionBlock: 'A01',
    year: 2025,
    subjects: [
      { subject: 'Tiếng Anh', weight: 0.45, threshold: 9.0 },
      { subject: 'Toán', weight: 0.35, threshold: 8.5 },
      { subject: 'Vật lý', weight: 0.20, threshold: 8.0 },
    ],
  },
  {
    schoolCode: 'SPH',
    schoolName: 'ĐH Sư phạm Hà Nội',
    majorName: 'Sư phạm Toán học',
    method: 'Điểm thi THPT',
    admissionBlock: 'A00',
    year: 2025,
    subjects: [
      { subject: 'Toán', weight: 0.50, threshold: 9.0 },
      { subject: 'Vật lý', weight: 0.25, threshold: 8.0 },
      { subject: 'Ngữ văn', weight: 0.25, threshold: 7.5 },
    ],
  },
];

async function seedSampleRubrics(force = false) {
  const existing = getRubrics();
  if (existing.length > 0 && !force) return existing;
  for (const item of SAMPLE_RUBRICS) {
    await saveRubric(item);
  }
  return getRubrics();
}

module.exports = {
  getAcademicScores,
  saveAcademicScores,
  getCareerSelections,
  addCareerSelection,
  removeCareerSelection,
  getRubrics,
  saveRubric,
  deleteRubric,
  calculateCareerFit,
  normalizeSubject,
  validateScoreRows,
  validateRubric,
  seedSampleRubrics,
  SAMPLE_RUBRICS,
};
