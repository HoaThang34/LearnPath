import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCareerGroupConfig } from '@/lib/api'

// The config is static for a deployment. Cache the promise so 50 major cards
// do not trigger 50 identical requests.
let configPromise = null
function loadGroupConfig() {
  if (!configPromise) {
    configPromise = getCareerGroupConfig()
      .then((response) => response.data?.data || null)
      .catch((error) => {
        configPromise = null
        throw error
      })
  }
  return configPromise
}

const COMPONENT_TONE = {
  L: { text: 'text-blue-700', bar: 'bg-blue-600', label: 'Học lực (L)' },
  H: { text: 'text-violet-700', bar: 'bg-violet-600', label: 'Holland (H)' },
  M: { text: 'text-amber-700', bar: 'bg-amber-500', label: 'MBTI (M)' },
}

const REASON_LABELS = {
  thieu_hoc_luc: 'Chưa đủ điểm học lực theo bộ ưu tiên môn',
  thieu_diem_mon: 'Thiếu điểm một số môn trong bộ ưu tiên',
  thieu_holland: 'Chưa đủ câu trả lời sở thích Holland',
  thieu_mbti: 'Chưa có hồ sơ đối chiếu MBTI theo ngành',
  thieu_ho_so_mbti: 'Hồ sơ đối chiếu bốn trục MBTI chưa được xác định',
  thieu_du_lieu_truc: 'Một cặp xu hướng chưa đủ câu trả lời',
  khong_co_ket_qua_so_thich: 'Chưa có kết quả khám phá sở thích',
  khong_xac_dinh_duoc_khoi: 'Ngành chưa được ánh xạ vào 12 khối trọng số',
  khong_co_bo_trong_so: 'Ngành chưa có bộ ưu tiên môn',
}

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null
  return Number(value)
}

function ComponentRow({ component, weight, value, contribution, label }) {
  const tone = COMPONENT_TONE[component] || COMPONENT_TONE.L
  const has = pct(value) !== null
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">
          {label || tone.label} · w = {(Number(weight) * 100).toFixed(1)} %
        </span>
        <span className={cn('tabular-nums font-semibold', has ? tone.text : 'text-slate-400')}>
          {has ? Number(value).toFixed(1) : '—'}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        {has && (
          <div
            className={cn('h-full rounded-full', tone.bar)}
            style={{ width: `${Math.max(0, Math.min(Number(value), 100))}%` }}
          />
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {has ? `Đóng góp ${Number(contribution).toFixed(2)} điểm` : 'Chưa tính được'}
      </p>
    </div>
  )
}

export default function GroupFitPanel({ data }) {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadGroupConfig()
      .then((data) => {
        if (active) setConfig(data)
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Không thể tải bộ trọng số khối ngành.')
      })
    return () => {
      active = false
    }
  }, [])

  if (!data) {
    return (
      <p className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
        Chưa tải được điểm ba thành phần cho ngành này.
      </p>
    )
  }
  if (error) {
    return <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p>
  }
  if (!config) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang tải bộ trọng số…
      </p>
    )
  }

  const contributions = data.groupFitContributions || []
  const missing = data.groupFitMissing || []
  const reasons = (data.groupReasons || []).map((reason) => REASON_LABELS[reason] || reason)
  const groupLabel = data.groupLabel || 'Chưa xác định khối'

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-slate-50/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground">
          Ba thành phần · {groupLabel}
        </p>
        <span className="text-[11px] font-semibold tabular-nums text-teal-700">
          F = {data.groupFit !== null && data.groupFit !== undefined ? Number(data.groupFit).toFixed(1) : '—'}
        </span>
      </div>

      {contributions.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Ngành này chưa có khối trọng số nên không tính được F.
        </p>
      ) : (
        <div className="space-y-1.5">
          {contributions.map((row) => (
            <ComponentRow
              key={row.component}
              component={row.component}
              weight={row.weight}
              value={row.value}
              contribution={row.contribution}
              label={row.label}
            />
          ))}
        </div>
      )}

      {data.groupFit === null && data.groupFitPartial !== null && data.groupFitPartial !== undefined && (
        <p className="rounded border border-amber-200 bg-amber-50 p-1.5 text-[10px] text-amber-900">
          Tạm tính từ các thành phần đã có: <strong>{Number(data.groupFitPartial).toFixed(1)}</strong> điểm
          (độ phủ {(Number(data.groupFitCoverage) * 100).toFixed(1)} % trọng số). Chưa đủ ba thành phần nên F chưa
          được chốt.
        </p>
      )}

      {missing.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Thiếu: {missing.map((code) => COMPONENT_TONE[code]?.label || code).join(', ')}
        </p>
      )}
      {reasons.length > 0 && (
        <p className="text-[10px] text-muted-foreground">{reasons.join(' · ')}</p>
      )}

      <p className="text-[10px] leading-snug text-muted-foreground">
        F = w<sub>L</sub>·L + w<sub>H</sub>·H + w<sub>M</sub>·M, cả ba trên thang 0–100. Trọng số theo khối lấy từ
        so sánh cặp (trung bình nhân); đây là giả định của nhóm, chưa kiểm định, và không phải xác suất trúng tuyển.
      </p>
    </div>
  )
}
