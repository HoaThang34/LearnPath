import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Compass,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createInterestAttempt,
  getInterestAttempt,
  getInterestInstrument,
  resetInterest,
} from '@/lib/api'

export default function InterestLanding() {
  const navigate = useNavigate()
  const [instrument, setInstrument] = useState(null)
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [instrumentResponse, attemptResponse] = await Promise.all([
        getInterestInstrument(),
        getInterestAttempt(),
      ])
      setInstrument(instrumentResponse.data?.data || null)
      setState(attemptResponse.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải mô-đun sở thích nghề nghiệp.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const start = async () => {
    if (state?.draft) {
      navigate('/kham-pha-so-thich/lam-bai')
      return
    }
    setWorking(true)
    setError('')
    try {
      await createInterestAttempt({})
      navigate('/kham-pha-so-thich/lam-bai')
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể bắt đầu bài làm.')
    } finally {
      setWorking(false)
    }
  }

  const retake = async () => {
    if (!window.confirm('Đặt lại toàn bộ bài làm và kết quả sở thích hiện có?')) return
    setWorking(true)
    setError('')
    try {
      await resetInterest()
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể đặt lại kết quả.')
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải mô-đun sở thích...</span>
      </div>
    )
  }

  const status = state?.status || {}
  const hasResult = Boolean(status.hasResult)
  const hasDraft = Boolean(state?.draft)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {instrument?.title || 'Khám phá sở thích nghề nghiệp'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trắc nghiệm xu hướng tính cách & sở thích nghề nghiệp · 108 câu hỏi tự nhiên · khoảng 12–15 phút (tự lưu)
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Thẻ giải thích cho người không có chuyên môn */}
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-indigo-950">
            <HelpCircle className="h-5 w-5 text-indigo-600" />
            Tính năng này là gì và giúp gì cho bạn?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <p className="leading-relaxed">
            Khi chọn ngành học, điểm số chỉ giúp bạn biết mình <strong>đủ điểm đỗ trường nào (Vừa sức)</strong>. Nhưng bài trắc nghiệm này đóng vai trò như một chiếc la bàn giúp bạn trả lời câu hỏi cốt lõi: <strong>mình thực sự đam mê công việc dạng gì và phong cách làm việc nào khiến mình hạnh phúc, gắn bó dài lâu (Hợp ngành)</strong>.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
            <div className="rounded-lg border border-indigo-100/80 bg-white p-3 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-xs text-indigo-900 mb-1">
                <Target className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>1. Đo lường sở thích</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Đánh giá bạn hứng thú với việc: kỹ thuật máy móc, nghiên cứu tư duy, sáng tạo nghệ thuật, giao tiếp con người, lãnh đạo kinh doanh hay làm việc với số liệu quy củ.
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100/80 bg-white p-3 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-xs text-indigo-900 mb-1">
                <Compass className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>2. Xác định phong cách</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nhận biết bạn làm việc hiệu quả nhất khi: hướng ngoại hay độc lập, bám sát thực tế hay giàu ý tưởng, ra quyết định bằng logic hay cảm xúc, tuân thủ kế hoạch hay ứng biến linh hoạt.
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100/80 bg-white p-3 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-xs text-indigo-900 mb-1">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>3. Ghép nối ngành học</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hệ thống LearnPath sẽ tự động kết hợp <strong>Điểm thi học tập + Sở thích tính cách</strong> để gợi ý danh sách ngành học vừa sức đỗ vừa đúng đam mê.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-primary" />
            Bài làm gồm hai phần
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{instrument?.description}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Phần 1: 60 câu về mức độ thích các hoạt động, thang 1–5.</li>
            <li>Phần 2: 48 câu chọn giữa hai phát biểu, thang −2…+2.</li>
            <li>Bài được chia 10 chặng, tự lưu và có thể làm tiếp sau khi tải lại trang.</li>
            <li>Không có đáp án đúng/sai. Hãy trả lời theo sở thích tự nhiên trong thời gian gần đây.</li>
          </ul>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Lưu ý:</strong> {instrument?.disclaimer}
          </div>
          <p className="text-xs">
            Dữ liệu bài làm được lưu trong hồ sơ của bạn. Kết quả cá nhân chỉ hiển thị cho bạn; quản trị viên chỉ xem
            chi tiết khi cần và thao tác đó được ghi nhật ký. Bấm bắt đầu nghĩa là bạn đồng ý lưu dữ liệu này.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={working}>
          {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {hasDraft ? 'Làm tiếp bài đang dở' : hasResult ? 'Làm lại từ đầu' : 'Bắt đầu làm bài'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {hasResult && (
          <Link to="/kham-pha-so-thich/ket-qua">
            <Button variant="outline">Xem kết quả gần nhất</Button>
          </Link>
        )}
        {(hasResult || hasDraft) && (
          <Button variant="ghost" onClick={retake} disabled={working}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Đặt lại
          </Button>
        )}
      </div>

      {hasResult && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>
              Bạn đã có <strong>{status.submittedCount}</strong> kết quả sở thích đã nộp.
            </span>
            <Link to="/kham-pha-so-thich/ket-qua" className="font-semibold text-primary hover:underline">
              Xem kết quả →
            </Link>
          </CardContent>
        </Card>
      )}

      {hasDraft && (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Bạn có một bài làm đang dở. Bấm “Làm tiếp” để trở lại đúng chặng đã lưu.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
