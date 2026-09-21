const express = require('express');
const router = express.Router();
const { getDb, queryAll } = require('../database/db');

// GET /api/khoi-thi - Get all blocks with subjects
router.get('/', async (req, res) => {
  try {
    await getDb();
    const results = queryAll('SELECT * FROM khoi_thi ORDER BY ma_khoi');
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khoi-thi/:maKhoi - Get schools for a specific block
router.get('/:maKhoi', async (req, res) => {
  try {
    await getDb();
    const maKhoi = req.params.maKhoi;

    // Get schools that have this block in diem_chuan
    const results = queryAll(
      `SELECT DISTINCT t.ma_truong, t.ten_truong, COUNT(d.id) as so_nganh
       FROM truong t
       INNER JOIN diem_chuan d ON t.ma_truong = d.ma_truong
       WHERE d.to_hop_mon LIKE ?
       GROUP BY t.ma_truong, t.ten_truong
       ORDER BY t.ten_truong`,
      [`%${maKhoi}%`]
    );

    // Get block info
    const blockInfo = queryAll(
      'SELECT * FROM khoi_thi WHERE ma_khoi = ?',
      [maKhoi]
    );

    res.json({
      data: {
        khoi_thi: blockInfo[0] || null,
        truong: results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khoi-thi/:maKhoi/truong/:maTruong - Get majors for a school in a block
router.get('/:maKhoi/truong/:maTruong', async (req, res) => {
  try {
    await getDb();
    const { maKhoi, maTruong } = req.params;

    const results = queryAll(
      `SELECT d.*, t.ten_truong
       FROM diem_chuan d
       LEFT JOIN truong t ON d.ma_truong = t.ma_truong
       WHERE d.ma_truong = ? AND d.to_hop_mon LIKE ?
       ORDER BY d.diem_chuan DESC`,
      [maTruong, `%${maKhoi}%`]
    );

    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
