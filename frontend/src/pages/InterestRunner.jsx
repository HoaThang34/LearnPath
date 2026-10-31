import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BipolarScale from '@/components/interest/BipolarScale'
import LikertScale from '@/components/interest/LikertScale'
import InterestProgress from '@/components/interest/InterestProgress'
import {
  createInterestAttempt,
  getInterestAttempt,
  getInterestInstrument,
  saveInterestResponses,
  submitInterestAttempt,
  updateInterestAttempt,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const PART1_GROUPS = ['R', 'I', 'A', 'S', 'E', 'C']
const PART2_PAIRS = ['EI', 'SN', 'TF', 'JP']
const NOTE_AFTER_ITEM = { 8: 24, 9: 36 }

function buildStages(instrument) {
  if (!instrument) return []
  const stages = []
  for (const code of PART1_GROUPS) {
    const group = instrument.groups.find((entry) => entry.code === code)
    stages.push({
      key: `riasec-${code}`,
      part: 'riasec',
      code,
      label: group?.label || code,
      shortLabel: code,
      items: instrument.items
        .filter((item) => item.part === 'riasec' && item.groupCode === code)
        .sort((a, b) => a.itemNo - b.itemNo),
    })
  }
  for (const code of PART2_PAIRS) {
    const pair = instrument.pairs.find((entry) => entry.code === code)
    stages.push({
      key: `pairs-${code}`,
      part: 'pairs',
      code,
      label: pair ? `${pair.title} (${pair.first}/${pair.second})` : code,
      shortLabel: code,
      items: instrument.items
        .filter((item) => item.part === 'pairs' && item.groupCode === code)
        .sort((a, b) => a.itemNo - b.itemNo),
    })
  }
  return stages
}

function stageProgress(stages, answers) {
  return stages.map((stage) => ({
    key: stage.key,
    label: stage.label,
    shortLabel: stage.shortLabel,
    total: stage.items.length,
    answered: stage.items.filter((item) => answers[item.id] !== undefined).length,
  }))
}

export default function InterestRunner() {
  const navigate = useNavigate()
  const [instrument, setInstrument] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [notes, setNotes] = useState({})
  const [step, setStep] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState(null)
  const [meta, setMeta] = useState({ giaiDoanHocTap: '', cauHoiNgheNghiep: '' })

  const pendingRef = useRef(new Set())
  const answersRef = useRef({})
  const savingRef = useRef(false)
  const attemptRef = useRef(null)

  const stages = useMemo(() => buildStages(instrument), [instrument])
  const progress = useMemo(() => stageProgress(stages, answers), [stages, answers])

  const flush = useCallback(async () => {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || savingRef.current) return
    if (pendingRef.current.size === 0) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      while (pendingRef.current.size > 0) {
        const ids = [...pendingRef.current].slice(0, 30)
        const responses = ids.map((id) => ({ itemId: Number(id), value: answersRef.current[id] }))
        await saveInterestResponses(currentAttempt.id, responses)
        for (const id of ids) pendingRef.current.delete(id)
      }
      setLastSaved(new Date())
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu câu trả lời. Dữ liệu đang chờ sẽ được thử lại.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [instrumentResponse, attemptResponse] = await Promise.all([
          getInterestInstrument(),
          getInterestAttempt(),
        ])
        if (cancelled) return
        const loadedInstrument = instrumentResponse.data?.data
        let state = attemptResponse.data?.data
        if (!state?.draft) {
          const created = await createInterestAttempt({})
          state = created.data?.data
        }
        if (!state?.draft) throw new Error('Không tạo được bài làm.')
        const map = {}
        for (const row of state.responses || []) map[row.itemId] = row.value
        const loadedStages = buildStages(loadedInstrument)
        const firstIncomplete = loadedStages.findIndex((stage) =>
          stage.items.some((item) => map[item.id] === undefined)
        )
        setInstrument(loadedInstrument)
        setAttempt(state.draft)
        attemptRef.current = state.draft
        setAnswers(map)
        answersRef.current = map
        const noteMap = {}
        for (const note of state.draft.notes || []) {
          if (note && note.afterItem) noteMap[note.afterItem] = note.text
        }
        setNotes(noteMap)
        setMeta({
          giaiDoanHocTap: state.draft.giaiDoanHocTap || '',
          cauHoiNgheNghiep: state.draft.cauHoiNgheNghiep || '',
        })
        setStep(
          Object.keys(map).length === 0 && !state.draft.giaiDoanHocTap && !state.draft.cauHoiNgheNghiep
            ? 0
            : firstIncomplete === -1
            ? 11
            : firstIncomplete + 1
        )
        setCurrentIndex(0)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Không thể tải bài làm.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!attempt) return undefined
    if (pendingRef.current.size === 0) return undefined
    const timer = setTimeout(() => flush(), 800)
    return () => clearTimeout(timer)
  }, [answers, attempt, flush])

  useEffect(() => {
    if (!attempt) return undefined
    const timer = setTimeout(() => {
      const payload = Object.entries(notes)
        .filter(([, text]) => text && text.trim())
        .map(([afterItem, text]) => ({ afterItem: Number(afterItem), text }))
      updateInterestAttempt(attempt.id, { notes: payload }).catch((err) => {
        setError(err.response?.data?.error || 'Không thể lưu ghi chú tuỳ chọn.')
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [notes, attempt])

  const flushAll = useCallback(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (!savingRef.current) {
        await flush()
        if (!savingRef.current && pendingRef.current.size === 0) return true
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return !savingRef.current && pendingRef.current.size === 0
  }, [flush])

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (pendingRef.current.size === 0 || !attemptRef.current) return
      const ids = [...pendingRef.current].slice(0, 30)
      const body = JSON.stringify({
        responses: ids.map((id) => ({ itemId: Number(id), value: answersRef.current[id] })),
      })
      try {
        fetch(`/api/interest/attempt/${attemptRef.current.id}/responses`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
          body,
        })
      } catch (err) {
        // The browser may block keepalive requests during unload; the draft on the server stays valid.
      }
      event.preventDefault()
      event.returnValue = ''
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  const setAnswer = (item, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [item.id]: value }
      answersRef.current = next
      return next
    })
    pendingRef.current.add(item.id)
  }

  const currentStage = step >= 1 && step <= 10 ? stages[step - 1] : null
  const currentItem = currentStage?.items[currentIndex] || null

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!currentStage) return
      const tag = (event.target?.tagName || '').toUpperCase()
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (event.key === 'ArrowRight') {
        setCurrentIndex((index) => Math.min(index + 1, currentStage.items.length - 1))
        event.preventDefault()
        return
      }
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((index) => Math.max(index - 1, 0))
        event.preventDefault()
        return
      }
      if (event.key === 'Enter') {
        setCurrentIndex((index) => Math.min(index + 1, currentStage.items.length - 1))
        event.preventDefault()
        return
      }
      if (/^[1-5]$/.test(event.key) && currentItem) {
        const numeric = Number(event.key)
        const value = currentStage.part === 'riasec' ? numeric : numeric - 3
        setAnswer(currentItem, value)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentStage, currentItem])

  const goToStep = async (next) => {
    if (next >= 1 && next <= 10) {
      await flushAll()
      setStep(next)
      const stage = stages[next - 1]
      const firstUnanswered = stage?.items.findIndex((item) => answers[item.id] === undefined)
      setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      await flushAll()
      setStep(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const saveMeta = async () => {
    if (!attempt) return
    try {
      await updateInterestAttempt(attempt.id, meta)
      await goToStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu thông tin đầu bài.')
    }
  }

  const submit = async () => {
    if (!attempt) return
    setSubmitting(true)
    setSubmitError(null)
    setError('')
    try {
      const flushed = await flushAll()
      if (!flushed) {
        setError('Còn câu trả lời chưa lưu được. Vui lòng kiểm tra kết nối và thử nộp lại.')
        return
      }
      const payload = {
        notes: Object.entries(notes)
          .filter(([, text]) => text && text.trim())
          .map(([afterItem, text]) => ({ afterItem: Number(afterItem), text })),
      }
      await submitInterestAttempt(attempt.id, payload)
      navigate(`/kham-pha-so-thich/ket-qua?attemptId=${attempt.id}`)
    } catch (err) {
      if (err.response?.status === 409) {
        setSubmitError(err.response.data)
        setStep(11)
      } else {
        setError(err.response?.data?.error || 'Không thể nộp bài. Dữ liệu vẫn được giữ trên máy chủ.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải bài làm...</span>
      </div>
    )
  }

  if (!instrument || !attempt) {
    return (
      <div role="alert" className="mx-auto max-w-2xl rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Không thể tải bài làm.'}
      </div>
    )
  }

  const answeredTotal = progress.reduce((sum, stage) => sum + stage.answered, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 print:pb-0">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {instrument.title}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {step >= 1 && step <= 10
            ? `Chặng ${step}/10 · ${currentStage?.label}`
            : step === 11
            ? 'Rà soát trước khi nộp'
            : 'Thông tin đầu bài'}
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step >= 1 && step <= 10 && (
        <Card>
          <CardContent className="p-4">
            <InterestProgress
              stages={progress}
              currentIndex={step - 1}
              onSelect={(index) => goToStep(index + 1)}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span aria-live="polite">
                {saving ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Đang lưu...
                  </span>
                ) : lastSaved ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Đã lưu lúc {lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span>Bài làm được tự lưu khi chuyển chặng.</span>
                )}
              </span>
              <span>{answeredTotal}/108 câu</span>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin đầu bài</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {instrument.disclaimer}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="giai-doan">Giai đoạn học tập</Label>
              <Input
                id="giai-doan"
                value={meta.giaiDoanHocTap}
                onChange={(event) => setMeta({ ...meta, giaiDoanHocTap: event.target.value })}
                placeholder="Ví dụ: Lớp 11, đang tìm hiểu nhóm ngành kỹ thuật"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cau-hoi-nghe">Câu hỏi nghề nghiệp tôi muốn làm rõ</Label>
              <textarea
                id="cau-hoi-nghe"
                value={meta.cauHoiNgheNghiep}
                onChange={(event) => setMeta({ ...meta, cauHoiNgheNghiep: event.target.value })}
                placeholder="Ví dụ: Tôi nên chọn giữa kỹ thuật phần mềm và khoa học dữ liệu?"
                maxLength={1000}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <Button onClick={saveMeta}>
              Bắt đầu làm bài
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{currentStage.label}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {currentStage.part === 'riasec'
                ? 'Chọn mức độ bạn thích làm hoạt động này. Không có đáp án đúng/sai.'
                : 'Chọn phía bạn nghiêng về. Hai phát biểu không nhất thiết trái ngược hoàn toàn.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {currentStage.items.map((item, index) => {
              const value = answers[item.id]
              return (
                <fieldset
                  key={item.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    index === currentIndex ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border'
                  )}
                  onClick={() => setCurrentIndex(index)}
                >
                  <legend className="px-1 text-xs font-semibold text-muted-foreground">
                    Câu {currentStage.part === 'riasec' ? item.itemNo : item.itemNo}
                  </legend>
                  {currentStage.part === 'riasec' ? (
                    <>
                      <p className="mb-2.5 text-sm font-medium text-foreground">{item.promptText}</p>
                      <LikertScale
                        value={value}
                        labels={instrument.likertLabels}
                        onChange={(next) => setAnswer(item, next)}
                      />
                    </>
                  ) : (
                    <>
                      <div className="mb-2.5 grid gap-1.5 text-sm sm:grid-cols-2">
                        <p className="rounded-md bg-slate-50 p-2">
                          <span className="mr-1 text-[10px] font-bold uppercase text-muted-foreground">Trái</span>
                          {item.leftText}
                        </p>
                        <p className="rounded-md bg-slate-50 p-2">
                          <span className="mr-1 text-[10px] font-bold uppercase text-muted-foreground">Phải</span>
                          {item.rightText}
                        </p>
                      </div>
                      <BipolarScale
                        value={value}
                        labels={instrument.bipolarLabels}
                        onChange={(next) => setAnswer(item, next)}
                      />
                    </>
                  )}
                </fieldset>
              )
            })}

            {NOTE_AFTER_ITEM[step] && (
              <div className="space-y-1.5 rounded-lg border border-dashed p-3">
                <Label htmlFor={`note-${step}`}>Một tình huống có thể khiến tôi chọn khác (tuỳ chọn)</Label>
                <textarea
                  id={`note-${step}`}
                  rows={2}
                  value={notes[NOTE_AFTER_ITEM[step]] || ''}
                  onChange={(event) =>
                    setNotes({ ...notes, [NOTE_AFTER_ITEM[step]]: event.target.value })
                  }
                  placeholder="Ví dụ: Nếu làm việc trong môi trường yên tĩnh, tôi sẽ chọn khác..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 11 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rà soát trước khi nộp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submitError && (
              <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">{submitError.error}</p>
                {Array.isArray(submitError.details?.missingGroups) && submitError.details.missingGroups.length > 0 && (
                  <p className="mt-1 text-xs">
                    Nhóm còn thiếu: {submitError.details.missingGroups.map((row) => `${row.code} (${row.answered}/${row.required})`).join(', ')}
                  </p>
                )}
                {Array.isArray(submitError.details?.missingPairs) && submitError.details.missingPairs.length > 0 && (
                  <p className="mt-1 text-xs">
                    Cặp còn thiếu: {submitError.details.missingPairs.map((row) => `${row.code} (${row.answered}/${row.required})`).join(', ')}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              {progress.map((stage, index) => (
                <div key={stage.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    <strong className="mr-2">{stage.shortLabel}</strong>
                    {stage.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={stage.answered === stage.total ? 'text-emerald-700' : 'text-amber-700'}>
                      {stage.answered}/{stage.total}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => goToStep(index + 1)}>
                      Sửa
                    </Button>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Để có kết quả đầy đủ, nên trả lời hết 108 câu. Bài nộp cần mỗi nhóm ≥ 8/10 câu và mỗi cặp đủ 12/12 câu.
              Tỉ lệ phù hợp tính cách chỉ dùng nhóm trả lời đủ 10/10 câu (cần ít nhất 4 nhóm).
            </p>
            <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Nộp bài
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button
          variant="outline"
          onClick={() => goToStep(step === 0 ? 0 : step - 1)}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>
        <div className="flex items-center gap-2">
          {step >= 1 && step <= 10 && step < 10 && (
            <Button onClick={() => goToStep(step + 1)} disabled={saving || submitting}>
              Chặng tiếp
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step >= 1 && step <= 10 && step === 10 && (
            <Button onClick={() => goToStep(11)} disabled={saving || submitting}>
              Rà soát
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step === 11 && (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Nộp bài
            </Button>
          )}
          {step === 0 && (
            <Button variant="ghost" onClick={saveMeta}>
              <Save className="mr-2 h-4 w-4" />
              Lưu và tiếp tục
            </Button>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">{instrument.disclaimer}</p>
      {pendingRef.current.size > 0 && (
        <p className="text-[11px] text-amber-700">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          Còn {pendingRef.current.size} câu chưa lưu. Hãy chuyển chặng hoặc chờ vài giây.
        </p>
      )}
    </div>
  )
}
