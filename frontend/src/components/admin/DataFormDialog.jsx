import { useEffect, useState } from 'react'
import { Edit3, Eye, Loader2 } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTableRow, updateTableRow } from '@/lib/adminApi'
import { getErrorMessage } from '@/lib/adminUtils'
import { cn } from '@/lib/utils'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'

const COLUMN_LABELS = {
  id: 'ID',
  ma_khoi: 'Mã khối',
  mon_thi: 'Môn thi',
  so_truong: 'Số trường',
  ma_truong: 'Mã trường',
  ten_truong: 'Tên trường',
  truong: 'Trường',
  nganh: 'Ngành',
  to_hop_mon: 'Tổ hợp môn',
  diem_chuan: 'Điểm chuẩn',
  ghi_chu: 'Ghi chú',
  nam: 'Năm',
  phuong_thuc: 'Phương thức',
  sbd: 'SBD',
  tinh: 'Tỉnh/Thành phố',
  toan: 'Toán',
  van: 'Văn',
  ly: 'Lý',
  hoa: 'Hóa',
  sinh: 'Sinh',
  su: 'Sử',
  dia: 'Địa',
  gd_kt_pl: 'GDKT&PL',
  tin_hoc: 'Tin học',
  cong_nghe: 'Công nghệ',
  ngoai_ngu: 'Ngoại ngữ',
  noi_dung: 'Nội dung',
  nguon: 'Nguồn',
}

export function getColumnLabel(column) {
  return COLUMN_LABELS[column.name] || column.name
}

function buildInitialState(tableMeta, row) {
  const values = {}
  const nullFields = {}

  for (const column of tableMeta.columns) {
    if (column.readOnly) continue
    const value = row ? row[column.name] : null
    values[column.name] = value === null || value === undefined ? '' : String(value)
    nullFields[column.name] = Boolean(row && column.nullable && (value === null || value === undefined))
  }

  return { values, nullFields }
}

export default function DataFormDialog({ open, tableMeta, row, onClose, onSaved }) {
  const isEdit = Boolean(row)
  const [values, setValues] = useState({})
  const [nullFields, setNullFields] = useState({})
  const [markdownTab, setMarkdownTab] = useState('write')
  const [error, setError] = useState('')
  const [dependencyError, setDependencyError] = useState('')
  const [force, setForce] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !tableMeta) return
    const initial = buildInitialState(tableMeta, row)
    setValues(initial.values)
    setNullFields(initial.nullFields)
    setMarkdownTab('write')
    setError('')
    setDependencyError('')
    setForce(false)
    setSubmitting(false)
  }, [open, tableMeta, row])

  if (!tableMeta) return null

  const editableColumns = tableMeta.columns.filter((column) => !column.readOnly)

  const handleChange = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
  }

  const handleNullChange = (name, checked) => {
    setNullFields((current) => ({ ...current, [name]: checked }))
    if (checked) handleChange(name, '')
  }

  const buildPayload = () => {
    const payload = {}

    for (const column of editableColumns) {
      if (nullFields[column.name]) {
        payload[column.name] = null
        continue
      }

      const raw = values[column.name]

      if (column.type === 'integer' || column.type === 'real') {
        if (raw === '' || raw === undefined || raw === null) {
          payload[column.name] = null
        } else {
          const parsed = Number(raw)
          payload[column.name] = Number.isFinite(parsed) ? parsed : raw
        }
        continue
      }

      payload[column.name] = raw === undefined ? '' : raw
    }

    return payload
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const payload = buildPayload()
      if (force) payload.force = true

      const response = isEdit
        ? await updateTableRow(tableMeta.table, row.id, payload)
        : await createTableRow(tableMeta.table, payload)

      onSaved({
        data: response.data.data,
        warning: response.data.warning || '',
      })
    } catch (requestError) {
      const data = requestError.response?.data
      if (data?.code === 'DEPENDENCIES_EXIST') {
        setDependencyError(data.error)
        setForce(false)
      } else {
        setError(getErrorMessage(requestError))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminDialog
      open={open}
      title={isEdit ? `Chỉnh sửa ${tableMeta.label.toLowerCase()}` : `Thêm mới ${tableMeta.label.toLowerCase()} (thủ công)`}
      description={
        isEdit
          ? `Dòng ID ${row.id} trong bảng ${tableMeta.label}. Các trường bắt buộc được đánh dấu *.`
          : `Nhập thông tin dữ liệu mới để thêm thủ công vào bảng ${tableMeta.label}. Các trường bắt buộc được đánh dấu *.`
      }
      onClose={submitting ? undefined : onClose}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" form="data-form" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm mới thủ công'}
          </Button>
        </>
      }
    >
      <form id="data-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        {dependencyError && (
          <div className="space-y-3">
            <AdminAlert variant="warning">{dependencyError}</AdminAlert>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                Tôi hiểu và muốn ghi đè. Dữ liệu liên quan có thể trở nên không nhất quán.
              </span>
            </label>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {editableColumns.map((column) => {
            const isText = column.type === 'text'
            const isNumber = column.type === 'integer' || column.type === 'real'
            const isNull = Boolean(nullFields[column.name])
            const fieldId = `data-field-${column.name}`

            return (
              <div
                key={column.name}
                className={isText ? 'space-y-2 sm:col-span-2' : 'space-y-2'}
              >
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={fieldId}>
                    {getColumnLabel(column)}
                    {column.required && <span className="ml-1 text-destructive">*</span>}
                    <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                      {column.name}
                    </span>
                  </Label>
                  {column.nullable && (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={isNull}
                        onChange={(event) => handleNullChange(column.name, event.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      Không có giá trị
                    </label>
                  )}
                </div>

                {isText ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Hỗ trợ định dạng Markdown</span>
                      <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
                        <button
                          type="button"
                          onClick={() => setMarkdownTab('write')}
                          className={cn(
                            'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition',
                            markdownTab === 'write' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Edit3 className="h-3 w-3" />
                          Soạn thảo
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarkdownTab('preview')}
                          className={cn(
                            'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition',
                            markdownTab === 'preview' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Eye className="h-3 w-3" />
                          Xem trước
                        </button>
                      </div>
                    </div>
                    {markdownTab === 'write' ? (
                      <textarea
                        id={fieldId}
                        value={values[column.name] ?? ''}
                        onChange={(event) => handleChange(column.name, event.target.value)}
                        disabled={isNull}
                        rows={14}
                        spellCheck={false}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    ) : (
                      <div className="max-h-[380px] min-h-[200px] overflow-y-auto rounded-md border bg-slate-50 p-4 text-sm prose prose-sm max-w-none">
                        {values[column.name] ? (
                          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {values[column.name]}
                          </Markdown>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">Chưa có nội dung để xem trước.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    id={fieldId}
                    type={isNumber ? 'number' : 'text'}
                    step={column.type === 'integer' ? '1' : 'any'}
                    value={values[column.name] ?? ''}
                    onChange={(event) => handleChange(column.name, event.target.value)}
                    disabled={isNull}
                    maxLength={isNumber ? undefined : column.maxLength}
                    autoComplete="off"
                    spellCheck={false}
                    list={column.name === 'phuong_thuc' ? 'phuong-thuc-list' : column.name === 'nam' ? 'nam-list' : undefined}
                  />
                )}

                {column.name === 'phuong_thuc' && (
                  <>
                    <datalist id="phuong-thuc-list">
                      <option value="THPT">Tốt nghiệp THPT</option>
                      <option value="HSA">ĐGNL ĐHQGHN (HSA)</option>
                      <option value="TSA">ĐGTD ĐHBK Hà Nội (TSA)</option>
                      <option value="V-ACT">ĐGNL ĐHQG TP.HCM (V-ACT)</option>
                      <option value="SAT">Chứng chỉ quốc tế (SAT)</option>
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Gợi ý: THPT, HSA, TSA, V-ACT, SAT hoặc phương thức khác.
                    </p>
                  </>
                )}
                {column.name === 'nam' && (
                  <datalist id="nam-list">
                    <option value="2026" />
                    <option value="2025" />
                    <option value="2024" />
                  </datalist>
                )}
                {column.min !== undefined && column.max !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Giá trị từ {column.min.toLocaleString('vi-VN')} đến {column.max.toLocaleString('vi-VN')}.
                  </p>
                )}
                {isText && column.maxLength && (
                  <p className="text-xs text-muted-foreground">
                    Tối đa {column.maxLength.toLocaleString('vi-VN')} ký tự.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </form>
    </AdminDialog>
  )
}
