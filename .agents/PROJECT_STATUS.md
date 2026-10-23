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
- **State**: runs locally; auth, frontend build, API smoke, and headless E2E checks pass; data gaps remain; no commit/push in this session.

## 2. Actual stack

| Layer | Technology |
|---|---|
| Frontend | React 18.2 + Vite 5 + Tailwind 3 + local shadcn-style components |
| Router | react-router-dom 6 |
| Charts/Markdown | Recharts; react-markdown + remark-gfm + rehype-raw + rehype-slug |
| Backend | Express 4 + `sql.js` 1.10 (SQLite WASM) |
| Admission DB | `backend/database/learnpath.db` (~109 MiB), not committed, read-only at runtime |
| Auth DB | `backend/database/auth.db` (small, auto-created, not committed), writable |
| Import | `backend/src/database/init.js`; `csv-parse/sync` for candidate CSV |
| Auth | Custom username/password; Node `crypto` scrypt; server-side sessions |
| Tests/Lint/CI | No committed framework; temporary smoke/E2E scripts used |

## 3. Verification status (2026-10-23)

| Item | Result | Evidence |
|---|---|---|
| Frontend build | Pass | 2,642 modules; JS 1,009.03 kB (gzip 304.89 kB); CSS 27.51 kB (gzip 5.45 kB); >500 kB warning |
| Backend start | Pass | `Database connected`; `Auth database ready`; `Server running on http://localhost:3001` |
| `/api/health` | 200 public | `{status:'ok'}` |
| Data APIs without a session | 401 | All four data groups reject guests |
| Auth API | Pass 29/29 | Register/login/logout/me, persistence, 401/409/429, CORS/origin, body errors |
| Auth cookie | Pass | HttpOnly/SameSite=Lax/Path=/; `Secure` + 7-day `maxAge` in production |
| Auth DB isolation | Pass | Temp auth DBs; default `auth.db` absent; no plaintext password |
| `/api/de-an?limit=2` | 200 authenticated | `total=307`, `data.length=2` |
| `/api/de-an?search=Hà Nội` | 200 authenticated | `total=35` |
| `/api/diem-chuan/stats` | 200 authenticated | `tongTruong=35`, `tongNganh=1297` |
| `/api/khoi-thi` | 200 authenticated | 245 rows (live DB) |
| `/api/khoi-thi/A00` | 200 authenticated | `so_truong=232`, joined 25, BKA 82 majors |
| `/api/diem-thi/stats` | 200 authenticated | `tongThiSinh=1131975` |
| `/api/diem-thi/ranking` | 200 authenticated | `toan=8,van=8,ly=8` → rank 420,859 |
| Invalid pagination | 400 authenticated | `de-an` and `diem-chuan` invalid `limit`/`offset` |
| Temp import | Pass | 281 blocks, 12 zero cells, 5 all-null rows |
| Browser E2E | Pass (temporary) | Headless Chrome: 16 auth/route/UI checks |
| Unit/integration tests | No committed framework | Temporary auth DB/password/validation and API checks passed |
| Admission DB integrity | Pass | SHA-256 unchanged after API/UI tests |
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
| Authentication | Works | Register/login/logout; scrypt; 7-day server session; protected routes/APIs; rate limits; no reset/MFA |
| Intro video | Works | 4.1 MB; muted fallback handled; size remains a risk |
| Home | Works | Public; marketing stats are static; auth-aware CTA |
| Login/Register | Works | Vietnamese UI; confirmation validation; auto-login; redirect back to the intended page |
| Admission proposals | Works (protected) | 307 rows; real total; detail error/retry fixed; TOC IDs fixed |
| Benchmark scores | Partial (protected) | 5 methods; pagination fixed; `nhom_nganh` removed; data mapping/coverage open |
| Exam blocks | Partial (protected) | 245 live blocks; 281 after rebuild; source vs joined count clarified |
| THPTQG ranking | Partial (protected) | Errors shown; calculation semantics still wrong; warning added |
| Major comparison | Partial (protected) | In Exam blocks; 2–5 items |
| Production deploy | Not configured | Proxy/SPA fallback/TLS/CI missing; auth needs HTTPS + `APP_ORIGIN` |

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

## 7. Priorities

### P1 — correctness/data

- [ ] KI-02: decide ranking semantics, then fix query/bins.
- [ ] KI-03a: correct 5 mappings + add DNV/FPT and target schools.
- [ ] KI-03b: decide coverage/proposal-school policy.
- [ ] KI-03c/KI-17: rebuild the real DB with the fixed importer (approval + backup).
- [ ] KI-15: decide 2025 vs 2026 year semantics.

### P2 — UX/stability

- [ ] KI-10/KI-20: compress/lazy-load the intro video.
- [ ] KI-11: split the 1,009 kB JS bundle.
- [ ] KI-12: add committed auth/API tests, lint, and CI.
- [ ] KI-18: add CSP and request/audit logging; sanitize raw Markdown if it becomes untrusted.
- [ ] KI-19: define stats semantics.
- [ ] KI-22: decide whether to add password reset/MFA and a shared auth store before multi-instance deployment.

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
