/**
 * Danh mục 10 ngành đào tạo HOT / Xu hướng phát triển hàng đầu
 * Dùng để đánh dấu trực quan (badge, filter, gợi ý) trên toàn bộ frontend LearnPath
 */

export const HOT_MAJORS = [
  {
    id: 1,
    name: 'Trí tuệ nhân tạo (AI) & Khoa học dữ liệu',
    shortName: 'AI & Khoa học dữ liệu',
    tag: 'AI & Data Science',
    exactNames: [
      'Trí tuệ nhân tạo (AI) & Khoa học dữ liệu',
      'Khoa học Dữ liệu và Trí tuệ nhân tạo',
      'Khoa học Dữ liệu và Trí tuệ nhân tạo (CT tiên tiến)',
      'Trí tuệ Nhân tạo',
      'Trí tuệ nhân tạo',
      'Khoa học Dữ liệu',
      'Khoa học dữ liệu',
    ],
    keywords: [
      'trí tuệ nhân tạo',
      'khoa học dữ liệu',
      'ai & khoa học dữ liệu',
      'data science',
      'artificial intelligence',
      'dữ liệu lớn',
      'big data',
      'aiot',
      'machine learning',
    ],
    description: 'Nghiên cứu mô hình học máy, dữ liệu lớn và giải pháp thông minh tự động hóa.',
  },
  {
    id: 2,
    name: 'Công nghệ thông tin (IT) – Phát triển phần mềm',
    shortName: 'CNTT – Phần mềm',
    tag: 'IT & Software',
    exactNames: [
      'Công nghệ thông tin (IT) – Phát triển phần mềm',
      'Công nghệ Thông tin',
      'Công nghệ thông tin',
      'Kỹ thuật Phần mềm',
      'Kỹ thuật phần mềm',
      'Khoa học Máy tính',
      'Khoa học máy tính',
      'Hệ thống Thông tin',
      'Hệ thống thông tin',
      'Mạng Máy tính và Truyền thông Dữ liệu',
      'Tin học Ứng dụng',
    ],
    keywords: [
      'công nghệ thông tin',
      'kỹ thuật phần mềm',
      'khoa học máy tính',
      'phát triển phần mềm',
      'hệ thống thông tin',
      'mạng máy tính',
      'tin học ứng dụng',
      'software engineering',
      'cntt',
    ],
    excludes: ['sư phạm'],
    description: 'Xây dựng, phát triển và tối ưu ứng dụng phần mềm, hệ thống mạng và nền tảng đám mây.',
  },
  {
    id: 3,
    name: 'An ninh mạng (Cybersecurity)',
    shortName: 'An ninh mạng',
    tag: 'Cybersecurity',
    exactNames: [
      'An ninh mạng (Cybersecurity)',
      'An ninh mạng',
      'An toàn Thông tin',
      'An toàn thông tin',
    ],
    keywords: [
      'an ninh mạng',
      'an toàn thông tin',
      'cybersecurity',
      'bảo mật thông tin',
      'an toàn không gian số',
      'an ninh không gian mạng',
      'an ninh số',
    ],
    description: 'Bảo vệ dữ liệu, phòng thủ không gian số và an toàn hạ tầng thông tin quốc gia & doanh nghiệp.',
  },
  {
    id: 4,
    name: 'Công nghệ bán dẫn & Vi mạch',
    shortName: 'Bán dẫn & Vi mạch',
    tag: 'Semiconductor & IC',
    exactNames: [
      'Công nghệ bán dẫn & Vi mạch',
      'Thiết kế Vi mạch',
      'Thiết kế vi mạch',
      'Công nghệ Bán dẫn',
      'Công nghệ bán dẫn',
      'Vi mạch bán dẫn',
      'Công nghệ vi mạch bán dẫn',
      'Công nghệ vi mạch và bán dẫn',
    ],
    keywords: [
      'bán dẫn',
      'vi mạch',
      'thiết kế vi mạch',
      'semiconductor',
      'công nghệ bán dẫn',
      'vi mạch bán dẫn',
      'đóng gói và kiểm thử vi mạch',
      'thiết kế chip',
    ],
    description: 'Thiết kế chip vi xử lý, đóng gói kiểm thử và công nghệ sản xuất bán dẫn mũi nhọn.',
  },
  {
    id: 5,
    name: 'Logistics & Quản lý chuỗi cung ứng',
    shortName: 'Logistics & Chuỗi cung ứng',
    tag: 'Logistics & Supply Chain',
    exactNames: [
      'Logistics & Quản lý chuỗi cung ứng',
      'Logistics và Quản lý Chuỗi cung ứng',
      'Logistic và Quản lý Chuỗi cung ứng',
      'Logistics',
      'Quản lý chuỗi cung ứng',
    ],
    keywords: [
      'logistics',
      'logistic',
      'chuỗi cung ứng',
      'quản lý chuỗi cung ứng',
      'quản trị chuỗi cung ứng',
      'supply chain',
    ],
    description: 'Vận hành chuỗi cung ứng toàn cầu, tối ưu hóa lưu chuyển hàng hóa và quản lý kho bãi.',
  },
  {
    id: 6,
    name: 'Kinh doanh – Bán hàng (Sales / Business Development)',
    shortName: 'Kinh doanh & Bán hàng',
    tag: 'Sales & BizDev',
    exactNames: [
      'Kinh doanh – Bán hàng (Sales / Business Development)',
      'Kinh doanh – Bán hàng',
      'Kinh doanh Quốc tế',
      'Kinh doanh quốc tế',
      'Kinh doanh Thương mại',
      'Kinh doanh thương mại',
      'Thương mại Quốc tế',
      'Thương mại điện tử',
    ],
    keywords: [
      'kinh doanh quốc tế',
      'kinh doanh thương mại',
      'thương mại quốc tế',
      'thương mại điện tử',
      'bán hàng',
      'phát triển kinh doanh',
      'kinh doanh – bán hàng',
      'sales',
      'business development',
    ],
    description: 'Đàm phán thương mại, mở rộng thị trường và xúc tiến các mô hình kinh doanh số hiện đại.',
  },
  {
    id: 7,
    name: 'Marketing & Truyền thông số (Digital Marketing)',
    shortName: 'Marketing & Truyền thông số',
    tag: 'Digital Marketing',
    exactNames: [
      'Marketing & Truyền thông số (Digital Marketing)',
      'Marketing',
      'Truyền thông Đa phương tiện',
      'Truyền thông đa phương tiện',
      'Digital Marketing',
    ],
    keywords: [
      'marketing',
      'marketing số',
      'digital marketing',
      'truyền thông số',
      'truyền thông đa phương tiện',
      'marketing & truyền thông số',
      'quảng cáo',
    ],
    description: 'Tiếp thị số đa kênh, định vị thương hiệu trực tuyến và tương tác nội dung truyền thông hiện đại.',
  },
  {
    id: 8,
    name: 'Y tế – Dược & Chăm sóc sức khỏe',
    shortName: 'Y tế & Chăm sóc sức khỏe',
    tag: 'Healthcare & Pharma',
    exactNames: [
      'Y tế – Dược & Chăm sóc sức khỏe',
      'Y khoa',
      'Dược học',
      'Răng Hàm Mặt',
      'Y tế Công cộng',
      'Điều dưỡng',
      'Y học Cổ truyền',
      'Phục hồi Chức năng',
      'Kỹ thuật Y sinh',
      'Quản lý Bệnh viện',
    ],
    keywords: [
      'y khoa',
      'dược học',
      'dược',
      'răng hàm mặt',
      'y tế công cộng',
      'điều dưỡng',
      'y học cổ truyền',
      'phục hồi chức năng',
      'kỹ thuật y sinh',
      'chăm sóc sức khỏe',
      'y học dự phòng',
      'quản lý bệnh viện',
    ],
    description: 'Bảo vệ và chăm sóc sức khỏe con người, chẩn đoán, điều trị y khoa và nghiên cứu dược liệu.',
  },
  {
    id: 9,
    name: 'Tự động hóa & Robotics / Cơ điện tử',
    shortName: 'Tự động hóa & Robotics',
    tag: 'Robotics & Automation',
    exactNames: [
      'Tự động hóa & Robotics / Cơ điện tử',
      'Kỹ thuật Điều khiển - Tự động hoá (CT tiên tiến)',
      'Kỹ thuật Điều khiển và Tự động hóa',
      'Kỹ thuật Cơ điện tử',
      'Cơ điện tử',
      'Điều khiển học',
    ],
    keywords: [
      'tự động hóa',
      'tự động hoá',
      'cơ điện tử',
      'robotics',
      'robot',
      'điều khiển học',
      'điều khiển và tự động hóa',
      'kỹ thuật cơ điện tử',
      'kỹ thuật điều khiển',
    ],
    description: 'Chế tạo robot thông minh, dây chuyền sản xuất tự động và tích hợp cơ điện tử cao cấp.',
  },
  {
    id: 10,
    name: 'Năng lượng tái tạo & Công nghệ xanh (CleanTech)',
    shortName: 'Năng lượng xanh & CleanTech',
    tag: 'CleanTech & Energy',
    exactNames: [
      'Năng lượng tái tạo & Công nghệ xanh (CleanTech)',
      'Năng lượng Tái tạo',
      'Năng lượng tái tạo',
      'Công nghệ xanh',
    ],
    keywords: [
      'năng lượng tái tạo',
      'công nghệ xanh',
      'cleantech',
      'năng lượng sạch',
      'năng lượng mới',
      'kỹ thuật môi trường',
      'khoa học môi trường',
    ],
    description: 'Phát triển nguồn điện gió, mặt trời và công nghệ xanh giảm phát thải bảo vệ môi trường toàn cầu.',
  },
]

/**
 * Ngưỡng điểm chuẩn tối thiểu để được công nhận và đánh dấu là Ngành HOT trên giao diện
 */
export const HOT_SCORE_THRESHOLD = 27

/**
 * Tra cứu thông tin phân loại nhóm ngành HOT dựa theo tên ngành (chưa xét điều kiện điểm chuẩn)
 * @param {string} majorName - Tên ngành tuyển sinh
 * @returns {object|null} - Đối tượng ngành HOT hoặc null
 */
export function getHotMajorInfo(majorName) {
  if (!majorName || typeof majorName !== 'string') return null
  const name = majorName.trim()
  if (!name) return null
  const lower = name.toLowerCase()

  // 1. So khớp chính xác danh sách tên cụ thể (exactNames)
  for (const item of HOT_MAJORS) {
    if (item.exactNames && item.exactNames.some((en) => en.toLowerCase() === lower)) {
      return item
    }
  }

  // 2. So khớp theo từ khóa đặc trưng (có loại trừ nếu gặp từ loại trừ)
  for (const item of HOT_MAJORS) {
    if (item.excludes && item.excludes.some((ex) => lower.includes(ex))) {
      continue
    }
    if (item.keywords && item.keywords.some((kw) => lower.includes(kw))) {
      return item
    }
  }

  return null
}

/**
 * Kiểm tra xem tên ngành có thuộc 1 trong 10 nhóm ngành HOT hay không (không xét điểm)
 * @param {string} majorName
 * @returns {boolean}
 */
export function matchesHotMajorCategory(majorName) {
  return getHotMajorInfo(majorName) !== null
}

/**
 * Kiểm tra xem một ngành có thỏa mãn ĐẦY ĐỦ điều kiện để được đánh dấu là NGÀNH HOT:
 * 1. Tên ngành thuộc 1 trong 10 nhóm ngành HOT
 * 2. Điểm chuẩn (entryScore hoặc diem_chuan) từ 27 điểm trở lên (>= 27)
 *
 * @param {string} majorName - Tên ngành
 * @param {number|string|null|undefined} entryScore - Điểm chuẩn tuyển sinh
 * @returns {boolean}
 */
export function isHotMajor(majorName, entryScore) {
  if (entryScore === null || entryScore === undefined || entryScore === '') return false
  const num = Number(entryScore)
  if (!Number.isFinite(num) || num < HOT_SCORE_THRESHOLD) return false
  return getHotMajorInfo(majorName) !== null
}

/**
 * Lấy nhãn badge hiển thị nhanh cho ngành HOT (khi thỏa mãn cả nhóm ngành và điểm chuẩn >= 27)
 * @param {string} majorName - Tên ngành
 * @param {number|string|null|undefined} entryScore - Điểm chuẩn
 * @returns {{ id: number, name: string, shortName: string, tag: string, entryScore: number }|null}
 */
export function getHotMajorBadge(majorName, entryScore) {
  if (!isHotMajor(majorName, entryScore)) return null
  const info = getHotMajorInfo(majorName)
  return {
    id: info.id,
    name: info.name,
    shortName: info.shortName,
    tag: info.tag,
    entryScore: Number(entryScore),
  }
}
