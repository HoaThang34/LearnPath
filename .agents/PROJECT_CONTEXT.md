# PROJECT_CONTEXT — LearnPath

> Read this to understand **what the product does, where the data comes from, how it runs, and where its limits are**.
> API/schema details are in `ARCHITECTURE.md`.

## 1. Goal and users

- **Product**: LearnPath — a career and university-admission guidance website.
- **Users**: Vietnamese high-school students and parents.
- **Core value**: look up admission proposals, benchmark scores, exam blocks, and THPTQG 2026 score ranking.
- **Current scope**: admission data is read-only for normal users and editable by admins through a hidden `/admin` area. Quản trị viên có thể:
  + Chỉnh sửa đề án tuyển sinh (`de_an_tuyen_sinh`: mã trường, tên trường, nội dung Markdown với tab xem trước, nguồn).
  + Chỉnh sửa điểm chuẩn (`diem_chuan`: mã trường, tên trường, ngành, tổ hợp môn, điểm chuẩn, ghi chú, năm, phương thức xét tuyển).
  + Thêm dữ liệu mới (thêm thủ công) cho toàn bộ 5 bảng dữ liệu tuyển sinh (`khoi_thi`, `truong`, `diem_chuan`, `diem_thi_thptqg`, `de_an_tuyen_sinh`).
  Home and auth pages are public; accounts, sessions, admins, and audit live in a separate auth DB. Normal users cannot access admin APIs.
- **Out of scope for now**: application submission, personalised recommendations, multi-year comparison, self-service password reset, email verification, MFA/TOTP, admin MFA.

## 2. Features

| Page | Route | What it does | Main API |
|---|---|---|---|
| Home | `/` | Introduction, four feature cards, usage guide, marketing stats | None |
| Login | `/dang-nhap` | Username/password login; returns to the protected page | `/api/auth/login`, `/api/auth/me` |
| Register | `/dang-ky` | Create account with password confirmation; auto-login | `/api/auth/register` |
| Change password | `/doi-mat-khau` | Change password; mandatory after an admin-issued temporary password | `/api/auth/change-password` |
| Admin | `/admin` (hidden) | Separate admin login; overview, user management, admission CRUD (chỉnh sửa đề án tuyển sinh, chỉnh sửa điểm chuẩn, thêm mới thủ công cả 5 bảng), audit | `/api/admin/*` |
| Admission proposals | `/de-an` | Pick a school → read Markdown and table of contents (login required) | `/api/de-an`, `/api/de-an/:maTruong` |
| Benchmark scores | `/diem-chuan` | Pick a method → filter/sort → paginated table (login required) | `/api/diem-chuan`, `/phuong-thuc`, `/stats`, `/compare` |
| Exam blocks | `/khoi-thi` | Pick a block → school → majors; compare 2–5 majors (login required) | `/api/khoi-thi`, `/api/khoi-thi/:maKhoi` |
| THPTQG ranking | `/thu-hang` | Enter scores → rank and distribution chart (login required) | `/api/diem-thi/ranking`, `/api/diem-thi/stats` |

Notes:

- The four feature routes and their data APIs require a valid `lp_session` cookie. `/api/health` and `/api/auth/*` are public.
- `/admin` uses a separate admin cookie and CSRF token; it is lazy-loaded, noindex, and not linked from the public UI. A normal user session never grants admin access.
- Users with `mustChangePassword` are redirected to `/doi-mat-khau` before any protected page or data API.
- The Benchmark scores page no longer exposes `nhom_nganh`; the backend endpoint and the ignored query parameter remain for legacy compatibility.
- The Exam blocks page labels the source count as “trường xét tuyển” and shows the actual number of joined schools with score data.
- The ranking page displays a warning that the current calculation is not a subject-combination ranking.

## 3. Tech stack and runtime

| Layer | Technology |
|---|---|
| Frontend | React 18.2 + Vite 5 + Tailwind 3; local shadcn-style components |
| Routing / HTTP | react-router-dom 6; axios with base URL `/api` |
| Charts / Markdown | Recharts; react-markdown + remark-gfm + rehype-raw |
| Backend | Express 4 + `sql.js` 1.10 (SQLite compiled to WebAssembly) |
| Admission DB | `backend/database/learnpath.db` (~109 MiB), not committed; public APIs read it, admins write through a guarded engine |
| Auth DB | `backend/database/auth.db` (small, auto-created if missing, not committed; present with real data, schema v2), writable |
| Import | `backend/src/database/init.js` |
| Auth | Custom username/password; Node `crypto` scrypt; server-side sessions; separate admin auth/CSRF/audit; `sql.js` auth DB |
| Tests / lint / CI | Committed backend `node:test` suite (78 tests) + GitHub Actions (tests/build/audit); lint and E2E not committed |

Runtime facts:

- `sql.js` loads the admission DB file into RAM at startup. Public requests never write it; admin CRUD writes through a serialized backup/transaction/`quick_check`/atomic-save/reload engine.
- The auth DB is a separate `sql.js` file. Registration/login/logout, admin auth, user management, and audit write only that file.
- Vite proxies `/api` to `http://localhost:3001` in development.
- Production needs a reverse proxy for `/api`, HTTPS, an SPA fallback to `index.html`, the correct `APP_ORIGIN`, and production secrets for admin CSRF/IP hashing.
- The backend refuses to start if the admission DB is missing. It does not create an old schema (fixed in KI-01).
- The auth DB schema is versioned with `PRAGMA user_version = 2`; v1 is migrated with a backup. An incompatible or incomplete auth DB stops startup.
- Default user cookie: `lp_session`, HttpOnly, SameSite=Lax, Path=/, 7 days, `Secure` when `NODE_ENV=production`.
- Default admin cookie: `lp_admin_session` (`__Host-lp_admin_session` in production), HttpOnly, SameSite=Strict, Path=/, 8 h absolute/30 min idle, `Secure` in production.
- If behind a trusted reverse proxy, set `TRUST_PROXY=1`; otherwise leave it unset to avoid spoofed client IPs.

### Authentication and access

- Register fields: username, password, password confirmation. Username is 3–32 ASCII letters/digits/`.`/`_`/`-`, starting and ending with a letter/digit. Password is 8–128 characters with at least one letter and one digit.
- Password hashes use scrypt (`N=32768, r=8, p=1`) with a 16-byte random salt. Login is case-insensitive for the username.
- Sessions are server-side; the auth DB stores only SHA-256 hashes of random session tokens. Logout deletes the current session. Changing a password revokes other sessions.
- User statuses: `active`, `locked`, `deleted` (soft delete keeps the username and can be restored). Locked/deleted users cannot log in; sessions are revoked on lock/delete.
- Admin-created users and password resets set `must_change_password`; data APIs return `403 PASSWORD_CHANGE_REQUIRED` until the user changes it at `/doi-mat-khau`.
- Login rate limits: 5 failures per IP+username and 30 failures per IP per 15 minutes. Registration is limited to 10 attempts per IP per hour. Admin login is 5 per IP+username and 20 per IP per 15 minutes. Limits are in-memory per process.
- Registration auto-logs in the new account. Duplicate usernames return 409 (this reveals that a username exists; login errors stay generic).
- Admins are separate accounts created only via `cd backend && npm run admin:create -- --username <name>`. Admin sessions use a separate cookie, CSRF header, and audit log; there is no public admin registration or admin-management API.
- Not implemented yet: self-service password reset, email verification, MFA/TOTP, admin MFA, CAPTCHA.

## 4. Data sources

| Source | Format | Source count | Target table |
|---|---|---|---|
| `data/de_an_tuyen_sinh/` | Markdown | 307 files | `de_an_tuyen_sinh` |
| `data/diem_chuan/scraped_tuyensinh*.json` | JSON | 37 school keys / 2,617 mark entries | `diem_chuan` |
| `data/diem_thptqg_2026/diem_thi_THPTQG_2026.csv` | CSV (UTF-8 BOM) | 1,131,975 rows | `diem_thi_thptqg` |
| `data/khoi_thi/theo_khoi_thi/` | TXT | 260 files → **245 in the live DB**; parser now produces **281** | `khoi_thi` |
| `data/khoi_thi/theo_truong/` | TXT | 260 files | `truong` |

Live DB snapshot (2026-10-23):

- 1,131,975 candidates; 2,617 score rows; 307 proposals; 260 schools; 245 blocks.
- 35 distinct score codes/names; only 33 join to `truong`; 227 of 260 schools have no score data.
- 853 score rows have an empty `to_hop_mon`.
- All 2,617 `diem_chuan` rows have `nam = 2025`, while the UI/product branding says 2026.
- 6 candidate rows have all score fields null.
- 0 score cells are zero in the live DB because the old parser converted `0` to `NULL`.
- A fresh import with the fixed parser produces 12 zero score cells and 5 all-null rows. Those values are not live until a rebuild.

## 5. Domain definitions

### Benchmark score methods

The `phuong_thuc` values are:

1. `Điểm thi THPT`
2. `Điểm ĐGNL HSA`
3. `Điểm ĐGTD TSA`
4. `Điểm ĐGNL V-ACT`
5. `Chứng chỉ SAT`

Each method has a different scale. The UI shows the corresponding scale and warns that scores from different methods must not be compared directly.

### `to_hop_mon`

`diem_chuan.to_hop_mon` is a text field containing one or more subject-block codes such as `A00`, `A01`, `D01`. The API uses `LIKE '%code%'` for block filtering. Empty values cannot be filtered by block.

### `so_truong` vs joined schools

`khoi_thi.so_truong` is the count of schools listed in the source block file. It is **not** the number of schools that have score data for that block. For A00 the source count is 232, while only 25 schools join to `diem_chuan` in the live DB. The UI now shows both meanings separately.

### `so_nganh`

`so_nganh` in `/api/khoi-thi/:maKhoi` is the number of distinct majors for a school in that block, compared case-insensitively. The source data contains capitalization variants such as “Kỹ thuật Điện” and “Kỹ thuật điện”.

### Ranking

The current ranking API sums every subject supplied by the user and compares that total with the sum of **all** subject scores for every candidate. This is not a ranking within a subject combination. The UI discloses the limitation; the calculation is still open (KI-02).

## 6. Known data limits

- Five school codes are mapped incorrectly: `HCP→HCH`, `MTU→MTC`, `NHB→NVH`, `SKH→SKD`, `UEF→KSA`. These rows currently belong to unrelated schools.
- `DNV` and `FPT` have score rows but are missing from `truong`.
- 47 proposal codes are missing from `truong`.
- 5 wrong mappings + 2 orphans affect 251 score rows (212 + 39).
- 15 block files were skipped by the old importer; the fixed parser recovers 36 codes and skips only one file with no block code.
- The live DB has not been rebuilt with the fixed importer.

Details and status: `KNOWN_ISSUES.md`.

## 7. Current status

- Username/password auth is implemented: register, login, logout, `/me`, change password, protected feature routes, protected data APIs, rate limits, and security headers.
- Forced password change, locked/deleted user handling, and session revocation are implemented.
- A hidden admin panel is implemented: separate admin auth/CSRF/session policy, overview, user management (create/bulk/edit/lock/unlock/restore/reset/soft delete), admission CRUD on all five tables, and an audit log.
- Admin data writes use a serialized engine with backup, transaction, `quick_check`, atomic save, reload, and write-block on failure. Backups are capped at 5.
- Auth verification passed: 78/78 backend tests; admin E2E smoke 19 checks on temp DBs; production cookie flags.
- Frontend build passes: 2,661 modules; separate `AdminPage` chunk 61.79 kB; main JS 1,016.01 kB (gzip 306.89 kB); CSS 32.73 kB. The >500 kB main-chunk warning remains.
- Main pages have error states instead of empty catches.
- Pagination is validated and returns 400 for invalid values.
- `de-an` returns the real total count.
- `so_nganh` uses case-insensitive distinct majors.
- Data mapping, coverage, ranking semantics, and the real DB rebuild still need user approval.
- The real `backend/database/auth.db` was migrated from v1 to v2 outside the test suite (cause not established); a v1 backup exists. Tests use temp auth DBs. The real auth DB currently has 0 admins, so admin login requires running the CLI first.
- The admission DB hash was unchanged after tests/smoke (`8D4F42B1F845C2E12DE875D2BBFDCBF0DF3CC7686DC285423189C80CF3559E4D`).
- No commit, push, or PR has been made.
