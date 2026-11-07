import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Building2,
  Sparkles,
  Users,
  Bot,
  Zap,
  CheckCircle2,
  HelpCircle,
  X,
  Rotate3d,
  Play,
  Eye,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Factory3DCanvas from './Factory3DCanvas'

export default function CasualAutomationGame({ simData, onBackToHub }) {
  // Pop up modal intro shown before playing
  const [showIntroModal, setShowIntroModal] = useState(true)

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 relative">
      {/* ================= POPUP MODAL GIỚI THIỆU & CÁCH CHƠI Ở GIỮA MÀN HÌNH ================= */}
      {showIntroModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-cyan-500/50 p-6 sm:p-7 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-200">
            {/* Close 'X' button */}
            <button
              onClick={() => setShowIntroModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/30">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Mô Phỏng Nghề Nghiệp 3D
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
                Kỹ thuật Điều khiển & Tự động hóa
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Chào mừng bạn đến với mô phỏng <strong>Nhà Máy Thông Minh 3D</strong>! Trò chơi này
                giúp bạn hiểu ngay công việc thực tế của một kỹ sư chỉ trong 2 phút mà{' '}
                <strong>không cần bất kỳ kiến thức kỹ thuật nào trước đó</strong>.
              </p>
            </div>

            {/* Step-by-step visual instructions */}
            <div className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs">
              <span className="font-bold text-cyan-400 uppercase tracking-wider block text-[11px]">
                Cách chơi siêu đơn giản (3 bước):
              </span>

              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                  1
                </div>
                <div>
                  <strong className="text-slate-100 block">Xoay không gian 3D 360 độ</strong>
                  <span className="text-slate-400">
                    Kéo chuột hoặc vuốt tay trên màn hình để ngắm toàn cảnh nhà máy và robot từ mọi hướng.
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-950 text-amber-400 border border-amber-800 font-bold">
                  2
                </div>
                <div>
                  <strong className="text-slate-100 block">Bấm 4 nút điều khiển bên dưới</strong>
                  <span className="text-slate-400">
                    Lần lượt bấm: Bật nguồn ➔ Bật mắt thần laser ➔ Bật cánh tay Robot ➔ Bật tự gạt lon lỗi.
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                  3
                </div>
                <div>
                  <strong className="text-slate-100 block">Khám phá điều kỳ diệu</strong>
                  <span className="text-slate-400">
                    Xem robot và cảm biến tự động làm việc thay thế hàng chục công nhân bốc vác vất vả!
                  </span>
                </div>
              </div>
            </div>

            {/* Big Action Button to Start */}
            <Button
              onClick={() => setShowIntroModal(false)}
              className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold py-3 text-xs sm:text-sm shadow-xl rounded-xl gap-2 transition-all transform hover:scale-[1.01]"
            >
              <Play className="h-4 w-4 fill-white" /> SẴN SÀNG, BẮT ĐẦU CHƠI NGAY!
            </Button>
          </div>
        </div>
      )}

      {/* Top Bar: Return to Hub & Help Guide Button */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-md text-white">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
        >
          <span className="text-base">←</span> Quay lại Menu các ngành
        </button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIntroModal(true)}
            className="text-xs border-slate-700 bg-slate-800 text-cyan-300 hover:bg-slate-700 gap-1.5 h-8"
          >
            <HelpCircle className="h-3.5 w-3.5 text-cyan-400" /> Hướng dẫn chơi
          </Button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-slate-200">
              Kỹ thuật Điều khiển & Tự động hóa
            </span>
          </div>
        </div>
      </div>

      {/* Hero Interactive 3D Factory Canvas */}
      <Factory3DCanvas />

      {/* Visual Comparison: Trước đây vs Ngày nay (MÀU CHỮ ĐÃ ĐƯỢC ĐIỀU CHỈNH RÕ RÀNG, ĐỘ TƯƠNG PHẢN CAO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trước đây - Thẻ màu hồng đậm, chữ tương phản cao sắc nét */}
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-rose-800 font-bold text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-200 text-rose-700 shadow-xs">
              <Users className="h-4 w-4" />
            </div>
            <span>Trước đây: Sản xuất thủ công truyền thống</span>
          </div>
          <ul className="text-xs space-y-2 text-slate-800 font-medium leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-200 text-rose-700 font-bold text-[10px] mt-0.5">
                ✗
              </span>
              <span>Cần 20 - 30 công nhân đứng gập lưng bốc vác mệt nhọc cả ngày</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-200 text-rose-700 font-bold text-[10px] mt-0.5">
                ✗
              </span>
              <span>Tốc độ chậm, mắt người mỏi mệt dễ bỏ sót sản phẩm lỗi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-200 text-rose-700 font-bold text-[10px] mt-0.5">
                ✗
              </span>
              <span>Công việc chân tay nặng nhọc, độc hại và nguy cơ tai nạn cao</span>
            </li>
          </ul>
        </div>

        {/* Ngày nay - Thẻ màu xanh ngọc, chữ tương phản cao sắc nét */}
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-emerald-800 font-bold text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-200 text-emerald-700 shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <span>Ngày nay: Có Kỹ sư Tự động hóa</span>
          </div>
          <ul className="text-xs space-y-2 text-slate-800 font-medium leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 font-bold text-[10px] mt-0.5">
                ✓
              </span>
              <span>1 Kỹ sư ngồi phòng điều hòa giám sát dây chuyền qua máy tính</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 font-bold text-[10px] mt-0.5">
                ✓
              </span>
              <span>Robot gắp 1.000 sản phẩm/giờ, cảm biến quét lỗi siêu tốc độ</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 font-bold text-[10px] mt-0.5">
                ✓
              </span>
              <span>Công việc trí tuệ, làm chủ công nghệ cao, mức lương hấp dẫn</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 3 Quick Facts Cards (3 con số biết nói - Đơn giản dễ hiểu cho người mới) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Fact 1: Lương */}
        <Card className="border-slate-800 bg-slate-900 text-white shadow-md">
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Mức lương khởi điểm
            </span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">10 - 16 Triệu</div>
            <p className="text-[11px] text-slate-400">
              Sau 3 năm (khi đã làm chủ robot và hệ thống): <strong>20 - 35+ Triệu/tháng</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Fact 2: Nơi làm việc */}
        <Card className="border-slate-800 bg-slate-900 text-white shadow-md">
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-cyan-400" /> Nơi làm việc tiêu biểu
            </span>
            <div className="text-lg font-bold text-slate-100 truncate">
              VinFast, Samsung, Foxconn
            </div>
            <p className="text-[11px] text-slate-400">
              Các hãng công nghệ toàn cầu: <strong>Siemens, Schneider, ABB</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Fact 3: Môn học cấp 3 */}
        <Card className="border-slate-800 bg-slate-900 text-white shadow-md">
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Cần học tốt môn gì ở cấp 3?
            </span>
            <div className="text-lg font-bold text-amber-400 font-mono">Toán & Vật Lý</div>
            <p className="text-[11px] text-slate-400">
              Xét tuyển tổ hợp <strong>A00 (Toán-Lý-Hóa)</strong> hoặc <strong>A01 (Toán-Lý-Anh)</strong>.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* University Curriculum Shortcut Card */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-200">
              Muốn trở thành Kỹ sư Tự động hóa thì vào đại học sẽ học những môn gì?
            </h4>
            <p className="text-xs text-slate-400">
              Xem toàn bộ khung chương trình đào tạo của Đại học Bách khoa Hà Nội tại LearnPath.
            </p>
          </div>
        </div>

        <Link to="/chuong-trinh-hoc">
          <Button className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md gap-1.5 whitespace-nowrap">
            <BookOpen className="h-3.5 w-3.5" /> Xem khung môn học <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
