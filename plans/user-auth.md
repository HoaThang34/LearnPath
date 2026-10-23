# Kế hoạch: Tài khoản người dùng, đăng ký và đăng nhập

> Trạng thái: **Đã triển khai và kiểm thử — chưa commit**
> Ngày: 2026-10-23
> Phạm vi: thêm tài khoản username/password, đăng ký (nhập mật khẩu 2 lần), đăng nhập,
> phiên đăng nhập, bảo vệ các trang/API tra cứu.
> Không commit, push hoặc mở PR.

## 1. Mục tiêu

1. Người dùng tạo được tài khoản bằng `username` + `password` + `passwordConfirm`.
2. Người dùng đăng nhập, đăng xuất và duy trì phiên qua cookie an toàn.
3. Các trang tra cứu (`/de-an`, `/diem-chuan`, `/khoi-thi`, `/thu-hang`) và API dữ liệu
   chỉ dùng được khi đã đăng nhập.
4. Trang chủ `/` vẫn công khai để giới thiệu sản phẩm; `/api/health` công khai để kiểm tra.
5. Không làm hỏng dữ liệu tuyển sinh hiện có, không ghi/rebuild DB chính.
6. Có kiểm thử backend, kiểm thử build frontend và kiểm tra bảo mật trước khi kết thúc.

## 2. Ngoài phạm vi (không làm trong lần này)

- Quên mật khẩu, đổi mật khẩu, xác thực email, OAuth/Google, MFA.
- Phân quyền admin/user, hồ sơ cá nhân, lịch sử tra cứu.
- Thanh toán, CAPTCHA, gửi email.
- Thay đổi schema hoặc dữ liệu của `backend/database/learnpath.db`.
- Commit, push, PR.

## 3. Quyết định kiến trúc

### 3.1. Kho lưu tài khoản riêng

Tạo **auth DB riêng** tại `backend/database/auth.db` (mặc định), dùng `sql.js` có sẵn:

- DB chính `learnpath.db` (~109 MiB) đang được load toàn bộ vào RAM và chỉ đọc khi chạy.
  Nếu thêm bảng user vào DB chính, mỗi lần đăng ký/đăng nhập sẽ phải export và ghi lại
  toàn bộ 109 MiB — rủi ro hỏng dữ liệu, chậm và không cần thiết.
- Auth DB chỉ chứa user/session, dung lượng rất nhỏ; có thể export/ghi atomically sau mỗi
  thay đổi mà không ảnh hưởng DB tuyển sinh.
- Auth DB nằm trong `backend/database/` nên đã được `.gitignore` bỏ qua bởi `*.db`.
- Có thể đổi đường dẫn bằng `LEARNPATH_AUTH_DB_PATH` để test cô lập.

Không thêm dependency npm mới. Dùng `crypto` có sẵn của Node cho hash và token.

### 3.2. Xác thực và phiên

- Mật khẩu hash bằng **scrypt** (Node built-in) với `N=32768, r=8, p=1`, salt ngẫu nhiên 16 byte, key 64 byte.
- Phiên là **server-side session**:
  - Cookie chỉ chứa token ngẫu nhiên 32 byte (base64url).
  - DB chỉ lưu SHA-256 của token, không lưu token gốc.
  - Token có thể bị thu hồi khi logout hoặc hết hạn.
- Cookie: `lp_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`,
  `Secure` khi `NODE_ENV=production`, thời hạn 7 ngày.
- Không dùng `localStorage`/`sessionStorage` để chứa token.

### 3.3. Bảo vệ API và giao diện

- `/api/health` và `/api/auth/*` công khai.
- Bốn nhóm API dữ liệu hiện có dùng middleware `requireAuth`:
  `/api/diem-chuan`, `/api/de-an`, `/api/khoi-thi`, `/api/diem-thi`.
- Trang chủ công khai; bốn trang tính năng được bọc bởi `ProtectedRoute`.
- Nếu chưa đăng nhập, chuyển tới `/dang-nhap` và quay lại trang ban đầu sau khi đăng nhập.
- Khi API dữ liệu trả `401` (phiên hết hạn), axios phát sự kiện để xoá user cục bộ và
  đưa người dùng về trang đăng nhập.

## 4. Mô hình mối đe doạ và biện pháp

| Mối đe doạ | Biện pháp |
|---|---|
| Lộ mật khẩu trong DB/log | Chỉ lưu scrypt hash + salt; không log body, không trả hash ra API |
| Brute force / credential stuffing | Rate limit theo IP + username và theo IP; scrypt có chi phí CPU |
| Dò tài khoản qua thông báo lỗi | Login luôn trả cùng một thông báo; vẫn chạy scrypt giả cho username không tồn tại |
| SQL injection | Toàn bộ truy vấn dùng prepared statement/bind parameter |
| Đánh cắp cookie qua XSS | Cookie `HttpOnly`; React auto-escape; không render input bằng HTML thô |
| CSRF | Cookie `SameSite=Lax`; kiểm tra `Origin` cho request POST; CORS allowlist |
| Session fixation | Token mới ngẫu nhiên sau mỗi lần đăng nhập/đăng ký |
| Token bị lộ trong DB | DB chỉ lưu SHA-256(token), không lưu token gốc |
| Logout nhưng token vẫn dùng được | Xoá session trong DB khi logout; cookie bị clear |
| Ghi đè DB tuyển sinh | Auth DB tách biệt; DB chính vẫn read-only |
| Payload quá lớn | `express.json({ limit: '10kb' })` |
| Lộ thông tin lỗi | Error handler trả thông báo chung, không trả stack trace |
| Cache dữ liệu nhạy cảm | `Cache-Control: no-store` cho `/api/auth/*` |
| Spam đăng ký | Rate limit đăng ký theo IP |
| Timing attack | So sánh hash bằng `timingSafeEqual`; dummy scrypt cho user không tồn tại |

## 5. Mô hình dữ liệu auth

File: `backend/database/auth.db` (mặc định), quản lý bởi `backend/src/auth/authDb.js`.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
PRAGMA user_version = 1;
```

- `created_at`/`expires_at`: Unix milliseconds.
- `username` giữ nguyên chữ hoa/thường để hiển thị; `username_lower` dùng để unique/login
  không phân biệt hoa thường.
- `password_hash` dạng: `scrypt$32768$8$1$<salt-base64url>$<hash-base64url>`.
- Nếu file auth DB đã tồn tại nhưng `PRAGMA user_version` khác `1`, server dừng với lỗi rõ
  ràng thay vì âm thầm ghi đè.
- Ghi file: ghi file tạm cùng thư mục rồi rename; có fallback copy nếu Windows từ chối
  rename. Tạo thư mục cha nếu chưa có. Thử `chmod 600` trên hệ điều hành hỗ trợ.

## 6. API contract

Base URL: `/api`. Response lỗi: `{ "error": "<thông báo tiếng Việt>" }`.
User trả về: `{ id, username, createdAt }` — không bao giờ có `password_hash`.

### 6.1. `POST /api/auth/register`

Body:

```json
{
  "username": "nguyenvana",
  "password": "MatKhau123",
  "passwordConfirm": "MatKhau123"
}
```

- `201`: `{ "data": { "user": { "id": 1, "username": "nguyenvana", "createdAt": "..." } } }`
- Tự động tạo phiên và set cookie sau khi đăng ký thành công.
- `400`: dữ liệu không hợp lệ, mật khẩu xác nhận không khớp.
- `409`: username đã tồn tại.
- `429`: quá nhiều yêu cầu đăng ký.

### 6.2. `POST /api/auth/login`

Body: `{ "username": "...", "password": "..." }`

- `200`: `{ "data": { "user": { ... } } }`, set cookie mới.
- `401`: `Tên đăng nhập hoặc mật khẩu không đúng.` (không phân biệt user không tồn tại
  và sai mật khẩu).
- `429`: quá nhiều lần thử.

### 6.3. `GET /api/auth/me`

- `200`: `{ "data": { "user": { ... } } }` nếu cookie hợp lệ.
- `401`: chưa đăng nhập / phiên hết hạn.

### 6.4. `POST /api/auth/logout`

- `204`: xoá session hiện tại (nếu có), clear cookie. Idempotent.

### 6.5. API dữ liệu hiện có

Giữ nguyên response/query params, nhưng thêm `401` khi chưa đăng nhập:

`GET /api/diem-chuan`, `/api/de-an`, `/api/khoi-thi`, `/api/diem-thi/...`

## 7. Validation

### Username

- Trim hai đầu.
- 3–32 ký tự.
- Chỉ gồm `A-Z`, `a-z`, `0-9`, `.`, `_`, `-`.
- Bắt đầu và kết thúc bằng chữ cái hoặc chữ số.
- Chuẩn hoá lowercase để kiểm tra trùng và đăng nhập.
- Không hỗ trợ username Unicode trong phiên bản này (tránh homograph/normalization).

### Password

- 8–128 ký tự.
- Có ít nhất một chữ cái và một chữ số (hỗ trợ chữ/số Unicode, không chỉ ASCII).
- Không trim mật khẩu; mật khẩu được dùng đúng như người dùng nhập.
- Bắt buộc `passwordConfirm` và phải khớp chính xác khi đăng ký.

### Login

- Không tiết lộ username có tồn tại hay không.
- Nếu thiếu dữ liệu cơ bản: `400`.
- Nếu sai: `401` với thông báo chung.

## 8. Kiểm soát bảo mật phía server

### 8.1. Rate limit

In-memory (đủ cho một instance; production nhiều instance cần Redis/DB sau này):

- Login: tối đa **5 lần sai** cho mỗi cặp `IP + username` trong 15 phút.
- Login: tối đa **30 lần sai** cho mỗi IP trong 15 phút.
- Register: tối đa **10 lần** cho mỗi IP trong 1 giờ.
- Trả `429` + `Retry-After`; dọn bucket hết hạn để tránh phình bộ nhớ.
- Rate limit được kiểm tra **trước** khi chạy scrypt.

### 8.2. CORS và Origin

- CORS allowlist qua `APP_ORIGIN` (mặc định `http://localhost:5173,http://127.0.0.1:5173`),
  bật `credentials: true`; không dùng `*` khi có cookie.
- Với POST `/api/auth/*`, nếu request có `Origin` thì Origin phải nằm trong allowlist;
  nếu không, trả `403`.
- Request không có `Origin` (curl/test/server-to-server) được phép; bảo vệ CSRF chính vẫn là
  `SameSite=Lax` + không dùng GET cho thao tác thay đổi dữ liệu.
- Production phải đặt `APP_ORIGIN` đúng domain HTTPS.

### 8.3. Header và cookie

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Cache-Control: no-store` cho auth API.
- Ẩn `X-Powered-By`.
- HSTS khi `NODE_ENV=production`.
- Cookie `Secure` khi production; production bắt buộc chạy sau HTTPS.

### 8.4. Proxy và IP

- Không bật `trust proxy` mặc định (tránh giả mạo `X-Forwarded-For`).
- Nếu chạy sau reverse proxy tin cậy, đặt `TRUST_PROXY=1` để rate limit dùng IP thật.

## 9. Thiết kế frontend

### Route

| Route | Quyền | Component |
|---|---|---|
| `/` | Công khai | `TrangChu` |
| `/dang-nhap` | Công khai | `AuthPage mode="login"` |
| `/dang-ky` | Công khai | `AuthPage mode="register"` |
| `/de-an` | Cần đăng nhập | `DeAnTuyenSinh` |
| `/diem-chuan` | Cần đăng nhập | `DiemChuan` |
| `/khoi-thi` | Cần đăng nhập | `KhoiThi` |
| `/thu-hang` | Cần đăng nhập | `ThuHang` |

### State

- `AuthContext`: `user`, `loading`, `login`, `register`, `logout`.
- Khi app mount: gọi `GET /api/auth/me`; 401 → coi như chưa đăng nhập.
- `register` và `login` tự động cập nhật `user`.
- `logout` gọi API rồi xoá `user`; lỗi mạng được hiển thị, không nuốt lỗi.
- Axios interceptor: 401 từ API dữ liệu → phát `auth:unauthorized`; AuthContext xoá user.
- Không dispatch sự kiện cho các URL `/auth/*` để tránh vòng lặp khi login sai.

### Giao diện

- Trang đăng nhập/đăng ký dùng Card, Input, Label, Button hiện có.
- Đăng ký có 3 trường: username, password, xác nhận mật khẩu.
- Có hiện/ẩn mật khẩu; `autoComplete` đúng chuẩn.
- Lỗi hiển thị bằng tiếng Việt, có `role="alert"`.
- Header hiển thị username + nút Đăng xuất khi đã đăng nhập; nút Đăng nhập/Đăng ký khi chưa.
- Mobile menu cũng có mục đăng nhập/đăng xuất.
- Trang chủ đổi CTA cho khách thành Đăng ký; người đã đăng nhập vẫn vào tính năng.

## 10. Danh sách file dự kiến

### Backend

- `backend/src/auth/authDb.js` — load/create/save auth DB, schema, helper query.
- `backend/src/auth/password.js` — scrypt hash/verify, dummy verify.
- `backend/src/auth/validation.js` — validate username/password.
- `backend/src/auth/rateLimit.js` — in-memory rate limiter.
- `backend/src/auth/session.js` — cookie parse/set/clear, create/delete session, `requireAuth`.
- `backend/src/routes/auth.js` — 4 auth endpoints + origin guard.
- `backend/server.js` — mount auth route, protect data routes, CORS/JSON/headers/error handler.
- `backend/package.json` — chỉ thêm script test nếu cần, không thêm dependency.

### Frontend

- `frontend/src/lib/api.js` — auth API functions, `withCredentials`, 401 interceptor.
- `frontend/src/context/AuthContext.jsx` — auth state/provider.
- `frontend/src/components/ProtectedRoute.jsx` — route guard.
- `frontend/src/pages/AuthPage.jsx` — login/register UI.
- `frontend/src/App.jsx` — routes + guard.
- `frontend/src/main.jsx` — mount `AuthProvider`.
- `frontend/src/components/Layout.jsx` — user controls/login/logout.
- `frontend/src/pages/TrangChu.jsx` — CTA cho khách.

### Tài liệu

- `plans/user-auth.md` — kế hoạch này.
- `.agents/ARCHITECTURE.md` — auth DB/API/middleware/env.
- `.agents/PROJECT_CONTEXT.md` — quick facts về tài khoản.
- `.agents/TESTING.md` — test auth.
- `.agents/KNOWN_ISSUES.md` — giới hạn đã biết.
- `.agents/PROJECT_STATUS.md` — lịch sử phiên làm việc.
- `README.md` — hướng dẫn đăng nhập/khởi động nếu cần.

## 11. Các bước triển khai và cổng kiểm thử

> Nguyên tắc: làm xong bước nào, dừng lại kiểm tra bước đó; chỉ sang bước tiếp theo khi
> tất cả kiểm tra đạt. Không sửa DB chính.

### Bước 1 — Auth persistence + password + validation

Việc làm:

- Tạo `authDb.js`, `password.js`, `validation.js`.
- Schema `users`, `sessions`; `PRAGMA user_version`.
- Hàm hash/verify scrypt; validate username/password.
- Ghi file atomically; hỗ trợ `LEARNPATH_AUTH_DB_PATH`.

Kiểm thử:

- Tạo auth DB tạm; kiểm tra file tồn tại, schema đúng, `user_version = 1`.
- Hash → verify đúng; sai mật khẩu → false; hash không chứa mật khẩu gốc.
- Username hợp lệ/không hợp lệ; password ngắn/không có số; confirm mismatch.
- Mở lại auth DB từ file; dữ liệu còn nguyên.
- Không tác động `learnpath.db` (kiểm tra kích thước/hash trước–sau).

### Bước 2 — Session + auth API + bảo vệ API dữ liệu

Việc làm:

- `session.js`: token, cookie, session DB, `requireAuth`.
- `routes/auth.js`: register/login/me/logout.
- `rateLimit.js`, origin guard.
- `server.js`: mount auth trước data routes; `requireAuth`; CORS allowlist; body limit;
  headers; error handler; `getAuthDb()` khi start.

Kiểm thử API (server riêng, auth DB tạm):

- `/api/health` 200 khi chưa đăng nhập.
- `/api/de-an` 401 khi chưa đăng nhập.
- Register thiếu confirm / confirm sai / password yếu → 400.
- Register hợp lệ → 201, có `Set-Cookie`, body không có hash.
- Register trùng username (khác hoa thường) → 409.
- `me` có cookie → 200 đúng user; không cookie → 401.
- API dữ liệu có cookie → 200; không cookie → 401.
- Login sai → 401 thông báo chung; đúng → 200; cookie mới.
- Logout → 204; cookie clear; session cũ không dùng lại được.
- Token giả/bị sửa → 401.
- Rate limit login: sau 5 lần sai, lần 6 → 429; đúng username/password sau đó vẫn bị chặn
  cho đến hết cửa sổ (kiểm tra `Retry-After`).
- Rate limit register: vượt 10/giờ → 429.
- Restart server với cùng auth DB → session còn hiệu lực (cookie cũ vẫn dùng được).
- CORS: Origin hợp lệ có header; Origin lạ bị chặn/không có CORS header.
- Payload > 10kb → 413; JSON hỏng → 400.
- Không có mật khẩu/hash trong log.

### Bước 3 — Frontend auth state + route guard

Việc làm:

- `api.js`: auth functions, `withCredentials`, interceptor 401.
- `AuthContext`, `ProtectedRoute`, mount provider.
- Chuyển 4 route tính năng sang protected.

Kiểm thử:

- `npm run build` pass.
- Kiểm tra tĩnh: không có token trong localStorage; `/auth/me` 401 không gây vòng lặp.
- Chưa đăng nhập vào `/de-an` → `/dang-nhap`, lưu `from`.
- Đã đăng nhập vào `/dang-nhap` → chuyển về trang đích.
- API 401 → user bị xoá và chuyển login.

### Bước 4 — Giao diện đăng nhập/đăng ký + header

Việc làm:

- `AuthPage` với 2 mode; validate client; hiện/ẩn mật khẩu; lỗi tiếng Việt.
- Header desktop/mobile: username, đăng xuất, đăng nhập/đăng ký.
- Home CTA cho khách.

Kiểm thử:

- `npm run build` pass.
- Đăng ký: confirm không khớp bị chặn; password yếu bị chặn; thành công → vào trang.
- Đăng nhập sai hiển thị lỗi; đúng → vào trang.
- Logout → về trang chủ, API dữ liệu trả 401 nếu truy cập lại.
- Mobile menu hiển thị đúng trạng thái.
- Không có mật khẩu trong URL, localStorage hay console.

### Bước 5 — Tài liệu + regression cuối

Việc làm:

- Cập nhật `.agents/*` và README.
- Chạy lại API smoke, auth smoke, frontend build.
- Kiểm tra DB chính không đổi; auth DB bị gitignore.

Kiểm thử:

- Backend syntax check tất cả file mới/sửa.
- API smoke với cookie; health public.
- `npm run build` frontend pass.
- `git status` xác nhận không có `auth.db` bị track; không commit.
- Checklist bảo mật: cookie flags, hash, rate limit, origin, 401, no-store, error handling.

## 12. Ma trận kiểm thử chính

| ID | Trường hợp | Kỳ vọng |
|---|---|---|
| A1 | Health không đăng nhập | 200 |
| A2 | Data API không đăng nhập | 401 |
| A3 | Register thiếu confirm | 400 |
| A4 | Register confirm sai | 400 |
| A5 | Register password yếu | 400 |
| A6 | Register hợp lệ | 201 + cookie |
| A7 | Register trùng khác hoa thường | 409 |
| A8 | Me có cookie | 200 |
| A9 | Me không cookie | 401 |
| A10 | Login sai | 401 chung |
| A11 | Login đúng | 200 + cookie |
| A12 | Logout | 204 + clear cookie |
| A13 | Dùng lại cookie sau logout | 401 |
| A14 | Token giả | 401 |
| A15 | Rate limit login | 429 + Retry-After |
| A16 | Rate limit register | 429 |
| A17 | Restart server, cookie cũ | 200 |
| A18 | JSON hỏng / payload lớn | 400 / 413 |
| A19 | Origin lạ | 403 (auth POST) |
| A20 | Frontend build | pass |
| A21 | Protected route chưa login | redirect login |
| A22 | Login xong quay lại `from` | đúng trang |
| A23 | DB chính trước/sau | không đổi |

## 13. Rollback

- Code: revert các file mới/sửa (không đụng DB chính).
- Auth data: xoá `backend/database/auth.db` nếu muốn xoá toàn bộ tài khoản; không ảnh hưởng
  dữ liệu tuyển sinh.
- Nếu cần tắt bảo vệ tạm thời: gỡ `requireAuth` khỏi 4 route dữ liệu trong `server.js`
  (chỉ khi có yêu cầu rõ ràng), sau đó restart.
- Không chạy `npm run db:init` trong rollback.

## 14. Rủi ro còn lại / giới hạn đã biết

- Rate limit lưu trong RAM: restart server sẽ reset; nhiều instance không chia sẻ.
- Đăng ký trùng username trả `409` nên có thể dùng để dò username đã tồn tại; đây là đánh đổi
  UX/validation, không dùng thông báo này cho login.
- Chưa có quên/đổi mật khẩu, email xác thực, MFA.
- Chưa có CAPTCHA; đăng ký vẫn có thể bị spam trong giới hạn rate limit.
- Auth DB là file cục bộ, chưa có backup/replication; cần backup định kỳ nếu triển khai thật.
- `SameSite=Lax` + origin check giảm CSRF nhưng không thay thế HTTPS và CSP.
- XSS trong bất kỳ trang nào vẫn có thể thực hiện request thay người dùng (cookie HttpOnly
  không đọc được nhưng request vẫn gửi được); cần giữ React escaping và không render HTML thô.
- Nếu chạy sau proxy, phải cấu hình `TRUST_PROXY` và `APP_ORIGIN` đúng.
- Nếu chạy production qua HTTP, cookie `Secure` sẽ không hoạt động — bắt buộc HTTPS.

## 15. Nhật ký rà soát kế hoạch (trước khi code)

Đã đọc lại từ đầu và sửa các điểm sau:

1. **Không dùng DB chính để lưu user** — tránh export 109 MiB mỗi lần ghi; chuyển sang auth DB
   riêng.
2. **Không dùng JWT stateless** — không thu hồi được khi logout; chuyển sang session server-side,
   DB chỉ lưu hash token.
3. **Không lưu token trong localStorage** — chuyển sang cookie HttpOnly.
4. **Chống dò username** — login dùng thông báo chung và dummy scrypt cho user không tồn tại.
5. **Chống brute force lan rộng** — thêm giới hạn theo IP ngoài giới hạn IP+username, kiểm tra
   trước scrypt.
6. **Chống CSRF** — thêm SameSite=Lax, kiểm tra Origin cho POST, CORS allowlist có credentials.
7. **Tránh vòng lặp 401** — interceptor bỏ qua `/auth/*`; route guard dùng `from` an toàn.
8. **Xác thực confirm ở server** — không chỉ kiểm tra ở client.
9. **Giới hạn tham số scrypt khi verify** — tránh hash bị sửa gây treo CPU.
10. **Giới hạn body** — `express.json({ limit: '10kb' })`, xử lý 400/413 rõ ràng.
11. **Không cache auth** — `Cache-Control: no-store`.
12. **Tách test khỏi dữ liệu thật** — dùng `LEARNPATH_AUTH_DB_PATH` trỏ file tạm.
13. **Không tin proxy mặc định** — chỉ bật `TRUST_PROXY=1` khi có proxy tin cậy.
14. **Ghi file an toàn** — file tạm + rename/fallback; tạo thư mục; kiểm tra version schema.
15. **Không thay đổi API contract cũ** — chỉ thêm 401 và giữ nguyên query/response của API dữ liệu.

## 16. Tiêu chí hoàn thành

- Đăng ký với username/password nhập hai lần hoạt động thực tế.
- Đăng nhập/đăng xuất hoạt động; phiên duy trì qua reload và restart server.
- Bốn trang tính năng và API dữ liệu yêu cầu đăng nhập.
- Các test A1–A23 đạt (trừ trường hợp môi trường không hỗ trợ, phải ghi rõ).
- Frontend build pass.
- DB chính không bị thay đổi; auth DB không bị commit.
- Báo cáo cuối có file thay đổi, lệnh đã chạy, kết quả thực tế, rủi ro còn lại.

## 17. Kết quả kiểm thử (2026-10-23)

- Auth DB tạm: schema/version đúng; hash `scrypt$32768$8$1`; validation đúng; mở lại file còn dữ liệu.
- API tích hợp: 29/29 pass (register/login/logout/me, 401, cookie, restart, rate limit, CORS/origin, JSON/body, không có mật khẩu plaintext).
- Browser E2E headless Chrome: 16 check pass (redirect, register confirm, cookie/storage, reload, logout, login sai/đúng, mobile, console, DB chính không đổi).
- Production cookie: `HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/`, `Max-Age=604800`; clear-cookie cùng flags.
- Frontend build: 2,642 modules; JS 1,009.03 kB (gzip 304.89 kB); CSS 27.51 kB (gzip 5.45 kB).
- `learnpath.db` giữ nguyên SHA-256; `auth.db` mặc định không được tạo; không commit/push/PR.
