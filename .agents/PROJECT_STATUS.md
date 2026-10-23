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
| Unit/integration tests | Pass 78/78 | Committed `node:test` suite; temp auth/admission DBs; real DBs untouched |
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
