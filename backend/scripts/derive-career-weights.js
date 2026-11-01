'use strict';

/**
 * Derive the career-weight configuration files from `edumind_rubrics.json`.
 *
 * Outputs (only with --write):
 *   backend/src/data/career_group_weights.json
 *   backend/src/data/career_major_groups.json
 *   backend/src/data/career_subject_priorities.json
 *
 * The script is deterministic and read-only by default. It never touches a DB.
 *
 *   node backend/scripts/derive-career-weights.js
 *   node backend/scripts/derive-career-weights.js --write
 *   node backend/scripts/derive-career-weights.js --write --force
 *
 * If an admin has edited the group weights or subject priorities through the
 * admin UI/API, the file carries an `updatedAt` field and --write refuses to
 * overwrite it unless --force is passed.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const RUBRIC_FILE = path.join(DATA_DIR, 'edumind_rubrics.json');

const WRITE = process.argv.includes('--write');
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// 1. Pairwise matrices for the 12 major groups (Saaty scale + half steps).
//    a12 = L/H, a13 = L/M, a23 = H/M. Weights = normalised geometric mean.
// ---------------------------------------------------------------------------
const GROUPS = [
  {
    code: 'cntt',
    label: 'CNTT – dữ liệu – AI',
    riasecGroup: 'Kỹ thuật - Công nghệ',
    judgments: [2, 3, 1],
    note:
      'Học lực so với Holland 2:1; học lực so với MBTI 3:1; Holland so với MBTI 1:1. ' +
      'Ví dụ của nhóm, chưa kiểm định.',
  },
  {
    code: 'ky_thuat',
    label: 'Kỹ thuật – công nghiệp',
    riasecGroup: 'Kỹ thuật - Công nghệ',
    judgments: [3, 5, 2],
    note: 'Học lực 3:1 Holland, 5:1 MBTI, Holland 2:1 MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'toan_khoa_hoc',
    label: 'Toán – thống kê – khoa học cơ bản/sự sống',
    riasecGroup: 'Kỹ thuật - Công nghệ',
    judgments: [1, 8, 1],
    note: 'Học lực ngang Holland, gấp 8 lần MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'y_duoc',
    label: 'Y – dược – sức khỏe',
    riasecGroup: 'Y Dược',
    judgments: [3, 4, 1],
    note: 'Học lực 3:1 Holland, 4:1 MBTI, Holland ngang MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'kinh_te',
    label: 'Kinh tế – tài chính – kế toán',
    riasecGroup: 'Kinh tế - Quản trị',
    judgments: [3, 3, 1],
    note: 'Học lực gấp 3 lần cả Holland và MBTI; Holland ngang MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'kinh_doanh',
    label: 'Kinh doanh – quản trị – dịch vụ',
    riasecGroup: 'Kinh tế - Quản trị',
    judgments: [1, 2, 2],
    note: 'Học lực ngang Holland, gấp 2 lần MBTI; Holland gấp 2 lần MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'luat',
    label: 'Luật – hành chính – chính sách công',
    riasecGroup: 'Luật - Hành chính',
    judgments: [2, 2, 1],
    note: 'Học lực gấp 2 lần Holland và MBTI; Holland ngang MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'ngon_ngu',
    label: 'Ngôn ngữ – biên phiên dịch',
    riasecGroup: 'Xã hội - Nhân văn',
    judgments: [1, 6, 1],
    note: 'Học lực ngang Holland, gấp 6 lần MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'xa_hoi',
    label: 'Xã hội – nhân văn – tâm lý – truyền thông',
    riasecGroup: 'Xã hội - Nhân văn',
    judgments: [1, 1.5, 1.5],
    note: 'Ba thành phần gần nhau: học lực = Holland > MBTI (1,5:1). Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'su_pham',
    label: 'Sư phạm – giáo dục',
    riasecGroup: 'Sư phạm',
    judgments: [1, 3, 1],
    note: 'Học lực ngang Holland, gấp 3 lần MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'nghe_thuat',
    label: 'Nghệ thuật – thiết kế – kiến trúc',
    riasecGroup: 'Nghệ thuật',
    judgments: [0.5, 1.5, 3],
    note:
      'Holland dẫn đầu (gấp 2 học lực, gấp 3 MBTI); học lực gấp 1,5 MBTI. ' +
      'Nhóm đề xuất, chưa kiểm định.',
  },
  {
    code: 'nong_lam',
    label: 'Nông – lâm – thủy sản – môi trường',
    riasecGroup: 'Nông Lâm',
    judgments: [2, 3, 1.5],
    note: 'Học lực 2:1 Holland, 3:1 MBTI; Holland 1,5:1 MBTI. Nhóm đề xuất, chưa kiểm định.',
  },
];

function geometricWeights(judgments) {
  const [a12, a13, a23] = judgments;
  const rows = [
    [1, a12, a13],
    [1 / a12, 1, a23],
    [1 / a13, 1 / a23, 1],
  ];
  const vectors = rows.map((row) => Math.cbrt(row[0] * row[1] * row[2]));
  const total = vectors.reduce((sum, value) => sum + value, 0);
  return vectors.map((value) => value / total);
}

// ---------------------------------------------------------------------------
// 2. Major name -> 12-group mapping. Explicit, keyword-driven, and reviewed.
// ---------------------------------------------------------------------------
const RULES = [
  ['nghe_thuat', [
    'Thiết kế Đồ họa', 'Thiết kế Nội thất', 'Hội họa', 'Âm nhạc học', 'Điện ảnh',
    'Game Design', 'Kiến trúc', 'Kiến trúc Cảnh quan', 'Quy hoạch Vùng và Đô thị',
    'Công nghệ May và Thời trang',
  ]],
  ['su_pham', [
    'Sư phạm', 'Giáo dục Mầm non', 'Giáo dục Tiểu học', 'Quản lý Giáo dục',
  ]],
  ['y_duoc', [
    'Y khoa', 'Răng Hàm Mặt', 'Dược học', 'Y tế Công cộng', 'Điều dưỡng',
    'Kỹ thuật Y sinh', 'Y học Cổ truyền', 'Phục hồi Chức năng', 'Quản lý Bệnh viện',
  ]],
  ['luat', [
    'Luật', 'Hành chính học', 'Quản trị Nhà nước và Chính sách', 'Quản lý Nhà nước',
    'Quan hệ Lao động',
  ]],
  ['ngon_ngu', [
    'Ngôn ngữ Anh', 'Ngôn ngữ Nhật', 'Ngôn ngữ Hàn Quốc', 'Ngôn ngữ Nga',
    'Ngôn ngữ Pháp', 'Dịch thuật',
  ]],
  ['nong_lam', [
    'Nông học', 'Chăn nuôi', 'Thú y', 'Lâm học', 'Nuôi trồng Thủy sản',
    'Khoa học Môi trường', 'Kỹ thuật Môi trường', 'Kỹ thuật Tài nguyên nước',
    'Quản lý Đất đai', 'Kinh tế Nông nghiệp',
  ]],
  ['cntt', [
    'Công nghệ Thông tin', 'Khoa học Máy tính', 'Kỹ thuật Phần mềm', 'Trí tuệ Nhân tạo',
    'Khoa học Dữ liệu', 'An toàn Thông tin', 'Hệ thống Thông tin', 'Mạng Máy tính và Truyền thông Dữ liệu',
    'Tin học Ứng dụng', 'Thiết kế Vi mạch',
  ]],
  ['toan_khoa_hoc', [
    'Toán học', 'Thống kê', 'Vật lý', 'Hóa học', 'Sinh học', 'Địa chất học',
    'Khoa học Vũ trụ và Viễn thám', 'Công nghệ Sinh học',
  ]],
  ['kinh_te', [
    'Kinh tế quốc tế', 'Kinh tế Quốc tế', 'Kinh tế', 'Tài chính - Ngân hàng', 'Kế toán',
    'Tài chính', 'Kế toán - Kiểm toán', 'Kinh tế Đầu tư', 'Bảo hiểm', 'Kinh tế Chính trị',
    'Tài chính Doanh nghiệp',
  ]],
  ['kinh_doanh', [
    'Quản trị kinh doanh', 'Quản trị Kinh doanh', 'Marketing', 'Thương mại Quốc tế',
    'Kinh doanh Quốc tế', 'Logistic và Quản lý Chuỗi cung ứng', 'Logistics và Quản lý Chuỗi cung ứng',
    'Quản trị Khách sạn', 'Quản trị Du lịch và Lữ hành', 'Khởi nghiệp và Đổi mới Sáng tạo',
    'Quản lý Nguồn nhân lực', 'Bất động sản', 'Nghiên cứu Phát triển', 'Kinh doanh Thương mại',
    'Khởi nghiệp Xã hội', 'CT TT Kinh tế đối ngoại', 'Du lịch', 'Quản lý Thể thao',
  ]],
  ['xa_hoi', [
    'Báo chí', 'Quan hệ Quốc tế', 'Tâm lý học', 'Xã hội học', 'Triết học', 'Lịch sử',
    'Địa lý', 'Truyền thông Đa phương tiện', 'Công tác Xã hội', 'Văn học',
  ]],
  ['ky_thuat', [
    'Kỹ thuật Điều khiển - Tự động hoá (CT tiên tiến)',
    'Khoa học Dữ liệu và Trí tuệ nhân tạo (CT tiên tiến)',
    'Kỹ thuật Điện tử - Viễn thông', 'Kỹ thuật Cơ điện tử', 'Kỹ thuật Hóa học',
    'Kỹ thuật Xây dựng', 'Kỹ thuật Điện', 'Vật lý Kỹ thuật', 'Kỹ thuật Hàng không',
    'Kỹ thuật Sinh học', 'Kỹ thuật Dầu khí', 'Công nghệ Thực phẩm', 'Kỹ thuật Giao thông',
    'Kỹ thuật Hàng hải', 'Điều khiển học', 'Kỹ thuật Ô tô', 'Công nghệ Ô tô',
    'Năng lượng Tái tạo', 'Kỹ thuật Vật liệu', 'Công nghệ Nano', 'Kỹ thuật Hạt nhân',
    'Điện tử Viễn thông', 'Kiểm soát Không lưu',
  ]],
];

// Prefix rules are evaluated only when no exact match exists, in this order.
const PREFIX_RULES = [
  ['su_pham', ['Sư phạm ']],
  ['luat', ['Luật ']],
  ['ngon_ngu', ['Ngôn ngữ ']],
  ['kinh_te', ['Kinh tế ']],
  ['ky_thuat', ['Kỹ thuật ']],
];

function assignGroup(majorName) {
  const exact = [];
  for (const [code, names] of RULES) {
    if (names.includes(majorName)) exact.push(code);
  }
  if (exact.length === 1) return { code: exact[0], how: 'exact' };
  if (exact.length > 1) return { code: exact[0], how: `ambiguous:${exact.join(',')}` };
  const prefixed = [];
  for (const [code, prefixes] of PREFIX_RULES) {
    if (prefixes.some((prefix) => majorName.startsWith(prefix))) prefixed.push(code);
  }
  if (prefixed.length === 1) return { code: prefixed[0], how: 'prefix' };
  if (prefixed.length > 1) return { code: prefixed[0], how: `ambiguous:${prefixed.join(',')}` };
  return { code: null, how: 'unmapped' };
}

// ---------------------------------------------------------------------------
// 3. Subject priority r ∈ {1,2,3,4} per rubric row, from the existing
//    normalised subject weights (4 = cốt lõi, 3 = quan trọng, 2 = liên quan,
//    1 = hỗ trợ).
// ---------------------------------------------------------------------------
function priorityFor(weight) {
  if (weight >= 0.4) return 4;
  if (weight >= 0.3) return 3;
  if (weight >= 0.2) return 2;
  return 1;
}

function main() {
  const all = JSON.parse(fs.readFileSync(RUBRIC_FILE, 'utf8'));
  const valid = all.filter((row) => row.isValid !== false);
  const excluded = all.length - valid.length;

  const weights = GROUPS.map((group) => {
    const [hocLuc, holland, mbti] = geometricWeights(group.judgments);
    return { ...group, hocLuc, holland, mbti };
  });

  const majors = new Map();
  for (const row of valid) {
    if (!majors.has(row.majorName)) majors.set(row.majorName, { row, count: 0, groups: new Set() });
    const entry = majors.get(row.majorName);
    entry.count += 1;
    entry.groups.add(row.majorGroup);
  }

  const mapping = [];
  const unmapped = [];
  for (const [majorName, entry] of [...majors.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'))) {
    const assigned = assignGroup(majorName);
    if (!assigned.code) unmapped.push(majorName);
    mapping.push({
      majorName,
      majorGroup: [...entry.groups].join(' / '),
      groupCode: assigned.code,
      match: assigned.how,
    });
  }

  const priorities = valid
    .map((row) => ({
      schoolCode: row.schoolCode,
      schoolName: row.schoolName,
      majorName: row.majorName,
      admissionBlock: row.admissionBlock,
      method: row.method,
      year: row.year,
      entryScore: Number(row.entryScore),
      subjects: row.subjects.map((subject) => ({
        subject: subject.subject,
        weight: Number(subject.weight),
        r: priorityFor(Number(subject.weight)),
      })),
    }))
    .sort(
      (a, b) =>
        a.majorName.localeCompare(b.majorName, 'vi') ||
        String(a.schoolCode).localeCompare(String(b.schoolCode))
    );

  // Report
  console.log('Groups (L / H / M %):');
  for (const row of weights) {
    console.log(
      `  ${row.code.padEnd(14)} ${(row.hocLuc * 100).toFixed(2).padStart(6)} ` +
        `${(row.holland * 100).toFixed(2).padStart(6)} ${(row.mbti * 100).toFixed(2).padStart(6)}  ${row.label}`
    );
  }
  const cntt = weights.find((row) => row.code === 'cntt');
  console.log(
    `CNTT exact: ${cntt.hocLuc.toFixed(8)} / ${cntt.holland.toFixed(8)} / ${cntt.mbti.toFixed(8)}`
  );
  console.log(`MBTI 20-point effect for CNTT: ${(20 * cntt.mbti).toFixed(4)}`);
  console.log(
    `\nRubric rows: ${all.length} total, ${valid.length} valid, ${excluded} excluded`
  );
  console.log(`Distinct major names: ${majors.size}`);
  console.log(
    `Distinct normalised subject-weight sets: ${new Set(valid.map((row) => row.subjects.map((subject) => Number(subject.weight).toFixed(4)).sort().join('|'))).size}`
  );
  console.log(
    `Distinct (subject, r) sets: ${new Set(priorities.map((row) => row.subjects.map((subject) => `${subject.subject}:${subject.r}`).sort().join('|'))).size}`
  );
  const byGroup = {};
  for (const row of mapping) byGroup[row.groupCode] = (byGroup[row.groupCode] || 0) + 1;
  console.log('Majors per group:', JSON.stringify(byGroup));
  if (unmapped.length) console.log('UNMAPPED:', unmapped.join(' | '));
  const ambiguous = mapping.filter((row) => String(row.match).startsWith('ambiguous'));
  if (ambiguous.length) {
    console.log('AMBIGUOUS:', ambiguous.map((row) => `${row.majorName} -> ${row.groupCode}`).join(' | '));
  }
  const priorityCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const row of priorities) for (const subject of row.subjects) priorityCounts[subject.r] += 1;
  console.log('Priority distribution:', JSON.stringify(priorityCounts));

  if (!WRITE) {
    console.log('\nDry run. Re-run with --write to update the data files.');
    return;
  }
  if (unmapped.length) {
    throw new Error(`Refusing to write while ${unmapped.length} major(s) are unmapped.`);
  }

  const groupFile = {
    version: 1,
    method:
      'So sánh cặp giữa ba thành phần (học lực L, Holland H, MBTI M) theo thang Saaty 1–9 ' +
      'và nửa bước 1,5; trọng số là trung bình nhân từng hàng sau chuẩn hoá. ' +
      'Nguồn phương pháp: Crawford–Williams, RAND. Các mức ưu tiên là giả định của nhóm, ' +
      'phương pháp không tự chứng minh chúng đúng.',
    note:
      'Cả ba thành phần dùng thang 0–100. Trọng số dương ở mọi khối; MBTI có tác động thực ' +
      'nhưng chưa tính được điểm M khi thiếu hồ sơ đối chiếu c/t theo ngành.',
    groups: weights.map((row) => ({
      code: row.code,
      label: row.label,
      riasecGroup: row.riasecGroup,
      judgments: { hocLucVsHolland: row.judgments[0], hocLucVsMbti: row.judgments[1], hollandVsMbti: row.judgments[2] },
      wHocLuc: Number(row.hocLuc.toFixed(8)),
      wHolland: Number(row.holland.toFixed(8)),
      wMbti: Number(row.mbti.toFixed(8)),
      note: row.note,
    })),
  };

  // MBTI comparison profile: the c/t table is deliberately NOT invented.
  // Each axis is listed with c = null, t = null and status "chua_xac_dinh" so
  // the runtime returns M = null with an explicit reason instead of a guess.
  const mbtiProfileFile = {
    version: 1,
    status: 'chua_xac_dinh',
    note:
      'Hồ sơ đối chiếu bốn trục MBTI theo ngành CHƯA được xác định. Không tự gán ' +
      '"CNTT phải hướng nội" hay "ngôn ngữ phải hướng ngoại". Khi các giá trị c (mức liên quan) ' +
      'và t (+1/−1, hướng đối chiếu) được thẩm định, điền vào đây; module career/mbti.js sẽ ' +
      'tự động tính M_m và đưa vào công thức F_m. Cho tới lúc đó M_m = null (lý do ' +
      'thieu_ho_so_mbti) và F_m = null khi cần M.',
    formula:
      'x_k = D_k / 24 ; M_m = 50 × (1 + Σ_k c_mk·t_mk·x_k / Σ_k c_mk)',
    axes: [
      { code: 'EI', first: 'E', second: 'I', title: 'Hướng ngoại – Hướng nội', c: null, t: null },
      { code: 'SN', first: 'S', second: 'N', title: 'Giác quan – Trực giác', c: null, t: null },
      { code: 'TF', first: 'T', second: 'F', title: 'Lý trí – Cảm xúc', c: null, t: null },
      { code: 'JP', first: 'J', second: 'P', title: 'Nguyên tắc – Linh hoạt', c: null, t: null },
    ],
  };

  const mappingFile = {
    version: 1,
    note:
      'Ánh xạ tên ngành trong edumind_rubrics.json sang 12 khối trọng số. ' +
      'Do nhóm lập theo tên ngành; ngành cùng nền tảng dùng chung khối.',
    majors: mapping,
  };

  const priorityFile = {
    version: 1,
    scale: { 4: 'Cốt lõi', 3: 'Quan trọng', 2: 'Liên quan', 1: 'Hỗ trợ' },
    formula:
      'a_mj = r_mj / Σ_j r_mj ; L_m = 10 × Σ_j a_mj x_j (x_j thang 0–10, L_m thang 0–100)',
    note:
      'r_mj suy ra từ trọng số môn đã chuẩn hoá của rubric (≥0,40 → 4; ≥0,30 → 3; ' +
      '≥0,20 → 2; còn lại 1). Có thể sửa trực tiếp trong tệp này.',
    rows: priorities,
  };

  function assertNoAdminEdits(filePath) {
    if (!fs.existsSync(filePath)) return;
    let current;
    try {
      current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      return;
    }
    if (current.updatedAt && !FORCE) {
      throw new Error(
        `${path.basename(filePath)} has admin edits (updatedAt=${current.updatedAt}). ` +
          'Re-run with --force to overwrite them.'
      );
    }
    if (current.updatedAt && FORCE) {
      console.log(`WARNING: overwriting admin edits in ${path.basename(filePath)} because --force was passed.`);
    }
  }

  const groupPath = path.join(DATA_DIR, 'career_group_weights.json');
  const priorityPath = path.join(DATA_DIR, 'career_subject_priorities.json');
  assertNoAdminEdits(groupPath);
  assertNoAdminEdits(priorityPath);

  fs.writeFileSync(groupPath, `${JSON.stringify(groupFile, null, 2)}\n`);
  fs.writeFileSync(path.join(DATA_DIR, 'career_major_groups.json'), `${JSON.stringify(mappingFile, null, 2)}\n`);
  fs.writeFileSync(priorityPath, `${JSON.stringify(priorityFile, null, 2)}\n`);
  fs.writeFileSync(path.join(DATA_DIR, 'career_mbti_profile.json'), `${JSON.stringify(mbtiProfileFile, null, 2)}\n`);
  console.log('\nWrote 4 configuration files.');
}

main();
