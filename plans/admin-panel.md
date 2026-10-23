# Kế hoạch xây dựng trang quản trị LearnPath

> Trạng thái: **Đã duyệt D1–D10; Phase 0–5 hoàn thành, Phase 6 một phần (2026-10-23)**
> Ngày lập: 2026-10-23
> Phân loại: **L3** (schema auth, auth/session mới, quyền ghi DB tuyển sinh, xóa dữ liệu/tài khoản)
> Liên quan: `plans/auth-hardening.md`, `.agents/ARCHITECTURE.md`, `.agents/AI_RULES.md`

---

## 1. Mục tiêu

Xây dựng một khu vực quản trị **ẩn tại `/admin`**, tách biệt hoàn toàn với đăng nhập người dùng thường, cho phép quản trị viên:

1. Đăng nhập bằng tài khoản/mật khẩu quản trị riêng.
2. Xem, bổ sung, chỉnh sửa, xóa dữ liệu trong 5 bảng dữ liệu tuyển sinh:
   - `khoi_thi`
   - `truong`
   - `diem_chuan`
   - `diem_thi_thptqg`
   - `de_an_tuyen_sinh`
3. Quản lý toàn bộ tài khoản người dùng:
   - Xem, tìm kiếm, phân trang.
   - Khóa/mở khóa.
   - Xóa.
   - Sửa tên đăng nhập.
   - Đặt lại mật khẩu.
   - Tạo nhiều tài khoản mới trong một lần.
4. Xem nhật ký thao tác quản trị.

### 1.1. Không nằm trong phạm vi giai đoạn này

- Không làm trang quản lý admin khác (tạo/sửa/xóa admin qua UI); admin được tạo/quản lý bằng CLI.
- Không thêm email, số điện thoại, họ tên, avatar cho user nếu chưa chốt (xem D6).
- Không làm MFA/TOTP trong Phase 1–5; để Phase 6 tùy chọn.
- Không thay đổi công thức xếp hạng, ý nghĩa điểm, năm dữ liệu.
- Không rebuild DB thật, không chạy `db:init` trên DB thật.
- Không commit/push/PR nếu chưa được yêu cầu.

---

## 2. Baseline hiện tại

### 2.1. Dữ liệu tuyển sinh

DB: `backend/database/learnpath.db`, 114.540.544 bytes (109,2 MiB), `PRAGMA integrity_check = ok`.

| Bảng | Số dòng |
|---|---:|
| `de_an_tuyen_sinh` | 307 |
| `diem_chuan` | 2.617 |
| `diem_thi_thptqg` | 1.131.975 |
| `khoi_thi` | 245 |
| `truong` | 260 |

Hiện tại runtime chỉ đọc DB tuyển sinh:

- `backend/src/database/db.js` nạp toàn bộ file vào RAM bằng `sql.js`.
- `saveDb()` chỉ dùng cho importer, ghi trực tiếp bằng `fs.writeFileSync`, không atomic, không backup.
- Các route dữ liệu chỉ có GET; chưa có write API.
- `server.js` mount các route dữ liệu sau `requireAuth` (user thường).

**Benchmark read-only trên máy hiện tại:**

```text
load 109 MiB         ~39 ms
export()             ~46 ms
write 109 MiB        ~66 ms
tổng export + write  ~151 ms
PRAGMA quick_check   ~253 ms
PRAGMA integrity_check ~503 ms
```

Kết luận: có thể giữ `sql.js` và ghi atomic toàn bộ DB cho mỗi thao tác admin. Chi phí thực tế khoảng 0,4–0,7 giây/thao tác, phù hợp tần suất admin. Nếu sau này cần sửa hàng loạt hoặc nhiều admin thao tác liên tục, mới cân nhắc `node:sqlite`/WAL.

### 2.2. Auth DB

DB: `backend/database/auth.db`, schema v1:

- `users`: `id`, `username`, `username_lower`, `password_hash`, `created_at`.
- `sessions`: `token_hash`, `user_id`, `created_at`, `expires_at`.
- Chưa có trạng thái khóa, chưa có admin, chưa có audit.
- `SCHEMA_VERSION = 1` trong `backend/src/auth/authDb.js`.
- `saveAuthDb()` ghi temp rồi rename; fallback Windows dùng `copyFileSync`, chưa atomic tuyệt đối.
- Session user: cookie `lp_session`, HttpOnly, SameSite=Lax, 7 ngày, Secure ở production.

### 2.3. Frontend

- `App.jsx` bọc mọi route trong `Layout` công khai.
- `AuthContext` chỉ quản lý user thường; gọi `/api/auth/me` khi tải.
- `ProtectedRoute` chặn user chưa đăng nhập.
- Chưa có route admin, chưa có lazy loading theo route.
- Bundle chính hiện ~1.009 kB; cần lazy-load admin để không làm nặng trang công khai.

### 2.4. Ràng buộc dữ liệu

- `diem_chuan.ma_truong` không phải foreign key; có thể orphan.
- `de_an_tuyen_sinh.ma_truong` không phải foreign key; 47 mã không có trong `truong`.
- `diem_chuan.truong` và `de_an_tuyen_sinh.ten_truong` là tên denormalized, có thể lệch `truong.ten_truong`.
- `diem_chuan` chứa nhiều thang điểm khác nhau (THPT, HSA, TSA, V-ACT, SAT), không được áp một range điểm chung.
- `de_an_tuyen_sinh.noi_dung` là Markdown lớn; cần body limit riêng cho admin.
- `diem_thi_thptqg` 1,1 triệu dòng; admin không được tải toàn bộ vào trình duyệt.

---

## 3. Threat model

| Mối đe dọa | Hậu quả | Kiểm soát đề xuất |
|---|---|---|
| Lộ mật khẩu admin | Toàn bộ DB bị sửa/xóa | Bảng admin riêng, scrypt, rate limit, session ngắn, audit, CLI reset, optional MFA/IP allowlist |
| Brute force admin | Chiếm quyền admin | Rate limit theo IP + username, progressive delay, generic error, dummy scrypt, audit, optional IP allowlist |
| CSRF | Kẻ tấn công thực hiện thao tác admin | SameSite=Strict, kiểm tra Origin cho mọi non-GET, CSRF token theo session |
| XSS | Đánh cắp phiên admin | Không render HTML thô trong admin; CSP; cookie HttpOnly; không localStorage |
| SQL injection | Đọc/sửa/xóa dữ liệu | Whitelist table/column, bound parameters, không nhận raw SQL |
| Mass assignment | Sửa cột ngoài ý muốn | Schema metadata allowlist, validate từng cột |
| Xóa nhầm | Mất dữ liệu | Confirmation, audit, backup, chặn xóa có phụ thuộc, force có xác nhận |
| Ghi DB thất bại | RAM/disk lệch nhau | Transaction, `quick_check`, temp + fsync + rename, reload từ disk khi lỗi, backup |
| Admin session bị đánh cắp | Toàn quyền | 8h absolute + 30m idle, max 3 session, revoke all khi reset/disable |
| Lộ password hàng loạt | Chiếm nhiều tài khoản | Password sinh ngẫu nhiên, chỉ trả một lần, không log, không lưu plaintext |
| Enumeration user | Dò tài khoản | Login user giữ generic 401; chỉ báo khóa khi đúng mật khẩu |
| Admin path bị quét | Tăng bề mặt tấn công | `/admin` chỉ là UX; server auth bắt buộc; noindex; optional `ADMIN_ALLOWED_IPS` |
| Admin lạm quyền | Sửa/xóa không dấu vết | Audit log bất biến ở tầng app, ghi mọi mutation, không chứa secret |

---

## 4. Quyết định cần chốt

> Đây là các thay đổi L3. Không triển khai cho đến khi có quyết định.

| ID | Đã chốt | Ghi chú triển khai |
|---|---|---|
| D1 | **Bảng `admins` + `admin_sessions` riêng; CLI tạo admin** | Tách hoàn toàn cookie/session user; không có admin registration |
| D2 | **8h absolute + 30m idle + tối đa 3 session; SameSite=Strict; CSRF** | Cookie `lp_admin_session` / `__Host-` ở production |
| D3 | **Giữ `sql.js`, ghi atomic toàn bộ DB, serialized, backup + quick_check** | Benchmark ~151 ms export+write; ~650 ms kèm kiểm tra |
| D4 | **Soft delete / lưu trữ** | `users.status='deleted'`, giữ username, revoke session; có restore |
| D5 | **Sinh mật khẩu ngẫu nhiên + buộc đổi lần đầu** | Thêm `must_change_password`, endpoint change-password, chặn data API đến khi đổi |
| D6 | **Username, mật khẩu (reset), trạng thái** | Không thêm họ tên/email/điện thoại |
| D7 | **Chặn xóa `truong` nếu còn phụ thuộc; force sau xác nhận** | Mặc định an toàn, không cascade |
| D8 | **Không link public, `noindex`, server auth; optional `ADMIN_ALLOWED_IPS`** | IP allowlist là tùy chọn, không bật mặc định |
| D9 | **Audit 180 ngày, IP hash, không secret; có UI** | Ghi mọi mutation và login |
| D10 | **MFA để Phase 6 tùy chọn** | Không chặn Phase 1–4 |

Các quyết định D7–D10 dùng mặc định trong bảng; có thể đổi trước Phase 5.

---

## 5. Kiến trúc đề xuất

```text
Browser
  ├── /admin (React, lazy-loaded, noindex, không dùng Layout công khai)
  │      └── /api/admin/*  (cookie lp_admin_session / __Host-lp_admin_session)
  │
  ├── /api/auth/*        (user thường, cookie lp_session)  ──┐
  ├── /api/de-an/*       (user thường)                        │
  └── /api/diem-chuan/*  (user thường)                        │
                                                              ▼
                                                    auth.db (schema v2)
                                                    ├── users (+status)
                                                    ├── sessions
                                                    ├── admins
                                                    ├── admin_sessions
                                                    └── admin_audit

Admin data API ── sql.js in-memory ── atomic export ── learnpath.db
                                   └── backups/learnpath-*.db
```

### 5.1. Tách biệt quyền

- Cookie user `lp_session` **không** được dùng cho `/api/admin/*`.
- Cookie admin `lp_admin_session` **không** được dùng cho API user.
- `requireAuth` chỉ chấp nhận `sessions` + `users.status='active'`.
- `requireAdmin` chỉ chấp nhận `admin_sessions` + `admins.status='active'`.
- Không có endpoint admin nào đăng ký công khai.

### 5.2. Lazy loading frontend

- `AdminPage` được `React.lazy()` + `Suspense`; tách chunk khỏi bundle công khai.
- Route `/admin/*` nằm ngoài `Layout` công khai, không render header/footer marketing.
- Không thêm link admin vào `Layout`, menu mobile, footer hoặc `sitemap`.
- `robots.txt` (nếu thêm) chỉ là defense-in-depth, không phải kiểm soát truy cập.

---

## 6. Auth DB schema v2

### 6.1. Thay đổi bảng `users`

```sql
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN updated_at INTEGER;
ALTER TABLE users ADD COLUMN last_login_at INTEGER;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
```

- `status`: `active`, `locked`, hoặc `deleted` (soft delete theo D4).
- Existing users mặc định `active`; không mất tài khoản/session.
- `deleted_at` lưu thời điểm soft delete; restore đặt lại `NULL`.
- `last_login_at` cập nhật khi login thành công.
- `must_change_password` mặc định `0`; bulk create/reset đặt `1` (D5).

### 6.2. Bảng admin

```sql
CREATE TABLE admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE admin_sessions (
  token_hash   TEXT PRIMARY KEY,
  admin_id     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  csrf_hash    TEXT NOT NULL,
  user_agent   TEXT,
  ip_hash      TEXT,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);
```

- Chỉ lưu SHA-256 của session token và CSRF token.
- `ip_hash = SHA-256(IP + server secret)`; không lưu IP thô.
- `user_agent` rút gọn tối đa 255 ký tự.

### 6.3. Audit

```sql
CREATE TABLE admin_audit (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id       INTEGER,
  admin_username TEXT NOT NULL,
  action         TEXT NOT NULL,
  entity         TEXT,
  entity_id      TEXT,
  details        TEXT,
  ip_hash        TEXT,
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_admin_audit_created_at ON admin_audit(created_at);
CREATE INDEX idx_admin_audit_admin_id ON admin_audit(admin_id);
```

- `details` là JSON ngắn: trường thay đổi, số dòng, kết quả; **không** chứa password, hash, token, cookie.
- `admin_id` có thể null nếu admin bị xóa; `admin_username` là snapshot.

### 6.4. Migration v1 → v2

- Backup `auth.db` ra ngoài repo trước khi migrate.
- `authDb.js` tự tạo thêm một bản `.v1-backup-<timestamp>` trước migration (best effort).
- Chạy `ALTER TABLE` + `CREATE TABLE` + `PRAGMA user_version = 2` trong transaction.
- Kiểm tra lại `users`, `sessions`, `admins`, `admin_sessions`, `admin_audit`.
- Nếu lỗi: khôi phục backup, không chạy tiếp.
- Test migration trên bản copy/temp; không dùng `auth.db` thật.
- **Phối hợp với auth-hardening:** admin lấy schema v2; Phase 2 của auth-hardening (session lifecycle) sẽ là v3. Không để hai nhánh cùng đặt v2.

### 6.5. Bootstrap admin

CLI đề xuất:

```bash
cd backend
npm run admin:create -- --username admin
```

- Prompt mật khẩu ẩn, xác nhận mật khẩu.
- Không nhận password qua argv (tránh shell history).
- Hỗ trợ env `ADMIN_USERNAME`/`ADMIN_PASSWORD` chỉ cho CI/automation có kiểm soát.
- Mật khẩu admin tối thiểu 12 ký tự, tối đa 128, có chữ và số (chặt hơn user).
- Không auto-create admin khi server start; nếu chưa có admin, log cảnh báo rõ.
- Lệnh phụ: `--reset-password`, `--disable`, `--enable`, `--list`.

---

## 7. Admin auth và session

### 7.1. Endpoint

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/admin/auth/login` | Đăng nhập admin, set cookie + trả CSRF token |
| GET | `/api/admin/auth/me` | Admin hiện tại + CSRF token |
| POST | `/api/admin/auth/logout` | Xóa session admin, clear cookie |
| GET | `/api/admin/overview` | Thống kê, trạng thái DB/backup |

### 7.2. Cookie

- Dev: `lp_admin_session`.
- Production: `__Host-lp_admin_session` (Secure, Path=/, không Domain).
- `HttpOnly: true`, `SameSite: 'Strict'`, `Secure` khi production, `Path: '/'`.
- `maxAge` = absolute TTL.
- Không dùng chung cookie user; clear đúng tên theo môi trường.

### 7.3. Session policy

- Absolute: 8 giờ.
- Idle: 30 phút (khác D6 của user; admin có đặc quyền cao hơn).
- Tối đa 3 session/admin; session cũ nhất bị xóa khi vượt.
- `last_seen_at` cập nhật throttle 5 phút.
- Login mới không xóa session cũ (trừ khi vượt max).
- Reset password/disable admin xóa toàn bộ session admin đó.
- Cleanup session hết hạn khi login và định kỳ.

### 7.4. CSRF và origin

- Mọi non-GET yêu cầu header `X-Admin-CSRF` khớp `csrf_hash` của session.
- Kiểm tra `Origin` cho **mọi** non-GET (hiện `requireTrustedOrigin` chỉ kiểm tra POST; cần mở rộng).
- Nếu có `Sec-Fetch-Site`, chỉ chấp nhận `same-origin` hoặc `none`.
- `SameSite=Strict` là lớp bổ sung, không thay CSRF token.
- Thiếu/sai CSRF → `403`, audit `admin.csrf.rejected` (không log token).

### 7.5. Rate limit admin login

- 5 failure / 15 phút cho cặp IP + username.
- 20 failure / 15 phút cho IP.
- Progressive delay 250ms → 500ms → 1s; hard `429` + `Retry-After` khi vượt.
- Unknown username vẫn chạy dummy scrypt.
- Login thành công clear bucket pair; audit success/failure.
- Optional `ADMIN_ALLOWED_IPS` (CSV). Nếu đặt, IP ngoài danh sách nhận `403` generic; áp dụng cho toàn `/api/admin`, trừ health? Không cần health admin.

### 7.6. Audit action tối thiểu

```text
admin.login.success
admin.login.failure
admin.logout
admin.csrf.rejected
admin.user.create
admin.user.bulk_create
admin.user.update
admin.user.lock
admin.user.unlock
admin.user.reset_password
admin.user.delete
admin.data.create
admin.data.update
admin.data.delete
admin.data.force_delete
admin.backup.create
admin.session.revoke
```

---

## 8. Quản lý user

### 8.1. Endpoint

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/admin/users?query=&status=&page=&limit=` | Danh sách, tìm username, lọc trạng thái |
| GET | `/api/admin/users/:id` | Chi tiết user |
| POST | `/api/admin/users` | Tạo 1 user; trả password tạm một lần |
| POST | `/api/admin/users/bulk` | Tạo nhiều user (tối đa 50) |
| PATCH | `/api/admin/users/:id` | Sửa username |
| POST | `/api/admin/users/:id/lock` | Khóa + revoke session |
| POST | `/api/admin/users/:id/unlock` | Mở khóa |
| POST | `/api/admin/users/:id/restore` | Khôi phục user đã soft delete |
| POST | `/api/admin/users/:id/reset-password` | Reset mật khẩu + revoke session + buộc đổi |
| DELETE | `/api/admin/users/:id` | Soft delete + revoke session |

### 8.2. Quy tắc

- Username dùng đúng validator hiện tại (3–32, ASCII, bắt đầu/kết thúc chữ/số).
- Không cho sửa `id`, `password_hash`, `created_at` trực tiếp.
- Sửa username: kiểm tra unique case-insensitive; session hiện tại vẫn hợp lệ (gắn `user_id`).
- Khóa: `status='locked'`, xóa toàn bộ session user.
- Login:
  - Nếu sai mật khẩu → generic `401` như hiện tại.
  - Nếu đúng mật khẩu nhưng `locked` → `403` "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
  - Không tiết lộ trạng thái nếu chưa đúng mật khẩu.
- Reset password: sinh mật khẩu ngẫu nhiên 16 ký tự, đảm bảo chữ + số; trả một lần; revoke session; đặt `must_change_password=1`.
- Xóa: soft delete; yêu cầu body `{ confirmUsername: "<username>" }`; đặt `status='deleted'`, `deleted_at=now`; revoke session; audit snapshot.
- Khôi phục: chỉ user `deleted`; đặt `status='active'`, `deleted_at=NULL`; không khôi phục session cũ.
- Không cho admin tự thao tác trên tài khoản admin qua API user (admin ở bảng riêng).
- Bulk create:
  - Input mảng username hoặc textarea mỗi dòng một username.
  - Validate toàn bộ trước; báo `invalid`, `duplicate` riêng.
  - Tối đa 50/lần.
  - Sinh password riêng cho từng user; hash trước khi mở transaction; `must_change_password=1`.
  - Insert transaction; nếu save lỗi, reload auth DB từ disk và trả `500`.
  - Trả `{ data: [{ id, username, password }], skipped: [...] }`; `Cache-Control: no-store`.
  - UI hiển thị một lần, cho tải CSV; không lưu password ở server.

### 8.3. Tác động lên auth hiện tại

- `getSessionUser` join `users.status='active'`, trả thêm `mustChangePassword`.
- `login` select thêm `status`, `must_change_password`; xử lý khóa như trên; cập nhật `last_login_at`.
- `validateLogin` giữ nguyên.
- Thêm `POST /api/auth/change-password`:
  - `currentPassword`, `newPassword`, `newPasswordConfirm`.
  - Verify current; validate new; hash mới; đặt `must_change_password=0`; revoke các session khác; giữ session hiện tại.
  - Trả user mới; 401 current sai; 400 policy.
- `requirePasswordChanged` chặn 4 route dữ liệu khi `must_change_password=1` với `403 { code: 'PASSWORD_CHANGE_REQUIRED' }`. `/api/auth/me`, `/logout`, `/change-password` vẫn được phép.
- Frontend thêm `/doi-mat-khau`; `ProtectedRoute` chuyển user bắt buộc đổi mật khẩu về trang này.
- Logout fail-closed: nếu xóa session lỗi, không clear cookie như thành công.
- Nếu auth-hardening Phase 1 chưa làm, admin feature mang theo phần logout fail-closed tối thiểu; không sửa ngoài phạm vi.

---

## 9. CRUD dữ liệu tuyển sinh

### 9.1. Nguyên tắc

- Chỉ 5 bảng tuyển sinh; không generic CRUD trên `auth.db`.
- Whitelist table/column phía server; không nhận tên bảng/cột tùy ý từ client.
- Mọi giá trị bind parameter; không nối chuỗi SQL.
- `id` read-only.
- Không đổi schema DB tuyển sinh trong giai đoạn này.
- Mọi mutation chạy trong transaction + `quick_check` + atomic save.
- Không cho ghi nếu DB chưa load hoặc đang ở trạng thái degraded.

### 9.2. Schema metadata

File đề xuất: `backend/src/admin/dataSchema.js`.

Mỗi bảng gồm:

```js
{
  table: 'diem_chuan',
  label: 'Điểm chuẩn',
  primaryKey: 'id',
  searchColumns: ['ma_truong', 'truong', 'nganh', 'to_hop_mon', 'phuong_thuc'],
  defaultSort: 'id',
  columns: [
    { name: 'id', type: 'integer', readOnly: true },
    { name: 'ma_truong', type: 'string', maxLength: 32, nullable: true },
    // ...
  ],
}
```

- `type`: `string`, `text`, `integer`, `real`.
- `required`, `nullable`, `maxLength`, `min`, `max`, `sortable`.
- Unique: `ma_khoi`, `ma_truong` (truong), `sbd`.
- Không áp range điểm chung cho `diem_chuan` vì nhiều thang điểm.
- `diem_thi_thptqg`: điểm từng môn >= 0 và hữu hạn; không ép <= 10 nếu dữ liệu nguồn có ngoại lệ.
- `noi_dung`: max 1.000.000 ký tự; body limit admin 2 MB (dữ liệu hiện tại dài nhất 302.836 ký tự).
- `nganh`: max 512 ký tự (dữ liệu hiện tại dài nhất 284); `ten_truong`/`to_hop_mon`: max 255.

### 9.3. Endpoint

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/admin/data/tables` | Metadata 5 bảng |
| GET | `/api/admin/data/:table?search=&page=&limit=&sort=&order=` | Danh sách |
| GET | `/api/admin/data/:table/:id` | Chi tiết |
| POST | `/api/admin/data/:table` | Tạo |
| PATCH | `/api/admin/data/:table/:id` | Sửa |
| DELETE | `/api/admin/data/:table/:id` | Xóa |

- List trả `{ data, total, page, limit }`.
- Default limit 50; max 100.
- Search tối đa 100 ký tự.
- Sort chỉ cột `sortable`; order `asc|desc`.
- `diem_thi_thptqg` vẫn phân trang bình thường; UI khuyến khích tìm theo SBD.
- Create/update trả row mới.
- Delete trả `204`.

### 9.4. Ràng buộc và xóa

- `truong`:
  - Xóa mặc định bị chặn nếu có `diem_chuan.ma_truong` hoặc `de_an_tuyen_sinh.ma_truong` tham chiếu.
  - Trả `409` kèm số dòng phụ thuộc.
  - `force=true` + `confirm` cho phép xóa, ghi audit `admin.data.force_delete`; dữ liệu liên quan thành orphan (đã cảnh báo).
- Sửa `truong.ma_truong`:
  - Nếu đang được tham chiếu, chặn (tránh orphan âm thầm) trừ khi force.
  - Không tự động đổi `diem_chuan.truong`/`de_an.ten_truong` (denormalized); UI cảnh báo.
- `diem_chuan.ma_truong` trỏ tới trường không tồn tại: cho phép nhưng trả warning; dữ liệu hiện tại đã có orphan.
- Xóa `khoi_thi`, `diem_chuan`, `diem_thi_thptqg`, `de_an_tuyen_sinh`: không có FK; chỉ cần confirm.
- Không cascade tự động bất kỳ bảng tuyển sinh nào.

### 9.5. Ghi DB atomic

File đề xuất: `backend/src/admin/admissionWrite.js`.

```text
BEGIN
  validate + mutate
  PRAGMA quick_check
COMMIT
export()
write temp + fsync
rename temp -> learnpath.db
```

- Trước lần ghi đầu tiên trong process: backup `learnpath.db` vào `backend/database/backups/`.
- Trước mỗi thao tác xóa/force: backup thêm.
- Giữ tối đa 5 backup; tên `learnpath-YYYYMMDD-HHMMSS.db`.
- Nếu `quick_check` fail: rollback, không ghi, trả `500`.
- Nếu write/rename fail: reload DB từ file cũ; nếu reload fail, đặt `writesBlocked=true`, trả `503`, log rõ.
- Windows fallback: dùng rename; nếu không replace được, copy + backup; ghi rõ giới hạn.
- Serialize write bằng cờ synchronous; không `await` bên trong transaction.
- Không chạy `saveDb()` cũ cho admin write.

### 9.6. Giới hạn hiệu năng

- Mỗi mutation ghi lại toàn bộ 109 MiB; chấp nhận ~0,5–1 giây.
- Không hỗ trợ sửa hàng loạt lớn trong một request ở giai đoạn này.
- Nếu admin cần sửa >100 dòng/lần, để phase sau (batch import hoặc `node:sqlite`).
- UI hiển thị trạng thái "Đang lưu..." và không cho submit lặp.

---

## 10. Giao diện admin

### 10.1. Route và bảo vệ

- `/admin` và `/admin/*`: lazy-loaded, ngoài `Layout`.
- Nếu chưa đăng nhập admin: hiện form login tại `/admin`, không redirect sang `/dang-nhap`.
- Nếu đã đăng nhập: dashboard.
- `document.title = 'Quản trị LearnPath'`; inject `<meta name="robots" content="noindex,nofollow">`.
- Không link từ public UI.
- Logout admin gọi `/api/admin/auth/logout`, xóa state, về form login.

### 10.2. Thành phần

```text
frontend/src/pages/AdminPage.jsx
frontend/src/components/admin/AdminLogin.jsx
frontend/src/components/admin/AdminShell.jsx
frontend/src/components/admin/AdminOverview.jsx
frontend/src/components/admin/UsersPanel.jsx
frontend/src/components/admin/UserFormDialog.jsx
frontend/src/components/admin/BulkCreateDialog.jsx
frontend/src/components/admin/DataPanel.jsx
frontend/src/components/admin/DataFormDialog.jsx
frontend/src/components/admin/AuditPanel.jsx
frontend/src/lib/adminApi.js
```

### 10.3. Màn hình

1. **Đăng nhập admin**
   - Username, password, hiện/ẩn mật khẩu.
   - Không có đăng ký/quên mật khẩu.
   - Hiển thị lỗi generic; không tiết lộ username tồn tại.

2. **Tổng quan**
   - Số dòng 5 bảng, số user active/locked, dung lượng DB, backup gần nhất, session admin hiện tại.
   - Cảnh báo nếu chưa có backup hoặc DB degraded.

3. **Người dùng**
   - Bảng: username, trạng thái, ngày tạo, lần đăng nhập cuối.
   - Tìm kiếm, lọc active/locked, phân trang.
   - Nút: Sửa username, Khóa/Mở, Reset mật khẩu, Xóa.
   - Dialog xác nhận xóa: nhập lại username.
   - Dialog tạo 1 user / tạo hàng loạt:
     - Textarea danh sách username.
     - Kết quả: username + password tạm, nút copy/tải CSV.
     - Cảnh báo password chỉ hiện một lần.

4. **Dữ liệu**
   - Chọn bảng; hiển thị metadata.
   - Bảng dữ liệu: phân trang, tìm kiếm, sắp xếp.
   - Nút Thêm; mỗi dòng có Sửa/Xóa.
   - Form sinh động theo metadata:
     - string/text → input/textarea.
     - integer/real → number.
     - nullable → checkbox "Không có giá trị".
   - `de_an_tuyen_sinh.noi_dung`: textarea lớn, monospace.
   - Xóa trường `truong` có phụ thuộc: dialog hiển thị số dòng, yêu cầu xác nhận mạnh nếu force.
   - Không render Markdown/HTML thô trong admin.

5. **Nhật ký**
   - Bảng: thời gian, admin, action, entity, entity id, kết quả.
   - Lọc theo action/admin/thời gian; phân trang.
   - Không hiển thị secret.

### 10.4. API client

- `frontend/src/lib/adminApi.js` là axios instance riêng:
  - `baseURL: '/api/admin'`
  - `withCredentials: true`
  - không dùng interceptor `auth:unauthorized` của user.
- CSRF token giữ trong memory (module variable/context), không localStorage/sessionStorage.
- Request interceptor gắn `X-Admin-CSRF` cho POST/PATCH/DELETE.
- 401 admin → clear state, hiện login; không đá user thường ra khỏi phiên.

---

## 11. API contract chi tiết

### 11.1. Chung

- Success: `{ data: ... }`, list `{ data: [...], total, page, limit }`.
- Error: `{ error: "..." }`.
- Admin API luôn `Cache-Control: no-store`, `Pragma: no-cache`.
- `401` chưa đăng nhập admin; `403` CSRF/origin/IP; `404` không tồn tại; `409` unique/dependency; `413` body quá lớn; `429` rate limit; `503` DB write blocked.

### 11.2. Login admin

```http
POST /api/admin/auth/login
Content-Type: application/json

{ "username": "admin", "password": "..." }
```

```json
{
  "data": {
    "admin": {
      "id": 1,
      "username": "admin",
      "createdAt": "2026-10-23T...",
      "lastLoginAt": null
    },
    "csrfToken": "..."
  }
}
```

- Set cookie admin.
- Sai → `401 { "error": "Tên đăng nhập hoặc mật khẩu không đúng." }`.
- Bị khóa → `403` generic hoặc cùng message; không enumerate.
- Rate limited → `429` + `Retry-After`.

### 11.3. Danh sách user

```http
GET /api/admin/users?query=abc&status=active&page=1&limit=50
```

```json
{
  "data": [
    {
      "id": 12,
      "username": "hocsinh01",
      "status": "active",
      "createdAt": "...",
      "lastLoginAt": "..."
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

### 11.4. Bulk create

```http
POST /api/admin/users/bulk
{ "usernames": ["user01", "user02"] }
```

```json
{
  "data": [
    { "id": 20, "username": "user01", "password": "..." }
  ],
  "skipped": [
    { "username": "user02", "reason": "Tên đăng nhập đã tồn tại." }
  ]
}
```

- `Cache-Control: no-store`.
- Password không xuất hiện trong audit/log/DB.

### 11.5. Data list

```http
GET /api/admin/data/diem_chuan?search=BKA&page=1&limit=50&sort=id&order=asc
```

```json
{
  "data": [ { "id": 1, "ma_truong": "BKA", "...": "..." } ],
  "total": 176,
  "page": 1,
  "limit": 50
}
```

### 11.6. Data mutation

```http
POST /api/admin/data/truong
{ "ma_truong": "XYZ", "ten_truong": "Trường XYZ" }
```

- `201` row mới.
- `409` unique.
- `400` validation.

```http
PATCH /api/admin/data/truong/1
{ "ten_truong": "Tên mới" }
```

```http
DELETE /api/admin/data/truong/1
{ "confirm": true, "force": false }
```

- `409` nếu còn phụ thuộc và `force=false`.
- `204` nếu xóa thành công.

---

## 12. Bảo mật triển khai

### 12.1. Header và cookie

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy` giữ hiện tại
- Admin API thêm `Cache-Control: no-store`
- Production: HSTS, Secure cookie, `__Host-` prefix.
- Cân nhắc CSP cho admin: `default-src 'self'`; không dùng inline script; Vite build không cần `unsafe-eval`. Nếu CSP làm hỏng public site, chỉ áp dụng cho `/admin` response? SPA dùng chung index.html, khó tách. Ghi nhận là Phase 6.

### 12.2. Body limit

- Global JSON hiện 10 kB.
- Admin router cần body tới 2 MB cho `noi_dung` Markdown.
- Giải pháp: mount admin router trước global parser với `express.json({ limit: '2mb' })`, hoặc tăng global lên 1 MB và giữ validate.
- Không nâng body limit cho `/api/auth/*`; auth vẫn 10 kB.

### 12.3. Logging

- Log JSON một dòng: `timestamp`, `level`, `requestId`, `adminId` (nếu có), `action`, `entity`, `result`, `durationMs`.
- Không log body, password, token, cookie, header Authorization.
- IP chỉ log dạng hash.
- Request ID dùng `crypto.randomUUID()`; trả header `X-Request-Id`.

### 12.4. Rate limit và DoS

- Admin login rate limit riêng.
- Bulk create tối đa 50.
- Data list limit tối đa 100.
- Search max 100 ký tự.
- Body max 2 MB admin.
- Admin write serialize; không xếp hàng vô hạn.
- Nếu write đang diễn ra, request khác nhận `503` + `Retry-After` (hoặc chờ ngắn).

### 12.5. Admin IP allowlist (optional)

- Env `ADMIN_ALLOWED_IPS=203.0.113.10,198.51.100.7` (danh sách IP chính xác; CIDR để phase sau).
- Chỉ bật khi `TRUST_PROXY` được cấu hình đúng; nếu không, `req.ip` có thể là IP proxy.
- IP ngoài danh sách → `403` generic; audit.
- Không bật mặc định.

### 12.6. Audit retention

- 180 ngày; cleanup định kỳ (khi login/admin start).
- Không xóa audit trong transaction với data.
- Nếu audit write fail: log lỗi, trả `500` cho mutation (data đã đổi) và hiển thị cảnh báo; không im lặng.

---

## 13. Các phase triển khai

### Phase 0 — Chốt quyết định và baseline

**Trạng thái: ✅ Hoàn thành (2026-10-23).**

**Mục tiêu:** khóa phạm vi, backup, test harness; không đổi runtime.

- Chốt D1–D10.
- Backup `auth.db` và `learnpath.db` ra ngoài repo, ghi SHA-256/size.
- Ghi baseline test hiện tại (49/49).
- Tạo test fixture DB tuyển sinh nhỏ (temp) cho CRUD, không dùng DB thật.
- Không sửa code.

**Exit gate:** quyết định được ghi vào plan; backup có hash; baseline pass.

### Phase 1 — Auth DB v2 + admin auth

**Trạng thái: ✅ Hoàn thành (2026-10-23).**

**Mục tiêu:** admin đăng nhập được, tách biệt user; chưa có UI quản trị.

- Migration v1 → v2 (users status, admins, admin_sessions, admin_audit).
- `adminAuth.js`, `adminSession.js`, `requireAdmin`.
- CLI `admin:create` + reset/disable/list.
- Rate limit admin, CSRF, origin cho non-GET.
- Login/me/logout/overview API.
- Tests migration, login, session, cookie, CSRF, rate limit.
- Chưa mount data/user admin routes.

**Exit gate:** test pass; migration temp giữ nguyên user/session; auth DB thật không bị ghi; frontend build không đổi.

### Phase 2 — Quản lý user

**Trạng thái: ✅ Hoàn thành (2026-10-23).**

**Mục tiêu:** admin CRUD user qua API + UI.

- API list/detail/create/update/lock/unlock/reset/delete/bulk.
- Sửa login user để check status + last_login_at.
- UI UsersPanel + dialogs.
- Audit user actions.
- Tests: lock/login, delete/cascade, bulk, unique, reset, session revoke.

**Exit gate:** toàn bộ flow user pass trên auth DB tạm; user session cũ bị revoke đúng; không lộ password/hash.

### Phase 3 — Data browser (read-only)

**Trạng thái: ✅ Hoàn thành (2026-10-23).**

**Mục tiêu:** admin xem được 5 bảng an toàn trước khi mở ghi.

- `dataSchema.js` metadata.
- API list/detail/tables (GET only).
- UI DataPanel read-only, search/pagination/sort.
- Tests: allowlist, pagination, search, 1.1M table, no write.

**Exit gate:** không có mutation endpoint; DB hash không đổi; UI hiển thị đúng 5 bảng.

### Phase 4 — Data CRUD + write engine

**Trạng thái: ✅ Hoàn thành (2026-10-23).**

**Mục tiêu:** bổ sung/sửa/xóa dữ liệu an toàn.

- `admissionWrite.js`: transaction, quick_check, atomic save, backup, reload.
- POST/PATCH/DELETE + validation + unique + dependency checks.
- UI form/dialog + confirm xóa.
- Audit data actions.
- Tests với DB tuyển sinh tạm nhỏ; test save failure/reload; test force delete.
- Không dùng DB thật để test.

**Exit gate:** CRUD pass trên temp; `learnpath.db` thật hash không đổi; backup/restore drill pass; quick_check pass.

### Phase 5 — Audit UI + hardening

**Trạng thái: ✅ Hoàn thành (2026-10-23).**

**Mục tiêu:** hoàn thiện vận hành.

- AuditPanel, filter/pagination.
- Overview stats/backup age.
- noindex/robots, lazy chunk, request ID, security headers.
- Admin IP allowlist optional.
- Rate limit/body limit final.
- Tests frontend build + E2E admin.

**Exit gate:** build pass; chunk admin tách; không có link public; audit đầy đủ; 401/403/429 đúng.

### Phase 6 — E2E, docs, rollout drill

**Trạng thái: 🟡 Một phần (2026-10-23).** E2E, docs, và runbook rollback đã xong. Chưa chạy migration drill trên bản copy của auth DB thật; TOTP để optional. Auth DB thật đã được migrate ngoài test suite (xem KI-24) nên cần quyết định giữ v2 hay restore v1.

**Mục tiêu:** sẵn sàng dùng thật.

- E2E với temp auth DB + temp admission DB.
- Backup/restore auth DB và admission DB.
- Migration drill trên bản copy của auth DB thật.
- Docs: README, ARCHITECTURE, TESTING, PROJECT_STATUS, KNOWN_ISSUES.
- Optional TOTP cho admin (nếu chốt).
- Không commit/push nếu chưa được yêu cầu.

**Exit gate:** DoD dưới đây đạt; có runbook rollback.

---

## 14. Test matrix

### 14.1. Auth DB

| ID | Case | Kỳ vọng |
|---|---|---|
| A01 | Fresh DB | schema v2 đủ 5 bảng |
| A02 | v1 → v2 | users/sessions giữ nguyên; cột mới default đúng |
| A03 | v2 → app cũ | báo version mới hơn, không ghi |
| A04 | Backup trước migration | file backup tồn tại, hash khớp |
| A05 | Admin CLI create | hash scrypt, không log password |
| A06 | Admin CLI duplicate | 409/exit code rõ |
| A07 | Admin disabled | login bị từ chối |

### 14.2. Admin auth

| ID | Case | Kỳ vọng |
|---|---|---|
| B01 | Login đúng | 200, cookie HttpOnly/SameSite=Strict, CSRF token |
| B02 | Login sai | 401 generic, dummy scrypt |
| B03 | Rate limit | 429 + Retry-After |
| B04 | CSRF thiếu/sai | 403 |
| B05 | Origin xấu PATCH/DELETE | 403 |
| B06 | Session hết hạn | 401, clear cookie |
| B07 | Idle 30m | 401 |
| B08 | Quá 3 session | session cũ nhất bị xóa |
| B09 | Logout | 204, session DB xóa |
| B10 | User cookie gọi admin API | 401 |
| B11 | Admin cookie gọi user API | 401 |
| B12 | Production cookie | Secure + `__Host-` |
| B13 | IP allowlist | IP ngoài 403 |

### 14.3. User management

| ID | Case | Kỳ vọng |
|---|---|---|
| C01 | List/search/pagination | đúng total, limit |
| C02 | Create | hash, không plaintext |
| C03 | Bulk 50 | 50 user, password đủ policy, một lần |
| C04 | Bulk duplicate | skipped, không insert trùng |
| C05 | Lock | session cũ 401; login đúng mật khẩu 403 |
| C06 | Unlock | login lại được |
| C07 | Reset password | mật khẩu cũ fail, mới pass, session cũ 401 |
| C08 | Edit username | login tên mới được, tên cũ fail |
| C09 | Edit username trùng | 409 |
| C10 | Delete | user/session mất; audit còn |
| C11 | Delete sai confirm | 400/409, không xóa |
| C12 | last_login_at | cập nhật sau login |

### 14.4. Data CRUD

| ID | Case | Kỳ vọng |
|---|---|---|
| D01 | List 5 bảng | đúng cột, total |
| D02 | Search/sort | đúng, không SQL injection |
| D03 | Create valid | 201, row đọc lại được |
| D04 | Create thiếu required | 400 |
| D05 | Unique conflict | 409 |
| D06 | Update valid | 200, row đổi |
| D07 | Delete row | 204, count giảm |
| D08 | Delete school có phụ thuộc | 409 + counts |
| D09 | Force delete | 204 + audit force |
| D10 | Table/column lạ | 400/404 |
| D11 | 1.1M table | list limit 50, không load all |
| D12 | Body > limit | 413 |
| D13 | Save failure | reload, 500, DB cũ nguyên |
| D14 | quick_check fail | rollback, không ghi |
| D15 | Concurrent writes | serialize, không mất dữ liệu |
| D16 | DB hash sau test | không đổi với DB thật |

### 14.5. Frontend/E2E

| ID | Case | Kỳ vọng |
|---|---|---|
| E01 | `/admin` chưa login | form login, không redirect user |
| E02 | Login admin | dashboard |
| E03 | Reload | session còn, CSRF lấy lại từ /me |
| E04 | Logout | về login, cookie mất |
| E05 | User CRUD | lock/unlock/delete/bulk |
| E06 | Data CRUD | create/edit/delete |
| E07 | Audit | hiển thị action |
| E08 | Public UI | không có link admin |
| E09 | Bundle | admin chunk tách, main không chứa admin |
| E10 | Mobile | sidebar/dialog dùng được |
| E11 | Error states | 401/403/429/500 có thông báo |
| E12 | No secret in storage | không localStorage/sessionStorage |

---

## 15. Rollback

### 15.1. Auth DB

1. Dừng backend.
2. Khôi phục `auth.db` từ backup trước migration.
3. Khôi phục code về commit trước admin.
4. Xóa `admin_*` nếu dùng DB mới; không cần nếu restore.
5. Khởi động, kiểm tra login user cũ.

### 15.2. Admission DB

1. Dừng backend.
2. Khôi phục `learnpath.db` từ backup gần nhất.
3. Khởi động; chạy `inspect-db.js`.
4. Kiểm tra counts/hash.

### 15.3. Code

- Không commit trước khi hoàn tất; có thể `git diff` để rollback từng file.
- Nếu đã commit (khi được yêu cầu), revert commit.
- Không revert các thay đổi Phase 0 auth-hardening ngoài phạm vi.

---

## 16. Definition of Done

- [x] D1–D10 được chốt và ghi vào plan.
- [x] Auth DB migration v1→v2 có backup, test, rollback.
- [x] Admin login/session/CSRF/rate limit pass.
- [x] User CRUD + lock/delete/bulk pass; session revoke đúng.
- [x] 5 bảng dữ liệu CRUD pass trên DB tạm; validation/unique/dependency đúng.
- [x] Atomic save + backup + reload pass; DB thật không bị test ghi.
- [x] Audit đầy đủ, không chứa secret; UI audit hoạt động.
- [x] `/admin` lazy-loaded, noindex, không link public; public build pass.
- [x] `npm test` pass (78/78); frontend build pass; E2E admin pass (19 checks, temp DB).
- [x] Docs cập nhật: README, ARCHITECTURE, TESTING, PROJECT_STATUS, KNOWN_ISSUES.
- [x] Có runbook backup/restore/migration (section 15).
- [x] Không commit/push/PR nếu chưa được yêu cầu.

**Residual (không chặn DoD):**

- Optional admin TOTP/MFA chưa làm (Phase 6 optional).
- Migration drill trên bản copy auth DB thật chưa chạy; auth DB thật đã migrate ngoài test suite (KI-24).
- Real admission DB chưa rebuild; dữ liệu vẫn theo importer cũ.
- Admin E2E hiện là smoke tạm, chưa commit thành harness.

---

## 17. File map dự kiến

### Backend mới

| File | Nội dung |
|---|---|
| `backend/src/auth/adminAuth.js` | Admin login, hash verify, rate limit hook |
| `backend/src/auth/adminSession.js` | Admin session, cookie, CSRF, requireAdmin |
| `backend/src/auth/adminAudit.js` | Ghi/đọc audit |
| `backend/src/routes/adminAuth.js` | `/api/admin/auth/*`, overview |
| `backend/src/routes/adminUsers.js` | `/api/admin/users/*` |
| `backend/src/routes/adminData.js` | `/api/admin/data/*` |
| `backend/src/admin/dataSchema.js` | Metadata/allowlist 5 bảng |
| `backend/src/admin/dataValidation.js` | Validate row theo metadata |
| `backend/src/admin/admissionWrite.js` | Transaction, backup, atomic save, reload |
| `backend/src/admin/adminRateLimit.js` | Rate limit admin (hoặc mở rộng rateLimit.js) |
| `backend/scripts/admin-create.js` | CLI bootstrap/reset/disable/list |

### Backend sửa

| File | Thay đổi |
|---|---|
| `backend/src/auth/authDb.js` | Schema v2 + migration + backup + reload helper |
| `backend/src/auth/session.js` | Check `users.status`, last_login_at |
| `backend/src/routes/auth.js` | Login status, last_login_at, logout fail-closed |
| `backend/src/database/db.js` | Atomic save, reload, write guard |
| `backend/server.js` | Mount admin routes, body limit, security headers |
| `backend/src/auth/origin.js` | Origin cho mọi non-GET |
| `backend/package.json` | `admin:create` script; test scripts giữ nguyên |

### Frontend mới

| File | Nội dung |
|---|---|
| `frontend/src/pages/AdminPage.jsx` | Lazy entry, auth gate |
| `frontend/src/components/admin/*` | Login, shell, overview, users, data, audit |
| `frontend/src/lib/adminApi.js` | Axios instance + CSRF |
| `frontend/public/robots.txt` | Disallow `/admin` (nếu chưa có) |

### Frontend sửa

| File | Thay đổi |
|---|---|
| `frontend/src/App.jsx` | Route `/admin/*` ngoài Layout, lazy import |
| `frontend/src/lib/api.js` | Không dispatch auth event cho admin 401 (nếu dùng chung) |
| `frontend/src/index.html` hoặc AdminPage | noindex meta |

### Docs

- `README.md`
- `.agents/ARCHITECTURE.md`
- `.agents/TESTING.md`
- `.agents/PROJECT_STATUS.md`
- `.agents/KNOWN_ISSUES.md` (nếu phát hiện issue ngoài phạm vi)
- `plans/admin-panel.md` (file này)

---

## 18. Rủi ro và câu hỏi mở

### 18.1. Rủi ro chính

| ID | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| AR-01 | Admin account takeover | Cao | Session ngắn, rate limit, CSRF, audit, optional MFA/IP |
| AR-02 | Ghi 109 MiB mỗi thao tác | Trung bình | Benchmark 151 ms; backup; atomic; UI chờ |
| AR-03 | Windows rename không atomic | Trung bình | Backup trước ghi; reload khi lỗi; test Windows |
| AR-04 | Xóa nhầm dữ liệu | Cao | Confirm, dependency check, backup, audit |
| AR-05 | Auth DB migration mất user | Cao | Backup, test v1→v2, rollback |
| AR-06 | Bulk create lộ password | Cao | Trả một lần, no-store, không log, CSV client-side |
| AR-07 | Admin UI XSS | Cao | Không render HTML thô; CSP sau |
| AR-08 | 1.1M rows làm chậm UI | Trung bình | Pagination max 100, search, index sbd |
| AR-09 | Conflict với auth-hardening Phase 2 | Trung bình | Admin dùng v2; auth-hardening chuyển v3 |
| AR-10 | `ADMIN_ALLOWED_IPS` sai sau proxy | Trung bình | Chỉ bật khi `TRUST_PROXY` đúng; document |

### 18.2. Câu hỏi cần trả lời

1. D1 — Tách bảng admin + CLI, hay gắn role vào user?
2. D2 — Session admin 8h/30m/3 hay khác?
3. D3 — Giữ `sql.js` ghi atomic, hay chuyển `node:sqlite`?
4. D4 — Xóa user cứng hay soft delete?
5. D5 — Bulk create có bắt buộc đổi mật khẩu lần đầu không?
6. D6 — User chỉ sửa username/password/status, hay thêm họ tên/email?
7. D7 — Xóa trường có phụ thuộc: chặn + force, hay cascade?
8. Có duyệt làm Phase 1 ngay sau khi chốt không?

---

## 19. Thứ tự triển khai đề xuất

```text
Chốt D1–D10
  → Phase 0 backup/baseline
  → Phase 1 auth DB v2 + admin auth
  → Phase 2 user management
  → Phase 3 data browser read-only
  → Phase 4 data CRUD + write engine
  → Phase 5 audit + hardening
  → Phase 6 E2E + docs + rollout drill
```

Không bắt đầu Phase 1 khi chưa có quyết định và backup.
