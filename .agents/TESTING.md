# TESTING — Verification and acceptance

> Backend auth/validation/rate-limit/auth DB/admin tests are committed under `backend/test/` and run with `npm test` (Node's built-in `node:test`). CI runs backend tests, frontend build, and a non-blocking dependency audit (`.github/workflows/ci.yml`). The API/data/admin smoke checks below remain manual.
> Temporary auth/admin E2E scripts from earlier sessions are not part of the repo.
> Read `AI_RULES.md` section 2 first.

## 1. Baseline

```bash
git status --short
git log -1 --oneline
```

Record any pre-existing modifications. Do not hide or revert unrelated user work.

## 2. Backend

### 2.1. Automated tests

Run before manual smoke:

```bash
cd backend
npm test
```

Expected: **78/78 tests pass** with no leftover temp DB. The suite uses a temporary auth DB via `LEARNPATH_AUTH_DB_PATH` and a temporary admission fixture via `LEARNPATH_DB_PATH`; it does not open or write `backend/database/auth.db` or `backend/database/learnpath.db`.

Test files:

| Group | Files | Covers |
|---|---|---|
| Unit | `origin`, `password`, `rateLimit`, `session`, `validation` | Origin checks, scrypt, rate-limit buckets, cookie parsing, username/password rules |
| Integration | `auth`, `admin`, `adminData`, `adminCli` | Register/login/forced change, admin auth/CSRF/session, user CRUD, admission CRUD, admin CLI |
| DB | `authDb` | Schema v2 creation, persistence, migration v1→v2, unsafe-path rejection, newer/incomplete schema rejection |

Individual groups:

```bash
npm run test:unit
npm run test:integration
npm run test:db
```

Windows note: the npm scripts quote the glob (`node --test "test/**/*.test.js"`); do not remove the quotes.

> **Real auth DB migration (2026-10-23):** `backend/database/auth.db` was migrated from v1 to v2 outside this test suite (cause not established). A backup exists at `backend/database/auth.db.v1-backup-20261023141514808`. Tests never touch this file. Do not restore or overwrite it without user approval.

### 2.2. Start

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

### 2.3 Health

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Expected: `status = ok`, ISO timestamp. Health is public.

### 2.4 Auth API smoke

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

### 2.5 Success smoke (authenticated)

Run after 2.4 so `$session` exists.

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

### 2.6 Error smoke (authenticated)

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

### 2.7 Admin smoke (temporary DBs only)

Never run this against `backend/database/auth.db` or the real admission DB. This procedure copies the admission DB to a temp folder and creates a fresh auth DB, starts a server on port 3101, and removes everything afterwards. The real admission DB hash must stay unchanged.

```powershell
$root = (Get-Location).Path
$temp = Join-Path $env:TEMP 'learnpath-admin-smoke'
New-Item -ItemType Directory -Force $temp | Out-Null
$authDb = Join-Path $temp 'auth.db'
$mainDb = Join-Path $temp 'learnpath.db'
Copy-Item 'backend/database/learnpath.db' $mainDb -Force
Remove-Item $authDb -ErrorAction SilentlyContinue

$env:LEARNPATH_AUTH_DB_PATH = $authDb
$env:LEARNPATH_DB_PATH = $mainDb
$env:PORT = '3101'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:ADMIN_PASSWORD = 'QuanTri123'

Push-Location backend
npm run admin:create -- --username smokeadmin
$server = Start-Process node -ArgumentList 'server.js' -WorkingDirectory (Get-Location) -PassThru
Pop-Location
Start-Sleep -Seconds 2

$base = 'http://localhost:3101'
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod "$base/api/admin/auth/login" -Method Post `
  -Body (@{ username = 'smokeadmin'; password = 'QuanTri123' } | ConvertTo-Json) `
  -ContentType 'application/json' -WebSession $adminSession
$csrf = $login.data.csrfToken
$headers = @{ 'X-Admin-CSRF' = $csrf; 'Origin' = 'http://localhost:5173' }

# Session and overview
Invoke-RestMethod "$base/api/admin/auth/me" -WebSession $adminSession
Invoke-RestMethod "$base/api/admin/overview" -WebSession $adminSession

# CSRF is mandatory for writes -> 403
try {
  Invoke-WebRequest "$base/api/admin/users" -Method Post -Body '{}' `
    -ContentType 'application/json' -WebSession $adminSession -UseBasicParsing
} catch {
  [int]$_.Exception.Response.StatusCode
}

# Create, lock, unlock a user
$user = Invoke-RestMethod "$base/api/admin/users" -Method Post -Headers $headers `
  -Body (@{ username = "smokeuser_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" } | ConvertTo-Json) `
  -ContentType 'application/json' -WebSession $adminSession
Invoke-RestMethod "$base/api/admin/users/$($user.data.id)/lock" -Method Post -Headers $headers -WebSession $adminSession
Invoke-RestMethod "$base/api/admin/users/$($user.data.id)/unlock" -Method Post -Headers $headers -WebSession $adminSession

# Metadata, list, create, update, delete a block in the temp DB
Invoke-RestMethod "$base/api/admin/data/tables" -WebSession $adminSession
Invoke-RestMethod "$base/api/admin/data/khoi_thi?limit=2" -WebSession $adminSession
$row = Invoke-RestMethod "$base/api/admin/data/khoi_thi" -Method Post -Headers $headers `
  -Body (@{ ma_khoi = 'ZZ9'; mon_thi = 'Smoke test' } | ConvertTo-Json) `
  -ContentType 'application/json' -WebSession $adminSession
Invoke-RestMethod "$base/api/admin/data/khoi_thi/$($row.data.id)" -Method Patch -Headers $headers `
  -Body (@{ mon_thi = 'Smoke updated' } | ConvertTo-Json) `
  -ContentType 'application/json' -WebSession $adminSession
Invoke-RestMethod "$base/api/admin/data/khoi_thi/$($row.data.id)" -Method Delete -Headers $headers `
  -Body (@{ confirm = $true } | ConvertTo-Json) `
  -ContentType 'application/json' -WebSession $adminSession

# Audit must contain actions and no secrets
Invoke-RestMethod "$base/api/admin/audit?limit=10" -WebSession $adminSession

# Logout and cleanup
Invoke-WebRequest "$base/api/admin/auth/logout" -Method Post -Headers $headers `
  -WebSession $adminSession -UseBasicParsing
Stop-Process -Id $server.Id -Force
Remove-Item Env:\LEARNPATH_AUTH_DB_PATH, Env:\LEARNPATH_DB_PATH, Env:\PORT, Env:\APP_ORIGIN, Env:\ADMIN_PASSWORD -ErrorAction SilentlyContinue
Remove-Item $temp -Recurse -Force
```

Expected:

- Admin login returns a `csrfToken`, sets `lp_admin_session` with `HttpOnly` and `SameSite=Strict`, and never returns a session token in JSON.
- `/auth/me` works with the cookie alone; writes without `X-Admin-CSRF` → `403`.
- Overview reports the temp DB paths, table counts, `quick_check = ok`, and backup state.
- User create returns a one-time temporary password; lock/unlock revoke/restore access.
- Data create/update/delete succeed on the temp DB; backups appear under `<temp>/backups/` and are removed with the temp folder.
- Audit contains the login/user/data actions; no password, token, cookie, or raw IP appears.
- Logout → `204`; later admin requests → `401`.
- The real `backend/database/learnpath.db` SHA-256 is unchanged.

Current end-to-end result for this procedure: **19 checks passed** on 2026-10-23 with temp DBs. The temporary server was stopped and the temp DBs/backups were removed.

## 3. Frontend

### Career analysis MVP

- `npm test` includes structured score validation, rubric weight validation, and coverage-aware fit calculation.
- Manual/API smoke should use temporary auth and admission paths. Verify `/api/career/scores` rejects invalid scores, `/api/career/overview` returns `coveragePct` and leaves missing subjects as `null`, and admin rubric writes reject weight totals other than 1 with `400`.
- The user page is `/phan-tich-nang-luc`; the admin rubric page is `/admin_career`. Do not use the real auth DB for test accounts or rubric fixtures.

```bash
cd frontend
npm install
npm run build
```

Expected on the current working tree:

```text
2,661 modules transformed
dist/assets/index-*.css        32.73 kB | gzip   6.22 kB
dist/assets/AdminPage-*.js     61.79 kB | gzip  16.22 kB
dist/assets/index-*.js      1,016.01 kB | gzip 306.89 kB
built in ~5 s
```

Vite may still warn that the main JS chunk is > 500 kB. That warning is KI-11, not a build failure. `/admin` must stay in its own lazy chunk; if `AdminPage` is merged into the main chunk, the admin route was imported eagerly.

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
- [ ] Career analysis: profile summary and link to profile display; adding/removing scores and saving persists after reload.
- [ ] Career analysis: selecting an existing term/year snapshot loads rubric fit; missing subjects stay “Chưa có điểm” and coverage is disclosed.
- [ ] Career analysis: search filters and pagination update results/count; admission methods are ordered/grouped without implying scores from different scales are comparable.
- [ ] Career analysis: pin/target limits and removal work; admin rubric create/edit/delete and invalid weight validation work.
- [ ] Intro video: autoplay with sound, muted fallback, skip, and unmute controls work.

### Admin UI checklist

`/admin` is hidden: there is no public link, and `robots.txt` disallows it. Use a temp auth DB with an admin created by the CLI.

- [ ] `/admin` shows the admin login, not the user login; a normal user session does not grant access.
- [ ] Wrong admin credentials show a generic error; five failures trigger the rate limit.
- [ ] Successful login shows the shell/nav; reload keeps the session via `/api/admin/auth/me`.
- [ ] Direct navigation to `/admin/users`, `/admin/data`, and `/admin/audit` works after login and redirects to the admin login after logout.
- [ ] Overview shows table/user counts, DB integrity, backup list, and write state.
- [ ] Users: search/filter, create (temporary password shown once), bulk create with skipped rows, edit username, lock/unlock, reset password, soft delete/restore.
- [ ] Data: table picker, search/sort/pagination, create/edit/delete, dependency warning for `truong`, force delete after explicit confirmation.
- [ ] Audit: filters work; no password/token/cookie/raw IP is displayed.
- [ ] A user `401` does not redirect the admin area to `/dang-nhap`; an admin `401` clears the admin UI only.
- [ ] The page sets `noindex,nofollow` and is not present in the public navigation.
- [ ] The browser console has no errors during admin login/CRUD/logout.

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

### Auth and data baseline

- [x] `db.js` has no schema creation; missing DB produces a clear error.
- [x] Auth DB is separate from the admission DB, ignored by git, and uses `user_version = 2`.
- [x] v1 → v2 migration preserves users/sessions, creates a backup first, and is tested in a temp DB.
- [x] Register/login/logout/`me`/change-password work; duplicate/mismatched/weak inputs return the documented status codes.
- [x] Locked and soft-deleted users are rejected; forced password change blocks data APIs until completed.
- [x] Guest pages redirect to login; authenticated sessions survive reload and backend restart.
- [x] Data APIs return 401 without a session and 200 with one.
- [x] User cookie is HttpOnly/SameSite=Lax/Path=/ with a 7-day TTL and Secure in production.
- [x] Login errors are generic; login/register rate limits return 429 with `Retry-After`.
- [x] Auth POSTs reject untrusted origins; CORS uses an explicit allowlist with credentials.
- [x] Admission DB hash is unchanged after auth tests.
- [x] Frontend build passes (2,661 modules) with a separate lazy `AdminPage` chunk.
- [x] `de-an` returns the real `total`.
- [x] Invalid pagination returns 400 on `de-an` and `diem-chuan`.
- [x] `so_nganh` is case-insensitive distinct; BKA A00 = 82, HVN A00 = 22.
- [x] Main pages show errors instead of empty catches.
- [x] No `Button asChild` usage remains.
- [x] Benchmark scores page no longer exposes `nhom_nganh`.
- [x] TOC uses `rehype-slug` + `github-slugger`.
- [x] Temp import produces 281 blocks and preserves 12 zero score cells.

### Admin panel

- [x] Admin auth is separate from user auth: own table, cookie, session policy, CSRF token, and audit log.
- [x] Admin login rate limit (5/IP+username, 20/IP per 15 min), strict cookie, 8 h absolute, 30 min idle, max 3 sessions.
- [x] Disabled admins are rejected; CSRF and untrusted origins are rejected on writes.
- [x] CLI creates/resets/disables/enables/lists admins; there is no public admin registration.
- [x] User list/search/filter, detail, create, bulk create, edit username, lock/unlock, restore, reset password, soft delete.
- [x] Admission CRUD on all five tables with metadata validation, unique checks, dependency checks, force delete.
- [x] Admission writes: backup, transaction, `quick_check`, atomic save, reload, write-block on failure.
- [x] Audit covers admin login/logout and all user/data mutations; secrets stripped; IP hashed; 180-day retention.
- [x] `/admin` is lazy-loaded, noindex, not linked publicly; `robots.txt` disallows it.
- [x] Backend suite 78/78 pass; admin E2E smoke 19 checks pass on temp DBs; frontend build passes.
- [x] Real admission DB unchanged by tests/smoke (`8D4F42B1F845C2E12DE875D2BBFDCBF0DF3CC7686DC285423189C80CF3559E4D`).
- [ ] Admin MFA/TOTP (deferred to optional Phase 6).
- [ ] Real auth DB has 0 admins until the operator runs `npm run admin:create -- --username <name>`.

### Data decisions still pending

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
