const { queryAll, queryOne, runSql, lastInsertId, runAuthMutation } = require('../auth/authDb');
const { queryAll: queryMainDb } = require('../database/db');

function parseSemesters(semestersJson) {
  if (!semestersJson) return [];
  if (Array.isArray(semestersJson)) return semestersJson;
  try {
    const parsed = JSON.parse(semestersJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCurriculum(row) {
  if (!row) return null;
  return {
    id: row.id,
    schoolCode: row.school_code || '',
    schoolName: row.school_name,
    majorCode: row.major_code || '',
    majorName: row.major_name,
    degreeLevel: row.degree_level || 'Đại học',
    durationYears: row.duration_years != null ? Number(row.duration_years) : 4,
    totalCredits: row.total_credits != null ? Number(row.total_credits) : null,
    description: row.description || '',
    content: row.content || '',
    semesters: parseSemesters(row.semesters_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listCurriculums({ search, school, major, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const whereClauses = [];
  const params = [];

  if (school && String(school).trim()) {
    const schoolTerm = String(school).trim();
    whereClauses.push('(LOWER(school_name) = LOWER(?) OR LOWER(school_code) = LOWER(?))');
    params.push(schoolTerm, schoolTerm);
  }

  if (major && String(major).trim()) {
    const majorTerm = String(major).trim();
    whereClauses.push('(LOWER(major_name) = LOWER(?) OR LOWER(major_code) = LOWER(?))');
    params.push(majorTerm, majorTerm);
  }

  if (search && String(search).trim()) {
    const term = `%${String(search).trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(school_name) LIKE ? OR LOWER(school_code) LIKE ? OR LOWER(major_name) LIKE ? OR LOWER(major_code) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = queryOne(`SELECT COUNT(*) AS total FROM curriculums ${whereSql}`, params);
  const total = countRow ? Number(countRow.total) : 0;

  const rows = queryAll(
    `SELECT id, school_code, school_name, major_code, major_name, degree_level,
            duration_years, total_credits, description, content, semesters_json,
            created_at, updated_at
       FROM curriculums
      ${whereSql}
      ORDER BY school_name ASC, major_name ASC
      LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset]
  );

  return {
    items: rows.map(normalizeCurriculum),
    total,
    limit: safeLimit,
    offset: safeOffset,
  };
}

function getCurriculumById(id) {
  const numId = Number(id);
  if (!numId) return null;
  const row = queryOne(
    `SELECT id, school_code, school_name, major_code, major_name, degree_level,
            duration_years, total_credits, description, content, semesters_json,
            created_at, updated_at
       FROM curriculums
      WHERE id = ?`,
    [numId]
  );
  return normalizeCurriculum(row);
}

function getCurriculumBySchoolAndMajor(schoolName, majorName) {
  if (!schoolName || !majorName) return null;
  const row = queryOne(
    `SELECT id, school_code, school_name, major_code, major_name, degree_level,
            duration_years, total_credits, description, content, semesters_json,
            created_at, updated_at
       FROM curriculums
      WHERE LOWER(school_name) = LOWER(?) AND LOWER(major_name) = LOWER(?)`,
    [String(schoolName).trim(), String(majorName).trim()]
  );
  return normalizeCurriculum(row);
}

function listCurriculumSchools() {
  const rows = queryAll(
    `SELECT school_name, school_code, COUNT(*) AS major_count
       FROM curriculums
      GROUP BY school_name, school_code
      ORDER BY school_name ASC`
  );
  return rows.map((r) => ({
    schoolName: r.school_name,
    schoolCode: r.school_code || '',
    majorCount: Number(r.major_count) || 0,
  }));
}

function listCurriculumMajors(schoolName) {
  if (!schoolName || !String(schoolName).trim()) return [];
  const term = String(schoolName).trim();
  const rows = queryAll(
    `SELECT id, school_name, major_code, major_name, degree_level,
            duration_years, total_credits, updated_at
       FROM curriculums
      WHERE LOWER(school_name) = LOWER(?) OR LOWER(school_code) = LOWER(?)
      ORDER BY major_name ASC`,
    [term, term]
  );
  return rows.map((r) => ({
    id: r.id,
    schoolName: r.school_name,
    majorCode: r.major_code || '',
    majorName: r.major_name,
    degreeLevel: r.degree_level || 'Đại học',
    durationYears: r.duration_years != null ? Number(r.duration_years) : 4,
    totalCredits: r.total_credits != null ? Number(r.total_credits) : null,
    updatedAt: r.updated_at,
  }));
}

function getCurriculumOptions() {
  // Pull from learnpath.db truong and diem_chuan
  let schools = [];
  let majors = [];

  try {
    const truongRows = queryMainDb('SELECT DISTINCT ma_truong, ten_truong FROM truong ORDER BY ten_truong ASC');
    schools = (truongRows || []).map((r) => ({
      code: r.ma_truong || '',
      name: r.ten_truong || '',
    }));
  } catch {
    // Main admission DB might not be initialized in isolated test environments
  }

  try {
    const majorRows = queryMainDb('SELECT DISTINCT truong, nganh FROM diem_chuan ORDER BY nganh ASC');
    majors = (majorRows || []).map((r) => ({
      schoolName: r.truong || '',
      name: r.nganh || '',
    }));
  } catch {
    // Main admission DB might not be initialized in isolated test environments
  }

  // Also include any custom schools or majors already entered in curriculums
  try {
    const customSchools = queryAll('SELECT DISTINCT school_code, school_name FROM curriculums ORDER BY school_name ASC');
    for (const cs of customSchools) {
      if (!schools.some((s) => s.name.toLowerCase() === cs.school_name.toLowerCase())) {
        schools.push({ code: cs.school_code || '', name: cs.school_name });
      }
    }
  } catch {}

  return { schools, majors };
}

function validateCurriculumInput(input, { isUpdate = false, existingId = null } = {}) {
  if (!input || typeof input !== 'object') {
    const error = new Error('Dữ liệu không hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  const schoolName = String(input.schoolName || input.school_name || '').trim();
  const majorName = String(input.majorName || input.major_name || '').trim();

  if (!schoolName) {
    const error = new Error('Tên trường không được để trống.');
    error.statusCode = 400;
    throw error;
  }
  if (!majorName) {
    const error = new Error('Tên ngành không được để trống.');
    error.statusCode = 400;
    throw error;
  }

  // Check unique school + major
  const existing = queryOne(
    `SELECT id FROM curriculums WHERE LOWER(school_name) = LOWER(?) AND LOWER(major_name) = LOWER(?)`,
    [schoolName, majorName]
  );
  if (existing && (!isUpdate || existing.id !== existingId)) {
    const error = new Error(`Chương trình học của ngành "${majorName}" tại trường "${schoolName}" đã tồn tại.`);
    error.statusCode = 409;
    throw error;
  }

  const schoolCode = String(input.schoolCode || input.school_code || '').trim().slice(0, 32);
  const majorCode = String(input.majorCode || input.major_code || '').trim().slice(0, 32);
  const degreeLevel = String(input.degreeLevel || input.degree_level || 'Đại học').trim().slice(0, 50);

  let durationYears = 4;
  if (input.durationYears != null || input.duration_years != null) {
    const val = Number(input.durationYears != null ? input.durationYears : input.duration_years);
    if (!Number.isNaN(val) && val > 0 && val <= 10) {
      durationYears = val;
    }
  }

  let totalCredits = null;
  if (input.totalCredits != null || input.total_credits != null) {
    const val = parseInt(input.totalCredits != null ? input.totalCredits : input.total_credits, 10);
    if (!Number.isNaN(val) && val >= 0 && val <= 500) {
      totalCredits = val;
    }
  }

  const description = String(input.description || '').trim();
  const content = String(input.content || '').trim();

  let semestersJson = null;
  if (input.semesters) {
    if (typeof input.semesters === 'string') {
      semestersJson = input.semesters;
    } else if (Array.isArray(input.semesters)) {
      semestersJson = JSON.stringify(input.semesters);
    }
  } else if (input.semesters_json) {
    semestersJson = typeof input.semesters_json === 'string' ? input.semesters_json : JSON.stringify(input.semesters_json);
  }

  return {
    schoolCode,
    schoolName,
    majorCode,
    majorName,
    degreeLevel,
    durationYears,
    totalCredits,
    description,
    content,
    semestersJson,
  };
}

async function createCurriculum(input) {
  const validated = validateCurriculumInput(input, { isUpdate: false });
  const now = Date.now();

  let createdId = null;
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO curriculums
         (school_code, school_name, major_code, major_name, degree_level,
          duration_years, total_credits, description, content, semesters_json,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.schoolCode,
        validated.schoolName,
        validated.majorCode,
        validated.majorName,
        validated.degreeLevel,
        validated.durationYears,
        validated.totalCredits,
        validated.description,
        validated.content,
        validated.semestersJson,
        now,
        now,
      ]
    );
    createdId = lastInsertId();
  });

  return getCurriculumById(createdId);
}

async function updateCurriculum(id, input) {
  const numId = Number(id);
  const existing = getCurriculumById(numId);
  if (!existing) {
    const error = new Error('Không tìm thấy chương trình học cần cập nhật.');
    error.statusCode = 404;
    throw error;
  }

  const validated = validateCurriculumInput(input, { isUpdate: true, existingId: numId });
  const now = Date.now();

  await runAuthMutation(() => {
    runSql(
      `UPDATE curriculums
          SET school_code = ?,
              school_name = ?,
              major_code = ?,
              major_name = ?,
              degree_level = ?,
              duration_years = ?,
              total_credits = ?,
              description = ?,
              content = ?,
              semesters_json = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        validated.schoolCode,
        validated.schoolName,
        validated.majorCode,
        validated.majorName,
        validated.degreeLevel,
        validated.durationYears,
        validated.totalCredits,
        validated.description,
        validated.content,
        validated.semestersJson,
        now,
        numId,
      ]
    );
  });

  return getCurriculumById(numId);
}

async function deleteCurriculum(id) {
  const numId = Number(id);
  const existing = getCurriculumById(numId);
  if (!existing) {
    const error = new Error('Không tìm thấy chương trình học cần xóa.');
    error.statusCode = 404;
    throw error;
  }

  await runAuthMutation(() => {
    runSql('DELETE FROM curriculums WHERE id = ?', [numId]);
  });

  return existing;
}

module.exports = {
  listCurriculums,
  getCurriculumById,
  getCurriculumBySchoolAndMajor,
  listCurriculumSchools,
  listCurriculumMajors,
  getCurriculumOptions,
  createCurriculum,
  updateCurriculum,
  deleteCurriculum,
};
