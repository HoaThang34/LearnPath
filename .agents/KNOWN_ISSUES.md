# KNOWN_ISSUES — Verified bugs and risks

> Last verified: **2026-10-23**.
> Priority: **P0** = broken build/data loss/security; **P1** = wrong result or broken core feature; **P2** = UX/performance/edge case; **P3** = cosmetic/docs.
> Status: **Fixed** = changed and verified; **Mitigated** = harmful symptom removed/disclosed, root cause remains; **Open** = verified and unresolved; **Deferred** = needs a product/data decision.

All fixes below are in the working tree only. Nothing has been committed or pushed.

## Summary

| ID | Priority | Area | Summary | Status |
|---|---|---|---|---|
| KI-01 | P1 | DB/bootstrap | `db.js` created an old schema when the DB was missing | Fixed |
| KI-02 | P1 | Ranking | 3-subject total compared with all-subject total; top score bin drops >= 30 | Open |
| KI-03a | P1 | Data mapping | 5 school codes mapped to wrong schools; 2 orphan codes | Open |
| KI-03b | P1 | Data coverage | 33/260 schools join to score data; 47 proposals absent from `truong` | Open |
| KI-03c | P1 | Data import | Old parser skipped 15 block files; fixed code parses 281 blocks | Fixed in code; rebuild pending |
| KI-03d | P1 | Data/UI | `so_truong` source count differs from joined school count | Mitigated |
| KI-03e | P2 | Data | 853/2,617 score rows have empty `to_hop_mon` | Open |
| KI-04 | P1 | Data/UI | `nhom_nganh` filter was a no-op | Mitigated |
| KI-05 | P2 | API | `de-an` returned page size as `total` | Fixed |
| KI-06 | P2 | API | No pagination validation; invalid values reached SQLite | Fixed |
| KI-07 | P2 | UI | Benchmark scores search/clear/reset/race issues | Fixed |
| KI-08 | P2 | UI | Admission proposals page could show stale data or fail silently | Fixed |
| KI-09 | P2 | UI | `Button asChild` used without Slot support | Fixed |
| KI-10 | P2 | Media | Autoplay fallback could reject unhandled | Mitigated |
| KI-11 | P2 | Performance | Main JS bundle is 1,009.03 kB (gzip 304.89 kB) | Open |
| KI-12 | P2 | Quality | No committed unit/integration tests, lint, or CI | Open |
| KI-13 | P2 | Error handling | Empty catches left blank UI/import failures | Fixed |
| KI-14 | P3 | Data | `so_nganh` counted rows/case variants, not distinct majors | Fixed |
| KI-15 | P1 | Data/product | All score rows use `nam = 2025` while the UI says 2026 | Open |
| KI-16 | P2 | Deploy | No production proxy/SPA fallback/health config | Open |
| KI-17 | P1 | Import | Old CSV parser lost zero scores and mishandled quoted fields | Fixed in code; rebuild pending |
| KI-18 | P2 | Security | CORS/auth/rate limits added; request logging, CSP, raw HTML remain | Mitigated |
| KI-19 | P2 | Stats | Stats mix score scales and use inconsistent distinct counts | Open |
| KI-20 | P3 | Assets | 4.1 MB intro video; no compression/lazy strategy | Open |
| KI-21 | P2 | UI/Markdown | TOC IDs broke on duplicate headings | Fixed |
| KI-22 | P2 | Auth/ops | Auth is single-process; no reset/MFA; duplicate username reveals existence | Open |

## Data snapshot

Live DB (`backend/database/learnpath.db`):

- 1,131,975 candidates; 2,617 score rows; 307 proposals; 260 schools; 245 blocks.
- 35 distinct score school codes/display names; only 33 join to `truong`.
- 227 of 260 `truong` rows have no score rows.
- 853 score rows have empty `to_hop_mon`.
- All 2,617 score rows have `nam = 2025`.
- 0 zero score cells; 6 candidate rows have all score fields null.
- Ranking example `toan=8&van=8&ly=8` returns rank 420,859 of 1,131,975.

Temporary import with the fixed code (`LEARNPATH_DB_PATH`):

- 281 blocks; 260 schools; 2,617 score rows; 307 proposals; 1,131,975 candidates.
- 12 zero score cells; 5 all-null candidate rows.
- 1 block file skipped because it has no block code.

Auth verification (2026-10-23):

- Temporary auth DBs only; the default `backend/database/auth.db` remained absent.
- API integration: 29/29 checks passed (register/login/logout/me, 401s, persistence, rate limits, CORS/origin, body errors).
- Headless Chrome E2E: 16 checks passed (redirects, register confirmation, cookie/storage, reload, logout, login, mobile menu, console).
- Production cookie flags and clear-cookie flags matched.
- Admission DB SHA-256 unchanged after API and UI tests.

## Details

### KI-01 — DB bootstrap schema drift (Fixed)

**Was**: `db.js` created an old `diem_chuan`/`khoi_thi` schema when the DB file was missing, saved it, and let the app start. That schema did not match `init.js`.

**Fix**:

- Removed all `CREATE TABLE` statements from `db.js`.
- `getDb()` now throws an actionable error when the DB is missing.
- Added `getDb({ createIfMissing: true })` for the importer only.
- Added `LEARNPATH_DB_PATH` for isolated import tests.

**Evidence**:

```text
EXPECTED ERROR: Database not found at ...\definitely-missing-learnpath.db.
Run "npm run db:init" in backend/ to create and import it.
```

The real DB was not modified.

### KI-02 — Ranking semantics and distribution (Open)

**Problem**:

- The API sums the subjects the user entered.
- It compares that total with `COALESCE(all 9 subjects, 0)` for every candidate.
- The `27-30` bin uses `total < 30`, so candidates with totals >= 30 are excluded.
- There are 110,632 candidates with all-subject total >= 30 in the live DB.

**Current mitigation**: the ranking page displays a warning that the result is not a subject-combination ranking and is for reference only.

**Still needed**: product decision on ranking scope (same entered subjects vs a selected combination vs exactly 3 subjects), missing-score policy, and distribution bins. Do not change the calculation without that decision.

### KI-03a — Wrong school mappings / orphan codes (Open)

| Source name | Current code | Correct code | Rows affected |
|---|---|---|---|
| Học viện Hành chính Quốc gia | `HCP` | `HCH` | 50 |
| ĐH Mỹ thuật Công nghiệp | `MTU` | `MTC` | 7 |
| Nhạc viện Hà Nội | `NHB` | `NVH` | 8 |
| ĐH Sân khấu - Điện ảnh Hà Nội | `SKH` | `SKD` | 27 |
| ĐH Kinh tế TP.HCM | `UEF` | `KSA` | 120 |

The five wrong mappings affect 212 rows. `DNV` (32 rows) and `FPT` (7 rows) are orphan codes, affecting another 39 rows. `HCP`, `MTU`, `NHB`, `SKH`, and `UEF` currently belong to unrelated schools; the correct target codes (`HCH`, `KSA`, `MTC`, `NVH`, `SKD`) either have zero rows or are absent from `truong`.

**Fix plan**: update the abbreviation table, add the missing target school rows, add `DNV`/`FPT`, rebuild in a temporary DB, verify, then request approval for the real rebuild.

### KI-03b — Score coverage and proposal/school mismatch (Open)

- `diem_chuan` has 35 distinct score codes/names.
- Only 33 of them join to the current `truong`; `DNV` and `FPT` are orphans.
- 227 of 260 `truong` rows have no score rows.
- 47 proposal codes from `de_an_tuyen_sinh` are absent from `truong`.

`/api/diem-chuan/stats` reports `tongTruong = 35`, which is `COUNT(DISTINCT truong)` in `diem_chuan`, not the joined coverage. The UI/docs must explain this before showing a coverage percentage.

**Decision needed**: whether to import all proposal schools into `truong`, and whether score coverage should be measured against proposals or block files.

### KI-03c — Block file import (Fixed in code; rebuild pending)

**Was**: the old importer filtered out every block filename containing `(` and only accepted a single code in the header. 15 files were skipped and 36 codes were missing, including `X02`, `K21`, `TH6`, `DK`, `F01`, `TH3`, `H10`, `H11`, `H06`.

**Fix**:

- Parse the file content, not the filename.
- Accept comma/semicolon-separated codes.
- Validate codes with `^[A-Z][0-9A-Z]{1,4}$`.
- Log skipped files and per-file errors.
- Count inserted rows with `getRowsModified()`.

**Evidence**:

- Temp import: `Imported 281 blocks`; one file skipped: `(Ngữ văn, Vật lí, Tiếng Hàn).txt`.
- Live DB still has 245 blocks. `/api/khoi-thi` will stay at 245 until a rebuild.

### KI-03d — `so_truong` vs joined schools (Mitigated)

`khoi_thi.so_truong` is the count of school lines in the source block file. It is not a join count. For A00: `so_truong = 232`, joined schools = 25. Across the live DB, 244 of 245 blocks have a source count that differs from the joined score-school count.

**Mitigation**: the Exam blocks page labels the source number as “trường xét tuyển” and shows the actual joined count separately.

**Still open**: the API field name remains misleading for consumers that do not read the UI.

### KI-03e — Empty `to_hop_mon` (Open)

853 of 2,617 score rows have `NULL` or empty `to_hop_mon`. They disappear from block filters. This is a source-data issue; fixing it requires a data mapping decision, not a UI patch.

### KI-04 — No-op `nhom_nganh` filter (Mitigated)

The backend endpoint returns five static cluster names and ignores the query parameter. The Benchmark scores page no longer exposes the filter. `getNhomNganh()` and `/api/diem-chuan/nhom-nganh` remain as legacy code. Do not re-add the UI control until the backend has a real major-group mapping.

### KI-05 — Admission proposals `total` (Fixed)

`/api/de-an` now runs a separate `COUNT(*)` with the same search filter and returns the real total.

**Evidence**: `limit=2` → `total=307`, `data.length=2`; `search=Hà Nội` → `total=35`.

### KI-06 — Pagination validation (Fixed)

Added `backend/src/routes/queryParams.js`. `de-an` and `diem-chuan` return 400 for invalid `limit`/`offset` instead of passing `NaN` or negative values to SQLite.

**Evidence**:

```text
de-an?limit=abc -> 400
de-an?limit=0 -> 400
de-an?offset=-1 -> 400
de-an?limit=1001 -> 400
diem-chuan?limit=abc -> 400
diem-chuan?offset=-1 -> 400
```

### KI-07 — Benchmark scores page search/clear/race (Fixed)

- Removed the non-functional `nhom_nganh` filter.
- Added `searchNonce` so pressing search while already on page 1 still refetches.
- `clearFilters` resets search, sort, block filter, and page.
- A request-id guard prevents a late response from replacing a newer method/filter selection.
- Added loading, empty, and error states.
- `clearFilters` is no longer rendered when no filter is active.

**Verification**: `npm run build` passes (2,642 modules). A temporary headless Chrome E2E passed 16 auth/route checks; it is not a committed harness, so re-check the UI manually after changes.

### KI-08 — Admission proposals page state (Fixed)

The original “stale detail on normal navigation” claim was not reproduced. A real race/error-state issue existed:

- Detail is cleared before a new request.
- A request-id guard ignores late responses.
- Errors show a retry action.
- Going back invalidates the in-flight request.

### KI-09 — `Button asChild` (Fixed)

`frontend/src/components/ui/button.jsx` has no Slot implementation. The home page used `Button asChild` with `Link` twice; the links were not rendered correctly.

**Fix**: use `Link` with `buttonVariants(...)`. No `asChild` usages remain.

### KI-10 — Intro video autoplay fallback (Mitigated)

First `play()` rejection now sets muted mode and retries. The retry rejection is caught and logged. The video file is still 4,120,347 bytes and has no compression strategy (see KI-20).

### KI-11 — Bundle size (Open)

Current build:

```text
2,642 modules transformed
dist/assets/index-*.js   1,009.03 kB | gzip 304.89 kB
dist/assets/index-*.css     27.51 kB | gzip   5.45 kB
```

Vite warns that the JS chunk is > 500 kB. Consider route-level `React.lazy`/dynamic imports, especially for Recharts and Markdown. This is not a correctness bug.

### KI-12 — No committed tests/lint/CI (Open)

There is no committed test framework, lint script, or CI. All verification is manual, although temporary auth smoke/E2E scripts were used in this session. The project needs at least:

- Auth integration tests for register/login/logout/me, 401/409/429, cookie flags, and rate limits against a temporary auth DB.
- API integration tests for success/400/404 with an authenticated session.
- A small unit test for `parsePagination`, `toNumber`, and password validation.
- An import smoke test against a temporary admission DB.
- A frontend build/test job.

### KI-13 — Empty catches (Fixed)

Removed empty catches from the four main pages and from the school/proposal import loops. Errors now log and, where applicable, show a Vietnamese error state. `grep` found no remaining empty `catch` blocks in `backend/` or `frontend/src`.

### KI-14 — `so_nganh` (Fixed)

`/api/khoi-thi/:maKhoi` now groups rows in JS and counts distinct major names case-insensitively. This handles capitalization variants in the source.

**Evidence**: A00 → BKA 82, HVN 22, GHA 97, HTC 25; `so_truong=232`, joined=25.

`/api/diem-chuan/stats` still uses exact-case `COUNT(DISTINCT nganh) = 1297` (KI-19).

### KI-15 — Year 2025 vs 2026 (Open)

All 2,617 score rows have `nam = 2025`; the UI and product name say 2026. This is a data/product decision. Do not change the year silently.

### KI-16 — Production deployment (Open)

No reverse proxy, SPA fallback, TLS, health check, process manager, or CI configuration exists. Production auth additionally requires HTTPS, `NODE_ENV=production`, and the correct `APP_ORIGIN`; `TRUST_PROXY=1` is safe only behind a trusted proxy. The current setup is local-development only.

### KI-17 — CSV/zero-score import (Fixed in code; rebuild pending)

**Was**:

- The hand-written CSV splitter broke on quoted commas.
- `parseFloat(value) || null` converted a valid `0` to `null`.

**Fix**:

- `csv-parse/sync` with BOM, columns, trimming, and quoted-field support.
- `toNumber()` preserves `0` and returns `null` only for blank/invalid values.

**Evidence**:

| Metric | Live DB (old import) | Temp DB (fixed import) |
|---|---|---|
| Zero score cells | 0 | 12 |
| All-null candidate rows | 6 | 5 |
| Candidates | 1,131,975 | 1,131,975 |

A real rebuild is required to apply this to the live DB.

### KI-18 — Security/deployment hardening (Mitigated)

**Fixed in this session**:

- Admission data APIs and feature routes require an authenticated session.
- CORS now uses an explicit origin allowlist with credentials; auth POSTs additionally reject untrusted `Origin`.
- Added auth rate limits, a 10 kB JSON body limit, security headers, and generic login errors.
- Passwords use scrypt; cookies are HttpOnly/SameSite=Lax and `Secure` in production; sessions store only token hashes.

**Still open**:

- `rehypeRaw` renders raw HTML from proposal Markdown. The source is currently trusted project data; sanitize it if proposals ever become user-generated.
- No CSP and no request/audit logging.
- Rate limits are in-memory per process; they are not shared across instances.
- Do not expose the API publicly without HTTPS, correct `APP_ORIGIN`, and these residual controls.

### KI-19 — Stats semantics (Open)

`/api/diem-chuan/stats`:

- `tongTruong` = distinct display names in `diem_chuan` (35), not joined coverage.
- `tongNganh` = exact-case distinct major names (1,297); case-insensitive would be lower.
- `diemCaoNhat`, `diemThapNhat`, `diemTrungBinh` mix SAT, THPT, HSA, TSA, and V-ACT scales.
- `diemThapNhat` ignores zero values with `WHERE diem_chuan > 0`.

These values need a product definition before being shown as a single summary.

### KI-20 — Intro video/assets (Open)

`frontend/public/video_intro.mp4` is 4,120,347 bytes (~3.9 MiB). It is loaded as a full-screen intro and is not compressed or lazily loaded. Consider a shorter/compressed clip or a poster-first strategy.

### KI-21 — TOC duplicate heading IDs (Fixed)

**Was**: `extractHeadings` and the custom heading components generated IDs independently. Duplicate headings received the same ID, so every TOC link jumped to the first occurrence. The custom components also derived the ID from only the first child node, so formatted headings could mismatch the TOC.

**Scope**: 27 of 307 proposal files contain duplicate headings. Examples: BKA has four repeated “I. Chương trình chuẩn”; CMC repeats “1. Cơ sở Hà Nội”; DDT, GHA, HCH, HTC, and others repeat section titles.

**Fix**:

- Added `rehype-slug` to the Markdown pipeline.
- Added `github-slugger` to `extractHeadings`, using the same slugger and sequential order as rehype-slug.
- Heading components now pass through the generated `id`.
- Fenced code blocks are skipped during TOC extraction.

**Verification**: `npm run build` passes (2,642 modules). A server-render check with two repeated headings produced matching IDs in the TOC and HTML (`i-chương-trình-chuẩn` and `i-chương-trình-chuẩn-1`). A browser click-through of duplicate TOC entries is still recommended.

### KI-22 — Auth operational limits (Open)

The auth feature is secure for a single-process local/demo deployment, but these limits remain:

- **Single process assumption**: `sql.js` keeps the auth DB in RAM and writes the whole file. Two backend processes writing the same `auth.db` can overwrite each other. Run one process or move to a shared database before horizontal scaling.
- **In-memory rate limits**: counters reset on restart and are not shared across instances.
- **Username enumeration**: `POST /api/auth/register` returns `409` for an existing username. Login stays generic. This is an intentional usability tradeoff; switch to a generic response if enumeration becomes a concern.
- **No account recovery**: no password reset/change, email verification, MFA, admin roles, or CAPTCHA.
- **Operational**: back up `auth.db`; keep it out of web roots; use HTTPS, `NODE_ENV=production`, and the real `APP_ORIGIN`.
- **Residual web hardening**: no CSP and no request/audit logging (KI-18).

## Out of scope / not changed

- The live admission DB was not rebuilt.
- The real school mappings and missing school rows were not edited.
- The ranking calculation was not changed.
- The score year was not changed.
- No test accounts were written to the default auth DB; it was absent after testing.
- No commit, push, or PR was made.
