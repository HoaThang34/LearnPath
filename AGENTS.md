# AGENTS.md — LearnPath

> Applies to every AI/agent working in this repository (OpenCode, Claude, Cursor, Codex, subagents, ...).
> Goal: understand the project quickly, make changes at every required layer, and never break source code or data.

## Read before changing anything

Read these in order. You do **not** need to read the whole repository first.

1. `.agents/README.md` — documentation map, file map, quick facts.
2. `.agents/AI_RULES.md` — mandatory workflow and hard rules.
3. `.agents/PROJECT_CONTEXT.md` — domain, data, runtime, limits.
4. `.agents/ARCHITECTURE.md` — API, DB schema, data flow.
5. The files and folders that are actually relevant to the task (use the file map).

For bugs or data work, also read `.agents/KNOWN_ISSUES.md`.
For feature work, also read `.agents/PLAYBOOKS.md`.
Before reporting completion, read `.agents/TESTING.md`.

## 10 hard rules

1. **Do not commit, push, or open a PR** unless the user explicitly asks.
2. **Do not run `npm run db:init`**, delete/overwrite `backend/database/learnpath.db`, or edit a `.db` file by hand unless the user explicitly asks and a backup exists.
3. **Stay in scope**: do not refactor, reformat, rename, or delete files “while you are there”.
4. **A change must cover every layer**: DB/init → API route → API client → UI → docs → verification. Do not patch only one end.
5. **Do not change API contracts, schema, or data (L3)** without user agreement and a rollback plan.
6. **Never hide errors** with `catch (e) {}` or fake data. Add a clear error state and log.
7. **Do not hardcode data values in the UI**; load them from the API/DB. Exception: existing marketing copy.
8. **Keep Vietnamese for the UI**, user-facing messages, and business labels. Use English for code, identifiers, and commit messages.
9. **Every completion report needs evidence**: changed files, commands run, actual results, remaining risks.
10. **Out-of-scope bug found?** Record it in `.agents/KNOWN_ISSUES.md`; do not fix it silently.

## Quick facts

- Frontend: React 18 + Vite 5 + Tailwind 3 + local shadcn-style components; runs at `http://localhost:5173`.
- Backend: Express 4 + `sql.js` (SQLite WASM); runs at `http://localhost:3001`.
- Admission DB: `backend/database/learnpath.db` (~109 MiB), **not committed**. `npm run db:init` rebuilds it.
- Auth DB: `backend/database/auth.db` (separate, small, auto-created, **not committed**, schema v7). It holds users, sessions, admins, audit, profiles, structured academic scores (môn/kỳ/lớp/TB môn/điểm), career selections, admin-managed career rubrics, survey questions, the 7 interest tables, `career_match_config`, and per-combination self-reported exam scores (`user_exam_scores`). Override with `LEARNPATH_AUTH_DB_PATH`; never point it at `learnpath.db`.
- Authentication & User Profile: username/password with scrypt hashes and server-side sessions. `/api/auth/*` and `/api/health` are public; all admission data APIs, user profile (`/api/auth/profile`), and the protected feature pages require login. Locked/deleted users are rejected, and accounts with a temporary password must change it before using data APIs.
- Admin area: hidden `/admin` with a **separate** admin login, cookie, CSRF token, and audit log. Admin APIs live under `/api/admin/*`; there is no public link. Bootstrap the first admin with `cd backend && npm run admin:create -- --username <name>`.
- Admin admission management: Quản trị viên có toàn quyền:
  1. **Chỉnh sửa đề án tuyển sinh** (`de_an_tuyen_sinh`: mã trường, tên trường, nội dung Markdown với tab xem trước, nguồn).
  2. **Chỉnh sửa điểm chuẩn** (`diem_chuan`: mã trường, tên trường, ngành, tổ hợp môn, điểm chuẩn, ghi chú, năm, phương thức với gợi ý chuẩn hóa).
  3. **Thêm dữ liệu mới (thêm thủ công)** vào bất kỳ bảng nào trong 5 bảng tuyển sinh (`khoi_thi`, `truong`, `diem_chuan`, `diem_thi_thptqg`, `de_an_tuyen_sinh`).
  Mọi thao tác ghi dữ liệu tuyển sinh đều đi qua engine tuần tự hóa `admissionWrite.js` (giao dịch, `quick_check`, backup tự động, ghi atomic và reload RAM).
- Admin career config: tab **“Trọng số 12 khối”** trong `/admin_career` sửa trực tiếp trọng số L/H/M của 12 khối (mỗi khối phải dương và tổng = 1 ± 0.002), mức ưu tiên môn r ∈ {1,2,3,4} của từng dòng, và cấu hình hồ sơ đối chiếu 4 trục MBTI (chỉ số $M_m$ và $F_m$). API: `GET/PUT /api/admin/career/group-config/groups`, `GET/PUT .../priorities`, `GET/PUT .../mbti`. Ghi qua `backend/src/career/configStore.js`: validate → backup JSON → ghi atomic → xóa cache; mọi thay đổi có audit log. JSON vẫn là nguồn dữ liệu, không đổi schema auth DB. `derive-career-weights.js --write` từ chối ghi đè tệp đã có `updatedAt` trừ khi thêm `--force`.
- Current admission DB counts: **245 blocks**, 260 schools, 2,617 score rows, 307 proposals, 1,131,975 candidates.
- The importer now parses **281 blocks** from the source files. The live DB still has 245 until a rebuild is approved.
- API uses the relative `/api` path; Vite proxies it to the backend. Production needs a reverse proxy, HTTPS, `APP_ORIGIN`, and SPA fallback.
- UI has 10 protected feature pages, including `/phan-tich-nang-luc` and the 3 interest pages (`/kham-pha-so-thich`, `/kham-pha-so-thich/lam-bai`, `/kham-pha-so-thich/ket-qua`), plus public auth pages and the hidden `/admin` area.
- Interest module: 108 items (60 RIASEC × thang 1–5; 48 bipolar × thang −2…+2) seeded from `backend/src/data/interest_instrument_v1.json`; scoring is a pure module in `backend/src/interest/scoring.js`. The pair contract stores `leftKey`/`rightKey` per item (odd items put the first letter on the left; even items on the right). `D = Σ(even) − Σ(odd)`; missing answers are **not** zero. Admin imports/edits the instrument in `/admin_survey` (tabs “Bộ câu hỏi sở thích”, “Thống kê sở thích”), not a separate admin route.
- Career match layer: `backend/src/career/match.js` computes `pBench`, `percentile`, `tinhCachFit`, `hocLucFit` (percentile), `tongHopFit` and the 3×2 matrix. Three ratios are separate (`hocLucFit`, `tinhCachFit`, `tongHopFit`); a null component makes `tongHopFit` null with a reason. Never label any ratio as “% đỗ” or an admission probability. Weights/config live in `interest_group_weights` and `career_match_config`; admin edits them in `/admin_career`.
- M-0 data normalization: `backend/src/data/edumind_rubrics.json` was fixed for L2/L3/L5 (143 valid rubrics, 2 excluded with `isValid=false`). See `RUBRIC_CHANGELOG.md`. Re-seed an existing auth DB only with `node backend/scripts/reseed-rubrics.js --apply` (dry-run by default, backup first).
- Main schema/import source of truth: `backend/src/database/init.js`. `db.js` is the runtime loader only; it refuses to start when the main DB is missing (see KI-01). Auth schema is in `backend/src/auth/authDb.js`; admin data writes go through `backend/src/admin/admissionWrite.js`.

## Minimum verification

```bash
# Backend
cd backend
npm install
npm test                    # 212 tests: unit + integration on temp DBs
npm run dev                 # http://localhost:3001

# Rubric / interest tooling (read-only unless --apply/--write)
node scripts/audit-rubrics.js
node scripts/reseed-rubrics.js            # dry-run by default
node scripts/normalize-rubrics.js         # dry-run by default

# Frontend
cd frontend
npm install
npm test                    # 7 tests: bipolar sign rule (B1–B7)
npm run build               # must pass
npm run dev                 # http://localhost:5173
```

```powershell
# API smoke (PowerShell). Data APIs return 401 without a session.
$base = 'http://localhost:3001'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$user = "smoke_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$body = @{ username = $user; password = 'MatKhau123'; passwordConfirm = 'MatKhau123' } | ConvertTo-Json

Invoke-RestMethod "$base/api/health"
Invoke-RestMethod "$base/api/auth/register" -Method Post -Body $body -ContentType 'application/json' -WebSession $session
Invoke-RestMethod "$base/api/auth/me" -WebSession $session
Invoke-RestMethod "$base/api/de-an?limit=2" -WebSession $session
Invoke-RestMethod "$base/api/auth/logout" -Method Post -WebSession $session
```

For isolated auth tests, set `LEARNPATH_AUTH_DB_PATH` to a temporary file before starting the backend. Do not point it at `learnpath.db`; the server rejects that path.

For isolated career-config write tests, point `LEARNPATH_GROUP_WEIGHTS_PATH`, `LEARNPATH_SUBJECT_PRIORITIES_PATH`, and `LEARNPATH_CONFIG_BACKUP_DIR` at temporary paths before starting the backend. Never run write tests against `backend/src/data/career_*.json`.

```bash
# One-time admin bootstrap (writes auth.db). For tests, point LEARNPATH_AUTH_DB_PATH at a temp file first.
cd backend
npm run admin:create -- --username <name>
npm run admin:create -- --list
```

Admin smoke requires the admin cookie plus the `X-Admin-CSRF` header returned by `/api/admin/auth/login`. The admin panel is at `/admin`; it is not linked from the public UI.

```bash
# Read-only DB inspection (does not modify the DB)
node .agents/scripts/inspect-db.js
```

For an isolated import test, point `LEARNPATH_DB_PATH` at a temporary file before running `backend/src/database/init.js`. Do not use the real DB for experiments.

## Ask the user first

- Changing schema, rebuilding/importing the whole DB, deleting data, changing the year or the meaning of a score.
- Changing API response/query contracts, authentication/session behavior, rate limits, the auth DB schema, admin session/CSRF policy, or audit retention.
- Changing the admission write engine, backup policy, or force-delete semantics.
- Adding a dependency, changing the build tool, or changing the folder structure.
- Ambiguous business rules (for example: which subject combination, which score scale, how ranking is defined).
- A failing baseline (build/API) whose cause is outside the task scope.

## Detailed documentation

| File | Contents |
|---|---|
| `.agents/README.md` | Entry point, file map, verification status |
| `.agents/AI_RULES.md` | Rules, 8-step workflow, subagent protocol, checklist |
| `.agents/PROJECT_CONTEXT.md` | Domain, data, runtime, limits, quick facts |
| `.agents/ARCHITECTURE.md` | Diagram, API reference, DB schema, data flow |
| `.agents/PLAYBOOKS.md` | Recipes for each type of upgrade |
| `.agents/KNOWN_ISSUES.md` | Verified bugs/risks and remediation direction |
| `.agents/TESTING.md` | Test commands, smoke matrix, acceptance criteria |
| `.agents/PROJECT_STATUS.md` | Current status and session history |
