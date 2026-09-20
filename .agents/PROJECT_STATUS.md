# LearnPath - Trạng Thái Dự Án

## Thông Tin Chung
- **Tên dự án:** LearnPath - Hệ thống tư vấn hướng nghiệp
- **Ngày tạo:** 2026-09-21
- **Phiên bản:** v1.0.0

## Tech Stack
- **Frontend:** React + Vite + shadcn/ui
- **Backend:** Express.js + SQLite
- **Ngôn ngữ:** Node.js

## Cấu Trúc Dự Án
```
LearnPath/
├── .gitignore
├── .agents/          # Thông tin dự án cho các session
├── backend/          # API Server (Express.js)
├── frontend/         # Client (React + Vite)
└── data/             # Dữ liệu gốc (CSV, MD, TXT)
```

## Dữ Liệu Hiện Có
1. **de_an_tuyen_sinh/** - Đề án tuyển sinh các trường ĐH (Markdown)
2. **diem_chuan/** - Điểm chuẩn các trường (CSV)
3. **diem_thptqg_2026/** - Điểm thi THPTQG 2026 (CSV)
4. **khoi_thi/** - Khối thi (CSV + TXT theo trường)

## Các Trang Web
1. **Trang chủ** - Giới thiệu + Menu chính
2. **Tra cứu đề án tuyển sinh** - Tìm kiếm theo trường/ngành
3. **Điểm chuẩn** - Xem điểm chuẩn theo trường/ngành/năm
4. **Khối thi** - Xem tổ hợp môn và trường ĐH xét tuyển
5. **Tra cứu thứ hạng** - Nhập điểm THPTQG → biết thứ hạng

## Việc Cần Làm

### Session 1 (Hoàn thành)
- [x] Setup Backend (Express.js + SQLite)
- [x] Setup Frontend (React + Vite + shadcn/ui)
- [x] Import dữ liệu vào SQLite
- [x] Xây API endpoints
- [x] Xây các trang UI cơ bản
- [x] Tích hợp API với Frontend
- [x] Tạo .gitignore
- [x] Tạo .agents/PROJECT_STATUS.md

### Session 2 (Hoàn thành)
- [x] Thêm cột `phuong_thuc` vào bảng diem_chuan
- [x] Parse tên phương thức từ filename CSV
- [x] Normalize 12 phương thức xét tuyển
- [x] API filter theo phương thức, khối thi, nhóm ngành
- [x] API sort theo điểm, tên
- [x] Frontend: Bước 1 chọn phương thức → Bước 2 lọc + sắp xếp
- [x] Fix school name parsing cho file "Xem thêm"

### Session Tương Lai
- [ ] Cải thiện UI/UX
- [ ] Thêm chức năng so sánh trường
- [ ] Thêm biểu đồ phân tích
- [ ] Tối ưu performance
- [ ] Deploy lên server

## Hướng Dẫn Chạy Dự Án

### Backend
```bash
cd backend
npm install
npm run db:init    # Import dữ liệu vào SQLite
npm run dev        # Chạy server tại http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Chạy app tại http://localhost:5173
```

## Kiểm Tra Định Kỳ
- [ ] Kiểm tra dữ liệu CSV có cập nhật mới không
- [ ] Kiểm tra API endpoint hoạt động đúng
- [ ] Kiểm tra frontend hiển thị đúng dữ liệu
- [ ] Cập nhật .agents/PROJECT_STATUS.md khi có thay đổi

## Cập Nhật
| Ngày | Phiên bản | Mô tả |
|------|-----------|-------|
| 2026-09-21 | v1.0.0 | Khởi tạo dự án, hoàn thành backend + frontend cơ bản |
