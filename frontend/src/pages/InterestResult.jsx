import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Loader2, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import InterestChart from '@/components/interest/InterestChart'
import BipolarAxisChart from '@/components/interest/BipolarAxisChart'
import { describePair } from '@/lib/bipolar'
import { getInterestLatestResult, getInterestResult } from '@/lib/api'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function InterestResult() {
  const [searchParams] = useSearchParams()
  const attemptId = searchParams.get('attemptId')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = attemptId
        ? await getInterestResult(attemptId)
        : await getInterestLatestResult()
      setResult(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải kết quả sở thích.')
    } finally {
      setLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải kết quả...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-2xl rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-16 text-center">
        <h1 className="text-xl font-bold">Chưa có kết quả sở thích</h1>
        <p className="text-sm text-muted-foreground">Hãy hoàn thành bài khám phá sở thích trước khi xem kết quả.</p>
        <Link to="/kham-pha-so-thich">
          <Button>Bắt đầu làm bài</Button>
        </Link>
      </div>
    )
  }

  const answered = 108 - Number(result.unansweredCount || 0)
  const topGroups = result.part1.ranking || []
  const interpretation = result.interpretation || {}

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kết quả khám phá sở thích nghề nghiệp</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Nộp lúc {formatDate(result.submittedAt)} · Phiên bản thuật toán {result.algorithmVersion}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            In / PDF
          </Button>
          <Link to="/kham-pha-so-thich">
            <Button variant="ghost">
              <RotateCcw className="mr-2 h-4 w-4" />
              Làm lại
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Đã trả lời <strong>{answered}/108</strong> câu
              {result.completeness === 'partial' && ` · còn ${result.unansweredCount} câu chưa trả lời`}
            </span>
            <span className="rounded-full border px-2.5 py-0.5 text-xs">
              {result.completeness === 'full' ? 'Đủ dữ liệu' : 'Một phần dữ liệu'}
            </span>
          </div>
          {result.completeness === 'partial' && (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Một số nhóm/cặp chưa đủ câu trả lời nên không được xếp hạng hoặc không tính D. Đây không phải điểm 0.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="print-avoid-break">
        <CardHeader>
          <CardTitle className="text-base">Phần 1 — Sáu nhóm sở thích</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nhóm sở thích nổi bật: {topGroups.length ? topGroups.join(', ') : 'chưa đủ dữ liệu để xếp hạng'}
            {result.part1.code ? ` · Mã tham khảo ${result.part1.code}` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <InterestChart groups={result.part1.groups} pairs={result.part2.pairs} topGroups={topGroups} />
        </CardContent>
      </Card>

      <Card className="print-avoid-break">
        <CardHeader>
          <CardTitle className="text-base">Phần 2 — Bốn cặp xu hướng</CardTitle>
          <p className="text-xs text-muted-foreground">
            Mã tham khảo Phần 2: <strong>{result.part2.referenceCode}</strong> · D là chênh lệch xu hướng trả lời,
            không phải điểm mạnh hay mức độ của một phẩm chất.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <BipolarAxisChart pairs={result.part2.pairs} />
            <div className="space-y-2 text-sm">
              {result.part2.pairs.map((pair) => (
                <div key={pair.code} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="font-medium">
                    {pair.first} — {pair.second}
                  </span>
                  <span className="text-xs text-muted-foreground">{describePair(pair).text}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="print-avoid-break">
        <CardHeader>
          <CardTitle className="text-base">Chủ đề phản tư</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {interpretation.themes?.length ? (
            interpretation.themes.map((theme) => (
              <div key={theme.groupCode}>
                <h3 className="font-semibold text-foreground">{theme.title}</h3>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {theme.prompts.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Chưa đủ dữ liệu để gợi ý chủ đề phản tư.</p>
          )}
          {interpretation.pairThemes?.length > 0 && (
            <div className="border-t pt-3">
              <h3 className="font-semibold">Về bốn cặp xu hướng</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {interpretation.pairThemes.map((theme) => (
                  <li key={theme.code}>
                    <strong>{theme.title}:</strong> {theme.prompts.join(' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
            <p className="font-semibold">Bước tiếp theo</p>
            <p className="mt-1 text-muted-foreground">
              Xem danh sách ngành trong Phân tích năng lực để đối chiếu sở thích với yêu cầu học lực. Tỉ lệ phù hợp
              tính cách là chỉ báo khám phá, không phải kết luận tuyển sinh.
            </p>
            <Link to="/phan-tich-nang-luc" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Xem ngành trong Phân tích năng lực
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Miễn trừ và nguồn tham khảo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            {interpretation.disclaimer}
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            {(interpretation.sources || []).map((source) => (
              <li key={source.id}>
                {source.title} —{' '}
                <a href={source.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  {source.url}
                </a>
                {source.note ? ` · ${source.note}` : ''}
              </li>
            ))}
          </ol>
          <p>Ngày tra cứu nguồn: 30/10/2026.</p>
        </CardContent>
      </Card>
    </div>
  )
}
