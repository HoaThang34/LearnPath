const express = require('express');
const {
  listCurriculums,
  getCurriculumById,
  getCurriculumBySchoolAndMajor,
  listCurriculumSchools,
  listCurriculumMajors,
} = require('../curriculum/curriculumStore');

const router = express.Router();

// GET /api/chuong-trinh-hoc/schools
router.get('/schools', (req, res) => {
  try {
    const schools = listCurriculumSchools();
    return res.json({ data: schools });
  } catch (error) {
    console.error('[curriculum.schools] Error:', error.message);
    return res.status(500).json({ error: 'Không thể tải danh sách trường có chương trình học.' });
  }
});

// GET /api/chuong-trinh-hoc/majors?school=...
router.get('/majors', (req, res) => {
  try {
    const { school } = req.query;
    if (!school) {
      return res.status(400).json({ error: 'Tham số trường (school) là bắt buộc.' });
    }
    const majors = listCurriculumMajors(school);
    return res.json({ data: majors });
  } catch (error) {
    console.error('[curriculum.majors] Error:', error.message);
    return res.status(500).json({ error: 'Không thể tải danh sách ngành.' });
  }
});

// GET /api/chuong-trinh-hoc/detail?school=...&major=...
router.get('/detail', (req, res) => {
  try {
    const { school, major } = req.query;
    if (!school || !major) {
      return res.status(400).json({ error: 'Cần cung cấp cả tên trường (school) và tên ngành (major).' });
    }
    const curriculum = getCurriculumBySchoolAndMajor(school, major);
    if (!curriculum) {
      return res.status(404).json({ error: 'Chưa có chương trình học cho trường và ngành đã chọn.' });
    }
    return res.json({ data: curriculum });
  } catch (error) {
    console.error('[curriculum.detail] Error:', error.message);
    return res.status(500).json({ error: 'Không thể tải chi tiết chương trình học.' });
  }
});

// GET /api/chuong-trinh-hoc/:id
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Mã chương trình học không hợp lệ.' });
    }
    const curriculum = getCurriculumById(id);
    if (!curriculum) {
      return res.status(404).json({ error: 'Không tìm thấy chương trình học.' });
    }
    return res.json({ data: curriculum });
  } catch (error) {
    console.error('[curriculum.getById] Error:', error.message);
    return res.status(500).json({ error: 'Không thể tải chương trình học.' });
  }
});

// GET /api/chuong-trinh-hoc
router.get('/', (req, res) => {
  try {
    const { search, school, major, limit, offset } = req.query;
    const result = listCurriculums({ search, school, major, limit, offset });
    return res.json({ data: result.items, total: result.total, limit: result.limit, offset: result.offset });
  } catch (error) {
    console.error('[curriculum.list] Error:', error.message);
    return res.status(500).json({ error: 'Không thể tải danh sách chương trình học.' });
  }
});

module.exports = router;
