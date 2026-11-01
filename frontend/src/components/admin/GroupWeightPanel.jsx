import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react'
import AdminAlert from './AdminAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getCareerGroupConfig,
  getCareerPriorityRows,
  getCareerMbtiProfile,
  updateCareerGroupWeights,
  updateCareerSubjectPriority,
  updateCareerMbtiProfile,
} from '@/lib/adminApi'
import { cn } from '@/lib/utils'

const PCT_TOLERANCE = 0.2
const PAGE_SIZE = 40

const round6 = (value) => Math.round(Number(value) * 1e6) / 1e6
const toPercent = (weight) => round6(Number(weight) * 100)
const fromPercent = (percent) => Math.round((Number(percent) / 100) * 1e8) / 1e8

function buildDraft(groups = []) {
  const draft = {}
  for (const group of groups) {
    draft[group.code] = {
      wHocLuc: toPercent(group.wHocLuc),
      wHolland: toPercent(group.wHolland),
      wMbti: toPercent(group.wMbti),
    }
  }
  return draft
}

function formatStamp(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('vi-VN')
}

function weightCellInvalid(value) {
  if (value === '' || value === null || value === undefined) return true
  const numeric = Number(value)
  return !Number.isFinite(numeric) || numeric <= 0 || numeric > 100
}

export default function GroupWeightPanel() {
  const [config, setConfig] = useState(null)
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const [priorityData, setPriorityData] = useState(null)
  const [priorityLoading, setPriorityLoading] = useState(true)
  const [priorityError, setPriorityError] = useState('')
  const [prioritySuccess, setPrioritySuccess] = useState('')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editingKey, setEditingKey] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [savingKey, setSavingKey] = useState(null)

  const [mbtiData, setMbtiData] = useState(null)
  const [mbtiStatusDraft, setMbtiStatusDraft] = useState('xac_dinh')
  const [mbtiNoteDraft, setMbtiNoteDraft] = useState('')
  const [mbtiAxesDraft, setMbtiAxesDraft] = useState([])
  const [mbtiLoading, setMbtiLoading] = useState(true)
  const [mbtiSaving, setMbtiSaving] = useState(false)
  const [mbtiError, setMbtiError] = useState('')
  const [mbtiSuccess, setMbtiSuccess] = useState('')

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getCareerGroupConfig()
      const data = response.data?.data || null
      setConfig(data)
      setDraft(buildDraft(data?.groups?.groups || []))
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải bộ trọng số 12 khối ngành.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMbti = useCallback(async () => {
    setMbtiLoading(true)
    setMbtiError('')
    try {
      const response = await getCareerMbtiProfile()
      const data = response.data?.data || null
      if (data) {
        setMbtiData(data)
        setMbtiStatusDraft(data.status || 'xac_dinh')
        setMbtiNoteDraft(data.note || '')
        setMbtiAxesDraft(
          (data.axes || []).map((axis) => ({
            code: axis.code,
            first: axis.first,
            second: axis.second,
            title: axis.title,
            c: axis.c ?? 1.0,
            t: axis.t ?? 1,
          }))
        )
      }
    } catch (err) {
      setMbtiError(err.response?.data?.error || 'Không thể tải hồ sơ MBTI.')
    } finally {
      setMbtiLoading(false)
    }
  }, [])

  const loadPriorities = useCallback(async () => {
    setPriorityLoading(true)
    setPriorityError('')
    try {
      const response = await getCareerPriorityRows()
      setPriorityData(response.data?.data || null)
    } catch (err) {
      setPriorityError(err.response?.data?.error || 'Không thể tải bộ ưu tiên môn.')
    } finally {
      setPriorityLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadMbti()
    loadPriorities()
  }, [loadConfig, loadMbti, loadPriorities])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query])

  const groups = config?.groups?.groups || []
  const scale = priorityData?.scale || config?.priorities?.scale || {
    4: 'Cốt lõi',
    3: 'Quan trọng',
    2: 'Liên quan',
    1: 'Hỗ trợ',
  }

  const rowState = useMemo(() => {
    const state = {}
    for (const group of groups) {
      const row = draft[group.code]
      if (!row) continue
      const values = [row.wHocLuc, row.wHolland, row.wMbti]
      const fieldsInvalid = values.some(weightCellInvalid)
      const total = values.reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0)
      state[group.code] = {
        fieldsInvalid,
        total,
        invalid: fieldsInvalid || Math.abs(total - 100) > PCT_TOLERANCE,
      }
    }
    return state
  }, [groups, draft])

  const dirtyCodes = useMemo(() => {
    const codes = []
    for (const group of groups) {
      const row = draft[group.code]
      if (!row) continue
      if (
        toPercent(group.wHocLuc) !== row.wHocLuc ||
        toPercent(group.wHolland) !== row.wHolland ||
        toPercent(group.wMbti) !== row.wMbti
      ) {
        codes.push(group.code)
      }
    }
    return codes
  }, [groups, draft])

  const invalidCodes = useMemo(
    () => groups.filter((group) => rowState[group.code]?.invalid).map((group) => group.code),
    [groups, rowState]
  )

  const canSave = dirtyCodes.length > 0 && invalidCodes.length === 0 && !saving

  const updateField = (code, field, rawValue) => {
    setSuccess('')
    setDraft((current) => ({
      ...current,
      [code]: {
        ...current[code],
        [field]: rawValue === '' ? '' : Number(rawValue),
      },
    }))
  }

  const normalizeRows = () => {
    setError('')
    setSuccess('')
    setDraft((current) => {
      const next = { ...current }
      for (const group of groups) {
        const row = current[group.code]
        if (!row) continue
        const values = [row.wHocLuc, row.wHolland, row.wMbti].map(Number)
        if (values.some((value) => !Number.isFinite(value) || value <= 0)) continue
        const total = values.reduce((sum, value) => sum + value, 0)
        if (Math.abs(total - 100) <= PCT_TOLERANCE) continue
        next[group.code] = {
          wHocLuc: round6((values[0] / total) * 100),
          wHolland: round6((values[1] / total) * 100),
          wMbti: round6((values[2] / total) * 100),
        }
      }
      return next
    })
  }

  const resetDraft = () => {
    setDraft(buildDraft(groups))
    setSuccess('')
    setError('')
  }

  const saveGroups = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = dirtyCodes.map((code) => ({
        code,
        wHocLuc: fromPercent(draft[code].wHocLuc),
        wHolland: fromPercent(draft[code].wHolland),
        wMbti: fromPercent(draft[code].wMbti),
      }))
      const response = await updateCareerGroupWeights(payload)
      const data = response.data?.data
      if (data?.config) {
        setConfig((current) => ({ ...current, groups: data.config }))
        setDraft(buildDraft(data.config.groups || []))
      }
      setSuccess(
        data?.changed
          ? `Đã lưu trọng số cho ${data.changes.length} khối ngành.`
          : 'Không có thay đổi nào cần lưu.'
      )
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu trọng số 12 khối ngành.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (row) => {
    setEditingKey(row.key)
    setEditValues(Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r])))
    setPriorityError('')
    setPrioritySuccess('')
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditValues({})
  }

  const saveRow = async (row) => {
    setSavingKey(row.key)
    setPriorityError('')
    setPrioritySuccess('')
    try {
      const response = await updateCareerSubjectPriority(row.key, editValues)
      const data = response.data?.data
      if (data?.row) {
        setPriorityData((current) =>
          current
            ? {
                ...current,
                rows: current.rows.map((entry) => (entry.key === data.row.key ? data.row : entry)),
                updatedAt: data.updatedAt || current.updatedAt,
                updatedBy: data.updatedBy || current.updatedBy,
              }
            : current
        )
      }
      setEditingKey(null)
      setEditValues({})
      setPrioritySuccess(
        data?.changed
          ? `Đã lưu mức ưu tiên môn cho ngành "${row.majorName}".`
          : 'Không có thay đổi nào cần lưu.'
      )
    } catch (err) {
      setPriorityError(err.response?.data?.error || 'Không thể lưu mức ưu tiên môn.')
    } finally {
      setSavingKey(null)
    }
  }

  const filteredRows = useMemo(() => {
    const rows = priorityData?.rows || []
    const keyword = query.trim().toLocaleLowerCase('vi')
    if (!keyword) return rows
    return rows.filter((row) =>
      [row.majorName, row.schoolName, row.schoolCode, row.admissionBlock, row.method]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('vi').includes(keyword))
    )
  }, [priorityData, query])

  const updateMbtiAxis = (code, field, val) => {
    setMbtiSuccess('')
    setMbtiError('')
    setMbtiAxesDraft((curr) =>
      curr.map((axis) =>
        axis.code === code
          ? { ...axis, [field]: val === '' ? '' : Number(val) }
          : axis
      )
    )
  }

  const applyStandardMbti = () => {
    setMbtiStatusDraft('xac_dinh')
    setMbtiAxesDraft((curr) =>
      curr.map((axis) => ({ ...axis, c: 1.0, t: 1 }))
    )
    setMbtiSuccess('Đã áp dụng mẫu chuẩn: c = 1.0, t = +1 cho cả 4 trục.')
  }

  const resetMbti = () => {
    if (!mbtiData) return
    setMbtiStatusDraft(mbtiData.status || 'xac_dinh')
    setMbtiNoteDraft(mbtiData.note || '')
    setMbtiAxesDraft(
      (mbtiData.axes || []).map((axis) => ({
        code: axis.code,
        first: axis.first,
        second: axis.second,
        title: axis.title,
        c: axis.c ?? 1.0,
        t: axis.t ?? 1,
      }))
    )
    setMbtiSuccess('')
    setMbtiError('')
  }

  const saveMbti = async () => {
    setMbtiSaving(true)
    setMbtiError('')
    setMbtiSuccess('')
    try {
      const payload = {
        status: mbtiStatusDraft,
        note: mbtiNoteDraft,
        axes: mbtiAxesDraft.map((a) => ({
          code: a.code,
          c: a.c === '' || a.c === null ? null : Number(a.c),
          t: a.t === '' || a.t === null ? null : Number(a.t),
        })),
      }
      const response = await updateCareerMbtiProfile(payload)
      const data = response.data?.data
      if (data?.profile) {
        setMbtiData(data.profile)
        setMbtiStatusDraft(data.profile.status)
        setMbtiNoteDraft(data.profile.note || '')
        setMbtiAxesDraft(data.profile.axes || [])
        setConfig((curr) => curr ? { ...curr, mbti: data.profile } : curr)
      }
      setMbtiSuccess(
        data?.changed
          ? 'Đã lưu cấu hình hồ sơ 4 trục MBTI thành công.'
          : 'Không có thay đổi nào cần lưu.'
      )
    } catch (err) {
      setMbtiError(err.response?.data?.error || 'Không thể lưu hồ sơ MBTI.')
    } finally {
      setMbtiSaving(false)
    }
  }

  const visibleRows = filteredRows.slice(0, visibleCount)

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải bộ trọng số...</span>
      </div>
    )
  }

  if (error && !config) return <AdminAlert variant="error">{error}</AdminAlert>
  if (!config) return <AdminAlert variant="error">Không có dữ liệu cấu hình.</AdminAlert>

  const mbti = config.mbti || {}
  const priorities = config.priorities || {}
  const groupsUpdatedAt = formatStamp(config.groups?.updatedAt)
  const prioritiesUpdatedAt = formatStamp(priorityData?.updatedAt)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Công thức</p>
        <p className="mt-1 font-mono text-[11px]">{config.formula}</p>
        <p className="mt-1">{config.warning}</p>
        <p className="mt-1">
          Bộ ưu tiên môn: <strong>{priorities.rowCount}</strong> dòng · thang{' '}
          {scale ? Object.entries(scale).map(([key, value]) => `${key} = ${value}`).join(', ') : '—'}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Cập nhật gần nhất — trọng số 12 khối: {groupsUpdatedAt || 'bản gốc'} · ưu tiên môn:{' '}
          {prioritiesUpdatedAt || 'bản gốc'}
        </p>
      </div>

      {/* Interactive MBTI Profile Editor */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b bg-slate-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Hồ sơ đối chiếu 4 trục MBTI (Chỉ số M_m)</h3>
              {mbtiData?.determined ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                  <Check className="h-3 w-3" /> Đã xác định (M_m & F_m tính đầy đủ)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <AlertTriangle className="h-3 w-3" /> Chưa xác định (M_m & F_m để null)
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Công thức: <code className="font-mono text-[11px]">x_k = D_k / 24 ; M_m = 50 × (1 + Σ c_k·t_k·x_k / Σ c_k)</code>.
              Chỉnh sửa mức độ liên quan (c &gt; 0) và hướng ưu tiên (t = +1 / -1) cho từng trục.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mbtiStatusDraft}
              onChange={(e) => setMbtiStatusDraft(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="xac_dinh">Trạng thái: Đã xác định (Tính điểm)</option>
              <option value="chua_xac_dinh">Trạng thái: Chưa xác định (Để null)</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyStandardMbti}
              disabled={mbtiSaving}
              title="Điền c = 1.0 và t = +1 cho cả 4 trục"
            >
              Mẫu chuẩn
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetMbti}
              disabled={mbtiSaving}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Hoàn tác
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveMbti}
              disabled={mbtiSaving}
            >
              {mbtiSaving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 h-3.5 w-3.5" />
              )}
              Lưu hồ sơ MBTI
            </Button>
          </div>
        </div>

        <div className="space-y-2 p-3">
          {mbtiError && <AdminAlert variant="error">{mbtiError}</AdminAlert>}
          {mbtiSuccess && <AdminAlert variant="success">{mbtiSuccess}</AdminAlert>}
        </div>

        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Trục</th>
                <th className="px-3 py-2 text-left font-semibold">Chiều đo phản tư</th>
                <th className="px-3 py-2 text-right font-semibold">Trọng số liên quan (c)</th>
                <th className="px-3 py-2 text-left font-semibold">Hướng đối chiếu (t)</th>
                <th className="px-3 py-2 text-left font-semibold">Quy ước tính điểm M</th>
              </tr>
            </thead>
            <tbody>
              {mbtiAxesDraft.map((axis) => (
                <tr key={axis.code} className="border-t">
                  <td className="px-3 py-2 font-mono font-bold text-slate-900">{axis.code}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {axis.title || axis.code} ({axis.first} – {axis.second})
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={axis.c ?? ''}
                      onChange={(e) => updateMbtiAxis(axis.code, 'c', e.target.value)}
                      className="ml-auto h-7 w-24 text-right font-mono text-xs"
                      disabled={mbtiSaving}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={axis.t ?? 1}
                      onChange={(e) => updateMbtiAxis(axis.code, 't', e.target.value)}
                      className="h-7 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800"
                      disabled={mbtiSaving}
                    >
                      <option value="1">+1: Nghiêng về chữ đầu ({axis.first})</option>
                      <option value="-1">-1: Nghiêng về chữ sau ({axis.second})</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[11px]">
                    {axis.t === 1 ? (
                      <span>Nghiêng về <strong>{axis.first}</strong> (+D) tăng M; nghiêng về <strong>{axis.second}</strong> (-D) giảm M</span>
                    ) : (
                      <span>Nghiêng về <strong>{axis.second}</strong> (-D) tăng M; nghiêng về <strong>{axis.first}</strong> (+D) giảm M</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-700 shrink-0">Ghi chú thẩm định:</span>
            <Input
              type="text"
              value={mbtiNoteDraft}
              onChange={(e) => setMbtiNoteDraft(e.target.value)}
              placeholder="Nhập ghi chú hoặc nguồn thẩm định cho hồ sơ MBTI..."
              className="h-7 text-xs"
              disabled={mbtiSaving}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex flex-col gap-2 border-b bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Trọng số 12 khối ngành</h3>
            <p className="text-xs text-muted-foreground">
              Nhập theo %. Mỗi khối phải có đủ ba trọng số dương và tổng bằng 100 % (sai số 0,2 điểm %).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={normalizeRows} disabled={saving}>
              Chuẩn hoá dòng lệch
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetDraft}
              disabled={saving || dirtyCodes.length === 0}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Hoàn tác
            </Button>
            <Button type="button" size="sm" onClick={saveGroups} disabled={!canSave}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Lưu trọng số
            </Button>
          </div>
        </div>

        <div className="space-y-2 p-3">
          {error && <AdminAlert variant="error">{error}</AdminAlert>}
          {success && <AdminAlert variant="success">{success}</AdminAlert>}
          {invalidCodes.length > 0 && (
            <AdminAlert variant="warning">
              Có {invalidCodes.length} khối chưa hợp lệ (tổng khác 100 % hoặc có trọng số ≤ 0). Sửa hoặc bấm
              &quot;Chuẩn hoá dòng lệch&quot; trước khi lưu.
            </AdminAlert>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Khối</th>
                <th className="px-3 py-2 text-right font-semibold">Học lực (%)</th>
                <th className="px-3 py-2 text-right font-semibold">Holland (%)</th>
                <th className="px-3 py-2 text-right font-semibold">MBTI (%)</th>
                <th className="px-3 py-2 text-right font-semibold">Tổng</th>
                <th className="px-3 py-2 text-left font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const row = draft[group.code] || {}
                const state = rowState[group.code] || {}
                const dirty = dirtyCodes.includes(group.code)
                return (
                  <tr
                    key={group.code}
                    className={cn('border-t', state.invalid ? 'bg-rose-50/60' : dirty && 'bg-sky-50/40')}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{group.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {group.code} · RIASEC: {group.riasecGroup || '—'} · {group.majorCount} ngành
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Cặp gốc: L/H {group.judgments?.hocLucVsHolland ?? '—'} · L/M{' '}
                        {group.judgments?.hocLucVsMbti ?? '—'} · H/M {group.judgments?.hollandVsMbti ?? '—'}
                      </div>
                    </td>
                    {['wHocLuc', 'wHolland', 'wMbti'].map((field) => (
                      <td key={field} className="px-2 py-2 text-right">
                        <Input
                          type="number"
                          min="0.000001"
                          max="100"
                          step="0.000001"
                          value={row[field] ?? ''}
                          onChange={(event) => updateField(group.code, field, event.target.value)}
                          className={cn(
                            'ml-auto h-8 w-24 text-right tabular-nums',
                            weightCellInvalid(row[field]) && 'border-rose-400'
                          )}
                          aria-label={`${group.label} — ${field}`}
                        />
                      </td>
                    ))}
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold tabular-nums',
                        state.invalid ? 'text-rose-700' : 'text-emerald-700'
                      )}
                    >
                      {Number.isFinite(state.total) ? state.total.toFixed(2) : '—'} %
                    </td>
                    <td className="px-3 py-2">
                      {state.invalid ? (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <AlertTriangle className="h-3 w-3" /> Chưa hợp lệ
                        </span>
                      ) : dirty ? (
                        <span className="text-sky-700">Đã sửa, chưa lưu</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Check className="h-3 w-3" /> Hợp lệ
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 border-t p-3">
          {groups
            .filter((group) => group.note)
            .map((group) => (
              <p key={`${group.code}-note`} className="text-[11px] text-muted-foreground">
                <strong className="text-slate-700">{group.label}:</strong> {group.note}
              </p>
            ))}
          <p className="text-[11px] text-muted-foreground">
            Mỗi lần lưu tạo bản sao lưu JSON và ghi audit. Nếu tệp đã có chỉnh tay, script{' '}
            <code>derive-career-weights.js --write</code> sẽ từ chối ghi đè trừ khi truyền thêm{' '}
            <code>--force</code>.
          </p>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex flex-col gap-2 border-b bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Ưu tiên môn theo ngành</h3>
            <p className="text-xs text-muted-foreground">
              Mức r: 4 = cốt lõi, 3 = quan trọng, 2 = liên quan, 1 = hỗ trợ. Chỉ sửa mức ưu tiên của các môn đã
              có; không thêm hoặc bớt môn ở đây.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm ngành, trường, khối..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-2 p-3">
          {priorityError && <AdminAlert variant="error">{priorityError}</AdminAlert>}
          {prioritySuccess && <AdminAlert variant="success">{prioritySuccess}</AdminAlert>}
        </div>

        {priorityLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải bộ ưu tiên môn...
          </div>
        ) : (
          <div className="max-h-[540px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Ngành / Trường</th>
                  <th className="px-3 py-2 text-left font-semibold">Khối · Năm · Điểm</th>
                  <th className="px-3 py-2 text-left font-semibold">Ưu tiên môn</th>
                  <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const editing = editingKey === row.key
                  return (
                    <tr key={row.key} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{row.majorName || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {row.schoolName || '—'}
                          {row.schoolCode ? ` (${row.schoolCode})` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        <div>{row.admissionBlock || '—'}</div>
                        <div>
                          {row.year || '—'} · {row.entryScore ?? '—'} điểm
                        </div>
                        <div>Σr = {row.priorityTotal}</div>
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.subjects.map((subject) => (
                              <label
                                key={subject.subject}
                                className="flex items-center gap-1 rounded border bg-white px-1.5 py-1"
                                title={`Trọng số rubric gốc: ${subject.weight}`}
                              >
                                <span className="text-[11px]">{subject.subject}</span>
                                <select
                                  className="h-7 rounded border bg-background px-1 text-[11px]"
                                  value={editValues[subject.subject]}
                                  onChange={(event) =>
                                    setEditValues((current) => ({
                                      ...current,
                                      [subject.subject]: Number(event.target.value),
                                    }))
                                  }
                                >
                                  {[4, 3, 2, 1].map((value) => (
                                    <option key={value} value={value}>
                                      {value} · {scale[value] || value}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.subjects.map((subject) => (
                              <span
                                key={subject.subject}
                                className="rounded border bg-muted/30 px-1.5 py-0.5 text-[11px]"
                                title={`Trọng số rubric gốc: ${subject.weight}`}
                              >
                                {subject.subject} <strong>{subject.r}</strong>
                                <span className="text-muted-foreground"> · {scale[subject.r] || subject.r}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                              disabled={savingKey === row.key}
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Huỷ
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveRow(row)}
                              disabled={savingKey === row.key}
                            >
                              {savingKey === row.key ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="mr-1 h-3.5 w-3.5" />
                              )}
                              Lưu
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(row)}
                            disabled={editingKey !== null}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Sửa
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleRows.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Không tìm thấy dòng ưu tiên môn khớp với từ khóa.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-[11px] text-muted-foreground">
          <span>
            Hiển thị {visibleRows.length}/{filteredRows.length} dòng · tổng {priorityData?.total ?? 0} dòng
            {priorityData?.updatedAt ? ` · cập nhật ${formatStamp(priorityData.updatedAt)}` : ''}
          </span>
          {visibleRows.length < filteredRows.length && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            >
              Hiển thị thêm
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
