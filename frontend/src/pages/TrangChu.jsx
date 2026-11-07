import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Crosshair,
  GraduationCap,
  HelpCircle,
  Layers,
  Loader2,
  LogIn,
  RefreshCw,
  School,
  Search,
  Sparkles,
  Target,
  Trophy,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { addCareerSelection, getCareerOverview, getUserProfile } from '@/lib/api'

// Helper: Short label for Radar vertices
function shortSubject(s) {
  const map = {
    'Tiếng Anh': 'Anh',
    'Vật lý': 'Lý',
    'Hóa học': 'Hóa',
    'Sinh học': 'Sinh',
    'Ngữ văn': 'Văn',
    'Lịch sử': 'Sử',
    'Địa lý': 'Địa',
    'Tin học': 'Tin',
    'Giáo dục thể chất': 'GDTC',
    'Giáo dục công dân': 'GDCD',
  }
  return map[s] || s
}

// Basic shadcn SVG Radar Chart (neutral, no flashy neon)
function MiniRadar({ details = [] }) {
  const safeDetails = Array.isArray(details) ? details : []
  const size = 220
  const center = size / 2
  const isMulti = safeDetails.length > 5
  const radius = isMulti ? 60 : 70

  if (safeDetails.length < 3) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground italic">
        Cần ≥ 3 môn để vẽ biểu đồ
      </div>
    )
  }

  const getCoord = (index, value) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / safeDetails.length
    const clamped = Math.max(0, Math.min(Number(value || 0) / 10, 1))
    const r = radius * clamped
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    }
  }

  const thresholdPoints = safeDetails
    .map((item, idx) => {
      const c = getCoord(idx, item.threshold)
      return `${c.x.toFixed(1)},${c.y.toFixed(1)}`
    })
    .join(' ')

  const studentPoints = safeDetails
    .map((item, idx) => {
      const c = getCoord(idx, item.score ?? 0)
      return `${c.x.toFixed(1)},${c.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="flex flex-col items-center justify-center py-1">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-44 w-44 select-none"
        role="img"
        aria-label="Biểu đồ radar năng lực"
      >
        {/* Concentric webs */}
        {[0.33, 0.66, 1.0].map((scale) => {
          const webPts = safeDetails
            .map((_, idx) => {
              const angle = -Math.PI / 2 + (2 * Math.PI * idx) / safeDetails.length
              const r = radius * scale
              return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`
            })
            .join(' ')
          return (
            <polygon
              key={scale}
              points={webPts}
              fill="none"
              stroke="currentColor"
              className="text-border"
              strokeWidth="1"
            />
          )
        })}

        {/* Spokes and Labels */}
        {safeDetails.map((item, idx) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * idx) / safeDetails.length
          const xSpoke = center + Math.cos(angle) * radius
          const ySpoke = center + Math.sin(angle) * radius
          const labelDist = radius + (isMulti ? 14 : 16)
          const xLabel = center + Math.cos(angle) * labelDist
          const yLabel = center + Math.sin(angle) * labelDist

          return (
            <g key={item.subject}>
              <line
                x1={center}
                y1={center}
                x2={xSpoke}
                y2={ySpoke}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <text
                x={xLabel}
                y={yLabel}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isMulti ? '7.5' : '8.5'}
                fontWeight={item.isCore ? '700' : '500'}
                className={item.isCore ? 'fill-foreground font-semibold' : 'fill-muted-foreground'}
              >
                {shortSubject(item.subject)}{item.isCore ? '★' : ''}
              </text>
            </g>
          )
        })}

        {/* Threshold Polygon (Dashed outline) */}
        <polygon
          points={thresholdPoints}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground"
          strokeWidth="1.25"
          strokeDasharray="3 2"
        />

        {/* Student Score Polygon (Solid clean fill) */}
        <polygon
          points={studentPoints}
          fill="currentColor"
          className="text-foreground/15 stroke-foreground"
          strokeWidth="1.5"
        />

        {/* Vertex dots */}
        {safeDetails.map((item, idx) => {
          const cThresh = getCoord(idx, item.threshold)
          const cStudent = getCoord(idx, item.score ?? 0)
          return (
            <g key={`dots-${item.subject}`}>
              <circle cx={cThresh.x} cy={cThresh.y} r="1.5" className="fill-muted-foreground" />
              {item.score !== null && (
                <circle cx={cStudent.x} cy={cStudent.y} r="2" className="fill-foreground" />
              )}
            </g>
          )
        })}
      </svg>
      {/* Clean Legend */}
      <div className="flex flex-wrap justify-center items-center gap-3 text-[10px] text-muted-foreground mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-foreground" /> Điểm của bạn
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-dashed border-muted-foreground" /> Ngưỡng yêu cầu
        </span>
        {safeDetails.some((d) => d.isCore) && safeDetails.some((d) => !d.isCore) && (
          <span className="flex items-center gap-1 text-[9px] text-primary">
            ★ Môn tổ hợp (75%)
          </span>
        )}
      </div>
    </div>
  )
}

function getFitStyle(fitPct) {
  if (fitPct === null || fitPct === undefined) {
    return {
      text: 'text-muted-foreground',
      bar: 'bg-muted-foreground/40',
      badge: 'border-border bg-muted text-muted-foreground',
      label: 'Chưa đủ điểm',
    }
  }
  if (fitPct >= 80) {
    return {
      text: 'text-foreground font-semibold',
      bar: 'bg-foreground',
      badge: 'border-border bg-secondary text-secondary-foreground',
      label: 'Rất phù hợp',
    }
  }
  if (fitPct >= 60) {
    return {
      text: 'text-foreground',
      bar: 'bg-foreground/80',
      badge: 'border-border bg-muted text-foreground',
      label: 'Khá phù hợp',
    }
  }
  return {
    text: 'text-muted-foreground',
    bar: 'bg-muted-foreground/60',
    badge: 'border-border bg-muted/60 text-muted-foreground',
    label: 'Cần nỗ lực',
  }
}

// Clean shadcn Rubric Table Component
function RubricTable({ details = [] }) {
  const safeDetails = Array.isArray(details) ? details : []

  if (safeDetails.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground italic">
        Chưa có dữ liệu chi tiết môn học cho rubric này.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground border-b border-border">
          <tr>
            <th className="px-3 py-2 font-medium">Môn học</th>
            <th className="px-2 py-2 text-center font-medium">Trọng số</th>
            <th className="px-2 py-2 text-center font-medium">Ngưỡng</th>
            <th className="px-2 py-2 text-center font-medium">Điểm bạn</th>
            <th className="px-2 py-2 text-center font-medium">Chênh lệch</th>
            <th className="px-3 py-2 text-center font-medium">Đánh giá</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {safeDetails.map((item) => {
            const weightPct = Math.round(Number(item.weight || 0) * 100)
            const score = item.score !== null && item.score !== undefined ? Number(item.score) : null
            const threshold = Number(item.threshold || 0)
            const gap = item.gap !== null && item.gap !== undefined ? Number(item.gap) : null

            return (
              <tr key={item.subject} className="hover:bg-muted/20">
                <td className="px-3 py-2 font-medium text-foreground">
                  {item.subject}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground">
                  {weightPct}%
                </td>
                <td className="px-2 py-2 text-center font-mono text-muted-foreground">
                  {threshold.toFixed(1)}
                </td>
                <td className="px-2 py-2 text-center font-mono font-medium text-foreground">
                  {score !== null ? score.toFixed(1) : <span className="text-muted-foreground/60">—</span>}
                </td>
                <td className="px-2 py-2 text-center font-mono">
                  {gap !== null ? (
                    gap >= 0 ? (
                      <span className="text-foreground font-medium">+{gap.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground">{gap.toFixed(1)}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {score === null ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border border-border bg-muted text-muted-foreground">
                      Chưa có điểm
                    </span>
                  ) : gap !== null && gap >= 0 ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border bg-secondary text-secondary-foreground">
                      <CheckCircle2 className="h-3 w-3" /> Đạt chuẩn
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border bg-muted text-muted-foreground">
                      <AlertCircle className="h-3 w-3" /> Cần cải thiện
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 5 Core Features (basic shadcn style)
const coreFeatures = [
  {
    title: 'Phân tích năng lực & Rubric ngành học',
    description: 'Đối chiếu bảng điểm học tập với ngưỡng chuẩn hóa và trọng số của 145+ ngành, xác định tỉ lệ phù hợp (Fit %) và môn học cần ưu tiên cải thiện.',
    icon: Sparkles,
    link: '/phan-tich-nang-luc',
  },
  {
    title: 'Đề án tuyển sinh 2026',
    description: 'Tra cứu chỉ tiêu, phương thức xét tuyển, học phí và điều kiện tuyển sinh của hơn 200 trường đại học trên cả nước.',
    icon: Search,
    link: '/de-an',
  },
  {
    title: 'Điểm chuẩn các năm',
    description: 'Xem và so sánh điểm chuẩn các năm trước theo ngành, trường và các phương thức xét tuyển (Điểm thi THPT, HSA, TSA, SAT...).',
    icon: BarChart3,
    link: '/diem-chuan',
  },
  {
    title: 'Khối thi & Tổ hợp môn',
    description: 'Danh mục 240+ khối thi THPT và danh sách các trường đại học, ngành đào tạo tuyển sinh tương ứng.',
    icon: BookOpen,
    link: '/khoi-thi',
  },
  {
    title: 'Tra cứu thứ hạng',
    description: 'Ước lượng thứ hạng phổ điểm dựa trên kết quả thi tốt nghiệp THPT, ĐGNL (HSA) và ĐGTD (TSA) để định vị năng lực cạnh tranh.',
    icon: Trophy,
    link: '/thu-hang',
  },
]

export default function TrangChu() {
  const { user } = useAuth()

  // State for authenticated dashboard
  const [profile, setProfile] = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [targetActionLoading, setTargetActionLoading] = useState(false)
  const [targetActionMessage, setTargetActionMessage] = useState('')
  const [selectedSnapshot, setSelectedSnapshot] = useState({ classLevel: '', term: '' })
  const [radarMode, setRadarMode] = useState('all')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [profileRes, overviewRes] = await Promise.all([
        getUserProfile(),
        getCareerOverview(selectedSnapshot.classLevel ? selectedSnapshot : undefined),
      ])
      const p = profileRes.data?.data?.profile || null
      const o = overviewRes.data?.data || null
      setProfile(p)
      setOverview(o)

      if ((!selectedSnapshot.classLevel || !selectedSnapshot.term) && o?.scores?.[0]) {
        setSelectedSnapshot({
          classLevel: o.scores[0].classLevel,
          term: o.scores[0].term,
        })
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu trang chủ:', err)
      setError(err.response?.data?.error || 'Không thể tải dữ liệu phân tích. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [user, selectedSnapshot])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  // Academic scores check
  const scores = useMemo(() => overview?.scores || [], [overview])
  const validScores = useMemo(
    () =>
      scores.filter(
        (s) =>
          (s.scoreType || 'average') === 'average' &&
          s.score !== null &&
          s.score !== undefined &&
          s.score !== '' &&
          Number.isFinite(Number(s.score))
      ),
    [scores]
  )
  const hasScores = validScores.length > 0

  // Snapshot options
  const snapshots = useMemo(() => {
    const set = new Set()
    for (const s of scores) {
      if (s.classLevel && s.term) {
        set.add(`${s.classLevel}|${s.term}`)
      }
    }
    return Array.from(set).map((str) => {
      const [classLevel, term] = str.split('|')
      return { classLevel, term }
    })
  }, [scores])

  // Fits & Rubrics
  const fits = useMemo(() => overview?.fits || [], [overview])

  // Target Major detection
  const targetFit = useMemo(() => fits.find((f) => f.isTarget) || null, [fits])
  const unmatchedTarget = useMemo(() => {
    const sel = (overview?.selections || []).find((s) => s.kind === 'target')
    if (sel) return sel
    if (profile?.nganh_muc_tieu || profile?.truong_muc_tieu) {
      return {
        schoolName: profile.truong_muc_tieu,
        majorName: profile.nganh_muc_tieu,
      }
    }
    return null
  }, [overview, profile])
  const hasTarget = Boolean(targetFit || (unmatchedTarget && unmatchedTarget.majorName))

  // Best Fit Major detection (aligns with active radar mode)
  const bestFit = useMemo(() => {
    const getActiveFitPct = (f) => (radarMode === 'all' ? (f.allFitPct ?? f.fitPct) : f.fitPct)
    const valid = fits.filter((f) => {
      const pct = getActiveFitPct(f)
      return pct !== null && pct !== undefined
    })
    if (!valid.length) return null
    // Sort by active fitPct descending, then coveragePct descending, then entryScore descending
    valid.sort((a, b) => {
      const aPct = getActiveFitPct(a)
      const bPct = getActiveFitPct(b)
      if (bPct !== aPct) return bPct - aPct
      if (b.coveragePct !== a.coveragePct) return b.coveragePct - a.coveragePct
      return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0)
    })
    return valid[0]
  }, [fits, radarMode])

  // Handler: Set best fit major as target major directly
  const handleSetBestFitAsTarget = async () => {
    if (!bestFit) return
    setTargetActionLoading(true)
    setTargetActionMessage('')
    try {
      await addCareerSelection({
        schoolName: bestFit.schoolName,
        majorName: bestFit.majorName,
        schoolCode: bestFit.schoolCode,
        admissionBlock: bestFit.admissionBlock,
        method: bestFit.method || 'Điểm thi THPT',
        year: bestFit.year || 2025,
        kind: 'target',
      })
      setTargetActionMessage('Đã thiết lập ngành học này làm mục tiêu tuyển sinh thành công!')
      await loadData()
    } catch (err) {
      console.error('Không thể đặt mục tiêu:', err)
      setTargetActionMessage(err.response?.data?.error || 'Không thể thiết lập ngành mục tiêu.')
    } finally {
      setTargetActionLoading(false)
    }
  }

  // ==========================================
  // VIEW 1: GUEST / CHƯA ĐĂNG NHẬP (BASIC SHADCN UI)
  // ==========================================
  if (!user) {
    return (
      <div className="space-y-16 py-6 max-w-5xl mx-auto">
        {/* Hero Section: Simple, Clean, Shadcn */}
        <section className="text-center space-y-5 pt-2 pb-2">
          {/* Logo (to hơn, cân đối và nổi bật) */}
          <div className="flex justify-center">
            <img
              src="/logo/LearnPath_xoanen.png"
              alt="LearnPath Logo"
              className="h-32 sm:h-36 md:h-40 w-auto object-contain"
            />
          </div>

          {/* Heading & Giới thiệu (giảm nhỏ lại tinh tế, vừa vặn) */}
          <div className="space-y-2.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground max-w-2xl mx-auto leading-snug">
              LearnPath - Hệ thống hỗ trợ cá nhân hoá định hướng ngành học
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Hệ thống định hướng ngành học và trường đại học dựa trên phân tích năng lực học tập thực tế.
              Đối chiếu điểm số cá nhân với rubric chuẩn hóa của hơn 145 ngành đào tạo và dữ liệu tuyển sinh toàn quốc
              để tìm ra lựa chọn phù hợp nhất cho bạn.
            </p>
          </div>

          {/* 2 Buttons: Basic Shadcn UI */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/dang-nhap"
              className={buttonVariants({
                size: 'default',
                className: 'w-full sm:w-auto min-w-[140px]',
              })}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Đăng nhập
            </Link>
            <Link
              to="/dang-ky"
              className={buttonVariants({
                variant: 'outline',
                size: 'default',
                className: 'w-full sm:w-auto min-w-[140px]',
              })}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Đăng ký
            </Link>
          </div>
        </section>

        {/* Features Section: Basic Shadcn Cards */}
        <section className="space-y-6 border-t border-border pt-10">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Tính năng nổi bật
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
              Công cụ toàn diện hỗ trợ học sinh THPT và phụ huynh trong quá trình chọn trường, chọn ngành.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {coreFeatures.map((feat) => {
              const Icon = feat.icon
              return (
                <Card
                  key={feat.link}
                  className="flex flex-col justify-between border border-border bg-card shadow-xs hover:border-foreground/40 transition-colors"
                >
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-md bg-muted border border-border text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm font-semibold leading-snug">
                        {feat.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                      {feat.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Link
                      to={feat.link}
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'sm',
                        className: 'w-full justify-between text-xs px-2 text-muted-foreground hover:text-foreground',
                      })}
                    >
                      <span>Khám phá</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED / ĐÃ ĐĂNG NHẬP (BASIC SHADCN UI)
  // ==========================================
  return (
    <div className="space-y-8 py-2 max-w-5xl mx-auto">
      {/* Loading state */}
      {loading && !overview && (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Đang tải dữ liệu hồ sơ và phân tích rubric...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-border bg-muted/40 p-4 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">Không thể tải thông tin</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="text-xs h-7">
            <RefreshCw className="mr-1.5 h-3 w-3" /> Thử lại
          </Button>
        </div>
      )}

      {/* Target Action Message Feedback */}
      {targetActionMessage && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
            <span className="text-foreground">{targetActionMessage}</span>
          </div>
          <button
            onClick={() => setTargetActionMessage('')}
            className="text-muted-foreground hover:text-foreground text-xs px-2 py-0.5"
          >
            Đóng
          </button>
        </div>
      )}

      {/* SECTION 1: THÔNG TIN CƠ BẢN CỦA USER (BASIC SHADCN CARD) */}
      <Card className="border border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border text-foreground font-semibold text-sm">
                {(profile?.ho_va_ten || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  {profile?.ho_va_ten || user.username}
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-muted-foreground">@{user.username}</span>
                  <span>•</span>
                  <span className="inline-flex items-center text-foreground font-medium">
                    <UserCheck className="h-3 w-3 mr-1 text-muted-foreground" /> Học sinh
                  </span>
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/thong-tin-ca-nhan"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'text-xs h-8',
                })}
              >
                <User className="mr-1.5 h-3.5 w-3.5" />
                Cập nhật hồ sơ & điểm
              </Link>
              <Link
                to="/phan-tich-nang-luc"
                className={buttonVariants({
                  size: 'sm',
                  className: 'text-xs h-8',
                })}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Phân tích đầy đủ
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground">Trường THPT:</span>
              <p className="font-medium text-foreground truncate">
                {profile?.truong || <span className="text-muted-foreground/60 italic font-normal">Chưa cập nhật</span>}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Lớp học:</span>
              <p className="font-medium text-foreground">
                {profile?.lop ? `Lớp ${profile.lop}` : <span className="text-muted-foreground/60 italic font-normal">Chưa cập nhật</span>}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Tổ hợp mong muốn:</span>
              <p className="font-medium text-foreground">
                {Array.isArray(profile?.to_hop_mong_muon) && profile.to_hop_mong_muon.length > 0 ? (
                  profile.to_hop_mong_muon.join(', ')
                ) : (
                  <span className="text-muted-foreground/60 italic font-normal">Chưa thiết lập</span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground">Điểm học tập:</span>
              <p className="font-medium text-foreground">
                {hasScores ? (
                  <span className="inline-flex items-center text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Đã nhập {validScores.length} môn
                    {selectedSnapshot.classLevel && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        (Lớp {selectedSnapshot.classLevel} - {selectedSnapshot.term})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground inline-flex items-center">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" /> Chưa có điểm
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Snapshot selector if multiple semesters exist */}
          {snapshots.length > 1 && (
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Kỳ học phân tích:</span>
              {snapshots.map((snap) => {
                const isSelected =
                  snap.classLevel === selectedSnapshot.classLevel && snap.term === selectedSnapshot.term
                return (
                  <button
                    key={`${snap.classLevel}-${snap.term}`}
                    onClick={() => setSelectedSnapshot(snap)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    Lớp {snap.classLevel} - {snap.term}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CẢNH BÁO: NẾU CHƯA CÓ ĐIỂM PHÙ HỢP ĐỂ PHÂN TÍCH */}
      {!hasScores && (
        <Card className="border border-border bg-muted/30 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-muted border border-border text-foreground shrink-0 mt-0.5">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  Yêu cầu nhập điểm học tập để phân tích Rubric
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  Bạn chưa nhập điểm trung bình các môn học (Toán, Ngữ văn, Tiếng Anh, Vật lý, Hóa học, Sinh học, Lịch sử, Địa lý...).
                  Hệ thống cần dữ liệu điểm số này để đối chiếu với trọng số và ngưỡng đạt của từng ngành đào tạo.
                </p>
              </div>
            </div>
            <Link
              to="/thong-tin-ca-nhan"
              className={buttonVariants({
                size: 'sm',
                className: 'whitespace-nowrap shrink-0 text-xs',
              })}
            >
              Nhập điểm các môn ngay
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: HAI BẢNG PHÂN TÍCH (RUBRIC) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Compass className="h-4 w-4 text-muted-foreground" />
              Bảng phân tích Rubric định hướng ngành học
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đối chiếu trực tiếp năng lực học tập của bạn với ngành mục tiêu và ngành phù hợp nhất
            </p>
          </div>
          <Link
            to="/phan-tich-nang-luc"
            className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center hidden sm:inline-flex"
          >
            Xem tất cả 145+ rubric <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ======================================================== */}
          {/* BẢNG 1: NGÀNH HỌC USER LÀM MỤC TIÊU (TARGET MAJOR) */}
          {/* ======================================================== */}
          <Card className="border border-border bg-card flex flex-col justify-between shadow-xs">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border border-border bg-muted/60 text-foreground">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  Bảng 1: Ngành học mục tiêu
                </div>

                {targetFit && (() => {
                  const targetFitPct = radarMode === 'all' ? (targetFit.allFitPct ?? targetFit.fitPct) : targetFit.fitPct
                  const badgeStyle = getFitStyle(targetFitPct).badge
                  return (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeStyle}`}
                    >
                      {targetFitPct !== null && targetFitPct !== undefined ? `${targetFitPct}% phù hợp` : 'Chưa đủ điểm'}
                    </span>
                  )
                })()}
              </div>

              {/* Header content based on target status */}
              {hasTarget ? (
                <div className="mt-2 space-y-1">
                  <CardTitle className="text-base font-bold text-foreground leading-snug">
                    {targetFit?.majorName || unmatchedTarget?.majorName}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {targetFit?.schoolName || unmatchedTarget?.schoolName}
                    {(targetFit?.schoolCode || unmatchedTarget?.schoolCode) && (
                      <span className="ml-1 text-muted-foreground/80">({targetFit?.schoolCode || unmatchedTarget?.schoolCode})</span>
                    )}
                  </CardDescription>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    {targetFit?.admissionBlock && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground font-mono">
                        Khối {targetFit.admissionBlock}
                      </span>
                    )}
                    {targetFit?.entryScore && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        Điểm chuẩn 2025: <strong className="text-foreground">{targetFit.entryScore}</strong>
                      </span>
                    )}
                    {targetFit?.majorGroup && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        {targetFit.majorGroup}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-0.5">
                  <CardTitle className="text-base font-bold text-foreground">
                    Chưa thiết lập mục tiêu
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Chọn ngành học mục tiêu để theo dõi mức độ đáp ứng
                  </CardDescription>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
              {/* TRƯỜNG HỢP A: CHƯA CHỌN NGÀNH MỤC TIÊU */}
              {!hasTarget && (
                <div className="my-auto py-8 text-center space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-5">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground">
                    <Crosshair className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Tình trạng: Chưa chọn ngành học mục tiêu
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Bạn chưa thiết lập ngành mục tiêu. Hãy chọn trường và ngành bạn muốn xét tuyển để LearnPath phân tích
                      độ lệch điểm và chỉ ra các môn bạn cần ưu tiên cải thiện.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
                    <Link
                      to="/thong-tin-ca-nhan"
                      className={buttonVariants({
                        size: 'sm',
                        className: 'text-xs',
                      })}
                    >
                      <Target className="mr-1.5 h-3 w-3" />
                      Chọn ngành mục tiêu ngay
                    </Link>
                    <Link
                      to="/phan-tich-nang-luc"
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'sm',
                        className: 'text-xs',
                      })}
                    >
                      Duyệt 145+ ngành
                    </Link>
                  </div>
                </div>
              )}

              {/* TRƯỜNG HỢP B: ĐÃ CHỌN MỤC TIÊU NHƯNG CHƯA CÓ ĐIỂM */}
              {hasTarget && !hasScores && (
                <div className="my-auto py-8 text-center space-y-3 rounded-md border border-dashed border-border p-5 bg-muted/10">
                  <AlertCircle className="mx-auto h-7 w-7 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Chưa thể phân tích rubric cho ngành mục tiêu
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Bạn đã chọn mục tiêu là <strong className="text-foreground">{targetFit?.majorName || unmatchedTarget?.majorName}</strong> nhưng chưa nhập điểm môn học để tính toán độ tương thích.
                    </p>
                  </div>
                  <Link
                    to="/thong-tin-ca-nhan"
                    className={buttonVariants({
                      size: 'sm',
                      className: 'text-xs',
                    })}
                  >
                    Nhập điểm học tập ngay
                  </Link>
                </div>
              )}

              {/* TRƯỜNG HỢP C: ĐÃ CÓ MỤC TIÊU VÀ ĐÃ CÓ ĐIỂM */}
              {hasTarget && hasScores && targetFit && (() => {
                const targetDetails = radarMode === 'all' ? (targetFit.allDetails || targetFit.details || []) : (targetFit.details || [])
                const targetFitPct = radarMode === 'all' ? (targetFit.allFitPct ?? targetFit.fitPct) : targetFit.fitPct
                const fitStyle = getFitStyle(targetFitPct)
                return (
                  <div className="space-y-4">
                    {/* Header with Mode Toggle */}
                    <div className="flex items-center justify-between pb-1 border-b border-border/60">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>{radarMode === 'all' ? 'Mạng nhện toàn diện (tất cả môn)' : 'Mạng nhện tổ hợp (3 môn)'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRadarMode((m) => (m === 'all' ? 'combo' : 'all'))}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        {radarMode === 'all' ? 'Xem 3 môn' : 'Xem tất cả'}
                      </button>
                    </div>

                    {/* Progress bar and Priority subject */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-foreground">
                          Mức độ tương thích năng lực {radarMode === 'all' ? '(75/25)' : ''}:
                        </span>
                        <span className={`font-medium ${fitStyle.text}`}>
                          {targetFitPct !== null ? `${targetFitPct}%` : 'Chưa đủ môn'}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            ({fitStyle.label})
                          </span>
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${fitStyle.bar}`}
                          style={{ width: `${Math.min(targetFitPct || 0, 100)}%` }}
                        />
                      </div>

                      {targetFit.prioritySubject && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Môn ưu tiên cần cải thiện: <strong className="text-foreground">{targetFit.prioritySubject}</strong>
                        </p>
                      )}
                    </div>

                    {/* Radar visualization & Rubric Table */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-5 flex justify-center bg-muted/20 rounded-md p-2 border border-border">
                        <MiniRadar details={targetDetails} />
                      </div>

                      <div className="sm:col-span-7">
                        <RubricTable details={targetDetails} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-between border-t border-border">
                      <Link
                        to="/thong-tin-ca-nhan"
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                      >
                        Đổi mục tiêu khác
                      </Link>
                      <Link
                        to="/phan-tich-nang-luc"
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'sm',
                          className: 'text-xs text-muted-foreground hover:text-foreground',
                        })}
                      >
                        Chi tiết <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )
              })()}

              {/* TRƯỜNG HỢP D: ĐÃ CÓ MỤC TIÊU TỰ GÕ NHƯNG CHƯA CÓ RUBRIC CHUẨN HOÁ */}
              {hasTarget && hasScores && !targetFit && unmatchedTarget && (
                <div className="my-auto py-6 text-center space-y-3 rounded-md border border-border p-4 bg-muted/20">
                  <HelpCircle className="mx-auto h-6 w-6 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Ngành mục tiêu tự do: {unmatchedTarget.majorName}
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Ngành bạn tự nhập hiện chưa có trong cơ sở dữ liệu 145+ rubric chuẩn hóa. Bạn có thể chọn ngành mục tiêu từ danh sách chuẩn hóa để xem rubric chi tiết.
                    </p>
                  </div>
                  <Link
                    to="/thong-tin-ca-nhan"
                    className={buttonVariants({
                      size: 'sm',
                      className: 'text-xs',
                    })}
                  >
                    Chọn ngành chuẩn hóa
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ======================================================== */}
          {/* BẢNG 2: NGÀNH HỌC PHÙ HỢP VỚI USER NHẤT (BEST FIT MAJOR) */}
          {/* ======================================================== */}
          <Card className="border border-border bg-card flex flex-col justify-between shadow-xs">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border border-border bg-muted/60 text-foreground">
                  <Sparkles className="h-3 w-3 text-muted-foreground" />
                  Bảng 2: Ngành học phù hợp nhất
                </div>

                {bestFit && (() => {
                  const bestFitPct = radarMode === 'all' ? (bestFit.allFitPct ?? bestFit.fitPct) : bestFit.fitPct
                  const badgeStyle = getFitStyle(bestFitPct).badge
                  return (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeStyle}`}
                    >
                      {bestFitPct !== null && bestFitPct !== undefined ? `${bestFitPct}% phù hợp` : 'Chưa đủ điểm'}
                    </span>
                  )
                })()}
              </div>

              {/* Best Fit Header Content */}
              {bestFit ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-bold text-foreground leading-snug">
                      {bestFit.majorName}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    {bestFit.schoolName}
                    {bestFit.schoolCode && <span className="ml-1 text-muted-foreground/80">({bestFit.schoolCode})</span>}
                  </CardDescription>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    {bestFit.admissionBlock && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground font-mono">
                        Khối {bestFit.admissionBlock}
                      </span>
                    )}
                    {bestFit.entryScore && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        Điểm chuẩn 2025: <strong className="text-foreground">{bestFit.entryScore}</strong>
                      </span>
                    )}
                    {bestFit.majorGroup && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        {bestFit.majorGroup}
                      </span>
                    )}
                    {bestFit.isTarget && (
                      <span className="px-1.5 py-0.5 rounded border border-border bg-secondary text-secondary-foreground font-medium">
                        ★ Ngành mục tiêu
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-0.5">
                  <CardTitle className="text-base font-bold text-foreground">
                    Gợi ý ngành tối ưu
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Ngành học có độ tương thích cao nhất dựa trên bảng điểm của bạn
                  </CardDescription>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
              {/* TRƯỜNG HỢP: CHƯA CÓ ĐIỂM NÊN CHƯA THỂ TÌM NGÀNH PHÙ HỢP NHẤT */}
              {!hasScores || !bestFit ? (
                <div className="my-auto py-8 text-center space-y-3 rounded-md border border-dashed border-border p-5 bg-muted/10">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Chưa có đủ điểm để xác định ngành phù hợp nhất
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Hệ thống cần bạn nhập điểm trung bình các môn học để tự động quét 145+ ngành chuẩn hóa và tìm ra
                      ngành học có tỷ lệ tương thích cao nhất với năng lực của bạn.
                    </p>
                  </div>
                  <Link
                    to="/thong-tin-ca-nhan"
                    className={buttonVariants({
                      size: 'sm',
                      className: 'text-xs',
                    })}
                  >
                    Nhập điểm học tập ngay
                  </Link>
                </div>
              ) : (
                /* TRƯỜNG HỢP: ĐÃ CÓ BEST FIT */
                (() => {
                  const bestDetails = radarMode === 'all' ? (bestFit.allDetails || bestFit.details || []) : (bestFit.details || [])
                  const bestFitPct = radarMode === 'all' ? (bestFit.allFitPct ?? bestFit.fitPct) : bestFit.fitPct
                  const fitStyle = getFitStyle(bestFitPct)
                  return (
                    <div className="space-y-4">
                      {/* Header with Mode Toggle */}
                      <div className="flex items-center justify-between pb-1 border-b border-border/60">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>{radarMode === 'all' ? 'Mạng nhện toàn diện (tất cả môn)' : 'Mạng nhện tổ hợp (3 môn)'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRadarMode((m) => (m === 'all' ? 'combo' : 'all'))}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          {radarMode === 'all' ? 'Xem 3 môn' : 'Xem tất cả'}
                        </button>
                      </div>

                      {/* Progress bar and Recommendation */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-foreground">
                            Độ tương thích năng lực cao nhất {radarMode === 'all' ? '(75/25)' : ''}:
                          </span>
                          <span className={`font-medium ${fitStyle.text}`}>
                            {bestFitPct !== null ? `${bestFitPct}%` : 'Chưa đủ môn'}
                            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                              ({fitStyle.label})
                            </span>
                          </span>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${fitStyle.bar}`}
                            style={{ width: `${Math.min(bestFitPct || 0, 100)}%` }}
                          />
                        </div>

                        <p className="text-[11px] text-muted-foreground pt-0.5">
                          Độ bao phủ điểm: <strong className="text-foreground">{bestFit.coveragePct}%</strong> các môn yêu cầu.
                          {bestFit.prioritySubject ? (
                            <span className="ml-1">
                              (Lưu ý môn {bestFit.prioritySubject} để tối ưu cơ hội).
                            </span>
                          ) : (
                            <span className="ml-1 text-foreground font-medium">
                              (Các môn thế mạnh của bạn hoàn toàn vượt ngưỡng).
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Radar visualization & Rubric Table */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-5 flex justify-center bg-muted/20 rounded-md p-2 border border-border">
                          <MiniRadar details={bestDetails} />
                        </div>

                        <div className="sm:col-span-7">
                          <RubricTable details={bestDetails} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border">
                        {!bestFit.isTarget ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSetBestFitAsTarget}
                            disabled={targetActionLoading}
                            className="text-xs h-8"
                          >
                            {targetActionLoading ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : (
                              <Target className="mr-1.5 h-3 w-3" />
                            )}
                            Đặt làm ngành mục tiêu
                          </Button>
                        ) : (
                          <span className="text-xs text-foreground font-medium inline-flex items-center">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Đang là ngành mục tiêu
                          </span>
                        )}

                        <Link
                          to="/phan-tich-nang-luc"
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'text-xs text-muted-foreground hover:text-foreground',
                          })}
                        >
                          Bản đồ ngành <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3: CÁC TÍNH NĂNG KHÁM PHÁ TIẾP THEO (QUICK ACCESS) */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Khám phá thêm các tính năng
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="hover:border-foreground/30 transition-colors border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-muted border border-border text-foreground">
                  <Search className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-xs font-semibold">Đề án tuyển sinh</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Tra cứu đề án tuyển sinh và chỉ tiêu xét tuyển các trường ĐH năm 2026.
              </p>
              <Link
                to="/de-an"
                className="text-[11px] text-foreground font-medium hover:underline inline-flex items-center"
              >
                Tra cứu ngay <ArrowRight className="h-2.5 w-2.5 ml-1" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-foreground/30 transition-colors border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-muted border border-border text-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-xs font-semibold">Điểm chuẩn</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Xem điểm chuẩn và xu hướng điểm các trường đại học qua các năm.
              </p>
              <Link
                to="/diem-chuan"
                className="text-[11px] text-foreground font-medium hover:underline inline-flex items-center"
              >
                Xem điểm chuẩn <ArrowRight className="h-2.5 w-2.5 ml-1" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-foreground/30 transition-colors border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-muted border border-border text-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-xs font-semibold">Khối thi đại học</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Danh sách các khối thi xét tuyển và các trường đại học tương ứng.
              </p>
              <Link
                to="/khoi-thi"
                className="text-[11px] text-foreground font-medium hover:underline inline-flex items-center"
              >
                Xem khối thi <ArrowRight className="h-2.5 w-2.5 ml-1" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-foreground/30 transition-colors border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-muted border border-border text-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-xs font-semibold">Tra cứu thứ hạng</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Tra cứu vị trí và xếp hạng dự kiến dựa trên điểm thi tốt nghiệp THPT, ĐGNL HSA và ĐGTD TSA.
              </p>
              <Link
                to="/thu-hang"
                className="text-[11px] text-foreground font-medium hover:underline inline-flex items-center"
              >
                Tra cứu thứ hạng <ArrowRight className="h-2.5 w-2.5 ml-1" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
