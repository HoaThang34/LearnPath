const {
  queryAll,
  queryOne,
  runSql,
  lastInsertId,
  runAuthMutation,
} = require('./authDb');
const { saveUserProfile, getUserProfile } = require('./userProfile');

function getActiveSurveyQuestions() {
  const rows = queryAll(
    `SELECT id, question, question_type, placeholder, is_required, order_index, is_active
       FROM survey_questions
      WHERE is_active = 1
      ORDER BY order_index ASC, id ASC`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    question: r.question,
    questionType: r.question_type || 'text',
    placeholder: r.placeholder || '',
    isRequired: Boolean(Number(r.is_required || 0)),
    orderIndex: Number(r.order_index || 0),
    isActive: Boolean(Number(r.is_active || 1)),
  }));
}

function getAllAdminSurveyQuestions() {
  const rows = queryAll(
    `SELECT id, question, question_type, placeholder, is_required, order_index, is_active, created_at, updated_at
       FROM survey_questions
      ORDER BY order_index ASC, id ASC`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    question: r.question,
    questionType: r.question_type || 'text',
    placeholder: r.placeholder || '',
    isRequired: Boolean(Number(r.is_required || 0)),
    orderIndex: Number(r.order_index || 0),
    isActive: Boolean(Number(r.is_active || 1)),
    createdAt: new Date(Number(r.created_at)).toISOString(),
    updatedAt: new Date(Number(r.updated_at)).toISOString(),
  }));
}

function validateQuestionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Dữ liệu câu hỏi không hợp lệ.' };
  }

  const question = typeof input.question === 'string' ? input.question.trim() : '';
  if (!question) {
    return { ok: false, error: 'Nội dung câu hỏi không được để trống.' };
  }
  if (question.length > 500) {
    return { ok: false, error: 'Nội dung câu hỏi không được vượt quá 500 ký tự.' };
  }

  const rawType = typeof input.questionType === 'string' ? input.questionType.trim() : 'text';
  const questionType = rawType === 'textarea' ? 'textarea' : 'text';

  const placeholder = typeof input.placeholder === 'string' ? input.placeholder.trim().slice(0, 255) : '';
  const isRequired = input.isRequired ? 1 : 0;
  const orderIndex = Number.isInteger(Number(input.orderIndex)) ? Number(input.orderIndex) : 0;
  const isActive = input.isActive === false || input.isActive === 0 ? 0 : 1;

  return {
    ok: true,
    values: {
      question,
      questionType,
      placeholder,
      isRequired,
      orderIndex,
      isActive,
    },
  };
}

async function createAdminSurveyQuestion(input) {
  const validation = validateQuestionInput(input);
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  const v = validation.values;
  const now = Date.now();

  let newId = null;
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO survey_questions (
         question, question_type, placeholder, is_required, order_index, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.question, v.questionType, v.placeholder, v.isRequired, v.orderIndex, v.isActive, now, now]
    );
    newId = lastInsertId();
  });

  const row = queryOne(
    `SELECT id, question, question_type, placeholder, is_required, order_index, is_active, created_at, updated_at
       FROM survey_questions WHERE id = ?`,
    [newId]
  );

  return {
    id: Number(row.id),
    question: row.question,
    questionType: row.question_type,
    placeholder: row.placeholder || '',
    isRequired: Boolean(Number(row.is_required || 0)),
    orderIndex: Number(row.order_index || 0),
    isActive: Boolean(Number(row.is_active || 1)),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  };
}

async function updateAdminSurveyQuestion(id, input) {
  const existing = queryOne('SELECT id FROM survey_questions WHERE id = ?', [id]);
  if (!existing) {
    const error = new Error('Câu hỏi khảo sát không tồn tại.');
    error.statusCode = 404;
    throw error;
  }

  const validation = validateQuestionInput(input);
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  const v = validation.values;
  const now = Date.now();

  await runAuthMutation(() => {
    runSql(
      `UPDATE survey_questions
          SET question = ?, question_type = ?, placeholder = ?, is_required = ?,
              order_index = ?, is_active = ?, updated_at = ?
        WHERE id = ?`,
      [v.question, v.questionType, v.placeholder, v.isRequired, v.orderIndex, v.isActive, now, id]
    );
  });

  const row = queryOne(
    `SELECT id, question, question_type, placeholder, is_required, order_index, is_active, created_at, updated_at
       FROM survey_questions WHERE id = ?`,
    [id]
  );

  return {
    id: Number(row.id),
    question: row.question,
    questionType: row.question_type,
    placeholder: row.placeholder || '',
    isRequired: Boolean(Number(row.is_required || 0)),
    orderIndex: Number(row.order_index || 0),
    isActive: Boolean(Number(row.is_active || 1)),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  };
}

async function deleteAdminSurveyQuestion(id) {
  const existing = queryOne('SELECT id, question FROM survey_questions WHERE id = ?', [id]);
  if (!existing) {
    const error = new Error('Câu hỏi khảo sát không tồn tại.');
    error.statusCode = 404;
    throw error;
  }

  await runAuthMutation(() => {
    runSql('DELETE FROM survey_questions WHERE id = ?', [id]);
  });

  return { id: Number(existing.id), question: existing.question };
}

async function submitSurvey(userId, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const error = new Error('Dữ liệu khảo sát không hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Kiểm tra các trường cố định bắt buộc
  const hoVaTen = typeof payload.ho_va_ten === 'string' ? payload.ho_va_ten.trim() : '';
  const lop = typeof payload.lop === 'string' ? payload.lop.trim() : '';
  const truong = typeof payload.truong === 'string' ? payload.truong.trim() : '';
  const truongMucTieu = typeof payload.truong_muc_tieu === 'string' ? payload.truong_muc_tieu.trim() : '';
  const nganhMucTieu = typeof payload.nganh_muc_tieu === 'string' ? payload.nganh_muc_tieu.trim() : '';
  const rawToHop = Array.isArray(payload.to_hop_mong_muon) ? payload.to_hop_mong_muon : [];

  if (!hoVaTen) {
    const error = new Error('Vui lòng nhập Họ và tên.');
    error.statusCode = 400;
    throw error;
  }
  if (!lop) {
    const error = new Error('Vui lòng nhập Lớp của bạn.');
    error.statusCode = 400;
    throw error;
  }
  if (!truong) {
    const error = new Error('Vui lòng nhập Trường THPT bạn đang học.');
    error.statusCode = 400;
    throw error;
  }
  if (!truongMucTieu) {
    const error = new Error('Vui lòng nhập Trường đại học mục tiêu.');
    error.statusCode = 400;
    throw error;
  }
  if (!nganhMucTieu) {
    const error = new Error('Vui lòng nhập Ngành học mục tiêu.');
    error.statusCode = 400;
    throw error;
  }

  const toHopMongMuon = rawToHop
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  if (toHopMongMuon.length !== 3) {
    const error = new Error('Vui lòng chọn đúng 3 môn thi cho tổ hợp mong muốn.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Điểm các môn trên lớp & chứng chỉ (không bắt buộc điền)
  const diemLop = Array.isArray(payload.diem_lop) ? payload.diem_lop : [];
  const chungChi = Array.isArray(payload.chung_chi) ? payload.chung_chi : [];

  // 3. Xử lý câu hỏi thêm từ quản trị viên
  const activeQuestions = getActiveSurveyQuestions();
  const rawCustomAnswers = Array.isArray(payload.custom_answers)
    ? payload.custom_answers
    : [];

  const answersMap = new Map();
  for (const item of rawCustomAnswers) {
    if (item && (item.id || item.questionId)) {
      const qId = Number(item.id || item.questionId);
      const ans = typeof item.answer === 'string' ? item.answer.trim() : '';
      answersMap.set(qId, ans);
    }
  }

  const customFormattedLines = [];

  for (const q of activeQuestions) {
    const ans = answersMap.get(q.id) || '';
    if (q.isRequired && !ans) {
      const error = new Error(`Vui lòng trả lời câu hỏi bắt buộc: "${q.question}".`);
      error.statusCode = 400;
      throw error;
    }
    if (ans) {
      // Định dạng theo yêu cầu: câu hỏi - câu trả lời từ user
      customFormattedLines.push(`${q.question} - ${ans}`);
    }
  }

  // Lưu các câu trả lời custom vào mục Khác
  const customKhacText = customFormattedLines.join('\n');

  // Nếu người dùng có gửi thêm ghi chú riêng ở mục khac, lọc bỏ câu trả lời cũ để tránh lặp dòng
  const additionalNotes = typeof payload.khac === 'string' ? payload.khac.trim() : '';
  let cleanAdditionalNotes = additionalNotes;
  if (cleanAdditionalNotes && customFormattedLines.length > 0) {
    const lines = cleanAdditionalNotes.split('\n');
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return !activeQuestions.some((q) => trimmed.startsWith(`${q.question} -`));
    });
    cleanAdditionalNotes = filteredLines.join('\n');
  }

  let finalKhac = customKhacText;
  if (cleanAdditionalNotes) {
    finalKhac = finalKhac ? `${finalKhac}\n${cleanAdditionalNotes}` : cleanAdditionalNotes;
  }

  // Lưu vào user_profiles
  const profilePayload = {
    ho_va_ten: hoVaTen,
    lop,
    truong,
    diem_lop: diemLop,
    chung_chi: chungChi,
    truong_muc_tieu: truongMucTieu,
    nganh_muc_tieu: nganhMucTieu,
    to_hop_mong_muon: toHopMongMuon,
    khac: finalKhac.slice(0, 5000),
  };

  const updatedProfile = await saveUserProfile(userId, profilePayload);

  // Cập nhật survey_completed = 1 trong bảng users
  const now = Date.now();
  await runAuthMutation(() => {
    runSql('UPDATE users SET survey_completed = 1, updated_at = ? WHERE id = ?', [now, userId]);
  });

  const updatedUserRow = queryOne(
    'SELECT id, username, status, must_change_password, survey_completed, created_at FROM users WHERE id = ?',
    [userId]
  );

  return {
    user: {
      id: Number(updatedUserRow.id),
      username: updatedUserRow.username,
      status: updatedUserRow.status || 'active',
      mustChangePassword: Boolean(Number(updatedUserRow.must_change_password || 0)),
      surveyCompleted: true,
      createdAt: new Date(Number(updatedUserRow.created_at)).toISOString(),
    },
    profile: updatedProfile,
  };
}

const SAMPLE_SURVEY_QUESTIONS = [
  {
    question: 'Sở thích hoặc lĩnh vực bạn yêu thích nhất ngoài việc học là gì?',
    questionType: 'text',
    placeholder: 'Ví dụ: Lập trình, thiết kế đồ họa, đọc sách, nghiên cứu khoa học, chơi cờ vua...',
    isRequired: 0,
    orderIndex: 1,
    isActive: 1,
  },
  {
    question: 'Bạn có dự định học đại học ở tỉnh/thành phố nào (hoặc có định hướng du học không)?',
    questionType: 'text',
    placeholder: 'Ví dụ: Hà Nội, TP.HCM, Đà Nẵng, hoặc du học sau tốt nghiệp...',
    isRequired: 0,
    orderIndex: 2,
    isActive: 1,
  },
  {
    question: 'Mức học phí/kinh phí dự kiến cho một năm học đại học mà gia đình bạn có thể chi trả là bao nhiêu?',
    questionType: 'text',
    placeholder: 'Ví dụ: Dưới 20 triệu/năm, 20-50 triệu/năm, hoặc trường quốc tế...',
    isRequired: 0,
    orderIndex: 3,
    isActive: 1,
  },
  {
    question: 'Bạn ưu tiên tiêu chí nào nhất khi chọn trường đại học (chất lượng đào tạo, cơ hội việc làm, học bổng, hay gần nhà)?',
    questionType: 'text',
    placeholder: 'Ví dụ: Cơ hội việc làm sau ra trường và uy tín thương hiệu của trường...',
    isRequired: 0,
    orderIndex: 4,
    isActive: 1,
  },
  {
    question: 'Bạn có mong muốn hay băn khoăn gì lớn nhất cần LearnPath và các chuyên gia tư vấn tuyển sinh hỗ trợ thêm không?',
    questionType: 'textarea',
    placeholder: 'Chia sẻ cụ thể những thắc mắc về phương thức xét tuyển, cách chọn ngành, tổ hợp môn...',
    isRequired: 0,
    orderIndex: 5,
    isActive: 1,
  },
];

async function seedSampleSurveyQuestions() {
  const now = Date.now();
  const created = [];

  await runAuthMutation(() => {
    const maxRow = queryOne('SELECT MAX(order_index) as max_order FROM survey_questions');
    let currentOrder = Number(maxRow?.max_order || 0);

    for (const q of SAMPLE_SURVEY_QUESTIONS) {
      currentOrder += 1;
      runSql(
        `INSERT INTO survey_questions (
           question, question_type, placeholder, is_required, order_index, is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [q.question, q.questionType, q.placeholder, q.isRequired, currentOrder, q.isActive, now, now]
      );
      created.push({
        id: lastInsertId(),
        question: q.question,
        questionType: q.questionType,
        placeholder: q.placeholder,
        isRequired: false,
        orderIndex: currentOrder,
        isActive: true,
      });
    }
  });

  return created;
}

module.exports = {
  SAMPLE_SURVEY_QUESTIONS,
  seedSampleSurveyQuestions,
  getActiveSurveyQuestions,
  getAllAdminSurveyQuestions,
  createAdminSurveyQuestion,
  updateAdminSurveyQuestion,
  deleteAdminSurveyQuestion,
  submitSurvey,
};
