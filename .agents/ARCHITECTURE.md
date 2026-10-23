# ARCHITECTURE — LearnPath

> Technical reference: system diagram, API contract, DB schema, data flow, invariants.
> Read `PROJECT_CONTEXT.md` first if you are new to the product.

## 1. System overview

```text
┌─────────────────────────────┐   HTTP /api + lp_session  ┌──────────────────────────────┐
│ Browser                     │  ──────────────────────▶  │ Express (port 3001)          │
│ React 18 + Vite (5173)      │                           │ server.js                    │
│ axios baseURL '/api'        │  ◀──────────────────────  │ auth/* + routes/*            │
└─────────────────────────────┘         JSON              └──────────────┬───────────────┘
                                                                         │ sql.js
                                                ┌────────────────────────┴─────────────────────┐
                                                ▼                                              ▼
                                 ┌──────────────────────────────┐              ┌──────────────────────────────┐
                                 │ learnpath.db (~109 MiB)      │              │ auth.db (small)              │
                                 │ loaded fully into RAM        │              │ users + sessions             │
                                 │ read-only at runtime         │              │ writable                     │
                                 └──────────────────────────────┘              └──────────────────────────────┘
```

- Vite proxies `/api` to `http://localhost:3001` during development.
- In production, put `/api` behind the same reverse proxy, use HTTPS, and add an SPA fallback to `index.html`.
- `sql.js` loads both DB files at startup. Admission queries run against an in-memory copy and normal requests never write it.
- Auth writes go only to the separate auth DB. The importer is the only process that creates/replaces the admission DB.
- The browser authenticates with the `lp_session` HttpOnly cookie; JS cannot read the session token.

## 2. Runtime startup

`backend/server.js`:

1. Optionally sets `trust proxy` when `TRUST_PROXY=1`, disables `X-Powered-By`, and adds security headers.
2. Registers the CORS allowlist (credentials enabled) and a 10 kB JSON body limit.
3. Mounts public `/api/auth` routes, then public `/api/health`.
4. Mounts `/api/diem-chuan`, `/api/de-an`, `/api/khoi-thi`, and `/api/diem-thi` behind `requireAuth`.
5. Adds a JSON 404 for unknown `/api` paths and an error handler (400 JSON, 413 oversized, 500 fallback).
6. `getDb()` loads the admission DB into `sql.js`. If missing, startup fails with an actionable error; it does **not** create a schema.
7. `getAuthDb()` opens/creates the auth DB and validates `PRAGMA user_version = 1`.
8. The process listens on `process.env.PORT || 3001`.

Environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 3001) |
| `LEARNPATH_DB_PATH` | Admission DB path; useful for isolated import tests |
| `LEARNPATH_AUTH_DB_PATH` | Auth DB path (default `backend/database/auth.db`); must differ from the admission DB |
| `APP_ORIGIN` | Allowed browser origin for auth POSTs/CORS (default `http://localhost:5173,http://127.0.0.1:5173`) |
| `NODE_ENV` | `production` enables `Secure` cookies and HSTS |
| `TRUST_PROXY` | Set to `1` only behind a trusted reverse proxy so `req.ip` is correct |

`backend/src/database/db.js` exports:

- `getDb({ createIfMissing })` — load/caches the admission DB; `createIfMissing` is used only by `init.js`.
- `saveDb()` — export the in-memory admission DB to disk; only the importer should call it.
- `queryAll(sql, params)` / `queryOne(sql, params)` / `run(sql, params)` helpers.

`backend/src/auth/authDb.js` exports the same query helpers plus `getAuthDb()` and `saveAuthDb()`. Auth writes are exported to a temp file, atomically renamed over `auth.db`, and given mode `0600` where supported.

## 3. Frontend

| Route | Component | Access | Data source |
|---|---|---|---|
| `/` | `pages/TrangChu.jsx` | Public | Static marketing content; auth-aware CTA |
| `/dang-nhap` | `pages/AuthPage.jsx` | Public | `/api/auth/login`, `/api/auth/me` |
| `/dang-ky` | `pages/AuthPage.jsx` | Public | `/api/auth/register` |
| `/de-an` | `pages/DeAnTuyenSinh.jsx` | Protected | `/api/de-an`, `/api/de-an/:maTruong` |
| `/diem-chuan` | `pages/DiemChuan.jsx` | Protected | `/api/diem-chuan`, `/phuong-thuc`, `/stats` |
| `/khoi-thi` | `pages/KhoiThi.jsx` | Protected | `/api/khoi-thi`, `/api/khoi-thi/:maKhoi`, `/api/diem-chuan` |
| `/thu-hang` | `pages/ThuHang.jsx` | Protected | `/api/diem-thi/ranking`, `/api/diem-thi/stats` |

Implementation notes:

- `frontend/src/lib/api.js` is an axios instance with `baseURL: '/api'` and `withCredentials: true`.
- `AuthContext` calls `/api/auth/me` on startup, exposes `login`, `register`, `logout`, and clears auth state on a `401`.
- `ProtectedRoute` redirects guests to `/dang-nhap?redirect=<encoded target>`; the auth page returns there after login/register. Logged-in users visiting the auth page are sent home.
- The session token is **not** stored in localStorage, sessionStorage, or JS-readable state; the browser holds only the HttpOnly cookie.
- Pages have loading, empty, and error states. Do not reintroduce empty `catch` blocks.
- The Benchmark scores page triggers the score request when a method is selected; search/sort/block filters reset pagination to page 1.
- A request-id guard prevents a late response from replacing a newer selection.
- The Admission proposals page detail view clears the previous detail before a new request and offers a retry on failure.
- TOC IDs come from `rehype-slug`; `extractHeadings` uses `github-slugger` in the same order. Do not reintroduce a separate `slugify()` implementation.
- The Exam blocks page shows the source `so_truong` as “trường xét tuyển” and a separate count of schools actually joined to score data.
- The ranking page discloses that the current API does not rank within a subject combination.

## 4. API reference

Base URL: `/api`. Successful list responses use `{ "data": [...], "total": number }`; detail responses use `{ "data": object }`. Errors use `{ "error": "message" }`.

`/api/health` and `/api/auth/*` are public. Every `/api/de-an`, `/api/diem-chuan`, `/api/khoi-thi`, and `/api/diem-thi` request requires a valid `lp_session`; missing/expired/forged sessions return `401 { "error": "Vui lòng đăng nhập để tiếp tục." }` and clear the cookie. Auth responses set `Cache-Control: no-store`.

### Auth endpoints

Auth POSTs must come from `APP_ORIGIN` (or a request with no `Origin`, e.g. server-to-server). Untrusted browser origins return `403`.

#### `POST /api/auth/register`

Body: `{ "username": "...", "password": "...", "passwordConfirm": "..." }`.

- `201` → `{ "data": { "user": { "id", "username", "createdAt" } } }`; also creates a session and sets `lp_session`.
- `400` invalid username/password/confirmation.
- `409` username already exists (case-insensitive).
- `429` registration rate limit; includes `Retry-After`.
- Registration is limited to 10 attempts per IP per hour (in-memory).

#### `POST /api/auth/login`

Body: `{ "username": "...", "password": "..." }`.

- `200` → `{ "data": { "user": { "id", "username", "createdAt" } } }`; also creates a new session.
- `400` missing/invalid input.
- `401` generic `Tên đăng nhập hoặc mật khẩu không đúng.` Unknown usernames still run a dummy scrypt verification.
- `429` after 5 failures for the same IP+username or 30 failures for the same IP in 15 minutes.

#### `GET /api/auth/me`

Returns `{ "data": { "user": { "id", "username", "createdAt" } } }`. Requires a session; `401` otherwise.

#### `POST /api/auth/logout`

Deletes the current session, clears `lp_session`, and returns `204` with no body. Calling it without a session is harmless.

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

Created and version-checked by `backend/src/auth/authDb.js`; it is **separate from the admission schema** and is never imported by `init.js`.

`PRAGMA user_version = 1`.

#### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `username` | TEXT NOT NULL | Original casing, returned to the UI |
| `username_lower` | TEXT NOT NULL UNIQUE | Lower-cased lookup key; enforces case-insensitive uniqueness |
| `password_hash` | TEXT NOT NULL | `scrypt$32768$8$1$<salt-base64url>$<hash-base64url>` |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |

#### `sessions`

| Column | Type | Notes |
|---|---|---|
| `token_hash` | TEXT PRIMARY KEY | SHA-256 of the random session token, base64url |
| `user_id` | INTEGER NOT NULL | References `users(id)` with `ON DELETE CASCADE` |
| `created_at` | INTEGER NOT NULL | Unix epoch milliseconds |
| `expires_at` | INTEGER NOT NULL | 7 days after creation; expired rows are removed on new sessions |

Indexes: `sessions(user_id)`, `sessions(expires_at)`.

- The raw session token exists only in the HttpOnly cookie; the DB has only its hash.
- `saveAuthDb()` writes a temp file and renames it over `auth.db` to avoid partial writes.
- Opening an auth DB with a newer `user_version` or missing tables aborts startup. Remove/restore the file to recreate an empty auth DB only when account loss is acceptable.

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

- Routes return `400` for invalid pagination/validation/JSON, `401` for a missing/expired session, `403` for an untrusted auth origin, `404` for a missing proposal/API, `413` for an oversized JSON body, `429` for rate limits (with `Retry-After`), and `500` for unexpected failures.
- CORS uses an allowlist with credentials; `Access-Control-Allow-Origin: *` is never sent. Auth POSTs also check `Origin` directly.
- Passwords use scrypt (`N=32768, r=8, p=1`) with a per-user 16-byte salt; unknown usernames run a dummy scrypt verification.
- Sessions are random 32-byte tokens stored as SHA-256 hashes. The `lp_session` cookie is HttpOnly, SameSite=Lax, Path=/, 7 days, and `Secure` in production.
- Login and registration rate limits are in-memory per backend process. They do not coordinate across multiple instances.
- Responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`; production also sets HSTS.
- No CSP is configured, and proposal Markdown is rendered with `rehype-raw`; only trusted project data should be imported. No request logging is configured (KI-18).
- SQL uses bound parameters; the only dynamic SQL identifiers are from fixed whitelists or generated placeholders.
- `getDb()` caches the admission DB in memory; the process must be restarted after replacing that file. Auth DB writes are exported after each mutation.
