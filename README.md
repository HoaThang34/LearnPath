# LearnPath - Hệ thống Tư vấn Hướng nghiệp

Hệ thống tư vấn hướng nghiệp giúp học sinh tìm ra ngành học và trường đại học phù hợp.

## Tính năng chính

- **Tra cứu đề án tuyển sinh**: Xem đề án tuyển sinh các trường đại học năm 2026
- **Điểm chuẩn**: Tra cứu điểm chuẩn theo trường, ngành
- **Khối thi**: Xem danh sách khối thi và các trường xét tuyển
- **Thứ hạng THPTQG**: Nhập điểm để biết thứ hạng của mình

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + SQLite
- **Charts**: Recharts

## Cài đặt

### Backend

```bash
cd backend
npm install
npm run db:init    # Khởi tạo database
npm run dev        # Chạy server development
```

Server sẽ chạy tại http://localhost:3001

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App sẽ chạy tại http://localhost:5173

## Cấu trúc dự án

```
LearnPath/
├── .gitignore
├── .agents/              # Thông tin dự án
├── backend/              # API Server
│   ├── src/
│   │   ├── routes/       # API routes
│   │   └── database/     # Database init
│   └── server.js
├── frontend/             # Client
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Pages
│   │   └── lib/          # Utilities
│   └── ...
└── data/                 # Raw data
```

## API Endpoints

- `GET /api/diem-chuan` - Điểm chuẩn
- `GET /api/de-an` - Đề án tuyển sinh
- `GET /api/khoi-thi` - Khối thi
- `GET /api/diem-thi/ranking` - Xếp hạng

## Dữ liệu

- **de_an_tuyen_sinh/**: Đề án tuyển sinh (Markdown)
- **diem_chuan/**: Điểm chuẩn (CSV)
- **diem_thptqg_2026/**: Điểm thi THPTQG 2026 (CSV)
- **khoi_thi/**: Khối thi (CSV + TXT)

## License

MIT
