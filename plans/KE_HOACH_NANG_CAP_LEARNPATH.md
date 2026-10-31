# Kế hoạch nâng cấp LearnPath — Mô-đun "Khám phá sở thích nghề nghiệp"

> **Nguồn ý tưởng:** `MBTI/MBTI.docx` (bản in 108 câu) + 4 ảnh `1793351*.jpg` (bảng chấm điểm & diễn giải) + `MBTI/noidung.md` (12 nguồn tham chiếu).
> **Đích đến:** `SANPHAM/LearnPath` — số hoá bộ câu hỏi thành một mô-đun có chấm điểm, diễn giải, lưu trữ có cấu trúc và liên kết với "Phân tích năng lực".
> **Trạng thái:** ĐÃ TRIỂN KHAI (2026-10-31) — P1–P6 và M-0 đã hoàn tất; 171/171 backend tests, frontend build pass, `learnpath.db` không đổi. Nguồn MBTI nằm tại `plans/MBTI/`. Sai lệch so với bản đề xuất: (1) thêm bảng `user_exam_scores` cho D10; (2) threshold M-0 được chặn ở 10 và phần dư phân bổ lại để giữ thang 0–10; (3) 2 rubric `entryScore > 30` bị loại. Xem `RUBRIC_CHANGELOG.md` và `.agents/PROJECT_STATUS.md`.
> **Ngày lập:** 2026-10-30 · **Phân loại dự kiến:** L2 → L3 (schema auth DB, hợp đồng API, nội dung hiển thị).

---

## 0. Tóm tắt một phút

LearnPath đã có vòng đời "khảo sát khởi đầu → hồ sơ → phân tích năng lực → chọn ngành", nhưng **chưa có chỗ nào đo sở thích nghề nghiệp**. Bộ câu hỏi trong `MBTI/` lấp đúng khoảng trống đó: 60 câu Holland/RIASEC (thang 1–5) và 48 câu lưỡng cực theo 4 cặp xu hướng (thang −2…+2).

Kế hoạch này biến bản in thành một mô-đun 4 lớp:

1. **Ngân hàng câu hỏi có phiên bản** (instrument v1, chỉ đọc) — để kết quả cũ luôn tái tạo được.
2. **Bài làm có lưu nháp** (attempt + responses) — 108 câu là quá dài để làm một mạch, nên chia 10 chặng, tự lưu, làm tiếp được.
3. **Kết quả có cấu trúc** (results) — 6 điểm RIASEC, 4 giá trị D, mã tham khảo, độ phủ, cùng phần diễn giải *thận trọng* và liên kết sang danh sách ngành.
4. **Lớp tổ hợp (§17, đã duyệt theo D9)** — ghép điểm học tập với sở thích để trả lời "ngành nào vừa sức vừa hợp", bằng **ba tỉ lệ tách biệt** (học lực · tính cách · tổng thể) thay vì một con số "tỉ lệ đỗ" không kiểm chứng được. Admin nhập dữ liệu toàn bộ trong mục "Cài đặt câu hỏi khảo sát" (`/admin_survey`, **không** tạo trang `/admin_interest` — D14).

Điểm mấu chốt về kỹ thuật: **khoá đảo chiều của từng câu** (câu lẻ đặt chữ cái thứ nhất ở "Trái", câu chẵn đặt ở "Phải") phải lưu theo từng item, không suy ra từ quy ước chung — nếu không, `D` sẽ ra sai dấu. Xem §2.4.

---

## 1. Mục tiêu và phạm vi

### 1.1. Mục tiêu

| # | Mục tiêu | Thước đo hoàn thành |
|---|---|---|
| G1 | Học sinh làm được toàn bộ 108 câu trên web, trên điện thoại, có lưu nháp | Làm lại sau khi tải lại trang vẫn còn đáp án đã chọn |
| G2 | Chấm điểm đúng hợp đồng nội dung đã xác minh (không làm tròn, không quy đổi ngầm) | 20+ unit test số học, gồm biên ±24 và ca "câu lẻ + câu chẵn cùng dấu" |
| G3 | Kết quả hiển thị trung thực: điểm thô, độ phủ, câu chưa trả lời, giới hạn diễn giải | Trang kết quả không có câu nào khẳng định "bạn là type X" hay "xác suất trúng tuyển" |
| G4 | Liên kết với ngành học qua **ba tỉ lệ tách biệt**, không gộp ngầm vào `fitPct` cũ | Ba tỉ lệ hiển thị cạnh nhau, có nhãn và công thức công khai |
| G5 | Admin quản trị nội dung, ánh xạ nhóm ngành, xem thống kê tổng hợp | Tab "Bộ câu hỏi sở thích" và "Thống kê sở thích" trong **Cài đặt câu hỏi khảo sát** (`/admin_survey`) hoạt động, có audit cho mọi thao tác ghi |
| G6 | Không phá vỡ gì đang chạy | `npm test` xanh, `npm run build` xanh, hash `learnpath.db` không đổi |
| G7 | (P6) Trả lời được "vừa sức vừa hợp" bằng số **đo được** trước, mô hình sau | `pBench`/`percentile` khớp tính tay trên fixture; mọi chỉ số `null` đều có `reason`; UI không có chuỗi "% đỗ" |

> Quy ước mã: `G1–G7` = mục tiêu (§1.1); `D1–D14` = quyết định (§4); `R1–R19` = rủi ro (§12); `M1–M23`, `M-0`, `M-A…M-F` = ca kiểm thử và pha thi công (§13, §17).

### 1.2. Trong phạm vi

**Chương sở thích (P0–P5):**
- **7 bảng mới cho chương sở thích** + 1 cột mới trên `users` (schema auth **v7**): 6 bảng lõi (`interest_instruments`, `interest_items`, `interest_attempts`, `interest_responses`, `interest_results`, `interest_group_weights`) + 1 bảng tuỳ chọn `interest_group_pairs` (mặc định tắt, D12). Vì D9 đã duyệt **v7 có 8 bảng** (thêm `career_match_config`, §5.2).
- Bộ API `/api/interest/*` (người dùng) và `/api/admin/interest/*` (quản trị).
- 3 trang người dùng, **không** tạo trang quản trị mới (mở rộng `SurveySettingsPanel` ở `/admin_survey`, D14), 1 API client, 1 module chấm điểm thuần.

**Chương tổ hợp điểm × sở thích (P6 — đã duyệt theo D9):**
- 4 endpoint mới: `/api/career/benchmark`, `/api/career/recommendations`, `/api/admin/career/match-config`, `/api/admin/interest/weights`; **không sửa** endpoint cũ.
- 1 bảng mới còn lại: `career_match_config` (gộp migration v7, D9 đã duyệt — không hoãn). `interest_group_weights` đã tạo ở chương sở thích.
- Module `career/match.js`: `pBench`, `P` (phân vị), `percentile`, `tinhCachFit`, `hocLucFit`, `diemVuotChuan`, `tongHopFit`, ma trận 3×2.
- UI: 3 thanh tỉ lệ + 3 vòng radar + ma trận 3×2; admin có tab "Trọng số tính cách" và tab "Tham số tổng thể".

- **Nhập liệu 108 câu ngay trong "Cài đặt câu hỏi khảo sát"** (`/admin_survey`, D14): thêm 2 tab mới (`InterestItemsTab`, `InterestStatsTab`) bên cạnh tab câu hỏi văn bản hiện có; import JSON all-or-nothing; **không** thêm `/admin_interest`; storage vẫn trong `interest_*` (schema v7).

- Cập nhật tài liệu `.agents/*` + `AGENTS.md`.

### 1.3. Ngoài phạm vi (ghi rõ để không bị kéo vào)

- **Không** sửa `MBTI.docx` trong kế hoạch này (nếu muốn bổ sung mục "Chấm điểm" vào bản in, đó là việc riêng, dùng `python-docx`, cần duyệt).
- **Không** sao chép câu hỏi/thang điểm/báo cáo chính thức của MBTI Step I/II. Bộ 48 câu trong docx là câu tự biên soạn; chỉ dùng nguồn [4]–[10] để *tổ chức chủ đề phản tư*.
- **Không** dự đoán trúng tuyển, không tính "xác suất đỗ", không gọi kết quả là "kiểm tra tâm lý".
- **Không** AI/LLM sinh diễn giải trong pha này.
- **Không** đụng `learnpath.db`, không rebuild, không đổi `npm run db:init`.
- **Không** commit/push.

---

## 2. Căn cứ nội dung đã xác minh

Phần này là **hợp đồng số học**. Mọi sai lệch ở đây làm sai toàn bộ kết quả, nên được ghi thành hằng số trong code và test.

### 2.1. Cấu trúc bài

| Phần | Nội dung | Số câu | Thang | Nhóm |
|---|---|---|---|---|
| 1 | Sở thích nghề nghiệp (Holland/RIASEC) | 60 | 1…5 (`Rất không thích` … `Rất thích`) | 6 nhóm × 10 câu, khối liền nhau |
| 2 | Tương tác và suy ngẫm (4 cặp xu hướng) | 48 | −2…+2 (`Rõ về trái` … `Rõ về phải`) | 4 cặp × 12 câu (6 chẵn + 6 lẻ) |
| — | Câu hỏi mở tuỳ chọn "Một tình huống có thể khiến tôi chọn khác" | 2–3 | văn bản tự do | không chấm điểm |

Thông tin đầu bài (lấy từ docx): `Họ và tên`, `Ngày làm`, `Giai đoạn học tập`, `Câu hỏi nghề nghiệp tôi muốn làm rõ`.
Hướng dẫn gốc cần hiển thị nguyên văn ở đầu bài: *"Làm lần lượt phần. Trả lời theo sở thích tự nhiên trong thời gian gần đây, thay vì điều bạn cho rằng một nghề mong đợi."*

### 2.2. Phần 1 — nhóm và điểm

| Nhóm | Câu | Tổng tối đa |
|---|---|---|
| R — Thực hành / Kỹ thuật | 01–10 | /50 |
| I — Nghiên cứu / Phân tích | 11–20 | /50 |
| A — Sáng tạo / Nghệ thuật | 21–30 | /50 |
| S — Hỗ trợ / Xã hội | 31–40 | /50 |
| E — Lãnh đạo / Kinh doanh | 41–50 | /50 |
| C — Tổ chức / Dữ liệu | 51–60 | /50 |

Quy tắc bắt buộc: **không có ngưỡng cắt**, xếp hạng cao→thấp, **giữ nguyên đồng điểm**, tô đậm 2–3 nhóm dẫn đầu, **câu chưa trả lời ≠ 0**.

> ⚠️ **Phát hiện khi đọc docx:** chỉ tiêu đề nhóm đầu tiên (`Thực hành và kỹ thuật`) là `Heading 2` và có mặt trong luồng đoạn văn. **Năm tiêu đề nhóm còn lại không tìm thấy** trong 122 đoạn văn — nội dung nhảy thẳng từ câu 10 sang câu 11. `AGENTS.md` nói chúng tồn tại dưới dạng đoạn thân bài; phần trích xuất thì không. Việc số hoá **phải tự bổ sung 6 nhãn nhóm** (bảng trên) và ghi rõ đây là nhãn do LearnPath đặt, không phải chữ trong bản in.

### 2.3. Phần 2 — bảng câu theo cặp

| Cặp | Chữ cái thứ nhất | Chẵn (6 câu) | Lẻ (6 câu) |
|---|---|---|---|
| E–I | E (Hướng ngoại) | 02 04 06 08 10 12 | 01 03 05 07 09 11 |
| S–N | S (Giác quan) | 14 16 18 20 22 24 | 13 15 17 19 21 23 |
| T–F | T (Lý trí) | 26 28 30 32 34 36 | 25 27 29 31 33 35 |
| J–P | J (Nguyên tắc) | 38 40 42 44 46 48 | 37 39 41 43 45 47 |

Công thức: `D = Σ(câu chẵn) − Σ(câu lẻ)`, mỗi tổng gồm 6 số hạng trong −2…+2 ⇒ **D ∈ [−24, +24]**.
`D > 0` nghiêng về chữ cái thứ nhất (E, S, T, J); `D < 0` nghiêng về chữ thứ hai (I, N, F, P); `D = 0` = **không nghiêng bên nào, giữ kết luận mở**.

Cách diễn đạt bắt buộc: `D` là **chênh lệch xu hướng trả lời**, **không phải điểm mạnh/yếu**, không phải "mức độ hướng ngoại".

### 2.4. 🔴 Khoá đảo chiều — lỗi dễ mắc nhất

Docx **không** đặt chữ cái thứ nhất ở cùng một phía cho mọi câu:

- **Câu lẻ:** chữ cái thứ nhất nằm ở **Trái** (vd 01 Trái = "Trao đổi với người khác để hình thành ý tưởng" → E).
- **Câu chẵn:** chữ cái thứ nhất nằm ở **Phải** (vd 02 Phải = "Gặp gỡ người khác sau ngày bận rộn" → E).

Đã kiểm tra đủ 48 câu, cả 4 cặp đều nhất quán theo quy luật này. Hệ quả số học:

```
giá trị lưu = −2…+2   (âm = Trái, dương = Phải, 0 = cân bằng)
D_cặp = Σ(6 câu chẵn) − Σ(6 câu lẻ)
```

Kiểm chứng: người thuần E trả Phải ở câu chẵn (+2×6 = +12) và Trái ở câu lẻ (−2×6 = −12) ⇒ `D = 12 − (−12) = +24` ✔. Người thuần I ra `−24` ✔. Người trả **cùng một phía** cho cả 12 câu ra `D = 0` — đây là ca test bắt buộc, vì nó chứng minh phép trừ đang hoạt động đúng.

⇒ **Thiết kế dữ liệu phải lưu `leftKey` / `rightKey` cho từng item** (vd `E`/`I`), không dùng biến toàn cục `if (chan) ... else ...`. Nếu admin sửa nội dung ở phiên bản sau, khoá vẫn đi theo câu.

### 2.5. Xung đột bản thảo (phải chốt trước khi nhập liệu)

`AGENTS.md` đã cảnh báo và tôi xác nhận lại:

| Nội dung | `MBTI.docx` | 4 ảnh JPG |
|---|---|---|
| 60 + 48 câu hỏi | ✅ | (không có) |
| Mục "Chấm điểm Phần 1/2" | ❌ | ✅ |
| Ký hiệu dẫn nguồn `[1]`–`[12]` | ❌ | ✅ |
| Bảng diễn giải Holland + 4 cặp | ❌ | ✅ |

⇒ Hai bản là hai nháp khác nhau. Kế hoạch này lấy **câu hỏi từ docx** và **hợp đồng chấm điểm từ JPG**, đúng như `AGENTS.md` mô tả. Việc hợp nhất hai bản thành một tài liệu in duy nhất là hạng mục riêng, cần người dùng quyết định bản nào thắng.

---

## 3. Đối chiếu LearnPath hiện tại

Đã đọc trực tiếp các tệp liên quan. Khoảng trống và điểm nối:

| Hạng mục | Hiện trạng (đã xác minh) | Hệ quả cho kế hoạch |
|---|---|---|
| Khảo sát | `survey_questions` chỉ có `text` / `textarea`; câu trả lời bị **ép thành chuỗi** `"Câu hỏi - Câu trả lời"` vào `user_profiles.khac` (`backend/src/auth/survey.js:254-288`) | Không tái dùng được cho 108 câu có thang điểm → cần bảng riêng, **không** nhét vào `khac` |
| Schema auth | `SCHEMA_VERSION = 6`, có `academic_scores`, `career_selections`, `career_rubrics`; migration tự backup (`authDb.js:341-496`) | Thêm **v7** theo đúng khuôn: bump hằng số, thêm nhánh migrate, cập nhật `verifySchema` |
| Chấm điểm năng lực | `calculateCareerFit()` trong `auth/career.js:210-230`; `fitPct` dựa trên ngưỡng rubric, có `coveragePct` | Có sẵn khuôn "điểm + độ phủ" để học theo. §17.5 **tính lại** công thức `hocLucFit` theo phân vị phân bố điểm thi (không chỉ đổi tên); giữ `legacyFitPct` + cờ `dataWarning` chỉ cho **đường cũ/legacy** (96 rubric khai môn lệch tổ hợp, §17.15 L2) |
| Trang phân tích | `/phan-tich-nang-luc` ← `/api/career/overview\|majors\|map-data` | Nơi hiển thị chỉ số sở thích cạnh `fitPct` |
| Admin | `/admin_home\|_user\|_survey\|_data\|_career\|_audit` (`AdminShell.jsx:25-62`) | **Không thêm route mới**; mở rộng `/admin_survey` bằng 2 tab mới cho 108 câu sở thích (D14); **lưu ý** `ARCHITECTURE.md` thiếu `/admin_career` → vá tài liệu luôn |
| Banner nhắc | `Layout.jsx:270-283` dựa vào `user.surveyCompleted` | Thêm nhắc riêng theo `interestCompleted`, không chồng lên banner cũ |
| Bundle | Main JS ~1.016 kB, đã cảnh báo >500 kB (KI-11) | Trang làm bài 108 câu phải `lazy()` |
| Lưu trữ | `sql.js` giữ cả file trong RAM, ghi lại toàn bộ khi mutate, **một tiến trình** (KI-22) | Bảng kết quả phải gọn; mỗi lần lưu nháp là một lần ghi file → debounce, gộp theo chặng |

---

## 4. Quyết định cần chốt (chặn triển khai)

| ID | Câu hỏi | Đề xuất mặc định | Mức |
|---|---|---|---|
| **D1** | Bản nào là chuẩn khi docx và JPG khác nhau? | Câu hỏi ← docx; chấm điểm ← JPG; giữ nguyên cả hai, không xoá bên nào | SP |
| **D2** | 108 câu này có phải do nhóm tự biên soạn và được phép số hoá/phát hành? | Xác nhận bằng văn bản; ghi nguồn "tự biên soạn" trong `source_note` của instrument | PL |
| **D3** | Bắt buộc trả lời đủ 108 câu mới cho xem kết quả? | **Không bắt buộc tuyệt đối**: cho nộp khi mỗi nhóm ≥ 8/10 và mỗi cặp đủ 12/12; nhóm/cặp thiếu bị đánh dấu "chưa đủ dữ liệu" và **không** xếp hạng | SP |
| **D4** | Câu chưa trả lời ở Phần 2 xử lý sao? | **Không** coi là 0 (0 = "cân bằng" là một câu trả lời thật) → `D = null`, trạng thái `thieu_du_lieu` | SP |
| **D5** | Có trộn sở thích vào điểm phù hợp ngành? | **Kết hợp có kiểm soát**: ba tỉ lệ riêng (`hocLucFit` · `tinhCachFit` · `tongHopFit`) công khai trọng số 0,6/0,4; không gộp ngầm. Nếu một tỉ lệ là `null`, `tongHopFit` cũng `null` (kèm cờ lý do) | SP |
| **D6** | Tên gọi trên UI | "Khám phá sở thích nghề nghiệp" + phụ đề "(Holland/RIASEC và 4 cặp xu hướng)". **Không** dùng chữ "MBTI" trên UI/danh mục công khai | PL |
| **D7** | Admin xem được kết quả cá nhân từng học sinh? | Mặc định chỉ **thống kê tổng hợp**; xem chi tiết phải bấm, có ghi audit `admin.interest.result.view` | PL |
| **D8** | Học sinh được xoá kết quả? | Có: `DELETE` bài của mình + "đặt lại" (xoá hết attempt, trả `interest_completed = 0`) | PL |
| **D9** | Có triển khai chương §17 (tổ hợp điểm × sở thích) không, hay chỉ dừng ở mô-đun sở thích? | **Đã duyệt — làm đủ M-A…M-F**: chương §17 nằm trong phạm vi, không còn "tuỳ chọn/mà chỉ sau khi duyệt". Thứ tự theo §17.14 | SP |
| **D10** | Lấy "điểm thi" từ đâu để tính `pBench`/`percentile`? | Thêm ô **"Điểm thi/dự kiến theo tổ hợp"** ở hồ sơ, `source = 'tự khai'`, có cảnh báo; **không** quy đổi từ điểm học bạ. Điểm này là `T_student` nên **ảnh hưởng cả `hocLucFit`** và `pBench`/`percentile` — UI phải ghi rõ là số tự khai (§17.7) | SP/L3 |
| **D11** | Hiển thị ba tỉ lệ cho lớp 10–11? | **Có, có điều kiện** — đây là "mức đáp ứng yêu cầu ngành", không phải xác suất đỗ. `hocLucFit` và `pBench` cần điểm thang 0–30 của tổ hợp thi; nếu học sinh chỉ có điểm học bạ thì `hocLucFit = null` (reason `thieu_diem_thi`), chỉ hiện `tinhCachFit` | SP |
| **D12** | Có dùng 4 cặp xu hướng (E/I, S/N, T/F, J/P) để tính `tinhCachFit`? | **Không**, mặc định tắt `interest_group_pairs`. Chỉ bật sau khi có kiểm định, và phải công khai | PL/SP |
| **D13** | Có duyệt pha **M-0** chuẩn hoá `edumind_rubrics.json` (L1–L5)? | **Đã duyệt — sửa đầy đủ L2/L3/L5, giữ L4 loại trừ**: (1) audit read-only → báo cáo; (2) sửa `edumind_rubrics.json` + re-seed có backup; (3) 5 bất biến + M20. Sau M-0: **143 rubric** tính được, 2 rubric `entryScore > 30` bị loại (guard L4), 0 rubric hợp lệ còn lỗi L2/L3/L5. L1 không sửa dữ liệu — thay bằng công thức phân vị §17.5 | L3 · PL |
| **D14** | Nhập 108 câu ở đâu trên giao diện quản trị? | **Ngay trong "Cài đặt câu hỏi khảo sát" hiện có** (`/admin_survey`, `SurveySettingsPanel.jsx`): thêm tab "Bộ câu hỏi sở thích" (item + **import JSON**) và "Thống kê sở thích". **Không** tạo `/admin_interest`, **không** nhét 108 câu vào `survey_questions` (text-only, câu trả lời bị ép thành chuỗi — Phụ lục B). Storage vẫn ở `interest_*` (schema v7) | SP |

*(SP = quyết định sản phẩm, PL = pháp lý/đạo đức, L3 = thay đổi hợp đồng.)*

> **Ghi chú D9/D13/D14 (đã chốt):** P6 làm đủ 6 pha M-A…M-F (không còn tuỳ chọn); M-0 sửa đầy đủ L2/L3/L5 (chỉ 2 rubric `entryScore > 30` bị loại theo L4); 108 câu nhập trực tiếp trong "Cài đặt câu hỏi khảo sát" (**không** có trang admin riêng). Đường ngắn nhất để có số liệu thật cho báo cáo vẫn là P0 (0,5) → M-A (1) — khoảng 1,5 ngày đã cho ra `pBench`/`percentile` đúng và kiểm chứng được, không cần chờ mô-đun sở thích. Nếu cần thêm một phát hiện "có sửa được dữ liệu thật hay không", làm **M-0** (1,5–2 ngày) song song.

---

## 5. Thiết kế dữ liệu — auth DB schema v7

### 5.1. Nguyên tắc

1. **Bất biến theo phiên bản**: mỗi `instrument` là một bộ câu đóng băng. Sửa nội dung ⇒ tạo version mới, không sửa version đã có kết quả.
2. **Lưu từng câu trả lời**, không lưu mỗi tổng — để tính lại, kiểm toán, và đổi thuật toán về sau.
3. **Tính lại được**: `results` lưu `algorithm_version` + snapshot điểm thô.
4. **Không có `NULL` mơ hồ**: câu chưa trả lời = **không có dòng** trong `interest_responses` (khác hẳn giá trị 0).
5. Tuân thủ kiểu hiện có: mốc thời gian `INTEGER` (epoch ms), `CHECK` cho enum, `TEXT` cho nội dung.

### 5.2. Bảng mới

```sql
-- 1. Bộ câu hỏi (instrument)
CREATE TABLE IF NOT EXISTS interest_instruments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL,              -- 'holland-pairs-v1'
  title         TEXT NOT NULL,              -- 'Khám phá sở thích nghề nghiệp'
  description   TEXT,
  version       INTEGER NOT NULL,           -- 1, 2, ...
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','archived')),
  source_note   TEXT,                       -- 'Câu hỏi tự biên soạn; chấm điểm theo hợp đồng nội bộ'
  disclaimer    TEXT,                       -- nguyên văn câu miễn trừ hiển thị ở trang kết quả
  part1_item_count INTEGER NOT NULL DEFAULT 60,
  part2_item_count INTEGER NOT NULL DEFAULT 48,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (code, version)
);

-- 2. Từng câu hỏi
CREATE TABLE IF NOT EXISTS interest_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER NOT NULL,
  part          TEXT NOT NULL CHECK (part IN ('riasec','pairs')),
  group_code    TEXT NOT NULL,              -- 'R','I','A','S','E','C','EI','SN','TF','JP'
  item_no       INTEGER NOT NULL,           -- Phần 1: 1..60 ; Phần 2: 1..48
  order_index   INTEGER NOT NULL,
  prompt_text   TEXT,                       -- Phần 1
  left_text     TEXT,                       -- Phần 2
  right_text    TEXT,                       -- Phần 2
  left_key      TEXT,                       -- 'E','I','S','N','T','F','J','P'
  right_key     TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  FOREIGN KEY (instrument_id) REFERENCES interest_instruments(id) ON DELETE CASCADE,
  UNIQUE (instrument_id, part, item_no)
);
CREATE INDEX IF NOT EXISTS idx_interest_items_order
  ON interest_items(instrument_id, part, order_index);

-- 3. Lượt làm bài
CREATE TABLE IF NOT EXISTS interest_attempts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL,
  instrument_id        INTEGER NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','submitted','abandoned')),
  giai_doan_hoc_tap    TEXT,
  cau_hoi_nghe_nghiep  TEXT,
  notes                TEXT,                -- JSON: [{afterItem, text}] cho 2–3 câu mở
  summary_text         TEXT,                -- bản đọc được dạng văn bản (yêu cầu brief ../nhap.txt)
  started_at           INTEGER NOT NULL,
  last_saved_at        INTEGER,
  submitted_at         INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (instrument_id) REFERENCES interest_instruments(id)
);
CREATE INDEX IF NOT EXISTS idx_interest_attempts_user
  ON interest_attempts(user_id, status);

-- 4. Câu trả lời
CREATE TABLE IF NOT EXISTS interest_responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id  INTEGER NOT NULL,
  item_id     INTEGER NOT NULL,
  value       INTEGER NOT NULL,             -- Phần 1: 1..5 ; Phần 2: -2..2
  answered_at INTEGER NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES interest_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES interest_items(id),
  UNIQUE (attempt_id, item_id)
);

-- 5. Kết quả đã chấm
CREATE TABLE IF NOT EXISTS interest_results (
  attempt_id        INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  instrument_id     INTEGER NOT NULL,
  algorithm_version TEXT NOT NULL,          -- 'holland-pairs/1.0.0'
  r REAL, i REAL, a REAL, s REAL, e REAL, c REAL,   -- điểm thô 0..50
  r_answered INTEGER, i_answered INTEGER, a_answered INTEGER,
  s_answered INTEGER, e_answered INTEGER, c_answered INTEGER,
  d_ei REAL, d_sn REAL, d_tf REAL, d_jp REAL,        -- -24..+24 hoặc NULL
  code TEXT,                                -- vd 'R-I-A' hoặc 'E|S|T|J' từng phần
  top_groups TEXT,                          -- JSON: ['R','I','A'] giữ cả đồng điểm
  ties TEXT,                                -- JSON mô tả đồng điểm
  completeness TEXT NOT NULL,               -- 'full' | 'partial'
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES interest_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_interest_results_user
  ON interest_results(user_id);

-- 6. Trọng số tính cách/sở thích cho từng nhóm ngành (admin sửa được)
CREATE TABLE IF NOT EXISTS interest_group_weights (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  major_group  TEXT NOT NULL UNIQUE,       -- khớp majorGroup trong edumind_rubrics.json
  w_r REAL NOT NULL, w_i REAL NOT NULL, w_a REAL NOT NULL,
  w_s REAL NOT NULL, w_e REAL NOT NULL, w_c REAL NOT NULL,
  note         TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  updated_at   INTEGER NOT NULL,
  CHECK (w_r >= 0 AND w_i >= 0 AND w_a >= 0 AND w_s >= 0 AND w_e >= 0 AND w_c >= 0),
  CHECK (ABS(w_r + w_i + w_a + w_s + w_e + w_c - 1) <= 0.001)
);

-- 6b. (tuỳ chọn, mặc định TẮT) trọng số 4 cặp xu hướng cho nhóm ngành
CREATE TABLE IF NOT EXISTS interest_group_pairs (
  major_group  TEXT PRIMARY KEY,
  w_e REAL NOT NULL, w_s REAL NOT NULL, w_t REAL NOT NULL, w_j REAL NOT NULL,
  note         TEXT,
  updated_at   INTEGER NOT NULL,
  CHECK (ABS(w_e + w_s + w_t + w_j - 1) <= 0.001)
);
```

Cột mới trên bảng có sẵn:

```sql
ALTER TABLE users ADD COLUMN interest_completed INTEGER NOT NULL DEFAULT 0;
```

Bảng cấu hình tham số §17.10 (cùng migration v7, để không phải mở v8):

```sql
CREATE TABLE IF NOT EXISTS career_match_config (
  key        TEXT PRIMARY KEY,
  value      REAL NOT NULL,
  note       TEXT,
  updated_at INTEGER NOT NULL
);
```

Seed mặc định: `w_hoc_luc=0.6`, `w_tinh_cach=0.4`, `matrix_hoc_luc_high=70`, `matrix_hoc_luc_low=50`, `matrix_tinh_cach=65`, `do_phu_min=80`, `hoc_luc_mode=0` (chi tiết §17.10).
Lưu ý: bảng này thuộc **luồng career**, không thuộc luồng interest; đặt ở đây chỉ vì gộp migration. Nếu D9 bị hoãn, bỏ bảng này khỏi v7 và thêm ở v8 sau — không ảnh hưởng phần sở thích.

### 5.3. Migration v6 → v7

Theo đúng khuôn `authDb.js` hiện có:

1. `SCHEMA_VERSION = 7`.
2. Thêm nhánh `if (version <= 6)` trong `migrateSchema()`: tạo 7 bảng interest + `career_match_config` + index + cột `users.interest_completed`.
3. `backupBeforeMigration(6)` chạy tự động (đã có sẵn cơ chế).
4. Cập nhật `verifySchema()`: thêm 7 bảng interest + `career_match_config` vào `requiredTables`, thêm `interest_completed` vào `requiredUserColumns`.
5. Seed instrument v1 từ `backend/src/data/interest_instrument_v1.json` **sau** migration, idempotent theo `(code, version)`.
6. Seed `interest_group_weights` mặc định (8 nhóm ngành × 6 RIASEC, §5.5) và `career_match_config`, `INSERT OR IGNORE`.

Rủi ro riêng: migration chạy khi server khởi động ⇒ nếu seed lỗi, DB đã ở v7 nhưng thiếu item. Vì vậy seed phải nằm **trong cùng transaction** với migration, và `verifySchema` phải kiểm tra thêm "instrument active tồn tại và đủ 60 + 48 item".

### 5.4. Định dạng seed

`backend/src/data/interest_instrument_v1.json`:

```json
{
  "code": "holland-pairs-v1",
  "title": "Khám phá sở thích nghề nghiệp",
  "version": 1,
  "status": "active",
  "part1": [
    { "itemNo": 1, "group": "R", "text": "Sửa một đồ dùng bị hỏng." },
    { "itemNo": 11, "group": "I", "text": "Tìm nguyên nhân của một hiện tượng tự nhiên." }
  ],
  "part2": [
    { "itemNo": 1, "pair": "EI", "left": "Trao đổi với người khác để hình thành ý tưởng.",
      "right": "Tự suy nghĩ trước khi trao đổi.", "leftKey": "E", "rightKey": "I" },
    { "itemNo": 2, "pair": "EI", "left": "Dành thời gian yên tĩnh sau ngày bận rộn.",
      "right": "Gặp gỡ người khác sau ngày bận rộn.", "leftKey": "I", "rightKey": "E" }
  ]
}
```

Bắt buộc: 60 dòng `part1` (mỗi nhóm đúng 10), 48 dòng `part2` (mỗi cặp đúng 12, 6 lẻ + 6 chẵn), `leftKey`/`rightKey` đúng cặp. Có test đọc file này và đối chiếu với bảng §2.3 — **test sẽ đỏ nếu ai đó gõ sai một số câu**.

### 5.5. Trọng số tính cách cho 8 nhóm ngành (mặc định, admin chỉnh được)

`major_group` **không phải nhóm do kế hoạch này tự đặt** — nó lấy đúng 8 giá trị đang có trong `backend/src/data/edumind_rubrics.json` (145 rubric):

| Nhóm ngành | Số rubric |
|---|---|
| Kỹ thuật - Công nghệ | 52 |
| Kinh tế - Quản trị | 31 |
| Xã hội - Nhân văn | 19 |
| Y Dược | 13 |
| Sư phạm | 11 |
| Nghệ thuật | 7 |
| Luật - Hành chính | 6 |
| Nông Lâm | 6 |

**Bảng trọng số RIASEC mặc định** (mỗi dòng cộng đúng 1,000):

| Nhóm ngành | R | I | A | S | E | C | Tổng |
|---|---|---|---|---|---|---|---|
| Kỹ thuật - Công nghệ | 0,35 | 0,35 | 0,05 | 0,03 | 0,07 | 0,15 | 1,00 |
| Kinh tế - Quản trị | 0,05 | 0,15 | 0,03 | 0,12 | 0,35 | 0,30 | 1,00 |
| Xã hội - Nhân văn | 0,03 | 0,14 | 0,28 | 0,32 | 0,18 | 0,05 | 1,00 |
| Y Dược | 0,18 | 0,32 | 0,03 | 0,30 | 0,05 | 0,12 | 1,00 |
| Sư phạm | 0,04 | 0,18 | 0,18 | 0,38 | 0,10 | 0,12 | 1,00 |
| Nghệ thuật | 0,05 | 0,10 | 0,50 | 0,18 | 0,14 | 0,03 | 1,00 |
| Luật - Hành chính | 0,04 | 0,17 | 0,06 | 0,18 | 0,30 | 0,25 | 1,00 |
| Nông Lâm | 0,38 | 0,30 | 0,04 | 0,08 | 0,06 | 0,14 | 1,00 |

**Căn cứ gán** (phải ghi trong `note` của từng dòng, không được giấu):

1. **Mô hình lục giác Holland** — các nhóm kề nhau (R–I, I–A, A–S, S–E, E–C, C–R) tương quan cao hơn nhóm đối diện. Vì vậy mỗi nhóm ngành luôn có ít nhất một trọng số "hàng xóm" đáng kể, không bao giờ chỉ có một đỉnh bằng 1,0.
2. **Bản chất công việc đặc trưng**: Kỹ thuật–Công nghệ nghiêng R+I; Kinh tế–Quản trị nghiêng E+C; Y Dược nghiêng I+S; Nghệ thuật có A cao nhất (0,50) vì đây là nhóm duy nhất mà sáng tạo là năng lực cốt lõi.
3. **Không dùng 4 cặp xu hướng để gán trọng số** ở bản mặc định — không có ánh xạ nào được kiểm định từ 4 cặp sang nhóm ngành. Xem D12.

**Giới hạn bắt buộc phải công khai:** đây là trọng số **do nhóm đề xuất** dựa trên mô hình Holland, **chưa được kiểm định** trên dữ liệu Việt Nam, chưa có nghiên cứu nào xác nhận. Không được trình bày như "chuẩn quốc tế" hay "theo O*NET". Trong báo cáo KHKT phải ghi: *"Trọng số do nhóm tự xây dựng từ mô tả nghề nghiệp; đây là giả thuyết cần kiểm chứng, không phải kết quả nghiên cứu."*

**Kiểm tra hợp lệ tự động** (chạy trong `npm test`):
- mỗi nhóm: `Σ weight = 1,000 ± 0,001`;
- mọi `majorGroup` trong `edumind_rubrics.json` đều có dòng trọng số (thiếu → `tinhCachFit = null`, không im lặng trả 0);
- không trọng số âm; không nhóm nào toàn 0.

---

## 6. Thuật toán chấm điểm

Module thuần: `backend/src/interest/scoring.js` — không truy cập DB, nhận `items` + `responses` và trả kết quả. Nhờ vậy test được bằng fixture.

```js
// interface
scoreAttempt({ instrument, items, responses }) -> {
  algorithmVersion, part1: {...}, part2: {...}, completeness, unansweredCount
}
```

### 6.1. Phần 1

```
với mỗi nhóm G trong {R,I,A,S,E,C}:
  itemsG   = 10 câu của G
  answered = các câu có response
  n        = answered.length
  sum      = Σ value(answered)           // 0 nếu n = 0
  maxReach = 5 * n
  status   = n === 10 ? 'complete' : n === 0 ? 'empty' : 'partial'
  mean     = n > 0 ? sum / n : null      // chỉ để so sánh phụ, có nhãn
```

- `sum` là **điểm chính** (0–50 khi đủ 10 câu).
- Hiển thị: `sum` khi `complete`; `sum` kèm `"/ (5×n)"` + nhãn "còn thiếu k câu" khi `partial`.
- **Xếp hạng chỉ trên các nhóm `complete`**. Nếu < 3 nhóm complete → không xếp hạng, hiện "Chưa đủ dữ liệu để xếp hạng".
- Đồng điểm: giữ hết. Nếu biên top-3 có đồng điểm, hiển thị tất cả kèm ghi chú *"có đồng điểm ở vị trí thứ 3"*.
- Câu chưa trả lời **không** bị coi là 0 và **không** bị nội suy.

### 6.2. Phần 2

```
với mỗi cặp P trong {EI, SN, TF, JP}:
  evenItems = 6 câu chẵn của P ; oddItems = 6 câu lẻ
  nếu mọi câu của P đều có response:
      D = Σ value(evenItems) − Σ value(oddItems)      // ∈ [-24, +24]
      status = 'complete'
  ngược lại:
      D = null ; status = 'thieu_du_lieu'
      // KHÔNG thay câu thiếu bằng 0
  kết luận:
      D > 0  -> chữ cái thứ nhất
      D < 0  -> chữ cái thứ hai
      D === 0 -> 'can_bang' (không gán chữ cái, giữ kết luận mở)
```

Hằng số câu theo cặp lấy từ `items`, **không hardcode trong scoring** — nhưng test thì phải hardcode để đối chiếu.

### 6.3. Mã tham khảo

- Phần 1: `top_groups` (2–3 nhóm) → hiển thị `R-I-A` (thứ tự điểm giảm dần).
- Phần 2: 4 chữ cái theo thứ tự `E/I`, `S/N`, `T/F`, `J/P`; cặp `can_bang` hoặc `null` hiển thị `?` (vd `E?TJ`).
- **Không** gọi đây là "type"; nhãn UI: *"Mã tham khảo (chỉ để trao đổi, không phải chẩn đoán)"*.

### 6.4. Bảng ca kiểm thử bắt buộc

| # | Fixture | Kỳ vọng |
|---|---|---|
| T1 | Tất cả Phần 1 = 5 | 6 nhóm đều 50, `complete` |
| T2 | Tất cả Phần 1 = 1 | 6 nhóm đều 10 |
| T3 | Nhóm R: 7 câu = 5, 3 câu bỏ trống | `sum = 35`, `n = 7`, `partial`; R **không** vào bảng xếp hạng (chỉ nhóm `complete` được xếp) |
| T4 | Nhóm I bỏ trống toàn bộ | `status = 'empty'`, `sum = 0` nhưng hiển thị "chưa có dữ liệu", không phải "0 điểm" |
| T5 | Phần 2: chẵn = +2 hết, lẻ = −2 hết | `D = +12 − (−12) = +24` cho cả 4 cặp, kết luận chữ thứ nhất |
| T6 | Phần 2: chẵn = −2 hết, lẻ = +2 hết | `D = −12 − (+12) = −24` cho cả 4 cặp, kết luận chữ thứ hai |
| T7 | Phần 2: mọi câu = +2 (cả chẵn và lẻ) | `D = 0` → `can_bang` ⬅ ca bắt lỗi dấu (người trả cùng một phía **không** được ra ±24) |
| T8 | Phần 2: mọi câu = 0 | `D = 0` |
| T9 | Cặp EI: chẵn = +1 hết, lẻ = −2 hết | `D = +6 − (−12) = +18` (kiểm tra tổng có trọng số, không chỉ giá trị biên) |
| T10 | Cặp SN thiếu 1 câu | `D = null`, `thieu_du_lieu`, 3 cặp còn lại vẫn tính |
| T11 | Đọc `interest_instrument_v1.json` | 60 item nhóm đúng 10/cụm, 48 item cặp đúng 6 lẻ + 6 chẵn, `leftKey`/`rightKey` khớp bảng §2.3 |
| T12 | Đồng điểm: R = I = 42, A = 40 | `top_groups` chứa R, I và có ghi chú đồng điểm |
| T13 | `D = 0` ở TF, các cặp khác đủ | mã hiển thị có `?` ở vị trí T/F |
| T14 | Nộp lại cùng attempt | Không nhân đôi `responses`, `results` ghi đè 1 dòng, `submitted_at` không đổi lần hai (idempotent) |

---

## 7. Hợp đồng API

Tất cả dưới `requireAuth` + `requirePasswordChanged`; admin dưới `requireAdmin` + `requireAdminCsrf` (không có ngoại lệ). Response theo khuôn hiện có `{ data, total? }`, lỗi `{ error }`.

### 7.1. Người dùng

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/interest/instrument` | Trả meta + items đang hoạt động của instrument `active`. Không trả `leftKey/rightKey` ra client (tránh lộ khoá chấm) |
| GET | `/api/interest/attempt` | Draft hiện tại (nếu có) + danh sách `responses` để khôi phục; nếu không có draft, trả `null` |
| POST | `/api/interest/attempt` | Tạo draft; nếu đã có draft thì **trả lại draft đó** (idempotent, `200`) |
| PATCH | `/api/interest/attempt/:id/responses` | Body `{ responses: [{ itemId, value }] }`, tối đa 30 dòng/lần. Chỉ draft của chính mình. `400` nếu `value` ngoài thang của `part` |
| POST | `/api/interest/attempt/:id/submit` | Chấm + lưu `interest_results`, `status='submitted'`, set `users.interest_completed = 1`, sinh `summary_text`. `409` nếu chưa đạt chính sách D3 |
| GET | `/api/interest/results/latest` | Kết quả mới nhất + payload diễn giải |
| GET | `/api/interest/results/:attemptId` | Chỉ chủ sở hữu, `404` nếu không phải của mình (không dùng `403` để tránh dò id) |
| DELETE | `/api/interest/attempt/:id` | Xoá draft **hoặc** kết quả của mình |
| POST | `/api/interest/reset` | Xoá toàn bộ attempt + results của mình, `interest_completed = 0` |

Payload kết quả (rút gọn):

```json
{
  "data": {
    "attemptId": 12,
    "submittedAt": 1793351698000,
    "algorithmVersion": "holland-pairs/1.0.0",
    "completeness": "partial",
    "unansweredCount": 4,
    "part1": {
      "groups": [
        { "code": "R", "label": "Thực hành / Kỹ thuật", "sum": 42, "answered": 10, "max": 50, "status": "complete" },
        { "code": "I", "label": "Nghiên cứu / Phân tích", "sum": 35, "answered": 8, "max": 40, "status": "partial" }
      ],
      "ranking": ["R", "I", "A"],
      "ties": [{ "rank": 3, "codes": ["A", "S"] }],
      "rankingAvailable": true
    },
    "part2": {
      "pairs": [
        { "code": "EI", "first": "E", "second": "I", "d": 12, "status": "complete", "lean": "E" },
        { "code": "TF", "first": "T", "second": "F", "d": null, "status": "thieu_du_lieu", "lean": null }
      ],
      "referenceCode": "ES?J"
    },
    "interpretation": {
      "themes": [ { "groupCode": "R", "title": "...", "prompts": ["..."] } ],
      "disclaimer": "Kết quả là điểm của một bộ câu hỏi tự biên soạn, chưa được kiểm định độ tin cậy/giá trị. Không dùng để chẩn đoán hay quyết định nghề nghiệp."
    }
  }
}
```

`interpretation` lấy từ bảng nội dung tĩnh (không sinh bằng AI), mỗi nhóm/cặp chỉ có **chủ đề phản tư + câu hỏi gợi mở**, không có mô tả "tính cách".

### 7.2. Quản trị

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/admin/interest/instruments` | Danh sách + trạng thái + số item |
| POST | `/api/admin/interest/instruments` | Tạo bản nháp (copy từ version khác được) |
| PUT | `/api/admin/interest/instruments/:id` | Chỉ sửa được khi `status='draft'` → `409` nếu đã `active`/`archived` |
| POST | `/api/admin/interest/instruments/:id/activate` | Archive version đang active (nếu khác), active version này. `400` nếu thiếu item |
| GET/PUT | `/api/admin/interest/instruments/:id/items` | Sửa hàng loạt item của bản nháp; validate đủ 60/48 và đúng cặp |
| POST | `/api/admin/interest/instruments/import` | Nhập 108 item từ JSON dán vào (hoặc tệp): parse transactionally, validate all-or-nothing; trả `400` kèm danh sách lỗi theo dòng; chỉ tạo bản `draft` |
| GET | `/api/admin/interest/weights` · PUT | CRUD `interest_group_weights` (8 nhóm × 6 RIASEC); validate tổng = 1; ghi audit |
| GET | `/api/admin/interest/results` | Tổng hợp: số lượt, phân bố nhóm dẫn đầu, tỉ lệ hoàn thành; `page/limit` |
| GET | `/api/admin/interest/results/:attemptId` | Chi tiết một lượt — **ghi audit** `admin.interest.result.view` |
| GET | `/api/admin/interest/results/export` | CSV (chỉ điểm số, không có họ tên) |

Audit cho mọi thao tác ghi: `admin.interest.instrument.create|update|activate|import`, `admin.interest.weights.update`.

> **Điểm nhập liệu (D14):** các endpoint §7.2 + §17.9 **không** đi kèm trang `/admin_interest`. Chúng được gọi từ 2 tab trong **Cài đặt câu hỏi khảo sát** (`/admin_survey` → `SurveySettingsPanel`). Endpoint `import` là đường nhập chính cho 108 câu.

---

## 8. Giao diện người dùng

### 8.1. Tuyến đường

| Route | Component (mới) | Ghi chú |
|---|---|---|
| `/kham-pha-so-thich` | `InterestLanding.jsx` | Giới thiệu, trạng thái (chưa làm / đang làm / đã có kết quả), nút Bắt đầu / Làm tiếp / Xem kết quả |
| `/kham-pha-so-thich/lam-bai` | `InterestRunner.jsx` (**lazy**) | Chạy 10 chặng, lưu nháp |
| `/kham-pha-so-thich/ket-qua` | `InterestResult.jsx` | Biểu đồ + diễn giải + in |

**Không có route quản trị mới** (D14). Dữ liệu cho 108 câu được nhập trong **panel hiện có** `/admin_survey` → "Cài đặt câu hỏi khảo sát" (`SurveySettingsPanel.jsx`), bằng 2 tab mới.

### 8.2. Luồng làm bài

```
Giới thiệu (mục đích, thời lượng ~12–15 phút, 108 câu, "không có đáp án đúng/sai",
             nhắc: trả lời theo sở thích tự nhiên gần đây)
   ↓ Bắt đầu
[Thông tin đầu bài]  Giai đoạn học tập · Câu hỏi nghề nghiệp muốn làm rõ
   ↓
Chặng 1..6   Phần 1, mỗi chặng 10 câu (một nhóm) — thang 1..5, nhãn chữ dưới số
Chặng 7..10  Phần 2, mỗi chặng 12 câu (một cặp) — hai phát biểu Trái/Phải,
             chọn −2…+2 bằng 5 nút, nhãn "Rõ về trái … Rõ về phải"
   ↓ (sau chặng 8 và chặng 9: ô ghi chú tuỳ chọn "Một tình huống có thể khiến tôi chọn khác")
[Màn rà soát]  đếm câu chưa trả lời theo từng chặng, bấm để nhảy tới
   ↓ Nộp
Trang kết quả
```

Quy tắc UX bắt buộc:

- **Tự lưu** khi rời chặng (debounce 800 ms) và khi `visibilitychange`/`beforeunload`; hiện "Đã lưu lúc HH:mm".
- **Không chặn** chuyển chặng; cho phép nhảy tới chặng bất kỳ.
- **Không** tự chọn giá trị mặc định cho câu chưa trả lời (kể cả 3 = trung lập) — đó là bịa dữ liệu.
- Bàn phím: `1..5` chọn, `←/→` di chuyển, `Enter` sang câu kế.
- A11y: mỗi câu là `fieldset` + `legend`; nhóm nút là `radiogroup`; tiến độ trong `aria-live="polite"`; không phân biệt chỉ bằng màu.
- Mobile: nút cao ≥ 44 px, hai phát biểu Phần 2 xếp dọc, không cắt chữ.
- Khôi phục: mở lại trang → hỏi "Tiếp tục bài đang làm?" kèm chặng đang dở.

### 8.3. Trang kết quả

Bố cục 4 khối:

1. **Độ phủ trước tiên**: "Đã trả lời 104/108 câu" + cảnh báo nếu `partial`.
2. **Phần 1**: 6 thanh điểm (thang 0–50) + biểu đồ radar lục giác (Recharts, đã có trong deps). Nhóm `partial` vẽ nét đứt + nhãn "thiếu dữ liệu". Nhãn nhóm dẫn đầu: *"Nhóm sở thích nổi bật"* (không dùng "điểm mạnh").
3. **Phần 2**: 4 thanh lưỡng cực từ −24 đến +24, vạch 0 ở giữa, chấm vị trí `D`; cặp `null` hiện "Chưa đủ dữ liệu". Kèm câu: *"D là chênh lệch xu hướng trả lời, không phải điểm mạnh hay mức độ của một phẩm chất."*
4. **Diễn giải + liên kết**: chủ đề phản tư cho 2–3 nhóm dẫn đầu, gợi ý nhóm ngành (§5.5) kèm nút "Xem ngành trong Phân tích năng lực", và khối miễn trừ + danh mục nguồn `[1]`–`[12]` rút gọn từ `noidung.md`.

Có `@media print` để in 1–2 trang A4 (đúng tinh thần bản in của docx).

### 8.4. Điểm nối vào hệ thống đang có

- `Layout.jsx`: thêm banner mảnh **dưới** banner khảo sát, chỉ hiện khi `user.surveyCompleted && !user.interestCompleted`; tối đa 1 lần/phiên (`sessionStorage`), có nút đóng.
- `ThongTinCaNhan.jsx`: thẻ "Sở thích nghề nghiệp" hiện `R-I-A` + ngày làm + nút làm lại.
- `PhanTichNangLuc.jsx`: thay nhãn "phù hợp X %" hiện tại bằng **ba tỉ lệ** — `hocLucFit` (công thức mới §17.5, **không** giữ số cũ), `tinhCachFit`, `tongHopFit`; thêm 3 vòng radar (§17.6c) và ma trận 3×2. **Không** đổi thứ tự sắp xếp mặc định; thêm lựa chọn sort "Theo tổng thể" (tuỳ chọn, tắt mặc định).
- `AdminOverview.jsx`: thêm ô đếm "Lượt làm sở thích".

---

## 9. Quản trị — nhập 108 câu ngay trong "Cài đặt câu hỏi khảo sát"

Theo **D14**, **không có trang `/admin_interest`**. `frontend/src/components/admin/SurveySettingsPanel.jsx` (hiện có, 576 dòng, chủ yếu 1 tab câu hỏi `text`/`textarea`) được tách thành panel **3 tab**, chỉ **thêm** component mới:

| Tab | Nội dung | Nguồn dữ liệu |
|---|---|---|
| **Câu hỏi khảo sát** (giữ nguyên) | CRUD câu hỏi văn bản hiện có, không đổi hành vi, không đổi bảng | `survey_questions` |
| **Bộ câu hỏi sở thích** (mới) | 108 item của instrument đang chọn: xem theo 10 khối, sửa tại chỗ, tạo bản nháp, **import JSON**, kích hoạt | `interest_instruments` + `interest_items` |
| **Thống kê sở thích** (mới) | Tổng lượt, tỉ lệ hoàn thành, phân bố nhóm dẫn đầu, xuất CSV ẩn danh, danh sách lượt gần đây | `interest_attempts` + `interest_results` |

Hai tab mới tách ra component riêng để tránh `SurveySettingsPanel.jsx` phình thành 1.500 dòng: `InterestItemsTab.jsx`, `InterestStatsTab.jsx`, dùng chung `Tabs` trong `@/components/ui`.

**Trọng số 8 × 6 RIASEC không nằm ở đây** — theo D14 chúng ở tab "Trọng số tính cách" của `/admin_career` (`CareerRubricsPanel.jsx`), một component dùng chung, một nơi sửa (§5.5, §17.9).

### 9.1. Tab "Bộ câu hỏi sở thích" — đường nhập liệu chính

Ba cách nhập, cùng ghi vào `interest_items` của một bản `draft`:

1. **Import JSON (đường nhập chính, dùng một lần cho 108 câu).** Ô `textarea` dán nội dung `interest_instrument_v1.json` (hoặc chọn tệp) → `POST .../instruments/import`. Validate trước khi ghi:
   - đúng 108 item: 60 câu Phần 1 (6 khối × 10) + 48 câu Phần 2 (4 cặp × 12);
   - mỗi item Phần 1 có `1 ≤ value ≤ 5`, Phần 2 có `−2 ≤ value ≤ 2`, số nguyên;
   - mỗi item Phần 2 có đúng `leftKey`/`rightKey` và `leftKey ≠ rightKey`;
   - đúng 6 chẵn + 6 lẻ mỗi cặp (kiểm tra `ordinal % 2`);
   - `order` liên tục 1…108, không trùng.
   
   Lỗi trả về **theo dòng** (`{ line, field, message }`) và **không ghi gì** (all-or-nothing trong transaction).
2. **Sửa từng item** trong bảng: `order`, `text`, `leftText/rightText`, `leftKey/rightKey`, bật/tắt. Chỉ khi `status = 'draft'`.
3. **Tạo bản nháp từ version khác** ("Tạo bản nháp từ v1") — copy toàn bộ item rồi sửa.

Quy tắc bắt buộc:

- **Không sửa được `active`/`archived`** → `409`, kèm gợi ý "Tạo bản nháp từ v1".
- **Kích hoạt** có `ConfirmDialog` nêu rõ: bản đang chạy bị archive, kết quả cũ vẫn giữ `instrument_id` cũ.
- **Không xoá** instrument đã có kết quả (chỉ archive).
- Mọi thao tác ghi đều có audit: `admin.interest.instrument.create|import|update|activate`.
- Sau khi import, tab hiện **đối chiếu nhanh**: "108/108 item · 60 Phần 1 · 48 Phần 2 · 24 chẵn/24 lẻ" để người nhập tự đối chiếu với hợp đồng §2.
- **`source_note` bắt buộc ghi "tự biên soạn"** trước khi cho `activate` (D2, §10) — nếu trống, chặn kích hoạt.

### 9.2. Tab "Thống kê sở thích"

- Tổng lượt, tỉ lệ hoàn thành, phân bố nhóm dẫn đầu (bar chart), bảng theo lớp/trường nếu có.
- Nút xuất CSV **chỉ có điểm số**, không có họ tên.
- Danh sách lượt gần đây (id + ngày + trạng thái); bấm mới xem chi tiết một lượt và **ghi audit** `admin.interest.result.view` (D7).

### 9.3. Vì sao UI nhập cùng panel nhưng dữ liệu ở bảng riêng

`survey_questions` chỉ có `text`/`textarea`; câu trả lời bị ép thành chuỗi `"Câu hỏi - Câu trả lời"` rồi nhét vào `user_profiles.khac`. Không có chỗ cho thang 1–5 hay −2…+2, không chấm lại được, không có version. UI nhập nằm chung trong `SurveySettingsPanel`, nhưng dữ liệu ở `interest_*` (schema v7) — xem Phụ lục B.

---

## 10. Nội dung, đạo đức và pháp lý

Đây không phải phần phụ — nó quyết định mô-đun có dùng được trong bài thi KHKT hay không.

| Yêu cầu | Cách thực hiện |
|---|---|
| Không nhận là công cụ đã kiểm định | `instrument.disclaimer` hiển thị ở đầu bài, cuối bài và trên trang kết quả: *"Bộ câu hỏi do nhóm tự biên soạn. Không có nguồn nào xác nhận độ tin cậy, giá trị hoặc hiệu quả của bộ câu hỏi này. Kết quả chỉ dùng để phản tư."* |
| Không mượn danh nghĩa MBTI/RIASEC chính thức | UI dùng "Holland/RIASEC" và "4 cặp xu hướng" làm *khung tham chiếu*; ghi rõ không phải MBTI Step I/II, không phải O*NET Interest Profiler |
| Không sao chép bản quyền | Không nhập câu hỏi/thang điểm/báo cáo chính thức. Nguồn [6] chỉ dùng để tổ chức *chủ đề phản tư* (20 khía cạnh), không trích nguyên văn |
| Không biến điểm thành phán quyết | `D` chỉ là chênh lệch xu hướng, không gán nhãn tính cách. Ba tỉ lệ phù hợp **được phép hiển thị** nhưng luôn kèm công thức, trọng số và câu "không phải xác suất trúng tuyển"; **cấm** mọi chuỗi ghép `%` với "đỗ"/"trúng tuyển"/"cơ hội" (§17.1, §17.12) |
| Không thay thế tư vấn | Câu chốt: *"Kết quả không thay thế tư vấn hướng nghiệp của giáo viên/chuyên gia."* |
| Quyền dữ liệu | Xem/xoá kết quả của mình; admin xem chi tiết phải có audit; CSV xuất không chứa họ tên |
| Đồng thuận | Trang giới thiệu nêu rõ dữ liệu được lưu vào hồ sơ và ai xem được; nút "Bắt đầu" là hành vi đồng thuận |
| Trích nguồn | Footer trang kết quả liệt kê [1]–[12] từ `noidung.md`, kèm ngày tra cứu 30/10/2026 |

---

## 11. Lộ trình triển khai

Ước lượng tương đối (1 người, đã quen codebase).

### P0 — Chốt quyết định & chuẩn bị (0,5 ngày)

- Chốt **D1–D14**. D9, D13, D14 đã chốt: P6 làm đủ M-A…M-F; M-0 sửa đầy đủ L2/L3/L5; 108 câu nhập trong "Cài đặt câu hỏi khảo sát". D12 vẫn gating `interest_group_pairs`. **D13 phải chốt trước M-0** (rubric audit là L3, sửa dữ liệu đang chạy).
- Sao lưu `backend/database/auth.db` ra ngoài repo trước mọi thử nghiệm.
- Tạo issue/ghi chú: thiếu 5 tiêu đề nhóm; `ARCHITECTURE.md` thiếu `/admin_career`.

### P1 — Nội dung & chấm điểm (1,5–2 ngày)

- Soạn `interest_instrument_v1.json` (108 câu, đúng chính tả, đúng `leftKey/rightKey`).
- `backend/src/interest/scoring.js` + `interpretation.js` (nội dung tĩnh).
- `backend/test/unit/interestScoring.test.js` phủ T1–T14.
- **Cổng ra:** `npm test` xanh, T11 xanh (chứng minh dữ liệu khớp hợp đồng).

### P2 — Schema v7 & API người dùng (2 ngày)

- Migration + `verifySchema` + seed trong transaction. Test migration v6→v7 trên DB tạm, có assert backup được tạo.
- Routes `interest.js` + mount trong `server.js` sau `requireAuth`.
- `frontend/src/lib/api.js`: thêm 9 hàm.
- Integration test: 401 khi chưa đăng nhập; validate `value`; idempotent submit; không đọc được kết quả người khác.

### P3 — Giao diện (2,5–3 ngày)

- 3 trang + 4 component con (`InterestProgress`, `LikertScale`, `BipolarScale`, `InterestChart`).
- Lazy-load runner; kiểm tra chunk riêng trong output build.
- Điểm nối: banner Layout, thẻ ở Thông tin cá nhân, nhãn ở Phân tích năng lực.
- Kiểm thử tay theo checklist §13.4 trên mobile + desktop.

### P4 — Quản trị & thống kê (1,5 ngày)

- Mở rộng `SurveySettingsPanel` thành 3 tab (D14): giữ tab câu hỏi văn bản, thêm `InterestItemsTab` (nhập 108 item + **import JSON**) và `InterestStatsTab` (thống kê).
- **Không** thêm route mới trong `AdminShell`/`App.jsx`; endpoint vẫn nằm ở §7.2.
- 10 endpoint quản trị §7.2 (thêm `POST .../instruments/import`) + audit.
- Nhập 108 câu từ `interest_instrument_v1.json` theo §9.1 (validate all-or-nothing).
- CSV export (không họ tên).

### P5 — Tài liệu, đo lường, bàn giao (1 ngày)

- Cập nhật `AGENTS.md` (schema v7, **10** trang người dùng — 7 trang cũ + 3 trang sở thích, admin route mới), `.agents/ARCHITECTURE.md`, `PROJECT_CONTEXT.md`, `TESTING.md`, `PROJECT_STATUS.md`, `KNOWN_ISSUES.md`, `README.md`.
- Đo: kích thước bundle trước/sau, thời gian ghi auth DB khi lưu nháp, `node .agents/scripts/inspect-db.js` để chứng minh admission DB không đổi.
- Báo cáo hoàn thành theo mẫu §7 `TESTING.md`.

**Tổng:** ~9–10 ngày làm việc cho mô-đun sở thích. Có thể cắt P4 nếu cần demo sớm (khi đó dùng seed mapping + không có thống kê admin).

### P6 — Tổ hợp điểm × sở thích (§17 — đã duyệt, làm đủ M-A…M-F)

Chia thành 7 việc **M-0, M-A…M-F** như bảng §17.14, tổng **~9,5–10,5 ngày**. Thứ tự:

- **M-0** (chuẩn hoá rubric) và **M-A** (`pBench`/`P`) chạy độc lập ngay, song song được.
- **M-B** (`tinhCachFit`) chỉ cần 6 điểm RIASEC từ P2 — độc lập với M-0.
- **M-C** (`hocLucFit` phân vị + `tongHopFit`) bị chặn bởi **M-A và M-B**; **M-0 không chặn** — không sửa rubric vẫn tính được 135/145, M-0 chỉ nâng lên 143.
- **M-D** (API) sau M-B; **M-E** (UI) sau M-C và P3; **M-F** (admin) độc lập, làm cuối.

`career_match_config` nằm trong migration v7 (D9 đã duyệt — không còn nhánh v8/v7 hoãn).

**Tổng cả hai chương:** ~18,5–20,5 ngày. Đường ngắn nhất để có số liệu thật cho báo cáo KHKT: **P0 (0,5) → M-A (1)** — khoảng 1,5 ngày đã cho ra `pBench`/`percentile` đúng và kiểm chứng được, không cần chờ mô-đun sở thích. Nếu cần thêm một phát hiện "có sửa được dữ liệu thật hay không", làm **M-0** (1,5–2 ngày) song song.

---

## 12. Rủi ro và giảm thiểu

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R1 | 108 câu gây mệt → dữ liệu rác (bấm bừa) | Cao | Chia 10 chặng, lưu nháp, hiện thời lượng ước tính, cho làm tiếp; không bắt buộc một mạch |
| R2 | Sai khoá đảo chiều → `D` sai dấu toàn bộ | Cao | Lưu `leftKey/rightKey` theo item; T7/T9/T11 chặn ở CI |
| R3 | Bị hiểu là "trắc nghiệm tâm lý đã kiểm định" | Cao | Disclaimer 3 chỗ, không dùng chữ "MBTI" trên UI, không có mô tả tính cách |
| R4 | Admin sửa item làm kết quả cũ không tái tạo được | Trung bình | Copy-on-write theo version; cấm sửa `active`/`archived` |
| R5 | Mỗi lần lưu nháp = ghi lại toàn bộ `auth.db` (sql.js) | Trung bình | Debounce 800 ms, gộp 10 câu/lần, không lưu từng câu; đo thời gian ghi ở P5 |
| R6 | Phình main bundle (KI-11) | Trung bình | `lazy()` runner + result; kiểm tra output build |
| R7 | Lộ kết quả cá nhân qua admin | Trung bình | Mặc định tổng hợp; xem chi tiết có audit; CSV ẩn danh |
| R8 | Nội dung 108 câu gõ sai so với bản in | Trung bình | T11 + rà soát thủ công 1 lượt có đối chiếu docx |
| R9 | D3 quá chặt khiến học sinh bỏ dở | Thấp | Ngưỡng 8/10 mỗi nhóm, cho nộp khi đã đủ phần lớn, hiện rõ phần còn thiếu |
| R10 | Migration lỗi giữa đường trên `auth.db` thật | Cao | Backup tự động trước migrate; chạy thử trên DB tạm; không xoá bản backup |
| R11 | Quét 1,13 M dòng mỗi request làm chậm `/recommendations` | Trung bình | Cache LRU histogram theo `(combo, year)`, TTL 10 phút; đo ở M-A; nếu > 1 s mới cân nhắc precompute (L3) |
| R12 | Người dùng hiểu `tongHopFit` là xác suất đỗ | Cao | Bảng câu chữ §17.12 là bắt buộc; tooltip công thức 60/40 ở mọi chỗ hiển thị; test UI không có chuỗi `%` gắn với "đỗ" |
| R13 | `tinhCachFit` cao nhưng dựa trên instrument + trọng số chưa kiểm định, bị dùng như kết luận | Cao | Nhãn "chỉ báo khám phá"; chỉ Phần 1 tham gia tính; công khai 8×6 trọng số; không đưa vào kết luận tuyển sinh |
| R14 | Điểm chuẩn 2025 bị hiểu là năm hiện tại (KI-15) | Trung bình | Mọi nhãn ghi "2025"; không dùng cụm "năm nay" |
| R15 | Trọng số tính cách tự đặt bị hiểu là "chuẩn khoa học" | Cao | Ghi rõ "giả thuyết của nhóm" trong §5.5, UI admin, và báo cáo; cho admin sửa + audit |
| R16 | Thay công thức `hocLucFit` làm thay đổi kết quả đang hiển thị | Cao | Thông báo trước; giữ `legacyFitPct` trong DB để so sánh; ghi `PROJECT_STATUS.md` |
| R17 | Rubric khai môn sai so với tổ hợp → `legacyFitPct`/`calculateCareerFit` và phần "môn quan trọng" ở admin hiển thị sai | Trung bình | M-0 L2 (**bắt buộc theo D13**): sửa môn theo block, phân bổ lại `weight`, ghi `RUBRIC_CHANGELOG.md`; không im lặng tính. `hocLucFit` mới **không** bị ảnh hưởng vì chỉ dùng tổng thô 3 môn của tổ hợp |
| R18 | `threshold` bão hoà làm `hocLucFit` gần như hằng số (§17.15) | Cao | M-0 L1: đổi sang phân vị; test M18 đo mức giảm; `dataWarning` cho rubric chưa audit |
| R19 | Dùng nhầm `pBench` (đuôi trên) thay `P` (đuôi dưới) → đảo thứ hạng | Cao | §17.2 ghi rõ hai đại lượng nghịch đảo; M13 kiểm tra đơn điệu hai chiều |

---

## 13. Kiểm thử

### 13.1. Tự động

```bash
cd backend && npm test        # kỳ vọng: 101 + ~20 test sở thích + **28** test §17, tất cả xanh
cd frontend && npm run build  # kỳ vọng: build xanh, có chunk InterestRunner riêng
```

Bổ sung vào `backend/test/`:

| File | Nội dung |
|---|---|
| `unit/interestScoring.test.js` | T1–T14 |
| `unit/interestInstrument.test.js` | T11 + kiểm tra `leftKey/rightKey` toàn bộ 48 câu |
| `db/authDb.test.js` (mở rộng) | Migration v6→v7, bảng mới, cột `interest_completed`, backup được tạo, `verifySchema` từ chối DB v7 thiếu item |
| `integration/interest.test.js` | 401/400/404/409; draft → PATCH → submit; idempotent; chéo user không đọc được; reset xoá sạch |
| `integration/adminInterest.test.js` | CSRF bắt buộc; không sửa được bản `active`; activate archive bản cũ; audit ghi đúng action; export không có họ tên |
| `unit/careerMatch.test.js` | M1–M8, M13, M17–M19, M21–M23 (thuật toán thuần, fixture) |
| `unit/rubricInvariants.test.js` | **5** bất biến M-0 §17.15.1 (3 nhóm A + 2 nhóm B) + M20 (chạy trên `edumind_rubrics.json`, **đỏ trước M-0**, xanh sau khi sửa) |
| `integration/careerRecommendations.test.js` | M9–M12, M14–M16 (cần DB tạm + user giả lập) |

### 13.2. Dữ liệu / an toàn

```powershell
Get-FileHash backend/database/learnpath.db -Algorithm SHA256   # trước và sau: phải bằng nhau
node .agents/scripts/inspect-db.js                              # xác nhận số liệu admission không đổi
```

- Mọi test dùng `LEARNPATH_AUTH_DB_PATH` trỏ tệp tạm; **không** tạo tài khoản thử trong `auth.db` thật.
- Không chạy `npm run db:init`.

### 13.3. API smoke (sau khi có session)

```powershell
Invoke-RestMethod "$base/api/interest/instrument" -WebSession $session
Invoke-RestMethod "$base/api/interest/attempt" -Method Post -WebSession $session
Invoke-RestMethod "$base/api/interest/attempt/$id/responses" -Method Patch -WebSession $session `
  -ContentType 'application/json' -Body (@{ responses = @(@{ itemId = 1; value = 5 }) } | ConvertTo-Json -Depth 5)
Invoke-RestMethod "$base/api/interest/attempt/$id/submit" -Method Post -WebSession $session
Invoke-RestMethod "$base/api/interest/results/latest" -WebSession $session
```

Kỳ vọng: `400` khi `value = 6` ở Phần 1 hoặc `value = 3` ở Phần 2; `409` khi chưa đạt D3; `200` + `part1.groups.length === 6`.

**P6 — tổ hợp điểm × sở thích (sau M-A…M-C):**

```powershell
Invoke-RestMethod "$base/api/career/benchmark?combo=A00&score=25.3" -WebSession $session
Invoke-RestMethod "$base/api/career/recommendations?classLevel=12&sort=tongHop_desc&limit=10" -WebSession $session
```

Kỳ vọng: `benchmark` trả `pBench` + `percentile` + `zScore` + `n`, và `percentile + pBench×100 ≈ 100`; `combo` ngoài whitelist → `400`; `score` ngoài 0–30 → `400`. `recommendations` trả đủ `hocLucFit`/`tinhCachFit`/`tongHopFit`, mọi `null` có `reasons`; khi chưa có điểm thi, `hocLucFit = null` + `thieu_diem_thi` (không rơi về 0).

### 13.4. Checklist tay

- [ ] Vào `/kham-pha-so-thich` khi chưa đăng nhập → chuyển `/dang-nhap?redirect=...`, sau đăng nhập quay lại đúng trang.
- [ ] Làm 3 chặng, tải lại trang → hỏi tiếp tục, đáp án còn nguyên, đúng chặng.
- [ ] Bỏ trống vài câu → màn rà soát đếm đúng, bấm vào nhảy đúng chặng.
- [ ] Nộp khi thiếu (dưới ngưỡng D3) → thông báo rõ, không mất dữ liệu.
- [ ] Kết quả: nhóm `partial` vẽ nét đứt + nhãn thiếu dữ liệu; không xuất hiện trong bảng xếp hạng.
- [ ] Cặp có câu thiếu → `D` hiện "Chưa đủ dữ liệu", **không** hiện 0.
- [ ] Không tìm thấy chữ "MBTI" ở bất kỳ đâu trên UI công khai.
- [ ] Disclaimer xuất hiện ở đầu bài, cuối bài, trang kết quả.
- [ ] In trang kết quả ra PDF: không cắt thanh điểm, không mất footer nguồn.
- [ ] Mobile 360 px: nút bấm đủ lớn, hai phát biểu Phần 2 không bị cắt.
- [ ] Bàn phím: chỉ dùng phím số + Tab đi hết một chặng.
- [ ] Banner nhắc chỉ hiện sau khi đã xong khảo sát khởi đầu; đóng rồi không hiện lại trong phiên.
- [ ] `/admin_survey` → tab "Bộ câu hỏi sở thích": **import JSON** 108 câu phải trả `400` khi thiếu/thừa item hoặc sai `leftKey/rightKey` và **không ghi gì**; sau import hiện "108/108 · 60 · 48 · 24/24". Sửa bản `active` bị chặn; tạo bản nháp được; kích hoạt có xác nhận; audit có dòng tương ứng.
- [ ] `/phan-tich-nang-luc`: nhãn sở thích hiện đúng, thứ tự mặc định **không** đổi.
- [ ] Xoá kết quả → `interestCompleted = false`, banner xuất hiện lại.
- [ ] `/phan-tich-nang-luc`: ba tỉ lệ luôn xuất hiện **cùng nhau**; tỉ lệ `null` hiện "—" + lý do, **không** vẽ vòng bán kính 0 và **không** thay bằng 0.
- [ ] Radar: ba vòng đồng tâm đúng bán kính; `tongHopFit` nét đứt; legend có công thức 60/40.
- [ ] Đổi `w_hoc_luc`/`w_tinh_cach` trong admin → `tongHopFit` đổi theo, audit có dòng `match_config.update`; đặt `hoc_luc_mode = 1` → UI ghi rõ "chế độ cũ".
- [ ] Không chuỗi nào trên UI ghép `%` với "đỗ"/"trúng tuyển"/"cơ hội".

---

## 14. Rollback

| Tình huống | Cách lùi |
|---|---|
| Migration v7 lỗi trên `auth.db` thật | Dừng server, khôi phục `auth.db.v6-backup-<timestamp>` (tự sinh), xoá cột/bảng mới không cần thiết vì bản backup đã sạch |
| P3/P4 chậm, cần demo | Tắt route bằng cách bỏ 3 dòng `<Route>`; API và schema giữ nguyên, không ảnh hưởng trang khác |
| Điểm số sai sau khi phát hành | Sửa `scoring.js`, tăng `algorithm_version`, viết script chấm lại từ `interest_responses` (dữ liệu thô vẫn còn) — không cần hỏi lại học sinh |
| Nội dung câu bị sai chính tả | Tạo instrument v2 (copy + sửa), activate; kết quả cũ vẫn trỏ v1 |
| Không muốn giữ tính năng | `DELETE` route + archive instrument; **không** xoá bảng (giữ dữ liệu cho báo cáo KHKT) |
| M-0 re-seed rubric sai | Khôi phục `auth.db` từ bản backup tự sinh trước re-seed (`auth.db.pre-m0-<timestamp>`); `RESEED` chỉ chạy được khi có bản backup đó. `learnpath.db` không bị đụng nên luôn sạch |
| Công thức `hocLucFit` mới cho kết quả bất thường | Đặt `hoc_luc_mode = 1` trong `career_match_config` để quay lại `legacyFitPct` (không cần deploy lại); UI phải ghi rõ "chế độ cũ". Đây là lùi tạm, không phải giải pháp lâu dài |

---

## 15. Tài liệu cần cập nhật

| Tệp | Nội dung |
|---|---|
| `AGENTS.md` (LearnPath) | schema **v7**, **10** trang người dùng (7 cũ + 3 sở thích), `/admin_survey` mở rộng 3 tab (không có `/admin_interest`), bảng nhanh về mô-đun sở thích; 4 endpoint mới của §17 |
| `.agents/ARCHITECTURE.md` | 8 bảng mới (**6 bảng lõi interest**, đã gồm `interest_group_weights`, + `interest_group_pairs` tuỳ chọn + `career_match_config`), ~20 endpoint, 3 route UI, công thức §17.2–§17.6; **vá luôn** thiếu `/admin_career` |
| `.agents/PROJECT_CONTEXT.md` | dòng mới trong bảng Features; ghi rõ **ba tỉ lệ** thay cho `fitPct` cũ, `hocLucFit` dùng phân vị `P` (không phải `pBench`), và định nghĩa `pBench` vs "tỉ lệ đỗ" |
| `.agents/TESTING.md` | mục 2.8 "Interest smoke", mục 2.9 "Career match smoke", cập nhật số test kỳ vọng |
| `.agents/KNOWN_ISSUES.md` | KI mới: docx thiếu 5 tiêu đề nhóm; KI mới: `ARCHITECTURE.md` thiếu route admin; KI mới: không có chỉ tiêu/nguyện vọng ⇒ không thể tính xác suất trúng tuyển (§17.1) |
| `.agents/PROJECT_STATUS.md` | dòng phiên làm việc `v1.2.0-interest` và `v1.3.0-career-match` |
| `README.md` | mô tả tính năng cho người dùng cuối, kèm câu chữ §17.12 |
| `MBTI/AGENTS.md` | ghi chú rằng bản số hoá đã tồn tại và trỏ tới kế hoạch này |

---

## 16. Định nghĩa hoàn thành

- [ ] D1–D14 đã chốt và ghi lại trong tài liệu.
- [ ] `npm test` xanh, có ≥ 20 test mô-đun sở thích (+ **28 test §17**: 23 ca M1–M23 + 5 bất biến M-0).
- [ ] `npm run build` xanh; `InterestRunner` nằm trong chunk riêng.
- [ ] Migration v6→v7 chạy được trên DB tạm, có backup, `verifySchema` chặt.
- [ ] Hash `learnpath.db` không đổi; `auth.db` thật không bị dùng để test.
- [ ] Checklist §13.4 tick đủ.
- [ ] Disclaimer xuất hiện đúng 3 chỗ; không có chữ "MBTI" trên UI công khai.
- [ ] Không tồn tại chuỗi UI nào gắn `%` với "đỗ"/"trúng tuyển"; mọi `null` có `reasons`; chú thích công thức 60/40 có ở mọi chỗ hiển thị `tongHopFit`.
- [ ] Ba tỉ lệ hiển thị cùng nhau; `null` không bị vẽ thành 0 trên radar hay thanh.
- [ ] `hocLucFit` dùng công thức phân vị `P` (§17.5), **không** dùng `pBench`; test M18 chứng minh giảm bão hoà (tại 7,0 mỗi môn: trung vị 94 → **77**; số rubric ≥ 95 % 71 → **33**), M19 chứng minh phân biệt được ngành. M13 cũ (`hocLucFit == fitPct`) **không còn áp dụng**.
- [ ] Không có nhóm ngành nào trong `edumind_rubrics.json` bị thiếu dòng `interest_group_weights`.
- [ ] Không có `catch (e) {}`; mọi lỗi có thông báo tiếng Việt + log.
- [ ] Tài liệu §15 đã cập nhật.
- [ ] Không commit/push (trừ khi được yêu cầu).

---

## 17. Thuật toán tổ hợp: "vừa sức" × "vừa hợp"

> Chương này trả lời câu hỏi *"có thuật toán nào nói lên tỉ lệ đỗ và mức phù hợp đại học, kết hợp điểm số với bài kiểm tra tính cách không?"*
> **Câu trả lời ngắn:** có, nhưng phải tách thành **ba tỉ lệ phù hợp** (học lực · tính cách · tổng thể) cộng **hai đại lượng tham chiếu đo được** (`pBench`, `percentile`). Chỉ hai đại lượng tham chiếu là số liệu thực nghiệm thuần; ba tỉ lệ là mô hình có giả định, phải công khai giả định và **không được gọi là "tỉ lệ đỗ"**.

### 17.0. Ba tỉ lệ phù hợp + hai đại lượng tham chiếu

Mô hình có **ba tỉ lệ** hiển thị cho người dùng và **hai đại lượng** chỉ dùng làm bằng chứng phụ:

| | Đại lượng | Bản chất | Nguồn | Là "tỉ lệ đỗ"? |
|---|---|---|---|---|
| **A** | `pBench` — tỉ lệ thí sinh toàn quốc đạt tổng ≥ ngưỡng X ở tổ hợp C | **Đo được**, thực nghiệm | `diem_thi_thptqg` (1.131.975 thí sinh) | Không — là tỉ lệ *đạt mốc điểm* |
| **B** | `percentile`, `zScore` — vị trí trong phân bố tổ hợp C | **Đo được** | như trên | Không |
| **C** | **`hocLucFit`** — tỉ lệ phù hợp **học lực** (%) | **Mới** — phân vị so với phân bố toàn quốc: `100 × min(P_student / P_entry, 1)`; `fitPct` cũ chỉ làm tham chiếu, có cờ `legacyFitPct` | `academic_scores` + `diem_chuan` (`entryScore`) + `diem_thi_thptqg` (phân bố) | Không |
| **D** | **`tinhCachFit`** — tỉ lệ phù hợp **tính cách/sở thích** (%) | **Heuristic** từ instrument tự biên soạn + trọng số nhóm ngành do nhóm xây dựng | §6 + `interest_group_weights` | Không |
| **E** | **`tongHopFit`** — tỉ lệ phù hợp **tổng thể** (%) | **Mô hình**: trung bình có trọng số của C và D | C + D + `career_match_config` | **Tuyệt đối không** |

Ba tỉ lệ C–D–E là **ba thang riêng**, cùng đơn vị % nhưng khác bản chất, và **không được gộp lại thành một con số duy nhất khác** ngoài E (E vốn đã là tổng hợp, có công thức công khai).

Quan hệ bắt buộc:

```
hocLucFit   = 100 × min(P_student / P_entry, 1)              → §17.5   (công thức mới; `fitPct` cũ giữ trong `legacyFitPct`, gắn cờ deprecated)
tinhCachFit = 100 × (khớp RIASEC với trọng số ngành) → §17.4   (mới)
tongHopFit  = 100 × (w_h·hocLucFit + w_c·tinhCachFit) / (w_h + w_c)  → §17.6  (mới)
```

**Không có tỉ lệ nào tên "tỉ lệ đỗ".** Lý do: nếu gộp thành "78% đỗ", con số đó không kiểm chứng được với bất kỳ ai và biến một dự án KHKT trung thực thành một lời hứa không có cơ sở. Còn khi tách: "90% thí sinh toàn quốc có tổng A00 thấp hơn em" là câu **đúng và kiểm tra được**; "em có 78% cơ hội đỗ" là câu **không**. Ba tỉ lệ phù hợp là *so với yêu cầu của ngành*, không phải *so với người khác* — hai câu hỏi khác nhau, nên phải hiển thị khác nhau.

**Trọng số tính cách ≠ trọng số điểm thi.** `career_rubric_subjects.weight` (tổng = 1, theo môn) mô tả *ngành này coi trọng môn nào*. `interest_group_weights` (tổng = 1, theo 6 nhóm RIASEC) mô tả *ngành này coi trọng kiểu sở thích nào*. Hai bảng khác nhau, hai không gian khác nhau, không bao giờ cộng chéo vào cùng một vector. Chúng chỉ gặp nhau **một lần duy nhất** ở `tongHopFit`, dưới dạng hai tỉ lệ độc lập.

### 17.1. Vì sao không thể tính "tỉ lệ đỗ" thật

Muốn có xác suất trúng tuyển của một ngành, cần đồng thời:

1. **Chỉ tiêu** của ngành/năm đó.
2. **Số và chất lượng nguyện vọng đăng ký** vào ngành đó (phân bố điểm của chính những người cạnh tranh).
3. **Quy tắc lọc** thực tế (điểm chuẩn là *kết quả* của việc lọc, không phải đầu vào).
4. **Điểm của em** trong đúng tổ hợp/phương thức đó.

LearnPath hiện có (4) và một phần (3). **Không có (1) và (2).** Điểm chuẩn 2025 chỉ cho biết *ngưỡng cuối cùng*, không cho biết *mật độ người* quanh ngưỡng đó — đây là **selection bias** kinh điển: phân bố điểm của người *đã đăng ký* vào một ngành y khoa khác hoàn toàn phân bố toàn quốc.

⇒ Mọi con số gọi là "tỉ lệ đỗ" trên dữ liệu hiện có sẽ **sai một cách hệ thống**, và sai theo hướng lạc quan cho ngành hot (vì người cạnh tranh giỏi hơn mức trung bình toàn quốc).

**Cách trung thực để tiến gần hơn:** trích *chỉ tiêu* từ 307 đề án Markdown (`de_an_tuyen_sinh` có nội dung đầy đủ) → đó là pha sau, và vẫn chỉ cho ra "tỉ lệ chọi", không phải "tỉ lệ đỗ của em".

### 17.2. Đại lượng A — `pBench` (đo được)

**Định nghĩa.** Với tổ hợp C gồm đúng 3 môn và ngưỡng S:

```
D(C)    = { thí sinh có đủ cả 3 môn của C }        // loại người thiếu môn, KHÔNG coi là 0
T_i(C)  = tổng 3 môn của C của thí sinh i

pBench(S, C) = |{ i ∈ D(C) : T_i(C) ≥ S }| / |D(C)|      // ĐUÔI TRÊN: tỉ lệ đạt từ S trở lên
P(S, C)      = |{ i ∈ D(C) : T_i(C) < S }| / |D(C)|      // ĐUÔI DƯỚI: tỉ lệ thấp hơn S
```

> ⚠️ **Hai đại lượng này nghịch đảo nhau** (`pBench + P = 1`, cùng mẫu `D(C)`: `pBench` đếm `≥ S`, `P` đếm `< S`, không ai bị đếm hai lần). `pBench` trả lời *"bao nhiêu % thí sinh đạt ngưỡng này"*; `P` trả lời *"em đứng ở đâu trong phân bố"*. **`hocLucFit` phải dùng `P`, không dùng `pBench`** — dùng nhầm sẽ đảo ngược thứ hạng (điểm càng cao, "phù hợp" càng thấp).

Trả về đầy đủ, không làm tròn che dữ liệu:

```json
{
  "combo": "A00", "threshold": 25.0, "year": null,
  "pBench": 0.0987,
  "numerator": 16119, "denominator": 163288,
  "mean": 19.48, "sd": 4.28, "median": 19.75,
  "note": "Tỉ lệ thí sinh toàn quốc có tổng A00 ≥ 25,0. Không phải tỉ lệ trúng tuyển."
}
```

**Điểm phải xử lý đúng:**

- Chỉ tính thí sinh **có đủ 3 môn**. Người thiếu môn không bị coi là 0 điểm (sẽ làm lệch `pBench` xuống).
- `0` là điểm hợp lệ, không phải null (đã có `toNumber()` trong importer, xem KI-17).
- Không trộn tổ hợp: tổng A00 không so được với tổng D01.
- Chỉ áp dụng cho `phuong_thuc = 'Điểm thi THPT'`. Bốn phương thức còn lại dùng thang khác → trả `null` + lý do (KI-19).

**Hiệu năng.** `diem_thi_thptqg` có 1.131.975 dòng trong `sql.js` (WASM, trong RAM). Quét toàn bảng cho mỗi request có thể mất hàng trăm ms đến vài giây. Ba lựa chọn, xếp theo chi phí:

1. **Cache trong bộ nhớ** (khuyến nghị cho pha này): LRU theo khoá `(combo, minScoreBucket)`, TTL 10 phút, giữ histogram 40 bucket thay vì chỉ một số. Không đổi schema. (Bảng không có cột năm nên khoá cache **không** gồm `year`.)
2. **Precompute lúc import**: thêm bảng `score_combo_histogram(combo, year, bucket_low, count)`. Nhanh nhất, nhưng **sửa `init.js` ⇒ phải rebuild DB ⇒ L3, cần duyệt**.
3. **Tính theo yêu cầu, không cache**: chỉ chấp nhận nếu đo được < 300 ms.

### 17.3. Đại lượng B — vị trí trong phân bố

```
P(S, C)    = |{ i ∈ D(C) : T_i(C) < S }| / |D(C)|      // §17.2 — phân vị, đuôi dưới
percentile = 100 × P(T_student, C)                      // ∈ [0, 100)
zScore     = (T_student − mean(C)) / sd(C)
```

> Không viết `percentile = pBench × 100`: đó là **phần trăm thí sinh đạt từ điểm của em trở lên**, tức là "em giỏi hơn bao nhiêu người" bị đảo thành "còn bao nhiêu người giỏi hơn em". Với tổ hợp A00, `T = 25,0` và `pBench = 0,0987` thì `percentile = 90,1`, **không phải 9,87**.

`zScore` là thứ duy nhất cho phép **so sánh giữa các tổ hợp** (A00 và D01 có mean/sd khác nhau). Dùng `z` để xếp hạng "độ cạnh tranh tương đối", không dùng tổng thô để so chéo tổ hợp.

Câu hiển thị đúng: *"Điểm của bạn cao hơn 90% thí sinh toàn quốc ở tổ hợp A00 (163.288 thí sinh có đủ 3 môn trong dữ liệu hiện có)."*

> ⚠️ **Bảng `diem_thi_thptqg` không có cột năm** (đã kiểm tra schema: `id, sbd, tinh, toan, van, ly, hoa, sinh, su, dia, gd_kt_pl, tin_hoc, cong_nghe, ngoai_ngu`). Vì vậy **không được ghi "dữ liệu thi 2026"** hay bất kỳ năm cụ thể nào. Chỉ ghi "dữ liệu điểm thi hiện có trong hệ thống (1.131.975 thí sinh)". Năm của điểm chuẩn là chuyện khác — đó là `diem_chuan.nam = 2025`.

### 17.4. Tỉ lệ 1 — `tinhCachFit` (phù hợp tính cách/sở thích, %)

**Nguồn dữ liệu:** 6 điểm RIASEC của học sinh (§6.1) + **trọng số RIASEC của nhóm ngành** trong `interest_group_weights` (§5.5).

**Bước 1 — chuẩn hoá sở thích thành tỉ trọng.** Không dùng điểm thô, vì người trả lời toàn 5 sẽ "khớp mọi ngành". Dùng *tỉ trọng* để so **hình dạng** hồ sơ:

```
G_c   = { g ∈ {R,I,A,S,E,C} : status_g = 'complete' }     // chỉ nhóm đã trả lời đủ 10 câu
s_g   = sum_g / Σ_{h ∈ G_c} sum_h                          // Σ s_g = 1, chỉ trên G_c
w_g   = trọng số RIASEC của nhóm ngành (bảng §5.5)
w'_g  = w_g / Σ_{h ∈ G_c} w_h                              // chuẩn hoá lại trên cùng tập G_c
```

**Bước 2 — đo mức trùng khớp bằng giao của hai phân bố** (histogram intersection):

```
tinhCachFit = 100 × Σ_{g ∈ G_c} min(s_g , w'_g)            // ∈ [0, 100]
```

**Vì sao công thức này:**

- `Σ min(s, w) = 1 − ½ Σ|s − w|` — chính là **1 trừ nửa khoảng cách toàn biến thiên**. Đây là độ đo chuẩn để so hai phân bố xác suất, có ý nghĩa trực tiếp: *"phần sở thích của bạn thực sự trùng với phần ngành này coi trọng"*.
- `= 100` khi và chỉ khi hai vector giống hệt; `= 0` khi hai vector không giao nhau ở bất kỳ nhóm nào.
- Bị phạt **cả hai chiều**: ngành coi trọng R mà bạn không có R → mất điểm; bạn có A mạnh mà ngành không cần A → cũng không được cộng. Đúng bản chất "phù hợp", khác với "có nhiều sở thích mạnh".
- Không dùng cosine: với vector không âm, cosine gần 1 cho gần như mọi cặp, mất khả năng phân biệt (một hồ sơ phẳng vẫn đạt ~0,9 với mọi ngành).

**Bước 3 — độ phủ, và điều kiện để dùng tỉ lệ này:**

```
doPhuTinhCach = 100 × Σ_{g ∈ G_c} w_g          // tính trên vector w GỐC, KHÔNG chuẩn hoá lại
```

- `doPhuTinhCach ≥ 80` → `status = 'day_du'`, được dùng trong `tongHopFit`.
- `doPhuTinhCach < 80` → vẫn hiển thị `tinhCachFit` nhưng gắn nhãn **"tạm tính"**, và `tongHopFit = null` (lý do `chua_du_cau_tra_loi`). Không được im lặng coi là đủ.
- **`|G_c| < 4`** → `tinhCachFit = null`, lý do `chua_du_cau_tra_loi`. Với 1–3 nhóm, vector `s` bị ép về 0 ở các nhóm còn lại ⇒ điểm thấp giả tạo và mất ý nghĩa "so hình dạng". Đây là ngưỡng **kỹ thuật**, không phải ngưỡng tâm lý.
- `G_c` rỗng → `null` (trường hợp riêng của quy tắc trên).
- Nhóm ngành **không có dòng** trong `interest_group_weights` → `null`, `reason = 'thieu_trong_so_tinh_cach'`. **Không** trả 0, không dùng trọng số mặc định chung.

**Hệ quả với D3 (phải nói trước khi học sinh bấm nộp):** D3 cho nộp khi mỗi nhóm ≥ 8/10, nhưng `tinhCachFit` chỉ dùng nhóm **đủ 10/10**. Vì vậy màn rà soát phải hiện: *"Để có tỉ lệ phù hợp tính cách, cần trả lời đủ 10/10 ở ít nhất 4 nhóm (khuyến nghị cả 6). Hiện có: 2/6."* Không được để học sinh nộp xong mới phát hiện tỉ lệ là `null`.

**Ví dụ tính tay** (dùng để viết test): học sinh có `R=45, I=40, A=30, S=20, E=15, C=10` (tổng 160) → `s = (0,281; 0,250; 0,188; 0,125; 0,094; 0,063)`.

| Nhóm ngành | Trọng số | `Σ min(s,w)` | `tinhCachFit` |
|---|---|---|---|
| Kỹ thuật - Công nghệ | 0,35 / 0,35 / 0,05 / 0,03 / 0,07 / 0,15 | 0,281+0,250+0,050+0,030+0,070+0,063 | **74,4 %** |
| Nghệ thuật | 0,05 / 0,10 / 0,50 / 0,18 / 0,14 / 0,03 | 0,050+0,100+0,1875+0,125+0,09375+0,030 | **58,6 %** |

Hai kết quả này chứng minh công thức phân biệt được ngành: cùng một hồ sơ, Kỹ thuật cao hơn Nghệ thuật gần 16 điểm (15,8) — đúng chiều so với hồ sơ nghiêng R/I.

**Nhãn hiển thị:** ≥ 80 "Rất phù hợp" · 65–80 "Phù hợp" · 50–65 "Trung tính" · < 50 "Ít phù hợp". Ngưỡng để trong `career_match_config`, công khai.

> **Không dùng 4 cặp xu hướng (E/I, S/N, T/F, J/P) để tính tỉ lệ này.** Không có ánh xạ nào được kiểm định từ 4 cặp sang nhóm ngành; đưa vào sẽ là thêm một tầng giả định không bảo vệ được. Bảng `interest_group_pairs` (§5.2) tồn tại nhưng **mặc định tắt** — nếu sau này có nghiên cứu, bật bằng config và phải công khai. Xem D12.

### 17.5. Tỉ lệ 2 — `hocLucFit` (phù hợp học lực, %)

> ⚠️ **Sửa so với bản trước.** Bản đầu nói "đổi tên `fitPct` là đủ, rủi ro bằng 0". **Sai.** `fitPct` hiện tại bão hoà trên dữ liệu rubric thật: đạt 8,0 mỗi môn → **134/145 rubric ≥ 95 %**; đạt 9,0 → **100 % cho cả 145 rubric**. Chỉ số gần như không phân biệt ngành. Xem §17.15 để biết đầy đủ lỗi dữ liệu.

**Công thức hiện tại (giữ làm tham chiếu, KHÔNG dùng):**

```
fitPct = 100 × [ Σ_present (min(score/threshold, 1) × weight) ] / [ Σ_present weight ]
```

Vấn đề: `threshold` chỉ nằm trong 5,5–9,0 (không phải điểm chuẩn ngành), nên trần `min(…,1)` bị chạm gần như ngay.

**Công thức mới — so theo phân bố toàn quốc:**

```
T_student = score_a + score_b + score_c              // ĐÚNG 3 môn của tổ hợp, KHÔNG nhân trọng số
P_student = P(T_student, combo)                      // §17.3 — phân vị ∈ [0,1], tỉ lệ thí sinh thấp hơn
P_entry   = P(entryScore, combo)                     // phân vị của điểm chuẩn 2025

hocLucFit = 100 × min(P_student / P_entry, 1)        // ∈ [0, 100]
```

> **Không dùng `career_rubric_subjects.weight` trong `hocLucFit`.** Đây là điểm dễ sai: phân bố toàn quốc đang có là phân bố của **tổng thô 3 môn** (`toan + ly + hoa`, …). Nếu nhân trọng số rồi tra vào phân bố thô, ta so hai đại lượng khác thang — đúng lỗi mà công thức cũ mắc phải ở dạng khác. Muốn dùng trọng số thì phải dựng **một phân bố riêng cho từng rubric** (145 histogram), vừa đắt vừa thêm một giả định không kiểm định. Điểm chuẩn theo phương thức THPT cũng xét trên tổng thô, nên tổng thô là đại lượng **đúng bản chất tuyển sinh**. `weight` vẫn được dùng ở `legacyFitPct`/`calculateCareerFit` và ở phần hiển thị "môn quan trọng" của admin — **không** dùng ở đây.

> Dùng **`P`** (đuôi dưới), tuyệt đối không dùng `pBench` (đuôi trên). Xem cảnh báo §17.2.

**Vì sao công thức này:**

- So **vị trí phân bố** thay vì so điểm thô với ngưỡng tự đặt. `P_entry` là "em cần vượt bao nhiêu % thí sinh để chạm điểm chuẩn ngành này".
- Bị chặn trên ở 1 (không thưởng cho điểm vượt xa) — giữ đúng tinh thần "mức đáp ứng yêu cầu", không phải "càng cao càng tốt".
- Phân biệt được ngành: cùng một học sinh, ngành có `P_entry` cao (khó) cho `hocLucFit` thấp hơn ngành dễ.
- Khi `hocLucFit` chạm 100 ở nhiều ngành (học sinh vượt điểm chuẩn), thứ hạng vẫn phân biệt được nhờ trường phụ **`diemVuotChuan = T_student − entryScore`** — dùng để sắp xếp, **không** hiển thị như một tỉ lệ.

**Kiểm chứng trên dữ liệu thật** — tính **trực tiếp từ `diem_thi_thptqg`**, không dùng xấp xỉ chuẩn. Ví dụ tổ hợp A00: **n = 163.288** thí sinh có đủ 3 môn, mean = **19,48**, sd = **4,28**, median = **19,75**. (Không dùng một cặp `mean/sd` chung cho mọi tổ hợp: A00 và D01 có phân bố khác nhau, gộp lại sẽ sai.)

| Tổng 3 môn | P_student | ngành P_entry 58,7 % | 75,0 % | 89,9 % | 96,7 % |
|---|---|---|---|---|---|
| 18 | 0,36 | 62 | 48 | 40 | 37 |
| 20 | 0,51 | 87 | 68 | 56 | 53 |
| 22 | 0,67 | 100 | 89 | 74 | 69 |
| 24 | 0,83 | 100 | 100 | 93 | 86 |
| 26 | 0,95 | 100 | 100 | 100 | 98 |
| 28 | 0,99 | 100 | 100 | 100 | 100 |

(Cột `P_entry` là phân vị thực nghiệm của A00 tại các mốc 58,7 / 75,0 / 89,9 / 96,7 %, tương ứng điểm chuẩn 21,0 / 22,85 / 24,85 / 26,5.)

**Kiểm chứng ở cấp rubric** — mô phỏng học sinh đạt đúng `lvl` ở **cả 3 môn** (nên lỗi L2 "môn không thuộc tổ hợp" không ảnh hưởng phép mô phỏng này). Chỉ dùng được **135 rubric** có `0 < entryScore ≤ 30`, đúng 3 môn và xác định được **một** tổ hợp trong `ADMISSION_SUBJECTS`; 10 rubric còn lại phải chờ M-0 (**2 rubric `entryScore > 30`** — một trong hai cũng có 4 môn — và **8 rubric block lạ** `V00/H00/M10/M00/N00/B03`):

| Điểm mỗi môn | Cũ: Q1 / trung vị / Q3 | Cũ: số rubric ≥ 95 % | Mới: Q1 / trung vị / Q3 | Mới: số rubric ≥ 95 % |
|---|---|---|---|---|
| 6,5 | 84 / 88 / 92 | 6/145 | 53 / 59 / 72 | 6/135 |
| **7,0** | **90 / 94 / 97** | **71/145** | **70 / 77 / 93** | **33/135** |
| 7,5 | 95 / 98 / 100 | 107/145 | 83 / 92 / 100 | 64/135 |
| 8,0 | 99 / 100 / 100 | 134/145 | 93 / 100 / 100 | 87/135 |
| 9,0 | 100 / 100 / 100 | 145/145 | 100 / 100 / 100 | 135/135 |

Đọc bảng này cho đúng: công thức mới **không xoá sạch bão hoà** — ở 8,0 mỗi môn vẫn có 87/135 rubric đạt ≥ 95 %, vì khi đó học sinh thật sự vượt điểm chuẩn của phần lớn ngành; ở 9,0 thì bão hoà hoàn toàn. Điều nó sửa được là **dải phân biệt ở vùng giữa**: tại 7,0, trung vị giảm từ 94 xuống 77 và số rubric bão hoà giảm từ 71 xuống 33. Đây là lý do vẫn cần `diemVuotChuan` làm khoá sắp xếp phụ và **không** được gọi `hocLucFit` là "mức độ cạnh tranh".

**Giả định phải công khai:** `P_entry` suy từ `entryScore` — điểm chuẩn là phân vị của *nhóm trúng tuyển*, không phải của toàn quốc. Công thức này coi điểm chuẩn 2025 là mốc so sánh, **không** phải xác suất. Ghi câu này cạnh mọi chỗ hiển thị `hocLucFit`.

**Trường hợp không tính được (trả `null` + `reason`, không nội suy):**

| Thiếu | `reason` | Ghi chú |
|---|---|---|
| Không có `entryScore` | `thieu_diem_chuan` | |
| `entryScore ≤ 0` hoặc > 30 | `diem_chuan_khong_hop_le` | Bắt 2 rubric 34,35 và 31,5 (§17.15) |
| Không xác định được tổ hợp | `thieu_to_hop` | 8 rubric có block lạ (§17.15 L5) + 853/2.617 dòng `diem_chuan` trống `to_hop_mon` |
| Thiếu ≥ 1 môn trong tổ hợp | `thieu_diem_mon` | **Không** coi môn thiếu = 0 |
| Không có điểm thang 0–30 cho tổ hợp (chỉ có điểm học bạ) | `thieu_diem_thi` | **Không** quy đổi học bạ. Chỉ tính khi có điểm thi hoặc điểm dự kiến theo tổ hợp (`source='tự khai'`) — §17.7, D11 |
| `phuong_thuc ≠ 'Điểm thi THPT'` | `phuong_thuc_khac` | **Chỉ** chặn `pBench`/`percentile`; `hocLucFit` **vẫn tính** từ điểm môn (M15) |
| `P_entry = 0` | `diem_chuan_ngoai_phan_bo` | Điểm chuẩn thấp hơn mọi thí sinh trong phân bố — không chia cho 0 |

**Nhánh dự phòng (khi bảng phân bố `diem_thi_thptqg` chưa sẵn sàng):** dùng `entryScore` làm mốc thay vì phân vị:

```
T      = score_a + score_b + score_c          // tổng thô 3 môn của tổ hợp, KHÔNG nhân trọng số
hocLucFit_fallback = 100 × min(T / entryScore, 1)      // nhãn phuong_phap = 'uoc_luong_diem_chuan'
```

Nhánh này **vẫn bão hoà** ở mức cao (tại 8,0 mỗi môn, trên đúng **135 rubric** tính được: trung vị 100, **90/135** rubric ≥ 95 %) — chỉ dùng trong giai đoạn chuyển tiếp, UI phải hiện nhãn "ước lượng theo điểm chuẩn, chưa so phân bố". Không được trộn hai phương pháp trong cùng một lần xếp hạng.

**`coveragePct` vẫn đi kèm**, giờ là **số môn có điểm / 3** của tổ hợp (100 hoặc 0, vì thiếu 1 môn là `null`) — không còn phụ thuộc `weight`.

**`pBench` và `P` không phải "điểm thưởng".** Chúng xuất hiện trong `hocLucFit` chỉ với vai trò tử số và mẫu số của **một** tỉ số. `pBench` (đuôi trên) vẫn hiển thị riêng ở `/api/career/benchmark` như bằng chứng độc lập — không cộng vào bất kỳ tỉ lệ nào.

### 17.6. Tỉ lệ 3 — `tongHopFit` (phù hợp tổng thể, %)

```
tongHopFit = 100 × ( w_hocLuc × hocLucFit + w_tinhCach × tinhCachFit )
                   / ( w_hocLuc + w_tinhCach )
```

Mặc định `w_hocLuc = 0,6`, `w_tinhCach = 0,4`. Đây **không phải** kết luận "học lực quan trọng gấp rưỡi tính cách" theo nghĩa khoa học — đây là lựa chọn của nhóm, đặt trong `career_match_config`, và **phải hiển thị công khai** ở mọi chỗ dùng.

Điều kiện hợp lệ (không được nội suy):

| `hocLucFit` | `tinhCachFit` | `tongHopFit` | Lý do |
|---|---|---|---|
| có | có (độ phủ ≥ 80 %) | tính bình thường | — |
| có | `null` | **`null`** | `thieu_tinh_cach` — không được lấy 60 % học lực làm "tổng thể" |
| `null` | có | **`null`** | `thieu_hoc_luc` |
| có | "tạm tính" | **`null`** | `chua_du_cau_tra_loi` |

Quy tắc: **thiếu một thành phần thì không có tổng thể.** Trả `null` + `reason` để UI hiện "Chưa đủ dữ liệu" kèm việc cần làm, thay vì một con số trông hợp lý nhưng sai bản chất.

**Chú thích bắt buộc** ở mọi chỗ hiển thị `tongHopFit`:
> *"Phù hợp tổng thể = 60 % phù hợp học lực + 40 % phù hợp tính cách. Hai thành phần đo hai thứ khác nhau; tỉ lệ này không phải xác suất trúng tuyển."*

### 17.6b. Ma trận 3×2 — thay cho một con số đơn độc

Ma trận dùng **chính hai tỉ lệ thành phần** (không dùng `margin` điểm thô, vì `margin` chỉ áp dụng cho phương thức THPT): `hocLucFit` chia **3 dải**, `tinhCachFit` chia **2 dải** ⇒ 6 ô.

```
                     tinhCachFit ≥ 65            tinhCachFit < 65
hocLucFit ≥ 70   │ ① Vừa sức · Vừa hợp      │ ② Vừa sức · Chưa hợp      │
                 │   → ưu tiên khám phá      │   → xem lại vì sao chọn   │
─────────────────┼───────────────────────────┼───────────────────────────┤
50 ≤ hocLucFit   │ ③ Cần cân nhắc kỹ         │ ④ Trung tính              │
   < 70          │   → nâng điểm hoặc đổi    │   → chưa đủ tín hiệu      │
─────────────────┼───────────────────────────┼───────────────────────────┤
hocLucFit < 50   │ ⑤ Mơ ước · Cần lộ trình   │ ⑥ Không nên ưu tiên       │
                 │   → mục tiêu dài hạn      │                           │
```

Ngưỡng `65` và `70/50` để trong `career_match_config`, admin chỉnh, hiển thị công khai. Ô ⑤ giữ tính sư phạm: **không** nói "đừng mơ", nói "đây là mục tiêu cần lộ trình" — kèm `prioritySubject` từ `calculateCareerFit`.

### 17.6c. Biểu đồ radar — bổ sung 3 đường

Radar hiện tại (`MiniRadar`, `PhanTichNangLuc.jsx:52+`) vẽ **theo môn**: `details[]` gồm `subject`, `score`, `threshold`, bán kính chuẩn hoá `value/10`. Ba tỉ lệ mới **không phải môn**, nên **không được** thêm thành vertex — sẽ làm sai nghĩa trục.

Cách đúng: vẽ **ba vòng tròn đồng tâm** chồng lên lưới radar, bán kính tỉ lệ thuận:

```
r_hocLuc   = radius × (hocLucFit   / 100)
r_tinhCach = radius × (tinhCachFit / 100)
r_tongHop  = radius × (tongHopFit  / 100)
```

| Đường | Màu gợi ý | Nét | Legend |
|---|---|---|---|
| `hocLucFit` | `#2563eb` | liền | "Học lực — 78 %" |
| `tinhCachFit` | `#7c3aed` | liền | "Tính cách — 74 %" |
| `tongHopFit` | `#0f766e` | **đứt** `strokeDasharray="4 3"` | "Tổng thể — 76 %" |

Quy tắc vẽ:

- Vòng nào `null` → **không vẽ**; legend hiện "—" + lý do ngắn. Không vẽ bán kính 0 (dễ đọc nhầm là "0 %").
- Tổng thể vẽ **trên cùng** nhưng nét đứt, để vẫn thấy hai vòng thành phần bên dưới.
- Legend dưới radar, 3 dòng có chấm màu; `aria-label` của SVG nêu cả ba tỉ lệ.
- Nếu `details.length < 3` (không vẽ được radar), **vẫn hiển thị** ba tỉ lệ dạng 3 thanh ngang — tỉ lệ không phụ thuộc việc có đủ môn.

### 17.7. Hiệu chỉnh theo lớp — chỗ dễ sai nhất

| Lớp | `hocLucFit` | `tinhCachFit` | `tongHopFit` |
|---|---|---|---|
| 12 | Có — dùng điểm thi (hoặc điểm dự kiến theo tổ hợp, `source='tự khai'`) | Có nếu đã làm bài | Có khi cả hai có |
| 11 | **Chỉ khi** đã nhập điểm dự kiến theo tổ hợp; nếu chỉ có điểm học bạ ⇒ `hocLucFit = null`, reason `thieu_diem_thi` | Có nếu đã làm bài | Có khi cả hai có |
| 10 | như lớp 11 | Có nếu đã làm bài | Có khi cả hai có |

Khác với bản trước, **không chặn theo lớp** — vì cả hai tỉ lệ đều là "mức đáp ứng yêu cầu của ngành", không phải "xác suất đỗ", nên học sinh lớp 10 vẫn dùng được để chọn hướng. Nhưng **cả `hocLucFit` lẫn `pBench`/`percentile` đều cần điểm trên thang 0–30 của tổ hợp thi**; điểm học bạ (thang 0–10, khác phân bố, khác mục đích) **không dùng được** cho `P_student`. Chỉ khi học sinh tự nhập điểm dự kiến theo tổ hợp (gắn nhãn `source='tự khai'`) mới tính được — nếu không thì trả `null` + reason, **không** suy đoán.

**Tuyệt đối không quy đổi điểm học bạ thành điểm thi.** Hai thang khác nhau, phân bố khác nhau, mục đích khác nhau. Nếu người dùng tự nhập "điểm dự kiến", phải gắn nhãn rõ `source = 'tự khai'` và hiển thị cảnh báo — đây là dữ liệu tự khai, không phải điểm thi. Điều này ảnh hưởng **cả** `hocLucFit` (vì `T_student` lấy từ điểm đã nhập) **và** `pBench`/`percentile`; không được trình bày số tự khai như số liệu đo được.

### 17.8. Chống các lỗi đã biết (bắt buộc)

| Mã | Vấn đề | Cách chặn trong thuật toán |
|---|---|---|
| KI-02 | `/api/diem-thi/ranking` cộng môn đã nhập rồi so với tổng **9 môn** của mọi người; bin `27–30` bỏ sót ≥ 30 | **Không** dùng endpoint này. Viết hàm riêng tính trên đúng 3 môn của tổ hợp, bin mở `[27, ∞)` |
| KI-19 | `stats` trộn 5 thang điểm, `tongTruong` không phải coverage | Không dùng `/api/diem-chuan/stats` cho `pBench`; chỉ đọc `diem_chuan` theo `phuong_thuc = 'Điểm thi THPT'` |
| KI-03a | 5 mã trường map sai (HCP→HCH, MTU→MTC, NHB→NVH, SKH→SKD, UEF→KSA) | Ngành thuộc 5 mã đó: vẫn tính `tinhCachFit` (không phụ thuộc trường), nhưng `pBench = null` + cờ `dataWarning: 'mapping_chua_doi_chieu'` |
| KI-03e | 853/2.617 dòng `to_hop_mon` trống | `hocLucFit` **vẫn tính được** vì tổ hợp lấy từ `admissionBlock` của rubric, **không** đọc `diem_chuan.to_hop_mon`; `pBench = null`, lý do "thiếu tổ hợp" |
| KI-15 | Toàn bộ `diem_chuan.nam = 2025` nhưng thương hiệu nói 2026 | Mọi nhãn ghi rõ "điểm chuẩn 2025"; không gọi là "năm nay" |
| KI-03b | Chỉ 33/260 trường có dữ liệu điểm | Danh sách gợi ý phải hiển thị độ phủ; không ngụ ý "đã xét mọi trường" |

### 17.9. Hợp đồng API (bổ sung §7)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/career/benchmark?combo=A00&score=25.3` | `pBench`, `percentile`, `zScore`, `mean/sd/median`, `n`. Validate `combo` ∈ whitelist, `score` 0–30 |
| GET | `/api/career/recommendations` | Query: `classLevel`, `term`, `sort` (`tongHop_desc`\|`tinhCach_desc`\|`hocLuc_desc`), `page`, `limit` (≤ 50). Mỗi ngành trả: `hocLucFit`, `coveragePct`, `tinhCachFit`, `doPhuTinhCach`, `tongHopFit`, `matrixCell` (①…⑥), `pBench` (chỉ khi có điểm thi), `reasons` |
| GET | `/api/admin/career/match-config` · PUT | Đọc/sửa `w_hoc_luc`, `w_tinh_cach`, ngưỡng ma trận, `do_phu_min`, `hoc_luc_mode`; ghi audit |
| GET | `/api/admin/interest/weights` · PUT | CRUD `interest_group_weights` (8 nhóm ngành × 6 RIASEC); validate tổng = 1; ghi audit |

Quy tắc: mọi trường `null` đi kèm `reasons` dạng **mảng enum**: `thieu_diem_mon`, `thieu_to_hop`, `thieu_diem_chuan`, `diem_chuan_khong_hop_le`, `diem_chuan_ngoai_phan_bo`, `thieu_trong_so_tinh_cach`, `chua_du_cau_tra_loi`, `thieu_diem_thi`, `phuong_thuc_khac`, `mapping_chua_doi_chieu`. UI dịch enum thành câu tiếng Việt, không hiện raw code.

Payload mẫu một ngành:

```json
{
  "schoolCode": "BKA",
  "schoolName": "ĐHBK Hà Nội",
  "majorName": "Kỹ thuật Điều khiển - Tự động hoá",
  "majorGroup": "Kỹ thuật - Công nghệ",
  "hocLucFit": 78.4, "coveragePct": 100,
  "tinhCachFit": 74.4, "doPhuTinhCach": 100,
  "tongHopFit": 76.8,
  "matrixCell": 1,
  "pBench": null,
  "reasons": []
}
```

### 17.10. Cấu hình (bảng mới, admin chỉnh được)

```sql
CREATE TABLE IF NOT EXISTS career_match_config (
  key        TEXT PRIMARY KEY,   -- xem bảng dưới
  value      REAL NOT NULL,
  note       TEXT,
  updated_at INTEGER NOT NULL
);
```

| `key` | Mặc định | Ý nghĩa |
|---|---|---|
| `w_hoc_luc` | 0,6 | Trọng số của `hocLucFit` trong `tongHopFit` |
| `w_tinh_cach` | 0,4 | Trọng số của `tinhCachFit` trong `tongHopFit` |
| `matrix_hoc_luc_high` | 70 | Ngưỡng "học lực tốt" của ma trận |
| `matrix_hoc_luc_low` | 50 | Ngưỡng "học lực thấp" của ma trận |
| `matrix_tinh_cach` | 65 | Ngưỡng "tính cách hợp" của ma trận |
| `do_phu_min` | 80 | Độ phủ tối thiểu (%) để `tinhCachFit` được dùng trong tổng thể |
| `hoc_luc_mode` | 0 | `0` = công thức phân vị (§17.5); `1` = `legacyFitPct` — **chỉ dùng để rollback**, UI phải ghi rõ "chế độ cũ" |

Quy tắc:
- `w_hoc_luc + w_tinh_cach` bất kỳ (không cần bằng 1) — công thức chuẩn hoá lại bằng tổng.
- `w_hoc_luc > 0` và `w_tinh_cach > 0`, nếu không `400`.
- `matrix_hoc_luc_low < matrix_hoc_luc_high`.
- Mọi thay đổi ghi audit `admin.career.match_config.update` kèm `{key, oldValue, newValue}`.
- Trang kết quả hiển thị công khai: *"Phù hợp tổng thể = 60 % phù hợp học lực + 40 % phù hợp tính cách (tham số có thể điều chỉnh)."*

### 17.11. Kiểm thử

| # | Ca | Kỳ vọng |
|---|---|---|
| M1 | Fixture 5 thí sinh, C = A00 | `pBench` khớp tính tay; thí sinh thiếu 1 môn **bị loại khỏi mẫu số**, không tính là 0 |
| M2 | Tăng `T` dần | `pBench`, `percentile`, `zScore` **đơn điệu không giảm** |
| M3 | `s` giống hệt `w'` của nhóm ngành | `tinhCachFit = 100,0` |
| M4 | `s` và `w'` không giao nhau (vd s chỉ có A, w chỉ có R) | `tinhCachFit = 0,0` |
| M5 | Hồ sơ ví dụ §17.4 (R45 I40 A30 S20 E15 C10) | Kỹ thuật–Công nghệ = **74,4**; Nghệ thuật = **58,6** (±0,1) |
| M6 | Property test 1 000 cặp vector ngẫu nhiên | `Σ min(s,w) = 1 − ½ Σ\|s−w\|` (sai số < 1e-9) |
| M7 | Học sinh trả lời **toàn 5** (hồ sơ phẳng) | `tinhCachFit < 90` cho **mọi** nhóm ngành ⬅ chứng minh công thức không thưởng cho "chọn hết" |
| M8 | Nhóm ngành không có dòng `interest_group_weights` | `tinhCachFit = null`, reason `thieu_trong_so_tinh_cach` |
| M9 | `doPhuTinhCach = 60` (< ngưỡng 80) | `tinhCachFit` vẫn hiện nhưng `tongHopFit = null`, reason `chua_du_cau_tra_loi` |
| M10 | `hocLucFit = null` | `tongHopFit = null`, reason `thieu_hoc_luc`; **không** lấy 40 % tính cách làm tổng thể |
| M11 | `tinhCachFit = null` | `tongHopFit = null`, reason `thieu_tinh_cach` |
| M12 | Ma trận: 6 tổ hợp (học lực cao/vừa/thấp × tính cách cao/thấp) | Rơi đúng ô ①…⑥ |
| M13 | `T_student` tăng dần trên cùng rubric; `entryScore` tăng dần trên cùng học sinh | `hocLucFit` **đơn điệu không giảm** theo `T_student`, **không tăng** theo `entryScore`; `legacyFitPct` khớp `calculateCareerFit` cũ (chỉ để đối chiếu trước/sau) |
| M14 | Người dùng A gọi `/recommendations` | Chỉ dùng điểm/sở thích của A (không rò rỉ chéo user) |
| M15 | `phuong_thuc = 'SAT'` | `pBench = null`, reason `phuong_thuc_khac`; `hocLucFit` **vẫn tính** |
| M16 | Radar với `tinhCachFit = null` | Không vẽ vòng bán kính 0; legend hiện "—" + lý do |

> M13 là ca chống **đảo dấu** — chính lỗi mà bản trước mắc khi lấy `pBench` (đuôi trên) thay `P` (đuôi dưới): học sinh giỏi hơn lại bị chấm "kém phù hợp hơn".

### 17.12. Cách nói — bảng bắt buộc

| ❌ Không được nói | ✅ Nói thay thế |
|---|---|
| "Bạn có 78% cơ hội đỗ" | "Điểm của bạn cao hơn 90% thí sinh toàn quốc ở tổ hợp A00" |
| "Phù hợp 92% với ngành này" | "Phù hợp học lực 92 % — tức là mức đáp ứng yêu cầu môn học của ngành" |
| "Tính cách của bạn hợp 74% với ngành" (không giải thích) | "Phù hợp tính cách 74 % — mức trùng giữa sở thích của bạn và nhóm sở thích ngành này coi trọng" |
| "Tổng thể 76% nghĩa là 76% đỗ" | "Phù hợp tổng thể 76 % = 60 % học lực + 40 % tính cách. Không phải xác suất trúng tuyển." |
| "Chắc chắn đỗ / không đỗ" | "Điểm chuẩn 2025 là 25,5 — cao hơn mức bạn dự kiến 0,8 điểm" |
| "Bạn là type R-I-A" | "Ba nhóm sở thích nổi bật: R, I, A (mã tham khảo)" |
| "Ngành này không dành cho bạn" | "Phù hợp tính cách hiện tại thấp — có thể tìm hiểu thêm trước khi quyết định" |

Bắt buộc ở mọi chỗ hiển thị **cả ba** tỉ lệ: nhãn nói rõ đây là *mức đáp ứng yêu cầu của ngành*, không phải *so với người khác* và không phải *xác suất đỗ*. `pBench` là chỉ số **duy nhất** được nói "so với thí sinh toàn quốc", và phải ghi rõ nguồn + năm.

### 17.13. Giới hạn phải ghi trong tài liệu/báo cáo

1. Không có chỉ tiêu và số nguyện vọng ⇒ **không** có xác suất trúng tuyển (§17.1). Ba tỉ lệ **không** phải xác suất.
2. Bộ 108 câu **tự biên soạn, chưa kiểm định** độ tin cậy/giá trị ⇒ `tinhCachFit` là chỉ báo khám phá, không phải kết luận.
3. **Trọng số RIASEC của 8 nhóm ngành do nhóm tự xây dựng** từ mô tả nghề nghiệp và mô hình lục giác Holland; chưa kiểm định trên dữ liệu Việt Nam. Đây là **giả thuyết cần kiểm chứng**.
4. Trọng số 0,6/0,4 là **lựa chọn của nhóm**, không phải kết quả nghiên cứu. Nếu thay đổi, thứ hạng thay đổi — phải công khai tham số đang dùng.
5. Điểm chuẩn là dữ liệu **2025**, không đại diện cho năm em xét tuyển; là **kết quả sau lọc**, không suy ra được phân bố người cạnh tranh.
6. Chỉ 33/260 trường có dữ liệu điểm ⇒ danh sách gợi ý **không đầy đủ**.
7. `hocLucFit` đo **mức đáp ứng tương đối so với điểm chuẩn 2025** (qua phân vị toàn quốc), không đo năng lực tuyệt đối và không phải xác suất; `P_entry` suy từ `entryScore` — vốn là phân vị của nhóm trúng tuyển, không phải toàn quốc.

### 17.14. Lộ trình riêng cho chương này

| Pha | Việc | Ước lượng |
|---|---|---|
| **M-0** | **Audit + chuẩn hoá `edumind_rubrics.json`** (§17.15): script audit read-only, báo cáo L1–L5, sửa đầy đủ L2/L3/L5 (D13), loại L4; **5 bất biến** + M20 | **1,5–2 ngày** |
| M-A | `career/match.js`: `pBench`, `P` (phân vị), `percentile`, `zScore`; test M1–M2, M15; đo thời gian quét 1,13 M dòng | 1 ngày |
| M-B | `interest_group_weights` seed (8 nhóm × 6 RIASEC) + `tinhCachFit`; test M3–M8, M23 | 1 ngày |
| M-C | `hocLucFit` **công thức phân vị** (§17.5) + `diemVuotChuan` + `tongHopFit` + ma trận; test M9–M13, M17–M19, M21, M22 | 1,5 ngày |
| M-D | API `/api/career/benchmark`, `/recommendations`, `/api/admin/interest/weights`; cache LRU; test M14 | 1 ngày |
| M-E | UI: 3 thanh tỉ lệ, 3 vòng radar, ma trận 3×2, cột lý do null; câu chữ §17.12; test M16 | 2 ngày |
| M-F | Admin: tab "Trọng số tính cách" (8×6, validate tổng = 1) + tab "Tham số tổng thể" + tab "Kiểm tra rubric"; audit | 1,5 ngày |

Tổng **~9,5–10,5 ngày**, **không** cần chờ P1–P5 cho M-0/M-A; M-B cần P2 (6 điểm RIASEC).

Thứ tự bắt buộc và điểm có thể chạy sớm:

- **M-0 và M-A độc lập hoàn toàn** — không cần mô-đun sở thích. Chạy song song được.
- **M-A không bị chặn bởi M-0**: `pBench`/`P` chỉ dùng `diem_thi_thptqg`, không đọc rubric.
- **M-B độc lập với M-0**: `tinhCachFit` chỉ cần `interest_group_weights` + điểm RIASEC.
- **M-C bị chặn bởi M-A và M-B** — đây là điểm giao duy nhất. M-0 **đã bắt buộc (D13) nhưng không chặn thứ tự**: không sửa rubric vẫn chạy được trên **135 rubric** (guard L4/L5); M-0 chỉ nâng độ phủ lên **143** và dọn `legacyFitPct`.
- **M-E bị chặn bởi M-C.** M-D sau M-B. M-F độc lập, có thể làm cuối.

Nếu chỉ có 2 ngày để có số liệu thật cho báo cáo: **M-A** (1 ngày) cho `pBench`/`percentile` đúng; **M-0** (1,5–2 ngày) mở rộng độ phủ `hocLucFit` từ 135 lên 143 rubric và dọn mâu thuẫn dữ liệu — nhưng bản thân M-0 không tạo ra tính năng người dùng thấy được.

> **Lưu ý L3 — đã duyệt (D9, D13):**
> - **M-0** sửa dữ liệu rubric đang chạy (145 dòng trong `auth.db` thật) theo D13 ⇒ L3, cần backup + duyệt — **đã duyệt**: sửa L2/L3/L5 đầy đủ, L4 chỉ loại trừ.
> - **M-C** đổi công thức `hocLucFit` ⇒ kết quả người dùng đang thấy thay đổi, cần duyệt.
> - **M-E** thay cụm "phù hợp 82 %" bằng ba tỉ lệ trên `/phan-tich-nang-luc` ⇒ thay đổi sản phẩm.
> - **M-A, M-B, M-D** chỉ **thêm** bảng/endpoint mới (schema v7), không sửa endpoint cũ ⇒ không phá hợp đồng.

---

### 17.15. 🔴 Audit dữ liệu rubric — quyết định độ phủ của M-C

Đã kiểm tra trực tiếp `backend/src/data/edumind_rubrics.json` (145 rubric, nguồn duy nhất của `hocLucFit` và `calculateCareerFit`). Kết quả:

**Cấu trúc sạch:** 145/145 có `majorGroup`, `method = 'Điểm thi THPT'`, `year = 2025`, `entryScore` khác null, tổng `weight` = 1,000, không trùng lặp `(school, major, block, method)`, 41 trường.

**Nhưng có 5 lớp lỗi nội dung:**

| # | Lỗi | Bằng chứng | Ảnh hưởng |
|---|---|---|---|
| **L1** | `threshold` **không phải ngưỡng học lực** — chỉ 5,5–9,0, không suy ra từ `entryScore` | Đạt 8,0 mỗi môn → **134/145 rubric ≥ 95 %**; đạt 9,0 → **145/145 = 100 %**; đạt 6,0 → trung vị 82 % | `fitPct` bão hoà, gần như không phân biệt ngành. Đây là lý do phải đổi công thức ở §17.5 |
| **L2** | Môn trong rubric **không thuộc tổ hợp** `admissionBlock` | **96/145 rubric**. Vd `A00` (Toán–Lý–Hóa) nhưng rubric chứa *Tiếng Anh* (BKA, FPT, UET), *Tin học* (UET–KHDL), *Ngữ văn* (SPH–Sư phạm Toán); `D01` chứa *Vật lý*, *Hóa học* | **Không** ảnh hưởng `hocLucFit` mới (§17.5 dùng tổng thô 3 môn của **tổ hợp**, không đọc danh sách môn của rubric). **Có** ảnh hưởng `legacyFitPct`/`calculateCareerFit` và phần hiển thị "môn quan trọng" ở admin → vẫn phải sửa, nhưng **không chặn M-C** |
| **L3** | `entryScore` **mâu thuẫn với tổng ngưỡng** | **13 rubric** có `entryScore < Σthreshold` (Dược học 23,5 < 24,0; Y tế Công cộng 20,8 < 23,0; Điều dưỡng 22,25 < 22,5; Sinh học 22,0 < 23,0; Báo chí 22,0 < 22,5; Triết học 21,25 < 22,0) | Rubric tự nói "cần 24 điểm" nhưng điểm chuẩn 23,5. Không thể đúng cả hai |
| **L4** | `entryScore` **vượt thang 30** | 34,35 (ĐH Hà Nội – Ngôn ngữ Trung Quốc, D01) và 31,5 (ĐHKHTN – Khoa học Tự nhiên, D01) | Vô lý với thang THPT. Nhiều khả năng là dữ liệu thô chưa quy đổi hoặc nhập nhầm |
| **L5** | **Cấu trúc lệch** | 1 rubric có **4 môn** (ĐHKHTN – Khoa học Tự nhiên: Toán/Lý/Hóa/Sinh — **cũng chính là rubric `entryScore = 31,5` ở L4**, không đếm hai lần); **8 rubric** thuộc **6 block** không nhận diện được trong bảng `ADMISSION_SUBJECTS` (`V00`, `H00`, `M10`, `M00`, `N00`, `B03`) | 4 môn không khớp bất kỳ tổ hợp 3 môn nào; 8 rubric block lạ rơi vào `thieu_to_hop` |

**Phân bố `entryScore`:** min 17,0 · Q1 21,5 · trung vị 23,6 · Q3 26,3 · max 34,4.

#### 17.15.1. Việc phải làm trong M-0

**Bước 1 — Script audit (read-only, 0,5 ngày)**

`backend/scripts/audit-rubrics.js`, xuất báo cáo JSON + bảng:

- Đếm và liệt kê từng lỗi L1–L5 theo `schoolCode + majorName + block`.
- Tính `fitPct` tại các mức 6,0 / 7,0 / 8,0 / 9,0 để đo mức bão hoà trước/sau khi sửa.
- Không sửa gì. Chỉ đọc `edumind_rubrics.json` + `auth.db` (nếu đã seed).

**Bước 2 — Quyết định cách sửa từng lớp (đã chốt theo D13, 0,5 ngày)**

> **D13 đã chốt: sửa L2, L3, L5; L4 chỉ loại trừ (không đoán giá trị).** Bảng dưới là cách sửa đã được duyệt — không còn nhánh "không duyệt L2/L3".

| Lỗi | Hướng sửa đề xuất | Vì sao |
|---|---|---|
| **L1** | **Không đặt lại `threshold` để chống bão hoà** (không có cơ sở khoa học). Thay bằng công thức §17.5 (so phân vị). Giữ `threshold` trong DB cho tương thích ngược nhưng đánh dấu `deprecated` | Đổi công thức dùng được dữ liệu `entryScore` thật; sửa 145×3 ngưỡng bằng tay chỉ là đoán |
| **L2** | Sửa **môn** cho khớp block (ưu tiên) hoặc sửa **block** cho khớp môn | Cần biết rubric nào đúng ý đồ gốc. Đề xuất: giữ `entryScore` + `block`, thay môn thành môn của block, phân bổ lại `weight` theo mẫu phổ biến nhất |
| **L3** | **Chuẩn hoá tỉ lệ** (không đoán giá trị): sau khi L2 đã sửa `subjects`/`weight`, nhân mọi `threshold` của rubric với `entryScore / Σthreshold`. Đây là phép co giãn bảo toàn hình dạng, không phải đặt ngưỡng mới. **Thứ tự bắt buộc: L2 xong mới tính L3** (đổi môn ⇒ đổi `Σthreshold`) | `Σthreshold = entryScore` đúng theo định nghĩa. Tuy `hocLucFit` mới **không đọc** `threshold`, L3 vẫn cần vì: (a) `legacyFitPct` (`hoc_luc_mode = 1`) vẫn dùng `threshold` để rollback được; (b) admin vẫn hiển thị `threshold` trong `/admin_career`; để nguyên mâu thuẫn là để lại bẫy cho người sửa sau |
| **L4** | Gắn cờ `entryScore` bất thường, **loại khỏi tính toán** (`hocLucFit = null`, reason `diem_chuan_khong_hop_le`) cho đến khi có nguồn đúng | Không tự đoán giá trị đúng |
| **L5** | Rubric 4 môn: chuyển thành 3 môn theo block, hoặc đánh dấu `is_valid = 0`. 8 block lạ: bổ sung vào `ADMISSION_SUBJECTS` nếu xác định được môn | Không được im lặng bỏ qua |

> **`hocLucFit` mới không phụ thuộc L2/L3.** §17.5 chỉ đọc `entryScore` + tổng thô 3 môn của **tổ hợp**, không đọc `subjects` của rubric và không đọc `threshold`. Vì vậy: **không sửa gì → 135 rubric tính được** (145 − 8 block lạ − 2 `entryScore > 30`); **sửa L5 (thêm 8 block) → 143 rubric**; L2 và L3 **không** đổi con số đó, chỉ để `legacyFitPct`/`calculateCareerFit` và màn hình admin không còn mâu thuẫn.

**Bước 3 — Sửa dữ liệu (0,5–1 ngày) — bắt buộc (D13)**

- Sửa file nguồn `backend/src/data/edumind_rubrics.json` (không sửa `auth.db` bằng tay).
- Viết script re-seed idempotent: xoá rubric cũ theo khoá tự nhiên, insert bản đã sửa. **Chạy bắt buộc theo D13**, có backup `auth.db` trước và dry-run.
- Ghi audit `admin.career.rubric.reseed` với số dòng thay đổi.

**Bước 4 — Test bất biến (bắt buộc, chạy trong `npm test`)**

```text
Nhóm A — bất biến cấu trúc (chạy với mọi rubric hợp lệ):
  0 < entryScore ≤ 30                            // L4 — 2 rubric bị loại, không tính
  subjects.length === 3                          // L5
  Σweight = 1,000 ± 0,001                        // đã đúng

Nhóm B — bất biến nội dung (bắt buộc sau M-0, D13):
  subjects ⊂ BLOCK[admissionBlock]               // L2 (96 rubric)
  |Σthreshold − entryScore| ≤ 0,01               // L3 (13 rubric, sau chuẩn hoá tỉ lệ)

riêng 2 rubric được miễn (is_valid = 0, lý do khong_xac_dinh, KHÔNG tính vào hocLucFit):
  cả hai đều có entryScore > 30; một trong hai cũng có 4 môn
```

Cả 5 bất biến phải **đỏ** trên dữ liệu hiện tại (8 rubric block lạ + 96 rubric lệch môn + 13 rubric lệch tổng ngưỡng) — đó là bằng chứng M-0 chưa xong. Sau M-0 cả 5 phải xanh; không được giả làm xanh bằng cách bỏ test hoặc nới ngưỡng. Không còn nhánh "ghi vào `KNOWN_ISSUES.md` thay cho việc sửa" (D13 đã duyệt).

#### 17.15.2. Ca kiểm thử bổ sung (nối tiếp §17.11)

| # | Ca | Kỳ vọng |
|---|---|---|
| M17 | Rubric có `entryScore = 34,35` | `hocLucFit = null`, reason `diem_chuan_khong_hop_le` |
| M18 | Học sinh đạt **7,0** mỗi môn (T = 21,0), chạy toàn bộ 135 rubric tính được | Trung vị `hocLucFit` ≈ **77** (cũ: 94); số rubric ≥ 95 % = **33** (cũ: 71/145) ⬅ chứng minh giảm bão hoà ở vùng giữa |
| M19 | Cùng học sinh, rubric `P_entry` = 0,97 vs 0,60 | `hocLucFit` chênh ≥ 20 điểm (78 vs 100) ⬅ chứng minh phân biệt được ngành |
| M20 | 145 rubric sau M-0 (bản đầy đủ, D13) | 0 rubric **hợp lệ** còn lỗi L2, L3, L5; đúng **2** rubric ở trạng thái `khong_xac_dinh` (cả hai có `entryScore > 30`, một trong hai cũng có 4 môn) và bị loại khỏi tính toán; 8 rubric block lạ đã được bổ sung vào `ADMISSION_SUBJECTS` ⇒ **143 rubric** tính được; 2 rubric `null` có reason `diem_chuan_khong_hop_le` |
| M21 | `P_entry = 0` (điểm chuẩn dưới đáy phân bố) | `null`, reason `diem_chuan_ngoai_phan_bo`, không chia cho 0 |
| M22 | Học sinh vượt điểm chuẩn nhiều ngành → nhiều `hocLucFit = 100` | Sắp xếp vẫn xác định nhờ `diemVuotChuan`; **không** đổi thứ tự ngẫu nhiên |
| M23 | Chỉ 2 nhóm RIASEC `complete` | `tinhCachFit = null`, reason `chua_du_cau_tra_loi`; UI hiện "cần đủ 10/10 ở ≥ 4 nhóm", **không** vẽ vòng bán kính 0 |

#### 17.15.3. Rủi ro riêng của M-0

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| RM1 | Sửa rubric làm thay đổi kết quả `fitPct` mà người dùng đang thấy | Đây là mục tiêu, không phải tai nạn. Nhưng phải thông báo trong `PROJECT_STATUS.md` và chuẩn bị câu trả lời nếu có phản hồi |
| RM2 | Không biết rubric nào đúng ý đồ gốc khi sửa L2 | Ưu tiên giữ `block` + `entryScore` (dữ liệu tuyển sinh thật), sửa môn. Ghi lại từng thay đổi trong file `RUBRIC_CHANGELOG.md` để truy vết |
| RM3 | Re-seed ghi đè rubric admin đã sửa tay | Script chỉ xoá rubric có khoá tự nhiên khớp file nguồn; báo cáo số dòng sẽ xoá trước khi commit; backup `auth.db` |
| RM4 | 2 rubric vượt thang bị loại → mất 2 ngành khỏi gợi ý | Chấp nhận: thà thiếu còn hơn sai. Hiển thị rõ "chưa có dữ liệu điểm chuẩn hợp lệ" |

#### 17.15.4. Định nghĩa hoàn thành M-0

- [ ] `audit-rubrics.js` chạy được, xuất báo cáo trước/sau.
- [ ] **5** bất biến của §17.15.1 Bước 4 **xanh** (trước khi sửa phải đỏ): 3 nhóm A + 2 nhóm B.
- [ ] Báo cáo số rubric sửa theo từng lớp L2–L5; **đúng 2 rubric** `khong_xac_dinh` được liệt kê công khai; sau L5 có **143 rubric** tính được (trước M-0: 135); 0 rubric hợp lệ còn lỗi L2, L3, L5.
- [ ] `RUBRIC_CHANGELOG.md` ghi từng thay đổi.
- [ ] Backup `auth.db` trước re-seed; hash `learnpath.db` không đổi.
- [ ] Test M17–M23 xanh.
- [ ] Mức bão hoà giảm ở vùng giữa: tại **7,0** mỗi môn, số rubric ≥ 95 % giảm từ **71/145** xuống **≤ 40/135** và trung vị từ **94** xuống **≤ 80** (số liệu đo được hiện tại: **33/135** và **77**).

---

## Phụ lục A — Danh sách tệp sẽ tạo/sửa

**Tạo mới**

```
backend/src/data/interest_instrument_v1.json
backend/src/interest/scoring.js
backend/src/interest/interpretation.js
backend/src/interest/content.js              (nhãn nhóm, chủ đề phản tư, disclaimer)
backend/src/routes/interest.js
backend/src/routes/adminInterest.js              (bảng instrument + trọng số 8×6 `GET/PUT /api/admin/interest/weights`)
backend/test/unit/interestScoring.test.js
backend/test/unit/interestInstrument.test.js
backend/test/integration/interest.test.js
backend/test/integration/adminInterest.test.js
frontend/src/pages/InterestLanding.jsx
frontend/src/pages/InterestRunner.jsx
frontend/src/pages/InterestResult.jsx
frontend/src/components/interest/LikertScale.jsx
frontend/src/components/interest/BipolarScale.jsx
frontend/src/components/interest/InterestProgress.jsx
frontend/src/components/interest/InterestChart.jsx
frontend/src/components/admin/InterestItemsTab.jsx    (tab nhập 108 item: bảng + sửa tại chỗ + import JSON)
frontend/src/components/admin/InterestStatsTab.jsx   (tab thống kê sở thích)
backend/src/career/match.js                   (§17: pBench, P, percentile, tinhCachFit, hocLucFit, tongHopFit, ma trận 3×2)
backend/src/career/matchConfig.js             (§17.10: đọc/ghi career_match_config + cache)
backend/scripts/audit-rubrics.js              (M-0: audit read-only L1–L5, xuất JSON + bảng)
backend/scripts/reseed-rubrics.js             (M-0: re-seed idempotent từ file nguồn, có dry-run)
backend/test/unit/careerMatch.test.js         (M1–M8, M13, M17–M19, M21–M23)
backend/test/unit/rubricInvariants.test.js    (M-0: 5 bất biến (3 nhóm A + 2 nhóm B) + M20, đỏ trước khi sửa dữ liệu)
backend/test/integration/careerRecommendations.test.js  (M9–M12, M14–M16)
RUBRIC_CHANGELOG.md                          (M-0: từng thay đổi rubric, lý do, người duyệt)
frontend/src/components/career/TinhCachMatrix.jsx       (ma trận 3×2 ba tỉ lệ)
frontend/src/components/career/FitBars.jsx              (3 thanh tỉ lệ, dùng khi không vẽ được radar)
```

**Sửa (tối thiểu, đúng phạm vi)**

```
backend/src/auth/authDb.js                   (SCHEMA_VERSION 7, migrate, verify, seed)
backend/server.js                             (mount `interest` sau `requireAuth`; mount `adminInterest` sau `requireAdmin` + CSRF)
backend/src/routes/career.js                  (+2 endpoint §17.9: `benchmark`, `recommendations`; KHÔNG sửa endpoint cũ)
backend/src/routes/adminCareer.js             (+1 endpoint §17.9: `match-config` GET/PUT)
backend/src/auth/career.js                    (+đọc match config; KHÔNG đổi calculateCareerFit)
frontend/src/lib/api.js                       (+9 hàm người dùng, +2 hàm §17: benchmark, recommendations)
frontend/src/lib/adminApi.js                  (+10 hàm quản trị §7.2, gồm `POST .../instruments/import`; +2 hàm match-config)
frontend/src/App.jsx                          (+3 route người dùng, lazy; **không** thêm route admin)
frontend/src/components/admin/AdminShell.jsx  (**không đổi nav** — panel nằm trong `/admin_survey`)
frontend/src/components/admin/AdminOverview.jsx (+1 ô đếm "Lượt làm sở thích")
frontend/src/components/admin/SurveySettingsPanel.jsx (3 tab: giữ tab câu hỏi văn bản, thêm `InterestItemsTab` + `InterestStatsTab`)
frontend/src/components/admin/CareerRubricsPanel.jsx (+tab "Trọng số tính cách" 8×6, +tab "Tham số tổng thể")
frontend/src/components/Layout.jsx            (+banner nhắc)
frontend/src/pages/ThongTinCaNhan.jsx         (+thẻ sở thích, +ô điểm thi theo tổ hợp)
frontend/src/pages/PhanTichNangLuc.jsx        (+3 thanh tỉ lệ, +3 vòng radar, +ma trận 3×2, +cột lý do null; không đổi sort mặc định)
```

**Không đụng:** `MBTI.docx`, `backend/src/database/init.js`, `.github/workflows/ci.yml` (trừ khi muốn thêm bước build — không bắt buộc).

**Ngoại lệ duy nhất với `backend/database/*.db`:** M-0 được phép **re-seed `auth.db`** qua `reseed-rubrics.js` (dry-run trước, backup `auth.db` trước, chỉ chạy khi D13 được duyệt). Không sửa `auth.db` bằng tay, không sửa `learnpath.db` trong bất kỳ trường hợp nào.

## Phụ lục B — Vì sao không nhét vào `survey_questions`

| | `survey_questions` hiện có | Mô-đun mới |
|---|---|---|
| Kiểu câu | `text` / `textarea` | thang 1–5 và −2…+2 |
| Nơi lưu | chuỗi trong `user_profiles.khac` | bảng riêng, từng câu |
| Chấm điểm | không | có, có version |
| Sửa nội dung | sửa tại chỗ, mất dấu vết | copy-on-write theo version |
| Thống kê | không | có |
| Rủi ro | thấp | cần kiểm soát (đã liệt kê §12) |

Giữ nguyên `survey_questions` cho câu hỏi mở của admin — hai cơ chế phục vụ hai mục đích khác nhau. Nếu nhồi 108 câu vào `khac`, mỗi lần nộp sẽ ghi một chuỗi ~10 KB và không bao giờ chấm lại được.

**Hệ quả của D14**: yêu cầu "nhập trực tiếp vào Cài đặt câu hỏi khảo sát" được thực hiện bằng cách thêm 2 tab vào `SurveySettingsPanel` (cùng panel, khác tab), còn dữ liệu **vẫn** nằm ở `interest_*` (schema v7). "Nhập ở đâu" và "lưu ở đâu" là hai câu hỏi khác nhau — đây là điểm khác biệt duy nhất.
