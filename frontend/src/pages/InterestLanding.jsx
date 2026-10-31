import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, ClipboardList, Loader2, RotateCcw, Sparkles } from 'lucide-react'
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
          Holland/RIASEC và 4 cặp xu hướng · 108 câu · khoảng 12–15 phút
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
