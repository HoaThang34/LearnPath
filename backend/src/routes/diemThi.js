const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');
const { getHsaExams, fetchHsaRanking } = require('../hsa/hsaRanking');
const { getTsaExams, fetchTsaRanking } = require('../tsa/tsaRanking');

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

// GET /api/diem-thi/hsa/exams
router.get('/hsa/exams', (req, res) => {
  res.json({ data: getHsaExams() });
});

// GET /api/diem-thi/hsa/ranking
router.get('/hsa/ranking', async (req, res) => {
  try {
    const { your_score, exam_id } = req.query;
    const data = await fetchHsaRanking(your_score, exam_id);
    res.json({ data });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Lỗi khi tra cứu thứ hạng HSA.' });
  }
});

// GET /api/diem-thi/hsa/image/:examId
router.get('/hsa/image/:examId', async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const exam = getHsaExams().find(e => e.id === examId);
    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin đợt thi.' });
    }

    const ext = exam.localImage && exam.localImage.endsWith('.png') ? 'png' : 'jpg';
    const localFile = path.join(__dirname, '../data/hsa_images', `hsa-${examId}.${ext}`);

    if (fs.existsSync(localFile)) {
      res.setHeader('Content-Type', ext === 'png' ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(localFile).pipe(res);
    }

    // Upstream fallback
    const upstreamRes = await fetch(exam.image, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstreamRes.ok) {
      return res.status(502).json({ error: 'Không thể tải ảnh phổ điểm từ máy chủ Tuyensinh247.' });
    }

    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || (ext === 'png' ? 'image/png' : 'image/jpeg'));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error('[HSA Image Proxy error]', err.message);
    res.status(502).json({ error: 'Lỗi khi tải ảnh phổ điểm.' });
  }
});

// GET /api/diem-thi/tsa/exams
router.get('/tsa/exams', (req, res) => {
  res.json({ data: getTsaExams() });
});

// GET /api/diem-thi/tsa/ranking
router.get('/tsa/ranking', async (req, res) => {
  try {
    const { your_score, exam_id } = req.query;
    const data = await fetchTsaRanking(your_score, exam_id);
    res.json({ data });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Lỗi khi tra cứu thứ hạng TSA.' });
  }
});

// GET /api/diem-thi/tsa/image/:examId
router.get('/tsa/image/:examId', async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const exam = getTsaExams().find(e => e.id === examId);
    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin đợt thi.' });
    }

    const ext = exam.localImage && exam.localImage.endsWith('.png') ? 'png' : 'jpg';
    const localFile = path.join(__dirname, '../data/tsa_images', `tsa-${examId}.${ext}`);

    if (fs.existsSync(localFile)) {
      res.setHeader('Content-Type', ext === 'png' ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(localFile).pipe(res);
    }

    // Upstream fallback
    const upstreamRes = await fetch(exam.image, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstreamRes.ok) {
      return res.status(502).json({ error: 'Không thể tải ảnh phổ điểm TSA từ máy chủ Tuyensinh247.' });
    }

    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || (ext === 'png' ? 'image/png' : 'image/jpeg'));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error('[TSA Image Proxy error]', err.message);
    res.status(502).json({ error: 'Lỗi khi tải ảnh phổ điểm TSA.' });
  }
});

module.exports = router;
