'use strict';

const DISCLAIMER =
  'Bộ câu hỏi do nhóm tự biên soạn. Không có nguồn nào xác nhận độ tin cậy, giá trị ' +
  'hoặc hiệu quả của bộ câu hỏi này. Kết quả chỉ dùng để phản tư, không dùng để chẩn đoán ' +
  'hay quyết định nghề nghiệp. Kết quả không thay thế tư vấn hướng nghiệp của giáo viên ' +
  'hoặc chuyên gia.';

const GROUP_LABELS = {
  R: 'Thực hành / Kỹ thuật',
  I: 'Nghiên cứu / Phân tích',
  A: 'Sáng tạo / Nghệ thuật',
  S: 'Hỗ trợ / Xã hội',
  E: 'Lãnh đạo / Kinh doanh',
  C: 'Tổ chức / Dữ liệu',
};

const GROUP_ORDER = ['R', 'I', 'A', 'S', 'E', 'C'];

const PAIR_LABELS = {
  EI: { first: 'E', second: 'I', title: 'Hướng ngoại – Hướng nội' },
  SN: { first: 'S', second: 'N', title: 'Giác quan – Trực giác' },
  TF: { first: 'T', second: 'F', title: 'Lý trí – Cảm xúc' },
  JP: { first: 'J', second: 'P', title: 'Nguyên tắc – Linh hoạt' },
};

const PAIR_ORDER = ['EI', 'SN', 'TF', 'JP'];

const LIKERT_LABELS = ['Rất không thích', 'Không thích', 'Trung lập', 'Thích', 'Rất thích'];

const BIPOLAR_LABELS = {
  '-2': 'Rõ về trái',
  '-1': 'Hơi về trái',
  '0': 'Cân bằng',
  '1': 'Hơi về phải',
  '2': 'Rõ về phải',
};

// Năm tiêu đề nhóm RIASEC còn lại không có trong bản in; đây là nhãn do LearnPath
// đặt để hiển thị, không phải chữ gốc của tài liệu.
const GROUP_THEMES = {
  R: {
    title: 'Hoạt động thực hành và kỹ thuật',
    prompts: [
      'Hoạt động nào trong nhóm này bạn muốn thử trong ba tháng tới?',
      'Bạn thích làm việc với vật liệu, máy móc hay không gian ngoài trời ở mức nào?',
      'Điều gì khiến một công việc thực hành trở nên thú vị hoặc nhàm chán với bạn?',
    ],
  },
  I: {
    title: 'Hoạt động nghiên cứu và phân tích',
    prompts: [
      'Câu hỏi nào bạn muốn tìm hiểu kỹ hơn sau khi làm bài?',
      'Bạn thích đọc, quan sát hay làm thí nghiệm để trả lời câu hỏi?',
      'Khi gặp dữ liệu mâu thuẫn, bạn thường làm gì tiếp theo?',
    ],
  },
  A: {
    title: 'Hoạt động sáng tạo và nghệ thuật',
    prompts: [
      'Cách nào bạn thích dùng để diễn đạt ý tưởng: chữ, hình ảnh, âm thanh hay chuyển động?',
      'Bạn cần điều kiện gì để cảm thấy tự do sáng tạo?',
      'Sản phẩm sáng tạo nào của bạn khiến bạn muốn làm tiếp?',
    ],
  },
  S: {
    title: 'Hoạt động hỗ trợ và xã hội',
    prompts: [
      'Bạn thích giúp người khác bằng cách lắng nghe, hướng dẫn hay tổ chức hỗ trợ?',
      'Hoạt động cộng đồng nào bạn đã từng tham gia và muốn tiếp tục?',
      'Điều gì giúp bạn giữ được năng lượng khi hỗ trợ người khác trong thời gian dài?',
    ],
  },
  E: {
    title: 'Hoạt động lãnh đạo và kinh doanh',
    prompts: [
      'Bạn thích thuyết phục, tổ chức hay đàm phán ở mức nào?',
      'Một nhóm cần điều gì để bạn sẵn sàng nhận vai trò dẫn dắt?',
      'Bạn muốn học thêm kỹ năng nào để biến ý tưởng thành kế hoạch cụ thể?',
    ],
  },
  C: {
    title: 'Hoạt động tổ chức và dữ liệu',
    prompts: [
      'Bạn thích sắp xếp thông tin theo quy tắc có sẵn hay tự xây dựng quy tắc?',
      'Công việc nào của bạn sẽ dễ hơn nếu có một bảng theo dõi rõ ràng?',
      'Bạn phản ứng thế nào khi phát hiện một con số không khớp?',
    ],
  },
};

const PAIR_THEMES = {
  EI: {
    title: 'Cách bạn nạp năng lượng và trao đổi',
    prompts: [
      'Bạn cần bao nhiêu thời gian một mình sau một ngày có nhiều tương tác?',
      'Bạn thích chuẩn bị ý trước hay trao đổi để làm rõ ý?',
    ],
  },
  SN: {
    title: 'Cách bạn tiếp nhận thông tin',
    prompts: [
      'Khi học điều mới, bạn cần ví dụ cụ thể hay bức tranh tổng thể trước?',
      'Bạn chú ý đến chi tiết đang có hay khả năng có thể xảy ra?',
    ],
  },
  TF: {
    title: 'Cách bạn ra quyết định',
    prompts: [
      'Khi hai phương án đều có lý, bạn dựa vào tiêu chí nào để chọn?',
      'Bạn cân bằng giữa tính nhất quán và hoàn cảnh riêng của từng người ra sao?',
    ],
  },
  JP: {
    title: 'Cách bạn tổ chức công việc',
    prompts: [
      'Bạn thấy dễ chịu hơn khi kế hoạch đã chốt hay khi còn nhiều lựa chọn?',
      'Điều gì giúp bạn hoàn thành việc đúng hạn mà không bị quá tải?',
    ],
  },
};

const SOURCES = [
  {
    id: 1,
    title: 'O*NET Resource Center — Interest Profiler',
    url: 'https://www.onetcenter.org/IP.html',
    note: 'Giới thiệu công cụ RIASEC chính thức và các phiên bản 30 hoặc 60 câu.',
  },
  {
    id: 2,
    title: 'O*NET Resource Center — O*NET Interest Profiler Manual',
    url: 'https://www.onetcenter.org/reports/IP_Manual.html',
    note: 'Tài liệu phát triển, chấm điểm và nghiên cứu độ tin cậy của O*NET; không áp dụng cho bộ câu hỏi tự soạn này.',
  },
  {
    id: 3,
    title: 'O*NET Interest Profiler online',
    url: 'https://onetinterestprofiler.org/',
    note: 'Công cụ sở thích nghề nghiệp chính thức bằng tiếng Anh.',
  },
  {
    id: 4,
    title: 'Myers & Briggs Foundation — The Preferences',
    url: 'https://www.myersbriggs.org/my-mbti-personality-type/the-mbti-preferences/',
    note: 'Định nghĩa bốn cặp xu hướng E–I, S–N, T–F và J–P.',
  },
  {
    id: 5,
    title: 'Myers & Briggs Foundation — Three Unique Instruments',
    url: 'https://www.myersbriggs.org/unique-features-of-myers-briggs/three-unique-instruments/',
    note: 'Phân biệt các công cụ Step I, Step II và Step III.',
  },
  {
    id: 6,
    title: 'The Myers-Briggs Company — The MBTI Step II Assessment',
    url: 'https://www.themyersbriggs.com/en-US/Access-Resources/Articles/the-mbti-step-ii-assessment',
    note: 'Cơ sở tổ chức chủ đề phản tư; không sao chép câu hỏi hoặc thang điểm chính thức.',
  },
  {
    id: 7,
    title: 'The Myers-Briggs Company Asia — Our Sample Reports',
    url: 'https://asia.themyersbriggs.com/resources/sample-reports/',
    note: 'Mẫu báo cáo Step I, Step II và báo cáo nghề nghiệp; không phải ngân hàng câu hỏi.',
  },
  {
    id: 8,
    title: 'The Myers-Briggs Company — MBTI Form M Career Report',
    url: 'https://ap.themyersbriggs.com/productdetails.aspx?Product=8&Type=2',
    note: 'Mô tả báo cáo ứng dụng kết quả vào khám phá nghề nghiệp.',
  },
  {
    id: 9,
    title: 'Myers & Briggs Foundation — MBTI Code of Ethics',
    url: 'https://www.myersbriggs.org/using-type-as-a-professional/mbti-code-of-ethics/home.htm',
    note: 'Hướng dẫn diễn giải, quyền tự xác nhận và giới hạn sử dụng kết quả.',
  },
  {
    id: 10,
    title: 'The Myers-Briggs Company — Ethical Principles for MBTI Practitioners',
    url: 'https://www.themyersbriggs.com/en-US/Support/Ethical-Principles-for-MBTI-Practitioners',
    note: 'Nguyên tắc tự nguyện, bảo mật, phản hồi kết quả và tôn trọng bản quyền.',
  },
  {
    id: 11,
    title: '16Personalities — Our Framework',
    url: 'https://www.16personalities.com/articles/our-theory',
    note: 'Giải thích mô hình NERIS có năm thang; giúp phân biệt với MBTI chính thức.',
  },
  {
    id: 12,
    title: 'McCrae R. R. & Costa P. T. Jr. (1989)',
    url: 'https://doi.org/10.1111/j.1467-6494.1989.tb00759.x',
    note: 'Nghiên cứu độc lập trên Journal of Personality, 57(1), 17–40; cơ sở để thận trọng với nhãn bốn chữ.',
  },
];

const SOURCE_NOTE =
  'Câu hỏi tự biên soạn cho hoạt động giáo dục hướng nghiệp; chấm điểm theo hợp đồng nội bộ ' +
  'của LearnPath. Không phải MBTI Step I/II hay O*NET Interest Profiler chính thức.';

module.exports = {
  DISCLAIMER,
  SOURCE_NOTE,
  GROUP_LABELS,
  GROUP_ORDER,
  PAIR_LABELS,
  PAIR_ORDER,
  LIKERT_LABELS,
  BIPOLAR_LABELS,
  GROUP_THEMES,
  PAIR_THEMES,
  SOURCES,
};
