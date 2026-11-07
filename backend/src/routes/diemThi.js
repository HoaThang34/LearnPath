const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { getDb, queryAll, queryOne } = require('../database/db');
const { getHsaExams, fetchHsaRanking } = require('../hsa/hsaRanking');
const { getTsaExams, fetchTsaRanking } = require('../tsa/tsaRanking');

const ELECTIVE_KEYS = ['ly', 'hoa', 'sinh', 'su', 'dia', 'tin_hoc', 'ngoai_ngu'];
const SUBJECT_LABELS = {
  toan: 'Toán',
  van: 'Ngữ văn',
  ly: 'Vật lí',
  hoa: 'Hóa học',
  sinh: 'Sinh học',
  su: 'Lịch sử',
  dia: 'Địa lí',
  tin_hoc: 'Tin học',
  ngoai_ngu: 'Ngoại ngữ',
};

// Cached score distribution across 7 bins (scale 0-40)
let cachedDistribution = null;

function parseScore(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(num) ? num : NaN;
}

// GET /api/diem-thi/ranking
// Quy chế thi tốt nghiệp THPT (GDPT 2018): 4 môn thi gồm 2 môn bắt buộc (Toán, Văn) + 2 môn tự chọn
router.get('/ranking', async (req, res) => {
  try {
    await getDb();

    // 1. Kiểm tra môn bắt buộc: Toán
    const parsedToan = parseScore(req.query.toan);
    if (parsedToan === null) {
      return res.status(400).json({ error: 'Môn Toán là bắt buộc. Vui lòng nhập điểm môn Toán (từ 0 đến 10).' });
    }
    if (isNaN(parsedToan) || parsedToan < 0 || parsedToan > 10) {
      return res.status(400).json({ error: 'Điểm môn Toán không hợp lệ (phải là số từ 0 đến 10).' });
    }

    // 2. Kiểm tra môn bắt buộc: Ngữ văn
    const parsedVan = parseScore(req.query.van);
    if (parsedVan === null) {
      return res.status(400).json({ error: 'Môn Ngữ văn là bắt buộc. Vui lòng nhập điểm môn Ngữ văn (từ 0 đến 10).' });
    }
    if (isNaN(parsedVan) || parsedVan < 0 || parsedVan > 10) {
      return res.status(400).json({ error: 'Điểm môn Ngữ văn không hợp lệ (phải là số từ 0 đến 10).' });
    }

    // 3. Kiểm tra các môn tự chọn
    const chosenElectives = [];
    for (const key of ELECTIVE_KEYS) {
      const val = req.query[key];
      if (val !== undefined && val !== null && val !== '') {
        const num = parseScore(val);
        if (isNaN(num) || num < 0 || num > 10) {
          return res.status(400).json({
            error: `Điểm môn ${SUBJECT_LABELS[key] || key} không hợp lệ (phải là số từ 0 đến 10).`
          });
        }
        chosenElectives.push({ key, label: SUBJECT_LABELS[key], score: num });
      }
    }

    if (chosenElectives.length !== 2) {
      return res.status(400).json({
        error: `Quy chế thi THPT yêu cầu nhập đúng 2 môn tự chọn (hiện tại có ${chosenElectives.length} môn).`
      });
    }

    // Tổng điểm 4 môn (thang điểm 40)
    const totalScore = parseFloat((parsedToan + parsedVan + chosenElectives[0].score + chosenElectives[1].score).toFixed(2));

    // Tính thứ hạng so với toàn quốc
    const higherCount = queryOne(
      'SELECT COUNT(*) as higher FROM diem_thi_thptqg WHERE (COALESCE(toan,0)+COALESCE(van,0)+COALESCE(ly,0)+COALESCE(hoa,0)+COALESCE(sinh,0)+COALESCE(su,0)+COALESCE(dia,0)+COALESCE(tin_hoc,0)+COALESCE(ngoai_ngu,0)) > ?',
      [totalScore]
    )?.higher || 0;

    const ranking = higherCount + 1;
    const totalStudents = queryOne('SELECT COUNT(*) as count FROM diem_thi_thptqg')?.count || 1131975;

    // Phân bố điểm 7 khoảng từ 0 đến 40
    if (!cachedDistribution) {
      const allStudents = queryAll(
        'SELECT COALESCE(toan,0)+COALESCE(van,0)+COALESCE(ly,0)+COALESCE(hoa,0)+COALESCE(sinh,0)+COALESCE(su,0)+COALESCE(dia,0)+COALESCE(tin_hoc,0)+COALESCE(ngoai_ngu,0) as total FROM diem_thi_thptqg'
      );
      const ranges = ['35-40', '30-35', '25-30', '20-25', '15-20', '10-15', '0-10'];
      cachedDistribution = ranges.map(r => {
        const [min, max] = r.split('-').map(Number);
        const count = allStudents.filter(s => s.total >= min && (max === 40 ? s.total <= max : s.total < max)).length;
        return { khoang_diem: r, so_thi_sinh: count };
      });
    }

    const diemNhapObj = {
      toan: parsedToan,
      van: parsedVan,
      ly: null,
      hoa: null,
      sinh: null,
      su: null,
      dia: null,
      tin_hoc: null,
      ngoai_ngu: null,
    };
    for (const el of chosenElectives) {
      diemNhapObj[el.key] = el.score;
    }

    res.json({
      data: {
        diemNhap: diemNhapObj,
        tongDiem: totalScore,
        soMon: 4,
        monBatBuoc: ['toan', 'van'],
        monTuChon: chosenElectives.map(e => e.key),
        thuHang: ranking,
        tongThiSinh: totalStudents,
        tyLePhanTram: ((ranking / totalStudents) * 100).toFixed(2),
        phanBoDiem: cachedDistribution,
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
