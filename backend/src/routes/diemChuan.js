const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');

// GET /api/diem-chuan - Get benchmark scores with filters
router.get('/', async (req, res) => {
  try {
    await getDb();
    const {
      truong, nganh, phuong_thuc, khoi_thi, ma_truong,
      sort = 'diem_desc',
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
    if (ma_truong) {
      sql += ' AND ma_truong = ?';
      params.push(ma_truong);
    }

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

    let countSql = 'SELECT COUNT(*) as total FROM diem_chuan WHERE 1=1';
    const countParams = [];
    if (truong) { countSql += ' AND truong LIKE ?'; countParams.push(`%${truong}%`); }
    if (nganh) { countSql += ' AND nganh LIKE ?'; countParams.push(`%${nganh}%`); }
    if (phuong_thuc) { countSql += ' AND phuong_thuc = ?'; countParams.push(phuong_thuc); }
    if (khoi_thi) { countSql += ' AND to_hop_mon LIKE ?'; countParams.push(`%${khoi_thi}%`); }
    if (ma_truong) { countSql += ' AND ma_truong = ?'; countParams.push(ma_truong); }
    const totalRow = queryOne(countSql, countParams);

    res.json({ data: results, total: totalRow?.total || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/phuong-thuc
router.get('/phuong-thuc', async (req, res) => {
  try {
    await getDb();
    const results = queryAll('SELECT DISTINCT phuong_thuc FROM diem_chuan ORDER BY phuong_thuc');
    res.json({ data: results.map(r => r.phuong_thuc) });
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
      diemThapNhat: queryOne('SELECT MIN(diem_chuan) as val FROM diem_chuan WHERE diem_chuan > 0')?.val || 0,
      diemTrungBinh: queryOne('SELECT AVG(diem_chuan) as val FROM diem_chuan WHERE diem_chuan > 0')?.val || 0,
    };
    res.json({ data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/nhom-nganh - Major groups for filtering
router.get('/nhom-nganh', async (req, res) => {
  try {
    await getDb();
    const clusters = ['STEM', 'Xã hội', 'Ngôn ngữ', 'Nghệ thuật', 'Thể chất'];
    res.json({ data: clusters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-chuan/compare - Compare multiple majors
router.get('/compare', async (req, res) => {
  try {
    await getDb();
    const { ids } = req.query;
    if (!ids) return res.json({ data: [] });

    const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (idList.length === 0) return res.json({ data: [] });

    const results = queryAll(
      `SELECT * FROM diem_chuan WHERE id IN (${idList.map(() => '?').join(',')})`,
      idList
    );
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
