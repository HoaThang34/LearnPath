# .agents — LearnPath project memory

Purpose: help the next agent/session understand LearnPath **in a few minutes**, find the right files, and make changes through every required layer without reading the whole repository.

> Read `../AGENTS.md` first, then this file. You do not need every document for every task; use the routing table below.

## Choose documents by task

| Task | Read at minimum |
|---|---|
| UI text, style, component | `PROJECT_CONTEXT.md` → `ARCHITECTURE.md` (Frontend) → the page/component |
| Add/change a filter, API, or query | `ARCHITECTURE.md` (API + DB) → `PLAYBOOKS.md` sections 1–3 → the route/page |
| Auth, session, or security change | `ARCHITECTURE.md` (Auth + Admin) → `plans/user-auth.md` / `plans/admin-panel.md` → `TESTING.md` (auth/admin) |
| Admin panel change | `plans/admin-panel.md` → `ARCHITECTURE.md` (Admin) → `TESTING.md` (admin smoke) |
| Data, import, school mapping | `PROJECT_CONTEXT.md` (Data) → `KNOWN_ISSUES.md` → `PLAYBOOKS.md` sections 5–6 |
| Schema/DB change | `ARCHITECTURE.md` (DB) → `PLAYBOOKS.md` section 4 → `TESTING.md` |
| Bug investigation | `KNOWN_ISSUES.md` → relevant files → `TESTING.md` |
| Subagent work | `AI_RULES.md` (workflow + subagent protocol) |
| Handoff | `PROJECT_STATUS.md` → `AI_RULES.md` (handoff) |

## 30-second overview

- **Product**: LearnPath, a career/education guidance website for Vietnamese high-school students and parents.
- **Scope**: admission data is read-only for users and editable by admins through a hidden `/admin` area (sửa đề án tuyển sinh, sửa điểm chuẩn, thêm dữ liệu mới thủ công); home and auth pages are public.
- **Frontend**: React 18 + Vite 5 + Tailwind 3; 4 protected feature pages plus home, login, register, change password, and a lazy admin area.
- **Backend**: Express 4 + `sql.js`; the admission DB is loaded into RAM and admin writes go through a guarded engine; auth uses a separate small writable auth DB (schema v2).
- **Data**: 307 proposal Markdown files; 2,617 score rows; 1,131,975 candidates; 260 schools; 245 blocks in the current DB.
- **Current risk area**: admin/auth operational limits, the unexpected real auth DB migration, data mapping/coverage, and ranking semantics. See `KNOWN_ISSUES.md`.

## Verified facts (2026-10-23)

| Item | Result | Evidence |
|---|---|---|
| Frontend build | Pass | `npm run build`: 2,661 modules; `AdminPage` 65.53 kB (gzip 17.21 kB); main JS 1,016.03 kB (gzip 306.91 kB); CSS 33.50 kB (gzip 6.31 kB); Vite still warns about the main chunk > 500 kB |
| Backend start | Pass | `Database connected`; `Auth database ready`; `Server running on http://localhost:3001` |
| `/api/health` | 200 public | `{ status: "ok" }` |
| Data APIs without a session | 401 | `/api/de-an`, `/api/diem-chuan`, `/api/khoi-thi`, `/api/diem-thi` |
| `/api/auth/register` + `/api/auth/me` | Pass | Register sets `lp_session`; `/me` returns the user without the password hash |
| Forced password change | Pass | Admin-created/reset accounts get `403 PASSWORD_CHANGE_REQUIRED` until `/doi-mat-khau` succeeds |
| `/api/auth/logout` | Pass | Clears cookie and invalidates the old session |
| Session persistence | Pass | Session survives a backend restart and a browser reload |
| Auth rate limits | Pass | Login and registration return 429 with `Retry-After` |
| User cookie | Pass | `httpOnly`, `sameSite=lax`, `secure`, `path=/`, `maxAge=604800000` in production |
| Admin auth | Pass | Separate cookie (`sameSite=strict`), 8 h absolute, 30 min idle, max 3 sessions, `X-Admin-CSRF` |
| Admin user CRUD | Pass | Create/bulk/edit/lock/unlock/restore/reset/soft delete on temp auth DB |
| Admin data CRUD | Pass | Five tables on temp admission DB; backup, transaction, `quick_check`, atomic reload |
| Admin audit | Pass | Login/user/data actions; secrets stripped; IP hashed; 180-day retention |
| Auth DB path guard | Pass | Same path as the admission DB, including a different letter case on Windows, aborts startup |
| `/api/de-an?limit=2` | 200 authenticated | `total=307`, `data.length=2` |
| `/api/de-an?search=Hà Nội` | 200 authenticated | `total=35` |
| `/api/de-an` invalid pagination | 400 authenticated | `limit=abc`, `limit=0`, `offset=-1`, `limit=1001` all return 400 |
| `/api/diem-chuan?limit=2` | 200 authenticated | `total=2617` |
| `/api/diem-chuan` invalid pagination | 400 authenticated | `limit=abc`, `offset=-1` |
| `/api/khoi-thi/A00` | 200 authenticated | `so_truong=232`; 25 joined schools; BKA `so_nganh=82`; HVN `so_nganh=22` |
| `/api/diem-thi/ranking?toan=8&van=8&ly=8` | 200 authenticated | rank 420,859 of 1,131,975; 7 distribution bins |
| Current DB | Loaded | 245 blocks, 260 schools, 2,617 score rows, 307 proposals, 1,131,975 candidates |
| Import source parser | Pass in temp DB | 260 block files → 281 unique codes; 1 file skipped; 12 zero score cells preserved; 5 all-null candidate rows |
| Browser E2E | Pass (temporary scripts) | 16 auth/route/UI checks; 19 admin checks on temp DBs |
| Unit/integration tests | Pass 81/81 | Committed `node:test` suite (bổ sung test sửa đề án, sửa điểm chuẩn, thêm thủ công); temp auth/admission DBs; real DBs untouched |
| CI | Workflow added | `.github/workflows/ci.yml`: backend tests, frontend build, non-blocking audit; not run on GitHub until push |
| Admission DB integrity | Pass | SHA-256 unchanged after API/UI/admin tests (`8D4F42B1F845C2E12DE875D2BBFDCBF0DF3CC7686DC285423189C80CF3559E4D`) |
| Real auth DB | Migrated v1→v2 | 69,632 bytes, 1 user, 0 sessions, 0 admins; v1 backup `auth.db.v1-backup-20261023141514808`; cause not established (KI-24) |

Important: the 281-block result is from a **temporary** database. The live DB still has 245 blocks until the user approves a rebuild and a backup is made.

## File map

| Path | What it is |
|---|---|
| `AGENTS.md` | Entry point and hard rules |
| `.agents/README.md` | This file |
| `.agents/AI_RULES.md` | Workflow, severity levels, subagent rules, checklists |
| `.agents/PROJECT_CONTEXT.md` | Product, users, data sources, runtime limits |
| `.agents/ARCHITECTURE.md` | System diagram, API reference, schema, data flow |
| `.agents/PLAYBOOKS.md` | Step-by-step recipes for common upgrades |
| `.agents/KNOWN_ISSUES.md` | Verified issues, status, evidence, remediation |
| `.agents/TESTING.md` | Commands, smoke matrix, acceptance criteria |
| `.agents/PROJECT_STATUS.md` | Current status and session history |
| `.agents/scripts/inspect-db.js` | Read-only admission DB audit; never writes |
| `plans/user-auth.md` | Reviewed auth plan, threat notes, and test matrix |
| `plans/auth-hardening.md` | Future auth phases; Phase 2 schema must be v3 because v2 is taken by the admin panel |
| `plans/admin-panel.md` | Approved admin panel plan, decisions, APIs, phases, tests, rollback |
| `backend/server.js` | Express startup, admin/auth mounts, protected routes, CORS/security middleware |
| `backend/scripts/admin-create.js` | CLI to create/reset/disable/enable/list admins |
| `backend/src/auth/` | `authDb`, `password`, `session`, `adminAuth`, `adminSession`, `adminAudit`, `rateLimit`, `origin`, `validation` |
| `backend/src/admin/` | `dataSchema`, `dataValidation`, `admissionWrite`, `userAdmin`, `routeUtils`, `errors` |
| `backend/src/database/db.js` | Runtime admission DB loader; no schema creation; exports `DB_PATH`/`reloadDb` |
| `backend/src/database/init.js` | Admission schema source of truth and importer |
| `backend/src/routes/` | `auth`, `admin`, `adminAuth`, `adminUsers`, `adminData`, `adminOverview`, `adminAudit`, `deAn`, `diemChuan`, `khoiThi`, `diemThi`, `queryParams` |
| `frontend/src/context/AuthContext.jsx` | Auth state, login/register/logout/changePassword, 401 handling |
| `frontend/src/components/ProtectedRoute.jsx` | Redirects guests to `/dang-nhap` and preserves the target |
| `frontend/src/pages/AuthPage.jsx` | Login/register form and confirmation validation |
| `frontend/src/pages/ChangePasswordPage.jsx` | Change-password form; used for forced change |
| `frontend/src/pages/AdminPage.jsx` | Lazy admin area: login, shell/nav, overview, users, data, audit |
| `frontend/src/components/admin/` | Admin UI components |
| `frontend/src/lib/api.js` | Axios client with credentials and auth methods |
| `frontend/src/lib/adminApi.js` | Admin API client with cookie/CSRF handling |
| `frontend/public/robots.txt` | Disallows `/admin` and `/api/` |
| `data/de_an_tuyen_sinh/` | 307 school proposal Markdown files |
| `data/diem_chuan/` | Score JSON files |
| `data/diem_thptqg_2026/` | Candidate CSV |
| `data/khoi_thi/theo_khoi_thi/` | 260 block files |
| `data/khoi_thi/theo_truong/` | 260 school files |

## Status vocabulary

- **Fixed** — code/data was changed and verified.
- **Mitigated** — the harmful symptom is removed or clearly disclosed, but the root cause remains.
- **Open** — verified and still present.
- **Deferred** — needs a product/data decision or a rebuild.

Do not mark something Fixed because the code “looks right”. Use the evidence section of `KNOWN_ISSUES.md` and repeat the check.

## Documentation rules

- Agent documentation is in English. UI text, business labels, and data values remain Vietnamese.
- Keep current live-DB numbers separate from numbers produced by the import code in a temporary DB.
- Do not copy old counts from a previous session without re-checking them.
- Every claim about a bug should name the command/query and the observed result.
- Do not run destructive commands just to make the docs consistent.

## Safety

- Never run `npm run db:init` on the real admission DB without explicit user approval and a backup.
- For import experiments, use `LEARNPATH_DB_PATH` with a temporary file.
- Admin CRUD creates backups in `backend/database/backups/` (max 5), but they are local only; take an external backup before risky edits.
- Treat `backend/database/auth.db` as real user data: back it up before deleting/replacing it, and never point `LEARNPATH_AUTH_DB_PATH` at `learnpath.db`.
- Use a temporary auth DB for automated auth/admin tests and for `npm run admin:create` experiments; do not create test accounts/admins in a real auth DB.
- The real auth DB currently has 0 admins (KI-24); create the first admin only when the user asks.
- Do not commit or push unless the user asks. Both `.db` files are ignored.
- Stop any background server you started before finishing a session.
