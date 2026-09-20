const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');

// GET /api/diem-chuan - Get benchmark scores with filters
router.get('/', async (req, res) => {
  try {
    await getDb();
    const {
      truong, nganh, phuong_thuc, khoi_thi, nhom_nganh,
      sort = 'diem_desc', // diem_asc, diem_desc, name_asc
      limit = 200, offset = 0
    } = req.query;

    let sql = 'SELECT * FROM diem_chuan WHERE 1=1';
    const params = [];

    if (truong) {
      sql += ' AND truong LIKE ?';
      params.push(`%${truong}%`);
    }
    if (nganh) {
      sql += ' AND nganh LIKE ?';
      params.push(`%${nganh}%`);
    }
    if (phuong_thuc) {
      sql += ' AND phuong_thuc = ?';
      params.push(phuong_thuc);
    }
    if (khoi_thi) {
      sql += ' AND to_hop_mon LIKE ?';
      params.push(`%${khoi_thi}%`);
    }
    if (nhom_nganh) {
      sql += ' AND nganh LIKE ?';
      params.push(`%${nhom_nganh}%`);
    }

    // Sort
    switch (sort) {
      case 'diem_asc': sql += ' ORDER BY diem_chuan ASC'; break;
      case 'diem_desc': sql += ' ORDER BY diem_chuan DESC'; break;
      case 'name_asc': sql += ' ORDER BY nganh ASC'; break;
      case 'name_desc': sql += ' ORDER BY nganh DESC'; break;
      default: sql += ' ORDER BY diem_chuan DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const results = queryAll(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM diem_chuan WHERE 1=1';
    const countParams = [];
    if (truong) { countSql += ' AND truong LIKE ?'; countParams.push(`%${truong}%`); }
    if (nganh) { countSql += ' AND nganh LIKE ?'; countParams.push(`%${nganh}%`); }
    if (phuong_thuc) { countSql += ' AND phuong_thuc = ?'; countParams.push(phuong_thuc); }
    if (khoi_thi) { countSql += ' AND to_hop_mon LIKE ?'; countParams.push(`%${khoi_thi}%`); }
    if (nhom_nganh) { countSql += ' AND nganh LIKE ?'; countParams.push(`%${nhom_nganh}%`); }
    const totalRow = queryOne(countSql, countParams);

    res.json({ data: results, total: totalRow?.total || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/truong/:truong
router.get('/truong/:truong', async (req, res) => {
  try {
    await getDb();
    const results = queryAll(
      'SELECT * FROM diem_chuan WHERE truong LIKE ? ORDER BY diem_chuan DESC',
      [`%${req.params.truong}%`]
    );
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/phuong-thuc - Get list of unique admission methods
router.get('/phuong-thuc', async (req, res) => {
  try {
    await getDb();
    const results = queryAll('SELECT DISTINCT phuong_thuc FROM diem_chuan ORDER BY phuong_thuc');
    res.json({ data: results.map(r => r.phuong_thuc) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/nhom-nganh - Get list of industry groups
router.get('/nhom-nganh', async (req, res) => {
  try {
    await getDb();
    // Extract unique first words of nganh as group names
    const results = queryAll(
      `SELECT DISTINCT
        CASE
          WHEN nganh LIKE '%Y%' OR nganh LIKE '%Dược%' OR nganh LIKE '%Sức khỏe%' THEN 'Y tế - Sức khỏe'
          WHEN nganh LIKE '%Kế toán%' OR nganh LIKE '%Tài chính%' OR nganh LIKE '%Ngân hàng%' OR nganh LIKE '%Kinh doanh%' OR nganh LIKE '%Thương mại%' OR nganh LIKE '%Quản trị%' THEN 'Kinh tế - Quản lý'
          WHEN nganh LIKE '%Kỹ thuật%' OR nganh LIKE '%Công nghệ%' OR nganh LIKE '%Khoa học%' OR nganh LIKE '%Viễn thông%' OR nganh LIKE '%Điện%' OR nganh LIKE '%Cơ khí%' THEN 'Kỹ thuật - Công nghệ'
          WHEN nganh LIKE '%Sư phạm%' OR nganh LIKE '%Giáo dục%' THEN 'Sư phạm - Giáo dục'
          WHEN nganh LIKE '%Luật%' OR nganh LIKE '%Pháp%' THEN 'Luật'
          WHEN nganh LIKE '%Ngoại ngữ%' OR nganh LIKE '%Tiếng%' OR nganh LIKE '%Anh%' OR nganh LIKE '%Trung%' OR nganh LIKE '%Nhật%' OR nganh LIKE '%Hàn%' OR nganh LIKE '%Pháp%' OR nganh LIKE '%Nga%' OR nganh LIKE '%Đức%' THEN 'Ngoại ngữ'
          WHEN nganh LIKE '%Mỹ thuật%' OR nganh LIKE '%Âm nhạc%' OR nganh LIKE '%Sân khấu%' OR nganh LIKE '%Điện ảnh%' OR nganh LIKE '%Thiết kế%' OR nganh LIKE '%Kiến trúc%' THEN 'Mỹ thuật - Nghệ thuật'
          WHEN nganh LIKE '%Du lịch%' OR nganh LIKE '%Khách sạn%' THEN 'Du lịch - Khách sạn'
          WHEN nganh LIKE '%Nông%' OR nganh LIKE '%Lâm%' OR nganh LIKE '%Thủy sản%' OR nganh LIKE '%Môi trường%' THEN 'Nông - Lâm - Thủy sản'
          WHEN nganh LIKE '%Tin học%' OR nganh LIKE '%Máy tính%' OR nganh LIKE '%Phần mềm%' OR nganh LIKE '%Trí tuệ nhân tạo%' THEN 'Công nghệ thông tin'
          ELSE 'Khác'
        END as nhom
      FROM diem_chuan
      WHERE nganh != ''
      ORDER BY nhom`
    );
    res.json({ data: [...new Set(results.map(r => r.nhom))] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/stats
router.get('/stats', async (req, res) => {
  try {
    await getDb();
    const stats = {
      tongTruong: queryOne('SELECT COUNT(DISTINCT truong) as count FROM diem_chuan')?.count || 0,
      tongNganh: queryOne('SELECT COUNT(DISTINCT nganh) as count FROM diem_chuan')?.count || 0,
      diemCaoNhat: queryOne('SELECT MAX(diem_chuan) as val FROM diem_chuan')?.val || 0,
      diemThapNhat: queryOne('SELECT MIN(diem_chuan) as val FROM diem_chuan')?.val || 0,
      diemTrungBinh: queryOne('SELECT AVG(diem_chuan) as val FROM diem_chuan')?.val || 0,
    };
    res.json({ data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
