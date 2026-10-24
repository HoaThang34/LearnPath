const { queryOne, runSql, runAuthMutation } = require('./authDb');

function validateProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Dữ liệu hồ sơ cá nhân không hợp lệ.' };
  }

  const hoVaTen = typeof input.ho_va_ten === 'string' ? input.ho_va_ten.trim().slice(0, 255) : '';
  const lop = typeof input.lop === 'string' ? input.lop.trim().slice(0, 64) : '';
  const truong = typeof input.truong === 'string' ? input.truong.trim().slice(0, 255) : '';
  const truongMucTieu = typeof input.truong_muc_tieu === 'string' ? input.truong_muc_tieu.trim().slice(0, 255) : '';
  const nganhMucTieu = typeof input.nganh_muc_tieu === 'string' ? input.nganh_muc_tieu.trim().slice(0, 255) : '';
  const khac = typeof input.khac === 'string' ? input.khac.trim().slice(0, 5000) : '';

  // 1. Điểm các môn trên lớp
  const rawDiemLop = Array.isArray(input.diem_lop) ? input.diem_lop : [];
  const diemLop = [];
  for (const item of rawDiemLop.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const mon = typeof item.mon === 'string' ? item.mon.trim().slice(0, 100) : '';
    if (!mon) continue;

    const rawDiem = item.diem;
    if (rawDiem === '' || rawDiem === null || rawDiem === undefined) continue;

    const parsedDiem = Number(rawDiem);
    if (!Number.isFinite(parsedDiem) || parsedDiem < 0 || parsedDiem > 10) {
      return { ok: false, error: `Điểm môn "${mon}" phải là số hợp lệ từ 0 đến 10.` };
    }

    diemLop.push({
      mon,
      diem: Math.round(parsedDiem * 100) / 100,
    });
  }

  // 2. Chứng chỉ
  const rawChungChi = Array.isArray(input.chung_chi) ? input.chung_chi : [];
  const chungChi = [];
  for (const item of rawChungChi.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const loai = typeof item.loai === 'string' ? item.loai.trim().slice(0, 100) : '';
    const diem = typeof item.diem === 'string' || typeof item.diem === 'number' ? String(item.diem).trim().slice(0, 100) : '';
    if (!loai && !diem) continue;
    chungChi.push({ loai, diem });
  }

  // 3. Tổ hợp mong muốn (3 môn thi THPTQG)
  const rawToHop = Array.isArray(input.to_hop_mong_muon) ? input.to_hop_mong_muon : [];
  const toHopMongMuon = rawToHop
    .map((item) => (typeof item === 'string' ? item.trim().slice(0, 100) : ''))
    .filter(Boolean)
    .slice(0, 10);

  return {
    ok: true,
    values: {
      ho_va_ten: hoVaTen,
      lop,
      truong,
      diem_lop: diemLop,
      chung_chi: chungChi,
      truong_muc_tieu: truongMucTieu,
      nganh_muc_tieu: nganhMucTieu,
      to_hop_mong_muon: toHopMongMuon,
      khac,
    },
  };
}

function getUserProfile(userId) {
  const row = queryOne(
    `SELECT ho_va_ten, lop, truong, diem_lop, chung_chi,
            truong_muc_tieu, nganh_muc_tieu, to_hop_mong_muon, khac, updated_at
       FROM user_profiles
      WHERE user_id = ?`,
    [userId]
  );

  if (!row) {
    return {
      ho_va_ten: '',
      lop: '',
      truong: '',
      diem_lop: [],
      chung_chi: [],
      truong_muc_tieu: '',
      nganh_muc_tieu: '',
      to_hop_mong_muon: [],
      khac: '',
      updated_at: null,
    };
  }

  let diemLop = [];
  try {
    diemLop = row.diem_lop ? JSON.parse(row.diem_lop) : [];
  } catch (e) {
    diemLop = [];
  }

  let chungChi = [];
  try {
    chungChi = row.chung_chi ? JSON.parse(row.chung_chi) : [];
  } catch (e) {
    chungChi = [];
  }

  let toHop = [];
  try {
    toHop = row.to_hop_mong_muon ? JSON.parse(row.to_hop_mong_muon) : [];
  } catch (e) {
    toHop = [];
  }

  return {
    ho_va_ten: row.ho_va_ten || '',
    lop: row.lop || '',
    truong: row.truong || '',
    diem_lop: Array.isArray(diemLop) ? diemLop : [],
    chung_chi: Array.isArray(chungChi) ? chungChi : [],
    truong_muc_tieu: row.truong_muc_tieu || '',
    nganh_muc_tieu: row.nganh_muc_tieu || '',
    to_hop_mong_muon: Array.isArray(toHop) ? toHop : [],
    khac: row.khac || '',
    updated_at: row.updated_at ? Number(row.updated_at) : null,
  };
}

async function saveUserProfile(userId, input) {
  const validation = validateProfileInput(input);
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  const v = validation.values;
  const now = Date.now();

  await runAuthMutation(() => {
    runSql(
      `INSERT INTO user_profiles (
         user_id, ho_va_ten, lop, truong, diem_lop, chung_chi,
         truong_muc_tieu, nganh_muc_tieu, to_hop_mong_muon, khac, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         ho_va_ten = excluded.ho_va_ten,
         lop = excluded.lop,
         truong = excluded.truong,
         diem_lop = excluded.diem_lop,
         chung_chi = excluded.chung_chi,
         truong_muc_tieu = excluded.truong_muc_tieu,
         nganh_muc_tieu = excluded.nganh_muc_tieu,
         to_hop_mong_muon = excluded.to_hop_mong_muon,
         khac = excluded.khac,
         updated_at = excluded.updated_at`,
      [
        userId,
        v.ho_va_ten,
        v.lop,
        v.truong,
        JSON.stringify(v.diem_lop),
        JSON.stringify(v.chung_chi),
        v.truong_muc_tieu,
        v.nganh_muc_tieu,
        JSON.stringify(v.to_hop_mong_muon),
        v.khac,
        now,
      ]
    );
  });

  return getUserProfile(userId);
}

module.exports = {
  validateProfileInput,
  getUserProfile,
  saveUserProfile,
};
