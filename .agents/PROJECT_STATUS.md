# PROJECT_STATUS — LearnPath

> **Status log and session history.**
> Technical sources of truth: `README.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `KNOWN_ISSUES.md`.
> Do not delete old history; append new entries at the end.

## 1. General

- **Name**: LearnPath — career and university-admission guidance.
- **Version**: v1.0.0 (`package.json`).
- **Repo**: `https://github.com/HoaThang34/LearnPath`.
- **Last audit commit**: `5c443c5` — `allowed host fix`.
- **Audit date**: 2026-10-23.
- **State**: runs locally; auth, admin panel, frontend build, API smoke, and admin E2E checks pass; data gaps remain; no commit/push in this session. Real auth DB decision: keep schema v2; first admin to be created by the operator via CLI.

## 2. Actual stack

| Layer | Technology |
|---|---|
| Frontend | React 18.2 + Vite 5 + Tailwind 3 + local shadcn-style components |
| Router | react-router-dom 6 |
| Charts/Markdown | Recharts; react-markdown + remark-gfm + rehype-raw + rehype-slug |
| Backend | Express 4 + `sql.js` 1.10 (SQLite WASM) |
| Admission DB | `backend/database/learnpath.db` (~109 MiB), not committed; public read-only, admin writes via guarded engine |
| Auth DB | `backend/database/auth.db` (small, not committed, present with real data, schema v2), writable |
| Import | `backend/src/database/init.js`; `csv-parse/sync` for candidate CSV |
| Auth | Custom username/password; Node `crypto` scrypt; server-side sessions; separate admin auth/CSRF/audit |
| Tests/CI | Committed `node:test` backend suite (78 tests); GitHub Actions build/test |

## 3. Verification status (2026-10-23)

| Item | Result | Evidence |
|---|---|---|
| Frontend build | Pass | 2,661 modules; `AdminPage` 61.79 kB (gzip 16.22 kB); main JS 1,016.01 kB (gzip 306.89 kB); CSS 32.73 kB (gzip 6.22 kB); >500 kB warning |
| Backend start | Pass | `Database connected`; `Auth database ready`; `Server running on http://localhost:3001` |
| `/api/health` | 200 public | `{status:'ok'}` |
| Data APIs without a session | 401 | All four data groups reject guests |
| Auth API | Pass | Register/login/logout/me/change-password, persistence, 401/403/409/429, CORS/origin, body errors |
| Auth cookie | Pass | HttpOnly/SameSite=Lax/Path=/; `Secure` + 7-day `maxAge` in production |
| Auth DB isolation | Pass | Tests use temp auth DBs; no plaintext password; real auth DB migrated v1→v2 outside tests (disclosed) |
| Admin auth | Pass | Separate cookie/CSRF/session; 8 h absolute, 30 min idle, max 3; disabled admin rejected |
| Admin user CRUD | Pass | Create/bulk/edit/lock/unlock/restore/reset/soft delete; forced change; session revoke |
| Admin data CRUD | Pass | Five tables on temp DB; validation/unique/dependency/force; backup + `quick_check` |
| Admin audit | Pass | Login/logout/user/data actions; secrets stripped; IP hashed; 180-day retention |
| `/api/de-an?limit=2` | 200 authenticated | `total=307`, `data.length=2` |
| `/api/de-an?search=Hà Nội` | 200 authenticated | `total=35` |
| `/api/diem-chuan/stats` | 200 authenticated | `tongTruong=35`, `tongNganh=1297` |
| `/api/khoi-thi` | 200 authenticated | 245 rows (live DB) |
| `/api/khoi-thi/A00` | 200 authenticated | `so_truong=232`, joined 25, BKA 82 majors |
| `/api/diem-thi/stats` | 200 authenticated | `tongThiSinh=1131975` |
| `/api/diem-thi/ranking` | 200 authenticated | `toan=8,van=8,ly=8` → rank 420,859 |
| Invalid pagination | 400 authenticated | `de-an` and `diem-chuan` invalid `limit`/`offset` |
| Temp import | Pass | 281 blocks, 12 zero cells, 5 all-null rows |
| Browser E2E | Pass (temporary) | Headless Chrome: 16 auth/route/UI checks; admin smoke: 19 checks on temp DBs |
| Unit/integration tests | Pass 95/95 | Committed `node:test` suite; temp auth/admission DBs; real DBs untouched |
| Admission DB integrity | Pass | SHA-256 unchanged after API/UI/admin tests |
| Data audit | Gaps | See `KNOWN_ISSUES.md` KI-03, KI-15, KI-17 |

## 4. Data summary

| Source | Format | Count | Table |
|---|---|---|---|
| `data/de_an_tuyen_sinh/` | Markdown | 307 files | `de_an_tuyen_sinh` |
| `data/diem_chuan/*.json` | JSON | 37 school keys / 2,617 marks | `diem_chuan` |
| `data/diem_thptqg_2026/*.csv` | CSV | 1,131,975 rows | `diem_thi_thptqg` |
| `data/khoi_thi/theo_khoi_thi/` | TXT | 260 files → 245 live / 281 parser | `khoi_thi` |
| `data/khoi_thi/theo_truong/` | TXT | 260 files | `truong` |

Live DB coverage:

- 35 distinct score codes/names; 33 join to `truong`; 227/260 schools have no scores.
- 853/2,617 score rows have empty `to_hop_mon`.
- All score rows have `nam=2025`.
- 0 zero score cells; 6 all-null candidate rows.

## 5. Feature status

| Feature | Status | Notes |
|---|---|---|
| Authentication | Works | Register/login/logout/change password; scrypt; 7-day server session; protected routes/APIs; rate limits; forced password change; no self-service reset/MFA |
| Admin panel | Works (hidden) | Separate admin login/cookie/CSRF/audit; overview; user CRUD/bulk/lock/delete/restore; admission CRUD; dependency/force delete |
| Intro video | Works | 4.1 MB; muted fallback handled; size remains a risk |
| Home | Works | Public; marketing stats are static; auth-aware CTA |
| Login/Register | Works | Vietnamese UI; confirmation validation; auto-login; redirect back to the intended page |
| Change password | Works | `/doi-mat-khau`; required after temporary password; revokes other sessions |
| Admission proposals | Works (protected) | 307 rows; real total; detail error/retry fixed; TOC IDs fixed |
| Benchmark scores | Partial (protected) | 5 methods; pagination fixed; `nhom_nganh` removed; data mapping/coverage open |
| Exam blocks | Partial (protected) | 245 live blocks; 281 after rebuild; source vs joined count clarified |
| THPTQG ranking | Partial (protected) | Errors shown; calculation semantics still wrong; warning added |
| Major comparison | Partial (protected) | In Exam blocks; 2–5 items |
| Production deploy | Not configured | Proxy/SPA fallback/TLS/CI missing; auth/admin need HTTPS, `APP_ORIGIN`, and production secrets |

## 6. Session history

### Session 1 — 2026-09-21 (completed)

- Set up Express + `sql.js` backend.
- Set up React + Vite + Tailwind + shadcn-style frontend.
- Imported data, built basic APIs, four UI pages.
- Added `.gitignore` and the first `PROJECT_STATUS.md`.
- Some old descriptions were inaccurate (for example “diem_chuan CSV”); corrected later.

### Session 2 — 2026-09-21 (completed, corrected)

- Added `phuong_thuc` to `diem_chuan`.
- Split five methods from JSON: THPT, HSA, TSA, V-ACT, SAT.
- Added API/UI filters and sorting.
- Corrections:
  - There are **5** methods, not 12.
  - `nhom_nganh` was not implemented; the UI select was a no-op.
  - `de-an` `total` was wrong.

### Session 3 — 2026-10-23 (audit + documentation)

- Read backend/frontend/data; ran build and API smoke checks.
- Created the `.agents/` documentation set, root `AGENTS.md`, and `.agents/scripts/inspect-db.js`.
- Updated `README.md` for the real stack/format.
- No source behaviour changes in that session.
- Found 21 issue groups, including schema drift, ranking, mapping/coverage, and no-op filters.

### Session 4 — 2026-10-23 (fixes + English agent docs)

- Rewrote agent documentation in English.
- Fixed `db.js` schema drift and missing-DB error; added `LEARNPATH_DB_PATH`.
- Fixed `de-an` total and strict pagination for `de-an`/`diem-chuan`.
- Fixed `so_nganh` to case-insensitive distinct majors.
- Fixed CSV/zero-score import and multi-code block parsing; verified in a temp DB (281 blocks, 12 zero cells).
- Removed empty catches; added error/retry states to the main pages.
- Fixed Benchmark scores page search/clear/race; removed `nhom_nganh` UI.
- Fixed the Admission proposals page detail race/error and TOC duplicate IDs.
- Fixed `Button asChild` on the home page; fixed IntroVideo muted retry.
- Fixed zero display in ranking input and score cells.
- Added a ranking-semantics warning to the UI.
- Verified frontend build and API smoke checks.
- **Live DB not rebuilt**; mapping, coverage, year, and ranking semantics still need approval/decisions.
- No commit/push.

### Session 5 — 2026-10-23 (authentication)

- Created and reviewed `plans/user-auth.md` before implementation.
- Added a separate writable auth DB (`backend/database/auth.db`) with versioned schema; the admission DB remains read-only.
- Implemented scrypt password hashing, server-side sessions, HttpOnly cookies, validation, generic login errors, and auth rate limits.
- Added public `/api/auth/register|login|me|logout`, protected all four admission data route groups, and kept `/api/health` public.
- Added CORS origin allowlist, trusted-origin checks for auth POSTs, security headers, 10 kB JSON limit, and JSON error handling.
- Added frontend `AuthContext`, `ProtectedRoute`, `/dang-nhap`, `/dang-ky`, header/mobile auth controls, and redirect-back behavior.
- Verified: auth DB/password/validation checks; API 29/29; headless Chrome E2E 16 checks; production cookie flags; frontend build 2,642 modules; admission DB hash unchanged.
- Updated `AGENTS.md`, `README.md`, and `.agents/` docs for auth, env vars, protected routes, and residual risks.
- No test accounts written to the default auth DB; no commit/push; live admission DB not rebuilt.

### Session 6 — 2026-10-23 (auth hardening Phase 0)

- Reviewed auth/session/rate-limit/password/DB code and wrote `plans/auth-hardening.md` with threat model, risk register, phases 0–6, acceptance matrix, rollback, and decisions.
- Chose D1–D6: ASVS L1 + selected L2, 8-character password with letter/digit, recovery codes, optional TOTP later, single process + lock, no idle timeout with 7-day absolute and max 5 sessions.
- Backed up the live auth DB to `%TEMP%` and recorded SHA-256/size/version/counts; live auth DB and admission DB hashes unchanged.
- Added 7 `node:test` files (49 tests) for password, validation, origin, rate limit, session cookie parsing, auth API, and auth DB.
- Added `test`, `test:unit`, `test:integration`, `test:db` scripts and `.github/workflows/ci.yml`.
- Applied non-breaking `npm audit fix` in frontend (`follow-redirects`, `source-map-js`, `postcss-selector-parser`); build pass.
- No runtime behavior changed; no commit/push/PR.

### Session 7 — 2026-10-23 (admin panel, Phases 1–5)

- Wrote and approved `plans/admin-panel.md` with D1–D10: separate admins/sessions, 8 h/30 min/max 3 policy, strict cookie + CSRF, `sql.js` serialized writes with backup/`quick_check`, soft-delete users, temporary passwords, dependency/force delete, hidden `/admin`, 180-day audit, MFA deferred.
- Implemented auth DB schema v2 (`users` status/forced-change columns, `admins`, `admin_sessions`, `admin_audit`) with backup + transaction migration from v1.
- Added admin auth/session/CSRF/rate-limit/origin/IP allowlist, audit sanitization, and the `admin:create` CLI (create/reset/disable/enable/list).
- Extended user auth: status checks, locked/deleted responses, `last_login_at`, forced password change guard, `POST /api/auth/change-password`, other-session revocation.
- Added admin user APIs (list/search/filter, detail, create, bulk, edit username, lock/unlock/restore/reset/soft delete) and admission data APIs for five tables (metadata, list/search/sort/pagination, create/update/delete, unique/dependency/force rules).
- Added `admissionWrite.js`: serialized writes, backup (max 5), transaction, `quick_check`, atomic export, reload, write-block on failure; `db.js` exports `DB_PATH`/`reloadDb`.
- Built the lazy `/admin` frontend: login, shell/nav, overview, users, data CRUD, audit; separate admin API client/CSRF handling; `noindex` + `robots.txt`.
- Built `/doi-mat-khau` and forced-change redirects.
- Verified: 78/78 backend tests; admin E2E smoke 19 checks on temp DBs; frontend build 2,661 modules with a separate `AdminPage` chunk; real admission DB hash unchanged.
- Real auth DB was found migrated from v1 to v2 outside the test suite (cause not established); backup `auth.db.v1-backup-20261023141514808`; it has 0 admins, so admin login requires the CLI.
- No commit/push/PR.

## 7. Priorities

### P1 — correctness/data

- [ ] KI-02: decide ranking semantics, then fix query/bins.
- [ ] KI-03a: correct 5 mappings + add DNV/FPT and target schools.
- [ ] KI-03b: decide coverage/proposal-school policy.
- [ ] KI-03c/KI-17: rebuild the real DB with the fixed importer (approval + backup).
- [ ] KI-15: decide 2025 vs 2026 year semantics.

### P2 — UX/stability

- [ ] KI-10/KI-20: compress/lazy-load the intro video.
- [ ] KI-11: split the 1,016 kB main JS bundle.
- [ ] KI-12: remaining data/API/import tests, lint, E2E (auth/admin tests and CI done).
- [ ] KI-18: add CSP and request/audit logging; sanitize raw Markdown if it becomes untrusted.
- [ ] KI-19: define stats semantics.
- [ ] KI-22: decide whether to add self-service password reset/MFA and a shared auth store before multi-instance deployment.
- [ ] Admin MFA/TOTP (optional Phase 6 of `plans/admin-panel.md`).

### P3 — completion

- [ ] KI-21 browser check for duplicate TOC links.
- [ ] Production proxy/SPA fallback/health checks + HTTPS/`APP_ORIGIN`.

## 8. Update log

| Date | Version | Description |
|---|---|---|
| 2026-09-21 | v1.0.0 | Initial backend + frontend |
| 2026-09-21 | v1.0.0 | Added admission methods + filters/sorting |
| 2026-10-23 | v1.0.1-docs | Full audit; `.agents/` docs + `AGENTS.md` + rules + inspect script; README update |
| 2026-10-23 | v1.0.2-fixes | Runtime/API/UI fixes; English agent docs; temp import verification; live DB rebuild pending |
| 2026-10-23 | v1.0.3-auth | Username/password auth, separate auth DB, protected routes/APIs, rate limits/CORS/security headers, auth tests/E2E, docs |
| 2026-10-23 | v1.0.4-tests | Auth hardening plan; Phase 0 backup, 49 `node:test` checks, CI, non-breaking audit fix |
| 2026-10-23 | v1.0.5-admin | Admin panel Phases 1–5: auth DB v2, separate admin auth/CSRF/audit, user management, admission CRUD, hidden `/admin`, 78 tests, admin E2E 19 checks |
| 2026-10-23 | v1.0.6-data-crud | Bổ sung và hoàn thiện tính năng admin: chỉnh sửa đề án tuyển sinh (Markdown preview), chỉnh sửa điểm chuẩn (gợi ý phương thức/năm), thêm dữ liệu mới thủ công 5 bảng, chuyển bảng nhanh từ Overview và DataPanel; 81 tests pass |
| 2026-10-23 | v1.0.7-profile | Bổ sung mục "Thông tin cá nhân" (họ tên, lớp, trường, điểm các môn trên lớp tự do, chứng chỉ TSA/HSA/IELTS..., mục tiêu trường/ngành, tổ hợp 3 môn thi, freestyle text), auth DB schema v3 (`user_profiles`), API `GET/PUT /api/auth/profile`, 84 tests pass |
| 2026-10-24 | v1.0.8-profile-password | Bổ sung hiển thị `username` chỉ xem (read-only, không thể sửa) trên trang Thông tin cá nhân; bổ sung tính năng đổi mật khẩu trực tiếp qua Modal/Card bảo mật và trên thanh điều hướng Layout (Desktop + Mobile); kiểm thử 84/84 tests pass và frontend build thành công |
| 2026-10-24 | v1.0.9-survey | Triển khai bài khảo sát khởi đầu (Onboarding Survey /khao-sat) cho người dùng mới; lưu câu hỏi cố định vào user_profiles; quản lý câu hỏi custom tại trang cài đặt Admin (/admin -> Cài đặt khảo sát), lưu custom questions vào profile mục Khác theo định dạng: Câu hỏi - Câu trả lời từ user; auth DB schema v4 (thêm users.survey_completed, survey_questions); thanh nhắc nhở khảo sát trên Layout; 87 tests pass, frontend build pass |
| 2026-10-24 | v1.0.10-admin-subroutes | Phân chia admin panel thành các URL subpages riêng biệt (/admin_home, /admin_user, /admin_survey, /admin_data, /admin_audit) đồng bộ với browser history/title; rà soát toàn bộ các chức năng cài đặt khảo sát (fix submit phím Enter, gõ xoá số thứ tự orderIndex, chống race-condition toggle active với spinner, đếm 500 ký tự, word-wrap chống vỡ layout, auto-dismiss toast); chống trùng lặp dòng khi nộp lại khảo sát; 87 tests pass, frontend build pass |
| 2026-10-24 | v1.1.0-career-analysis | Triển khai MVP Phân tích năng lực & Định hướng ngành: auth DB schema v6, điểm cấu trúc dùng chung profile/survey/career, lựa chọn target/pinned, rubric admin, API career, UI `/phan-tich-nang-luc`, fit/radar theo độ phủ và dữ liệu điểm chuẩn 2025 |
| 2026-10-24 | v1.1.1-fix-blank-pages | Khắc phục triệt để lỗi trang trắng tại "Thông tin cá nhân" (thiếu import Plus, Trash2 từ lucide-react) và "Phân tích năng lực" (thiếu import Label, Input và bổ sung defensive null check trong RadarChart/fit.details); bổ sung ErrorBoundary bọc toàn bộ route Layout & Admin để bắt mọi lỗi render đột xuất kèm fallback tiếng Việt thân thiện; 92 tests pass, frontend build pass |
| 2026-10-24 | v1.1.2-major-sorting | Bổ sung tính năng sắp xếp đa tiêu chí cho mục "Khám phá ngành và điểm chuẩn" (theo trường A-Z/Z-A, theo điểm chuẩn cao-thấp/thấp-cao, theo tỉ lệ đỗ cao-thấp/thấp-cao) trên cả 2 tầng Backend API (`/api/career/majors?sort=...`) và Frontend UI; tính toán tỉ lệ đỗ toàn tập trước phân trang và đưa null về cuối; 93 tests pass, frontend build pass |
| 2026-10-24 | v1.1.3-ngrok-support | Khắc phục lỗi "Nguồn yêu cầu không hợp lệ" (HTTP 403) khi đăng nhập qua ngrok: mở rộng `isOriginAllowed` tự động chấp nhận domain tunnel ngrok (*.ngrok-free.app, *.ngrok.app, *.ngrok.io, *.loca.lt) và wildcard trong APP_ORIGIN; bổ sung header `ngrok-skip-browser-warning` trong API client; 95 tests pass, frontend build pass |
| 2026-10-24 | v1.1.4-rubric-results | Hoàn thiện toàn diện chức năng "Kết quả rubric": liên kết chặt chẽ ngành mục tiêu (target) và ngành quan tâm (pinned) lên đầu với badge phân loại; phân cấp trạng thái fit (Rất phù hợp ≥90%, Phù hợp 75-89%, Cần nỗ lực <75%); chi tiết từng môn kèm trọng số, ngưỡng, gap và progress bar; phát hiện gợi ý ưu tiên cải thiện (prioritySubject); mô phỏng điểm giả định real-time kèm radar nét đứt tím; đối chiếu so sánh 2 rubric song song; bổ sung 6 rubric mẫu chuẩn 2025 (BKA, KHA, NTH, SPH), mẫu template khối thi (A00, A01, B00, C00, D01, D07) và tra cứu nhanh từ diem_chuan trong Admin; 99/99 tests pass, frontend build pass |
| 2026-10-25 | v1.1.5-edumind-rubric-browse | Nạp trọn vẹn dữ liệu thông tin trọng số và ngưỡng đạt từ EduMind AI (145 ngành thuộc 41 trường đại học lớn trên cả nước, 8 nhóm ngành) vào hệ thống LearnPath (`backend/src/data/edumind_rubrics.json`); mở rộng schema authDb (`major_group`, `entry_score`); nâng cấp giao diện `/phan-tich-nang-luc` chuẩn theo mẫu EduMind AI: lưới card 3 cột hiển thị Tên ngành, Tên trường, Điểm phù hợp fit %, Checkbox so sánh, Khối | Điểm chuẩn 2025, Tag nhóm ngành, Thanh progress bar fit, Biểu đồ Radar năng lực SVG 240px (điểm học sinh vs ngưỡng ngành vs điểm mô phỏng), Dòng xu hướng (sparkline 3 năm + biến động), Nút Ghim & Mục tiêu; bộ lọc đầu trang (tìm kiếm, dropdown Trường, Khối thi, Nhóm ngành, toggle Đã ghim, Đã chọn, slider Min Fit 0-100%); thanh sắp xếp (Phù hợp nhất, Điểm chuẩn cao-thấp, Điểm chuẩn thấp-cao, Tên A-Z); modal Mô phỏng điểm giả định real-time cho 8 môn học; modal và thanh nổi đối chiếu so sánh side-by-side tối đa 4 ngành; 99/99 tests pass, frontend build pass |
| 2026-10-25 | v1.1.6-career-map | Bổ sung chức năng Bản đồ ngành học (Career Map): tích hợp tab switcher 2 lựa chọn tại `/phan-tich-nang-luc` ("Phân tích năng lực & Duyệt ngành học" và "Bản đồ (xem vị trí của bạn nằm ở đâu và phù hợp với ngành học nào)"); đồ thị liên kết lực D3 force-directed: node "Bạn" ở trung tâm phát sáng đa lớp, các node ngành phân cụm góc theo nhóm ngành và hướng tâm theo độ phù hợp fit %; kích thước node theo điểm chuẩn 2025; liên kết tương đồng cosine similarity giữa các ngành và liên kết nét đứt đỏ top ngành phù hợp nhất; bộ lọc tìm kiếm, bộ lọc bật/tắt nhóm ngành, ẩn ngành < 50% fit, zoom + / - / reset view; ngăn kéo chi tiết khi click node (môn yêu cầu, trọng số, điểm thực tế, gap, đặt mục tiêu, ghim quan tâm, thêm vào đối chiếu so sánh); endpoint `GET /api/career/map-data` và API client `getCareerMapData`; 100/100 tests pass, frontend build thành công |
| 2026-10-25 | v1.1.7-target-sync | Nâng cấp "Mục tiêu xét tuyển" tại "Thông tin cá nhân" và "Khảo sát": thay thế nhập thủ công bằng component `TargetMajorSelector` chọn/tìm kiếm trường và ngành có sẵn trong dữ liệu Phân tích năng lực (tìm kiếm không dấu, hiển thị mã trường, khối, điểm chuẩn 2025, thẻ liên kết mục tiêu, chế độ nhập tự do dự phòng); liên kết đồng bộ hai chiều giữa `user_profiles` (`truong_muc_tieu`, `nganh_muc_tieu`) và `career_selections` (`kind = 'target'`); endpoint mới `GET /api/career/target-options`; hiển thị pill mục tiêu trên thanh học sinh của trang Phân tích năng lực; 101/101 tests pass, frontend build thành công |
| 2026-10-25 | v1.1.8-home-redesign | Tái thiết kế toàn diện Trang chủ (`frontend/src/pages/TrangChu.jsx`): Khách vãng lai (chưa đăng nhập) được giới thiệu tổng quan hệ thống, số liệu thống kê (200+ trường, 145+ rubric, 2.6k+ điểm chuẩn, 1.1M+ thí sinh), 5 tính năng cốt lõi và giao diện 2 nút Đăng nhập / Đăng ký nổi bật; Người dùng đã đăng nhập hiển thị thông tin cơ bản (họ tên, username, lớp, trường, tổ hợp mong muốn, tình trạng điểm) cùng 2 Bảng phân tích rubric trực quan: Bảng 1 (Ngành học mục tiêu) và Bảng 2 (Ngành học phù hợp nhất) kèm biểu đồ radar SVG MiniRadar và bảng chi tiết môn/trọng số/ngưỡng/điểm bạn/gap/đánh giá; Xử lý đầy đủ các trạng thái biên: cảnh báo yêu cầu nhập điểm các môn khi chưa có điểm, cảnh báo tình trạng chưa chọn ngành mục tiêu kèm nút điền ngay, hỗ trợ đặt nhanh ngành phù hợp nhất làm mục tiêu; 101/101 tests pass, frontend build thành công |
| 2026-10-25 | v1.1.9-fix-home-guest-error | Khắc phục lỗi hiển thị màn hình ErrorBoundary khi chưa đăng nhập tại trang chủ: bổ sung import `Users` từ `lucide-react` trong `TrangChu.jsx` (trước đó thiếu gây `ReferenceError: Users is not defined` ở Card thống kê thí sinh); kiểm chứng headless CDP xác nhận giao diện render hoàn hảo `hasErrorBoundary: false` với tiêu đề và 2 nút Đăng nhập / Đăng ký; 101/101 tests pass, frontend build pass |
| 2026-10-25 | v1.2.0-shadcn-minimal-home | Chuyển đổi toàn bộ phong cách Trang chủ sang basic UI shadcn tối giản, trung tính, không hiệu ứng hay màu mè rực rỡ: tiêu đề chuẩn hóa "LearnPath - Hệ thống hỗ trợ cá nhân hoá định hướng ngành học", đoạn giới thiệu súc tích, 2 nút Đăng nhập/Đăng ký chuẩn shadcn button, 5 card tính năng nổi bật phong cách card shadcn đơn sắc; Ẩn hoàn toàn thanh menu điều hướng phía trên khi ở trang chủ chưa đăng nhập (`hideNavMenu = !user && location.pathname === '/'`), giữ lại logo và 2 nút đăng nhập/đăng ký ở header; 101/101 tests pass, frontend build thành công |
| 2026-10-25 | v1.2.1-logo-and-heading-tuning | Tinh chỉnh tỉ lệ trang chủ theo yêu cầu: tăng kích thước logo từ `h-20` (80px) lên `h-32 sm:h-36 md:h-40` (~144px, tăng gần gấp đôi độ rõ nét và nổi bật); giảm cỡ chữ tiêu đề chính từ `text-3xl sm:text-4xl md:text-5xl` (48px) xuống `text-xl sm:text-2xl md:text-3xl` (24px, vừa vặn không bị gãy dòng thô); giảm cỡ chữ phần mô tả giới thiệu xuống `text-xs sm:text-sm` (14px); 101/101 tests pass, frontend build thành công |
| 2026-10-25 | v1.2.2-hide-nav-auth-pages | Ẩn thanh menu điều hướng phía trên tại trang đăng nhập (`/dang-nhap`) và đăng ký (`/dang-ky`): mở rộng `hideNavMenu = (!user && location.pathname === '/') || isAuthPage`, ẩn `menuItems` và mobile hamburger menu; tối ưu nút hành động phía trên bên phải (trên trang đăng nhập chỉ hiển thị nút Đăng ký, trên trang đăng ký chỉ hiển thị nút Đăng nhập); kiểm chứng CDP tự động xác nhận `navItems: []` trên cả 3 trang; 101/101 tests pass, frontend build thành công |
| 2026-10-31 | v1.3.0-interest-match | Triển khai mô-đun Khám phá sở thích nghề nghiệp (108 câu: 60 RIASEC + 48 cặp; schema v7; 3 trang; lưu nháp 10 chặng; chấm điểm T1–T14; admin nhập/sửa/kích hoạt trong /admin_survey) và lớp tổ hợp điểm × sở thích (percentile hocLucFit, tinhCachFit, tongHopFit, ma trận 3×2, benchmark/recommendations, admin weights/match-config). M-0 chuẩn hoá edumind_rubrics.json: 143 valid, 2 excluded, L2/L3/L5 = 0 trên rubric hợp lệ; M18 median 77.6, 33/143 ≥95. 171/171 backend tests pass; frontend build pass (InterestRunner/Result lazy); learnpath.db không đổi; auth.db đã migrate v6→v7 và reseed rubric (backup auth.db.v6-backup-20261031130214132, auth.db.pre-m0-20261031130214177). |
| 2026-11-01 | v1.3.1-comprehensive-radar | Nâng cấp biểu đồ radar năng lực "mạng nhện" theo phương diện toàn diện tất cả các môn: bổ sung mô hình trọng số phân tầng 75/25 (75% cho các môn tổ hợp xét tuyển cốt lõi của ngành theo rubric + 25% cho các môn nền tảng học thuật với ngưỡng sàn học lực khá 6.5); bổ sung nút chuyển đổi linh hoạt (Toggle Switch) giữa "Toàn diện tất cả môn (75/25)" và "Chỉ 3 môn tổ hợp" ở thanh bộ lọc đầu trang và trên từng thẻ card ngành học (`/phan-tich-nang-luc` và `TrangChu.jsx`); hỗ trợ mô phỏng điểm real-time cho toàn bộ 8+ môn học; trực quan hóa phân biệt môn tổ hợp chính (★) và môn nền tảng trên đỉnh radar và chip điểm; 172/172 backend tests pass, frontend build pass. |
| 2026-11-01 | v1.3.2-enlarged-interactive-radar | Tối ưu hóa biểu đồ mạng nhện và thẻ ngành theo yêu cầu người dùng: (1) Phóng to biểu đồ mạng nhện (kích thước canvas 280x280, bán kính 86-96px, diện tích hiển thị tăng ~65-80%); (2) Giảm tải thông tin trên biểu đồ tĩnh: loại bỏ các chuỗi điểm số tĩnh chật chội trên các tia, chỉ giữ lại tên môn viết gọn rõ ràng kèm dấu sao (★) cho môn chính; (3) Tương tác rê chuột động (Spoke hover): khi rê vào tia/đỉnh môn học, hiển thị pill trạng thái chi tiết (Điểm bạn/Ngưỡng/Gap) bên dưới radar; khi ở trạng thái nghỉ hiển thị 3 vòng tròn đồng tâm (Học lực, Tính cách, Tổng thể); (4) Thiết kế thẻ ngành gọn gàng ở trạng thái nghỉ và chỉ hiển thị tất cả thông tin phân tích chuyên sâu (FitBars 3 tỉ lệ, Ma trận tính cách TinhCachMatrix, Xu hướng 3 năm Sparkline, Chip điểm từng môn) khi trỏ chuột vào ngành đó hoặc bấm xem chi tiết; (5) Đồng bộ số liệu tổng quan trên đầu thẻ ngành thành "Phù hợp tổng thể" (kết hợp Học lực 60% + Tính cách 40%) thay vì chỉ hiển thị học lực riêng lẻ; 172/172 backend tests pass, frontend build pass. |
| 2026-11-01 | v1.4.1-bipolar-chart | Bổ sung biểu đồ lưỡng cực cho Phần 2 (4 cặp E–I, S–N, T–F, J–P): `BipolarAxisChart.jsx` vẽ một biểu đồ phân kỳ chung (trái = chữ thứ nhất/+24, phải = chữ thứ hai/−24, giữa = 0, cột D kèm mức nghiêng, cặp thiếu dữ liệu không có điểm); gom quy ước dấu vào `frontend/src/lib/bipolar.js` để `BipolarBars` và biểu đồ mới dùng chung; thêm `npm test` cho frontend với 7 test hồi quy (B1–B7) khoá đúng giá trị ảnh chụp (E–I D=−9 → 68,75 % bên phải; S–N, T–F D=0 → giữa; J–P D=+2 → 45,83 % bên trái). 187/187 backend tests, 7/7 frontend tests, frontend build pass; learnpath.db không đổi. |
| 2026-11-01 | v1.4.0-group-fit | Thêm mô hình ba thành phần F_m = w_L·L + w_H·H + w_M·M cho 12 khối ngành: `career_group_weights.json` (so sánh cặp, trung bình nhân; CNTT 0,54994561/0,24021087/0,20984352), `career_major_groups.json` (132/132 ngành ánh xạ 1:1), `career_subject_priorities.json` (143 dòng, r = 4/3/2/1) và `career_mbti_profile.json` (status `chua_xac_dinh`, c/t = null nên M = null kèm lý do thay vì tự gán). Sinh cấu hình bằng `backend/scripts/derive-career-weights.js`; thêm `career/hocLuc.js`, `career/mbti.js`, `career/groupMatch.js`; `GET /api/career/group-config` và `GET /api/admin/career/group-config` (tab “Trọng số 12 khối” trong /admin_career); UI `GroupFitPanel` trong thẻ ngành. Sửa lỗi chiếu thanh MBTI: vị trí = 100·(24−D)/48, chữ thứ nhất bên trái (backend D không đổi). 187/187 backend tests (W1–W14 + G1), frontend build pass; learnpath.db không đổi. |
| 2026-11-01 | v1.3.3-collapsible-sidebar | Nâng cấp thanh menu dọc bên trái (sidebar) cho phép thu nhỏ vào (collapsed, 72px) và mở rộng ra (expanded, 256px): (1) Nút bấm thu nhỏ/mở rộng ở đầu sidebar và trên thanh header cạnh tiêu đề trang; (2) Lưu trạng thái thu phóng vào localStorage ('learnpath_sidebar_collapsed') để ghi nhớ qua các phiên duyệt trang; (3) Chế độ thu nhỏ hiển thị icon căn giữa, tooltip hover nền tối sang trọng cho cả menu và các nút hành động tài khoản (Đổi mật khẩu, Đăng xuất); (4) Hỗ trợ phím tắt tiện lợi `Ctrl + B` để đóng/mở nhanh thanh menu; (5) Hiệu ứng chuyển động mượt mà (transition duration 300ms); 172/172 backend tests pass, frontend build pass. |
| 2026-11-01 | v1.4.2-career-config-admin | Thêm đường ghi admin cho cấu hình nghề nghiệp mà không đổi schema auth DB: `backend/src/career/configStore.js` validate → sao lưu JSON trong `backend/database/backups/` (giữ 5 bản/tệp) → ghi atomic → xóa cache; audit `admin.career.group_weights.update` và `admin.career.subject_priorities.update`. API mới: `GET /api/admin/career/group-config/priorities` (143 dòng kèm khóa), `PUT .../groups` (mỗi khối dương, tổng 1 ± 0,002), `PUT .../priorities` (giữ nguyên bộ môn, r nguyên 1–4; không thêm/bớt môn). Tab “Trọng số 12 khối” trong `/admin_career` sửa trực tiếp theo %, có chuẩn hoá/hoàn tác và tìm kiếm 143 dòng ưu tiên môn; lưu không thay đổi trả `changed: false` và không ghi audit. `derive-career-weights.js --write` từ chối ghi đè tệp đã có `updatedAt` trừ khi thêm `--force`. 206/206 backend tests (U1–U10 + 8 subtest API), 7/7 frontend tests, frontend build pass; learnpath.db không đổi (SHA-256 `C06329AD8FBB3B8FCC87FAEEB16D5B9ECEA9E8DCB2A19E660B24824ED0ED0F05`). |
| 2026-11-01 | v1.4.3-mbti-profile-admin-bundle | Hoàn thiện toàn diện 3 tồn đọng: (1) MBTI profile đã thẩm định & tính $M_m, F_m$ thành số thực cụ thể (status: "xac_dinh", $c=1.0, t=1$, $M_m \in [0, 100]$); thêm API `GET/PUT /api/admin/career/group-config/mbti`, sao lưu JSON, ghi atomic, audit `admin.career.mbti_profile.update`; thêm Card quản trị MBTI trực quan trong `/admin_career` cho phép chỉnh sửa trực tiếp, nạp mẫu chuẩn và lưu cấu hình; (2) Tối ưu hóa bundle size (KI-11) bằng `manualChunks` tách vendor Recharts, D3, Markdown, Lucide, giảm chunk chính từ 1,275 kB xuống còn 350.43 kB (gzip 96.16 kB), triệt tiêu hoàn toàn cảnh báo > 500 kB; (3) Khóa KI-26 với chứng minh toán học 62/64 bộ trọng số trên 143/145 rubric; (4) Kiểm thử tự động trên trình duyệt thực tế Chrome Headless (CDP) xác thực 100% luồng đăng nhập Admin, sửa MBTI, lưu disk, kiểm tra 56 dòng bảng trọng số, đăng nhập người dùng và hiển thị trang `/phan-tich-nang-luc`; 212/212 backend tests pass, 7/7 frontend tests pass, build pass; learnpath.db nguyên vẹn (SHA-256 `C06329AD8FBB3B8FCC87FAEEB16D5B9ECEA9E8DCB2A19E660B24824ED0ED0F05`). |
| 2026-11-07 | v1.4.4-desired-certificates | Bổ sung mục "Chứng chỉ bạn mong muốn có trong thời gian tới (TSA, HSA, V-ACT, IELTS,...)" tại trang "Thông tin cá nhân" (`/thong-tin-ca-nhan`): ghi nhận mục tiêu các chứng chỉ ĐGNL, ĐGTD, ngoại ngữ và mức điểm kỳ vọng trong tương lai; mở rộng bảng `user_profiles` với cột `chung_chi_mong_muon TEXT` (tự động kiểm tra và thêm an toàn qua `ensureColumn` không phá vỡ DB); cập nhật đồng bộ các tầng backend (`authDb.js`, `userProfile.js`, `career.js`, `survey.js`), kiểm thử integration API `GET/PUT /api/auth/profile`; giao diện chuẩn card shadcn, datalist gợi ý chứng chỉ, thêm/sửa/xóa real-time, thông báo trạng thái rõ ràng; 217/217 backend tests pass, 7/7 frontend tests pass, frontend build hoàn tất. |
| 2026-11-07 | v1.5.0-personalized-ai-agent | Bổ sung Chức năng Trợ lý AI cá nhân hóa (Agent AI chatbot) với Ollama Beam Cloud (`beam:cloud`): tích hợp native tool-calling đọc toàn bộ dữ liệu hồ sơ, học bạ, điểm thi tự khai, trắc nghiệm sở thích Holland RIASEC, phân tích năng lực (Fit ranking, Fit detail, TinhCachMatrix), tra cứu điểm chuẩn và xếp hạng thi tốt nghiệp THPT; schema auth DB v8 (`chat_conversations`, `chat_messages`, `agent_usage`, `agent_consents`); API `/api/agent/*` với Server-Sent Events (SSE), kiểm tra nguồn trusted origin, rate limit (burst và daily quota), xác nhận đồng ý (consent dialog); giao diện tab mới "Trợ lý AI" (`/tro-ly-ai`) trong menu, sidebar quản lý lịch sử hội thoại, composer gợi ý câu hỏi nhanh, ArtifactRenderer trực quan hóa biểu đồ (Fit ranking, FitBars, Radar sở thích, bảng điểm chuẩn, xếp hạng); 243/243 backend tests pass, 7/7 frontend tests pass, frontend build pass. |
| 2026-11-08 | v1.5.1-university-curriculum | Bổ sung tab mới "Chương trình học" (`/chuong-trinh-hoc`) trên thanh điều hướng menu cho học sinh/người dùng tra cứu lộ trình đào tạo, môn học theo từng học kỳ của các trường và ngành; dữ liệu ban đầu để trống; tab quản trị "Chương trình học" (`/admin_curriculum`) cho admin thêm/sửa/xóa theo cấu trúc phân cấp: Trường -> Ngành -> Chương trình học của ngành (thông tin chung, các học kỳ & môn học, đề cương Markdown chi tiết có Preview); schema auth DB v9 (bảng `curriculums`); API `/api/chuong-trinh-hoc/*` và `/api/admin/curriculum/*` có audit trail; 245/245 backend tests pass, 22/22 frontend tests pass, frontend build hoàn tất. |
| 2026-11-23 | v1.5.2-ai-provider-switch | Chuyển backend của Trợ lý AI từ Ollama Beam Cloud sang API tương thích OpenAI tại `https://motapis.com/v1`, model `deepseek-v4-flash`; khóa và cấu hình được cập nhật trong `backend/.env` (giữ tên biến `OLLAMA_*` để tương thích). `backend/src/agent/ollama.js` giữ tên module/function cũ nhưng gửi `POST /chat/completions`, map tool calls và `usage.total_tokens`, tool result dùng `tool_call_id`; `loop.js` bỏ field `tool_name` riêng của Ollama. Thêm 5 test đơn vị cho client (AI C1–C5) và cập nhật mock integration theo response OpenAI. Phát hiện AAAA của nhà cung cấp gây `ECONNRESET` với `fetch`, nên `config.js` đặt `dns.setDefaultResultOrder('ipv4first')`. 252/252 backend tests pass; smoke thật với khóa được cấu hình trả `OK` và hoàn thành vòng tool-call; SHA-256 `learnpath.db` không đổi; không thêm dependency, không commit/push. |
