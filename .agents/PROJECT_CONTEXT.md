# PROJECT_CONTEXT — LearnPath

> Read this to understand **what the product does, where the data comes from, how it runs, and where its limits are**.
> API/schema details are in `ARCHITECTURE.md`.

## 1. Goal and users

- **Product**: LearnPath — a career and university-admission guidance website.
- **Users**: Vietnamese high-school students and parents.
- **Core value**: look up admission proposals, benchmark scores, exam blocks, and THPTQG 2026 score ranking.
- **Current scope**: read-only admission data behind a username/password account. Home and auth pages are public; accounts and sessions live in a separate auth DB. No roles/admin UI yet.
- **Out of scope for now**: application submission, personalised recommendations, multi-year comparison, admin UI, password reset, email verification, MFA.

## 2. Features

| Page | Route | What it does | Main API |
|---|---|---|---|
| Home | `/` | Introduction, four feature cards, usage guide, marketing stats | None |
| Login | `/dang-nhap` | Username/password login; returns to the protected page | `/api/auth/login`, `/api/auth/me` |
| Register | `/dang-ky` | Create account with password confirmation; auto-login | `/api/auth/register` |
| Admission proposals | `/de-an` | Pick a school → read Markdown and table of contents (login required) | `/api/de-an`, `/api/de-an/:maTruong` |
| Benchmark scores | `/diem-chuan` | Pick a method → filter/sort → paginated table (login required) | `/api/diem-chuan`, `/phuong-thuc`, `/stats`, `/compare` |
| Exam blocks | `/khoi-thi` | Pick a block → school → majors; compare 2–5 majors (login required) | `/api/khoi-thi`, `/api/khoi-thi/:maKhoi` |
| THPTQG ranking | `/thu-hang` | Enter scores → rank and distribution chart (login required) | `/api/diem-thi/ranking`, `/api/diem-thi/stats` |

Notes:

- The four feature routes and their data APIs require a valid `lp_session` cookie. `/api/health` and `/api/auth/*` are public.
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
| Admission DB | `backend/database/learnpath.db` (~109 MiB), not committed, read-only at runtime |
| Auth DB | `backend/database/auth.db` (small, auto-created, not committed), writable |
| Import | `backend/src/database/init.js` |
| Auth | Custom username/password; Node `crypto` scrypt; server-side sessions; `sql.js` auth DB |
| Tests / lint / CI | No committed test framework or CI; temporary auth smoke/E2E scripts were used |

Runtime facts:

- `sql.js` loads the admission DB file into RAM at startup; normal requests never write it.
- The auth DB is a separate `sql.js` file. Registration/login/logout write only that file.
- Vite proxies `/api` to `http://localhost:3001` in development.
- Production needs a reverse proxy for `/api`, HTTPS, an SPA fallback to `index.html`, and the correct `APP_ORIGIN`.
- The backend refuses to start if the admission DB is missing. It does not create an old schema (fixed in KI-01).
- The auth DB schema is versioned with `PRAGMA user_version = 1`; an incompatible or incomplete auth DB stops startup.
- Default auth cookie: `lp_session`, HttpOnly, SameSite=Lax, Path=/, 7 days, `Secure` when `NODE_ENV=production`.
- If behind a trusted reverse proxy, set `TRUST_PROXY=1`; otherwise leave it unset to avoid spoofed client IPs.

### Authentication and access

- Register fields: username, password, password confirmation. Username is 3–32 ASCII letters/digits/`.`/`_`/`-`, starting and ending with a letter/digit. Password is 8–128 characters with at least one letter and one digit.
- Password hashes use scrypt (`N=32768, r=8, p=1`) with a 16-byte random salt. Login is case-insensitive for the username.
- Sessions are server-side; the auth DB stores only SHA-256 hashes of random session tokens. Logout deletes the current session.
- Login rate limits: 5 failures per IP+username and 30 failures per IP per 15 minutes. Registration is limited to 10 attempts per IP per hour. Limits are in-memory per process.
- Registration auto-logs in the new account. Duplicate usernames return 409 (this reveals that a username exists; login errors stay generic).
- Not implemented yet: password reset, change password, email verification, MFA, admin roles, CAPTCHA.

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

- Username/password auth is implemented: register, login, logout, `/me`, protected feature routes, protected data APIs, rate limits, and security headers.
- Auth verification passed: auth DB/password/validation checks; API integration 29/29; headless browser E2E 16 checks; production cookie flags.
- Frontend build passes: 2,642 modules; JS 1,009.03 kB (gzip 304.89 kB); CSS 27.51 kB (gzip 5.45 kB). The >500 kB chunk warning remains.
- Main pages have error states instead of empty catches.
- Pagination is validated and returns 400 for invalid values.
- `de-an` returns the real total count.
- `so_nganh` uses case-insensitive distinct majors.
- Data mapping, coverage, ranking semantics, and the real DB rebuild still need user approval.
- The default `backend/database/auth.db` was not created during tests; temp auth DBs were used. The admission DB hash was unchanged.
- No commit, push, or PR has been made.
