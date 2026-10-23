# TESTING — Verification and acceptance

> There is no committed test framework, lint, or CI. Verify every change manually with the checks below.
> Temporary auth smoke/E2E scripts were used in this session; they are not part of the repo.
> Read `AI_RULES.md` section 2 first.

## 1. Baseline

```bash
git status --short
git log -1 --oneline
```

Record any pre-existing modifications. Do not hide or revert unrelated user work.

## 2. Backend

### 2.1 Start

```bash
cd backend
npm install
npm run dev
```

Expected:

```text
Database connected
Auth database ready
Server running on http://localhost:3001
```

If the admission DB is missing, the server must fail with an actionable message. It must not create the old schema. If the auth DB has a newer/incomplete schema, startup must also fail with an actionable message.

For isolated auth tests, stop the backend and restart it with a temporary auth DB. Never point it at `learnpath.db`.

```powershell
$env:LEARNPATH_AUTH_DB_PATH = Join-Path $env:TEMP "learnpath-auth-test.db"
npm run dev
```

### 2.2 Health

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Expected: `status = ok`, ISO timestamp. Health is public.

### 2.3 Auth API smoke

Run this before the data smoke; it creates `$session` used below.

```powershell
$base = 'http://localhost:3001'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$user = "smoke_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$body = @{ username = $user; password = 'MatKhau123'; passwordConfirm = 'MatKhau123' } | ConvertTo-Json

# Public health
Invoke-RestMethod "$base/api/health"

# Data API without a session -> 401
try {
  (Invoke-WebRequest "$base/api/de-an?limit=2" -UseBasicParsing).StatusCode
} catch {
  [int]$_.Exception.Response.StatusCode
}

# Register, auto-login, then check the session
$register = Invoke-WebRequest "$base/api/auth/register" -Method Post -Body $body `
  -ContentType 'application/json' -WebSession $session -UseBasicParsing
$register.StatusCode
$register.Headers['Set-Cookie']
Invoke-RestMethod "$base/api/auth/me" -WebSession $session

# Authenticated data API
Invoke-RestMethod "$base/api/de-an?limit=2" -WebSession $session

# Logout invalidates the session
Invoke-WebRequest "$base/api/auth/logout" -Method Post -WebSession $session -UseBasicParsing

# The old session must now be rejected
try {
  (Invoke-WebRequest "$base/api/auth/me" -WebSession $session -UseBasicParsing).StatusCode
} catch {
  [int]$_.Exception.Response.StatusCode
}

# Login again so the success smoke below can reuse $session
$loginBody = @{ username = $user; password = 'MatKhau123' } | ConvertTo-Json
Invoke-RestMethod "$base/api/auth/login" -Method Post -Body $loginBody `
  -ContentType 'application/json' -WebSession $session
```

Expected:

- Unauthenticated data request → `401`; response must not contain admission rows.
- Register → `201`; `Set-Cookie` includes `lp_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`; no token in the JSON body.
- `/me` returns `{ data: { user: { id, username, createdAt } } }`; no `password_hash`.
- Authenticated `/api/de-an?limit=2` → `200`, `total=307`.
- Logout → `204`; a later `/api/auth/me` or data request → `401`.

Additional auth checks:

- Mismatched `passwordConfirm` or a weak password → `400`.
- Duplicate username (case-insensitive) → `409`.
- Wrong password → `401` with the generic message; unknown username → same generic message.
- Referer/Origin: auth POST from an untrusted `Origin` → `403`; trusted `APP_ORIGIN` → allowed.
- Six failed logins for the same IP+username → `429` with `Retry-After`; registration attempts over 10/hour → `429`.
- In production (`NODE_ENV=production`), cookie has `Secure`; `clearCookie` uses the same flags.
- `LEARNPATH_AUTH_DB_PATH` pointing at the admission DB (including a different letter case on Windows) must abort startup.
- Confirm the browser has no token in localStorage/sessionStorage; the cookie is HttpOnly.
- The admission DB SHA-256 must be unchanged after auth tests. Use a temp auth DB and remove it afterwards.

### 2.4 Success smoke (authenticated)

Run after 2.3 so `$session` exists.

```powershell
$base = 'http://localhost:3001'
Invoke-RestMethod "$base/api/de-an?limit=2" -WebSession $session
Invoke-RestMethod "$base/api/de-an?limit=2&search=H%C3%A0%20N%E1%BB%99i" -WebSession $session
Invoke-RestMethod "$base/api/diem-chuan?limit=2" -WebSession $session
Invoke-RestMethod "$base/api/diem-chuan/stats" -WebSession $session
Invoke-RestMethod "$base/api/khoi-thi" -WebSession $session
Invoke-RestMethod "$base/api/khoi-thi/A00" -WebSession $session
Invoke-RestMethod "$base/api/khoi-thi/A00/truong/BKA" -WebSession $session
Invoke-RestMethod "$base/api/diem-thi/stats" -WebSession $session
Invoke-RestMethod "$base/api/diem-thi/ranking?toan=8&van=8&ly=8" -WebSession $session
```

Expected on the current live DB:

| Check | Expected |
|---|---|
| `/api/de-an?limit=2` | `total=307`, `data.length=2` |
| `/api/de-an?...search=Hà Nội` | `total=35` |
| `/api/diem-chuan?limit=2` | `total=2617`, `data.length=2` |
| `/api/khoi-thi` | 245 rows (live DB); 281 after an approved rebuild |
| `/api/khoi-thi/A00` | `so_truong=232`, `truong.length=25`, BKA `so_nganh=82` |
| `/api/diem-thi/stats` | `tongThiSinh=1131975` |
| Ranking | 200, numeric rank; known semantic bug remains |

### 2.5 Error smoke (authenticated)

Error checks need the session cookie; without it every request is `401`.

```powershell
function Get-ApiStatus($path) {
  try {
    return (Invoke-WebRequest "$base/api/$path" -WebSession $session -UseBasicParsing).StatusCode
  } catch {
    return [int]$_.Exception.Response.StatusCode
  }
}

foreach ($path in @(
  'de-an?limit=abc',
  'de-an?limit=0',
  'de-an?offset=-1',
  'de-an?limit=1001',
  'diem-chuan?limit=abc',
  'diem-chuan?offset=-1'
)) {
  "$path -> $(Get-ApiStatus $path)"
}
```

Expected: every line ends in `400`.

Also check:

- `/api/de-an/UNKNOWN` → 404.
- `/api/diem-thi/ranking` with no subjects → 400.
- `/api/auth/register` with malformed JSON → 400; body over 10 kB → 413.

## 3. Frontend

```bash
cd frontend
npm install
npm run build
```

Expected on the current working tree:

```text
2,642 modules transformed
dist/assets/index-*.js   1,009.03 kB | gzip 304.89 kB
dist/assets/index-*.css     27.51 kB | gzip   5.45 kB
built successfully
```

Vite may still warn that the JS chunk is > 500 kB. That warning is KI-11, not a build failure.

### Manual UI checklist

A temporary headless Chrome E2E passed 16 checks in this session, but it is not committed. Re-check these manually when changing auth or layout:

- [ ] Guest visiting `/de-an`, `/diem-chuan`, `/khoi-thi`, or `/thu-hang` is redirected to `/dang-nhap`; after login the original page loads.
- [ ] Registration blocks a mismatched password confirmation client-side; a successful registration auto-logs in.
- [ ] The session survives a page reload; the header shows the username and a logout control.
- [ ] A logged-in user visiting `/dang-nhap` or `/dang-ky` is redirected home.
- [ ] Logout returns to the public home page; protected routes and data APIs are blocked afterwards.
- [ ] Wrong credentials show the generic Vietnamese error; the form remains usable.
- [ ] The session cookie is HttpOnly; no token appears in localStorage, sessionStorage, or the URL.
- [ ] Desktop and mobile auth controls work; the mobile menu closes after navigation/logout.
- [ ] The browser console has no errors during register/login/logout.
- [ ] Home page links navigate to all four feature pages when logged in.
- [ ] Benchmark scores: selecting a method loads rows; invalid/offline backend shows an error.
- [ ] Benchmark scores: search on page 1 refetches; clearing restores the list; page resets to 1.
- [ ] Benchmark scores: quickly switching methods never shows the previous method's rows.
- [ ] Admission proposals: search filters schools; opening a school loads detail; Back then another school never shows the old detail.
- [ ] Admission proposals: if detail fails, an error and retry action appear.
- [ ] Admission proposals: TOC links jump to the correct heading, including duplicate headings in BKA/CMC/DDT.
- [ ] Exam blocks: source count is labelled “trường xét tuyển”; joined count is shown separately.
- [ ] Exam blocks: a failed school/major request shows an error, not a blank panel.
- [ ] Ranking: entering `0` displays `0` in the input; the warning is visible; failure shows an error.
- [ ] Intro video: autoplay with sound, muted fallback, skip, and unmute controls work.

## 4. Read-only admission DB inspection

```bash
node .agents/scripts/inspect-db.js
```

The script must only read the admission DB; it does not touch auth DB. It reports:

- table counts vs expected live counts;
- schema columns;
- block source vs live DB (281 source codes vs 245 live);
- block files skipped by the current parser;
- school mapping problems;
- `so_truong` vs joined school counts;
- score year/empty-block/zero-score/all-null stats;
- ranking distribution gap.

Expected headline for the live DB:

```text
khoi_thi: 245
truong: 260
diem_chuan: 2617
de_an_tuyen_sinh: 307
diem_thi_thptqg: 1131975
source block codes: 281
skipped block files: 1
```

After an approved rebuild, `khoi_thi` should be 281 and the source/live mismatch should be zero.

For auth/API/UI work, record the admission DB hash before and after and require equality:

```powershell
Get-FileHash backend/database/learnpath.db -Algorithm SHA256
```

## 5. Isolated import test

Never run this against the real DB.

```powershell
$tmp = Join-Path $env:TEMP "learnpath-init-test.db"
Remove-Item $tmp -ErrorAction SilentlyContinue
$env:LEARNPATH_DB_PATH = $tmp
node backend/src/database/init.js
node .agents/scripts/inspect-db.js --db $tmp
Remove-Item Env:\LEARNPATH_DB_PATH
```

Expected:

```text
Imported 281 blocks
Skipped 1 files without a valid block header:
  - (Ngữ văn, Vật lí, Tiếng Hàn).txt
Imported 260 schools
Total imported: 2617 records
Imported 1131975 records
Imported 307 records
Database initialization complete!
```

Expected temp-DB data:

- 281 blocks; 260 schools; 2,617 score rows; 307 proposals; 1,131,975 candidates.
- 12 zero score cells; 5 all-null candidate rows.
- 1 skipped block file.

## 6. Acceptance criteria for the recent fixes

- [x] `db.js` has no schema creation; missing DB produces a clear error.
- [x] Auth DB is separate from the admission DB, ignored by git, and uses `user_version = 1`.
- [x] Register/login/logout/`me` work; duplicate/mismatched/weak inputs return the documented status codes.
- [x] Guest pages redirect to login; authenticated sessions survive reload and backend restart.
- [x] Data APIs return 401 without a session and 200 with one.
- [x] Cookie is HttpOnly/SameSite=Lax/Path=/ with a 7-day TTL and Secure in production.
- [x] Login errors are generic; login/register rate limits return 429 with `Retry-After`.
- [x] Auth POSTs reject untrusted origins; CORS uses an explicit allowlist with credentials.
- [x] Admission DB hash is unchanged after auth tests.
- [x] Frontend build passes (2,642 modules); temporary headless browser E2E passes 16 checks.
- [x] `de-an` returns the real `total`.
- [x] Invalid pagination returns 400 on `de-an` and `diem-chuan`.
- [x] `so_nganh` is case-insensitive distinct; BKA A00 = 82, HVN A00 = 22.
- [x] Main pages show errors instead of empty catches.
- [x] No `Button asChild` usage remains.
- [x] Benchmark scores page no longer exposes `nhom_nganh`.
- [x] TOC uses `rehype-slug` + `github-slugger`.
- [x] Temp import produces 281 blocks and preserves 12 zero score cells.
- [ ] Real admission DB rebuilt with 281 blocks (requires approval).
- [ ] School mapping corrected (requires approval).
- [ ] Ranking semantics fixed (requires product decision).

## 7. Reporting template

```text
Changed:
- file: what/why

Verified:
- command: actual result

Data:
- admission DB hash unchanged / temp DB result / rebuild status
- auth DB path used (temp or real); no test accounts in the real auth DB

Risks:
- open issues, checks not run, etc.

VCS:
- no commit/push (unless requested)
```
