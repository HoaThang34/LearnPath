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

`backend/src/auth/authDb.js` exports the same query helpers plus `AUTH_DB_PATH`, `SCHEMA_VERSION`, `getAuthDb()`, `saveAuthDb()`, `runAuthMutation()`, and `reloadAuthDb()`. Auth writes are exported to a temp file, fsynced, and renamed over `auth.db`; a previous-file fallback protects against a failed rename. The file is given mode `0600` where supported. The schema is versioned with `PRAGMA user_version = 5`; v4→v5 adds structured academic scores, career selections, and admin-managed career rubric tables.

`backend/src/admin/admissionWrite.js` serializes admission writes. It creates `backend/database/backups/` (max 5 files), copies the DB before the first write and before destructive operations, runs the mutation inside a transaction, checks `PRAGMA quick_check`, writes atomically, and reloads. A failed reload sets a write-block flag so the server does not continue on a stale or broken DB. Thao tác ghi hỗ trợ chỉnh sửa đề án tuyển sinh, chỉnh sửa điểm chuẩn và thêm dữ liệu mới thủ công.

## 3. Frontend

| Route | Component | Access | Data source |
|---|---|---|---|
| `/` | `pages/TrangChu.jsx` | Public | Static marketing content; auth-aware CTA |
| `/dang-nhap` | `pages/AuthPage.jsx` | Public | `/api/auth/login`, `/api/auth/me` |
| `/dang-ky` | `pages/AuthPage.jsx` | Public | `/api/auth/register` |
| `/doi-mat-khau` | `pages/ChangePasswordPage.jsx` | Authenticated | `/api/auth/change-password` |
| `/admin/*`, `/admin_*` | `pages/AdminPage.jsx` (lazy) | Admin cookie | `/api/admin/*` |
| `/de-an` | `pages/DeAnTuyenSinh.jsx` | Protected | `/api/de-an`, `/api/de-an/:maTruong` |
| `/diem-chuan` | `pages/DiemChuan.jsx` | Protected | `/api/diem-chuan`, `/phuong-thuc`, `/stats` |
| `/khoi-thi` | `pages/KhoiThi.jsx` | Protected | `/api/khoi-thi`, `/api/khoi-thi/:maKhoi`, `/api/diem-chuan` |
| `/thu-hang` | `pages/ThuHang.jsx` | Protected | `/api/diem-thi/ranking`, `/api/diem-thi/stats` |
| `/thong-tin-ca-nhan` | `pages/ThongTinCaNhan.jsx` | Protected | `/api/auth/profile` |
| `/khao-sat` | `pages/KhaoSat.jsx` | Protected | `/api/auth/survey/questions`, `/api/auth/survey/submit` |
| `/phan-tich-nang-luc` | `pages/PhanTichNangLuc.jsx` | Protected | `/api/career/overview`, `/api/career/scores`, `/api/career/majors`, `/api/career/selections` |

Implementation notes:

- `frontend/src/lib/api.js` is an axios instance with `baseURL: '/api'` and `withCredentials: true`.
- `AuthContext` calls `/api/auth/me` on startup, exposes `login`, `register`, `logout`, and `changePassword`, and clears auth state on a `401`.
- `ProtectedRoute` redirects guests to `/dang-nhap?redirect=<encoded target>`; the auth page returns there after login/register. Users with `mustChangePassword` are redirected to `/doi-mat-khau` before any protected page or data API.
- The session token is **not** stored in localStorage, sessionStorage, or JS-readable state; the browser holds only the HttpOnly cookie.
- `/admin/*` and `/admin_*` (`/admin_home`, `/admin_user`, `/admin_survey`, `/admin_data`, `/admin_audit`) are lazy-loaded outside `Layout`, have no public links, set `document.title` and a `noindex,nofollow` meta tag, and use `frontend/src/lib/adminApi.js` with its own cookie/CSRF handling. A user `401` must not redirect an admin to `/dang-nhap`.
- The admin CSRF token lives in memory only; a reload fetches it again from `/api/admin/auth/me`. The `admin:unauthorized` event clears the admin UI without touching user auth.
- `frontend/public/robots.txt` disallows `/admin`, `/admin_`, and `/api/`.
- Pages have loading, empty, and error states. Do not reintroduce empty `catch` blocks.
- The Benchmark scores page triggers the score request when a method is selected; search/sort/block filters reset pagination to page 1.
- A request-id guard prevents a late response from replacing a newer selection.
- The Admission proposals page detail view clears the previous detail before a new request and offers a retry on failure.
- TOC IDs come from `rehype-slug`; `extractHeadings` uses `github-slugger` in the same order. Do not reintroduce a separate `slugify()` implementation.
- The Exam blocks page shows the source `so_truong` as “trường xét tuyển” and a separate count of schools actually joined to score data.
- The ranking page discloses that the current API does not rank within a subject combination.

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

Query params: `toan`, `van`, `ly`, `hoa`, `sinh`, `su`, `dia`, `tin_hoc`, `ngoai_ngu`.

- At least one subject is required; otherwise 400.
- The current implementation sums the supplied subjects and compares that sum with the sum of **all** subjects for every candidate.
- `30` is excluded from the top `27-30` bin because the condition is `< 30`; the API therefore omits candidates with totals >= 30 from the distribution.
- The response includes `diemNhap`, `tongDiem`, `soMon`, `thuHang`, `tongThiSinh`, `tyLePhanTram`, `phanBoDiem`.
- This is a known semantic bug (KI-02), not a subject-combination ranking.

### `GET /api/diem-thi/stats`

Returns total candidates and average scores for Toán, Văn, Lý, Hóa. Averaged fields ignore null values.

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
| `diem_lop` | TEXT | JSON string của mảng điểm các môn: `[{mon, diem}]` |
| `chung_chi` | TEXT | JSON string của mảng chứng chỉ: `[{loai, diem}]` |
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
