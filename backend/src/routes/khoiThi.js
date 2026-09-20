const express = require('express');
const router = express.Router();
const { getDb, queryAll } = require('../database/db');

// GET /api/khoi-thi
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { maKhoi, maTruong, limit = 100, offset = 0 } = req.query;

    let sql = 'SELECT * FROM khoi_thi WHERE 1=1';
    const params = [];

    if (maKhoi) {
      sql += ' AND ma_khoi = ?';
      params.push(maKhoi);
    }
    if (maTruong) {
      sql += ' AND ma_truong LIKE ?';
      params.push(`%${maTruong}%`);
    }

    sql += ' ORDER BY ma_khoi, ten_truong LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const results = queryAll(sql, params);
    res.json({ data: results, total: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khoi-thi/ma-khoi/:maKhoi
router.get('/ma-khoi/:maKhoi', async (req, res) => {
  try {
    await getDb();
    const results = queryAll(
      'SELECT * FROM khoi_thi WHERE ma_khoi = ? ORDER BY ten_truong',
      [req.params.maKhoi]
    );
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khoi-thi/truong/:maTruong
router.get('/truong/:maTruong', async (req, res) => {
  try {
    await getDb();
    const results = queryAll(
      'SELECT DISTINCT ma_khoi, mon_xet_tuyen FROM khoi_thi WHERE ma_truong = ?',
      [req.params.maTruong]
    );
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khoi-thi/danh-sach
router.get('/danh-sach', async (req, res) => {
  try {
    await getDb();
    const results = queryAll(
      'SELECT DISTINCT ma_khoi, mon_xet_tuyen FROM khoi_thi ORDER BY ma_khoi'
    );
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
