import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import { getCareerMatchConfig, updateCareerMatchConfig } from '@/lib/adminApi'

const FIELDS = [
  { key: 'w_hoc_luc', label: 'Trọng số học lực', step: '0.05', min: '0', max: '1', hint: 'Mặc định 0,6. Dùng trong tổng thể.' },
  { key: 'w_tinh_cach', label: 'Trọng số tính cách', step: '0.05', min: '0', max: '1', hint: 'Mặc định 0,4.' },
  { key: 'matrix_hoc_luc_high', label: 'Ngưỡng học lực tốt', step: '1', min: '0', max: '100', hint: 'Mặc định 70 (%).' },
  { key: 'matrix_hoc_luc_low', label: 'Ngưỡng học lực thấp', step: '1', min: '0', max: '100', hint: 'Mặc định 50 (%).' },
  { key: 'matrix_tinh_cach', label: 'Ngưỡng tính cách hợp', step: '1', min: '0', max: '100', hint: 'Mặc định 65 (%).' },
  { key: 'do_phu_min', label: 'Độ phủ tối thiểu', step: '1', min: '0', max: '100', hint: 'Mặc định 80 (%). Dưới ngưỡng này tổng thể = null.' },
]

export default function MatchConfigPanel() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    getCareerMatchConfig()
      .then((response) => {
        if (!active) return
        const data = response.data?.data || []
        setRows(data)
        setForm(Object.fromEntries(data.map((row) => [row.key, row.value])))
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Không thể tải tham số tổng thể.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]))
      const response = await updateCareerMatchConfig(payload)
      setRows(response.data?.data?.rows || rows)
      setForm(response.data?.data?.config || form)
      setSuccess('Đã lưu tham số tổng thể. Thay đổi được ghi vào nhật ký quản trị.')
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu tham số.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải tham số...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {success && <AdminAlert variant="success">{success}</AdminAlert>}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">Công thức đang dùng</p>
        <p className="mt-1">
          Học lực = 100 × min(P(T<sub>học sinh</sub>) / P(điểm chuẩn), 1). Tính cách = 100 × Σ min(s<sub>nhóm</sub>,
          w&apos;<sub>nhóm</sub>). Tổng thể = w<sub>học lực</sub> × học lực + w<sub>tính cách</sub> × tính cách.
        </p>
        <p className="mt-1">
          Nếu một thành phần là null, tổng thể cũng null và có lý do. Không có chuỗi &quot;% đỗ&quot; hay xác suất trúng
          tuyển.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`config-${field.key}`}>{field.label}</Label>
            <Input
              id={`config-${field.key}`}
              type="number"
              step={field.step}
              min={field.min}
              max={field.max}
              value={form[field.key] ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">{field.hint}</p>
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="config-hoc-luc-mode">Công thức học lực</Label>
          <select
            id="config-hoc-luc-mode"
            value={form.hoc_luc_mode ?? 0}
            onChange={(event) => setForm((prev) => ({ ...prev, hoc_luc_mode: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value={0}>0 — Phân vị (khuyến nghị)</option>
            <option value={1}>1 — legacyFitPct (chỉ để rollback)</option>
          </select>
          <p className="text-[11px] text-amber-700">
            Chế độ 1 dùng công thức ngưỡng cũ, có thể bão hoà ở mức 7,0/10. Chỉ dùng tạm thời.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Lưu tham số
        </Button>
        <span className="text-xs text-muted-foreground">{rows.length} tham số</span>
      </div>
    </div>
  )
}
