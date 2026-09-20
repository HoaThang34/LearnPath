const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');

// GET /api/diem-thi/ranking
router.get('/ranking', async (req, res) => {
  try {
    await getDb();
    const { toan, van, ly, hoa, sinh, su, dia, tin_hoc, ngoai_ngu } = req.query;

    let totalScore = 0;
    let subjectCount = 0;

    if (toan) { totalScore += parseFloat(toan); subjectCount++; }
    if (van) { totalScore += parseFloat(van); subjectCount++; }
    if (ly) { totalScore += parseFloat(ly); subjectCount++; }
    if (hoa) { totalScore += parseFloat(hoa); subjectCount++; }
    if (sinh) { totalScore += parseFloat(sinh); subjectCount++; }
    if (su) { totalScore += parseFloat(su); subjectCount++; }
    if (dia) { totalScore += parseFloat(dia); subjectCount++; }
    if (tin_hoc) { totalScore += parseFloat(tin_hoc); subjectCount++; }
    if (ngoai_ngu) { totalScore += parseFloat(ngoai_ngu); subjectCount++; }

    if (subjectCount === 0) {
      return res.status(400).json({ error: 'Vui long nhap it nhat mot mon' });
    }

    // Get all students and count those with higher scores
    const allStudents = queryAll(
      'SELECT COALESCE(toan,0)+COALESCE(van,0)+COALESCE(ly,0)+COALESCE(hoa,0)+COALESCE(sinh,0)+COALESCE(su,0)+COALESCE(dia,0)+COALESCE(tin_hoc,0)+COALESCE(ngoai_ngu,0) as total FROM diem_thi_thptqg'
    );

    let ranking = 1;
    for (const student of allStudents) {
      if (student.total > totalScore) ranking++;
    }

    const totalStudents = allStudents.length;

    // Score distribution
    const ranges = ['27-30', '24-27', '21-24', '18-21', '15-18', '12-15', '0-12'];
    const distribution = ranges.map(r => {
      const [min, max] = r.split('-').map(Number);
      const count = allStudents.filter(s => s.total >= min && s.total < max).length;
      return { khoang_diem: r, so_thi_sinh: count };
    });

    res.json({
      data: {
        diemNhap: {
          toan: toan ? parseFloat(toan) : null,
          van: van ? parseFloat(van) : null,
          ly: ly ? parseFloat(ly) : null,
          hoa: hoa ? parseFloat(hoa) : null,
          sinh: sinh ? parseFloat(sinh) : null,
          su: su ? parseFloat(su) : null,
          dia: dia ? parseFloat(dia) : null,
          tin_hoc: tin_hoc ? parseFloat(tin_hoc) : null,
          ngoai_ngu: ngoai_ngu ? parseFloat(ngoai_ngu) : null,
        },
        tongDiem: totalScore,
        soMon: subjectCount,
        thuHang: ranking,
        tongThiSinh: totalStudents,
        tyLePhanTram: ((ranking / totalStudents) * 100).toFixed(2),
        phanBoDiem: distribution,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diem-thi/stats
router.get('/stats', async (req, res) => {
  try {
    await getDb();
    const stats = {
      tongThiSinh: queryOne('SELECT COUNT(*) as count FROM diem_thi_thptqg')?.count || 0,
      diemToanTB: queryOne('SELECT AVG(toan) as val FROM diem_thi_thptqg WHERE toan IS NOT NULL')?.val || 0,
      diemVanTB: queryOne('SELECT AVG(van) as val FROM diem_thi_thptqg WHERE van IS NOT NULL')?.val || 0,
      diemLyTB: queryOne('SELECT AVG(ly) as val FROM diem_thi_thptqg WHERE ly IS NOT NULL')?.val || 0,
      diemHoaTB: queryOne('SELECT AVG(hoa) as val FROM diem_thi_thptqg WHERE hoa IS NOT NULL')?.val || 0,
    };
    res.json({ data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
