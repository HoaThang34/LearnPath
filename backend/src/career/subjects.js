'use strict';

// Canonical subject sets for the admission blocks used by LearnPath.
// The rare blocks (H00, M00, M10, N00, V00, B03) are defined from the subject
// sets declared in backend/src/data/edumind_rubrics.json; see RUBRIC_CHANGELOG.md.
const ADMISSION_SUBJECTS = {
  A00: ['Toán', 'Vật lý', 'Hóa học'],
  A01: ['Toán', 'Vật lý', 'Tiếng Anh'],
  A02: ['Toán', 'Vật lý', 'Sinh học'],
  A03: ['Toán', 'Vật lý', 'Lịch sử'],
  A04: ['Toán', 'Vật lý', 'Địa lý'],
  B00: ['Toán', 'Hóa học', 'Sinh học'],
  B03: ['Toán', 'Vật lý', 'Hóa học'],
  B08: ['Toán', 'Sinh học', 'Tiếng Anh'],
  C00: ['Ngữ văn', 'Lịch sử', 'Địa lý'],
  C03: ['Ngữ văn', 'Toán', 'Lịch sử'],
  C04: ['Ngữ văn', 'Toán', 'Địa lý'],
  D01: ['Toán', 'Ngữ văn', 'Tiếng Anh'],
  D07: ['Toán', 'Hóa học', 'Tiếng Anh'],
  D14: ['Ngữ văn', 'Lịch sử', 'Tiếng Anh'],
  H00: ['Toán', 'Ngữ văn', 'Tiếng Anh'],
  M00: ['Toán', 'Ngữ văn', 'Sinh học'],
  M10: ['Toán', 'Ngữ văn', 'Tiếng Anh'],
  N00: ['Toán', 'Ngữ văn', 'Lịch sử'],
  V00: ['Toán', 'Ngữ văn', 'Vật lý'],
};

const SUBJECT_COLUMNS = {
  'Toán': 'toan',
  'Ngữ văn': 'van',
  'Vật lý': 'ly',
  'Hóa học': 'hoa',
  'Sinh học': 'sinh',
  'Lịch sử': 'su',
  'Địa lý': 'dia',
  'Tiếng Anh': 'ngoai_ngu',
  'Tin học': 'tin_hoc',
  'Công nghệ': 'cong_nghe',
};

const BLOCK_CODES = Object.keys(ADMISSION_SUBJECTS);

function getBlockSubjects(block) {
  const code = String(block || '').trim().toUpperCase();
  return ADMISSION_SUBJECTS[code] || null;
}

function isValidBlock(block) {
  return Boolean(getBlockSubjects(block));
}

module.exports = {
  ADMISSION_SUBJECTS,
  SUBJECT_COLUMNS,
  BLOCK_CODES,
  getBlockSubjects,
  isValidBlock,
};
