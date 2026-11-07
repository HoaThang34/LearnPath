import { Shield, Sparkles, CheckCircle2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'

export default function ConsentDialog({ onAccept, onCancel, accepting = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-teal-200 shadow-xl animate-in fade-in-50 zoom-in-95 duration-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg font-bold text-slate-900">
            Kích hoạt Trợ lý AI cá nhân hóa
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Tìm hiểu cách Trợ lý AI sử dụng dữ liệu để tư vấn chính xác nhất cho bạn
          </p>
        </CardHeader>

        <CardContent className="space-y-3 text-xs text-slate-700 py-3">
          <div className="flex gap-2.5 items-start bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Đọc thông tin học tập & sở thích:</strong>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Trợ lý sẽ truy cập điểm học bạ, điểm thi tự khai, kết quả trắc nghiệm sở thích (Holland RIASEC) và nguyện vọng để đưa ra phân tích phù hợp nhất.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-start bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Lock className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Bảo vệ quyền riêng tư:</strong>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Hệ thống <strong>không gửi họ tên, tên tài khoản</strong> hay thông tin định danh cá nhân của bạn ra ngoài. Dữ liệu chỉ dùng để phân tích trong phiên hỏi đáp.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-start bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Chỉ đọc, không can thiệp:</strong>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Trợ lý chỉ có quyền xem dữ liệu để tư vấn, không tự ý chỉnh sửa hồ sơ hay điểm số của bạn trên hệ thống.
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={accepting}
            className="flex-1 text-xs"
          >
            Để sau
          </Button>
          <Button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="flex-1 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium"
          >
            {accepting ? 'Đang lưu...' : 'Tôi đồng ý & Bắt đầu'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
