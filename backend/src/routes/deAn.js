const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');

// GET /api/de-an
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { search, limit = 100, offset = 0 } = req.query;

    let sql = 'SELECT id, ma_truong, ten_truong FROM de_an_tuyen_sinh WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (ma_truong LIKE ? OR ten_truong LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY ten_truong LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const results = queryAll(sql, params);
    res.json({ data: results, total: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/de-an/:maTruong
router.get('/:maTruong', async (req, res) => {
  try {
    await getDb();
    const result = queryOne(
      'SELECT * FROM de_an_tuyen_sinh WHERE ma_truong = ?',
      [req.params.maTruong]
    );

    if (!result) {
      return res.status(404).json({ error: 'Khong tim thay truong' });
    }

    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
