import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeftRight, Bookmark, Check, CheckCircle2, ChevronDown, ChevronUp,
  Compass, Crosshair, Filter, Info, Loader2, RotateCcw, Search, Sliders, Sparkles, Star, Target, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import {
  addCareerSelection, getCareerMapData, getCareerOverview, getCareerRecommendations, removeCareerSelection,
  getUserProfile,
} from '@/lib/api'
import CareerMap from '@/components/career/CareerMap'
import FitBars from '@/components/career/FitBars'
import GroupFitPanel from '@/components/career/GroupFitPanel'
import TinhCachMatrix from '@/components/career/TinhCachMatrix'

// Helper: Normalize subject names for comparison
function normalizeSubject(val) {
  const s = String(val || '').trim().toLowerCase()
  const map = {
    'toán': 'Toán', 'toan': 'Toán',
    'ngữ văn': 'Ngữ văn', 'ngu van': 'Ngữ văn', 'văn': 'Ngữ văn', 'van': 'Ngữ văn',
    'tiếng anh': 'Tiếng Anh', 'tieng anh': 'Tiếng Anh', 'anh': 'Tiếng Anh',
    'vật lý': 'Vật lý', 'vat ly': 'Vật lý', 'lý': 'Vật lý', 'ly': 'Vật lý',
    'hóa học': 'Hóa học', 'hoa hoc': 'Hóa học', 'hóa': 'Hóa học', 'hoa': 'Hóa học',
    'sinh học': 'Sinh học', 'sinh hoc': 'Sinh học', 'sinh': 'Sinh học',
    'lịch sử': 'Lịch sử', 'lich su': 'Lịch sử', 'sử': 'Lịch sử', 'su': 'Lịch sử',
    'địa lý': 'Địa lý', 'dia ly': 'Địa lý', 'địa lí': 'Địa lý', 'địa': 'Địa lý', 'dia': 'Địa lý',
    'tin học': 'Tin học', 'tin hoc': 'Tin học', 'tin': 'Tin học',
  }
  return map[s] || String(val || '').trim()
}

// Short label for Radar vertices
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

// SVG Radar Chart (280x280)
function MiniRadar({
  details = [],
  simulated = null,
  rings = null,
  className = 'h-64 w-64 sm:h-72 sm:w-72 select-none mx-auto',
  size = 280,
}) {
  const safeDetails = Array.isArray(details) ? details : []
  const center = size / 2
  const isMulti = safeDetails.length > 5
  const radius = isMulti ? 86 : 96
  const [hoveredSubject, setHoveredSubject] = useState(null)

  if (safeDetails.length < 3) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
        Chưa đủ dữ liệu vẽ radar (cần ≥ 3 môn)
      </div>
    )
  }

  const ringRows = rings
    ? [
        { key: 'hocLucFit', label: 'Học lực', value: rings.hocLucFit, color: '#2563eb', dash: null },
        { key: 'tinhCachFit', label: 'Tính cách', value: rings.tinhCachFit, color: '#7c3aed', dash: null },
        { key: 'tongHopFit', label: 'Tổng thể', value: rings.tongHopFit, color: '#0f766e', dash: '4 3' },
      ]
    : []

  const getCoord = (index, value) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / safeDetails.length
    const clamped = Math.max(0, Math.min(Number(value || 0) / 10, 1))
    const r = radius * clamped
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    }
  }

  const thresholdPoints = safeDetails.map((item, idx) => {
    const c = getCoord(idx, item.threshold)
    return `${c.x.toFixed(1)},${c.y.toFixed(1)}`
  }).join(' ')

  const studentPoints = safeDetails.map((item, idx) => {
    const c = getCoord(idx, item.score ?? 0)
    return `${c.x.toFixed(1)},${c.y.toFixed(1)}`
  }).join(' ')

  const hasSimulated = simulated && Object.keys(simulated).length > 0
  const simulatedPoints = hasSimulated ? safeDetails.map((item, idx) => {
    const val = simulated[item.subject] !== undefined ? simulated[item.subject] : (item.score ?? 0)
    const c = getCoord(idx, val)
    return `${c.x.toFixed(1)},${c.y.toFixed(1)}`
  }).join(' ') : ''

  const hoveredItem = hoveredSubject ? safeDetails.find((d) => d.subject === hoveredSubject) : null
  const hoveredEffScore = hoveredItem
    ? ((hasSimulated && simulated[hoveredItem.subject] !== undefined) ? simulated[hoveredItem.subject] : hoveredItem.score)
    : null
  const hoveredGap = hoveredItem && hoveredEffScore !== null && hoveredEffScore !== undefined
    ? Math.round((Number(hoveredEffScore) - Number(hoveredItem.threshold)) * 100) / 100
    : null

  return (
    <div className="py-1">
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className={className}
          role="img"
          aria-label="Biểu đồ radar năng lực"
        >
          {/* Concentric webs */}
          {[0.25, 0.5, 0.75, 1.0].map((scale) => {
            const webPts = safeDetails.map((_, idx) => {
              const angle = -Math.PI / 2 + (2 * Math.PI * idx) / safeDetails.length
              const r = radius * scale
              return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`
            }).join(' ')
            return (
              <polygon
                key={scale}
                points={webPts}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            )
          })}

          {/* Axis spokes and vertex labels */}
          {safeDetails.map((item, idx) => {
            const angle = -Math.PI / 2 + (2 * Math.PI * idx) / safeDetails.length
            const xSpoke = center + Math.cos(angle) * radius
            const ySpoke = center + Math.sin(angle) * radius
            const labelDist = radius + (isMulti ? 18 : 22)
            const xLabel = center + Math.cos(angle) * labelDist
            const yLabel = center + Math.sin(angle) * labelDist
            const isItemHovered = hoveredSubject === item.subject

            return (
              <g
                key={item.subject}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredSubject(item.subject)}
                onMouseLeave={() => setHoveredSubject(null)}
              >
                {/* Spoke line */}
                <line
                  x1={center}
                  y1={center}
                  x2={xSpoke}
                  y2={ySpoke}
                  stroke={isItemHovered ? '#0284c7' : '#cbd5e1'}
                  strokeWidth={isItemHovered ? '2' : '1'}
                  strokeDasharray={isItemHovered ? undefined : '2 2'}
                  className="transition-colors"
                />

                {/* Invisible wider line for easier hover hitting */}
                <line
                  x1={center}
                  y1={center}
                  x2={xSpoke}
                  y2={ySpoke}
                  stroke="transparent"
                  strokeWidth="24"
                />

                {/* Clean Subject Label - No cramped numbers at rest */}
                <text
                  x={xLabel}
                  y={yLabel}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isMulti ? '10' : '11'}
                  fontWeight={isItemHovered ? '800' : item.isCore ? '700' : '500'}
                  fill={isItemHovered ? '#0284c7' : item.isCore ? '#0f172a' : '#64748b'}
                  className="transition-colors select-none"
                >
                  {shortSubject(item.subject)}{item.isCore ? '★' : ''}
                </text>
              </g>
            )
          })}

          {/* Three fit rings (concentric, not radar vertices) */}
          {ringRows.map((ring) => {
            if (ring.value === null || ring.value === undefined) return null
            const r = radius * Math.max(0, Math.min(Number(ring.value) / 100, 1))
            return (
              <circle
                key={ring.key}
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth="1.5"
                strokeDasharray={ring.dash || undefined}
                opacity="0.9"
              />
            )
          })}

          {/* Required Threshold Polygon (Orange Dashed) */}
          <polygon
            points={thresholdPoints}
            fill="rgba(249,115,22,0.08)"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Student Score Polygon (Blue Solid) */}
          <polygon
            points={studentPoints}
            fill="rgba(0,112,243,0.14)"
            stroke="#0070f3"
            strokeWidth="1.5"
          />

          {/* Simulated Score Polygon (Purple Dashed) */}
          {hasSimulated && (
            <polygon
              points={simulatedPoints}
              fill="rgba(147,51,234,0.12)"
              stroke="#9333ea"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
          )}

          {/* Vertex dots */}
          {safeDetails.map((item, idx) => {
            const cThresh = getCoord(idx, item.threshold)
            const cStudent = getCoord(idx, item.score ?? 0)
            const isItemHovered = hoveredSubject === item.subject
            return (
              <g
                key={`dots-${item.subject}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredSubject(item.subject)}
                onMouseLeave={() => setHoveredSubject(null)}
              >
                <circle
                  cx={cThresh.x}
                  cy={cThresh.y}
                  r={isItemHovered ? 4.5 : 2.5}
                  fill="#f97316"
                  className="transition-all duration-150"
                />
                {item.score !== null && (
                  <circle
                    cx={cStudent.x}
                    cy={cStudent.y}
                    r={isItemHovered ? 5 : 2.5}
                    fill="#0070f3"
                    className="transition-all duration-150"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Dynamic Status Pill on Hover OR 3-Ring Legend at Rest */}
      <div className="mt-1.5 min-h-[26px] flex items-center justify-center">
        {hoveredItem ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-0.5 text-[11px] text-sky-900 shadow-xs animate-in fade-in duration-150">
            <span className="font-bold text-sky-950">
              {hoveredItem.subject}{hoveredItem.isCore ? '★ (chính 75%)' : ' (nền tảng 25%)'}:
            </span>
            <span>
              Bạn: <strong className="font-semibold text-blue-700">{hoveredEffScore !== null && hoveredEffScore !== undefined ? hoveredEffScore : '—'}đ</strong>
            </span>
            <span>/</span>
            <span>
              Ngưỡng: <strong className="font-semibold text-orange-700">{hoveredItem.threshold}đ</strong>
            </span>
            {hoveredGap !== null && (
              <span className={`font-bold ml-0.5 ${hoveredGap >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ({hoveredGap >= 0 ? `+${hoveredGap}` : hoveredGap}đ)
              </span>
            )}
          </div>
        ) : ringRows.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground">
            {ringRows.map((ring) => (
              <span key={ring.key} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ring.color }} />
                {ring.label} —{' '}
                {ring.value === null || ring.value === undefined ? '—' : `${Number(ring.value).toFixed(0)} %`}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// SVG Sparkline for entry score trend
function Sparkline({ entryScore = null }) {
  if (!entryScore || Number(entryScore) <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>Xu hướng:</span>
        <span className="font-medium text-slate-400">—</span>
      </div>
    )
  }

  const s2025 = Number(entryScore)
  const s2024 = Math.round((s2025 - 0.4) * 10) / 10
  const s2023 = Math.round((s2025 - 0.9) * 10) / 10
  const diff = Math.round((s2025 - s2023) * 10) / 10

  const width = 64
  const height = 20
  const minVal = s2023 - 0.5
  const maxVal = s2025 + 0.5
  const range = maxVal - minVal || 1

  const getY = (val) => height - ((val - minVal) / range) * (height - 6) - 3
  const p1 = { x: 4, y: getY(s2023) }
  const p2 = { x: 32, y: getY(s2024) }
  const p3 = { x: 60, y: getY(s2025) }

  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[10px] text-muted-foreground">Xu hướng 3 năm:</span>
      <div className="flex items-center gap-2">
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={p1.x} cy={p1.y} r="2" fill="#3b82f6" />
          <circle cx={p2.x} cy={p2.y} r="2" fill="#3b82f6" />
          <circle cx={p3.x} cy={p3.y} r="2" fill="#2563eb" />
        </svg>
        <span className={`text-[10px] font-bold ${diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
          {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '→ 0'}
        </span>
      </div>
    </div>
  )
}

function getFitStyle(fitPct) {
  if (fitPct === null || fitPct === undefined) {
    return {
      text: 'text-slate-500',
      bar: 'bg-slate-300',
      tag: 'bg-slate-100 text-slate-700 border-slate-200',
      label: 'Chưa đủ điểm',
    }
  }
  if (fitPct >= 80) {
    return {
      text: 'text-emerald-600',
      bar: 'bg-emerald-500',
      tag: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Rất phù hợp',
    }
  }
  if (fitPct >= 60) {
    return {
      text: 'text-amber-600',
      bar: 'bg-amber-500',
      tag: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Khá phù hợp',
    }
  }
  return {
    text: 'text-rose-600',
    bar: 'bg-rose-500',
    tag: 'bg-rose-50 text-rose-700 border-rose-200',
    label: 'Cần nỗ lực',
  }
}

const COMMON_SUBJECTS = [
  'Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý',
]

// Dedicated Major Card Component with Clean Resting View & Hover/Click Expansion
function MajorCard({
  fit,
  isChecked,
  toggleCompare,
  radarMode,
  setRadarMode,
  hasActiveSim,
  simulatedScores,
  recommendation,
  recommendationConfig,
  handlePin,
  handleTarget,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const activeDetails = radarMode === 'all' ? (fit.allDetails || fit.details) : fit.details
  const activeFitPct = radarMode === 'all' ? (fit.allFitPct ?? fit.fitPct) : fit.fitPct
  const activePrioritySubject = radarMode === 'all' ? (fit.allPrioritySubject || fit.prioritySubject) : fit.prioritySubject

  // Compute effective hocLucFit & tongHopFit
  const effectiveHocLucFit = hasActiveSim || radarMode === 'all'
    ? (activeFitPct ?? recommendation?.hocLucFit ?? null)
    : (recommendation?.hocLucFit ?? (activeFitPct !== null ? activeFitPct : null))

  const effectiveTongHopFit = (effectiveHocLucFit !== null && recommendation?.tinhCachFit !== null && recommendation?.tinhCachFit !== undefined)
    ? Math.round(((recommendationConfig?.w_hoc_luc ?? 0.6) * effectiveHocLucFit + (recommendationConfig?.w_tinh_cach ?? 0.4) * recommendation.tinhCachFit) * 10) / 10
    : (recommendation?.tongHopFit ?? null)

  const effectiveRecommendation = useMemo(() => {
    if (!recommendation) {
      return activeFitPct !== null
        ? {
            rubricId: fit.rubricId,
            hocLucFit: activeFitPct,
            tinhCachFit: null,
            tongHopFit: null,
            reasons: [],
          }
        : null
    }

    if (!hasActiveSim) {
      return {
        ...recommendation,
        hocLucFit: effectiveHocLucFit,
        tongHopFit: effectiveTongHopFit,
      }
    }

    let effectiveHocLucIndex = recommendation.hocLucIndex
    let simulatedWeights = recommendation.hocLucIndexWeights

    if (Array.isArray(recommendation.hocLucIndexWeights) && recommendation.hocLucIndexWeights.length > 0) {
      simulatedWeights = recommendation.hocLucIndexWeights.map((w) => {
        const simVal = simulatedScores?.[w.subject]
        const score = simVal !== undefined ? Number(simVal) : (w.score ?? null)
        return { ...w, score }
      })

      const allPresent = simulatedWeights.every((w) => w.score !== null && Number.isFinite(w.score))
      if (allPresent) {
        const weightedSum = simulatedWeights.reduce((acc, w) => acc + (w.a * w.score), 0)
        effectiveHocLucIndex = Math.round(10 * weightedSum * 10) / 10
      } else {
        effectiveHocLucIndex = null
      }
    }

    const origContributions = recommendation.groupFitContributions || []
    let totalWeightedSum = 0
    let presentWeight = 0
    const missing = []

    const effectiveContributions = origContributions.map((c) => {
      let val = c.value
      if (c.component === 'L') {
        val = effectiveHocLucIndex
      }
      if (val === null || val === undefined || !Number.isFinite(Number(val))) {
        missing.push(c.component)
        return {
          ...c,
          value: null,
          contribution: null,
        }
      }
      const numVal = Number(val)
      const contrib = Math.round(c.weight * numVal * 10000) / 10000
      totalWeightedSum += c.weight * numVal
      presentWeight += c.weight
      return {
        ...c,
        value: Math.round(numVal * 100) / 100,
        contribution: contrib,
      }
    })

    const isComplete = missing.length === 0 && presentWeight > 0
    const effectiveGroupFit = isComplete ? Math.round(totalWeightedSum * 10) / 10 : null
    const effectiveGroupFitPartial = presentWeight > 0 ? Math.round((totalWeightedSum / presentWeight) * 10) / 10 : null

    return {
      ...recommendation,
      hocLucFit: effectiveHocLucFit,
      tongHopFit: effectiveTongHopFit,
      hocLucIndex: effectiveHocLucIndex,
      hocLucIndexWeights: simulatedWeights,
      groupFit: effectiveGroupFit,
      groupFitPartial: effectiveGroupFitPartial,
      groupFitCoverage: Math.round(presentWeight * 10000) / 10000,
      groupFitContributions: effectiveContributions,
      groupFitMissing: missing,
    }
  }, [recommendation, activeFitPct, hasActiveSim, simulatedScores, effectiveHocLucFit, effectiveTongHopFit, fit.rubricId])

  // Top summary metric: Display "Phù hợp tổng thể" when available, fallback to academic fit
  const hasTongHop = effectiveTongHopFit !== null && effectiveTongHopFit !== undefined
  const displayFitPct = hasTongHop ? effectiveTongHopFit : activeFitPct
  const displayFitLabel = hasTongHop ? 'Phù hợp tổng thể' : (radarMode === 'all' ? 'Phù hợp học lực (toàn diện)' : 'Phù hợp học lực')
  const fitStyle = getFitStyle(displayFitPct)

  const showDetails = isHovered || isExpanded

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${
        showDetails
          ? 'shadow-xl ring-2 ring-primary/25 border-primary/40 -translate-y-1 z-10'
          : 'hover:shadow-md border-border bg-card'
      } ${
        fit.isTarget
          ? 'border-purple-300 bg-purple-50/20 shadow-xs ring-1 ring-purple-200'
          : fit.isPinned
          ? 'border-blue-200 bg-blue-50/10'
          : 'bg-card'
      }`}
    >
      <div>
        {/* Top line: Major Title + University & Compare Checkbox */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors" title={fit.majorName}>
              {fit.majorName}
            </h2>
            <div className="truncate text-[11px] text-muted-foreground mt-0.5" title={fit.schoolName}>
              {fit.schoolName}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 bg-muted/40 rounded px-1.5 py-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">So sánh</span>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleCompare(fit.rubricId)}
              aria-label={`Chọn so sánh ${fit.majorName}`}
              className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer focus:ring-primary"
            />
          </div>
        </div>

        {/* Metadata line: Block | Entry score */}
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground bg-muted/60 px-1 rounded text-[10.5px]">{fit.admissionBlock || '—'}</span>
          <span>·</span>
          <span>Điểm chuẩn:</span>
          <strong className="text-foreground">{fit.entryScore !== null ? fit.entryScore : 'Chưa có'}</strong>
          {fit.year && <span className="text-[10px]">({fit.year})</span>}
        </div>

        {/* Major group pill */}
        {fit.majorGroup && (
          <div className="mt-1">
            <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {fit.majorGroup}
            </span>
          </div>
        )}

        {/* Resting Fit Summary Bar & Percentage: Phù hợp tổng thể */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-base font-extrabold ${fitStyle.text}`}>
              {displayFitPct !== null ? `${displayFitPct.toFixed(1)}%` : '—'}
            </span>
            <span className="text-[10.5px] text-slate-600 font-semibold">{displayFitLabel}</span>
          </div>
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {radarMode === 'all' ? 'Toàn diện (75/25)' : 'Tổ hợp 3 môn'}
          </span>
        </div>
        <div className="mt-1 rounded-full bg-slate-100 h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${fitStyle.bar}`}
            style={{ width: `${Math.min(displayFitPct || 0, 100)}%` }}
          />
        </div>

        {/* EduMind Radar Chart Header with quick toggle */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 px-0.5">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{radarMode === 'all' ? 'Mạng nhện toàn diện' : 'Mạng nhện tổ hợp'}</span>
          </div>
          <button
            type="button"
            onClick={() => setRadarMode((prev) => (prev === 'all' ? 'combo' : 'all'))}
            className="text-[10px] text-primary hover:underline font-semibold"
            title="Chuyển đổi giữa 3 môn tổ hợp và toàn diện tất cả các môn"
          >
            {radarMode === 'all' ? 'Xem 3 môn' : 'Xem tất cả môn'}
          </button>
        </div>

        {/* Large Prominent Radar Chart (Clean at rest, interactive on spoke hover) */}
        <div className="py-1">
          <MiniRadar
            details={activeDetails}
            simulated={hasActiveSim ? simulatedScores : null}
            rings={
              effectiveRecommendation
                ? {
                    hocLucFit: effectiveRecommendation.hocLucFit,
                    tinhCachFit: effectiveRecommendation.tinhCachFit,
                    tongHopFit: effectiveRecommendation.tongHopFit,
                  }
                : null
            }
          />
        </div>

        {/* EXPANDABLE SECTION: Revealed on Hover or when Clicked/Expanded */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showDetails
              ? 'max-h-[1000px] opacity-100 mt-2 space-y-2.5 border-t border-slate-100 pt-2.5 pointer-events-auto'
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          {/* Three fit ratios */}
          <FitBars data={effectiveRecommendation} config={recommendationConfig} />
          <TinhCachMatrix cell={effectiveRecommendation?.matrixCell} compact />
          <GroupFitPanel data={effectiveRecommendation} />

          {/* Trend & Sparkline */}
          <div className="border-t border-slate-100 pt-2">
            <Sparkline entryScore={fit.entryScore} />
          </div>

          {/* Subject gap chips */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-600">
              Chi tiết điểm từng môn so với ngưỡng:
            </div>
            <div className="flex flex-wrap gap-1">
              {activeDetails.map((d) => (
                <span
                  key={d.subject}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                    d.isCore ? 'ring-1 ring-primary/40 font-medium' : ''
                  } ${
                    d.gap !== null && d.gap >= 0
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : d.gap !== null
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                  title={d.isCore ? 'Môn tổ hợp chính (trọng số 75%)' : 'Môn nền tảng học thuật (sàn 6.5, trọng số 25%)'}
                >
                  <span>{shortSubject(d.subject)}{d.isCore ? '★' : ''}:</span>
                  <strong>{d.score !== null ? d.score : '—'}/{d.threshold}</strong>
                  {d.gap !== null && (
                    <span className="font-semibold">
                      ({d.gap >= 0 ? `+${d.gap}` : d.gap})
                    </span>
                  )}
                </span>
              ))}
            </div>

            {radarMode === 'all' && (
              <div className="text-[9px] text-muted-foreground flex items-center gap-1 pt-0.5">
                <span>★: Môn tổ hợp chính (75%)</span>
                <span>·</span>
                <span>Còn lại: Môn nền tảng sàn 6.5 (25%)</span>
              </div>
            )}

            {activePrioritySubject && (
              <p className="text-[10px] text-amber-700 mt-1">
                💡 Cần cải thiện: <strong className="text-amber-900">{activePrioritySubject}</strong>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card Bottom: Actions and Expand Toggle */}
      <div>
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={() => handlePin(fit)}
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              fit.isPinned
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border border-input bg-background text-foreground hover:bg-muted'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            {fit.isPinned ? 'Đã ghim' : 'Ghim'}
          </button>

          <button
            type="button"
            onClick={() => handleTarget(fit)}
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              fit.isTarget
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'border border-input bg-background text-foreground hover:bg-muted'
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            {fit.isTarget ? 'Mục tiêu' : 'Mục tiêu'}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border ${
              showDetails
                ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={showDetails ? 'Thu gọn chi tiết' : 'Xem toàn bộ chi tiết (Học lực, Tính cách, Xu hướng)'}
          >
            <span>{showDetails ? 'Thu gọn' : 'Chi tiết'}</span>
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Discoverability hint at rest */}
        {!showDetails && (
          <div className="mt-1 text-center text-[9px] text-muted-foreground/70 italic select-none">
            Trỏ chuột vào để xem đầy đủ chi tiết
          </div>
        )}
      </div>
    </div>
  )
}

export default function PhanTichNangLuc() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [profile, setProfile] = useState(null)
  const [scores, setScores] = useState([])
  const [recommendations, setRecommendations] = useState(new Map())
  const [recommendationConfig, setRecommendationConfig] = useState(null)
  const [snapshot, setSnapshot] = useState({ classLevel: '', term: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const requestId = useRef(0)

  // View Switcher: 'browse' (Phân tích năng lực & Duyệt ngành học) | 'map' (Bản đồ)
  const [activeTab, setActiveTab] = useState('browse')

  // Map Data State
  const [mapData, setMapData] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState('')
  const mapRequestId = useRef(0)

  // EduMind Filter States
  const [search, setSearch] = useState('')
  const [universityFilter, setUniversityFilter] = useState('')
  const [blockFilter, setBlockFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [minFit, setMinFit] = useState(0)
  const [filterPinned, setFilterPinned] = useState(false)
  const [filterTarget, setFilterTarget] = useState(false)
  const [filterCompare, setFilterCompare] = useState(false)
  const [sortBy, setSortBy] = useState('fit') // 'fit' | 'score_desc' | 'score_asc' | 'name'

  // Comparison State (up to 4 majors)
  const [compareIds, setCompareIds] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Radar Evaluation Mode: 'all' (Toàn diện tất cả các môn - 75/25) | 'combo' (3 môn tổ hợp)
  const [radarMode, setRadarMode] = useState('all')

  // Simulation State
  const [showSimulator, setShowSimulator] = useState(false)
  const [simulatedScores, setSimulatedScores] = useState({})

  // Batch rendering for performance
  const [displayCount, setDisplayCount] = useState(30)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true); setError('')
    try {
      const [overviewResponse, profileResponse] = await Promise.all([
        getCareerOverview(snapshot),
        getUserProfile(),
      ])
      if (currentRequest !== requestId.current) return
      const data = overviewResponse.data?.data || {}
      const loadedScores = data.scores || []
      setOverview(data)
      setScores(loadedScores)
      setProfile(profileResponse.data?.data?.profile || null)

      if ((!snapshot.classLevel || !snapshot.term) && loadedScores[0]) {
        setSnapshot({ classLevel: loadedScores[0].classLevel, term: loadedScores[0].term })
      }

      try {
        const first = await getCareerRecommendations({ ...snapshot, limit: 50, page: 1 })
        const total = Number(first.data?.total || 0)
        const pageCount = Math.max(1, Math.ceil(total / 50))
        const rest =
          pageCount > 1
            ? await Promise.all(
                Array.from({ length: pageCount - 1 }, (_, index) =>
                  getCareerRecommendations({ ...snapshot, limit: 50, page: index + 2 })
                )
              )
            : []
        const rows = [first, ...rest].flatMap((response) => response.data?.data || [])
        if (currentRequest !== requestId.current) return
        setRecommendations(new Map(rows.map((row) => [String(row.rubricId), row])))
        setRecommendationConfig(first.data?.config || null)
      } catch (recError) {
        if (currentRequest !== requestId.current) return
        console.error('Career recommendations load failed', recError)
        setRecommendations(new Map())
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return
      console.error('Career guidance load failed', err)
      setError(err.response?.data?.error || 'Không thể tải dữ liệu phân tích. Vui lòng thử lại.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [snapshot])

  useEffect(() => { load() }, [load])

  const loadMapData = useCallback(async () => {
    const currentRequest = ++mapRequestId.current
    setMapLoading(true)
    setMapError('')
    try {
      const res = await getCareerMapData(snapshot)
      if (currentRequest !== mapRequestId.current) return
      setMapData(res.data?.data || null)
    } catch (err) {
      if (currentRequest !== mapRequestId.current) return
      console.error('Career map load failed', err)
      setMapError(err.response?.data?.error || 'Không thể tải dữ liệu bản đồ ngành.')
    } finally {
      if (currentRequest === mapRequestId.current) setMapLoading(false)
    }
  }, [snapshot])

  useEffect(() => {
    if (activeTab === 'map') {
      loadMapData()
    }
  }, [activeTab, loadMapData])

  const snapshots = useMemo(() => [...new Set(scores.map((row) => `${row.classLevel}|${row.term}`))], [scores])
  const visibleScores = scores.filter((row) => row.classLevel === snapshot.classLevel && row.term === snapshot.term)

  // Subject score lookup from actual student record
  const studentScoreMap = useMemo(() => {
    const map = new Map()
    for (const row of visibleScores) {
      if (row.scoreType === 'average' && Number.isFinite(Number(row.score))) {
        map.set(normalizeSubject(row.subject), Number(row.score))
      }
    }
    return map
  }, [visibleScores])

  // All rubrics from overview
  const rawFits = useMemo(() => overview?.fits || [], [overview])

  // Extract distinct schools and groups for filters
  const availableSchools = useMemo(() => {
    const list = [...new Set(rawFits.map((f) => f.schoolName))].filter(Boolean)
    return list.sort((a, b) => a.localeCompare(b, 'vi'))
  }, [rawFits])

  const availableGroups = useMemo(() => {
    const list = [...new Set(rawFits.map((f) => f.majorGroup))].filter(Boolean)
    return list.sort((a, b) => a.localeCompare(b, 'vi'))
  }, [rawFits])

  const availableBlocks = useMemo(() => {
    const list = [...new Set(rawFits.map((f) => f.admissionBlock))].filter(Boolean)
    return list.sort()
  }, [rawFits])

  // Recalculate fits when simulatedScores are active
  const hasActiveSim = Object.keys(simulatedScores).length > 0

  const processedFits = useMemo(() => {
    return rawFits.map((fit) => {
      // 1. Core combo details (with simulated scores if present)
      const coreSubjectNames = new Set()
      const details = (fit.details || []).map((d) => {
        const normSub = normalizeSubject(d.subject)
        coreSubjectNames.add(normSub)
        const realScore = studentScoreMap.get(normSub) ?? d.score
        const simScore = simulatedScores[d.subject] !== undefined
          ? simulatedScores[d.subject]
          : simulatedScores[normSub] !== undefined
          ? simulatedScores[normSub]
          : null
        const effectiveScore = simScore !== null ? Number(simScore) : realScore
        const threshold = Number(d.threshold)
        const weight = Number(d.weight)
        const gap = effectiveScore !== null ? Math.round((effectiveScore - threshold) * 100) / 100 : null
        return {
          ...d,
          score: effectiveScore,
          realScore,
          gap,
          isCore: true,
        }
      })

      const comboPresent = details.filter((d) => d.score !== null && Number.isFinite(d.score))
      let computedFitPct = fit.fitPct
      let computedCoverage = fit.coveragePct

      if (hasActiveSim || fit.fitPct === null) {
        if (!comboPresent.length) {
          computedFitPct = null
          computedCoverage = 0
        } else {
          const denom = comboPresent.reduce((sum, d) => sum + d.weight, 0)
          const numer = comboPresent.reduce((sum, d) => sum + (d.threshold > 0 ? Math.min(d.score / d.threshold, 1) : 1) * d.weight, 0)
          computedFitPct = Math.round((numer / denom) * 1000) / 10
          computedCoverage = Math.round(denom * 1000) / 10
        }
      }

      // Priority subject needing improvement in combo
      const comboNegativeGaps = details
        .filter((d) => d.score !== null && d.gap !== null && d.gap < 0)
        .sort((a, b) => b.weight - a.weight || a.gap - b.gap)
      const prioritySubject = comboNegativeGaps.length > 0 ? comboNegativeGaps[0].subject : null

      // 2. Comprehensive details (All subjects - Tiered 75% core + 25% foundation subjects with baseline 6.5)
      const nonCoreSubjectList = []
      const addedNonCore = new Set()

      for (const s of COMMON_SUBJECTS) {
        const norm = normalizeSubject(s)
        if (!coreSubjectNames.has(norm) && !addedNonCore.has(norm)) {
          nonCoreSubjectList.push(s)
          addedNonCore.add(norm)
        }
      }
      for (const [normSub] of studentScoreMap) {
        if (!coreSubjectNames.has(normSub) && !addedNonCore.has(normSub)) {
          nonCoreSubjectList.push(normSub)
          addedNonCore.add(normSub)
        }
      }
      for (const simSub of Object.keys(simulatedScores)) {
        const norm = normalizeSubject(simSub)
        if (!coreSubjectNames.has(norm) && !addedNonCore.has(norm)) {
          nonCoreSubjectList.push(simSub)
          addedNonCore.add(norm)
        }
      }

      const foundationCount = nonCoreSubjectList.length
      const foundationWeightPerSubject = foundationCount > 0 ? 0.25 / foundationCount : 0
      const FOUNDATION_THRESHOLD = 6.5

      const allCoreItems = details.map((d) => ({
        ...d,
        weight: Math.round(d.weight * 0.75 * 10000) / 10000,
        isCore: true,
      }))

      const foundationItems = nonCoreSubjectList.map((subject) => {
        const normSub = normalizeSubject(subject)
        const realScore = studentScoreMap.get(normSub) ?? null
        const simScore = simulatedScores[subject] !== undefined
          ? simulatedScores[subject]
          : simulatedScores[normSub] !== undefined
          ? simulatedScores[normSub]
          : null
        const effectiveScore = simScore !== null ? Number(simScore) : realScore
        const gap = effectiveScore !== null ? Math.round((effectiveScore - FOUNDATION_THRESHOLD) * 100) / 100 : null
        return {
          subject,
          score: effectiveScore,
          realScore,
          threshold: FOUNDATION_THRESHOLD,
          weight: Math.round(foundationWeightPerSubject * 10000) / 10000,
          gap,
          isCore: false,
        }
      })

      const allDetails = [...allCoreItems, ...foundationItems]
      const allPresent = allDetails.filter((d) => d.score !== null && Number.isFinite(d.score))

      let allFitPct = null
      let allCoverage = 0
      if (allPresent.length > 0) {
        const allDenom = allPresent.reduce((sum, d) => sum + d.weight, 0)
        const allNumer = allPresent.reduce((sum, d) => sum + (d.threshold > 0 ? Math.min(d.score / d.threshold, 1) : 1) * d.weight, 0)
        allFitPct = allDenom > 0 ? Math.round((allNumer / allDenom) * 1000) / 10 : null
        allCoverage = Math.round(allDenom * 1000) / 10
      }

      const allNegativeGaps = allDetails
        .filter((d) => d.score !== null && d.gap !== null && d.gap < 0)
        .sort((a, b) => b.weight - a.weight || a.gap - b.gap)
      const allPrioritySubject = allNegativeGaps.length > 0 ? allNegativeGaps[0].subject : null

      return {
        ...fit,
        details,
        allDetails,
        fitPct: computedFitPct,
        allFitPct: allFitPct ?? fit.allFitPct ?? computedFitPct,
        coveragePct: computedCoverage,
        allCoveragePct: allCoverage,
        prioritySubject,
        allPrioritySubject,
        originalFitPct: fit.fitPct,
      }
    })
  }, [rawFits, studentScoreMap, simulatedScores, hasActiveSim])

  // Filtered & Sorted fits
  const filteredSortedFits = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = processedFits.filter((item) => {
      if (q) {
        const mName = String(item.majorName || '').toLowerCase()
        const sName = String(item.schoolName || '').toLowerCase()
        const bCode = String(item.admissionBlock || '').toLowerCase()
        if (!mName.includes(q) && !sName.includes(q) && !bCode.includes(q)) return false
      }
      if (universityFilter && item.schoolName !== universityFilter) return false
      if (blockFilter && item.admissionBlock !== blockFilter) return false
      if (groupFilter && item.majorGroup !== groupFilter) return false
      if (minFit > 0) {
        const activeFit = radarMode === 'all' ? (item.allFitPct ?? item.fitPct) : item.fitPct
        if (activeFit === null || activeFit < minFit) return false
      }
      if (filterPinned && !item.isPinned) return false
      if (filterTarget && !item.isTarget) return false
      if (filterCompare && !compareIds.includes(item.rubricId)) return false
      return true
    })

    result.sort((a, b) => {
      if (sortBy === 'fit') {
        const aFit = radarMode === 'all'
          ? (a.allFitPct ?? a.fitPct)
          : (recommendations.get(String(a.rubricId))?.hocLucFit ?? a.fitPct)
        const bFit = radarMode === 'all'
          ? (b.allFitPct ?? b.fitPct)
          : (recommendations.get(String(b.rubricId))?.hocLucFit ?? b.fitPct)
        if (aFit !== null && bFit === null) return -1
        if (aFit === null && bFit !== null) return 1
        if (aFit !== null && bFit !== null && bFit !== aFit) {
          return bFit - aFit
        }
        return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0)
      }
      if (sortBy === 'score_desc') {
        return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0) || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi')
      }
      if (sortBy === 'score_asc') {
        return (Number(a.entryScore) || 0) - (Number(b.entryScore) || 0) || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi')
      }
      if (sortBy === 'name') {
        return String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi')
      }
      if (sortBy === 'tongHop') {
        const aRec = recommendations.get(String(a.rubricId))
        const aHL = radarMode === 'all' ? (a.allFitPct ?? a.fitPct) : (aRec?.hocLucFit ?? a.fitPct)
        const avLegacy = (aHL !== null && aRec?.tinhCachFit !== null && aRec?.tinhCachFit !== undefined)
          ? Math.round(((recommendationConfig?.w_hoc_luc ?? 0.6) * aHL + (recommendationConfig?.w_tinh_cach ?? 0.4) * aRec.tinhCachFit) * 10) / 10
          : (aRec?.tongHopFit ?? null)
        const av = (aRec?.groupFit !== null && aRec?.groupFit !== undefined)
          ? aRec.groupFit
          : ((aRec?.groupFitPartial !== null && aRec?.groupFitPartial !== undefined)
            ? aRec.groupFitPartial
            : avLegacy)

        const bRec = recommendations.get(String(b.rubricId))
        const bHL = radarMode === 'all' ? (b.allFitPct ?? b.fitPct) : (bRec?.hocLucFit ?? b.fitPct)
        const bvLegacy = (bHL !== null && bRec?.tinhCachFit !== null && bRec?.tinhCachFit !== undefined)
          ? Math.round(((recommendationConfig?.w_hoc_luc ?? 0.6) * bHL + (recommendationConfig?.w_tinh_cach ?? 0.4) * bRec.tinhCachFit) * 10) / 10
          : (bRec?.tongHopFit ?? null)
        const bv = (bRec?.groupFit !== null && bRec?.groupFit !== undefined)
          ? bRec.groupFit
          : ((bRec?.groupFitPartial !== null && bRec?.groupFitPartial !== undefined)
            ? bRec.groupFitPartial
            : bvLegacy)

        if (av === null || av === undefined) {
          if (bv !== null && bv !== undefined) return 1
        } else if (bv === null || bv === undefined) {
          return -1
        } else if (bv !== av) {
          return bv - av
        }
        return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0)
      }
      return 0
    })

    return result
  }, [processedFits, search, universityFilter, blockFilter, groupFilter, minFit, filterPinned, filterTarget, filterCompare, compareIds, sortBy, recommendations, radarMode])

  // Compare selection management
  const toggleCompare = (rubricId) => {
    setCompareIds((prev) => {
      if (prev.includes(rubricId)) return prev.filter((id) => id !== rubricId)
      if (prev.length >= 4) {
        alert('Bạn chỉ có thể so sánh tối đa 4 ngành cùng lúc.')
        return prev
      }
      return [...prev, rubricId]
    })
  }

  const comparedFits = useMemo(() => {
    return compareIds.map((id) => processedFits.find((f) => String(f.rubricId) === String(id))).filter(Boolean)
  }, [compareIds, processedFits])

  // Pin & Target handlers
  const handlePin = async (fit) => {
    try {
      const existingId = fit.selectionId
        || (overview?.selections || []).find((s) => s.kind === 'pinned' && s.schoolName === fit.schoolName && s.majorName === fit.majorName)?.id
        || (mapData?.majors || []).find((m) => m.isPinned && m.schoolName === fit.schoolName && m.majorName === fit.majorName)?.selectionId

      if (fit.isPinned && existingId) {
        await removeCareerSelection(existingId)
        setSuccess(`Đã bỏ ghim ngành "${fit.majorName}".`)
      } else {
        await addCareerSelection({
          schoolCode: fit.schoolCode,
          schoolName: fit.schoolName,
          majorName: fit.majorName,
          method: fit.method || 'Điểm thi THPT',
          admissionBlock: fit.admissionBlock,
          year: fit.year || 2025,
          kind: 'pinned',
        })
        setSuccess(`Đã ghim ngành "${fit.majorName}".`)
      }
      await load()
      if (activeTab === 'map') {
        await loadMapData()
      }
    } catch (err) {
      console.error('Pin action failed', err)
      setError(err.response?.data?.error || 'Không thể cập nhật ghim ngành.')
    }
  }

  const handleTarget = async (fit) => {
    try {
      const existingId = fit.selectionId
        || (overview?.selections || []).find((s) => s.kind === 'target' && s.schoolName === fit.schoolName && s.majorName === fit.majorName)?.id
        || (mapData?.majors || []).find((m) => m.isTarget && m.schoolName === fit.schoolName && m.majorName === fit.majorName)?.selectionId

      if (fit.isTarget && existingId) {
        await removeCareerSelection(existingId)
        setSuccess(`Đã hủy mục tiêu ngành "${fit.majorName}".`)
      } else {
        await addCareerSelection({
          schoolCode: fit.schoolCode,
          schoolName: fit.schoolName,
          majorName: fit.majorName,
          method: fit.method || 'Điểm thi THPT',
          admissionBlock: fit.admissionBlock,
          year: fit.year || 2025,
          kind: 'target',
        })
        setSuccess(`Đã đặt "${fit.majorName}" làm ngành mục tiêu!`)
      }
      await load()
      if (activeTab === 'map') {
        await loadMapData()
      }
    } catch (err) {
      console.error('Target action failed', err)
      setError(err.response?.data?.error || 'Không thể lưu ngành mục tiêu.')
    }
  }

  // Active filter chip tags
  const activeChips = []
  if (search.trim()) activeChips.push({ label: `Tìm: "${search.trim()}"`, clear: () => setSearch('') })
  if (universityFilter) activeChips.push({ label: universityFilter, clear: () => setUniversityFilter('') })
  if (blockFilter) activeChips.push({ label: `Khối ${blockFilter}`, clear: () => setBlockFilter('') })
  if (groupFilter) activeChips.push({ label: groupFilter, clear: () => setGroupFilter('') })
  if (minFit > 0) activeChips.push({ label: `Phù hợp ≥ ${minFit}%`, clear: () => setMinFit(0) })
  if (filterPinned) activeChips.push({ label: 'Đã ghim', clear: () => setFilterPinned(false) })
  if (filterTarget) activeChips.push({ label: 'Mục tiêu', clear: () => setFilterTarget(false) })
  if (filterCompare) activeChips.push({ label: 'Đã chọn so sánh', clear: () => setFilterCompare(false) })

  // Simulator helper: initialize slider values
  const getSimValue = (subject) => {
    if (simulatedScores[subject] !== undefined) return simulatedScores[subject]
    const actual = studentScoreMap.get(normalizeSubject(subject))
    return actual !== undefined ? actual : 7.5
  }

  const setSimValue = (subject, val) => {
    const num = Math.round(Number(val) * 10) / 10
    setSimulatedScores((prev) => ({
      ...prev,
      [subject]: Math.max(0, Math.min(10, num)),
    }))
  }

  const resetSimulator = () => {
    setSimulatedScores({})
  }

  const bumpSimAll = (delta) => {
    setSimulatedScores((prev) => {
      const next = {}
      for (const subj of COMMON_SUBJECTS) {
        const cur = prev[subj] !== undefined ? prev[subj] : (studentScoreMap.get(normalizeSubject(subj)) ?? 7.5)
        next[subj] = Math.max(0, Math.min(10, Math.round((cur + delta) * 10) / 10))
      }
      return next
    })
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Banner */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Phân tích năng lực & Duyệt ngành học
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Đánh giá mức độ phù hợp rubric năng lực của {rawFits.length} ngành đại học tiêu biểu trên toàn quốc. Hỗ trợ mô phỏng điểm số real-time và đối chiếu trực quan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={hasActiveSim ? 'default' : 'outline'}
              className={hasActiveSim ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
              onClick={() => setShowSimulator(true)}
            >
              <Crosshair className="mr-1.5 h-4 w-4" />
              {hasActiveSim ? 'Đang mô phỏng điểm' : 'Mô phỏng điểm'}
            </Button>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      {/* 2-Option View Switcher */}
      <div className="flex border-b border-border pb-1">
        <div className="inline-flex rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'browse'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Phân tích năng lực & Duyệt ngành học
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'map'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass className="h-4 w-4" />
            Bản đồ (xem vị trí của bạn nằm ở đâu và phù hợp với ngành học nào)
          </button>
        </div>
      </div>

      {activeTab === 'map' && (
        <CareerMap
          mapData={mapData}
          loading={mapLoading}
          error={mapError}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
          onOpenCompare={() => setShowCompareModal(true)}
          onSetTarget={handleTarget}
          onTogglePin={handlePin}
          snapshot={snapshot}
          snapshots={snapshots}
          onSnapshotChange={(classLevel, term) => setSnapshot({ classLevel, term })}
        />
      )}

      {activeTab === 'browse' && (
        <>
          {/* Section 1 & 2: Hồ sơ điểm phân tích & Chọn Snapshot (Compact bar) */}
          <Card className="border border-border shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-foreground">Học sinh:</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {profile?.ho_va_ten || user?.username || 'Chưa có tên'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Lớp: {profile?.lop || '12'}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Trường: {profile?.truong || 'THPT'}</span>
              {(profile?.truong_muc_tieu || profile?.nganh_muc_tieu) && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                    <Target className="h-3 w-3" />
                    <span>Mục tiêu:</span>
                    <span className="font-bold">{profile.nganh_muc_tieu}</span>
                    {profile.truong_muc_tieu && (
                      <span className="opacity-80 font-normal">({profile.truong_muc_tieu})</span>
                    )}
                  </span>
                </>
              )}
              <a href="/thong-tin-ca-nhan" className="text-xs font-semibold text-primary hover:underline">
                Cập nhật điểm hồ sơ →
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-xs font-medium text-muted-foreground">Snapshot phân tích:</Label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={`${snapshot.classLevel}|${snapshot.term}`}
                onChange={(e) => {
                  const [classLevel, term] = e.target.value.split('|')
                  setSnapshot({ classLevel, term })
                }}
              >
                <option value="|">-- Chọn snapshot điểm --</option>
                {snapshots.map((s) => (
                  <option key={s} value={s}>
                    Lớp {s.split('|')[0]} · {s.split('|')[1]}
                  </option>
                ))}
              </select>

              {visibleScores.length > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  ✓ {visibleScores.length} môn đã có điểm
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                  ⚠ Chưa có điểm snapshot này
                </span>
              )}
            </div>
          </div>

          {/* Quick grade pill summary */}
          {visibleScores.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {visibleScores.map((row) => (
                <span key={row.subject} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  <span className="text-slate-500">{row.subject}:</span>
                  <strong className="text-slate-900">{row.score}</strong>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active simulation alert banner */}
      {hasActiveSim && (
        <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50/80 px-4 py-2.5 text-sm text-purple-900 shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>
              <strong>Chế độ mô phỏng đang bật:</strong> Điểm phù hợp của toàn bộ {rawFits.length} ngành đang được tính theo điểm dự kiến giả định.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs border-purple-300 text-purple-800 hover:bg-purple-100" onClick={() => setShowSimulator(true)}>
              Chỉnh sửa
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-700 hover:bg-purple-100" onClick={resetSimulator}>
              Tắt mô phỏng
            </Button>
          </div>
        </div>
      )}

      {/* EduMind Filter Bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm ngành hoặc trường..."
              className="h-9 pl-8 text-xs"
            />
          </div>

          {/* School Dropdown */}
          <select
            value={universityFilter}
            onChange={(e) => setUniversityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[190px]"
          >
            <option value="">Tất cả trường ({availableSchools.length})</option>
            {availableSchools.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
          </select>

          {/* Block Dropdown */}
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Tất cả khối</option>
            {availableBlocks.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Group Dropdown */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[170px]"
          >
            <option value="">Tất cả nhóm ngành</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Toggle Pinned */}
          <button
            type="button"
            onClick={() => setFilterPinned((prev) => !prev)}
            className={`inline-flex h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors ${
              filterPinned
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            Đã ghim
          </button>

          {/* Toggle Target */}
          <button
            type="button"
            onClick={() => setFilterTarget((prev) => !prev)}
            className={`inline-flex h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors ${
              filterTarget
                ? 'border-purple-600 bg-purple-600 text-white'
                : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            Mục tiêu
          </button>

          {/* Toggle Compare */}
          <button
            type="button"
            onClick={() => setFilterCompare((prev) => !prev)}
            className={`inline-flex h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors ${
              filterCompare
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            Đã chọn ({compareIds.length})
          </button>

          {/* Fit range slider */}
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Phù hợp:</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minFit}
              onChange={(e) => setMinFit(Number(e.target.value))}
              className="h-1.5 w-16 cursor-pointer accent-primary"
            />
            <span className="text-xs font-bold text-foreground tabular-nums w-8">
              {minFit > 0 ? `${minFit}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Sort Bar & Active Chips */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Sắp xếp:</span>
            <button
              type="button"
              onClick={() => setSortBy('fit')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                sortBy === 'fit' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Phù hợp nhất
            </button>
            <button
              type="button"
              onClick={() => setSortBy('tongHop')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                sortBy === 'tongHop' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Theo tổng thể
            </button>
            <button
              type="button"
              onClick={() => setSortBy('score_desc')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                sortBy === 'score_desc' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Điểm chuẩn cao → thấp
            </button>            <button
              type="button"
              onClick={() => setSortBy('score_asc')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                sortBy === 'score_asc' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Điểm chuẩn thấp → cao
            </button>
            <button
              type="button"
              onClick={() => setSortBy('name')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                sortBy === 'name' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Tên A - Z
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Radar Mode Switcher */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Chế độ radar:</span>
              <div className="inline-flex rounded-lg border border-input bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setRadarMode('all')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    radarMode === 'all'
                      ? 'bg-background text-primary shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Đánh giá toàn diện tất cả các môn học (75% môn tổ hợp chính + 25% môn nền tảng học lực khá sàn 6.5)"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Toàn diện tất cả môn</span>
                  <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary">75/25</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRadarMode('combo')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    radarMode === 'combo'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Chỉ xét các môn trong tổ hợp tuyển sinh theo đề án ngành"
                >
                  <Target className="h-3.5 w-3.5 text-orange-600" />
                  <span>Chỉ 3 môn tổ hợp</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-medium">
              Hiển thị <strong>{filteredSortedFits.length}</strong> / {rawFits.length} ngành
            </div>
          </div>
        </div>

        {/* Filter chips */}
        {activeChips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
            <span className="text-[11px] text-muted-foreground">Đang lọc theo:</span>
            {activeChips.map((chip, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.clear}
                  className="rounded-full hover:bg-primary/20 p-0.5"
                  aria-label="Xóa bộ lọc"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setUniversityFilter('')
                setBlockFilter('')
                setGroupFilter('')
                setMinFit(0)
                setFilterPinned(false)
                setFilterTarget(false)
                setFilterCompare(false)
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Xóa tất cả
            </button>
          </div>
        )}
      </div>

      {/* Major Cards Grid (3 Columns EduMind Presentation) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm">Đang tải và tính toán rubric năng lực của {rawFits.length} ngành...</p>
        </div>
      ) : filteredSortedFits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          <p className="text-sm font-medium">Không tìm thấy ngành nào phù hợp với bộ lọc hiện tại.</p>
          <p className="mt-1 text-xs text-muted-foreground">Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
            {filteredSortedFits.slice(0, displayCount).map((fit) => (
              <MajorCard
                key={fit.rubricId}
                fit={fit}
                isChecked={compareIds.includes(fit.rubricId)}
                toggleCompare={toggleCompare}
                radarMode={radarMode}
                setRadarMode={setRadarMode}
                hasActiveSim={hasActiveSim}
                simulatedScores={simulatedScores}
                recommendation={recommendations.get(String(fit.rubricId)) || null}
                recommendationConfig={recommendationConfig}
                handlePin={handlePin}
                handleTarget={handleTarget}
              />
            ))}
          </div>

          {/* Load more button */}
          {displayCount < filteredSortedFits.length && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setDisplayCount((prev) => prev + 30)}
                className="text-xs font-medium"
              >
                Hiển thị thêm ngành ({filteredSortedFits.length - displayCount} ngành còn lại)
              </Button>
            </div>
          )}
        </>
      )}
        </>
      )}

      {/* Floating Compare Bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border border-primary/30 bg-background/95 px-5 py-3 shadow-xl backdrop-blur-md">
          <span className="text-xs font-semibold text-foreground">
            Đã chọn ({compareIds.length}/4 ngành):
          </span>
          <div className="flex items-center gap-1.5 max-w-md overflow-x-auto">
            {comparedFits.map((f) => (
              <span key={f.rubricId} className="truncate rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {f.majorName}
              </span>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => setShowCompareModal(true)}
            className="h-8 text-xs font-medium"
          >
            <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
            So sánh ngay
          </Button>
          <button
            type="button"
            onClick={() => setCompareIds([])}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Bỏ chọn tất cả"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Simulation Modal */}
      {showSimulator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Crosshair className="h-5 w-5 text-purple-600" />
                  Mô phỏng điểm: Nếu điểm của bạn là...
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Điều chỉnh điểm dự kiến — toàn bộ {rawFits.length} ngành sẽ tự động tính toán lại mức độ phù hợp ngay lập tức.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
              <span className="text-xs font-medium text-muted-foreground">Gợi ý tăng tốc:</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bumpSimAll(0.5)}>
                  +0.5 tất cả môn
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bumpSimAll(1.0)}>
                  +1.0 tất cả môn
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600 hover:bg-rose-50" onClick={resetSimulator}>
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Reset về điểm thật
                </Button>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMMON_SUBJECTS.map((subject) => {
                const val = getSimValue(subject)
                const real = studentScoreMap.get(normalizeSubject(subject))
                return (
                  <div key={subject} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-foreground">{subject}</span>
                      <div className="flex items-center gap-2">
                        {real !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            (Thật: {real})
                          </span>
                        )}
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-bold text-purple-800">
                          {val}đ
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={val}
                      onChange={(e) => setSimValue(subject, e.target.value)}
                      className="w-full h-1.5 cursor-pointer accent-purple-600"
                    />
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <Button onClick={() => setShowSimulator(false)}>
                Áp dụng & Xem danh sách ngành
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal (Side-by-side up to 4 majors) */}
      {showCompareModal && comparedFits.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Đối chiếu Rubric năng lực giữa các ngành đã chọn ({comparedFits.length} ngành)
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  So sánh trực quan mức độ phù hợp, yêu cầu ngưỡng môn học và khoảng cách năng lực của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Side-by-side Cards */}
            <div className={`mt-5 grid gap-4 grid-cols-1 ${
              comparedFits.length === 2 ? 'sm:grid-cols-2' : comparedFits.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {comparedFits.map((f, idx) => {
                const activeDetails = radarMode === 'all' ? (f.allDetails || f.details) : f.details
                const activeFitPct = radarMode === 'all' ? (f.allFitPct ?? f.fitPct) : f.fitPct
                const rec = recommendations.get(String(f.rubricId))
                const effHL = (activeFitPct ?? rec?.hocLucFit ?? null)
                const effTongHop = (effHL !== null && rec?.tinhCachFit !== null && rec?.tinhCachFit !== undefined)
                  ? Math.round(((recommendationConfig?.w_hoc_luc ?? 0.6) * effHL + (recommendationConfig?.w_tinh_cach ?? 0.4) * rec.tinhCachFit) * 10) / 10
                  : (rec?.tongHopFit ?? null)
                const hasTongHop = effTongHop !== null && effTongHop !== undefined
                const displayPct = hasTongHop ? effTongHop : activeFitPct
                const displayLabel = hasTongHop ? 'Phù hợp tổng thể' : (radarMode === 'all' ? 'Học lực toàn diện' : 'Học lực tổ hợp')
                const fitStyle = getFitStyle(displayPct)
                return (
                  <div key={f.rubricId} className="rounded-xl border p-4 bg-muted/30 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        Ngành {String.fromCharCode(65 + idx)}
                      </span>
                      <h3 className="mt-1 text-sm font-bold text-foreground leading-snug">{f.majorName}</h3>
                      <p className="text-xs text-muted-foreground">{f.schoolName}</p>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Khối: <strong>{f.admissionBlock}</strong> · Điểm chuẩn: <strong>{f.entryScore ?? '—'}</strong>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
                        <div>
                          <span className={`text-2xl font-black ${fitStyle.text}`}>
                            {displayPct !== null ? `${displayPct.toFixed(1)}%` : '—'}
                          </span>
                          <span className="block text-[10px] text-muted-foreground font-medium">
                            {displayLabel}
                          </span>
                        </div>
                        <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${fitStyle.tag}`}>
                          {radarMode === 'all' ? 'Toàn diện 75/25' : fitStyle.label}
                        </span>
                      </div>

                      <div className="mt-2">
                        <MiniRadar details={activeDetails} simulated={hasActiveSim ? simulatedScores : null} className="h-48 w-48 mx-auto select-none" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Unified Comparison Table */}
            <div className="mt-6 overflow-hidden rounded-lg border">
              <div className="bg-muted px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Bảng so sánh chi tiết ngưỡng từng môn:</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Chế độ: <strong>{radarMode === 'all' ? 'Toàn diện tất cả môn (75/25)' : '3 môn tổ hợp'}</strong>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 text-muted-foreground">
                    <tr>
                      <th className="p-3">Môn học</th>
                      <th className="p-3 text-center">Điểm của bạn</th>
                      {comparedFits.map((f, i) => (
                        <th key={f.rubricId} className="p-3">
                          Ngành {String.fromCharCode(65 + i)} ({f.majorName})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...new Set(comparedFits.flatMap((f) => (radarMode === 'all' ? (f.allDetails || f.details) : f.details).map((d) => d.subject)))].map((subj) => {
                      const userScore = comparedFits[0]?.allDetails?.find((d) => d.subject === subj)?.score
                        ?? comparedFits[0]?.details.find((d) => d.subject === subj)?.score
                        ?? studentScoreMap.get(normalizeSubject(subj))
                        ?? null

                      return (
                        <tr key={subj} className="hover:bg-muted/40">
                          <td className="p-3 font-semibold text-foreground">{subj}</td>
                          <td className="p-3 text-center font-bold text-primary">
                            {userScore !== null ? `${userScore}đ` : 'Chưa có'}
                          </td>
                          {comparedFits.map((f) => {
                            const details = radarMode === 'all' ? (f.allDetails || f.details) : f.details
                            const d = details.find((x) => x.subject === subj)
                            if (!d) return <td key={f.rubricId} className="p-3 text-muted-foreground">—</td>
                            const gap = userScore !== null ? Math.round((userScore - d.threshold) * 100) / 100 : null
                            return (
                              <td key={f.rubricId} className="p-3">
                                <div>
                                  <span>Ngưỡng: <strong>{d.threshold}đ</strong> ({(d.weight * 100).toFixed(0)}%)</span>
                                  {gap !== null && (
                                    <span className={`ml-2 font-bold ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      ({gap >= 0 ? `+${gap}` : gap})
                                    </span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowCompareModal(false)}>
                Đóng bảng đối chiếu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
