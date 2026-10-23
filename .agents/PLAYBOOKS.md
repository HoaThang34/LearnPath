# PLAYBOOKS — Safe upgrade recipes

> Each playbook is a short checklist. Read `AI_RULES.md` sections 0–2 first.
> Run the relevant checks in `TESTING.md` before declaring completion.

## 1. Add or change a filter on the Benchmark scores page

Example: add a real `nam` filter, or re-enable `nhom_nganh` only after implementing it.

### Backend

1. Decide semantics: exact match or `LIKE`? Does it combine with other filters?
2. In `backend/src/routes/diemChuan.js`, read the new param from `req.query`.
3. Add the condition to the **data** SQL and push its parameter.
4. Add the same condition to `countSql` and `countParams`. Forgetting this makes `total` wrong.
5. Validate numeric/enum values before binding.
6. Keep `sort` on the existing whitelist.

### API client

`getDiemChuan(params)` already forwards arbitrary params, so no client change is needed for a simple filter. Add a new function only for a new endpoint.

### UI

1. Add the state in `frontend/src/pages/DiemChuan.jsx`.
2. Add the control.
3. Add the value to the effect dependency list (or trigger a search explicitly).
4. Reset `page` to 1 when the filter changes.
5. Keep the request-id guard so a late response cannot overwrite a newer one.
6. Show loading, empty, and error states.
7. Test that the result count changes and that clearing the filter restores the full list.

### Verify

Authenticate first (see `TESTING.md` 2.4), then pass `-WebSession $session`:

```powershell
Invoke-RestMethod "http://localhost:3001/api/diem-chuan?limit=2" -WebSession $session
Invoke-RestMethod "http://localhost:3001/api/diem-chuan?limit=2&<newParam>=<value>" -WebSession $session
```

Check `total`, page size, and the actual filtered rows. Confirm the same request without a session returns 401. Build the frontend.

## 2. Add a new API endpoint

1. Add the route in the relevant file under `backend/src/routes/`.
2. Mount it in `backend/server.js` only if it belongs to a new router. Admission data routes must stay behind `requireAuth`; only health/auth routes are public.
3. Use `getDb()` and the `queryAll`/`queryOne` helpers. Never write the admission DB at runtime.
4. Validate input. Use `queryParams.js` for pagination.
5. Return `{ data: ... }` and `{ data: ..., total }` consistently.
6. Return 400 for invalid input, 401 for missing sessions, 404 for missing resources, 500 only for unexpected failures.
7. Add the client function in `frontend/src/lib/api.js`; keep `withCredentials: true`.
8. Add loading/error/empty UI.
9. Document the endpoint in `ARCHITECTURE.md`.
10. Smoke-test unauthenticated 401, authenticated success, and failure paths.

## 3. Fix pagination or `total`

Use the shared helper:

```js
const { parsePagination } = require('./queryParams');

const pagination = parsePagination(req.query, { defaultLimit: 100 });
if (pagination.error) {
  return res.status(400).json({ error: pagination.error });
}
```

Then:

- Bind `pagination.limit` and `pagination.offset` to the data query.
- Run a separate `COUNT(*)` query with the same `WHERE` clauses and parameters.
- Return the real `total`, not `results.length`.
- Test `limit=abc`, `limit=0`, `offset=-1`, and `limit=1001`.

## 4. Change schema or import behaviour

This is **L3**. Ask the user, make a backup, and plan rollback first.

1. Update `backend/src/database/init.js` (the only schema source of truth).
2. Do not add schema creation to `db.js`.
3. If the runtime needs a new column, update every `SELECT`/`INSERT` that depends on it.
4. For CSV, use `csv-parse/sync` with `bom: true`, `columns: true`, `skip_empty_lines: true`, and `trim: true`.
5. Use a `toNumber()` helper that preserves `0` and returns `null` only for non-numeric/blank values.
6. For block files, parse the header content and support comma-separated codes; do not filter by filename.
7. Log skipped files and per-file errors; never use an empty `catch`.
8. Test with an isolated DB:

```powershell
$env:LEARNPATH_DB_PATH = Join-Path $env:TEMP "learnpath-test.db"
node backend/src/database/init.js
node .agents/scripts/inspect-db.js --db $env:LEARNPATH_DB_PATH
Remove-Item Env:\LEARNPATH_DB_PATH
```

9. Only rebuild the real DB after approval and a backup.

## 5. Fix a wrong school mapping

Known wrong mappings (KI-03a):

| Source name | Current code | Correct code |
|---|---|---|
| Học viện Hành chính Quốc gia | `HCP` | `HCH` |
| ĐH Mỹ thuật Công nghiệp | `MTU` | `MTC` |
| Nhạc viện Hà Nội | `NHB` | `NVH` |
| ĐH Sân khấu - Điện ảnh Hà Nội | `SKH` | `SKD` |
| ĐH Kinh tế TP.HCM | `UEF` | `KSA` |

Plan:

1. Update the abbreviation table in `buildSchoolMap()`.
2. Ensure the target codes exist in `truong`. `HCH` exists; `KSA`, `MTC`, `NVH`, and `SKD` need source school rows or another approved source.
3. Add `DNV` and `FPT` to `truong` so their score rows can join.
4. Rebuild in a temporary DB and verify:
   - `HCP`, `MTU`, `NHB`, `SKH`, `UEF` no longer own the wrong score rows.
   - The target codes own the expected rows.
   - `DNV` and `FPT` join.
5. Do not update the real DB without approval and a backup.

Do not simply change the abbreviation table while the target codes are absent: the score rows will become orphaned instead of joining.

## 6. Rebuild the real DB safely (only with approval)

1. Confirm the user approved the rebuild.
2. Stop the backend so it releases the file.
3. Back up the current DB outside the repo:

```powershell
Copy-Item backend\database\learnpath.db "$env:TEMP\learnpath-backup-$(Get-Date -Format yyyyMMdd-HHmmss).db"
```

4. Run `npm run db:init` from `backend/`.
5. Start the backend and verify health, counts, mapping, and a few known rows.
6. Run `node .agents/scripts/inspect-db.js`.
7. If anything is wrong, stop the server and restore the backup.
8. Update the live-count facts in `AGENTS.md`, `.agents/README.md`, `PROJECT_CONTEXT.md`, `README.md`, and `PROJECT_STATUS.md`.

`db:init` only touches the admission DB. The auth DB (`auth.db`) is separate: do not delete or replace it during a data rebuild, and keep a backup if user accounts must survive.

## 7. Add or improve a UI error state

1. Add an `error` state (string) to the page.
2. Clear it at the start of the request.
3. In `catch`, log the error and set a user-facing Vietnamese message.
4. Render an alert near the relevant section.
5. If the page has a retry action, keep the last input so retry is possible.
6. Do not clear previously valid data unless showing stale data would mislead.
7. Build and test the failure path by stopping the backend or pointing the client at an invalid endpoint.

## 8. Investigate a data problem

1. Reproduce the number with a read-only script.
2. Separate live DB values from importer output.
3. Check source files and mapping before blaming the UI.
4. Write the evidence into `KNOWN_ISSUES.md`.
5. If the fix requires data changes, stop and ask for approval.

## 9. Change auth/session behaviour

Auth changes are security-sensitive and touch multiple layers. Ask before changing contracts, cookie names/flags, rate limits, or the auth DB schema.

1. Re-read `plans/user-auth.md`, `plans/auth-hardening.md`, `ARCHITECTURE.md` (Auth), and `TESTING.md` 2.4/2.7.
2. Keep the auth DB separate from `learnpath.db`; never add users/sessions to the admission schema.
3. If the schema changes, bump `SCHEMA_VERSION` in `backend/src/auth/authDb.js` and add a migration path. Do not silently recreate an existing DB with accounts.
4. Password changes must keep scrypt parameters and per-user salt. Do not log passwords, hashes, cookies, or raw tokens.
5. Session changes must keep only token hashes in the DB and the cookie HttpOnly/SameSite=Lax; `Secure` in production.
6. Preserve generic login errors and dummy scrypt for unknown users. Document any enumeration tradeoff (currently registration returns 409).
7. Protect any new admission data route with `requireAuth` in `server.js`.
8. Frontend: use `AuthContext` and `ProtectedRoute`; never store the token in localStorage/sessionStorage.
9. Test with a temporary auth DB: register/login/logout/me, 401s, duplicate/mismatch, cookie flags, rate limits, untrusted origin, session persistence, and main DB hash unchanged.
10. Test production cookie flags with `NODE_ENV=production`, and document required `APP_ORIGIN`/HTTPS setup.
11. Update `ARCHITECTURE.md`, `TESTING.md`, `PROJECT_CONTEXT.md`, `KNOWN_ISSUES.md`, `README.md`, and `PROJECT_STATUS.md`.

## 10. Change admin panel behaviour

Admin changes are L3 when they touch auth/session/CSRF, the auth DB schema, the admission write engine, backup policy, force-delete semantics, or audit retention. Ask first.

1. Re-read `plans/admin-panel.md`, `ARCHITECTURE.md` (Admin), and `TESTING.md` 2.7.
2. Keep admins separate from users: `admins`/`admin_sessions`, own cookie, own CSRF header. Never let a user session call `/api/admin/*`.
3. Any non-GET admin route must keep `requireAdminCsrf` and the trusted-origin check. Do not add a mutation endpoint that bypasses them.
4. Auth DB schema changes must bump `SCHEMA_VERSION` and add a v2→v3 migration path; v2 is already in use.
5. Admission writes must go through `admissionWrite.js`. Do not call `saveDb()` directly from a route or add a second write path.
6. Preserve the backup/`quick_check`/reload/write-block behavior. Do not weaken force-delete confirmation or dependency checks.
7. Audit every user/data mutation and login/logout. Never put passwords, hashes, tokens, CSRF values, cookies, authorization headers, or raw IPs in `admin_audit`.
8. Keep `/admin` lazy-loaded, noindex, and unlinked from public navigation.
9. Test with temp auth and admission DBs: admin login/CSRF, user CRUD, data CRUD, dependency/force delete, audit redaction, logout, and real DB hash unchanged.
10. Run `cd backend && npm test` and `cd frontend && npm run build`; update `README.md`, `ARCHITECTURE.md`, `TESTING.md`, `PROJECT_STATUS.md`, and `KNOWN_ISSUES.md`.

## 11. Chỉnh sửa đề án, điểm chuẩn và thêm dữ liệu mới thủ công

1. **Truy cập**: Đăng nhập trang quản trị ẩn tại `/admin`, vào tab **Dữ liệu** (hoặc nhấn trực tiếp vào thẻ số lượng của bảng tương ứng trên trang **Tổng quan**).
2. **Chỉnh sửa đề án tuyển sinh (`de_an_tuyen_sinh`)**:
   - Chọn bảng `Đề án tuyển sinh`, tìm kiếm theo mã trường hoặc tên trường.
   - Nhấn **Sửa** tại dòng cần cập nhật.
   - Form hỗ trợ chỉnh sửa `ma_truong`, `ten_truong`, `nguon`, và `noi_dung` (hỗ trợ chuyển đổi giữa tab **Soạn thảo** và tab **Xem trước Markdown** trực tiếp).
   - Nhấn **Lưu thay đổi**; hệ thống sao lưu tự động và kiểm tra tính toàn vẹn trước khi cập nhật.
3. **Chỉnh sửa điểm chuẩn (`diem_chuan`)**:
   - Chọn bảng `Điểm chuẩn`, tìm kiếm theo mã trường, ngành, phương thức hoặc tổ hợp môn.
   - Nhấn **Sửa** tại dòng cần cập nhật.
   - Form cung cấp danh sách gợi ý cho `phuong_thuc` (`THPT`, `HSA`, `TSA`, `V-ACT`, `SAT`), gợi ý năm tuyển sinh, kiểm tra kiểu số thực của điểm chuẩn.
   - Nhấn **Lưu thay đổi**.
4. **Thêm dữ liệu mới (thêm thủ công)**:
   - Chọn bảng cần thêm (ví dụ `Đề án tuyển sinh` hoặc `Điểm chuẩn`).
   - Nhấn nút **Thêm thủ công** ở góc phải trên.
   - Nhập các trường dữ liệu; các trường bắt buộc có dấu `*`, các trường có thể null có checkbox "Không có giá trị".
   - Nhấn **Thêm mới thủ công**; hệ thống kiểm tra ràng buộc duy nhất và ghi DB an toàn.
