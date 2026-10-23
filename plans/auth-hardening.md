# Kế hoạch hardening xác thực LearnPath

> Trạng thái: **Đã duyệt D1–D6; Phase 0 hoàn tất (test/CI/backup), chưa đổi runtime**
> Cập nhật 2026-10-23: admin panel đã dùng auth DB **schema v2**; baseline test hiện tại là **78/78**. Phase 2 của kế hoạch này phải là **schema v3**.
> Ngày lập: **2026-10-23**
> Baseline: commit `299495d`, working tree sạch
> Phạm vi: làm phần xác thực hiện có vững hơn; **không mở tính năng sản phẩm mới**
> Quy ước: không commit, push hoặc mở PR nếu người dùng không yêu cầu rõ ràng.

## 0. Cách đọc kế hoạch này

Kế hoạch được xây theo thứ tự:

1. **Baseline đã kiểm chứng** — hiện có gì, đang chạy thế nào.
2. **Threat model + risk register** — rủi ro nào đáng làm trước, vì sao.
3. **Phase có cổng kiểm thử** — làm xong phase nào phải qua test phase đó.
4. **Acceptance matrix + rollback** — biết thế nào là đạt và quay lui an toàn.
5. **Quyết định cần duyệt** — các thay đổi L3 (schema, auth behavior, dependency, deployment).

Nguyên tắc:

- **Không làm tất cả cùng lúc.** Mỗi phase là một đơn vị thay đổi có thể review, test và rollback.
- **Không đổi schema/API/auth behavior khi chưa được duyệt.** Đây là L3 theo `.agents/AI_RULES.md`.
- **Không thêm npm dependency** nếu chưa được duyệt. Ưu tiên Node built-in (`node:test`, `crypto`, `fetch`).
- **Không dùng DB tuyển sinh để thử.** Mọi test auth dùng auth DB tạm; DB chính chỉ đọc.
- **Không tuyên bố "an toàn tuyệt đối".** Mục tiêu là giảm rủi ro có kiểm chứng, không phải che rủi ro còn lại.

### Trạng thái hiện tại của auth DB

Tại thời điểm lập kế hoạch, `backend/database/auth.db` **đang tồn tại** (32 KiB, `user_version = 1`) và có dữ liệu tài khoản thật. Khác với ghi chú cũ trong `.agents/*` (auth DB từng absent sau test), vì vậy:

- **Không xóa, không ghi đè, không chạy test tài khoản vào file này.**
- Trước bất kỳ migration nào phải backup và thử migration trên bản copy.
- Nếu tài liệu `.agents/*` còn ghi "auth.db absent", cập nhật ở phase tài liệu, không sửa lẫn vào code.

> **Cập nhật 2026-10-23 — schema v2 đã bị admin panel dùng:** `plans/admin-panel.md` đã triển khai auth DB **schema v2** (`users` status/forced-change, `admins`, `admin_sessions`, `admin_audit`). Vì vậy **Phase 2 của kế hoạch này phải dùng schema v3**, không phải v2. Migration phải đi từ v2 → v3; nhánh v1 → v2 đã tồn tại trong `authDb.js`. Không đổi số version hoặc tái sử dụng v2 cho session lifecycle.
>
> **Baseline test hiện tại:** 78/78 (đã thêm admin tests), không còn là 49/49 như baseline lúc lập plan.

---

## 1. Kết luận điều hành

Auth hiện tại là một baseline tốt cho một ứng dụng một tiến trình: scrypt, session server-side, cookie HttpOnly, rate limit, CORS/Origin, security headers, API dữ liệu được bảo vệ. Tuy nhiên chưa thể gọi là "hoàn hảo" vì còn các nhóm thiếu hụt sau:

| Nhóm | Thiếu hụt chính | Mức |
|---|---|---|
| An toàn thay đổi | Trước Phase 0 không có test/CI; Phase 0 đã thêm 49 test + CI (còn data/API/E2E) | Trung bình |
| Session | Chỉ có absolute timeout 7 ngày; không idle timeout, không logout-all, không liệt kê/thu hồi session, không chính sách concurrent session | Cao |
| Cookie/CSRF | Cookie chưa dùng `__Host-`; kiểm tra Origin cho phép request không có Origin; chưa dùng `Sec-Fetch-Site` | Trung bình |
| XSS/CSP | Không có CSP; `rehype-raw` vẫn render HTML thô từ Markdown | Cao |
| Logging | Không có security audit log, request ID, cảnh báo brute force | Cao |
| Rate limit | Chỉ in-memory theo IP; chưa có giới hạn theo account; restart/multi-instance reset | Trung bình |
| Password | Tối thiểu 8 ký tự + bắt buộc chữ/số; chưa có blocklist; scrypt `N=32768` thấp hơn khuyến nghị OWASP `2^17`; chưa đổi mật khẩu | Cao |
| Recovery/MFA | Không có quên/đổi mật khẩu, email verification, MFA | Cao (tùy mức mục tiêu) |
| Auth DB | `sql.js` ghi cả file, không lock, không kiểm tra integrity, không backup/restore tự động; Windows fallback copy có thể không atomic | Cao |
| Deployment | Chưa có proxy/TLS/SPA fallback/CSP header/health readiness chuẩn production | Cao |
| Dependency | Có advisory trong `react-router` 6, `follow-redirects`, Vite/Tailwind dev | Trung bình |

**Đề xuất thứ tự:**

```text
Phase 0  Safety net: test + CI + backup + đo baseline
Phase 1  Critical fixes: redirect, logout, cookie, CSRF, CSP, headers, config, logging
Phase 2  Session lifecycle: schema v3, absolute timeout, logout-all, session list/revoke
Phase 3  Password lifecycle: change-password, policy, blocklist, scrypt rehash, rate limit
Phase 5  Auth DB durability: lock, atomic write, integrity, backup/restore, migration
Phase 6  Production readiness: TLS/proxy, CSP header, monitoring, incident runbook
Phase 4  Recovery + MFA (optional, sau khi duyệt D3/D4)
```

Phase 4 để sau vì nó phụ thuộc quyết định về email/SMTP và MFA; không nên chặn core hardening.

**Định nghĩa "đạt" cho core (0–3, 5–6):**

- Không còn rủi ro P0; P1 đóng hoặc có quyết định chấp nhận rõ ràng.
- ASVS 5.0 Level 1 cho auth/session đạt, trừ deviation D2 (composition) được ghi rõ; các mục Level 2 đã chọn (session termination, logging, password change) đạt, trừ idle timeout (D6) được ghi rõ.
- Test auth/API/DB chạy tự động trong CI; frontend build pass.
- Backup/restore auth DB đã diễn tập; migration thử trên bản copy; DB tuyển sinh không đổi hash.
- Production smoke pass: HTTPS, cookie flags, CSP, rate limit, health, log.
- Tài liệu `README.md`, `.agents/*` khớp hành vi mới.

---

## 2. Baseline đã kiểm chứng (2026-10-23)

### 2.1. Môi trường và dữ liệu

| Hạng mục | Giá trị |
|---|---|
| Commit | `299495d update agents & users` |
| Working tree | Sạch tại thời điểm lập plan |
| Node | `v24.20.0` |
| npm | `11.19.0` |
| Admission DB | `backend/database/learnpath.db`, ~109 MiB |
| Admission DB SHA-256 | `8D4F42B1F845C2E12DE875D2BBFDCBF0DF3CC7686DC285423189C80CF3559E4D` |
| Auth DB | `backend/database/auth.db`, 32 KiB, `user_version = 1`, có dữ liệu thật |
| Auth DB mặc định | **Không được dùng cho test** |
| CI | `.github` chưa tồn tại |
| Test committed | Không có |

### 2.2. Những gì đã có

| Thành phần | Hiện trạng | File |
|---|---|---|
| Password hash | scrypt `N=32768, r=8, p=1`, salt 16 byte, key 64 byte, format `scrypt$N$r$p$salt$hash` | `backend/src/auth/password.js` |
| Session | Token 32 byte base64url; DB lưu SHA-256; absolute TTL 7 ngày | `backend/src/auth/session.js` |
| Cookie | `lp_session`, HttpOnly, SameSite=Lax, Path=/, Secure khi production | `backend/src/auth/session.js` |
| Rate limit | Login 5 lần/IP+username, 30 lần/IP/15 phút; register 10 lần/IP/giờ; in-memory | `backend/src/auth/rateLimit.js` |
| Validation | Username 3–32 ASCII; password 8–128, bắt buộc chữ + số | `backend/src/auth/validation.js` |
| Auth DB | `sql.js`, schema v1, ghi temp + rename/copy, chmod 600 best effort | `backend/src/auth/authDb.js` |
| API | `POST /register`, `POST /login`, `GET /me`, `POST /logout` | `backend/src/routes/auth.js` |
| Bảo vệ dữ liệu | 4 nhóm API dữ liệu qua `requireAuth`; 4 route UI qua `ProtectedRoute` | `backend/server.js`, `frontend/src/App.jsx` |
| Headers | nosniff, frame DENY, referrer no-referrer, permissions policy, HSTS production | `backend/server.js` |
| CORS/Origin | Allowlist `APP_ORIGIN`; auth POST kiểm tra Origin nếu có | `backend/src/auth/origin.js` |
| Logout | Xóa session hiện tại, clear cookie, idempotent | `backend/src/routes/auth.js` |
| Frontend auth | `AuthContext`, `ProtectedRoute`, `AuthPage`, redirect-back | `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/AuthPage.jsx` |
| Build | Vite 5; JS ~1,009 kB (gzip ~305 kB), CSS ~27.5 kB | `frontend/package.json` |

### 2.3. Những gì còn thiếu hoặc yếu

- Trước Phase 0: không có test/CI committed (KI-12). Phase 0 đã bổ sung 7 file `node:test` (49 test) và CI; xem mục Phase 0.
- Session không có idle timeout, không có logout-all/session management, không rotate định kỳ (ASVS V7.3/V7.4).
- Cookie chưa dùng `__Host-` prefix; chưa có `Priority`.
- `requireTrustedOrigin` cho phép request không có `Origin`; chưa kiểm tra `Sec-Fetch-Site`.
- Không có CSP; `rehypeRaw` trong `frontend/src/pages/DeAnTuyenSinh.jsx`.
- Không có security audit log/request ID; error handler chỉ log `err.message`.
- Rate limit theo IP; chưa có giới hạn theo account; restart reset; multi-instance không chia sẻ.
- Password policy 8 ký tự + composition; chưa blocklist; scrypt `N=32768` dưới OWASP `2^17`.
- Không có đổi mật khẩu, quên mật khẩu, email verification, MFA.
- Auth DB không lock, không integrity check, không backup/restore; Windows fallback copy không atomic.
- Chưa có config validation cho production (`APP_ORIGIN`, HTTPS, `TRUST_PROXY`, `NODE_ENV`).
- Redirect-back trong `AuthPage` mới chặn `//`; chưa chặn backslash/absolute URL/control chars.
- Logout fail-open: nếu xóa session trong DB lỗi, route vẫn clear cookie và trả lỗi; session cũ có thể còn hiệu lực nếu token bị đánh cắp.
- `backend/server.js` không có graceful shutdown, health readiness thực sự.
- `frontend/vite.config.js` đặt `allowedHosts: true`; không nên dùng khi dev server có thể bị truy cập ngoài localhost.
- Không có `.env.example`, không có proxy/TLS/SPA fallback config.

### 2.4. Kết quả `npm audit` baseline

Chạy ngày 2026-10-23, không sửa dependency:

| Package | Severity | Ghi chú |
|---|---|---|
| `backend` — `csv-parse < 7.0.2` | Moderate | Chỉ dùng lúc import dữ liệu tin cậy; fix cần major 7.x |
| `frontend` — `react-router` / `react-router-dom < 7.18.0` | Moderate | Có advisory open redirect; ảnh hưởng trực tiếp luồng redirect-back |
| `frontend` — `follow-redirects 1.16.0` | High | Transitive qua axios; có fix không major |
| `frontend` — `vite <= 6.4.3` | High | Dev server Windows path/RCE advisories; không ảnh hưởng bundle production |
| `frontend` — `tailwindcss <= 3.4.19` | High | Transitive dev tooling; fix cần Tailwind 4 |
| `frontend` — `braces`, `micromatch`, `chokidar`, `fast-glob`, `postcss-*`, `source-map-js`, `esbuild` | High/Moderate | Chủ yếu dev/build chain |

Không có critical. Không được tự động chạy `npm audit fix --force` vì có thể kéo major upgrade. Phase 0 chỉ xử lý fix không phá vỡ; các major upgrade đưa vào quyết định D9.

---

## 3. Phạm vi, ngoài phạm vi, giả định

### 3.1. Trong phạm vi

- Auth API, session, cookie, CSRF, rate limit, password policy/hash, account lifecycle.
- CSP/security headers, XSS defense liên quan auth, audit logging.
- Auth DB durability, migration, backup/restore, single-instance guard.
- Test/CI cho auth và build frontend.
- Production deployment checklist cho auth (TLS, proxy, env, monitoring).
- Tài liệu vận hành/incident runbook.

### 3.2. Ngoài phạm vi

- Sửa dữ liệu tuyển sinh, ranking, school mapping, năm điểm (KI-02, KI-03, KI-15...).
- Thiết kế lại UI, thêm trang sản phẩm mới, OAuth/Google, admin roles, thanh toán.
- CAPTCHA, WebAuthn/passkeys, SMS OTP (có thể là phase sau nếu user chọn).
- Chống DDoS tầng mạng, bảo vệ host, mã hóa ổ đĩa, tuân thủ pháp lý đầy đủ.
- Thay `sql.js` bằng database khác nếu chưa có quyết định multi-instance.
- Commit/push/PR.

### 3.3. Giả định

- Production chạy sau HTTPS/reverse proxy tin cậy; `APP_ORIGIN` là origin thật.
- Hiện tại một backend process; chưa cần horizontal scaling.
- Markdown đề án là dữ liệu tin cậy, không do người dùng nhập; nhưng vẫn giảm bề mặt XSS.
- Không có email/SMTP/MFA trong baseline.
- Node 24.20; có thể dùng `node:test`, `fetch`, `crypto` built-in.
- Không thêm dependency npm nếu chưa duyệt.
- Người vận hành có thể chạy PowerShell trên Windows và/hoặc Linux trên server.

---

## 4. Chuẩn tham chiếu và mức mục tiêu

### 4.1. Chuẩn

- **OWASP ASVS 5.0** (2025): V1 Encoding/Sanitization, V2 Validation, V6 Authentication, V7 Session Management, V8 Authorization, V11 Cryptography, V13 API, V16 Security Logging.
- **NIST SP 800-63B-4** (2025): password verifiers, blocklist, rate limiting, reauthentication/session timeouts.
- **OWASP Cheat Sheets**: Password Storage, Session Management, Forgot Password, Authentication, Logging, Content Security Policy, CSRF Prevention.
- **SQLite**: WAL/atomic commit, integrity check; **Node.js**: `node:sqlite` documentation (chỉ để đánh giá tương lai).

### 4.2. Mức mục tiêu

Đã chốt ngày 2026-10-23:

- **D1 — ASVS 5.0 Level 1 (chấp nhận deviation D2) + L2 chọn lọc; NIST AAL1.** Giữ phạm vi auth/session, không mở rộng sang tính năng sản phẩm.
- **D2 — Giữ tối thiểu 8 ký tự, bắt buộc ít nhất 1 chữ và 1 số.** ASVS 6.2.1 L1 đạt (≥8), nhưng **6.2.5 L1 không đạt** vì có composition; NIST 800-63B-4 khuyến nghị 15 ký tự cũng không đạt. Đây là deviation được chấp nhận; bù bằng blocklist top 10k (6.2.4 L1), change-password (6.2.2/6.2.3), rate limit, scrypt và optional MFA. Muốn đạt L1 đầy đủ phải bỏ composition trước Phase 3.
- **D3 — Recovery codes** (không cần email/SMTP). Token/mã dùng một lần, lưu hash, TTL ngắn; đáp ứng hướng V6.4.3 L2 nếu làm đúng.
- **D4 — TOTP tùy chọn sau core.** Không tuyên bố L2 đầy đủ; L2 yêu cầu MFA (V6.3.3) vẫn là khoảng trống có chủ đích.
- **D5 — Một process + lock.** Giữ `sql.js`; không chuyển shared DB/Redis trong giai đoạn này.
- **D6 — Không idle timeout; absolute 7 ngày; tối đa 5 session.** ASVS 7.3.1 là L2; đây là deviation so với selected L2, nhưng NIST AAL1 không bắt buộc inactivity timeout. Bù bằng absolute 7 ngày, logout-all/revoke (7.4.x), cookie flags; ghi justification theo 7.1.1.

### 4.3. Mapping rủi ro → kiểm soát → chuẩn

| Rủi ro | Kiểm soát đích | Chuẩn |
|---|---|---|
| Credential stuffing / brute force | Rate limit theo IP + pair + per-account backoff; blocklist; logging; optional MFA | ASVS V6.1.1, V6.3.1, NIST 5.2 |
| Password yếu / bị lộ | D2: min 8 + composition (deviation 6.2.5), max 128, blocklist top 10k, context words | ASVS V6.2.1–6.2.4, NIST 3.1.1.2 |
| Session theft | HttpOnly, Secure, SameSite, `__Host-`, absolute timeout (idle tắt theo D6), rotation, revoke all | ASVS V7.2–V7.4 |
| XSS | CSP, remove raw HTML, React escaping, no token in JS | ASVS V1, V7.5 |
| CSRF | SameSite=Lax, Origin + Sec-Fetch-Site, CORS allowlist | ASVS V7.5 |
| Enumeration | Generic login; registration decision; rate limit | ASVS V6.3.8 (L3) |
| Auth DB loss/corruption | Lock, atomic write, integrity check, backup/restore, migration | ASVS V11, ops |
| Misconfiguration | Startup validation, production checklist, health readiness | ASVS V13/V14 |
| No audit trail | Structured security logs, request ID, retention | ASVS V16 |
| Recovery abuse | Single-use hashed tokens, short TTL, generic response, revoke sessions | ASVS V6.4, OWASP Forgot Password |
| MFA fatigue/phishing | TOTP rate limit; WebAuthn future | ASVS V6.5 |

---

## 5. Threat model tóm tắt

### 5.1. Tài sản

- Mật khẩu (chỉ hash), session token (chỉ hash trong DB), auth DB.
- Quyền truy cập 4 trang/API dữ liệu tuyển sinh.
- Uy tín người dùng và tính sẵn sàng của dịch vụ.
- Log/audit trail và backup auth DB.

### 5.2. Tác nhân

- Anonymous internet: dò username, brute force, credential stuffing, spam đăng ký.
- Attacker có XSS: lợi dụng phiên đã đăng nhập để gọi API/đọc dữ liệu.
- Attacker có token bị lộ: replay session.
- Malicious/compromised dependency hoặc build chain.
- Operator lỗi cấu hình (HTTP, sai `APP_ORIGIN`, sai quyền file, chạy nhiều process).
- Người dùng chung thiết bị/quên logout.
- Kẻ tấn công có quyền truy cập file auth DB/backup.

### 5.3. Ranh giới tin cậy

```text
Browser
  │ HTTPS + cookie
  ▼
Reverse proxy / TLS  ──►  Express API  ──►  auth.db (sql.js)
  │                         │
  │                         └──► admission DB (read-only, RAM)
  └── static SPA (CSP/headers)
```

- Browser là untrusted; mọi input phải validate server-side.
- Admission DB là trusted/read-only; auth DB là trusted nhưng phải bảo vệ file/backup.
- Build pipeline và npm registry là chuỗi cung ứng cần kiểm soát.
- Nếu thêm email: nhà cung cấp email là ranh giới ngoài, không tin cậy hoàn toàn.

### 5.4. Kịch bản tấn công chính

| Kịch bản | Đường tấn công | Kiểm soát |
|---|---|---|
| Credential stuffing | Login hàng loạt bằng combo lộ | Rate limit account/IP, blocklist, logging, optional MFA |
| Password spraying | Thử vài mật khẩu phổ biến trên nhiều account | Per-account limit, generic error, delay, alert |
| Session hijack | XSS/steal cookie | HttpOnly, CSP, no raw HTML, absolute timeout, revoke all (idle tắt theo D6) |
| CSRF | Form POST từ origin lạ | SameSite=Lax, Origin + Sec-Fetch-Site |
| Session fixation | Dùng token cũ trước login | Token mới mỗi lần login; rotate sau đổi mật khẩu |
| Enumeration | 409 register / timing | Generic login; decision D7; rate limit |
| Auth DB corruption | 2 process ghi, crash khi ghi | Lock, atomic write, integrity, backup |
| Dependency compromise | Package độc hại/CVE | Audit, pin, CI, review upgrade |
| Misconfig production | HTTP, `APP_ORIGIN` localhost, proxy sai | Startup validation, checklist, smoke |
| Shared device | Cookie còn sau khi rời máy | Absolute timeout, logout-all, no-store, session list |
| Recovery abuse | Token reset bị dò/replay | Token ngẫu nhiên, hash, single-use, TTL ngắn, rate limit |
| MFA fatigue | Spam OTP/push | TOTP rate limit; không dùng push; khóa tạm thời |

---

## 6. Risk register

> P0 = mất dữ liệu/lỗ hổng nghiêm trọng; P1 = rủi ro bảo mật/vận hành đáng kể; P2 = phòng thủ chiều sâu/UX/edge case.
> Trạng thái ban đầu: tất cả **Open**.

| ID | P | Rủi ro | Bằng chứng hiện tại | Đích khắc phục | Phase |
|---|---|---|---|---|---|
| R-01 | P0 | Auth DB có thể hỏng/mất tài khoản do 2 process ghi, crash khi export, Windows fallback copy không atomic; không backup/integrity | `authDb.js` ghi cả file; không lock; không `PRAGMA integrity_check`; không backup | Lock file, fsync + atomic replace, integrity check, backup/restore, migration có backup | 0, 5 |
| R-02 | P1 | Không có test/CI; regression auth không được phát hiện | Trước Phase 0: không có `.github`, `npm test`, test committed (KI-12) | Đã giảm: `node:test` + CI + test matrix; còn data/API/import/E2E | 0 |
| R-03 | P1 | Session chỉ absolute 7 ngày; không logout-all, session list/revoke, concurrent policy; D6 chấp nhận không idle | `session.js` chỉ có `expires_at`; không bảng/API session management | Schema v3 + absolute (D6 no idle) + revoke/list/all | 2 |
| R-04 | P1 | Logout fail-open: DB delete lỗi nhưng cookie vẫn clear; token cũ có thể còn hiệu lực | `routes/auth.js` catch → clear cookie → next(error) | Chỉ clear cookie sau khi DB delete thành công; trả lỗi rõ; test inject failure | 1 |
| R-05 | P1 | XSS có thể lợi dụng phiên; không CSP; `rehype-raw` render HTML thô | `server.js` không CSP; `DeAnTuyenSinh.jsx` dùng `rehypeRaw` | CSP production, remove `rehype-raw`, test render; sanitize nếu cần HTML | 1 |
| R-06 | P1 | Không có audit log/request ID; không phát hiện brute force/session abuse | `console.error('Error:', err.message)`; không log auth events | JSON security logs, request ID, redaction, alert thresholds | 1 |
| R-07 | P1 | Rate limit chỉ in-memory theo IP; không per-account; restart/multi-instance bypass; dễ bị credential stuffing phân tán hoặc bị lợi dụng để khóa account | `rateLimit.js` Map; constants; không per-account | Per-account progressive backoff (không hard-lock), per-IP/pair hard limit, scrypt semaphore + bounded queue, edge rate limit + alert; document single-process | 3, 5 |
| R-08 | P1 | Password policy/hash dưới chuẩn; không đổi mật khẩu | 8 ký tự + chữ/số; scrypt N=32768; không endpoint change | D2 min 8 + composition (deviation), blocklist, rehash N=2^17, change-password | 3 |
| R-09 | P1 | Không có recovery/MFA | Không endpoint reset/email/MFA | Phase 4 theo quyết định D3/D4 | 4 |
| R-10 | P1 | Redirect-back có thể bị lợi dụng (backslash/absolute URL); react-router 6 có advisory open redirect | `AuthPage.jsx` chỉ chặn `//` | Allowlist route + reject `\`, control chars, absolute URL; test | 1 |
| R-11 | P2 | Thiếu config validation production; dễ chạy HTTP/sai origin/sai proxy | `server.js` đọc env rải rác; không validate | `config.js` fail-fast; production checklist | 1, 6 |
| R-12 | P2 | Dependency có advisory; major upgrade tiềm ẩn regression | `npm audit` backend 1 moderate, frontend 13 | Patch non-breaking; major upgrade có kế hoạch riêng | 0, 6 |
| R-13 | P2 | Register trả 409 => enumeration | `routes/auth.js` duplicate 409 | Giữ 409 + rate limit, hoặc generic 202 nếu có email (D7) | 3 |
| R-14 | P2 | CSRF defense còn phụ thuộc Origin có thể vắng | `origin.js` cho phép no-Origin | Thêm `Sec-Fetch-Site`; yêu cầu Origin cho browser POST; test | 1 |
| R-15 | P2 | Dữ liệu auth/API có thể bị cache trên thiết bị chung | Auth có no-store; data API không có | `Cache-Control: private, no-store` cho auth + protected API | 1 |
| R-16 | P3 | Quyền file/backup trên Windows chưa được siết; backup có thể chứa hash | chmod best effort; không backup | ACL docs/script; backup restricted/encrypted nếu có thể | 5, 6 |

---

## 7. Kế hoạch theo phase

### Phase 0 — Safety net: test, CI, backup, baseline

**Mục tiêu:** có lưới an toàn trước khi sửa auth; không thay đổi hành vi runtime.

**Việc làm:**

1. **Backup auth DB hiện tại** ra ngoài repo:
   ```powershell
   $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
   $backup = Join-Path $env:TEMP "learnpath-auth-baseline-$stamp.db"
   Copy-Item backend/database/auth.db $backup
   Get-FileHash $backup -Algorithm SHA256
   ```
   Ghi lại hash, kích thước, `user_version`, số users/sessions (không log username).
2. **Baseline snapshot**: API contract hiện tại, cookie flags, schema v1, `npm audit` output, frontend build size.
3. **Test backend bằng `node:test`** (không thêm dependency) — đã tạo:
   - `backend/test/unit/password.test.js`: hash/verify, sai mật khẩu, hash format, parse limit, dummy verify.
   - `backend/test/unit/validation.test.js`: username/password/confirm, Unicode, max length, policy hiện tại 8 + chữ/số.
   - `backend/test/unit/origin.test.js`: allowlist, `APP_ORIGIN`, no-Origin, non-POST.
   - `backend/test/unit/rateLimit.test.js`: pair/IP/register limits, clear pair, Retry-After, `getClientIp`.
   - `backend/test/unit/session.test.js`: cookie parsing/token bounds.
   - `backend/test/integration/auth.test.js`: mount auth router trong một Express app tối giản, auth DB tạm; test register/login/me/logout, 400/401/403/409/413/429, cookie flags, no-store, không lộ hash/token, hash/DB persistence.
   - `backend/test/db/authDb.test.js`: create/open/save, schema v1, path guard, version mismatch, incomplete schema, temp-file cleanup.
   - Session restart/fixation integration tests để Phase 2 vì cần thay đổi session lifecycle.
   - Test dùng `LEARNPATH_AUTH_DB_PATH` trỏ file tạm; mỗi test file một process/DB riêng; dọn file sau test.
   - Không cần admission DB cho integration auth: dùng app tối giản; test startup/admission riêng nếu có DB.
4. **Test frontend tối thiểu**:
   - `npm run build` trong CI.
   - Tách hàm `getRedirectTarget`/`sanitizeRedirect` thành module thuần (không JSX) để test bằng `node:test` nếu muốn; hoặc để Phase 1 test qua browser.
   - Chưa thêm Vitest/Playwright nếu chưa duyệt D10.
5. **CI** `.github/workflows/ci.yml`:
   - Trigger push/PR; `permissions: contents: read`; `concurrency`; timeout 15 phút.
   - Job backend: Node 24, `npm ci`, `npm test`, `node --check` cho file server/config (nếu có script).
   - Job frontend: Node 24, `npm ci`, `npm run build`.
   - Job audit: `npm audit --omit=dev` backend/frontend; ban đầu `continue-on-error: true` nếu còn advisory chưa xử lý, nhưng phải có output + TODO; sau Phase 6 chuyển thành gate.
6. **Dependency patch không phá vỡ**:
   - Đã chạy `npm audit fix` (không `--force`) trong `frontend`: `follow-redirects` 1.16.0 → 1.16.1, `source-map-js` 1.2.1 → 1.2.2, `postcss-selector-parser` 6.1.4 → 6.1.5. Build pass.
   - Không nâng `react-router-dom` 7/Vite 8/Tailwind 4/csv-parse 7 ở phase này; các advisory còn lại thuộc D9/Phase 6.
7. **`npm test` scripts**:
   - `backend/package.json`: `"test": "node --test \"test/**/*.test.js\""` (quoted glob để tương thích Windows), `"test:unit"`, `"test:integration"`, `"test:db"`.
   - `frontend/package.json`: giữ `build`; CI chạy build.

**Kiểm thử/exit gate:**

- `cd backend && npm test` pass 100% (Phase 0: 49/49).
- `cd frontend && npm run build` pass.
- CI workflow đã tạo; chưa chạy trên GitHub vì chưa push, đã chạy local tương đương.
- Auth DB baseline backup tồn tại, hash ghi lại; `backend/database/auth.db` không bị sửa.
- Admission DB hash trước/sau bằng nhau.
- Không có test account nào ghi vào auth DB thật.

**Kết quả Phase 0 (2026-10-23):**

- Backup: `%TEMP%\learnpath-auth-baseline-20261023-194414.db`, 32 KiB, SHA-256 `C03256E42C9BA933A4EE9AA024AB19E859DE372BF0738DEBD344C5C42319756F`; `user_version=1`, 1 user, 1 session.
- `backend/database/auth.db` hash trước/sau: không đổi (`C03256E4...19756F`).
- Admission DB hash trước/sau: `8D4F42B1...59E4D`, không đổi.
- Backend: 49/49 test pass; 7 file test; không để lại file tạm.
- Frontend: build pass; JS 1,009.01 kB (gzip 304.88 kB), CSS 27.51 kB (gzip 5.45 kB).
- Dependency: audit fix không breaking; frontend còn 11 advisory (5 moderate, 6 high), backend còn 1 moderate `csv-parse`; không có critical.
- Chưa commit/push/PR.

**Rollback:** xóa `backend/test`, `.github`, script test; không ảnh hưởng runtime. Backup giữ nguyên.

**Ước lượng:** S–M (0.5–1.5 ngày).

---

### Phase 1 — Critical fixes và browser hardening

**Mục tiêu:** đóng các lỗi/thiếu hụt có thể khai thác hoặc gây mất an toàn ngay, với thay đổi nhỏ, dễ rollback.

#### 1.1. Safe redirect

- Tạo `frontend/src/lib/redirect.js`:
  ```js
  const ALLOWED_PREFIXES = ['/', '/de-an', '/diem-chuan', '/khoi-thi', '/thu-hang', '/tai-khoan'];
  export function sanitizeRedirect(value, fallback = '/') { ... }
  ```
- Quy tắc:
  - Chỉ nhận path nội bộ bắt đầu bằng `/`, không bắt đầu `//`.
  - Reject `\`, `%5c`, `%2f%2f`, control chars, `:` trước `/`, absolute URL.
  - Parse bằng `new URL(path, window.location.origin)`; chỉ chấp nhận nếu `origin` trùng.
  - Chỉ cho các route thuộc allowlist (hoặc ít nhất reject auth routes).
- Dùng trong `AuthPage` và bất kỳ `navigate(from)` nào.
- Test unit: `//evil.com`, `/\evil.com`, `https://evil.com`, `/de-an?x=1`, `/dang-nhap`.

#### 1.2. Logout fail-closed

- `destroySession` trả về kết quả; route chỉ `clearSessionCookie` sau khi DB delete + save thành công.
- Nếu save lỗi: giữ cookie, trả `503` (hoặc `500`) với thông báo "Không thể đăng xuất, vui lòng thử lại."; log `auth.logout.failure`.
- Test: mock `saveAuthDb` throw; kiểm tra cookie không bị clear và session vẫn còn; sau đó retry thành công.

#### 1.3. Session cleanup

- Gọi `deleteExpiredSessions()` lúc startup và theo interval (ví dụ mỗi giờ, `.unref()`), không chạy mỗi request.
- Thêm index `sessions(expires_at)` đã có; đảm bảo cleanup không block event loop lâu (bảng nhỏ).
- Test: tạo session hết hạn, chạy cleanup, kiểm tra bị xóa; không ảnh hưởng session còn hạn.

#### 1.4. Cookie hardening

- Production dùng tên `__Host-lp_session`; development/test giữ `lp_session`.
- `__Host-` yêu cầu `Secure`, `Path=/`, không `Domain`; kiểm tra Express set đúng.
- Đọc cả hai tên trong giai đoạn chuyển tiếp; clear cả hai.
- Thêm `priority: 'high'` nếu Express hỗ trợ; không thêm `Domain`.
- Test production header: `Set-Cookie: __Host-lp_session=...; Path=/; Secure; HttpOnly; SameSite=Lax`.
- Ghi chú: đổi tên cookie là thay đổi auth behavior (L3) — cần duyệt trước khi làm.

#### 1.5. CSRF/Sec-Fetch-Site

- Với auth POST:
  - Nếu có `Origin`: phải nằm trong allowlist (hiện có).
  - Nếu có `Sec-Fetch-Site`: chỉ cho `same-origin`, `same-site` (nếu subdomain tin cậy), `none`; reject `cross-site`.
  - Nếu không có cả hai: chỉ cho phép khi request không phải browser (không có `Sec-Fetch-*` và không có cookie?) — cần cân nhắc. Đề xuất: vẫn cho phép no-Origin/no-Sec-Fetch để không phá CLI/test, nhưng log; CSRF thực tế được chặn bởi SameSite + browser luôn gửi Sec-Fetch-Site.
- Thêm `Vary: Origin`.
- Test: `Origin` lạ → 403; `Sec-Fetch-Site: cross-site` → 403; same-origin → pass.

#### 1.6. Security headers và CSP

- API middleware thêm:
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - `X-Permitted-Cross-Domain-Policies: none`
  - `Cache-Control: no-store` cho `/api/auth/*` (đã có) và protected data API (cân nhắc; xem 1.8).
- Frontend production CSP (đặt ở reverse proxy, không phải meta):
  ```text
  default-src 'self';
  script-src 'self';
  style-src-elem 'self';
  style-src-attr 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self';
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests
  ```
  - `style-src-attr 'unsafe-inline'` cần cho vài inline style hiện có (ví dụ màu legend ở `ThuHang.jsx`). Không dùng `unsafe-inline`/`unsafe-eval` cho `script-src`.
  - Nếu Recharts/Tailwind phát sinh style tag, tạm dùng `style-src 'self' 'unsafe-inline'` và ghi TODO; không nới `script-src`.
  - Trước khi enforce, chạy `Content-Security-Policy-Report-Only` ở staging, kiểm tra console không có violation.
- Bỏ `rehypeRaw` khỏi `DeAnTuyenSinh.jsx` sau khi xác nhận 307 file Markdown không có HTML tag. Nếu cần HTML:
  - Dùng `rehype-sanitize` với allowlist (thêm dependency → cần duyệt), hoặc
  - Sanitize lúc import (server-side) và vẫn giữ CSP.
- Test: render 1 đề án có bảng/heading; không có HTML thô; CSP không violation; `script-src` không inline.
- `frontend/vite.config.js`: đổi `allowedHosts: true` thành danh sách cụ thể (`localhost`, `127.0.0.1`) hoặc bỏ; không expose dev server.

#### 1.7. Config validation

- Tạo `backend/src/config.js` (hoặc `src/config/index.js`) đọc/validate một lần:
  - `NODE_ENV`: development/test/production.
  - `PORT`: integer 1–65535 (cho phép 0 trong test).
  - `APP_ORIGIN`: danh sách URL; trim; normalize qua `new URL().origin`; production bắt buộc `https:`, không localhost, không `*`, không path/query.
  - `TRUST_PROXY`: chỉ `0`/`1`; production chỉ bật khi có proxy.
  - `LEARNPATH_AUTH_DB_PATH` ≠ `LEARNPATH_DB_PATH` (giữ guard hiện có, mở rộng case-insensitive).
  - `SESSION_ABSOLUTE_TTL_MS`, `AUTH_MAX_SESSIONS` (giá trị mặc định; validate absolute ≤ 30 ngày, max sessions 1–20).
  - `AUTH_SECRET` (nếu Phase 4 dùng MFA/HMAC log): production bắt buộc ≥32 byte base64; không commit.
  - `LOG_LEVEL`.
- Fail-fast với thông báo rõ, không log secret.
- Test: production + `APP_ORIGIN=http://localhost:5173` → startup fail; `TRUST_PROXY=abc` → fail; thiếu `APP_ORIGIN` production → fail.

#### 1.8. Logging và request ID

- Middleware tạo `req.id = crypto.randomUUID()`, trả `X-Request-Id`.
- Logger JSON lines ra stdout (không thêm dependency):
  ```json
  {"ts":"...Z","level":"info","event":"auth.login.failure","requestId":"...","userId":null,"usernameHash":"...","ipHash":"...","outcome":"failure","reason":"bad_credentials"}
  ```
- Không log: password, passwordConfirm, cookie, Authorization, token, full IP (hash bằng HMAC-SHA256 với `AUTH_SECRET` nếu có; nếu chưa có, dùng salted hash ephemeral và ghi rõ).
- Event tối thiểu:
  - `auth.register.success/failure`
  - `auth.login.success/failure`
  - `auth.logout.success/failure`
  - `auth.rate_limit`
  - `auth.origin_rejected`
  - `auth.session.created/revoked/expired`
  - `auth.password.changed` (Phase 3)
  - `auth.db.write_error`
  - `auth.config.invalid`
- Alert threshold (document, chưa cần SIEM): >20 login failures/phút toàn hệ thống; >5 429/phút; >3 DB write errors/5 phút; 401 tăng bất thường.
- Test: log không chứa password/token; request ID có trong response/error log.

#### 1.9. Health readiness

- `/api/health` trả thêm `checks: { authDb: 'ok', admissionDb: 'ok' }` (additive), chỉ `ok` khi query được cả hai; vẫn public, no-store.
- Không trả version/commit nếu không cần.
- Test: DB lỗi → 503 với `{status:'error'}`; bình thường → 200.

#### 1.10. Cache control

- Auth API: `no-store` (đã có).
- Protected data API: `Cache-Control: private, no-store` để tránh cache trên thiết bị chung; chấp nhận đánh đổi performance (dữ liệu tĩnh, có thể bật lại nếu cần).
- Static assets: hash + immutable (do proxy/Vite config, phase 6).

**Exit gate Phase 1:**

- Test mới pass; frontend build pass.
- Safe redirect test đủ case.
- Logout failure test pass.
- Production cookie flags + `__Host-` đúng.
- CSP Report-Only không violation trên 4 trang; sau đó enforce.
- `npm audit` không tăng severity; ghi lại exception.
- Admission DB hash unchanged.

**Rollback:** tắt CSP (report-only), trả cookie name cũ, revert `rehype-raw` nếu phát hiện Markdown cần HTML, revert config validation nếu quá chặt. Không đụng DB.

**Ước lượng:** M (1–2 ngày).

---

### Phase 2 — Session lifecycle (schema v3)

> **Bắt buộc:** schema v2 đã được admin panel dùng (`admins`, `admin_sessions`, `admin_audit`, cột user mới). Phase này phải là **v3**, migration từ v2 → v3. Không sửa migration v1 → v2 hiện có.

**Mục tiêu:** đáp ứng ASVS V7.3/V7.4 và giảm rủi ro session bị chiếm dụng.

#### 2.1. Schema v3

Migration trong `authDb.js` (hoặc `migrations/003-session-lifecycle.js`):

```sql
ALTER TABLE sessions ADD COLUMN public_id TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER;
UPDATE sessions
   SET public_id = lower(hex(randomblob(16))),
       last_seen_at = created_at
 WHERE public_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_public_id ON sessions(public_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at);

ALTER TABLE users ADD COLUMN password_changed_at INTEGER;
PRAGMA user_version = 3;
```

- Nếu muốn `public_id NOT NULL`, rebuild bảng trong transaction; nhưng `ALTER` + unique index đủ cho app.
- Backup trước migration; chạy migration trên bản copy trước; test v2→v3 giữ nguyên user/session/admin.
- Không đổi `token_hash` PK.
- Không tái sử dụng số 2; `SCHEMA_VERSION` hiện tại là 2 và phải tăng lên 3.

#### 2.2. Timeout

- `SESSION_ABSOLUTE_TTL_MS` mặc định 7 ngày (giữ).
- D6 chốt **không dùng idle timeout**. `last_seen_at` vẫn lưu để hiển thị session list nhưng không dùng để từ chối request.
- `getSessionUser` chỉ kiểm tra `expires_at > now`.
- Cookie `maxAge` = absolute TTL.
- Cleanup định kỳ xóa `expires_at <= now`.
- Ghi rõ deviation ASVS 7.3.1 (L2) và justification theo 7.1.1; NIST AAL1 không bắt buộc inactivity timeout.
- Test: absolute timeout → 401; `last_seen_at` được cập nhật; session vẫn hợp lệ sau khoảng idle (theo D6); session list hiển thị đúng.

#### 2.3. Session API

Thêm (đều `requireAuth`, no-store):

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/auth/sessions` | Danh sách session của user hiện tại: `id` (public_id), `createdAt`, `lastSeenAt`, `current`, `userAgent` (nếu lưu) |
| `DELETE` | `/api/auth/sessions/:id` | Thu hồi session thuộc user; không cho thu hồi session người khác (kiểm tra `user_id`) |
| `POST` | `/api/auth/logout-all` | Thu hồi tất cả session của user; clear cookie; có thể giữ session hiện tại nếu muốn (mặc định logout all) |

- Không trả `token_hash`; không trả IP đầy đủ.
- Nếu lưu `user_agent`: cắt 255 ký tự, coi là untrusted, React escape.
- `DELETE` id không tồn tại/không thuộc user → 404 (không lộ).
- Test: user A không thu hồi được session user B; logout-all làm cookie cũ 401; session list chỉ trả của mình.

#### 2.4. Concurrent session policy

- Chọn D6: tối đa 5 session/user (mặc định đề xuất), hoặc không giới hạn nhưng hiển thị danh sách.
- Nếu giới hạn: sau khi tạo session mới, xóa các session cũ nhất vượt quá 5 (giữ session mới).
- Ghi rõ policy trong `ARCHITECTURE.md`/`README.md` (ASVS V7.1.2).
- Test: tạo 6 session → chỉ còn 5; session mới nhất còn hiệu lực.

#### 2.5. Rotation

- Login/register đã tạo token mới; giữ.
- Đổi mật khẩu/reset: xóa tất cả session, tạo session mới cho thiết bị hiện tại, set cookie mới (Phase 3).
- Cân nhắc rotation định kỳ 24h: không bắt buộc khi absolute 7 ngày + logout-all/revoke; nếu D6 đổi sang idle dài, thêm rotation.
- Test session fixation: token cũ sau login không dùng được; token mới có hiệu lực.

#### 2.6. Frontend

- Trang `/tai-khoan` (protected):
  - Thông tin username, ngày tạo.
  - Đổi mật khẩu (Phase 3).
  - Danh sách session: thiết bị/browser (UA rút gọn), tạo/lần cuối, nút "Đăng xuất thiết bị này".
  - Nút "Đăng xuất tất cả thiết bị".
  - Trạng thái loading/error/empty; xác nhận trước khi thu hồi.
- Thêm link "Tài khoản" trong header/mobile menu.
- `AuthContext`: thêm `logoutAll`, `listSessions`, `revokeSession`; sau logout-all clear user.
- Không hiển thị token.

**Exit gate Phase 2:**

- Migration v2→v3 pass trên bản copy; user/session/admin cũ còn nguyên.
- Test absolute/cleanup/rotation/logout-all/session list pass.
- ASVS V7.1.1/V7.1.2/V7.2.4/V7.3.1/V7.3.2/V7.4.x (subset) có ghi chú đạt.
- Frontend build pass; UI session list hoạt động.
- Backup trước migration tồn tại.

**Rollback:** restore auth DB backup v2; revert code; session tạo sau backup sẽ mất — thông báo nếu có. Giữ migration code nhưng không chạy? Tốt nhất restore + revert.

**Ước lượng:** M–L (2–4 ngày).

---

### Phase 3 — Password lifecycle, policy, hashing, rate limit

**Mục tiêu:** đóng khoảng cách NIST/ASVS về password, cho user tự đổi mật khẩu, giảm brute force.

#### 3.1. Đổi mật khẩu

`POST /api/auth/change-password` (requireAuth, rate limit, no-store):

```json
{
  "currentPassword": "...",
  "newPassword": "...",
  "passwordConfirm": "..."
}
```

- Xác minh `currentPassword` bằng `verifyPassword`.
- Validate `newPassword` theo policy mới; reject nếu trùng mật khẩu cũ.
- Hash mới; update `password_hash`, `password_changed_at`.
- Trong một transaction: update user + xóa tất cả session + tạo session mới; save một lần.
- Set cookie session mới; trả `200 { data: { user } }` hoặc `204`.
- Lỗi: 400 validation, 401 current sai (generic), 429 rate limit, 500 DB.
- Audit `auth.password.changed`.
- UI: form trong `/tai-khoan`; hiện/ẩn mật khẩu; thông báo thành công; logout các thiết bị khác.
- Test: current sai → 401; new yếu → 400; thành công → session cũ 401, session mới 200; hash đổi; password cũ không login được.

#### 3.2. Password policy (D2 — đã chốt)

- Tối thiểu **8 ký tự**; tối đa **128 ký tự**.
- **Bắt buộc ít nhất 1 chữ cái và 1 chữ số** (giữ hành vi hiện tại).
- **Deviation đã chấp nhận:** ASVS 6.2.5 L1 (không composition) và NIST 800-63B-4 (15 ký tự) không đạt. Bù bằng blocklist top 10k, context words, rate limit, scrypt và optional MFA. Không thay đổi composition nếu người dùng không đổi D2.
- Không thêm yêu cầu ký tự đặc biệt; cho phép space, Unicode.
- Đếm theo Unicode code point, không theo UTF-16 length.
- Chuẩn hóa NFC trước khi hash cho password mới. Với hash cũ:
  - Thử NFC trước; nếu fail, thử raw (legacy); nếu raw đúng, rehash sang NFC + params mới.
  - Ghi rõ migration behavior; test Unicode.
- Reject password chứa username (≥4 ký tự), "learnpath", các từ context.
- Blocklist top 10k common passwords (offline, lowercase, exact + lowercase; có thể thêm leetspeak đơn giản).
- Không yêu cầu đổi định kỳ; chỉ đổi khi user muốn hoặc có dấu hiệu lộ.
- Existing users: không ép đổi ngay; không lưu plaintext/độ dài cũ.

**Blocklist:**

- Vendor file `backend/src/auth/data/common-passwords.txt` (top 10k, mỗi dòng một password, lowercase), kèm `LICENSE`/nguồn (SecLists hoặc danh sách public domain). Không thêm npm dependency.
- Load một lần vào `Set`; chuẩn hóa input lowercase/NFC trước khi kiểm tra.
- Test: `password`, `123456`, `matkhau123`, `learnpath2026` bị chặn; passphrase dài không bị chặn.
- Optional HIBP k-anonymity (D4/Phase 4): chỉ gửi 5 ký tự SHA-1; timeout 2s; fail-open hay fail-closed phải quyết định. Mặc định **không** gọi external ở core để tránh phụ thuộc mạng.

#### 3.3. Scrypt rehash

- Target mới: `N=131072 (2^17), r=8, p=1`, key 64, salt 16; `maxmem` 256 MiB.
- OWASP khuyến nghị scrypt tối thiểu `2^17, r=8, p=1`; nếu server không đủ RAM, ghi rõ deviation và chọn `N=65536` (vẫn thấp hơn khuyến nghị) — cần benchmark.
- `needsRehash(stored)`:
  - Nếu `N/r/p` thấp hơn target → rehash sau login thành công.
  - Nếu hash legacy format (không có params) → rehash.
- `verifyDummyPassword` dùng cùng params target để timing tương đương.
- Giới hạn concurrency:
  - Semaphore tối đa 2–4 scrypt đồng thời; queue có timeout; trả 503/429 nếu quá tải.
  - Rate limit trước khi gọi scrypt.
- Benchmark trên máy dev/production: login p95, RAM peak; ghi vào plan/report.
- Test: hash cũ verify được; sau login hash mới có `N=131072`; dummy verify không lộ user; concurrency không làm treo.

#### 3.4. Rate limit và chống brute force (không khóa toàn cục)

- Giữ pair (IP + username) và IP hiện có; đây là các giới hạn cứng trả `429` + `Retry-After`.
- Thêm **per-account progressive backoff** cho trường hợp nhiều IP cùng thử một account:
  - Đếm failure theo `hash(usernameLower)` trong cửa sổ trượt 15 phút; không dùng username thô làm key log.
  - Sau 5 failure: delay 250ms; 10 failure: 500ms; 20 failure: 1s; 40+: 2s (cap). Delay áp dụng trước khi trả response và trước khi gọi scrypt; **không** trả `429` chỉ vì account.
  - Không khóa vĩnh viễn, không khóa account trên toàn hệ thống: attacker không thể dùng failure để chặn chủ tài khoản. Delay + per-IP hard limit chỉ giảm throughput credential stuffing; phòng thủ đầy đủ cần edge rate limit/MFA (Phase 4/6).
  - Với username không tồn tại, dùng cùng dummy verify + cùng delay bucket (key theo username hash) để không lộ account qua timing.
  - Reset streak khi login thành công hoặc sau 15 phút không có failure; failure từ IP lạ vẫn ghi audit.
- **Không** dùng `login:global` theo số failure để chặn toàn hệ thống. Bảo vệ CPU scrypt bằng **semaphore + bounded queue**:
  - Tối đa 2–4 scrypt đồng thời; queue tối đa 32; chờ tối đa 2s; quá tải trả `503` + `Retry-After` (load shedding), không dựa trên failure count.
  - Rate limit IP/pair chạy trước khi vào queue.
- Alert (chỉ cảnh báo, không auto-block): >20 failure/account/giờ; >20 failure toàn hệ thống/phút; >5 `429`/phút; >3 DB write error/5 phút.
- `recordLoginFailure` tăng pair/IP/account; `clearLoginFailures` clear pair + account streak khi thành công (không clear IP bucket của attacker khác).
- Test: 21 failure từ 5 IP → delay tăng dần, không hard-lock; chủ account vẫn login được (có delay) khi biết mật khẩu đúng; per-IP vẫn `429`; queue đầy → `503`; username không tồn tại có timing tương đương.

#### 3.5. Enumeration (D7)

- Giữ `409` cho register nếu ưu tiên UX; thêm rate limit register theo IP và theo username; log.
- Nếu chọn chống enumeration:
  - Trả `202` generic "Nếu tên đăng nhập chưa tồn tại, tài khoản đã được tạo..." nhưng cần email verification để user biết đăng nhập; không khả thi nếu không có email.
  - Hoặc trả `200` generic và yêu cầu login; UX kém.
- Không thay đổi nếu chưa có D7.

#### 3.6. UI

- Cập nhật `AuthPage` hint: "Tối thiểu 8 ký tự; phải có ít nhất một chữ cái và một chữ số."
- `maxLength=128`.
- Không trim password; cho phép paste/password manager.
- Thêm link "Quên mật khẩu" nếu Phase 4; nếu chưa, ẩn để không hứa tính năng.
- Trang `/tai-khoan` form đổi mật khẩu.

**Exit gate Phase 3:**

- ASVS V6.2.1–6.2.12 (trừ MFA-specific) đạt hoặc có deviation ghi rõ.
- Test policy/blocklist/rehash/change-password/rate-limit pass.
- Benchmark scrypt có số liệu; không OOM.
- Existing users vẫn login được; không mất tài khoản.
- Frontend build pass.

**Rollback:**

- Policy: revert constants; hash cũ vẫn verify (format có params).
- Rehash: user đã rehash vẫn login được với code cũ? Code cũ parse `scrypt` N=131072 nhưng `MAX_SUPPORTED_MAX_MEM` 256MB và maxmem formula; cần đảm bảo code cũ chấp nhận N=131072 (hiện `MAX_SUPPORTED_N=262144`, maxmem 256MB → có). Nếu không, rollback phải giữ code parse mới hoặc restore backup.
- Change-password: revert endpoint; user đã đổi vẫn dùng mật khẩu mới.
- Blocklist: revert file/load.

**Ước lượng:** M–L (2–4 ngày).

---

### Phase 4 — Recovery và MFA (optional, cần duyệt D3/D4)

> Phase này chỉ làm sau khi core 0–3,5 ổn định. Không triển khai đồng thời với migration session.

#### 4.1. Chọn cơ chế recovery

**Option A — Email + reset (khuyến nghị nếu có domain/SMTP):**

- Schema v3:
  ```sql
  ALTER TABLE users ADD COLUMN email TEXT;
  ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
  CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

  CREATE TABLE password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    request_ip_hash TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE email_verification_tokens (...);
  ```
- API:
  - `POST /api/auth/password-reset/request` body `{ email }` hoặc `{ username }` (chọn một; email dễ hơn).
  - Luôn trả `202` generic, cùng thời gian tương đối; rate limit IP + email/username.
  - Token 32 byte, lưu SHA-256, TTL 30 phút, single-use; email chứa link `https://domain/dat-lai-mat-khau?token=...`.
  - `POST /api/auth/password-reset/confirm` body `{ token, password, passwordConfirm }`; verify token, hash mới, update + revoke all sessions + consume token trong transaction; gửi email thông báo.
  - Không log token; `Referrer-Policy: no-referrer`; xóa token khỏi URL sau khi đọc.
- Email verification:
  - `POST /api/auth/email/verify/request` (auth) và `GET/POST /api/auth/email/verify?token=...`.
  - Chỉ gửi reset nếu email đã verify.
- Email delivery:
  - Dùng SMTP provider (nodemailer) hoặc API provider qua `fetch`. Nếu thêm dependency → duyệt.
  - Cấu hình SPF/DKIM/DMARC; TLS; không gửi password; template tiếng Việt.
- Existing users: thêm email trong `/tai-khoan`, verify; nếu chưa có email, không reset được (hiển thị hướng dẫn).

**Option B — Recovery codes (không cần email):**

- Schema:
  ```sql
  CREATE TABLE recovery_codes (
    code_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    used_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  ```
- Sinh 10 mã 10–12 ký tự base32; hiển thị một lần; lưu SHA-256 (entropy cao) hoặc scrypt.
- `POST /api/auth/recovery/confirm` body `{ username, code, password, passwordConfirm }`; single-use; revoke sessions; audit.
- UI: sau đăng ký/trong tài khoản, hiển thị "Lưu mã khôi phục"; tải file text; cảnh báo mất mã.
- Nhược điểm: user mất mã = mất tài khoản; hỗ trợ thủ công.

**Option C — Không recovery:**

- Chỉ có change-password; ghi rõ "nếu quên mật khẩu, tài khoản không thể khôi phục". Không khuyến nghị cho production.

#### 4.2. MFA (D4)

Nếu chọn **TOTP optional**:

- Schema v4:
  ```sql
  ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN mfa_secret_enc TEXT;
  ALTER TABLE users ADD COLUMN mfa_last_step INTEGER;

  CREATE TABLE mfa_recovery_codes (...);
  CREATE TABLE mfa_challenges (
    challenge_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );
  ```
- Secret 20 byte base32; mã hóa AES-256-GCM bằng `AUTH_SECRET` (không lưu plaintext). `AUTH_SECRET` phải backup riêng, không cùng DB.
- Enroll:
  - `POST /api/auth/mfa/setup` (auth) → secret + otpauth URI (không trả qua log).
  - `POST /api/auth/mfa/enable` body `{ code }` → verify ±1 step, lưu secret encrypted, tạo recovery codes, trả một lần.
- Login:
  - Password đúng + MFA enabled → tạo challenge cookie `lp_mfa` (HttpOnly, Secure, SameSite=Lax, Path=/api/auth, TTL 5 phút) và trả `{ data: { mfaRequired: true } }`.
  - `POST /api/auth/mfa/verify` body `{ code }` + challenge cookie → tạo session; rate limit 5/phút; chống replay bằng `mfa_last_step`.
- Disable: yêu cầu password + code; xóa secret/recovery codes; audit.
- Recovery codes: 10 mã, single-use, hash; dùng để login khi mất TOTP; hiển thị một lần.
- UI: bước nhập mã 6 số trong `AuthPage`; trang `/tai-khoan` bật/tắt MFA, xem mã khôi phục.
- Giới hạn: TOTP không chống phishing; WebAuthn/passkeys là hướng tương lai, cần dependency/UX riêng.

#### 4.3. Notifications

- Nếu có email: thông báo khi đổi/reset mật khẩu, bật/tắt MFA, đăng nhập từ thiết bị mới (tùy chọn).
- Nếu không email: hiển thị banner trong app + audit log; không hứa email.

**Exit gate Phase 4:**

- Recovery: generic response, token single-use/expiry, revoke sessions, rate limit, không enumeration; test.
- MFA: enroll/login/recovery/disable, replay prevention, rate limit, secret encrypted; test.
- Email: SPF/DKIM/DMARC checklist; test gửi thật tới hộp thư kiểm thử.
- Không khóa user vĩnh viễn; có quy trình hỗ trợ.
- ASVS V6.4/V6.5 subset đạt.

**Rollback:**

- Tắt endpoint/feature flag; giữ bảng nhưng không dùng; revert code.
- Nếu secret MFA lỗi: dùng recovery codes hoặc admin reset (nếu có) — cần runbook.
- Restore backup v2 nếu migration lỗi.

**Ước lượng:** L (3–7 ngày), tùy email/MFA.

---

### Phase 5 — Auth DB durability, backup, single-instance

**Mục tiêu:** không mất tài khoản/session do ghi file; có thể restore.

#### 5.1. Single-instance lock

- Trước khi mở DB, tạo `auth.db.lock` bằng `fs.openSync(..., 'wx')`.
- Nội dung: `{ pid, startedAt, hostname }`.
- Nếu file tồn tại:
  - Đọc PID; nếu process còn sống → fail startup với thông báo "Auth DB đang được process khác sử dụng. Chạy một instance hoặc dừng process kia."
  - Nếu process không còn → coi là stale, log warning, xóa lock và thử lại.
- Giải phóng lock trong `SIGINT`/`SIGTERM`/`exit`; không xóa lock của process khác.
- Test: spawn 2 process cùng auth DB → process thứ hai exit với mã lỗi rõ; sau khi process 1 dừng, process 2 chạy được.
- Giới hạn: lock chỉ bảo vệ process hợp tác; không bảo vệ tool bên ngoài. Document.

#### 5.2. Atomic write

- Ghi temp file cùng thư mục:
  - `fs.openSync(temp, 'w', 0o600)`
  - `fs.writeSync`
  - `fs.fsyncSync`
  - `fs.closeSync`
  - `fs.renameSync(temp, auth.db)`
- Nếu Windows rename lỗi `EPERM`/`EEXIST`:
  - Rename `auth.db` → `auth.db.old-<timestamp>` (nếu tồn tại).
  - Rename temp → `auth.db`.
  - Xóa `.old`; nếu bước 2 lỗi, phục hồi `.old`.
- POSIX: fsync thư mục (best effort) sau rename.
- Không dùng `copyFileSync` đè trực tiếp lên DB đang là nguồn.
- Test: giả lập lỗi giữa chừng (mock fs) → DB cũ vẫn mở được; temp được dọn.

#### 5.3. Integrity và migration

- Khi mở DB: chạy `PRAGMA integrity_check`; nếu != `ok`, fail với hướng dẫn restore backup; không tự xóa/tạo mới.
- Kiểm tra `user_version`:
  - `0` → tạo schema mới.
  - `1..CURRENT` → chạy migration tuần tự.
  - `> CURRENT` → fail.
- Trước migration:
  - Copy `auth.db` → `backups/auth-pre-v<X>-<timestamp>.db` (cùng thư mục hoặc ngoài repo).
  - Chạy migration trong transaction; nếu lỗi rollback và giữ file gốc.
- Thêm CLI `backend/scripts/auth-db.js`:
  ```text
  node backend/scripts/auth-db.js check   --path <db>
  node backend/scripts/auth-db.js backup  --path <db> --out <dir>
  node backend/scripts/auth-db.js migrate --path <db>
  node backend/scripts/auth-db.js restore --from <backup> --to <db> --yes
  ```
  - `migrate` từ chối chạy trên DB thật nếu không có `--yes`/backup; guard path.
  - `check` chỉ đọc, in version/counts/integrity.
- Test migration v2→v3/v4 trên bản copy; giữ nguyên user/session/admin; rollback restore.

#### 5.4. Backup/restore

- Backup định kỳ:
  - Trước migration.
  - Hằng ngày (script/cron/systemd timer) → `backend/database/backups/`.
  - Giữ 7 bản daily + 4 bản weekly; xóa theo retention.
- Backup phải:
  - Có checksum SHA-256.
  - Quyền file hạn chế (0600/POSIX; ACL Windows).
  - Không nằm trong web root.
  - Nếu có thể, mã hóa at rest (BitLocker/LUKS hoặc archive encrypted).
- Restore drill:
  - Copy backup ra temp; `auth-db check`; start server với temp DB; login test account; xác nhận; xóa temp.
- Không backup vào git; `.gitignore` đã ignore `*.db`, thêm `backend/database/backups/` nếu cần.

#### 5.5. Optional multi-instance

Chỉ làm nếu D5 chọn multi-instance:

- **Không** dùng `sql.js` chia sẻ file giữa nhiều process.
- Cân nhắc:
  - `node:sqlite` (Node 24.15+ là release candidate, chưa stable) với WAL; rủi ro API thay đổi.
  - `better-sqlite3` (native dependency, cần duyệt) với WAL, synchronous, phù hợp single-node multi-process.
  - PostgreSQL/Redis cho auth/session/rate limit nếu scale ngang.
- Migration dữ liệu từ sql.js file sang SQLite file tương thích (cùng format SQLite); test kỹ.
- Nếu không multi-instance: giữ `sql.js`, lock + một process, ghi rõ trong README.

**Exit gate Phase 5:**

- Lock test 2 process pass.
- Atomic write/crash simulation pass.
- Integrity check phát hiện file hỏng (test với file cắt cụt).
- Migration copy pass; backup/restore drill pass.
- Auth DB thật không bị sửa trong test.
- Admission DB hash unchanged.

**Rollback:** restore backup; revert code; nếu lock stale, xóa thủ công theo hướng dẫn. Không chạy `db:init`.

**Ước lượng:** M (1–2 ngày).

---

### Phase 6 — Production deployment và operations

**Mục tiêu:** đảm bảo các kiểm soát trên thực sự hoạt động khi deploy, không chỉ trên máy dev.

#### 6.1. Environment/config

- `.env.example` (không chứa secret):
  ```text
  NODE_ENV=production
  PORT=3001
  APP_ORIGIN=https://learnpath.example.com
  TRUST_PROXY=1
  LEARNPATH_AUTH_DB_PATH=/var/lib/learnpath/auth.db
  SESSION_ABSOLUTE_TTL_MS=604800000
  AUTH_MAX_SESSIONS=5
  AUTH_SECRET=<base64-32-bytes>
  LOG_LEVEL=info
  ```
- Production validation:
  - `APP_ORIGIN` HTTPS, không localhost, không `*`.
  - `AUTH_DB_PATH` ngoài web root, quyền hạn chế.
  - `AUTH_SECRET` tồn tại nếu MFA/HMAC log.
  - `TRUST_PROXY=1` chỉ khi proxy tin cậy; kiểm tra `X-Forwarded-Proto`.
- Không commit `.env`; `.gitignore` đã có.

#### 6.2. Reverse proxy/TLS

- Nginx/Caddy:
  - TLS 1.2+, redirect HTTP→HTTPS.
  - HSTS `max-age=31536000; includeSubDomains` (chỉ preload sau khi chắc chắn).
  - CSP header như Phase 1.
  - Security headers (nosniff, frame DENY, referrer no-referrer, permissions policy).
  - `/api` proxy → backend; `client_max_body_size 16k`; timeout hợp lý.
  - SPA fallback `try_files $uri /index.html`.
  - Static assets `Cache-Control: public, max-age=31536000, immutable`; `index.html` no-cache.
  - Rate limit edge: `limit_req_zone` cho `/api/auth/login`, `/api/auth/register`; trả 429.
  - Access log: không log cookie/Authorization; hoặc redact.
- Nếu dùng Caddy: cấu hình tương đương; document.

#### 6.3. Process manager

- systemd service hoặc PM2 **fork mode, 1 instance**.
- `Restart=on-failure`, `EnvironmentFile`, user riêng, working directory, `NoNewPrivileges`, `ProtectSystem` nếu có.
- Không dùng cluster mode với `sql.js`.
- Graceful shutdown: đóng DB, remove lock, đóng server.
- Health check: `/api/health`; restart nếu fail 3 lần.

#### 6.4. Monitoring/alerting

- Metrics/log tối thiểu:
  - Auth login failure rate, 429 rate, 5xx rate.
  - Auth DB write errors, integrity check failures, backup age.
  - Disk space, memory (scrypt), process uptime.
  - TLS expiry.
- Alert thresholds (document; chỉ cảnh báo, không auto-block):
  - >20 login failures/phút toàn hệ thống.
  - >20 login failures/account/giờ.
  - >5 429/phút.
  - >3 DB write errors/5 phút.
  - Backup >26h.
- Không cần SIEM; có thể dùng log provider/uptime monitor.

#### 6.5. Incident response runbook

- **Nghi lộ mật khẩu/tài khoản:**
  - Buộc reset mật khẩu (admin script? nếu chưa có admin, hướng dẫn user).
  - Revoke all sessions.
  - Kiểm tra audit log; thông báo user.
- **Nghi lộ session/token:**
  - Revoke all sessions; rotate `AUTH_SECRET` nếu dùng MFA/HMAC; kiểm tra CSP/XSS.
- **Auth DB hỏng:**
  - Dừng server; giữ file hỏng; restore backup gần nhất; chạy integrity; kiểm tra user/session; thông báo nếu mất dữ liệu.
- **Backup lộ:**
  - Coi như lộ hash; buộc reset toàn bộ? Đánh giá; rotate secret; thông báo.
- **Dependency advisory:**
  - Đánh giá ảnh hưởng runtime; patch/mitigate; ghi exception nếu chưa upgrade.

#### 6.6. Pen-test/verification

- OWASP WSTG auth/session checklist; ZAP baseline (nếu có) trên staging.
- Test tay: register/login/logout/change/reset/MFA, rate limit, CSRF, XSS, session timeout, cookie flags, CSP, redirect.
- Không chạy pen-test trên production thật nếu chưa được phép.

**Exit gate Phase 6:**

- Production/staging smoke pass:
  - HTTP→HTTPS redirect; HSTS.
  - Cookie `__Host-`, Secure, HttpOnly, SameSite.
  - CSP không violation; không inline script.
  - `/api/auth/login` rate limit edge + app.
  - Health readiness 200; DB/auth ok.
  - Backup age <26h; restore drill pass.
- Config validation fail-fast đúng.
- Log không chứa secret.
- Runbook có trong repo/docs.

**Rollback:** revert proxy config; giữ HTTPS; tắt CSP nếu break (report-only); restore previous `.env`; không đụng DB.

**Ước lượng:** M (1–3 ngày), tùy hạ tầng.

---

## 8. Acceptance test matrix

> Tất cả test auth dùng auth DB tạm; không dùng `backend/database/auth.db`.
> Frontend build là điều kiện bắt buộc cho mọi phase có sửa UI.

### 8.1. Auth/API

| ID | Case | Expected | Phase |
|---|---|---|---|
| A01 | Register hợp lệ | 201 + cookie + user, không có hash | 0 |
| A02 | Register thiếu confirm / confirm sai | 400 | 0 |
| A03 | Register password yếu/ngắn | 400 | 0/3 |
| A04 | Register trùng username (khác hoa thường) | 409 (hoặc generic theo D7) | 0/3 |
| A05 | Login đúng | 200 + cookie mới | 0 |
| A06 | Login sai | 401 generic, không lộ user tồn tại | 0 |
| A07 | `/me` có/không cookie | 200/401 | 0 |
| A08 | Logout | 204, cookie clear, token cũ 401 | 0 |
| A09 | Session sống qua restart server | 200 | 0 |
| A10 | Change password | 200/204; session cũ 401; session mới 200 | 3 |
| A11 | Change password current sai | 401 | 3 |
| A12 | Reset request unknown user | 202 generic, timing tương đương | 4 |
| A13 | Reset token dùng 2 lần | lần 2 fail | 4 |
| A14 | Reset token hết hạn | fail | 4 |
| A15 | MFA enroll/login/recovery/disable | pass theo thiết kế | 4 |

### 8.2. Session/security

| ID | Case | Expected | Phase |
|---|---|---|---|
| S01 | Idle timeout (D6 tắt) | Session vẫn hợp lệ sau idle; deviation được ghi rõ | 2 |
| S02 | Absolute timeout | 401 sau absolute TTL | 2 |
| S03 | Cookie production | `__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/ | 1 |
| S04 | Forged/modified token | 401 | 0 |
| S05 | Session fixation | token cũ sau login không dùng được | 0/2 |
| S06 | Logout-all | tất cả token cũ 401 | 2 |
| S07 | Session list | chỉ session của mình; không lộ token | 2 |
| S08 | Revoke session người khác | 404/403 | 2 |
| S09 | Max sessions | session cũ nhất bị evict | 2 |
| X01 | CSP | không violation; không inline script | 1 |
| X02 | Raw HTML | không render HTML thô; hoặc sanitize | 1 |
| X03 | CSRF Origin lạ | 403 | 0/1 |
| X04 | `Sec-Fetch-Site: cross-site` | 403 | 1 |
| X05 | Login rate limit pair | 429 + Retry-After | 0 |
| X06 | Register rate limit | 429 | 0 |
| X07 | Account failures đa IP | delay tăng dần + alert; không hard-lock; per-IP vẫn 429 | 3 |
| X08 | Log/response không chứa password/token | pass | 1 |
| X09 | Safe redirect | reject `//`, `\`, absolute, control chars | 1 |
| X10 | Cache-Control auth/data | no-store/private no-store | 1 |
| X11 | Security headers | đủ header, không lộ `X-Powered-By` | 0/1 |
| X12 | Config production sai | startup fail | 1 |

### 8.3. DB/ops

| ID | Case | Expected | Phase |
|---|---|---|---|
| D01 | Migration v2→v3 trên copy | user/session/admin giữ nguyên, version 3 | 2 |
| D02 | `PRAGMA integrity_check` | `ok` | 5 |
| D03 | Backup/restore | restore mở được, login được | 5 |
| D04 | Hai process cùng auth DB | process 2 fail rõ | 5 |
| D05 | Crash/atomic write | DB cũ mở được, không mất user | 5 |
| D06 | Admission DB hash | không đổi | all |
| O01 | Backend tests | pass 100% | 0 |
| O02 | Frontend build | pass | all |
| O03 | `npm audit` | không tăng severity; exception ghi rõ | 0/6 |
| O04 | Health readiness | 200/503 đúng | 1 |
| O05 | Production smoke | HTTPS/CSP/cookie/rate limit pass | 6 |
| O06 | Restore drill | pass, có biên bản | 5/6 |

---

## 9. Lệnh kiểm chứng mẫu

### 9.1. Baseline và DB integrity

```powershell
cd "C:\Users\hoath\OneDrive\Desktop\KHKT 2026\SANPHAM\LearnPath"

# Admission DB hash trước/sau mọi phase
Get-FileHash backend\database\learnpath.db -Algorithm SHA256

# Read-only inspection
node .agents\scripts\inspect-db.js

# Backup auth DB thật (không ghi vào repo)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item backend\database\auth.db (Join-Path $env:TEMP "learnpath-auth-$stamp.db")
```

### 9.2. Backend tests

```powershell
cd backend
npm install
npm test

# Nếu có script riêng
npm run test:unit
npm run test:integration
```

### 9.3. API smoke với auth DB tạm

```powershell
$env:NODE_ENV = 'test'
$env:PORT = '3101'
$env:LEARNPATH_AUTH_DB_PATH = Join-Path $env:TEMP "learnpath-auth-hardening.db"
# Giữ LEARNPATH_DB_PATH mặc định (chỉ đọc)
node server.js
```

Terminal khác:

```powershell
$base = 'http://localhost:3101'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$user = "hardening_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$body = @{ username = $user; password = 'MatKhauRatDai123'; passwordConfirm = 'MatKhauRatDai123' } | ConvertTo-Json

Invoke-RestMethod "$base/api/health"
Invoke-RestMethod "$base/api/auth/register" -Method Post -Body $body -ContentType 'application/json' -WebSession $session
Invoke-RestMethod "$base/api/auth/me" -WebSession $session
Invoke-RestMethod "$base/api/de-an?limit=2" -WebSession $session
Invoke-RestMethod "$base/api/auth/logout" -Method Post -WebSession $session
```

- Kiểm tra `Set-Cookie` có `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` khi production.
- Không dùng password mẫu này cho production; chỉ test.

### 9.4. Frontend build

```powershell
cd frontend
npm install
npm run build
```

### 9.5. Production cookie flags (không cần HTTPS thật để xem header)

```powershell
$env:NODE_ENV = 'production'
$env:APP_ORIGIN = 'https://learnpath.example.com'
$env:PORT = '3102'
$env:LEARNPATH_AUTH_DB_PATH = Join-Path $env:TEMP "learnpath-auth-prod-cookie.db"
node backend/server.js
```

Dùng `curl.exe -i` hoặc `Invoke-WebRequest` gửi register/login; kiểm tra `Set-Cookie` có `__Host-lp_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`.

### 9.6. Migration trên bản copy

```powershell
$src = 'backend\database\auth.db'
$tmp = Join-Path $env:TEMP "learnpath-auth-migration.db"
Copy-Item $src $tmp
node backend\scripts\auth-db.js check --path $tmp
node backend\scripts\auth-db.js migrate --path $tmp
node backend\scripts\auth-db.js check --path $tmp
```

- So sánh số users/sessions trước/sau; không in username/hash.
- Chỉ migrate DB thật sau khi backup + duyệt.

### 9.7. Hai process cùng auth DB

```powershell
$env:LEARNPATH_AUTH_DB_PATH = Join-Path $env:TEMP "learnpath-auth-lock.db"
$env:PORT = '3103'
Start-Process node -ArgumentList 'server.js' -WorkingDirectory backend
# Chờ process 1 lên, rồi chạy process 2 với PORT khác
$env:PORT = '3104'
node backend/server.js
# Kỳ vọng: process 2 exit với thông báo auth DB đang được dùng
```

### 9.8. Dependency audit

```powershell
cd backend
npm audit --omit=dev

cd ..\frontend
npm audit --omit=dev
```

Ghi lại mọi advisory còn lại, severity, lý do chấp nhận, ngày review.

---

## 10. Rollback plan

| Thay đổi | Rollback | Lưu ý |
|---|---|---|
| Test/CI | Xóa file test/workflow | Không ảnh hưởng runtime |
| Safe redirect | Revert module/UI | Không đụng DB |
| Logout fail-closed | Revert route | Session cũ vẫn còn nếu rollback giữa chừng |
| Cookie `__Host-` | Đọc/clear cả hai tên; revert tên cũ | User có thể phải login lại |
| CSP | Chuyển về Report-Only rồi bỏ header | Không ảnh hưởng API |
| Remove `rehype-raw` | Restore import/plugin nếu Markdown cần HTML | Kiểm tra lại XSS |
| Schema v2/v3/v4 | Restore backup trước migration; revert code | Session/tài khoản tạo sau backup sẽ mất; thông báo |
| Password policy | Revert constants; hash cũ vẫn verify | Không ép user đổi lại |
| Scrypt rehash | Giữ code parse params mới hoặc restore backup | Code cũ phải chấp nhận N=131072 |
| Change/reset/MFA | Tắt endpoint/feature flag; revert code | Giữ bảng DB nếu không cần xóa |
| Auth DB lock/atomic | Revert code; xóa lock stale thủ công | Không chạy 2 process |
| Proxy/CSP production | Revert config; giữ HTTPS | Không hạ TLS |
| Dependency major | Revert package-lock + code | Test lại build |

**Không bao giờ** chạy `npm run db:init` như một cách rollback. Không xóa `auth.db` nếu chưa có backup và chưa được duyệt.

---

## 11. Definition of Done

### Core (bắt buộc)

- [ ] Phase 0–3, 5, 6 exit gate đạt.
- [ ] Không còn P0; P1 đóng hoặc có quyết định chấp nhận có ngày review.
- [ ] Test auth/API/DB tự động pass; CI green; frontend build pass.
- [ ] ASVS 5.0 L1 auth/session checklist đạt, trừ deviation D2 (6.2.5 composition) đã ghi; các mục L2 đã chọn đạt, trừ idle timeout (D6) đã ghi.
- [ ] NIST AAL1 session timeout đạt; password policy đạt hoặc deviation được ghi rõ.
- [ ] Cookie production flags + `__Host-`; CSP không violation; không còn `rehype-raw` (hoặc đã sanitize).
- [ ] Audit log có request ID, không chứa secret; alert threshold documented.
- [ ] Auth DB migration/backup/restore drill pass; lock 2 process pass; integrity check pass.
- [ ] Admission DB SHA-256 không đổi; auth DB thật không bị test ghi.
- [ ] `README.md` + `.agents/*` cập nhật; runbook có.
- [ ] Không commit/push/PR nếu chưa được yêu cầu.

### Optional Phase 4

- [ ] D3/D4 được duyệt.
- [ ] Recovery/MFA tests pass; email deliverability checklist pass.
- [ ] Runbook khóa tài khoản/MFA mất thiết bị.
- [ ] ASVS V6.4/V6.5 subset đạt.

---

## 12. Quyết định đã chốt và còn lại

### 12.1. Đã chốt (2026-10-23)

| ID | Kết quả | Ghi chú |
|---|---|---|
| D1 | ASVS 5.0 Level 1 (deviation D2) + L2 chọn lọc; NIST AAL1 | Không mở rộng sang tính năng sản phẩm |
| D2 | Giữ tối thiểu 8 ký tự + ít nhất 1 chữ và 1 số | ASVS 6.2.1 L1 đạt; **6.2.5 L1 không đạt**; NIST 15 không đạt; deviation accepted, bù bằng blocklist/rate limit/MFA optional |
| D3 | Recovery codes | Không cần email/SMTP; mã dùng một lần, lưu hash, TTL ngắn |
| D4 | TOTP tùy chọn sau core | Không tuyên bố L2 đầy đủ |
| D5 | Một process + lock | Giữ `sql.js`, chưa chuyển shared DB/Redis |
| D6 | Không idle; absolute 7 ngày; tối đa 5 session | ASVS 7.3.1 (L2) deviation documented; NIST AAL1 không bắt buộc idle |

### 12.2. Quyết định còn lại

> Các mục dưới đây chưa chốt. Nếu không trả lời, dùng đề xuất và ghi rõ trong tài liệu.

| ID | Câu hỏi | Đề xuất | Phương án khác |
|---|---|---|---|
| D7 | Username enumeration | Giữ **409** + rate limit (UX) | Generic 202 (cần email verification) |
| D8 | CSP/raw HTML | Bỏ `rehype-raw`; `script-src 'self'`; `style-src-attr 'unsafe-inline'` | Giữ raw HTML + sanitize; CSP lỏng hơn |
| D9 | Dependency major | Patch không phá vỡ trước; tách upgrade react-router 7/Vite 8/Tailwind 4 | Nâng ngay trong hardening |
| D10 | Test/E2E | `node:test` + CI; E2E tay/Playwright sau | Thêm Vitest/Playwright ngay |
| D11 | Deployment | Cần biết domain/HTTPS/proxy (nginx/Caddy) | Chưa deploy production |
| D12 | Email provider | Không cần vì D3 chọn recovery codes | Email reset nếu đổi D3 |
| D13 | Log retention/privacy | 30 ngày, IP hash, không log secret | Khác theo chính sách |
| D14 | Session list metadata | UA rút gọn + timestamps; không IP | Thêm IP/browser parse |

---

## 13. Thứ tự thực hiện và ước lượng

| Wave | Phase | Nội dung | Ước lượng thô |
|---|---|---|---|
| 1 | 0 | Test/CI/backup baseline | 0.5–1.5 ngày |
| 2 | 1 | Critical fixes + CSP + config + logging | 1–2 ngày |
| 3 | 2 | Session lifecycle + schema v3 | 2–4 ngày |
| 4 | 3 | Password lifecycle + scrypt + rate limit | 2–4 ngày |
| 5 | 5 | Auth DB durability + backup | 1–2 ngày |
| 6 | 6 | Production readiness | 1–3 ngày |
| Optional | 4 | Recovery + MFA | 3–7 ngày |

Tổng core: **8–16 ngày** (không tính review/decision), tùy mức độ test và hạ tầng. Đây là ước lượng để lập kế hoạch, không phải cam kết.

---

## 14. File map dự kiến

### Backend

| File | Thay đổi | Phase |
|---|---|---|
| `backend/server.js` | Config, headers, CSP API, request ID, health, graceful shutdown | 1, 6 |
| `backend/src/config.js` (mới) | Validate env, defaults, production guards | 1 |
| `backend/src/logger.js` (mới) | JSON security logger, redaction | 1 |
| `backend/src/auth/authDb.js` | Lock, atomic write, integrity, migrations, transaction helper | 2, 5 |
| `backend/src/auth/session.js` | Absolute timeout, `public_id`, session list/revoke, cleanup, cookie `__Host-` | 1, 2 |
| `backend/src/auth/password.js` | Scrypt target, rehash, NFC, concurrency guard | 3 |
| `backend/src/auth/validation.js` | Policy 15/128, blocklist, no composition | 3 |
| `backend/src/auth/rateLimit.js` | Per-account progressive backoff, scrypt semaphore, cleanup | 3 |
| `backend/src/auth/origin.js` | Normalize origin, Sec-Fetch-Site | 1 |
| `backend/src/routes/auth.js` | Change password, sessions, logout-all; fail-closed logout | 1–3 |
| `backend/src/routes/recovery.js` (mới, optional) | Reset/email verification | 4 |
| `backend/src/routes/mfa.js` (mới, optional) | TOTP setup/verify/disable | 4 |
| `backend/src/auth/data/common-passwords.txt` (mới) | Top 10k blocklist + license | 3 |
| `backend/src/auth/migrations/*` (mới) | v2/v3/v4 migrations | 2–4 |
| `backend/scripts/auth-db.js` (mới) | check/backup/migrate/restore CLI | 5 |
| `backend/test/**` (mới) | Unit/integration/DB tests | 0–5 |
| `backend/package.json` | `test` scripts | 0 |

### Frontend

| File | Thay đổi | Phase |
|---|---|---|
| `frontend/src/lib/redirect.js` (mới) | Safe redirect helper | 1 |
| `frontend/src/pages/AuthPage.jsx` | Dùng helper, policy hint, MFA step (optional) | 1, 3, 4 |
| `frontend/src/pages/AccountPage.jsx` (mới) | Đổi mật khẩu, sessions, logout-all, recovery/MFA | 2–4 |
| `frontend/src/context/AuthContext.jsx` | `logoutAll`, session actions | 2 |
| `frontend/src/lib/api.js` | API mới | 2–4 |
| `frontend/src/components/ProtectedRoute.jsx` | Giữ nguyên; test redirect | 1 |
| `frontend/src/App.jsx` | Route `/tai-khoan` | 2 |
| `frontend/src/components/Layout.jsx` | Link tài khoản | 2 |
| `frontend/src/pages/DeAnTuyenSinh.jsx` | Bỏ `rehypeRaw` | 1 |
| `frontend/vite.config.js` | `allowedHosts` cụ thể; CSP dev nếu cần | 1 |
| `frontend/index.html` | Không thêm CSP meta; giữ sạch inline script | 1 |

### Ops/docs

| File | Nội dung | Phase |
|---|---|---|
| `.github/workflows/ci.yml` (mới) | Backend tests, frontend build, audit | 0 |
| `.github/dependabot.yml` (mới) | Weekly npm updates, grouped | 0 |
| `.env.example` (mới) | Env mẫu, không secret | 1/6 |
| `deploy/nginx.conf.example` hoặc `deploy/Caddyfile.example` (mới) | TLS, CSP, proxy, SPA fallback, rate limit | 6 |
| `backend/database/backups/.gitkeep` (mới) | Giữ thư mục backup, ignore DB | 5 |
| `README.md` | Auth hardening, env, deployment, backup/restore | all |
| `.agents/ARCHITECTURE.md` | Schema v2+, session/API mới | 2–5 |
| `.agents/TESTING.md` | Test matrix, commands | 0–6 |
| `.agents/KNOWN_ISSUES.md` | Đóng/mở rủi ro, residual | all |
| `.agents/PROJECT_STATUS.md` | Lịch sử phase | all |
| `plans/auth-hardening.md` | Kế hoạch này | — |

---

## 15. Rủi ro của chính việc hardening

| Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|
| Migration auth DB làm mất user/session | Thấp | Cao | Backup + test trên copy + transaction + restore drill |
| Khóa user khỏi tài khoản do đổi cookie/policy | Trung bình | Cao | Đọc cả cookie cũ/mới; grandfather password; test E2E |
| CSP làm hỏng UI (Recharts/style) | Trung bình | Trung bình | Report-Only trước; fallback `style-src`; test 4 trang |
| Scrypt N=2^17 gây OOM/chậm | Trung bình | Cao | Benchmark; giới hạn concurrency; rate limit trước hash; fallback có ghi chú |
| Tăng password min gây khó chịu | Cao | Trung bình | Thông báo rõ; passphrase; không ép đổi ngay; hỗ trợ |
| Email reset không tới (spam) | Trung bình | Cao | SPF/DKIM/DMARC; test; retry; generic response |
| MFA làm mất tài khoản | Thấp | Cao | Recovery codes; runbook; không bắt buộc toàn bộ |
| Lock file stale sau crash | Trung bình | Trung bình | Stale PID detection; hướng dẫn xóa; log rõ |
| Dependency upgrade phá build | Trung bình | Trung bình | Tách phase; test; revert lockfile |
| Log chứa PII/secret | Thấp | Cao | Redaction test; review mẫu log; retention |
| Chia sẻ auth DB giữa 2 process | Thấp | Cao | Lock + fail-fast; document |

---

## 16. Tài liệu tham khảo

- OWASP ASVS 5.0: <https://github.com/OWASP/ASVS/tree/v5.0.0>
- OWASP ASVS V6 Authentication: <https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md>
- OWASP ASVS V7 Session Management: <https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md>
- OWASP ASVS V16 Logging: <https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md>
- NIST SP 800-63B-4 (2025): <https://pages.nist.gov/800-63-4/sp800-63b.html>
- OWASP Password Storage Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP Session Management Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- OWASP Forgot Password Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- OWASP Content Security Policy Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html>
- OWASP Logging Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js `node:sqlite`: <https://nodejs.org/api/sqlite.html>
- SQLite WAL: <https://sqlite.org/wal.html>
- React Router advisory (npm audit): GHSA-wrjc-x8rr-h8h6

---

## 17. Việc làm ngay sau khi plan được duyệt

1. [x] Chốt D1–D6 (2026-10-23).
2. [x] Backup `auth.db` và ghi baseline hash/size/version.
3. [x] Làm Phase 0: test + CI, không đổi runtime.
4. [ ] Báo cáo kết quả Phase 0 kèm evidence.
5. [ ] Chỉ sang Phase 1 khi được duyệt.
6. [x] Không commit/push/PR trừ khi được yêu cầu.
