import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AdminAlert from './AdminAlert'
import { getInterestWeights, updateInterestWeights } from '@/lib/adminApi'

const FIELDS = [
  ['wR', 'R'],
  ['wI', 'I'],
  ['wA', 'A'],
  ['wS', 'S'],
  ['wE', 'E'],
  ['wC', 'C'],
]

export default function InterestWeightsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    getInterestWeights()
      .then((response) => {
        if (active) setRows(response.data?.data || [])
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Không thể tải trọng số tính cách.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const invalidRows = useMemo(
    () =>
      rows.filter((row) => {
        const total = FIELDS.reduce((sum, [key]) => sum + Number(row[key] || 0), 0)
        return Math.abs(total - 1) > 0.001
      }),
    [rows]
  )

  const update = (majorGroup, key, value) => {
    setRows((prev) =>
      prev.map((row) => (row.majorGroup === majorGroup ? { ...row, [key]: value } : row))
    )
  }

  const save = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const payload = rows.map((row) => ({
        majorGroup: row.majorGroup,
        ...Object.fromEntries(FIELDS.map(([key]) => [key, Number(row[key])])),
        note: row.note,
      }))
      const response = await updateInterestWeights(payload)
      setRows(response.data?.data || rows)
      setSuccess('Đã lưu trọng số tính cách cho 8 nhóm ngành.')
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu trọng số.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải trọng số...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {success && <AdminAlert variant="success">{success}</AdminAlert>}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Đây là trọng số <strong>do nhóm đề xuất</strong> từ mô tả nghề nghiệp theo mô hình Holland, chưa được kiểm định
        trên dữ liệu Việt Nam. Không trình bày như chuẩn quốc tế. Mỗi dòng phải cộng đúng 1,000.
      </div>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Nhóm ngành</th>
              {FIELDS.map(([, code]) => (
                <th key={code} className="px-2 py-2 text-center">{code}</th>
              ))}
              <th className="px-2 py-2 text-right">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const total = FIELDS.reduce((sum, [key]) => sum + Number(row[key] || 0), 0)
              return (
                <tr key={row.majorGroup}>
                  <td className="px-3 py-2 font-medium">{row.majorGroup}</td>
                  {FIELDS.map(([key]) => (
                    <td key={key} className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={row[key]}
                        onChange={(event) => update(row.majorGroup, key, event.target.value)}
                        className="h-8 w-20 rounded border border-input bg-background px-1.5 text-right text-xs"
                      />
                    </td>
                  ))}
                  <td className={`px-2 py-2 text-right font-mono ${Math.abs(total - 1) > 0.001 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {total.toFixed(3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || invalidRows.length > 0}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Lưu trọng số
        </Button>
        {invalidRows.length > 0 && (
          <span className="text-xs text-rose-600">
            {invalidRows.length} nhóm chưa cộng đúng 1,000: {invalidRows.map((row) => row.majorGroup).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
