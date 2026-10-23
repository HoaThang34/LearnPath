# LearnPath — Hệ thống Tư vấn Hướng nghiệp

Website giúp học sinh THPT tra cứu đề án tuyển sinh, điểm chuẩn, khối thi và thứ hạng điểm thi THPTQG.

> **Trước khi sửa code:** đọc [`AGENTS.md`](AGENTS.md) và bộ tài liệu trong [`.agents/`](.agents/README.md). Đây là bộ nhớ dự án dành cho agent/người mới, giúp tránh sửa thiếu lớp hoặc làm hỏng dữ liệu.

## Tính năng

- **Tài khoản** — đăng ký bằng tên đăng nhập + mật khẩu nhập hai lần, đăng nhập/đăng xuất; bốn trang tính năng và API dữ liệu yêu cầu đăng nhập.
- **Đề án tuyển sinh** — 307 đề án Markdown, tìm theo trường, xem nội dung + mục lục.
- **Điểm chuẩn** — 2.617 dòng theo 5 phương thức: THPT, ĐGNL HSA, ĐGTD TSA, ĐGNL V-ACT, SAT.
- **Khối thi** — 245 khối trong DB hiện tại; mã import mới đọc được 281 khối từ nguồn, chờ rebuild; xem trường và ngành theo khối, so sánh tối đa 5 ngành.
- **Thứ hạng THPTQG** — nhập điểm, xem thứ hạng và biểu đồ phân bố (xem cảnh báo bên dưới).

## Tech stack

| Lớp | Công nghệ |
|---|---|
| Frontend | React 18 + Vite 5 + Tailwind CSS 3; component kiểu shadcn đặt tại `frontend/src/components/ui` |
| Router / HTTP | react-router-dom 6; axios với `withCredentials` |
| Biểu đồ / Markdown | Recharts; react-markdown + remark-gfm + rehype-raw + rehype-slug |
| Backend | Express 4 + `sql.js` 1.10 (SQLite WASM) |
| Database tuyển sinh | `backend/database/learnpath.db` (~109 MiB), **không commit**, chỉ đọc khi chạy |
| Auth DB | `backend/database/auth.db` (nhỏ, tự tạo, **không commit**), ghi được |
| Import dữ liệu | `backend/src/database/init.js` |
| Xác thực | Tự viết bằng Node `crypto` (scrypt) + session phía server |
| Test / lint / CI | Chưa có test framework/CI commit; đã chạy script smoke/E2E tạm thời |

`sql.js` đọc toàn bộ file DB tuyển sinh vào RAM khi server khởi động. Dữ liệu tuyển sinh chỉ đọc; tài khoản và session nằm trong file auth DB riêng, nhỏ hơn nhiều.

## Yêu cầu

- Node.js 18 trở lên (khuyến nghị 20+).
- npm.
- Dữ liệu nguồn trong thư mục `data/` (đã có trong repo).

## Cài đặt và chạy

### 1. Backend

```bash
cd backend
npm install
npm run db:init    # chỉ chạy khi chưa có DB tuyển sinh hoặc khi muốn import lại từ data/
npm run dev        # http://localhost:3001
```

> **Cảnh báo:** `npm run db:init` **drop toàn bộ bảng tuyển sinh** và import lại từ `data/`. Không chạy khi đang có dữ liệu cần giữ. File DB tuyển sinh không được commit; nếu clone mới chưa có `backend/database/learnpath.db` thì bắt buộc phải chạy `db:init` trước `npm run dev`. Nếu chỉ chạy `npm run dev` khi chưa có DB, backend sẽ báo lỗi rõ ràng và yêu cầu chạy `db:init`; `db.js` không còn tự tạo schema cũ.

Auth DB tự được tạo ở `backend/database/auth.db` khi backend khởi động. Không cần chạy `db:init` cho auth. Có thể đổi đường dẫn bằng `LEARNPATH_AUTH_DB_PATH`; **không** trỏ biến này vào `learnpath.db` (server sẽ từ chối).

Để thử import mà không đụng DB thật, đặt biến môi trường `LEARNPATH_DB_PATH` trỏ tới một file tạm trước khi chạy `init.js`; không dùng biến này với đường dẫn DB thật.

Các biến môi trường chính:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3001` | Cổng backend |
| `LEARNPATH_DB_PATH` | `backend/database/learnpath.db` | File DB tuyển sinh |
| `LEARNPATH_AUTH_DB_PATH` | `backend/database/auth.db` | File DB tài khoản/session; phải khác DB tuyển sinh |
| `APP_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Origin được phép gọi auth API (không dùng `*`) |
| `NODE_ENV` | `development` | `production` bật cookie `Secure` |
| `TRUST_PROXY` | tắt | Đặt `1` khi chạy sau reverse proxy tin cậy |

Kiểm tra nhanh (data API trả `401` nếu chưa đăng nhập):

```powershell
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

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Vite proxy `/api` sang `http://localhost:3001`; không cần cấu hình CORS thêm khi chạy local. Mở `/dang-ky` để tạo tài khoản; `/`, `/dang-nhap`, `/dang-ky` công khai, còn `/de-an`, `/diem-chuan`, `/khoi-thi`, `/thu-hang` yêu cầu đăng nhập.

### 3. Build kiểm tra

```bash
cd frontend
npm run build
```

### 4. Kiểm tra DB tuyển sinh read-only

```bash
node .agents/scripts/inspect-db.js
```

Script chỉ đọc file DB tuyển sinh vào RAM, không ghi/sửa và không đụng auth DB. Output gồm: số bảng, schema, mapping trường, file khối bị bỏ qua, phân bố điểm và các gap đã biết.

## Cấu trúc dự án

```text
LearnPath/
├── AGENTS.md                 # Luật bắt buộc cho AI agent
├── .agents/                  # Tài liệu dự án, playbook, known issues, test, script
├── plans/                    # Kế hoạch tính năng (user-auth.md)
├── backend/
│   ├── server.js             # Khởi động Express + auth/CORS/security middleware
│   ├── database/             # learnpath.db + auth.db (đều không commit)
│   └── src/
│       ├── auth/             # authDb, password, session, rateLimit, origin, validation
│       ├── database/         # db.js (runtime) + init.js (schema/import)
│       └── routes/           # auth, diemChuan, deAn, khoiThi, diemThi
├── data/
│   ├── de_an_tuyen_sinh/     # 307 file Markdown
│   ├── diem_chuan/           # 9 file JSON (5 file điểm chuẩn + metadata)
│   ├── diem_thptqg_2026/      # CSV điểm thi
│   └── khoi_thi/             # TXT theo khối + theo trường
└── frontend/
    ├── public/               # video, logo
    └── src/
        ├── components/       # Layout, ProtectedRoute, IntroVideo, UI components
        ├── context/          # AuthContext
        ├── pages/            # 4 trang tính năng + AuthPage
        └── lib/              # axios client + auth API
```

## API chính

Base URL: `/api`. Response thành công thường có dạng `{ "data": ... }`; danh sách có thêm `total`. Trừ `/api/health` và `/api/auth/*`, mọi API dữ liệu đều trả `401` nếu thiếu session hợp lệ.

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Health check công khai |
| POST | `/api/auth/register` | Đăng ký (`username`, `password`, `passwordConfirm`), tự đăng nhập |
| POST | `/api/auth/login` | Đăng nhập (`username`, `password`) |
| GET | `/api/auth/me` | User hiện tại; `401` nếu chưa đăng nhập |
| POST | `/api/auth/logout` | Xoá session hiện tại |
| GET | `/api/de-an` | Danh sách đề án (`search`, `limit`, `offset`); `total` là tổng thật sau lọc |
| GET | `/api/de-an/:maTruong` | Chi tiết đề án + nội dung Markdown |
| GET | `/api/diem-chuan` | Điểm chuẩn (`truong`, `nganh`, `phuong_thuc`, `khoi_thi`, `ma_truong`, `sort`, `limit`, `offset`) |
| GET | `/api/diem-chuan/phuong-thuc` | Danh sách 5 phương thức |
| GET | `/api/diem-chuan/stats` | Thống kê điểm chuẩn |
| GET | `/api/diem-chuan/compare?ids=1,2` | So sánh các dòng điểm chuẩn |
| GET | `/api/khoi-thi` | Danh sách 245 khối trong DB hiện tại (281 sau rebuild) |
| GET | `/api/khoi-thi/:maKhoi` | Trường có khối đó (join `truong` + `diem_chuan`) |
| GET | `/api/khoi-thi/:maKhoi/truong/:maTruong` | Ngành của trường theo khối |
| GET | `/api/diem-thi/ranking` | Xếp hạng theo điểm nhập vào |
| GET | `/api/diem-thi/stats` | Thống kê điểm thi |

Chi tiết query, response và lỗi đã biết: [`.agents/ARCHITECTURE.md`](.agents/ARCHITECTURE.md).

## Tài khoản và bảo mật

- Tên đăng nhập: 3–32 ký tự ASCII (chữ, số, `.`, `_`, `-`), bắt đầu/kết thúc bằng chữ hoặc số; không phân biệt hoa thường khi đăng nhập.
- Mật khẩu: 8–128 ký tự, có ít nhất một chữ cái và một chữ số; phải nhập lại để xác nhận.
- Mật khẩu được băm bằng scrypt (`N=32768, r=8, p=1`) với salt riêng. Auth DB chỉ lưu hash, không lưu mật khẩu gốc.
- Session phía server, lưu hash SHA-256 của token; cookie `lp_session` là `HttpOnly`, `SameSite=Lax`, `Path=/`, hết hạn sau 7 ngày, bật `Secure` ở production. Frontend không lưu token trong localStorage/sessionStorage.
- Giới hạn đăng nhập: 5 lần sai theo IP + tên đăng nhập và 30 lần sai theo IP trong 15 phút; đăng ký 10 lần/IP/giờ. Bộ đếm nằm trong RAM, mỗi tiến trình.
- Đăng ký trùng tên trả `409` (có thể dùng để dò tên tồn tại); lỗi đăng nhập luôn chung chung.
- Chưa có: quên/đổi mật khẩu, xác minh email, MFA, phân quyền admin, CAPTCHA, CSP.
- Sao lưu `backend/database/auth.db` nếu cần giữ tài khoản. Production bắt buộc HTTPS, đặt `APP_ORIGIN` đúng origin thật và không dùng `TRUST_PROXY=1` nếu proxy không tin cậy.

## Dữ liệu

| Nguồn | Định dạng | Số lượng | Bảng đích |
|---|---|---|---|
| `data/de_an_tuyen_sinh/` | Markdown | 307 file | `de_an_tuyen_sinh` |
| `data/diem_chuan/scraped_tuyensinh*.json` | JSON | 37 school key / 2.617 mark | `diem_chuan` |
| `data/diem_thptqg_2026/diem_thi_THPTQG_2026.csv` | CSV (UTF-8 BOM) | 1.131.975 dòng | `diem_thi_thptqg` |
| `data/khoi_thi/theo_khoi_thi/` | TXT | 260 file → 245 DB hiện tại / 281 mã từ parser mới | `khoi_thi` |
| `data/khoi_thi/theo_truong/` | TXT | 260 file | `truong` |

### Cảnh báo dữ liệu đã xác minh (2026-10-23)

- Điểm chuẩn trong DB có `nam = 2025` cho toàn bộ 2.617 dòng, dù sản phẩm/UI hướng tới 2026.
- **35 mã trường có điểm chuẩn**, nhưng chỉ **33 mã join được** với bảng `truong`; **227/260 trường** không có dữ liệu điểm.
- **5 mã trường bị map sai** (`HCP`, `MTU`, `NHB`, `SKH`, `UEF`); `DNV` và `FPT` có điểm nhưng không có trong bảng `truong`. Tổng cộng 251 dòng bị ảnh hưởng.
- **853/2.617 dòng** thiếu `to_hop_mon` → không lọc được theo khối.
- **DB hiện tại chỉ có 245 khối** vì bản import cũ bỏ qua 15 file và không đọc header nhiều mã; parser mới đọc được **281 mã** và chỉ bỏ 1 file không có mã, nhưng chưa rebuild DB thật.
- Xếp hạng hiện so tổng các môn người dùng nhập với tổng **tất cả môn** của từng thí sinh → thứ hạng và biểu đồ sai. 110.632 thí sinh có tổng ≥ 30 còn bị bỏ khỏi phân bố. UI đã có cảnh báo, nhưng cách tính chưa được sửa.
- `so_truong` của khối là số trường ghi trong file nguồn, không phải số trường join được với điểm chuẩn (A00: 232 vs 25). UI đã tách hai con số này.

Danh sách đầy đủ các nhóm issue, mức ưu tiên và trạng thái: [`.agents/KNOWN_ISSUES.md`](.agents/KNOWN_ISSUES.md).

## Quy trình nâng cấp an toàn

1. Đọc `AGENTS.md` + tài liệu liên quan trong `.agents/`.
2. Phân loại thay đổi L0–L3; L3 (schema/mapping/dữ liệu/contract) phải hỏi user + backup.
3. Sửa đủ lớp: DB/init → API route → API client → UI → docs.
4. Chạy build + smoke API + `inspect-db.js`; ghi rõ bằng chứng.
5. Không commit/push trừ khi được yêu cầu.

Chi tiết quy trình 8 bước, vai trò subagent và checklist: [`.agents/AI_RULES.md`](.agents/AI_RULES.md).

## Triển khai production (chưa cấu hình)

Repo chưa có cấu hình deploy. Khi triển khai cần:

- Reverse proxy `/api` → backend và SPA fallback `index.html` cho frontend; bắt buộc HTTPS.
- Đặt `NODE_ENV=production`, `APP_ORIGIN=https://<domain-thật>`; chỉ đặt `TRUST_PROXY=1` sau proxy tin cậy.
- Cấp đủ RAM cho tiến trình backend vì `sql.js` nạp toàn bộ DB tuyển sinh (~109 MiB) vào RAM.
- Sao lưu `learnpath.db` trước khi chạy `db:init` hoặc thay đổi dữ liệu; sao lưu `auth.db` định kỳ nếu cần giữ tài khoản.
- Giới hạn quyền đọc/ghi file `auth.db` cho tiến trình backend; không public file này qua web server.
- Thêm health check và request logging. Rate limit auth hiện là bộ đếm RAM theo từng tiến trình, không dùng chung giữa nhiều instance.

## License

MIT
