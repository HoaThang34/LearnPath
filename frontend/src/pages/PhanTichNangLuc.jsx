import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeftRight, Bookmark, Check, CheckCircle2, ChevronDown, ChevronUp,
  Info, Loader2, RotateCcw, Search, Sliders, Sparkles, Target, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import {
  addCareerSelection, getCareerMajors, getCareerOverview, removeCareerSelection,
  getUserProfile,
} from '@/lib/api'

function RadarChart({ details = [], simulated = null }) {
  const safeDetails = Array.isArray(details) ? details : []
  const size = 220
  const center = size / 2
  const radius = 76

  const points = (kind) => safeDetails.map((item, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(safeDetails.length, 1)
    let raw = item.threshold
    if (kind === 'student') {
      raw = item.score
    } else if (kind === 'simulated') {
      raw = simulated?.[item.subject] ?? item.score
    }
    const value = Math.max(0, Math.min(Number(raw || 0) / 10, 1))
    const r = radius * value
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`
  }).join(' ')

  const hasSimulated = simulated && Object.keys(simulated).length > 0

  return (
    <div className="my-3 flex justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-56 w-56" role="img" aria-label="Biểu đồ radar năng lực và ngưỡng rubric">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle key={scale} cx={center} cy={center} r={radius * scale} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {safeDetails.map((item, index) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(safeDetails.length, 1)
          const x = center + Math.cos(angle) * (radius + 20)
          const y = center + Math.sin(angle) * (radius + 20)
          return (
            <g key={item.subject}>
              <line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="#cbd5e1" strokeDasharray="2 2" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="500" fill="#475569">
                {item.subject}
              </text>
            </g>
          )
        })}
        {safeDetails.length >= 2 && (
          <>
            {/* Ngưỡng rubric */}
            <polygon points={points('threshold')} fill="rgba(249,115,22,0.12)" stroke="#f97316" strokeDasharray="4 3" strokeWidth="2" />
            {/* Điểm học sinh thực tế */}
            <polygon points={points('student')} fill="rgba(37,99,235,0.2)" stroke="#2563eb" strokeWidth="2" />
            {/* Điểm mô phỏng nếu có */}
            {hasSimulated && (
              <polygon points={points('simulated')} fill="rgba(147,51,234,0.18)" stroke="#9333ea" strokeDasharray="3 2" strokeWidth="2" />
            )}
          </>
        )}
      </svg>
    </div>
  )
}

function getFitBadge(fitPct) {
  if (fitPct === null || fitPct === undefined) {
    return { label: 'Chưa đủ dữ liệu', color: 'bg-slate-100 text-slate-700 border-slate-300' }
  }
  if (fitPct >= 90) {
    return { label: 'Rất phù hợp', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
  }
  if (fitPct >= 75) {
    return { label: 'Phù hợp', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  }
  return { label: 'Cần nỗ lực', color: 'bg-amber-100 text-amber-800 border-amber-300' }
}

export default function PhanTichNangLuc() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [profile, setProfile] = useState(null)
  const [majors, setMajors] = useState([])
  const [majorTotal, setMajorTotal] = useState(0)
  const [majorPage, setMajorPage] = useState(1)
  const [scores, setScores] = useState([])
  const [filters, setFilters] = useState({ search: '', school: '', method: '', block: '', sort: 'score_desc' })
  const [snapshot, setSnapshot] = useState({ classLevel: '', term: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const requestId = useRef(0)

  // Rubric Section States
  const [rubricTab, setRubricTab] = useState('all') // 'all' | 'saved'
  const [rubricSearch, setRubricSearch] = useState('')
  const [simulatedScores, setSimulatedScores] = useState({}) // { [rubricId]: { [subject]: score } }
  const [expandedSimulation, setExpandedSimulation] = useState({}) // { [rubricId]: boolean }
  const [comparingRubrics, setComparingRubrics] = useState([]) // array of max 2 rubricIds
  const [showCompareModal, setShowCompareModal] = useState(false)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true); setError('')
    try {
      const [overviewResponse, majorsResponse, profileResponse] = await Promise.all([
        getCareerOverview(snapshot),
        getCareerMajors({ ...filters, classLevel: snapshot.classLevel, term: snapshot.term, limit: 20, offset: (majorPage - 1) * 20 }),
        getUserProfile(),
      ])
      if (currentRequest !== requestId.current) return
      const data = overviewResponse.data?.data || {}
      const loadedScores = data.scores || []
      setOverview(data)
      setScores(loadedScores)
      setMajors(majorsResponse.data?.data || [])
      setMajorTotal(Number(majorsResponse.data?.total || 0))
      setProfile(profileResponse.data?.data?.profile || null)

      if ((!snapshot.classLevel || !snapshot.term) && loadedScores[0]) {
        setSnapshot({ classLevel: loadedScores[0].classLevel, term: loadedScores[0].term })
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return
      console.error('Career guidance load failed', err)
      setError(err.response?.data?.error || 'Không thể tải dữ liệu phân tích. Vui lòng thử lại.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [filters, majorPage, snapshot])

  useEffect(() => { load() }, [load])

  const snapshots = useMemo(() => [...new Set(scores.map((row) => `${row.classLevel}|${row.term}`))], [scores])
  const visibleScores = scores.filter((row) => row.classLevel === snapshot.classLevel && row.term === snapshot.term)

  const selectMajor = async (major, kind) => {
    try {
      await addCareerSelection({
        schoolCode: major.schoolCode,
        schoolName: major.schoolName,
        majorName: major.majorName,
        method: major.method,
        admissionBlock: major.admissionBlock,
        year: major.year,
        kind,
      })
      setSuccess(kind === 'target' ? 'Đã đặt ngành mục tiêu thành công.' : 'Đã ghim ngành quan tâm thành công.')
      await load()
    } catch (err) {
      console.error('Career selection save failed', err)
      setError(err.response?.data?.error || 'Không thể lưu lựa chọn ngành.')
    }
  }

  const removeSelection = async (id) => {
    try {
      await removeCareerSelection(id)
      setSuccess('Đã bỏ lựa chọn ngành.')
      await load()
    } catch (err) {
      console.error('Career selection delete failed', err)
      setError('Không thể bỏ lựa chọn ngành.')
    }
  }

  // Filtered rubrics
  const allFits = useMemo(() => overview?.fits || [], [overview])

  const filteredFits = useMemo(() => {
    return allFits.filter((fit) => {
      if (rubricTab === 'saved' && !fit.isTarget && !fit.isPinned) return false
      if (!rubricSearch.trim()) return true
      const q = rubricSearch.trim().toLowerCase()
      return (
        String(fit.majorName || '').toLowerCase().includes(q) ||
        String(fit.schoolName || '').toLowerCase().includes(q) ||
        String(fit.admissionBlock || '').toLowerCase().includes(q)
      )
    })
  }, [allFits, rubricTab, rubricSearch])

  const myFitsCount = useMemo(() => allFits.filter((f) => f.isTarget || f.isPinned).length, [allFits])

  // Simulation calculations
  const calculateSimulatedResult = (fit) => {
    const sim = simulatedScores[fit.rubricId]
    if (!sim || Object.keys(sim).length === 0) return null

    const details = (fit.details || []).map((detail) => {
      const simulatedScore = sim[detail.subject] !== undefined ? Number(sim[detail.subject]) : detail.score
      const gap = simulatedScore !== null && Number.isFinite(simulatedScore)
        ? Math.round((simulatedScore - detail.threshold) * 100) / 100
        : null
      return {
        ...detail,
        simulatedScore,
        gap,
      }
    })

    const present = details.filter((d) => d.simulatedScore !== null && Number.isFinite(d.simulatedScore))
    if (!present.length) return null

    const denominator = present.reduce((sum, d) => sum + d.weight, 0)
    const numerator = present.reduce((sum, d) => sum + (d.threshold > 0 ? Math.min(d.simulatedScore / d.threshold, 1) : 1) * d.weight, 0)
    const fitPct = Math.round((numerator / denominator) * 1000) / 10
    const delta = fit.fitPct !== null ? Math.round((fitPct - fit.fitPct) * 10) / 10 : null

    return { fitPct, details, delta }
  }

  const updateSimulatedScore = (rubricId, subject, value) => {
    const val = value === '' ? '' : Math.max(0, Math.min(10, Number(value)))
    setSimulatedScores((prev) => ({
      ...prev,
      [rubricId]: {
        ...(prev[rubricId] || {}),
        [subject]: val,
      },
    }))
  }

  const resetSimulation = (rubricId) => {
    setSimulatedScores((prev) => {
      const next = { ...prev }
      delete next[rubricId]
      return next
    })
  }

  const toggleCompareRubric = (rubricId) => {
    setComparingRubrics((prev) => {
      if (prev.includes(rubricId)) {
        return prev.filter((id) => id !== rubricId)
      }
      if (prev.length >= 2) {
        return [prev[1], rubricId]
      }
      return [...prev, rubricId]
    })
  }

  const comparedFits = useMemo(() => {
    return comparingRubrics.map((id) => allFits.find((f) => f.rubricId === id)).filter(Boolean)
  }, [comparingRubrics, allFits])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Phân tích năng lực & Định hướng ngành</h1>
        <p className="mt-2 text-muted-foreground">
          Phân tích năng lực học tập dựa trên điểm học bạ và rubric chuẩn của từng ngành. Minh bạch dữ liệu, hỗ trợ mô phỏng và đối chiếu.
        </p>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      {/* Card 1: Hồ sơ điểm phân tích */}
      <Card>
        <CardHeader>
          <CardTitle>1. Hồ sơ điểm phân tích</CardTitle>
          <CardDescription>
            Điểm chỉ được nhập tại Thông tin cá nhân hoặc bài khảo sát; hệ thống tự động đồng bộ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <strong>Hồ sơ hiện tại:</strong> {profile?.ho_va_ten || user?.username || 'Chưa có tên'} · Lớp {profile?.lop || 'chưa cập nhật'} · Trường {profile?.truong || 'chưa cập nhật'}
            <a className="ml-2 font-medium text-primary underline" href="/thong-tin-ca-nhan">Cập nhật hồ sơ và điểm</a>
          </div>
          {snapshot.classLevel && snapshot.term ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleScores.length ? (
                visibleScores.map((row) => (
                  <div key={row.subject} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>{row.subject}</span>
                    <strong className="text-foreground">{row.score}/10</strong>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có điểm cho lớp {snapshot.classLevel}, {snapshot.term}.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chọn lớp và kỳ học ở mục dưới để xem điểm trung bình môn đã lưu.</p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Chọn snapshot phân tích */}
      <Card>
        <CardHeader>
          <CardTitle>2. Chọn snapshot phân tích</CardTitle>
          <CardDescription>
            Điểm phù hợp rubric được tính toán theo snapshot điểm trung bình (TB môn) của lớp và kỳ bạn lựa chọn.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Lớp / Kỳ học</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={`${snapshot.classLevel}|${snapshot.term}`}
              onChange={(e) => {
                const [classLevel, term] = e.target.value.split('|')
                setSnapshot({ classLevel, term })
              }}
            >
              <option value="|">-- Chọn lớp và kỳ học --</option>
              {snapshots.map((s) => (
                <option key={s} value={s}>
                  Lớp {s.split('|')[0]} · {s.split('|')[1]}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-muted-foreground">
            {user?.username} · Dữ liệu snapshot đồng bộ từ hồ sơ cá nhân
          </span>
        </CardContent>
      </Card>

      {/* Card 3: Kết quả rubric (Cốt lõi tính năng) */}
      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">3. Kết quả rubric đánh giá năng lực</CardTitle>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {allFits.length} rubric
                </span>
              </div>
              <CardDescription className="mt-1">
                Điểm phù hợp phản ánh mức độ đáp ứng năng lực so với yêu cầu chuẩn từng môn của ngành. Không phải xác suất trúng tuyển.
              </CardDescription>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setRubricTab('all')}
                  className={`rounded-md px-3 py-1.5 font-medium transition-all ${rubricTab === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Tất cả ({allFits.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRubricTab('saved')}
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-all ${rubricTab === 'saved' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Target className="h-3 w-3 text-rose-500" /> Ngành của bạn ({myFitsCount})
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Lọc ngành, trường..."
                  value={rubricSearch}
                  onChange={(e) => setRubricSearch(e.target.value)}
                  className="h-9 w-44 pl-8 text-xs sm:w-56"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Thông báo nếu có Ngành mục tiêu / quan tâm chưa có Rubric */}
          {overview?.unmatchedSelections?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">Ngành đã lưu chưa có rubric năng lực:</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {overview.unmatchedSelections.map((sel) => (
                      <span key={sel.id} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100/60 px-2 py-0.5 text-xs text-amber-900">
                        {sel.kind === 'target' ? <Target className="h-3 w-3 text-rose-600" /> : <Bookmark className="h-3 w-3 text-blue-600" />}
                        <strong>{sel.majorName}</strong> ({sel.schoolName})
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-amber-800">
                    Ban quản trị chưa thiết lập rubric trọng số cho các ngành trên. Bạn vẫn có thể theo dõi qua tỉ lệ đỗ tại mục Khám phá ngành bên dưới.
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Đang tính toán điểm phù hợp rubric...
            </div>
          ) : filteredFits.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredFits.map((fit) => {
                const badge = getFitBadge(fit.fitPct)
                const simResult = calculateSimulatedResult(fit)
                const isSimulating = expandedSimulation[fit.rubricId]
                const isComparing = comparingRubrics.includes(fit.rubricId)

                return (
                  <div
                    key={fit.rubricId}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                      fit.isTarget
                        ? 'border-rose-300 bg-rose-50/20 shadow-sm ring-1 ring-rose-200'
                        : fit.isPinned
                        ? 'border-blue-200 bg-blue-50/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div>
                      {/* Header Card Rubric */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {fit.isTarget && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                                <Target className="h-3 w-3 text-rose-600" /> Ngành mục tiêu
                              </span>
                            )}
                            {fit.isPinned && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                <Bookmark className="h-3 w-3 text-blue-600" /> Ngành quan tâm
                              </span>
                            )}
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {fit.admissionBlock || 'Chưa có khối'} · {fit.year}
                            </span>
                          </div>
                          <h2 className="mt-1.5 text-base font-bold text-foreground">{fit.majorName}</h2>
                          <p className="text-sm text-muted-foreground">{fit.schoolName} · {fit.method}</p>
                        </div>

                        {/* Điểm Phù hợp & Độ phủ */}
                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-2xl font-black text-primary">
                              {simResult ? `${simResult.fitPct}%` : fit.fitPct === null ? '—' : `${fit.fitPct}%`}
                            </span>
                            {simResult && simResult.delta !== null && (
                              <span className={`text-xs font-bold ${simResult.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                ({simResult.delta >= 0 ? `+${simResult.delta}` : simResult.delta}%)
                              </span>
                            )}
                          </div>
                          <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${badge.color}`}>
                            {badge.label}
                          </span>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Độ phủ dữ liệu: <strong>{fit.coveragePct}%</strong>
                          </p>
                        </div>
                      </div>

                      {/* Biểu đồ Radar năng lực */}
                      <RadarChart
                        details={fit.details}
                        simulated={simulatedScores[fit.rubricId]}
                      />

                      {/* Legend */}
                      <div className="mb-3 flex flex-wrap justify-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                          <span className="h-2 w-2 rounded-full bg-blue-600" /> Điểm của bạn
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-orange-600">
                          <span className="h-2 w-2 rounded-full border border-orange-500 bg-orange-100" /> Ngưỡng rubric
                        </span>
                        {simResult && (
                          <span className="inline-flex items-center gap-1 font-medium text-purple-700">
                            <span className="h-2 w-2 rounded-full bg-purple-600" /> Điểm mô phỏng
                          </span>
                        )}
                      </div>

                      {/* Chi tiết từng môn */}
                      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết môn học & Độ lệch (Gap):</p>
                        <div className="space-y-2">
                          {Array.isArray(fit.details) && fit.details.map((detail) => {
                            const simScore = simulatedScores[fit.rubricId]?.[detail.subject]
                            const effectiveScore = simScore !== undefined && simScore !== '' ? Number(simScore) : detail.score
                            const effectiveGap = effectiveScore !== null ? Math.round((effectiveScore - detail.threshold) * 100) / 100 : null
                            const percentOfThreshold = effectiveScore !== null ? Math.min(Math.round((effectiveScore / detail.threshold) * 100), 100) : 0

                            return (
                              <div key={detail.subject} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-foreground">
                                    {detail.subject}
                                    <span className="ml-1 text-muted-foreground">({(detail.weight * 100).toFixed(0)}%)</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-foreground">
                                      {effectiveScore === null ? 'Chưa có' : `${effectiveScore} / ${detail.threshold}`}
                                    </span>
                                    {effectiveScore !== null && (
                                      <span className={`font-semibold ${effectiveGap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ({effectiveGap >= 0 ? `+${effectiveGap}` : effectiveGap})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      effectiveScore === null
                                        ? 'bg-transparent'
                                        : effectiveGap >= 0
                                        ? 'bg-emerald-500'
                                        : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${percentOfThreshold}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Lời khuyên trọng tâm */}
                      <div className="mt-3 rounded-md border border-slate-200 bg-background p-2.5 text-xs text-foreground">
                        {fit.prioritySubject ? (
                          <p>
                            💡 <strong>Gợi ý ưu tiên:</strong> Tập trung cải thiện điểm môn <strong className="text-primary">{fit.prioritySubject}</strong> để nâng cao mức độ đáp ứng rubric mạnh mẽ nhất.
                          </p>
                        ) : fit.fitPct >= 90 ? (
                          <p className="text-emerald-700">
                            🎉 <strong>Chúc mừng!</strong> Điểm số của bạn hiện đã đạt và vượt ngưỡng năng lực yêu cầu của ngành này.
                          </p>
                        ) : (
                          <p className="text-muted-foreground">
                            Cần bổ sung thêm điểm các môn còn thiếu để đạt 100% độ phủ dữ liệu phân tích.
                          </p>
                        )}
                      </div>

                      {/* Khối Mô phỏng điểm nếu được bật */}
                      {isSimulating && (
                        <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-purple-900">Thử điều chỉnh điểm giả định:</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => resetSimulation(fit.rubricId)}
                              className="h-6 px-2 text-[11px] text-purple-700 hover:bg-purple-100"
                            >
                              <RotateCcw className="mr-1 h-3 w-3" /> Đặt lại gốc
                            </Button>
                          </div>
                          <div className="mt-2 space-y-2">
                            {fit.details.map((detail) => {
                              const cur = simulatedScores[fit.rubricId]?.[detail.subject] ?? (detail.score ?? 7)
                              return (
                                <div key={detail.subject} className="grid grid-cols-12 items-center gap-2">
                                  <span className="col-span-4 font-medium text-slate-700">{detail.subject}:</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    value={cur}
                                    onChange={(e) => updateSimulatedScore(fit.rubricId, detail.subject, e.target.value)}
                                    className="col-span-6 h-1.5 cursor-pointer accent-purple-600"
                                  />
                                  <span className="col-span-2 text-right font-bold text-purple-800">{cur}đ</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <Button
                        type="button"
                        variant={isSimulating ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setExpandedSimulation((prev) => ({ ...prev, [fit.rubricId]: !prev[fit.rubricId] }))}
                        className="text-xs"
                      >
                        <Sliders className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
                        {isSimulating ? 'Ẩn mô phỏng' : 'Mô phỏng điểm'}
                      </Button>

                      <Button
                        type="button"
                        variant={isComparing ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleCompareRubric(fit.rubricId)}
                        className="text-xs"
                      >
                        <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                        {isComparing ? 'Đã chọn so sánh' : 'So sánh'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {allFits.length === 0 ? (
                'Chưa có rubric phù hợp với snapshot này. Bạn vẫn có thể khám phá ngành và lưu lựa chọn.'
              ) : (
                'Không tìm thấy rubric phù hợp với bộ lọc hiện tại.'
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Compare Bar */}
      {comparedFits.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-primary/30 bg-background/95 px-5 py-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-foreground">
              So sánh rubric ({comparedFits.length}/2):
            </span>
            <div className="flex items-center gap-1.5">
              {comparedFits.map((f) => (
                <span key={f.rubricId} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {f.majorName}
                </span>
              ))}
            </div>
            {comparedFits.length === 2 && (
              <Button size="sm" onClick={() => setShowCompareModal(true)}>
                <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Đối chiếu 2 ngành
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setComparingRubrics([])}
              aria-label="Xóa danh sách so sánh"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal / Bảng So sánh Đối chiếu 2 Rubric */}
      {showCompareModal && comparedFits.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">Đối chiếu Rubric năng lực giữa 2 ngành</h2>
                <p className="text-sm text-muted-foreground">So sánh mức độ phù hợp và tiêu chí năng lực từng môn.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCompareModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              {comparedFits.map((f, i) => {
                const b = getFitBadge(f.fitPct)
                return (
                  <div key={f.rubricId} className="rounded-lg border bg-muted/30 p-4">
                    <span className="text-xs font-bold text-primary">NGÀNH {i === 0 ? 'A' : 'B'}</span>
                    <h3 className="text-base font-bold">{f.majorName}</h3>
                    <p className="text-xs text-muted-foreground">{f.schoolName} · {f.admissionBlock}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-2xl font-black text-primary">{f.fitPct ?? '—'}%</span>
                      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${b.color}`}>{b.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bảng đối chiếu từng môn */}
            <div className="mt-5 overflow-hidden rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/60 text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Môn học</th>
                    <th className="p-3">Ngưỡng Ngành A ({comparedFits[0].majorName})</th>
                    <th className="p-3 text-center">Điểm của bạn</th>
                    <th className="p-3">Ngưỡng Ngành B ({comparedFits[1].majorName})</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {/* Gom tất cả môn của cả 2 ngành */}
                  {[...new Set([
                    ...comparedFits[0].details.map((d) => d.subject),
                    ...comparedFits[1].details.map((d) => d.subject),
                  ])].map((subj) => {
                    const d0 = comparedFits[0].details.find((d) => d.subject === subj)
                    const d1 = comparedFits[1].details.find((d) => d.subject === subj)
                    const score = d0?.score ?? d1?.score ?? null

                    return (
                      <tr key={subj} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold text-foreground">{subj}</td>
                        <td className="p-3">
                          {d0 ? (
                            <span>{d0.threshold}đ <span className="text-muted-foreground">({(d0.weight * 100).toFixed(0)}%)</span></span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-primary">
                          {score !== null ? `${score}đ` : 'Chưa có'}
                        </td>
                        <td className="p-3">
                          {d1 ? (
                            <span>{d1.threshold}đ <span className="text-muted-foreground">({(d1.weight * 100).toFixed(0)}%)</span></span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Đánh giá đối chiếu */}
            <div className="mt-4 rounded-lg bg-primary/5 p-3 text-xs text-foreground">
              <p className="font-semibold text-primary">Nhận định đối chiếu:</p>
              <p className="mt-1">
                {comparedFits[0].fitPct !== null && comparedFits[1].fitPct !== null ? (
                  comparedFits[0].fitPct > comparedFits[1].fitPct ? (
                    <>Bạn phù hợp hơn với ngành <strong>{comparedFits[0].majorName}</strong> (cao hơn {Math.round((comparedFits[0].fitPct - comparedFits[1].fitPct) * 10) / 10}% so với {comparedFits[1].majorName}).</>
                  ) : comparedFits[1].fitPct > comparedFits[0].fitPct ? (
                    <>Bạn phù hợp hơn với ngành <strong>{comparedFits[1].majorName}</strong> (cao hơn {Math.round((comparedFits[1].fitPct - comparedFits[0].fitPct) * 10) / 10}% so với {comparedFits[0].majorName}).</>
                  ) : (
                    <>Mức độ đáp ứng của bạn đối với cả hai ngành là tương đương nhau ({comparedFits[0].fitPct}%).</>
                  )
                ) : (
                  'Cần nhập đủ điểm các môn để có kết quả đối chiếu chính xác nhất.'
                )}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setShowCompareModal(false)}>Đóng bảng so sánh</Button>
            </div>
          </div>
        </div>
      )}

      {/* Card 4: Khám phá ngành và điểm chuẩn */}
      <Card>
        <CardHeader>
          <CardTitle>4. Khám phá ngành và điểm chuẩn</CardTitle>
          <CardDescription>
            Chỉ hiển thị phương thức Điểm thi THPT, dữ liệu năm 2025. “Tỉ lệ đỗ” là chỉ số khoảng cách tham khảo, không phải xác suất trúng tuyển.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Tìm ngành..."
              value={filters.search}
              onChange={(e) => {
                setMajorPage(1)
                setFilters({ ...filters, search: e.target.value })
              }}
            />
            <Input
              placeholder="Tìm trường..."
              value={filters.school}
              onChange={(e) => {
                setMajorPage(1)
                setFilters({ ...filters, school: e.target.value })
              }}
            />
            <Input
              placeholder="Khối thi (A00, D01...)"
              value={filters.block}
              onChange={(e) => {
                setMajorPage(1)
                setFilters({ ...filters, block: e.target.value })
              }}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filters.sort}
              aria-label="Sắp xếp danh sách ngành"
              onChange={(e) => {
                setMajorPage(1)
                setFilters({ ...filters, sort: e.target.value })
              }}
            >
              <option value="score_desc">Điểm chuẩn: Cao → Thấp</option>
              <option value="score_asc">Điểm chuẩn: Thấp → Cao</option>
              <option value="rate_desc">Tỉ lệ đỗ: Cao → Thấp</option>
              <option value="rate_asc">Tỉ lệ đỗ: Thấp → Cao</option>
              <option value="school_asc">Tên trường: A → Z</option>
              <option value="school_desc">Tên trường: Z → A</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {majors.map((major) => (
              <div key={major.id} className="rounded-lg border p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{major.majorName}</p>
                    <p className="text-sm text-muted-foreground">{major.schoolName} · Điểm thi THPT</p>
                  </div>
                  <p className="font-bold">{major.entryScore ?? '—'}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Khối: {major.admissionBlock || 'Chưa có'} · Năm: {major.year}
                </p>
                <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm">
                  <span className="text-muted-foreground">Tỉ lệ đỗ tham khảo: </span>
                  <strong className={
                    major.distanceRate === null
                      ? 'text-muted-foreground font-normal'
                      : major.distanceRate >= 100
                      ? 'text-emerald-600 font-bold'
                      : major.distanceRate >= 90
                      ? 'text-blue-600 font-bold'
                      : 'text-amber-600 font-semibold'
                  }>
                    {major.distanceRate === null ? 'Chưa đủ dữ liệu' : `${major.distanceRate}%`}
                  </strong>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => selectMajor(major, 'pinned')}>
                    <Bookmark className="mr-1 h-3.5 w-3.5" /> Ghim
                  </Button>
                  <Button size="sm" onClick={() => selectMajor(major, 'target')}>
                    <Target className="mr-1 h-3.5 w-3.5" /> Đặt mục tiêu
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tổng {majorTotal} dòng điểm chuẩn</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={majorPage === 1}
                onClick={() => setMajorPage((page) => page - 1)}
              >
                Trang trước
              </Button>
              <span className="px-2 py-1">Trang {majorPage}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={majorPage * 20 >= majorTotal}
                onClick={() => setMajorPage((page) => page + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 5: Ngành đã lưu */}
      <Card>
        <CardHeader>
          <CardTitle>Ngành đã lưu</CardTitle>
          <CardDescription>
            Danh sách 1 ngành mục tiêu và tối đa 5 ngành quan tâm của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview?.selections?.length ? (
            <div className="space-y-2">
              {overview.selections.map((selection) => (
                <div key={selection.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <span className="flex items-center gap-2">
                    {selection.kind === 'target' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                        <Target className="h-3.5 w-3.5" /> Mục tiêu:
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                        <Bookmark className="h-3.5 w-3.5" /> Quan tâm:
                      </span>
                    )}
                    <span>{selection.majorName} — {selection.schoolName} ({selection.method}, {selection.year})</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Bỏ ngành đã lưu"
                    onClick={() => removeSelection(selection.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có ngành được lưu. Bạn có thể ghim hoặc đặt mục tiêu tại mục Khám phá ngành ở trên.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
