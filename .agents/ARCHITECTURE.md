# ARCHITECTURE — LearnPath

> Technical reference: system diagram, API contract, DB schema, data flow, invariants.
> Read `PROJECT_CONTEXT.md` first if you are new to the product.

## 1. System overview

```text
┌─────────────────────────────┐   HTTP /api + cookie      ┌──────────────────────────────┐
│ Browser                     │  ──────────────────────▶  │ Express (port 3001)          │
│ React 18 + Vite (5173)      │                           │ server.js                    │
│ axios baseURL '/api'        │  ◀──────────────────────  │ auth/* + admin/* + routes/*  │
└─────────────────────────────┘         JSON              └──────────────┬───────────────┘
                                                                         │ sql.js
                                                ┌────────────────────────┴─────────────────────┐
                                                ▼                                              ▼
                                 ┌──────────────────────────────┐              ┌──────────────────────────────┐
                                 │ learnpath.db (~109 MiB)      │              │ auth.db (small)              │
                                 │ loaded fully into RAM        │              │ users + sessions             │
                                 │ public APIs read-only        │              │ admins + admin_sessions      │
                                 │ admin writes via engine      │              │ admin_audit                  │
                                 └──────────────────────────────┘              └──────────────────────────────┘
```

- Vite proxies `/api` to `http://localhost:3001` during development.
- In production, put `/api` behind the same reverse proxy, use HTTPS, and add an SPA fallback to `index.html`.
- `sql.js` loads both DB files at startup. Public admission queries run against an in-memory copy and never write it.
- Admin CRUD writes the admission DB through a serialized engine: backup, transaction, `quick_check`, atomic file replacement, then reload. If reload fails, writes are blocked.
- Auth writes go only to the separate auth DB. The importer is the only other process that creates/replaces the admission DB.
- The browser authenticates users with the `lp_session` HttpOnly cookie and admins with a separate `lp_admin_session` (or `__Host-lp_admin_session`) cookie; JS cannot read either token.

## 2. Runtime startup

`backend/server.js`:

1. Optionally sets `trust proxy` when `TRUST_PROXY=1`, disables `X-Powered-By`, and adds security headers.
2. Registers the CORS allowlist (credentials enabled).
3. Mounts `/api/admin` first; the admin router owns a 2 MB JSON parser because proposal content can be large.
4. Adds the 10 kB JSON parser used by the public/user routes.
5. Mounts public `/api/auth` routes, then public `/api/health`.
6. Mounts `/api/diem-chuan`, `/api/de-an`, `/api/khoi-thi`, and `/api/diem-thi` behind `requireAuth` and `requirePasswordChanged`.
7. Adds a JSON 404 for unknown `/api` paths and an error handler (400 JSON, 413 oversized, 500 fallback).
8. `getDb()` loads the admission DB into `sql.js`. If missing, startup fails with an actionable error; it does **not** create a schema.
9. `getAuthDb()` opens/creates the auth DB, migrates v1 → v2 when needed, and validates the schema.
10. Warns when no admin account exists, then listens on `process.env.PORT || 3001`.

Environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 3001) |
| `LEARNPATH_DB_PATH` | Admission DB path; useful for isolated import tests |
| `LEARNPATH_AUTH_DB_PATH` | Auth DB path (default `backend/database/auth.db`); must differ from the admission DB |
| `APP_ORIGIN` | Allowed browser origin for auth/admin POSTs/CORS (default `http://localhost:5173,http://127.0.0.1:5173`) |
| `NODE_ENV` | `production` enables `Secure` cookies, the `__Host-` admin cookie name, and HSTS |
| `TRUST_PROXY` | Set to `1` only behind a trusted reverse proxy so `req.ip` is correct |
| `ADMIN_ALLOWED_IPS` | Optional comma-separated IP allowlist for every `/api/admin/*` request |
| `ADMIN_CSRF_SECRET` | HMAC secret for admin CSRF tokens; replace the development default in production |
| `ADMIN_IP_HASH_SECRET` | Secret used to hash IPs in the admin audit log; replace the development default in production |

`backend/src/database/db.js` exports:

- `DB_PATH` — resolved admission DB path.
- `getDb({ createIfMissing })` — load/caches the admission DB; `createIfMissing` is used only by `init.js`.
- `saveDb()` — export the in-memory admission DB to disk.
- `reloadDb()` — reload the in-memory DB after the admin write engine replaces the file.
- `queryAll(sql, params)` / `queryOne(sql, params)` / `run(sql, params)` helpers.

`backend/src/auth/authDb.js` exports the same query helpers plus `AUTH_DB_PATH`, `SCHEMA_VERSION`, `getAuthDb()`, `saveAuthDb()`, `runAuthMutation()`, and `reloadAuthDb()`. Auth writes are exported to a temp file, fsynced, and renamed over `auth.db`; a previous-file fallback protects against a failed rename. The file is given mode `0600` where supported. The schema is versioned with `PRAGMA user_version = 7`; v5→v6 replaces legacy unstructured profile scores with shared structured academic scores. v6→v7 adds the interest module (`interest_instruments`, `interest_items`, `interest_attempts`, `interest_responses`, `interest_results`, `interest_group_weights`, `interest_group_pairs`), `users.interest_completed`, `career_match_config`, and `user_exam_scores`; it also seeds instrument v1 (60 + 48 items), 8 major-group weight rows, and 7 match-config keys inside the migration transaction.

`backend/src/admin/admissionWrite.js` serializes admission writes. It creates `backend/database/backups/` (max 5 files), copies the DB before the first write and before destructive operations, runs the mutation inside a transaction, checks `PRAGMA quick_check`, writes atomically, and reloads. A failed reload sets a write-block flag so the server does not continue on a stale or broken DB. Thao tác ghi hỗ trợ chỉnh sửa đề án tuyển sinh, chỉnh sửa điểm chuẩn và thêm dữ liệu mới thủ công.

## 3. Frontend

| Route | Component | Access | Data source |
|---|---|---|---|
| `/` | `pages/TrangChu.jsx` | Public | Static marketing content; auth-aware CTA |
| `/dang-nhap` | `pages/AuthPage.jsx` | Public | `/api/auth/login`, `/api/auth/me` |
| `/dang-ky` | `pages/AuthPage.jsx` | Public | `/api/auth/register` |
| `/doi-mat-khau` | `pages/ChangePasswordPage.jsx` | Authenticated | `/api/auth/change-password` |
| `/admin/*`, `/admin_*` | `pages/AdminPage.jsx` (lazy) | Admin cookie | `/api/admin/*` |
| `/chuong-trinh-hoc` | `pages/ChuongTrinhHoc.jsx` (lazy) | Protected | `/api/chuong-trinh-hoc` |
| `/de-an` | `pages/DeAnTuyenSinh.jsx` | Protected | `/api/de-an`, `/api/de-an/:maTruong` |
| `/diem-chuan` | `pages/DiemChuan.jsx` | Protected | `/api/diem-chuan`, `/phuong-thuc`, `/stats` |
| `/khoi-thi` | `pages/KhoiThi.jsx` | Protected | `/api/khoi-thi`, `/api/khoi-thi/:maKhoi`, `/api/diem-chuan` |
| `/thu-hang` | `pages/ThuHang.jsx` | Protected | `/api/diem-thi/ranking`, `/api/diem-thi/stats`, `/api/diem-thi/hsa/exams`, `/api/diem-thi/hsa/ranking`, `/api/diem-thi/tsa/exams`, `/api/diem-thi/tsa/ranking` |
| `/thong-tin-ca-nhan` | `pages/ThongTinCaNhan.jsx` | Protected | `/api/auth/profile` |
| `/khao-sat` | `pages/KhaoSat.jsx` | Protected | `/api/auth/survey/questions`, `/api/auth/survey/submit` |
| `/phan-tich-nang-luc` | `pages/PhanTichNangLuc.jsx` | Protected | `/api/career/overview`, `/api/career/scores`, `/api/career/majors`, `/api/career/selections`, `/api/career/map-data`, `/api/career/recommendations`, `/api/career/benchmark` |
| `/kham-pha-so-thich` | `pages/InterestLanding.jsx` | Protected | `/api/interest/instrument`, `/api/interest/attempt`, `/api/interest/results/latest` |
| `/kham-pha-so-thich/lam-bai` | `pages/InterestRunner.jsx` (lazy) | Protected | `/api/interest/attempt`, `/api/interest/attempt/:id/responses`, `/submit` |
| `/kham-pha-so-thich/ket-qua` | `pages/InterestResult.jsx` (lazy) | Protected | `/api/interest/results/latest`, `/api/interest/results/:attemptId` |
| `/tro-ly-ai` | `pages/TroLyAI.jsx` (lazy) | Protected | `/api/agent/status`, `/api/agent/consent`, `/api/agent/chat`, `/api/agent/conversations` |

Implementation notes:

- `frontend/src/lib/api.js` is an axios instance with `baseURL: '/api'` and `withCredentials: true`.
- `AuthContext` calls `/api/auth/me` on startup, exposes `login`, `register`, `logout`, and `changePassword`, and clears auth state on a `401`.
- `ProtectedRoute` redirects guests to `/dang-nhap?redirect=<encoded target>`; the auth page returns there after login/register. Users with `mustChangePassword` are redirected to `/doi-mat-khau` before any protected page or data API.
- The session token is **not** stored in localStorage, sessionStorage, or JS-readable state; the browser holds only the HttpOnly cookie.
- `/admin/*` and `/admin_*` (`/admin_home`, `/admin_user`, `/admin_survey`, `/admin_data`, `/admin_career`, `/admin_audit`) are lazy-loaded outside `Layout`, have no public links, set `document.title` and a `noindex,nofollow` meta tag, and use `frontend/src/lib/adminApi.js` with its own cookie/CSRF handling. A user `401` must not redirect an admin to `/dang-nhap`.
- The admin CSRF token lives in memory only; a reload fetches it again from `/api/admin/auth/me`. The `admin:unauthorized` event clears the admin UI without touching user auth.
- `frontend/public/robots.txt` disallows `/admin`, `/admin_`, and `/api/`.
- Pages have loading, empty, and error states. Do not reintroduce empty `catch` blocks.
- The Benchmark scores page triggers the score request when a method is selected; search/sort/block filters reset pagination to page 1.
- A request-id guard prevents a late response from replacing a newer selection.
- The Admission proposals page detail view clears the previous detail before a new request and offers a retry on failure.
- TOC IDs come from `rehype-slug`; `extractHeadings` uses `github-slugger` in the same order. Do not reintroduce a separate `slugify()` implementation.
- The Exam blocks page shows the source `so_truong` as “trường xét tuyển” and a separate count of schools actually joined to score data.
- The ranking page discloses that the current API does not rank within a subject combination.
- Bipolar (Phần 2) charts share one sign rule in `frontend/src/lib/bipolar.js` (`axisPercent`, `formatD`, `describePair`). `BipolarAxisChart.jsx` draws one combined chart for all four pairs on `/kham-pha-so-thich/ket-qua`; `BipolarBars` in `InterestChart.jsx` reuses the same helpers. First letter on the left (+24), second on the right (−24), centre = 0; an incomplete pair has `D = null` and no marker. Regression test: `cd frontend && npm test` (B1–B7).

## 4. API reference

Base URL: `/api`; admin base URL: `/api/admin`. Successful list responses use `{ "data": [...], "total": number }`; detail responses use `{ "data": object }`. Errors usually use `{ "error": "message" }`; auth/status errors may add `code`.

`/api/health`, `/api/auth/register|login|logout`, and `/api/admin/auth/login` are reachable without a session (login still enforces origin, IP allowlist, and rate limits). Every `/api/de-an`, `/api/diem-chuan`, `/api/khoi-thi`, and `/api/diem-thi` request requires a valid `lp_session` and a changed password; missing/expired/forged sessions return `401 { "error": "Vui lòng đăng nhập để tiếp tục." }` and clear the cookie. Auth and admin responses set `Cache-Control: no-store`.

### Auth endpoints

Auth POSTs must come from `APP_ORIGIN` (or a request with no `Origin`, e.g. server-to-server). Untrusted browser origins return `403`.

#### `POST /api/auth/register`

Body: `{ "username": "...", "password": "...", "passwordConfirm": "..." }`.

- `201` → `{ "data": { "user": { "id", "username", "status", "mustChangePassword", "createdAt" } } }`; also creates a session and sets `lp_session`.
- `400` invalid username/password/confirmation.
- `409` username already exists (case-insensitive).
- `429` registration rate limit; includes `Retry-After`.
- Registration is limited to 10 attempts per IP per hour (in-memory).

#### `POST /api/auth/login`

Body: `{ "username": "...", "password": "..." }`.

- `200` → `{ "data": { "user": { "id", "username", "status", "mustChangePassword", "createdAt" } } }`; also creates a new session.
- `400` missing/invalid input.
- `401` generic `Tên đăng nhập hoặc mật khẩu không đúng.` Unknown usernames still run a dummy scrypt verification.
- `403 { code: "ACCOUNT_LOCKED" }` when the password is correct but the account is locked.
- `403 { code: "ACCOUNT_DELETED" }` when the password is correct but the account is soft-deleted.
- `429` after 5 failures for the same IP+username or 30 failures for the same IP in 15 minutes.

#### `GET /api/auth/me`

Returns `{ "data": { "user": { "id", "username", "status", "mustChangePassword", "createdAt" } } }`. Requires a session; `401` otherwise.

#### `POST /api/auth/change-password`

Body: `{ "currentPassword": "...", "newPassword": "...", "newPasswordConfirm": "..." }`.

- `200` → `{ "data": { "user": { ... mustChangePassword: false } } }`.
- `400` invalid new password/confirmation.
- `401` missing session or wrong current password.
- On success, clears `must_change_password` and revokes every other session for the user; the current session stays valid.

#### `POST /api/auth/logout`

Deletes the current session, clears `lp_session`, and returns `204` with no body. Calling it without a session is harmless.

### Admin endpoints

Base path `/api/admin`. Every endpoint except `POST /auth/login` requires a valid admin cookie. Non-GET requests also require `X-Admin-CSRF` matching the token issued at login/`me`, plus a trusted `Origin`. The optional `ADMIN_ALLOWED_IPS` allowlist applies to the whole router. Responses set `Cache-Control: no-store`.

#### `POST /api/admin/auth/login`

Body: `{ "username": "...", "password": "..." }`.

- `200` → `{ "data": { "admin": { "id", "username", "createdAt", "lastLoginAt" }, "csrfToken", "session": { "expiresAt", "idleTimeoutMs", "absoluteTimeoutMs" } } }`; sets `lp_admin_session` (production: `__Host-lp_admin_session`) with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` in production.
- `400` invalid input.
- `401` generic invalid credentials; records `admin.login.failure`.
- `403` disabled admin (`Tài khoản quản trị không khả dụng.`) or untrusted origin.
- `429` after 5 failures for the same IP+username or 20 failures for the same IP in 15 minutes; includes `Retry-After`.

Sessions expire after 8 hours absolute or 30 minutes idle, whichever comes first. At most 3 sessions per admin; creating a fourth revokes the oldest. A disabled admin is rejected on every later request, even with an existing cookie.

#### `GET /api/admin/auth/me`

Returns `{ "data": { "admin", "csrfToken", "session": { "createdAt", "expiresAt", "lastSeenAt", "idleTimeoutMs", "absoluteTimeoutMs" } } }` and refreshes the idle timer. The CSRF token is stable for the session.

#### `POST /api/admin/auth/logout`

Requires CSRF. Deletes the admin session, clears the cookie, writes `admin.logout`, and returns `204`.

#### `GET /api/admin/overview`

Returns table counts, user counts by status, admin count, admission DB path/size/`quick_check` result/write state/backups, auth DB path/size, the current admin session, and server time.

#### Users

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/users` | Query: `query` (username search, max 100 chars), `status` (`active`, `locked`, `deleted`, `all`), `page`, `limit` (1–100, default 50). Returns `{ data, total, page, limit }`. |
| POST | `/api/admin/users` | Body `{ "username": "..." }`. Creates an active user with a random temporary password and `must_change_password=1`. `201` returns `{ data: { id, username, password } }` — the plaintext temporary password is shown once. |
| POST | `/api/admin/users/bulk` | Body `{ "usernames": [...] }` or `{ "text": "line\\nline" }`, max 50. `201` returns `{ data: [{ id, username, password }], skipped: [{ username, reason }] }`. Invalid or duplicate names are skipped, not fatal. |
| GET | `/api/admin/users/:id` | User detail. `404` if missing. |
| PATCH | `/api/admin/users/:id` | Body `{ "username": "..." }`; case-insensitive uniqueness enforced. Deleted users must be restored first. |
| POST | `/api/admin/users/:id/lock` | Sets `locked` and revokes all sessions. |
| POST | `/api/admin/users/:id/unlock` | Sets `active`. |
| POST | `/api/admin/users/:id/restore` | Restores a soft-deleted user to `active`. |
| POST | `/api/admin/users/:id/reset-password` | Generates a new temporary password, sets `must_change_password=1`, revokes all sessions. Returns `{ data: { id, username, password, mustChangePassword: true } }`. |
| DELETE | `/api/admin/users/:id` | Body `{ "confirmUsername": "<exact username>" }`. Soft delete: status `deleted`, `deleted_at` set, sessions revoked, username kept for uniqueness/audit. Returns `204`. |

#### Admission data

Five whitelisted tables: `khoi_thi`, `truong`, `diem_chuan`, `diem_thi_thptqg`, `de_an_tuyen_sinh`. Table metadata drives validation and the UI forms; unknown tables return `404`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/data/tables` | Public metadata for the five tables (columns, types, required/nullable, max length, sortable, unique, read-only). |
| GET | `/api/admin/data/:table` | Query: `search`, `sort` (sortable column), `order` (`asc`/`desc`), `page`, `limit` (1–100, default 25). Returns `{ data, total, page, limit, table }`. |
| GET | `/api/admin/data/:table/:id` | One row. `404` if missing. |
| POST | `/api/admin/data/:table` | Full-row create with metadata validation and unique checks. `201`; may include `warning` when a school code does not join. |
| PATCH | `/api/admin/data/:table/:id` | Partial update. `409 DEPENDENCIES_EXIST` when changing `truong.ma_truong` while rows reference it; retry with `force: true`. |
| DELETE | `/api/admin/data/:table/:id` | Body `{ "confirm": true }`. `409 DEPENDENCIES_EXIST` for a referenced `truong`; retry with `{ "confirm": true, "force": true }`. |

All writes go through `admissionWrite.js`: serialized, backed up before the first write and before every delete/force operation, executed in a transaction, checked with `PRAGMA quick_check`, exported atomically, then reloaded. A failed reload sets a write-block flag; later writes return `503` until the server is restarted with a valid DB. Backups live in `backend/database/backups/` and are capped at 5.

#### `GET /api/admin/audit`

Query: `action`, `admin` (username), `from`/`to` (ISO timestamps), `page`, `limit` (1–100). Returns `{ data, total, page, limit }`. Entries older than 180 days are deleted opportunistically at admin login. Passwords, hashes, tokens, CSRF values, cookies, and authorization headers are stripped from `details`; IPs are stored as HMAC-SHA256 hashes.

### `GET /api/health`

Returns `{ status: "ok", timestamp: ISO-8601 }`. Public.

### `GET /api/de-an`

List admission proposals.

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | `LIKE` on `ma_truong` or `ten_truong` |
| `limit` | integer | 100 | 1–1000; invalid → 400 |
| `offset` | integer | 0 | >= 0; invalid → 400 |

Returns `{ data: [{id, ma_truong, ten_truong}], total }`. `total` is the real count after `search`, not the page size.

### `GET /api/de-an/:maTruong`

Returns the full Markdown row. 404 if the code does not exist.

### `GET /api/diem-chuan`

Benchmark score rows.

| Param | Type | Default | Notes |
|---|---|---|---|
| `truong` | string | — | `LIKE` on the display school name |
| `nganh` | string | — | `LIKE` on major name |
| `phuong_thuc` | string | — | Exact method name |
| `khoi_thi` | string | — | `LIKE '%code%'` on `to_hop_mon` |
| `ma_truong` | string | — | Exact school code |
| `sort` | enum | `diem_desc` | `diem_asc`, `diem_desc`, `name_asc`, `name_desc` |
| `limit` | integer | 200 | 1–1000; invalid → 400 |
| `offset` | integer | 0 | >= 0; invalid → 400 |

Returns `{ data: rows, total }`. `total` uses the same filters as the data query.

### `GET /api/diem-chuan/phuong-thuc`

Returns `{ data: [method names] }`, currently five values.

### `GET /api/diem-chuan/stats`

Returns:

```json
{
  "data": {
    "tongTruong": 0,
    "tongNganh": 0,
    "diemCaoNhat": 0,
    "diemThapNhat": 0,
    "diemTrungBinh": 0
  }
}
```

`tongTruong` is `COUNT(DISTINCT truong)` over `diem_chuan` (display names), not a join to `truong`.

### `GET /api/diem-chuan/nhom-nganh` (legacy)

Returns a static list of five cluster names. It is **not** connected to actual major data. The Benchmark scores page no longer exposes this filter; the endpoint and `getNhomNganh()` client export remain for compatibility.

### `GET /api/diem-chuan/compare?ids=1,2,3`

Returns rows for the supplied score IDs. Missing `ids` or no valid numeric IDs returns `{data: []}`. The UI limits comparison to 2–5 items.

### `GET /api/khoi-thi`

Returns `{ data: [khoi_thi rows] }`, ordered by `ma_khoi`.

### `GET /api/khoi-thi/:maKhoi`

Returns:

```json
{
  "data": {
    "khoi_thi": { "ma_khoi": "A00", "mon_thi": "...", "so_truong": 232 },
    "truong": [
      { "ma_truong": "BKA", "ten_truong": "...", "so_nganh": 82 }
    ]
  }
}
```

- `so_truong` comes from the source block file.
- `truong` contains only schools that join `truong` + `diem_chuan` and have the block in `to_hop_mon`.
- `so_nganh` is the case-insensitive distinct major count for that school and block.
- `khoi_thi` is `null` if the block code is unknown.

### `GET /api/khoi-thi/:maKhoi/truong/:maTruong`

Returns score rows for one school and block, with `ten_truong` from `truong` when available.

### `GET /api/diem-thi/ranking`

Query params: `toan`, `van`, and elective subjects (`ly`, `hoa`, `sinh`, `su`, `dia`, `tin_hoc`, `ngoai_ngu`).

- Quy chế thi THPT (GDPT 2018): Yêu cầu đúng 4 môn thi gồm 2 môn bắt buộc (`toan`, `van`) và đúng 2 môn tự chọn trong 7 môn còn lại.
- Trả về 400 nếu thiếu `toan` hoặc `van`, hoặc số môn tự chọn khác 2, hoặc điểm bất kỳ môn nào nằm ngoài khoảng [0, 10].
- Điểm tổng cộng được tính trên thang điểm 40 (4 môn).
- So sánh thứ hạng với toàn bộ thí sinh trong cơ sở dữ liệu và trả về phân bố điểm trên thang 40 gồm 7 khoảng: `35-40`, `30-35`, `25-30`, `20-25`, `15-20`, `10-15`, `0-10`.
- Response bao gồm `diemNhap`, `tongDiem`, `soMon: 4`, `monBatBuoc`, `monTuChon`, `thuHang`, `tongThiSinh`, `tyLePhanTram`, `phanBoDiem`.

### `GET /api/diem-thi/stats`

Returns total candidates and average scores for Toán, Văn, Lý, Hóa. Averaged fields ignore null values.

### `GET /api/diem-thi/hsa/exams`

Returns the list of supported HSA (ĐGNL ĐHQGHN) exam batches (2026 all batches, 2026 batches 601-603, 2025, 2024...) with their metadata and score distribution image URLs.

### `GET /api/diem-thi/hsa/ranking`

Queries candidate ranking for HSA exams based on live score distribution data from `diemthi.tuyensinh247.com`.

| Param | Type | Default | Notes |
|---|---|---|---|
| `your_score` | number / string | — | Required score between 0 and 150 (supports comma or dot decimal) |
| `exam_id` | integer | 25 | HSA exam batch ID (e.g. 25 for HSA 2026 all batches) |

Returns `{ data: { diem, examId, examName, from, to, same, larger, smaller, tongThiSinh, thuHangTu, thuHangDen, tyLePhanTram, image, localImage, proxyImage, phanBoDiem, nguon } }`. Validates scale 0–150 (returns 400 if invalid) and returns 502 with Vietnamese message if upstream Tuyensinh247 service is unreachable.

### `GET /api/diem-thi/hsa/image/:examId`

Streams the official score distribution infographic image for the specified HSA exam batch. Serves from local cache (`backend/src/data/hsa_images/`) or falls back to proxying from Tuyensinh247 with caching headers.

### `GET /api/diem-thi/tsa/exams`

Returns the list of supported TSA (ĐGTD ĐHBK Hà Nội) exam batches (2026 all batches, batches 1/2/3, 2025, 2024...) with their metadata and score distribution image URLs.

### `GET /api/diem-thi/tsa/ranking`

Queries candidate ranking for TSA exams based on live score distribution data from `diemthi.tuyensinh247.com`.

| Param | Type | Default | Notes |
|---|---|---|---|
| `your_score` | number / string | — | Required score between 0 and 100 (supports comma or dot decimal) |
| `exam_id` | integer | 24 | TSA exam batch ID (e.g. 24 for TSA 2026 all 3 batches) |

Returns `{ data: { diem, examId, examName, from, to, same, larger, smaller, tongThiSinh, thuHangTu, thuHangDen, tyLePhanTram, image, localImage, proxyImage, phanBoDiem, nguon } }`. Validates scale 0–100 (returns 400 if invalid) and returns 502 with Vietnamese message if upstream Tuyensinh247 service is unreachable.

### `GET /api/diem-thi/tsa/image/:examId`

Streams the official score distribution infographic image for the specified TSA exam batch. Serves from local cache (`backend/src/data/tsa_images/`) or falls back to proxying from Tuyensinh247 with caching headers.

### `GET /api/career/majors`

Explores benchmark majors (THPT 2025) with dynamic distance rate calculation for candidates.

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | `LIKE` on major name |
| `school` | string | — | `LIKE` on school name |
| `block` | string | — | `LIKE` on admission block |
| `classLevel` | string | — | Candidate class level (10/11/12) for score matching |
| `term` | string | — | Candidate academic term (Kỳ 1/Kỳ 2/Cả năm) |
| `sort` | enum | `score_desc` | `score_desc`, `score_asc`, `rate_desc`, `rate_asc`, `school_asc`, `school_desc` |
| `limit` | integer | 50 | Max 100 |
| `offset` | integer | 0 | >= 0 |

Returns `{ data: rows, total, limit, offset, sort, year: 2025, warning }`. When sorting by `rate_desc` or `rate_asc`, rows with computed rates appear first, with nulls last.

### `GET /api/career/map-data`

Returns student vector embeddings, rubric major weight vectors, fit percentages, benchmark scores, and selection states for rendering the interactive force-directed career map.

| Param | Type | Default | Notes |
|---|---|---|---|
| `classLevel` | string | — | Candidate class level (10/11/12) for academic snapshot |
| `term` | string | — | Candidate academic term (Kỳ 1/Kỳ 2/Cả năm) |

Returns `{ data: { studentVector, majors, selectedClassLevel, selectedTerm } }` where each major includes `id`, `schoolCode`, `schoolName`, `majorName`, `majorGroup`, `admissionBlock`, `entryScore`, `fitPct`, `coveragePct`, `weightVector`, `details`, `isTarget`, `isPinned`.

### `GET /api/career/benchmark`

| Param | Type | Notes |
|---|---|---|
| `combo` | string | Admission block, e.g. `A00`; must exist in `backend/src/career/subjects.js` |
| `score` | number | Total on the 0–30 scale |

Returns `pBench`, `percentile`, `zScore`, `mean`, `sd`, `median`, `n`, `numerator`, `denominator`. `pBench` is the upper tail (`>= score`) and `percentile` the lower tail (`< score`). Both come from the admission DB and are cached for 10 minutes. Never describe either as an admission probability.

### `GET /api/career/recommendations`

Returns every rubric with `hocLucFit`, `tinhCachFit`, `tongHopFit`, `matrixCell`, `pBench`, `diemVuotChuan`, `reasons`, and the active weights/config. A null component makes `tongHopFit` null with a reason. Query: `sort=tongHop_desc|tinhCach_desc|hocLuc_desc`, `page`, `limit` (max 50), optional `classLevel`/`term` for the legacy comparison. The current user's exam scores (`user_exam_scores`) supply `T_student`; no conversion from GPA is allowed.

### `GET|PUT /api/career/exam-scores` and `GET /api/career/exam-score-options`

Self-reported exam total per admission block (`0–30`, source `tự khai`). `exam-score-options` returns the supported blocks and their subject sets from `backend/src/career/subjects.js`.

### `GET /api/career/group-config`

Returns the three-component configuration used by `F_m`:

- `groups`: the 12 major groups with `riasecGroup`, pairwise `judgments`, `wHocLuc`/`wHolland`/`wMbti` (each row sums to 1), `note`, `majorCount`, plus `updatedAt`/`updatedBy` once an admin has saved weights.
- `mbti`: profile `status` (`chua_xac_dinh`), `determined: false`, and the four axes with `c = null`/`t = null`. `M_m` is null with `thieu_ho_so_mbti` until this file is completed.
- `priorities`: version, scale (4 cốt lõi … 1 hỗ trợ), formula, `rowCount` (143), `skippedRows`, plus `updatedAt`/`updatedBy` after an admin edit.
- `formula` and `warning` (weights are the group's assumptions, not validated; `F_m` is not an admission probability).

The data files are generated by `backend/scripts/derive-career-weights.js` (dry-run by default; `--write` applies) and can be edited through the admin API/UI (see below). After an admin edit the file carries `updatedAt`/`updatedBy`; `--write` refuses to overwrite it unless `--force` is passed. `GET /api/career/recommendations` rows also expose `hocLucIndex`, `hocLucIndexCoverage`, `hocLucIndexWeights`, `hocLucIndexSource`, `hollandIndex`, `mbtiIndex`, `mbtiStatus`, `groupCode`, `groupLabel`, `groupFit`, `groupFitPartial`, `groupFitCoverage`, `groupFitContributions`, `groupFitMissing`, and `groupReasons`. The legacy `hocLucFit`/`tinhCachFit`/`tongHopFit`/`reasons` fields are unchanged.

### Interest API (`/api/interest/*`)

All endpoints require `requireAuth` + `requirePasswordChanged`.

| Method | Path | Notes |
|---|---|---|
| GET | `/instrument` | Active instrument + items; never returns `leftKey`/`rightKey` |
| GET | `/attempt` | Current draft + saved responses + status |
| POST | `/attempt` | Create a draft; idempotent while a draft exists |
| PATCH | `/attempt/:id` | Save `giaiDoanHocTap` / `cauHoiNgheNghiep` |
| PATCH | `/attempt/:id/responses` | `{ responses: [{ itemId, value }] }`, max 30 rows; scale validated per part |
| POST | `/attempt/:id/submit` | Scores, stores `interest_results`, sets `interest_completed`; `409` with `details` if the D3 policy is not met |
| GET | `/results/latest` | Latest submitted result + interpretation |
| GET | `/results/:attemptId` | Owner only; `404` for another user's attempt |
| DELETE | `/attempt/:id` | Delete own draft or result |
| POST | `/reset` | Delete all attempts/results and clear `interest_completed` |

Scoring lives in `backend/src/interest/scoring.js` (pure): `scoreAttempt({ instrument, items, responses })`. The pair contract is per item: odd `itemNo` puts the first letter on the left, even on the right; `D = Σ(even) − Σ(odd)`, range −24…+24. Missing answers are **not** zero: an incomplete group is `partial`/`empty`, and an incomplete pair has `d = null`.

### Agent API (`/api/agent/*`)

All endpoints require `requireAuth` + `requirePasswordChanged` + trusted `Origin`.

| Method | Path | Notes |
|---|---|---|
| GET | `/status` | Returns `{ enabled, configured, consented, usage: { today, dailyLimit }, maxMessageLength }` |
| POST | `/consent` | Records user consent in `agent_consents` table |
| POST | `/chat` | Body `{ conversationId?, message }`. Validates consent, length, burst/daily limit. Returns `text/event-stream` (SSE events: `status`, `artifact`, `message`, `done`, `error`) |
| GET | `/conversations` | Lists current user's conversations sorted by `updated_at DESC` |
| GET | `/conversations/:id` | Returns conversation details and message history with visual artifacts (user-isolated) |
| DELETE | `/conversations/:id` | Deletes conversation and its messages |

### Admin interest API (`/api/admin/interest/*`)

All endpoints require the admin cookie + `X-Admin-CSRF`.

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/instruments` | List / create draft (optionally copy items) |
| POST | `/instruments/import` | All-or-nothing 108-item JSON import; `400` with per-line `details` |
| PUT | `/instruments/:id` | Draft only; `409` otherwise |
| GET/PUT | `/instruments/:id/items` | Replace items; validates 60/48, 6 even + 6 odd, and per-item keys |
| POST | `/instruments/:id/activate` | Requires 60/48 items and `source_note` containing “tự biên soạn”; archives the previous active version |
| GET/PUT | `/weights` | 8 major groups × 6 RIASEC; each row must sum to 1 |
| GET | `/results` | Aggregate stats + recent attempts |
| GET | `/results/:attemptId` | Detail; writes `admin.interest.result.view` |
| GET | `/results/export` | CSV with scores only, no names |

Audit actions: `admin.interest.instrument.create|update|activate|import`, `admin.interest.weights.update`, `admin.interest.result.view`.

### Admin career match config (`/api/admin/career/match-config`)

`GET` returns the 7 keys; `PUT` validates weights, matrix thresholds, coverage floor, and `hoc_luc_mode` (0 = percentile, 1 = legacy rollback), then writes `admin.career.match_config.update`.

### Admin group weights (`/api/admin/career/group-config`)

All routes require the admin cookie + `X-Admin-CSRF`.

- `GET /` returns the same payload as the user endpoint: 12 groups with `judgments`/`wHocLuc`/`wHolland`/`wMbti`/`majorCount`, the MBTI profile state, and the priority summary.
- `GET /priorities` returns every priority row (143) with an opaque `key` (`schoolCode|majorName|admissionBlock|method|year|entryScore`), subjects (`subject`, rubric `weight`, `r`), `priorityTotal`, and file metadata.
- `GET /mbti` returns the full MBTI profile configuration (`status`, `description`, `axes`, `updatedAt`).
- `PUT /groups` — body `{ groups: [{ code, wHocLuc, wHolland, wMbti }] }` (partial list allowed). Each triple must be positive, ≤ 1, and sum to 1 ± 0.002; unknown/duplicate codes are rejected. No-op saves return `changed: false`.
- `PUT /priorities` — body `{ key, priorities: { "<subject>": r } }`. The subject set must match the row exactly, `r` must be an integer 1–4; adding/removing subjects is rejected (that would change the L denominator).
- `PUT /mbti` — body `{ status, axes: [{ code, c, t }] }`. Validates status `xac_dinh` / `chua_xac_dinh`, 4 axes (EI, SN, TF, JP), $c \ge 0$, $t \in \{-1, 1\}$.
- Writes are handled by `backend/src/career/configStore.js`: read the current JSON → validate → copy to `backend/database/backups/<file>-<stamp>-<reason>.json` (5 newest per file) → atomic replace → clear the in-process cache. A failed validation or backup writes nothing. Audit actions: `admin.career.group_weights.update`, `admin.career.subject_priorities.update`, and `admin.career.mbti_profile.update`.
- The tab **“Trọng số 12 khối”** in `/admin_career` (`GroupWeightPanel.jsx`) edits the three weights as percentages, flags totals outside 100 ± 0.2, offers “Chuẩn hoá dòng lệch”, edits one priority row at a time with search, and provides an interactive Card for managing the MBTI 4-axis comparison profile ($c_k, t_k$).

## 5. DB schema

The schema is created by `backend/src/database/init.js`. `db.js` intentionally has no `CREATE TABLE` statements.

### `khoi_thi`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `ma_khoi` | TEXT UNIQUE NOT NULL | Block code, e.g. `A00` |
| `mon_thi` | TEXT | Subject description |
| `so_truong` | INTEGER | Source school count, not joined count |

### `truong`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `ma_truong` | TEXT UNIQUE NOT NULL | School code |
| `ten_truong` | TEXT NOT NULL | Display name |

### `diem_chuan`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `ma_truong` | TEXT | Joins to `truong.ma_truong`; nullable and not enforced |
| `truong` | TEXT NOT NULL | Display name copied from source |
| `nganh` | TEXT NOT NULL | Major name |
| `to_hop_mon` | TEXT | Subject block text; can be empty |
| `diem_chuan` | REAL | Benchmark score |
| `ghi_chu` | TEXT | Source note |
| `nam` | INTEGER | Defaults to 2025 in the current schema |
| `phuong_thuc` | TEXT | One of the five method names |

Indexes: `ma_truong`, `phuong_thuc`, `to_hop_mon`.

### `diem_thi_thptqg`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `sbd` | TEXT UNIQUE | Candidate ID |
| `tinh` | TEXT | Province |
| `toan`, `van`, `ly`, `hoa`, `sinh`, `su`, `dia`, `tin_hoc`, `cong_nghe`, `ngoai_ngu` | REAL | Subject scores; null when absent |
| `gd_kt_pl` | TEXT | “GD Kinh tế - Pháp luật” raw value |

### `de_an_tuyen_sinh`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `ma_truong` | TEXT | School code |
| `ten_truong` | TEXT | School name |
| `noi_dung` | TEXT | Full Markdown |
| `nguon` | TEXT | Source (currently empty) |

### Auth DB (`auth.db`)

Created, migrated, and version-checked by `backend/src/auth/authDb.js`; it is **separate from the admission schema** and is never imported by `init.js`. The current schema is **v4** (`PRAGMA user_version = 4`).

Migrations:
- v1 → v2: adds `users.status`, `updated_at`, `last_login_at`, `must_change_password`, `deleted_at`, creates `admins`, `admin_sessions`, and `admin_audit`.
- v2 → v3: adds `user_profiles` (họ tên, lớp, trường, điểm các môn, chứng chỉ, trường/ngành mục tiêu, tổ hợp mong muốn, khác).
- v3 → v4: adds `users.survey_completed` (đánh dấu tài khoản đã hoàn thành khảo sát) và bảng `survey_questions` (câu hỏi khảo sát tùy chỉnh do admin cấu hình).
- v4 → v5: adds structured academic scores, career selections, and admin-managed career rubrics (`career_rubrics`, `career_rubric_subjects`).
- v5 → v6: replaces the legacy unstructured profile score columns with shared structured academic scores.
- v6 → v7: adds the interest module (7 `interest_*` tables), `users.interest_completed`, `career_match_config`, and `user_exam_scores`; seeds instrument v1, 8 major-group weights, and 7 match-config keys in the same migration transaction. `verifySchema()` also checks that the active instrument has 60 RIASEC + 48 pair items.
- v7 → v8: adds the personalized AI agent module (`chat_conversations`, `chat_messages`, `agent_usage`, `agent_consents`), supporting tool-calling conversational agent with persistent chat histories, visual artifact storage, user consent flags, and daily/burst rate limiting.

Mỗi lần di chuyển phiên bản đều tự động sao lưu bản backup có gắn dấu thời gian `auth.db.v${version}-backup-<timestamp>` trước khi chạy transaction nâng cấp.

#### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `username` | TEXT NOT NULL | Original casing, returned to the UI |
| `username_lower` | TEXT NOT NULL UNIQUE | Lower-cased lookup key; enforces case-insensitive uniqueness |
| `password_hash` | TEXT NOT NULL | `scrypt$32768$8$1$<salt-base64url>$<hash-base64url>` |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |
| `status` | TEXT NOT NULL | `active`, `locked`, or `deleted`; default `active` |
| `updated_at` | INTEGER | Last profile/status/password change |
| `last_login_at` | INTEGER | Last successful login |
| `must_change_password` | INTEGER NOT NULL | `1` after admin create/reset; data APIs return `403 PASSWORD_CHANGE_REQUIRED` until cleared |
| `survey_completed` | INTEGER NOT NULL | `0` for new accounts; `1` once survey is submitted |
| `deleted_at` | INTEGER | Set on soft delete, cleared on restore |

#### `sessions`

| Column | Type | Notes |
|---|---|---|
| `token_hash` | TEXT PRIMARY KEY | SHA-256 of the random session token, base64url |
| `user_id` | INTEGER NOT NULL | References `users(id)` with `ON DELETE CASCADE` |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |
| `expires_at` | INTEGER NOT NULL | 7 days after creation; expired rows are removed on new sessions |

Indexes: `sessions(user_id)`, `sessions(expires_at)`.

- The raw session token exists only in the HttpOnly cookie; the DB has only its hash.
- Locking, deleting, resetting a password, or changing a password revokes the relevant sessions. A soft-deleted user keeps the row so the username stays reserved and the audit trail remains meaningful.

#### `admins`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `username` | TEXT NOT NULL | Display casing |
| `username_lower` | TEXT NOT NULL UNIQUE | Case-insensitive login key |
| `password_hash` | TEXT NOT NULL | Same scrypt format as users |
| `status` | TEXT NOT NULL | `active` or `disabled` |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |
| `updated_at` | INTEGER NOT NULL | Last password/status change |
| `last_login_at` | INTEGER | Last successful admin login |

Admins are created and managed only through `cd backend && npm run admin:create -- ...` (create, `--reset-password`, `--disable`, `--enable`, `--list`). There is no public admin registration and no admin-management API.

#### `admin_sessions`

| Column | Type | Notes |
|---|---|---|
| `token_hash` | TEXT PRIMARY KEY | SHA-256 of the random admin token |
| `admin_id` | INTEGER NOT NULL | References `admins(id)` with `ON DELETE CASCADE` |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |
| `expires_at` | INTEGER NOT NULL | 8 hours after creation (absolute) |
| `last_seen_at` | INTEGER NOT NULL | Updated at most every 5 minutes; 30-minute idle limit |
| `csrf_hash` | TEXT NOT NULL | HMAC of the session's CSRF token |
| `user_agent` | TEXT | Truncated request user agent |
| `ip_hash` | TEXT | HMAC-SHA256 of the client IP |

Indexes: `admin_sessions(admin_id)`, `admin_sessions(expires_at)`. At most 3 live sessions per admin; older ones are revoked.

#### `admin_audit`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `admin_id` | INTEGER | Nullable for failed logins with an unknown username |
| `admin_username` | TEXT NOT NULL | Snapshot of the username |
| `action` | TEXT NOT NULL | e.g. `admin.login.success`, `admin.user.lock`, `admin.data.force_delete` |
| `entity` | TEXT | Table/entity name |
| `entity_id` | TEXT | Row/user id |
| `details` | TEXT | JSON, max 4,000 chars, secrets stripped |
| `ip_hash` | TEXT | HMAC-SHA256, never the raw IP |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |

Indexes: `admin_audit(created_at)`, `admin_audit(admin_id)`. Retention is 180 days; cleanup runs opportunistically at admin login.

#### `user_profiles`

| Column | Type | Notes |
|---|---|---|
| `user_id` | INTEGER PRIMARY KEY | References `users(id)` ON DELETE CASCADE |
| `ho_va_ten` | TEXT | Họ và tên học sinh |
| `lop` | TEXT | Lớp |
| `truong` | TEXT | Trường THPT |
| `diem_lop` | TEXT | Legacy JSON field; current structured scores are stored in `academic_scores` as môn/kỳ/lớp/TB môn/điểm |
| `chung_chi` | TEXT | JSON string của mảng chứng chỉ đã có: `[{loai, diem}]` |
| `chung_chi_mong_muon` | TEXT | JSON string của mảng chứng chỉ mong muốn có trong tương lai: `[{loai, diem}]` |
| `truong_muc_tieu` | TEXT | Trường đại học mục tiêu |
| `nganh_muc_tieu` | TEXT | Ngành mục tiêu |
| `to_hop_mong_muon` | TEXT | JSON string của mảng 3 môn thi: `["Toán", "Vật lý", "Hóa học"]` |
| `khac` | TEXT | Freestyle text; bao gồm câu trả lời khảo sát tùy chỉnh (`Câu hỏi - Câu trả lời từ user`) |
| `updated_at` | INTEGER NOT NULL | Epoch milliseconds |

#### `survey_questions`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | |
| `question` | TEXT NOT NULL | Nội dung câu hỏi khảo sát tùy chỉnh |
| `question_type` | TEXT NOT NULL DEFAULT 'text' | `'text'` (văn bản ngắn) hoặc `'textarea'` (đoạn văn) |
| `placeholder` | TEXT | Gợi ý nhập liệu |
| `is_required` | INTEGER NOT NULL DEFAULT 0 | 1 nếu bắt buộc, 0 nếu không |
| `order_index` | INTEGER NOT NULL DEFAULT 0 | Thứ tự hiển thị trong bài khảo sát |
| `is_active` | INTEGER NOT NULL DEFAULT 1 | 1 nếu đang bật, 0 nếu đã tắt |
| `created_at` | INTEGER NOT NULL | Epoch milliseconds |
| `updated_at` | INTEGER NOT NULL | Epoch milliseconds |

Indexes: `survey_questions(order_index, is_active)`.

#### Interest tables (v7)

| Table | Purpose |
|---|---|
| `interest_instruments` | Versioned instrument (`code`, `version`, `status` draft/active/archived, `source_note`, `disclaimer`, 60/48 counts) |
| `interest_items` | One row per item; `part` = `riasec`/`pairs`, `group_code`, `item_no`, `order_index`, text columns, and per-item `left_key`/`right_key` |
| `interest_attempts` | One draft/submitted attempt per user + instrument; stores the optional intro fields, notes JSON, and generated `summary_text` |
| `interest_responses` | One row per answered item; absent row = unanswered (never 0) |
| `interest_results` | Scored snapshot: `r..c`, answered counts, `d_ei..d_jp`, code, top groups, ties, completeness, algorithm version |
| `interest_group_weights` | 8 major groups × 6 RIASEC weights; each row sums to 1 ±0.001 |
| `interest_group_pairs` | Optional 4-pair weights; no rows by default (D12) |
| `career_match_config` | 7 keys: `w_hoc_luc`, `w_tinh_cach`, matrix thresholds, `do_phu_min`, `hoc_luc_mode` |
| `user_exam_scores` | Self-reported total per admission block (`0–30`, source `tự khai`); `T_student` for `hocLucFit`/`pBench` |

The instrument seed is `backend/src/data/interest_instrument_v1.json` (60 + 48 items). The pair key contract is per item: odd `itemNo` → first letter on the left, even → first letter on the right. `D = Σ(even) − Σ(odd)`.

- `saveAuthDb()` exports to a temp file, fsyncs it, and renames it over `auth.db`; on Windows it first moves the previous file aside so the replacement stays close to atomic. The file is given mode `0600` where supported.
- Auth mutations are serialized through `runAuthMutation()`. `reloadAuthDb()` reopens the file after an external replacement (used by tests/CLI); the server does not hot-reload auth writes from another process.
- Never point `LEARNPATH_AUTH_DB_PATH` at `learnpath.db`; the module rejects it.

## 6. Import pipeline

`init.js` runs in this order:

1. Drop the five tables.
2. Create the schema.
3. Import blocks from `data/khoi_thi/theo_khoi_thi/*.txt`.
4. Import schools from `data/khoi_thi/theo_truong/*.txt`.
5. Import score rows from `data/diem_chuan/*.json`.
6. Import candidates from `data/diem_thptqg_2026/*.csv`.
7. Import proposals from `data/de_an_tuyen_sinh/*.md`.
8. Create indexes and save the DB.

### Block parser

- Header format: `# Khối: <code or comma-separated codes> (<subjects>)`.
- One file can define several codes; every code is inserted.
- Codes must match `^[A-Z][0-9A-Z]{1,4}$`.
- Source count is the number of school lines starting with `[CODE]`.
- The current source has 260 files → 281 unique codes. One file has no block code and is skipped with a warning.
- The old parser skipped every file whose name contained `(`; the new parser processes the content and only skips files that genuinely have no code.

### School parser

- Filename format: `[CODE] - [School name].txt`.
- School rows are inserted with `INSERT OR IGNORE`; duplicate codes are ignored.
- Invalid filenames and read errors are logged; they are not silently swallowed.

### Score importer

- Reads five JSON method files.
- Maps source school names to codes with exact/normalised matching and an abbreviation table.
- Uses `toNumber()` so `0` stays `0`; the old `parseFloat(...) || null` converted zero to null.
- Uses `INSERT OR IGNORE` on `(ma_truong, nganh, to_hop_mon, phuong_thuc)`.
- Known mapping errors and orphans are listed in `KNOWN_ISSUES.md`; they are not corrected yet.

### Candidate CSV importer

- Uses `csv-parse/sync` with BOM handling, quoted-field support, and trimmed values.
- Preserves zero scores with `toNumber()`.
- Inserts in batches; logs progress and errors.

### Proposal importer

- Reads `[CODE] - [Name].md` files.
- Stores the full Markdown and school name.
- Read/parse errors are logged per file.

## 7. Data invariants and limitations

- `diem_chuan.ma_truong` is not a foreign key; orphan codes are possible.
- `khoi_thi.so_truong` is source metadata and can differ from the join count.
- `to_hop_mon` is free text; filtering uses `LIKE` and can match substrings.
- `diem_chuan.nam` is 2025 for all current rows.
- `so_nganh` is computed case-insensitively in the route.
- The live DB still reflects the old importer (245 blocks, zero scores converted to null).
- A fixed import was verified in a temporary DB; the real DB must not be rebuilt without approval and a backup.

## 8. Error handling and security

- Routes return `400` for invalid pagination/validation/JSON, `401` for a missing/expired session, `403` for an untrusted origin, a locked/deleted account, a disabled admin, or a forced password change, `404` for a missing proposal/row/API, `409` for duplicates or dependency conflicts, `413` for an oversized JSON body, `429` for rate limits (with `Retry-After`), `503` when admission writes are blocked, and `500` for unexpected failures.
- CORS uses an allowlist with credentials; `Access-Control-Allow-Origin: *` is never sent. Auth and admin POSTs also check `Origin` directly.
- Passwords use scrypt (`N=32768, r=8, p=1`) with a per-user 16-byte salt; unknown usernames run a dummy scrypt verification. Admin passwords use the same format.
- Sessions are random 32-byte tokens stored as SHA-256 hashes. The `lp_session` cookie is HttpOnly, SameSite=Lax, Path=/, 7 days, and `Secure` in production.
- Admin sessions use a separate cookie (`lp_admin_session`, or `__Host-lp_admin_session` in production) with SameSite=Strict, 8 h absolute, 30 min idle, max 3 per admin. Every non-GET admin request needs `X-Admin-CSRF`; the token is stored only as an HMAC in the session row. `ADMIN_ALLOWED_IPS` can restrict the whole admin router.
- Admin login is rate-limited to 5 failures per IP+username and 20 per IP per 15 minutes. User login is 5 per IP+username and 30 per IP; registration is 10 per IP per hour. All counters are in-memory per backend process and do not coordinate across instances.
- Admin audit entries are written for login success/failure, logout, user create/bulk/edit/lock/unlock/restore/reset/delete, data create/update/delete/force variants, and token/CSRF failures. Details are JSON-sanitized (passwords, hashes, tokens, CSRF, cookies, authorization, and secrets removed), IPs are HMAC-hashed, and entries older than 180 days are purged.
- Admission writes are serialized in one process: backup, transaction, `quick_check`, atomic file replace, reload. A failed reload blocks further writes rather than serving a stale or corrupt DB. Backups are capped at 5 files in `backend/database/backups/`.
- Responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`; production also sets HSTS. `/admin` is not linked publicly, is lazy-loaded, and sets `noindex,nofollow`; `robots.txt` disallows `/admin` and `/api/`.
- No CSP is configured, and proposal Markdown is rendered with `rehype-raw`; only trusted project data should be imported. No request logging is configured (KI-18).
- SQL uses bound parameters; the only dynamic SQL identifiers are from fixed whitelists or generated placeholders.
- `getDb()` caches the admission DB in memory. Admin writes replace and reload it through the write engine; a manual file replacement still requires a process restart. Auth DB writes are exported after each mutation.
