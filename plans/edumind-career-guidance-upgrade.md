# Kế hoạch khảo sát và đề xuất nâng cấp “Phân tích năng lực & Định hướng ngành”

> **Trạng thái:** Bản plan khảo sát/đề xuất — chờ người dùng duyệt; chưa cho phép triển khai tại LearnPath.  
> **Ngày lập:** 2026-10-24  
> **Phạm vi hiện tại:** Chỉ đọc mã EduMindAI và LearnPath, lập bằng chứng và phương án; không sửa mã, dữ liệu, cấu hình hay chạy migration.  
> **Nguồn tham khảo:** `Source_demo (no copy)/EduMind-AI` — đọc trực tiếp, không sao chép mã/tài sản/dữ liệu.  
> **Phân loại triển khai dự kiến:** có thể từ **L2 đến L3**, tùy quyết định về schema auth, dữ liệu ngành, ý nghĩa điểm/phù hợp, AI và hợp đồng API. Phân loại cuối cùng phải xác nhận trước khi triển khai.

---

## 1. Mục tiêu

Khảo sát chức năng mang tên **“Phân tích năng lực & Định hướng ngành”** trong EduMindAI, xác định chính xác các luồng, thuật toán, dữ liệu, API và giới hạn; đối chiếu với LearnPath; sau đó trình bày phương án nâng cấp phù hợp kiến trúc và dữ liệu thực tế của LearnPath để người dùng quyết định.

Plan này không mặc định rằng toàn bộ thiết kế hoặc kết quả tính toán của EduMindAI là đúng, cũng không coi việc duyệt plan là chấp thuận tự động cho mọi thay đổi L3. Trước khi triển khai sẽ chốt riêng các quyết định sản phẩm/dữ liệu/API/schema cần thiết.

## 2. Ranh giới và bảo vệ nguồn tham khảo

- Chỉ đọc source EduMindAI; không chỉnh sửa, format, build, chạy ứng dụng, chạy script seed/migrate, hoặc sửa trạng thái git của source.
- Không mở nội dung database nhị phân `Source_demo (no copy)/EduMind-AI/database.db`, các bản backup/broken, thư mục uploads, `.env`, secrets hay dữ liệu cá nhân. Các file/database này không cần thiết để khảo sát cấu trúc chức năng.
- Repo EduMindAI hiện có thay đổi chưa commit, bao gồm `database.db` đã sửa và nhiều file trong `uploads` bị xóa. Đây là trạng thái có sẵn khi kiểm tra; tuyệt đối không revert, xóa, ghi đè, stage hoặc commit chúng.
- Không sao chép code, prompt, ảnh, nội dung, seed data hay database từ EduMindAI vào LearnPath. Chỉ ghi mô tả chức năng, nguyên lý ở mức khái niệm, bằng chứng đường dẫn/dòng và thiết kế mới tương thích LearnPath.
- Không thay đổi schema, API contract, auth/session, semantics điểm/xếp hạng, dữ liệu admission, dependencies hoặc code LearnPath trong giai đoạn lập plan.
- Không commit/push/PR.

## 3. Kết quả khảo sát sơ bộ đã xác minh

Các mục dưới đây là dấu vết source-code đã đọc, không phải xác nhận chất lượng dữ liệu live trong database EduMindAI.

| Khía cạnh | Bằng chứng trong EduMindAI | Nhận định cần giữ khi thiết kế |
|---|---|---|
| Dashboard phân tích | `routes/career.py:76-107`; `templates/student_career.html` | Hiển thị biểu đồ radar điểm học sinh so với yêu cầu ngành, ngành mục tiêu, ngành ghim và gap từng môn. |
| Điểm năng lực đầu vào | `app_helpers.py:1070-1091` | Tính trung bình môn từ TX/GK/HK theo trọng số `(TX + 2×GK + 3×HK)/6`; chỉ tạo kết quả khi có đủ cả ba loại. LearnPath hiện lưu `diem_lop` dạng mảng tự do, không có loại điểm/kỳ/năm học tương đương để tái sử dụng trực tiếp công thức này. |
| Điểm fit và gap | `app_helpers.py:1094-1118` | Fit là tổng điểm bị chặn trên ở `min_score` nhân `weight`, chia tổng yêu cầu có trọng số; môn thiếu được thay bằng `0`. Đây là chỉ số heuristic do nguồn định nghĩa, không phải xác suất trúng tuyển hay đánh giá năng lực đã được kiểm định. Mặc dù comment ghi tổng weights 1.0, `seed_major_weights.py:147-183` để weight môn không liên quan bằng 0 và tổng nhóm môn khối là 0.9 trước các weight phụ. Phải kiểm tra/diễn giải mẫu số và tính nhất quán trước khi đưa ra LearnPath.
| Duyệt/gợi ý ngành | `routes/career.py:127-181`; `templates/student_career_browse.html` | Lọc từ khóa/trường/khối/nhóm, ngưỡng fit, ghim/đã chọn; sắp xếp theo fit, điểm chuẩn tăng/giảm, A-Z. Kết quả có radar, lịch sử điểm, target/pin. |
| Mô phỏng điểm | `routes/career.py:193-218`; browse template | POST điểm giả định để tính lại danh sách ngành phù hợp. Đây là mô phỏng theo cùng công thức fit, không phải dự báo tuyển sinh. |
| So sánh ngành | `routes/career.py:220-259`; `templates/student_career_compare.html` | So sánh tối đa 4 ngành qua radar, bảng môn/gap, điểm chuẩn nhiều năm. Danh sách ID còn được lưu trong `sessionStorage` phía trình duyệt. |
| Bản đồ ngành | `routes/career.py:280-305`; `templates/student_career_map.html` | Trả vector điểm học sinh, vector trọng số/yêu cầu ngành và fit để giao diện vẽ mạng liên kết, lọc theo nhóm/fit. |
| Target/pin | `routes/career.py:308-351`; model tại `models.py:613-630` | Có API ghim/bỏ ghim và đặt ngành mục tiêu; uniqueness theo học sinh-ngành và một target/học sinh. Giao diện ghi rõ giới hạn tối đa 5 ngành ghim. |
| Dữ liệu ngành | `models.py:576-639`; `seed_majors.py`; `seed_entry_scores.py`; `seed_major_weights.py` | Bảng ngành, nhóm, khối, điểm chuẩn, weights yêu cầu, lịch sử điểm. `seed_entry_scores.py:12-56` có cơ chế sinh block/điểm lịch sử ngẫu nhiên khi thiếu; `TODO-CAREER-SCRAPE.md` nói một số điểm chuẩn mock. Không được xem các con số demo là dữ liệu đáng tin hoặc bê sang LearnPath. |
| Trợ lý AI | `career_ai.py:6-77,124-185,188-361`; endpoint tại `routes/career.py:454-620`; `templates/_career_ai_widget.html` | Context chứa điểm, target/pin; tool chỉ tìm ngành và lấy chi tiết; hội thoại lưu trong `ChatConversation` theo `career_advisor`; có history/tool-round cap. Phụ thuộc Ollama và lời gọi HTTP timeout dài. Đây là hạng mục tùy chọn, không phải điều kiện để có phân tích không-AI. |
| Bảo vệ session AI | `routes/career.py:504-515,590-604` | Message/history có kiểm tra session hiện tại và sở hữu hội thoại; phần detail tra theo session_id rồi kiểm tra ownership sau khi query. Khi thiết kế mới phải luôn ràng buộc truy vấn theo user trước khi trả dữ liệu, không dựa vào UI guard. |

### 3.1. LearnPath hiện có (đã đối chiếu source)

- Hồ sơ: `backend/src/auth/authDb.js` (schema hiện tại v4, `user_profiles`), `backend/src/auth/userProfile.js`, `backend/src/routes/auth.js`, `frontend/src/pages/ThongTinCaNhan.jsx`.
- Các trường đã lưu: họ tên, lớp, trường, `diem_lop` (môn/điểm tự nhập), chứng chỉ, mục tiêu trường/ngành dạng text, tổ hợp 3 môn mong muốn, ghi chú tự do. Khảo sát onboarding dùng chung profile.
- API dữ liệu admission: `/api/diem-chuan`, `/api/diem-chuan/compare`, `/api/khoi-thi`, `/api/khoi-thi/:maKhoi` và school/block detail; đang bảo vệ bằng user session.
- `diem_chuan` hiện là dữ liệu tuyển sinh theo nhiều phương thức/thang điểm; schema có `ma_truong`, `nganh`, `to_hop_mon`, `diem_chuan`, `nam`, `phuong_thuc`. Có vấn đề coverage/mapping/năm và dữ liệu tổ hợp thiếu đã ghi trong `.agents/KNOWN_ISSUES.md`.
- LearnPath chưa có catalog ngành có khóa ổn định/nhóm ngành, trọng số năng lực từng ngành, điểm mục tiêu có cấu trúc liên kết một ngành, lịch sử ghim/so sánh, radar năng lực theo rubric hoặc trợ lý AI nghề nghiệp.
- Các giá trị `diem_lop` hiện không có kỳ/năm học, loại điểm, nguồn/xác minh hoặc quy ước môn canonical đầy đủ; `chung_chi` gộp các thang điểm khác nhau. Không được gộp thẳng các loại điểm/thang đo này vào một fit score.

## 4. Quy trình khảo sát còn lại (trước khi khóa đề xuất)

### Phase A — Hoàn tất inventory EduMindAI (read-only)

1. Rà tuyến đăng ký blueprint, điều kiện đăng nhập, xác định menu/điểm vào chức năng và luồng điều hướng.
2. Đọc hết các phần script tương tác của trang chính, browse, compare, map và widget AI; ghi input/output, trạng thái loading/empty/error, ràng buộc chọn, lưu session, hành vi di động.
3. Kiểm tra các route API còn lại sau phần đã khảo sát: validate query/body, sort/filter, giới hạn kết quả, xử lý lỗi, authorization và ownership.
4. Đọc định nghĩa model liên quan và mô tả seed/source; dùng văn bản/JSON nguồn được chọn lọc, tránh database/backup và secrets.
5. Lập sổ bằng chứng gồm đường dẫn + khoảng dòng, tách **quan sát được** khỏi **diễn giải/đề xuất**. Không chạy app hoặc script để chứng minh dữ liệu runtime.
6. Tìm tests liên quan để nhận diện hành vi có test và hành vi chỉ có trong code; không chạy test nếu có khả năng tác động database hoặc file nguồn.

### Phase B — Kiểm tra tính hợp lệ nghiệp vụ và dữ liệu

1. Lập bảng thuật toán fit: range/đơn vị đầu vào, cách xử lý môn thiếu, weight sum, min_score, điểm vượt ngưỡng, gap/status, tie-break/sort.
2. Đánh dấu mọi dữ liệu/hệ số mock, sinh ngẫu nhiên, không có nguồn hoặc chưa xác thực; xác định trường hợp các điểm chuẩn/khối khác scale.
3. Phân biệt rõ ba khái niệm: **năng lực học tập**, **mức đáp ứng rubric/ngưỡng ngành**, và **khả năng trúng tuyển dựa trên dữ liệu tuyển sinh**. Không diễn đạt fit heuristic thành xác suất.
4. Kiểm tra các bất biến/missing-data: profile trống, thiếu điểm môn trọng tâm, môn không cùng thang, ngành thiếu rubric, ngành thiếu năm/phương thức/khối, score zero/null.
5. Đề xuất bộ kiểm thử tính toán bằng các ca tổng hợp/fixture, không dùng hoặc thay đổi dữ liệu cá nhân/live DB nguồn.

### Phase C — Đối chiếu LearnPath và thiết kế đích

1. Lập ma trận khả năng **có sẵn / tái sử dụng / cần bổ sung / không nên port** trên từng năng lực.
2. Mô hình hóa kiến trúc LearnPath: frontend page/components, API client, Express routes, auth DB vs admission DB, quyền truy cập và luồng dữ liệu.
3. Đề xuất MVP theo hướng tận dụng dữ liệu đã có; tách các khả năng cần catalog/rubric chất lượng khỏi giao diện cơ bản.
4. Với mỗi thay đổi có thể cần, đánh dấu L1/L2/L3, schema/API/user data/dependency impact, backup/rollback và test tương ứng.
5. Viết các quyết định cần chủ sản phẩm trả lời (xem mục 7) và dừng trước mọi thay đổi L3 cho đến khi có xác nhận riêng.

### Phase D — Báo cáo và cổng duyệt

1. Hoàn thiện plan này với inventory đầy đủ, ma trận so sánh, kiến trúc đề xuất, ưu tiên/phase, acceptance criteria, risk, test plan và rollback.
2. Tự review: không nhầm thuật toán với sự thật tuyển sinh; không coi dữ liệu mock là thật; không bỏ sót quyền riêng tư/scope nguồn; các giả định phải được nêu rõ.
3. Trình người dùng xem và chốt quyết định. Chỉ sau khi được duyệt plan và scope triển khai mới bắt đầu làm tại LearnPath; schema/API/semantics/dependency L3 cần đồng ý riêng nếu chưa được plan chốt cụ thể.

## 5. Phương án nâng cấp LearnPath để xin duyệt (chưa phải quyết định)

### Phase 0 — Chốt định nghĩa sản phẩm và dữ liệu

- Quyết định “phân tích năng lực” chỉ phản ánh điểm học tập tự khai, hay bao gồm chứng chỉ/điểm thi; mỗi nguồn/thang điểm phải được tách biệt.
- Quyết định đơn vị so sánh tuyển sinh: từng `phuong_thuc` (THPT/HSA/TSA/V-ACT/SAT), năm tuyển sinh, khối tổ hợp, trường-ngành; không quy đổi thang điểm nếu chưa có phương pháp được duyệt.
- Chọn cách tạo catalog và rubric môn/ngưỡng: có nguồn dữ liệu có kiểm chứng/quy trình quản trị, hay chỉ cung cấp công cụ khám phá tuyển sinh trước. Không tự suy diễn trọng số ngành từ tên ngành hoặc mock seed.
- Chốt cách diễn đạt chỉ số: nếu dùng rubric heuristic, đặt tên là mức đáp ứng tham khảo, hiển thị công thức/độ đầy đủ dữ liệu và cảnh báo; không gọi là xác suất đậu.
- Chốt privacy, thời hạn lưu, quyền xóa/sửa dữ liệu năng lực và có/không lưu lịch sử phân tích/chat.

### Phase 1 — MVP an toàn, không thêm AI

- Tạo trang được bảo vệ, có thể là `/phan-tich-nang-luc`, tái sử dụng AuthContext, profile API và style/component hiện có.
- Đọc profile học sinh có sẵn và hiển thị mức độ hoàn thiện/nguồn/thời điểm cập nhật; khi thiếu dữ liệu giải thích cần bổ sung gì, không tự điền giá trị giả.
- Tạo luồng khám phá ngành theo dữ liệu LearnPath thật: từ khóa, trường, khối, phương thức xét tuyển và năm khi nguồn dữ liệu hỗ trợ chính xác; dùng API hiện hữu ở mức khả thi.
- Hiển thị các dòng điểm chuẩn và thông tin tổ hợp dưới dạng so sánh minh bạch theo đúng phương thức/thang điểm; công khai nếu trường/ngành/mã không join được hoặc tổ hợp trống.
- Không tính fit % cho đến khi rubric và semantic được duyệt; có thể cung cấp so khớp tổ hợp/ngành và checklist hồ sơ theo dữ liệu có thật.

### Phase 2 — Hồ sơ năng lực có cấu trúc (cần quyết định schema)

- Chỉ sau khi duyệt: bổ sung cấu trúc điểm theo môn, kỳ/năm, loại điểm, thang điểm, nguồn/ngày cập nhật; kiểm tra canonical subject names và validation range theo loại điểm.
- Cân nhắc giữ dữ liệu trong auth DB riêng, migration có backup và đường rollback; không đặt hồ sơ cá nhân trong admission DB.
- Giữ tương thích profile/survey cũ; định nghĩa chuyển đổi bảo toàn dữ liệu, không tự gán kỳ/năm hoặc diễn giải dữ liệu freestyle thành dữ liệu có cấu trúc.

### Phase 3 — So sánh/lưu mục tiêu/ngành quan tâm (cần quyết định schema/API)

- Lưu target/pinned theo khóa ngành ổn định và tiêu chí tuyển sinh cụ thể (trường, ngành, phương thức, khối, năm), không chỉ tên tự do.
- Cần quyết định danh tính composite cho một lựa chọn vì một ngành có thể có nhiều phương thức/khối/năm và điểm chuẩn khác nhau.
- Nếu thêm persistent pin/target/history, thiết kế migration auth schema, API ownership, giới hạn số lượng, xóa/anonymize và kiểm thử phân quyền.
- So sánh 2–4 lựa chọn: điểm chuẩn cùng scale/năm/method mới được đặt cạnh nhau; nếu khác scale phải phân nhóm, không vẽ radar chung gây hiểu nhầm.

### Phase 4 — Chỉ số fit/radar/mô phỏng (tùy rubric được duyệt)

- Viết đặc tả công thức trước code, có chủ sở hữu dữ liệu cho weights/minimums, explainability theo từng môn và phiên bản rubric.
- Không dùng điểm thiếu = 0 ngầm; trả trạng thái “chưa đủ dữ liệu” hoặc quy tắc đã duyệt.
- Không đưa điểm chuẩn tuyển sinh làm “năng lực”; nếu mô phỏng điểm thi đầu vào, gọi đúng là kịch bản điểm và so sánh đúng phương thức/khối/năm.
- Kiểm thử đơn vị cho biên, null/0, tổng weights, môn thiếu, scale khác nhau, dữ liệu ngành thiếu và thay đổi phiên bản rubric.

### Phase 5 — AI tư vấn (tùy chọn, triển khai riêng)

- Chỉ xét sau MVP và policy dữ liệu: consent, data minimization, retention, model/provider, timeout/cost/rate limit, prompt injection, logging/redaction và thông báo giới hạn.
- AI chỉ tổng hợp dữ liệu đã cấp quyền; truy vấn API có kiểm soát; không tự tạo điểm chuẩn, rubric hoặc cơ hội đậu; dẫn rõ nguồn và thời điểm.
- Tách chatbot khỏi logic quyết định; kết quả tính toán quan trọng phải do backend deterministic xử lý, không giao cho LLM.
- Nếu lưu hội thoại: ownership phải được enforce tại từng query; thiết kế xóa/export/retention và không đưa secrets/profile vượt nhu cầu vào prompt.

### Phase 6 — Kiểm thử, tài liệu và rollout

- Kiểm thử backend với auth DB tạm và fixture admission; frontend build; API smoke có phiên; kiểm tra 401/403/404/400/empty/loading/error/retry.
- Kiểm thử dữ liệu/profile bằng fixture tổng hợp; xác nhận `learnpath.db` và `auth.db` thật không bị thay đổi bởi test. Không chạy `npm run db:init` trên DB thật.
- Nếu migration được duyệt: backup ngoài repo, migration rehearsal trên bản copy, kiểm tra bảo toàn profile/session, restore drill và rollback rõ ràng.
- Cập nhật `.agents/ARCHITECTURE.md`, `.agents/TESTING.md`, `.agents/PROJECT_CONTEXT.md`, `.agents/KNOWN_ISSUES.md` nếu phát hiện vấn đề ngoài phạm vi, `README.md` và session log theo quy tắc repo.
- Không commit/push/PR nếu không được yêu cầu.

## 6. Ma trận sơ bộ EduMindAI → LearnPath

| Năng lực | EduMindAI | LearnPath hiện tại | Đề xuất/độ sẵn sàng |
|---|---|---|---|
| Hồ sơ điểm môn | Điểm có TX/GK/HK, học kỳ/năm, tính TB có điều kiện | Mảng môn/điểm tự khai, thiếu cấu trúc kỳ/loại | Tái sử dụng profile làm nguồn khởi đầu; cần chốt semantics trước phân tích số. |
| Chứng chỉ | Không phải trọng tâm của fit score đã khảo sát | Có chứng chỉ, thang đa dạng | Hiển thị riêng; không trộn vào thang 0–10. |
| Catalog ngành | Bảng riêng, groups, blocks, weights, điểm/lịch sử; một phần demo/mock | Chưa có bảng ngành độc lập; có các dòng điểm chuẩn tuyển sinh | Dùng admission rows thật cho tra cứu trước; catalog/rubric phải có nguồn đáng tin và duyệt riêng. |
| Mức phù hợp | Heuristic có weights/min_score; missing score = 0 | Chưa có | Không port công thức nguyên trạng; chỉ làm sau khi thống nhất rubric/missing data và thông điệp. |
| Target/pin | Quan hệ persistent theo student và major | Mục tiêu hồ sơ là text; không có pin ngành | Cần định danh lựa chọn tuyển sinh và quyết định auth schema/API. |
| Browse/filter/sort | Có nhiều filter và sort | Đã có filter điểm chuẩn, khối thi, tìm ngành/trường và compare score rows | Tái sử dụng luồng có sẵn, bổ sung điều hướng/UX sau khi xác định user story. |
| Compare | Tối đa 4 ngành; radar, weights, score history | So sánh 2–5 dòng điểm chuẩn | Tái sử dụng compare hiện có; không so sánh khác thang như thể tương đương. |
| Mô phỏng | Đổi scores và xếp lại theo fit heuristic | Chưa có | Để sau Phase 0/2/4; phải phân biệt mô phỏng điểm năng lực với điểm xét tuyển. |
| Bản đồ ngành | Force-directed map dựa trên vectors/rubric | Chưa có | Không phải MVP; phụ thuộc catalog/rubric chất lượng và kiểm tra khả năng dùng/performance. |
| AI tư vấn | Ollama + tool calling + hội thoại lưu DB | Chưa có career AI; có profile/khảo sát | Tùy chọn; không chép prompt/code, cần review privacy/security/cost và nguồn dữ liệu. |

## 7. Quyết định cần người dùng/chủ sản phẩm chốt

1. **Mục tiêu người dùng:** trang này ưu tiên chọn ngành theo điểm học bạ, khám phá dữ liệu tuyển sinh, hay lập kế hoạch cải thiện năng lực?
2. **Định nghĩa “năng lực”:** dùng điểm trên lớp tự khai, điểm thi thật/dự kiến, chứng chỉ, sở thích/định hướng, hay các nhóm tách biệt?
3. **Chất lượng rubric:** có nguồn đáng tin cho trọng số/ngưỡng năng lực theo ngành không? Nếu chưa có, đồng ý MVP không hiển thị fit %/radar chấm điểm chứ?
4. **Định nghĩa “phù hợp”:** chấp nhận chỉ số heuristic không có kiểm định không; nếu có, ai sở hữu công thức, phiên bản, missing-score policy và ngôn ngữ cảnh báo?
5. **Đối chiếu tuyển sinh:** so sánh bắt buộc cùng phương thức/năm/khối hay cho phép nhóm riêng? LearnPath có dữ liệu điểm chuẩn 2025 nhưng branding 2026 (KI-15) và coverage/mapping gaps; quyết định năm nào dùng.
6. **Mục tiêu/ghim:** cần lưu lâu dài không? Giới hạn bao nhiêu lựa chọn? Một lựa chọn gồm trường + ngành + method + block + year chứ?
7. **AI:** có muốn chatbot ngay trong scope không? Nếu có, model/provider, consent, retention, chi phí, logging và giới hạn tư vấn được duyệt thế nào?
8. **Schema/API:** đồng ý riêng nếu Phase 2–5 cần auth DB migration, persistent records, endpoint mới hoặc đổi response/contract không?
9. **Phân kỳ:** ưu tiên MVP khám phá dữ liệu admission, hay làm đầy đủ profile/rubric trước?

## 8. Rủi ro, giảm thiểu và điều kiện dừng

| Rủi ro | Mức | Giảm thiểu/điều kiện dừng |
|---|---|---|
| Dùng dữ liệu điểm chuẩn năm/phương thức/khối không tương thích | Cao | Không gộp/so sánh trực tiếp; chờ quyết định KI-15 và hiển thị nguồn, năm, method, scale. |
| Fit heuristic bị hiểu thành xác suất trúng tuyển | Cao | Không gọi xác suất; chưa có rubric xác thực thì không đưa fit %. |
| Điểm môn tự khai thiếu kỳ/nguồn/range, tên môn không chuẩn | Cao | Không tự suy diễn; chỉ tính sau khi chốt schema/validation/mapping. |
| Rubric ngành hoặc điểm chuẩn mock trong source demo | Cao | Không sao chép; mọi dữ liệu LearnPath phải có nguồn, xác minh và quy trình cập nhật. |
| Migration auth làm mất profile/session | Cao | Không migration nếu chưa được duyệt; backup, rehearsal trên bản copy, rollback. |
| Rò rỉ dữ liệu học sinh qua API/AI/history/cache/log | Cao | Authorization server-side, data minimization, no-store khi phù hợp, redaction, retention/deletion policy. |
| API data admission không đủ cho mọi use case catalog | Trung bình | Ưu tiên MVP trên endpoint hiện có; endpoint/catalog mới phải có impact map và contract tests. |
| Bản đồ/AI làm tăng bundle, latency hoặc chi phí | Trung bình | Không đưa vào MVP; lazy-load/timeout/rate limit/budget nếu được duyệt. |
| Thay đổi source EduMindAI vô ý | Cao | Source tree hiện dirty; chỉ đọc file code cần thiết, không chạm binary/uploads, không chạy app/scripts. |

Dừng và hỏi người dùng nếu source-of-truth dữ liệu mâu thuẫn, xuất hiện yêu cầu đổi thang/ý nghĩa điểm, cần schema/API/auth behavior/dependency, hoặc baseline LearnPath ngoài phạm vi thất bại.

## 9. Tiêu chí nghiệm thu của giai đoạn plan

- [ ] Inventory luồng UI, endpoints, models và thuật toán của EduMindAI có bằng chứng file/dòng đầy đủ.
- [ ] Các dữ liệu mock/thiếu nguồn và các điểm chưa kiểm chứng được đánh dấu rõ; không coi code hiện hữu là bằng chứng tính đúng.
- [ ] Ma trận LearnPath phân biệt được thành phần tái sử dụng với gap thực sự.
- [ ] Phương án chia MVP và phần nâng cao, nêu rõ dependency/DB/API/privacy/test/rollback.
- [ ] Danh sách quyết định mở đủ cụ thể để người dùng duyệt hoặc trả lời.
- [ ] Review xác nhận không có mã/dữ liệu/tài sản được sao chép từ EduMindAI và không có code LearnPath đã được triển khai.
- [ ] Source EduMindAI và DB LearnPath/auth DB không bị sửa bởi hoạt động khảo sát.

## 10. Nhật ký thay đổi và xác minh của plan

- File được tạo: `plans/edumind-career-guidance-upgrade.md`.
- Giai đoạn hiện tại chỉ tạo/chỉnh plan này; không sửa source LearnPath hay EduMindAI.
- Đã đọc lại toàn bộ plan và rà paths, phạm vi, dữ liệu demo, quyết định mở, rủi ro và checklist. `git diff --check` không báo lỗi whitespace; diff chỉ ghi nhận plan mới cùng trạng thái modified có sẵn của submodule `Source_demo (no copy)/EduMind-AI`.
- Đã chạy `git status --short` và `git log -1 --oneline` tại LearnPath; kết quả log: `b9ff63a update form and user info`. Không chạy build/test vì không có thay đổi code; không chạy app/script ở source tham khảo.
