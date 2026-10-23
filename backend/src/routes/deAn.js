const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');
const { parsePagination } = require('./queryParams');

// GET /api/de-an
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { search } = req.query;
    const pagination = parsePagination(req.query, { defaultLimit: 100 });
    if (pagination.error) {
      return res.status(400).json({ error: pagination.error });
    }

    let sql = 'SELECT id, ma_truong, ten_truong FROM de_an_tuyen_sinh WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (ma_truong LIKE ? OR ten_truong LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY ten_truong LIMIT ? OFFSET ?';
    params.push(pagination.limit, pagination.offset);

    let countSql = 'SELECT COUNT(*) as total FROM de_an_tuyen_sinh WHERE 1=1';
    const countParams = [];
    if (search) {
      countSql += ' AND (ma_truong LIKE ? OR ten_truong LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const results = queryAll(sql, params);
    const totalRow = queryOne(countSql, countParams);
    res.json({ data: results, total: totalRow?.total || 0 });
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
