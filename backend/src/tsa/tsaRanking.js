/**
 * TSA (Đánh giá tư duy - ĐH Bách khoa Hà Nội) Ranking Service
 * Nguồn API dữ liệu phổ điểm: https://diemthi.tuyensinh247.com/tra-cuu-xep-hang-diem-thi.html?phuongthuc=TSA
 */

const fs = require('fs');
const path = require('path');

const TSA_EXAMS = [
  {
    id: 24,
    name: 'Tổng 3 đợt thi TSA 2026',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/tsa-2026_1.png',
    localImage: '/images/tsa/tsa-24.png',
    proxyImage: '/api/diem-thi/tsa/image/24',
    isDefault: true,
  },
  {
    id: 23,
    name: 'TSA 2026 đợt 3',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/tsa-dot-3.jpg',
    localImage: '/images/tsa/tsa-23.jpg',
    proxyImage: '/api/diem-thi/tsa/image/23',
    isDefault: false,
  },
  {
    id: 20,
    name: 'TSA 2026 đợt 2',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-thi-tsa-2026-dot-2.png',
    localImage: '/images/tsa/tsa-20.png',
    proxyImage: '/api/diem-thi/tsa/image/20',
    isDefault: false,
  },
  {
    id: 19,
    name: 'TSA 2026 đợt 1',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-thi-tsa-2026-dot-1.png',
    localImage: '/images/tsa/tsa-19.png',
    proxyImage: '/api/diem-thi/tsa/image/19',
    isDefault: false,
  },
  {
    id: 10,
    name: 'Tổng 3 đợt thi TSA 2025',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-tsa-3-dot1.png',
    localImage: '/images/tsa/tsa-10.png',
    proxyImage: '/api/diem-thi/tsa/image/10',
    isDefault: false,
  },
  {
    id: 9,
    name: 'TSA 2025 đợt 3',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-tsa-dot-3.png',
    localImage: '/images/tsa/tsa-9.png',
    proxyImage: '/api/diem-thi/tsa/image/9',
    isDefault: false,
  },
  {
    id: 6,
    name: 'TSA 2025 đợt 2',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/2025/0318/pho-diem-tsa-dot-2.png',
    localImage: '/images/tsa/tsa-6.png',
    proxyImage: '/api/diem-thi/tsa/image/6',
    isDefault: false,
  },
  {
    id: 5,
    name: 'TSA 2025 đợt 1',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/2025/0124/pho-diem-tsa-dot-1.png',
    localImage: '/images/tsa/tsa-5.png',
    proxyImage: '/api/diem-thi/tsa/image/5',
    isDefault: false,
  },
  {
    id: 4,
    name: 'TSA 2024 đợt 2',
    year: 2024,
    image: 'https://images.tuyensinh247.com/picture/2025/0108/tsa-dot-2.jpg',
    localImage: '/images/tsa/tsa-4.jpg',
    proxyImage: '/api/diem-thi/tsa/image/4',
    isDefault: false,
  },
];

let cachedDistributions = null;
function getDistributions() {
  if (cachedDistributions) return cachedDistributions;
  try {
    const filePath = path.join(__dirname, '../data/tsa_distributions.json');
    if (fs.existsSync(filePath)) {
      cachedDistributions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      cachedDistributions = {};
    }
  } catch (err) {
    console.error('Không thể đọc tsa_distributions.json:', err.message);
    cachedDistributions = {};
  }
  return cachedDistributions;
}

function getTsaExams() {
  return TSA_EXAMS;
}

async function fetchTsaRanking(yourScore, examId, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    const err = new Error('Hệ thống chưa hỗ trợ fetch runtime.');
    err.statusCode = 500;
    throw err;
  }

  if (yourScore === undefined || yourScore === null || yourScore === '') {
    const err = new Error('Vui lòng nhập điểm thi TSA.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedScore = typeof yourScore === 'string' ? yourScore.replace(',', '.') : yourScore;
  const score = Number(normalizedScore);

  if (Number.isNaN(score) || score < 0 || score > 100) {
    const err = new Error('Điểm thi TSA không hợp lệ. Thang điểm thi ĐGTD ĐHBK Hà Nội là từ 0 đến 100.');
    err.statusCode = 400;
    throw err;
  }

  const examIdNum = Number(examId) || 24;
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
    console.error('[TSA Ranking API network error]', netErr.message);
    const err = new Error('Không thể kết nối đến máy chủ tra cứu điểm TSA (Tuyensinh247). Vui lòng thử lại sau.');
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
    console.error('[TSA Ranking API parse error]', parseErr.message);
    const err = new Error('Phản hồi từ máy chủ tra cứu điểm TSA không đúng định dạng JSON.');
    err.statusCode = 502;
    throw err;
  }

  if (!payload || !payload.success || !payload.data) {
    const err = new Error(payload?.msg || 'Không tìm thấy dữ liệu xếp hạng điểm TSA cho đợt thi đã chọn.');
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
  const examMeta = TSA_EXAMS.find(e => e.id === examIdNum) || null;

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
  TSA_EXAMS,
  getTsaExams,
  fetchTsaRanking,
};
