/**
 * HSA (ĐGNL ĐHQGHN) Ranking Service
 * Nguồn API dữ liệu phổ điểm: https://diemthi.tuyensinh247.com/tra-cuu-xep-hang-diem-thi.html?phuongthuc=HSA
 */

const fs = require('fs');
const path = require('path');

const HSA_EXAMS = [
  {
    id: 25,
    name: 'HSA tất cả các đợt năm 2026',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/709883021-1695292892056849-1248372962989095024-n.jpg',
    localImage: '/images/hsa/hsa-25.jpg',
    proxyImage: '/api/diem-thi/hsa/image/25',
    isDefault: true,
  },
  {
    id: 21,
    name: 'HSA đợt 601 - 603 năm 2026',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-hsa-2026-dot-1-2-3.png',
    localImage: '/images/hsa/hsa-21.png',
    proxyImage: '/api/diem-thi/hsa/image/21',
    isDefault: false,
  },
  {
    id: 11,
    name: 'HSA tất cả các đợt năm 2025',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/hsa-2025.png',
    localImage: '/images/hsa/hsa-11.png',
    proxyImage: '/api/diem-thi/hsa/image/11',
    isDefault: false,
  },
  {
    id: 7,
    name: 'HSA đợt 501-502 năm 2025',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/2025/0402/pho-diem-hsa-dot-501-502.png',
    localImage: '/images/hsa/hsa-7.png',
    proxyImage: '/api/diem-thi/hsa/image/7',
    isDefault: false,
  },
  {
    id: 3,
    name: 'HSA đợt 401 - 406 năm 2024',
    year: 2024,
    image: 'https://images.tuyensinh247.com/picture/2025/0108/hsa-tat-ca-cac-dot.jpg',
    localImage: '/images/hsa/hsa-3.jpg',
    proxyImage: '/api/diem-thi/hsa/image/3',
    isDefault: false,
  },
];

let cachedDistributions = null;
function getDistributions() {
  if (cachedDistributions) return cachedDistributions;
  try {
    const filePath = path.join(__dirname, '../data/hsa_distributions.json');
    if (fs.existsSync(filePath)) {
      cachedDistributions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      cachedDistributions = {};
    }
  } catch (err) {
    console.error('Không thể đọc hsa_distributions.json:', err.message);
    cachedDistributions = {};
  }
  return cachedDistributions;
}

function getHsaExams() {
  return HSA_EXAMS;
}

async function fetchHsaRanking(yourScore, examId, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    const err = new Error('Hệ thống chưa hỗ trợ fetch runtime.');
    err.statusCode = 500;
    throw err;
  }

  if (yourScore === undefined || yourScore === null || yourScore === '') {
    const err = new Error('Vui lòng nhập điểm thi HSA.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedScore = typeof yourScore === 'string' ? yourScore.replace(',', '.') : yourScore;
  const score = Number(normalizedScore);

  if (Number.isNaN(score) || score < 0 || score > 150) {
    const err = new Error('Điểm thi HSA không hợp lệ. Thang điểm thi ĐGNL ĐHQGHN là từ 0 đến 150.');
    err.statusCode = 400;
    throw err;
  }

  const examIdNum = Number(examId) || 25;
  const targetUrl = `https://diemthi.tuyensinh247.com/api/exam/exam-rank?your_score=${encodeURIComponent(score)}&exam_id=${encodeURIComponent(examIdNum)}`;

  let res;
  try {
    res = await fetchImpl(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(options.timeoutMs || 8000),
    });
  } catch (netErr) {
    console.error('[HSA Ranking API network error]', netErr.message);
    const err = new Error('Không thể kết nối đến máy chủ tra cứu điểm HSA (Tuyensinh247). Vui lòng thử lại sau.');
    err.statusCode = 502;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Máy chủ tra cứu trả về lỗi HTTP ${res.status}.`);
    err.statusCode = 502;
    throw err;
  }

  let payload;
  try {
    payload = await res.json();
  } catch (parseErr) {
    console.error('[HSA Ranking API parse error]', parseErr.message);
    const err = new Error('Phản hồi từ máy chủ tra cứu điểm HSA không đúng định dạng JSON.');
    err.statusCode = 502;
    throw err;
  }

  if (!payload || !payload.success || !payload.data) {
    const err = new Error(payload?.msg || 'Không tìm thấy dữ liệu xếp hạng điểm HSA cho đợt thi đã chọn.');
    err.statusCode = 502;
    throw err;
  }

  const raw = payload.data;
  const same = Number(raw.same) || 0;
  const larger = Number(raw.larger) || 0;
  const smaller = Number(raw.smaller) || 0;
  const from = Number(raw.from) || 0;
  const to = Number(raw.to) || 0;
  const tongThiSinh = (same > 0) ? (larger + same + smaller) : (larger + smaller);

  const thuHangTu = larger + 1;
  const thuHangDen = larger + Math.max(1, same);
  const tyLePhanTram = tongThiSinh > 0 ? Number(((thuHangTu / tongThiSinh) * 100).toFixed(2)) : 0;
  const examMeta = HSA_EXAMS.find(e => e.id === examIdNum) || null;

  // Lấy dữ liệu phổ điểm đầy đủ cho biểu đồ
  const allDistributions = getDistributions();
  const phanBoDiem = allDistributions[examIdNum] || [];

  return {
    diem: score,
    examId: examIdNum,
    examName: examMeta ? examMeta.name : `Đợt thi #${examIdNum}`,
    from,
    to,
    same,
    larger,
    smaller,
    tongThiSinh,
    thuHangTu,
    thuHangDen,
    tyLePhanTram,
    image: raw.image || examMeta?.image || null,
    localImage: examMeta?.localImage || null,
    proxyImage: examMeta?.proxyImage || null,
    phanBoDiem,
    nguon: 'diemthi.tuyensinh247.com',
  };
}

module.exports = {
  HSA_EXAMS,
  getHsaExams,
  fetchHsaRanking,
};
