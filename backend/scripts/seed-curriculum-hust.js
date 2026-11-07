'use strict';

const { getAuthDb } = require('../src/auth/authDb');
const { createCurriculum, getCurriculumBySchoolAndMajor, updateCurriculum } = require('../src/curriculum/curriculumStore');

async function main() {
  console.log('Connecting to auth database...');
  await getAuthDb();

  const schoolName = 'Đại học Bách khoa Hà Nội';
  const majorName = 'Kỹ thuật Điều khiển và Tự động hóa';

  const semesters = [
    {
      semester: 'Học kỳ 1',
      courses: [
        { code: 'MI1111', name: 'Giải tích I', credits: 4, type: 'Đại cương' },
        { code: 'MI1141', name: 'Đại số', credits: 4, type: 'Đại cương' },
        { code: 'FL1129', name: 'Tiếng Anh cơ sở 1', credits: 3, type: 'Đại cương' },
        { code: 'EM1170', name: 'Pháp luật đại cương', credits: 2, type: 'Đại cương' },
        { code: 'EE1024', name: 'Nhập môn ngành Điện', credits: 2, type: 'Cơ sở ngành' },
      ],
    },
    {
      semester: 'Học kỳ 2',
      courses: [
        { code: 'IT1110', name: 'Tin học đại cương', credits: 4, type: 'Đại cương' },
        { code: 'MI1121', name: 'Giải tích II', credits: 3, type: 'Đại cương' },
        { code: 'MI1131', name: 'Giải tích III', credits: 3, type: 'Đại cương' },
        { code: 'PH1110', name: 'Vật lý đại cương I', credits: 3, type: 'Đại cương' },
        { code: 'FL1130', name: 'Tiếng Anh cơ sở 2', credits: 3, type: 'Đại cương' },
        { code: 'MIL1120', name: 'Công tác quốc phòng - An ninh', credits: 0, type: 'Đại cương' },
      ],
    },
    {
      semester: 'Học kỳ 3',
      courses: [
        { code: 'SSH1111', name: 'Triết học Mác - Lênin', credits: 3, type: 'Đại cương' },
        { code: 'MI2020', name: 'Xác suất thống kê', credits: 3, type: 'Đại cương' },
        { code: 'MI2110', name: 'Phương pháp tính và MATLAB', credits: 3, type: 'Đại cương' },
        { code: 'PH1120', name: 'Vật lý đại cương II', credits: 3, type: 'Đại cương' },
        { code: 'EE2000', name: 'Tín hiệu và hệ thống', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE2021', name: 'Lý thuyết mạch điện I', credits: 3, type: 'Cơ sở ngành' },
      ],
    },
    {
      semester: 'Học kỳ 4',
      courses: [
        { code: 'SSH1121', name: 'Kinh tế chính trị Mác - Lênin', credits: 2, type: 'Đại cương' },
        { code: 'PH1131', name: 'Vật lý đại cương III', credits: 2, type: 'Đại cương' },
        { code: 'EE2022', name: 'Lý thuyết mạch điện II', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE2110', name: 'Điện tử tương tự', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3140', name: 'Máy điện I', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3288', name: 'Lý thuyết điều khiển tuyến tính', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE2031', name: 'Trường điện từ', credits: 3, type: 'Cơ sở ngành' },
      ],
    },
    {
      semester: 'Học kỳ 5',
      courses: [
        { code: 'SSH1131', name: 'Chủ nghĩa xã hội khoa học', credits: 2, type: 'Đại cương' },
        { code: 'EE2130', name: 'Thiết kế hệ thống số', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3110', name: 'Kỹ thuật đo lường', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3410', name: 'Điện tử công suất', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3491', name: 'Kỹ thuật lập trình', credits: 2, type: 'Cơ sở ngành' },
        { code: 'EE4220', name: 'Điều khiển logic và PLC', credits: 3, type: 'Chuyên ngành' },
        { code: 'EM1010', name: 'Quản trị học đại cương', credits: 2, type: 'Bổ trợ' },
      ],
    },
    {
      semester: 'Học kỳ 6',
      courses: [
        { code: 'SSH1141', name: 'Lịch sử Đảng cộng sản Việt Nam', credits: 2, type: 'Đại cương' },
        { code: 'EE3480', name: 'Vi xử lý', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3510', name: 'Truyền động điện', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3550', name: 'Điều khiển quá trình', credits: 3, type: 'Chuyên ngành' },
        { code: 'EE3600', name: 'Hệ thống đo và điều khiển công nghiệp', credits: 3, type: 'Chuyên ngành' },
        { code: 'EE3810', name: 'Đồ án I', credits: 2, type: 'Thực tập/Đồ án' },
        { code: 'ED3220', name: 'Kỹ năng mềm', credits: 2, type: 'Bổ trợ' },
      ],
    },
    {
      semester: 'Học kỳ 7',
      courses: [
        { code: 'SSH1151', name: 'Tư tưởng Hồ Chí Minh', credits: 2, type: 'Đại cương' },
        { code: 'EE3426', name: 'Hệ thống cung cấp điện (BTL)', credits: 3, type: 'Cơ sở ngành' },
        { code: 'EE3820', name: 'Đồ án II', credits: 2, type: 'Thực tập/Đồ án' },
        { code: 'EE4331', name: 'Điều khiển Điện tử công suất', credits: 3, type: 'Tự chọn' },
        { code: 'EE4401', name: 'Thiết kế hệ điều khiển nhúng', credits: 3, type: 'Tự chọn' },
        { code: 'EE4502', name: 'Kỹ thuật cảm biến', credits: 3, type: 'Tự chọn' },
      ],
    },
    {
      semester: 'Học kỳ 8 (Tốt nghiệp Cử nhân / Khởi đầu Kỹ sư)',
      courses: [
        { code: 'EE3910', name: 'Thực tập kỹ thuật', credits: 2, type: 'Thực tập/Đồ án' },
        { code: 'EE4900', name: 'Đồ án tốt nghiệp Cử nhân', credits: 6, type: 'Thực tập/Đồ án' },
        { code: 'EE6312', name: 'Phân tích và điều khiển hệ phi tuyến', credits: 3, type: 'Cơ sở ngành' },
        { code: 'SS6013', name: 'Triết học', credits: 3, type: 'Bắt buộc' },
      ],
    },
    {
      semester: 'Học kỳ 9 (Bậc Kỹ sư chuyên sâu / Thạc sĩ)',
      courses: [
        { code: 'EE6010', name: 'Seminar 1', credits: 3, type: 'Thực tập/Đồ án' },
        { code: 'EE6543', name: 'Cảm biến và xử lý tín hiệu đo', credits: 2, type: 'Cơ sở ngành' },
        { code: 'EE6551', name: 'Điện tử công suất nâng cao', credits: 2, type: 'Cơ sở ngành' },
        { code: 'EE6532', name: 'Tối ưu hóa và điều khiển tối ưu', credits: 3, type: 'Tự chọn' },
        { code: 'EE6424', name: 'Mạng nơ-rôn và học sâu', credits: 3, type: 'Tự chọn' },
      ],
    },
    {
      semester: 'Học kỳ 10 (Bậc Kỹ sư chuyên sâu / Thạc sĩ)',
      courses: [
        { code: 'EE6020', name: 'Seminar 2', credits: 3, type: 'Thực tập/Đồ án' },
        { code: 'EE6503', name: 'Xử lý tín hiệu số', credits: 2, type: 'Cơ sở ngành' },
        { code: 'EE6445', name: 'Điều khiển mờ và mạng nơ-ron', credits: 3, type: 'Tự chọn' },
        { code: 'EE6435', name: 'Điều khiển học tăng cường', credits: 3, type: 'Tự chọn' },
        { code: 'EE6328', name: 'Điều khiển chuyển động và Robot', credits: 3, type: 'Tự chọn' },
      ],
    },
    {
      semester: 'Học kỳ 11 (Bậc Kỹ sư chuyên sâu / Thạc sĩ)',
      courses: [
        { code: 'EE6001', name: 'Luận văn tốt nghiệp Kỹ sư / Thạc sĩ', credits: 15, type: 'Thực tập/Đồ án' },
      ],
    },
  ];

  const contentMarkdown = `## 1. Giới thiệu tổng quan chương trình đào tạo
**Ngành Kỹ thuật Điều khiển và Tự động hoá (Mã tuyển sinh: EE2)** thuộc Trường Điện - Điện tử, Đại học Bách khoa Hà Nội là ngành kỹ thuật công nghệ cao then chốt, đào tạo nguồn nhân lực chất lượng cao trong việc nghiên cứu, thiết kế, tích hợp, vận hành và quản lý các hệ thống tự động hóa công nghiệp, robot thông minh và các giải pháp điều khiển tiên tiến.

Sinh viên theo học được đào tạo chuyên sâu về:
- **Lý thuyết điều khiển**: Điều khiển tuyến tính, điều khiển số, điều khiển phi tuyến, điều khiển mờ, mạng nơ-ron và học sâu (Deep Learning), điều khiển học tăng cường (Reinforcement Learning).
- **Hệ thống phần cứng & Nhúng**: Lập trình vi điều khiển, vi xử lý, kiến trúc ARM, thiết kế mạch FPGA, thiết kế hệ thống số.
- **Tự động hóa công nghiệp**: Lập trình PLC (Siemens, Mitsubishi, Rockwell...), mạng truyền thông công nghiệp, hệ thống SCADA, DCS, điều khiển quá trình (Process Control).
- **Robot & Truyền động điện**: Động học và động lực học Robot, điều khiển chuyển động (Motion Control), biến tần và điện tử công suất nâng cao.
- **Đo lường & Cảm biến thông minh**: Mạng cảm biến không dây, xử lý tín hiệu số, ứng dụng IoT và Trí tuệ nhân tạo (AI) trong công nghiệp 4.0.

---

## 2. Chuẩn đầu ra và Năng lực đạt được sau tốt nghiệp
### a. Kiến thức chuyên môn
- Năng lực tư vấn, thiết kế, triển khai và tối ưu hóa các dây chuyền sản xuất tự động hóa trong các nhà máy (chế tạo, lắp ráp ô tô, điện tử, bán dẫn, xi măng, hóa chất, dược phẩm...).
- Thiết kế, tích hợp và phát triển các hệ thống nhúng thông minh, thiết bị đo lường và cảm biến công nghiệp.
- Nghiên cứu phát triển robot công nghiệp, hệ thống tự hành AGV, thị giác máy tính và ứng dụng AI/IoT.
- Quản lý dự án kỹ thuật, đánh giá hiệu quả kinh tế và chỉ đạo kỹ thuật tại các tập đoàn công nghệ.

### b. Kỹ năng & Ngoại ngữ
- Kỹ năng làm việc nhóm, tư duy giải quyết vấn đề kỹ thuật phức tạp, thuyết trình kỹ thuật.
- Trình độ ngoại ngữ: Chuẩn đầu ra tiếng Anh đạt tương đương **TOEIC 500+**, tự tin đọc hiểu tài liệu kỹ thuật quốc tế và làm việc trong môi trường đa quốc gia.

---

## 3. Khung thời gian và Mô hình đào tạo tích hợp
Trường Đại học Bách khoa Hà Nội áp dụng mô hình đào tạo theo hình cây linh hoạt:
- **Bậc Cử nhân (Bachelor of Science)**: 4 năm (132 tín chỉ) — Cấp bằng Cử nhân Kỹ thuật Điều khiển và Tự động hóa.
- **Bậc Kỹ sư chuyên sâu (Engineering Degree)**: 5 năm (180 tín chỉ) — Định hướng ứng dụng công nghệ chuyên sâu, thực tập doanh nghiệp và làm đồ án kỹ sư thực tế.
- **Bậc Thạc sĩ khoa học (Master of Science)**: 5,5 năm (180 tín chỉ) — Định hướng nghiên cứu phát triển và học tiếp lên Tiến sĩ (PhD).

---

## 4. Các định hướng chuyên môn sâu (Mô-đun tự chọn)
1. **Mô đun 1: Tự động hóa công nghiệp (Industrial Automation)**: Tập trung vào lập trình PLC, SCADA, điều khiển quá trình, hệ thống sản xuất tích hợp máy tính (CIM), truyền động điện và điện tử công suất.
2. **Mô đun 2: Điều khiển tự động (Automatic Control Systems)**: Tập trung vào hệ thống điều khiển số, mô hình hóa & mô phỏng, thiết kế hệ điều khiển nhúng, tối ưu hóa hệ thống.
3. **Mô đun 3: Đo lường và Tin học công nghiệp (Instrumentation & Industrial Informatics)**: Tập trung vào kỹ thuật cảm biến, hệ thống nhúng, mạng cảm biến không dây và xử lý tín hiệu công nghiệp.

---

## 5. Cơ hội nghề nghiệp & Doanh nghiệp tiêu biểu
Sau khi tốt nghiệp, kỹ sư và cử nhân ngành Điều khiển & Tự động hóa có tỷ lệ việc làm đạt trên 98% sau 6 tháng, làm việc tại:
- **Tập đoàn đa quốc gia về tự động hóa & năng lượng**: Siemens, ABB, Schneider Electric, Omron, Mitsubishi Electric, Rockwell Automation, Honeywell...
- **Tập đoàn sản xuất công nghệ & vi mạch điện tử**: Samsung Electronics, Intel, LG, Foxconn, Pegatron, Luxshare, Canon...
- **Các tập đoàn công nghiệp hàng đầu Việt Nam**: Viettel, VinFast, Thaco, Hòa Phát, Vinamilk, PVN, EVN...
- **Các viện nghiên cứu & trường đại học**: Viện Hàn lâm Khoa học và Công nghệ Việt Nam, Viện Nghiên cứu Điện tử - Tin học - Tự động hóa (VIELINA), các trường đại học kỹ thuật trong và ngoài nước.`;

  const payload = {
    schoolCode: 'BKA',
    schoolName,
    majorCode: 'EE2',
    majorName,
    degreeLevel: 'Cử nhân - Kỹ sư',
    durationYears: 4,
    totalCredits: 132,
    description:
      'Ngành Kỹ thuật Điều khiển và Tự động hóa (EE2) tại Đại học Bách khoa Hà Nội là ngành kỹ thuật mũi nhọn hàng đầu cả nước, nghiên cứu, thiết kế, tích hợp và vận hành các hệ thống điều khiển tự động thông minh, dây chuyền sản xuất công nghiệp, robot công nghiệp, hệ thống nhúng, mạng cảm biến IoT và trí tuệ nhân tạo (AI) trong công nghiệp.',
    content: contentMarkdown,
    semesters,
  };

  const existing = getCurriculumBySchoolAndMajor(schoolName, majorName);
  if (existing) {
    console.log(`Updating existing curriculum (id=${existing.id})...`);
    const updated = await updateCurriculum(existing.id, payload);
    console.log('Updated successfully:', updated.schoolName, '-', updated.majorName);
  } else {
    console.log('Creating new curriculum...');
    const created = await createCurriculum(payload);
    console.log('Created successfully with id:', created.id, created.schoolName, '-', created.majorName);
  }

  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed to seed curriculum:', err);
  process.exit(1);
});
