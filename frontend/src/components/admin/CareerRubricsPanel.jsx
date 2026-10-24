import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Database, Loader2, Plus, RotateCcw, Save, Search, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import { deleteCareerRubric, getCareerRubrics, saveCareerRubric, seedCareerRubrics, searchAdmissionMajors } from '@/lib/adminApi'

const BLOCK_TEMPLATES = [
  { label: '--- Chọn nhanh mẫu khối thi ---', subjects: [] },
  { label: 'Khối A00 (Toán 40%, Vật lý 35%, Hóa học 25%)', block: 'A00', subjects: [{ subject: 'Toán', weight: 0.40, threshold: 8 }, { subject: 'Vật lý', weight: 0.35, threshold: 7.5 }, { subject: 'Hóa học', weight: 0.25, threshold: 7.5 }] },
  { label: 'Khối A01 (Toán 40%, Vật lý 35%, Tiếng Anh 25%)', block: 'A01', subjects: [{ subject: 'Toán', weight: 0.40, threshold: 8 }, { subject: 'Vật lý', weight: 0.35, threshold: 7.5 }, { subject: 'Tiếng Anh', weight: 0.25, threshold: 7.5 }] },
  { label: 'Khối B00 (Toán 35%, Hóa học 35%, Sinh học 30%)', block: 'B00', subjects: [{ subject: 'Toán', weight: 0.35, threshold: 8 }, { subject: 'Hóa học', weight: 0.35, threshold: 8 }, { subject: 'Sinh học', weight: 0.30, threshold: 7.5 }] },
  { label: 'Khối C00 (Ngữ văn 40%, Lịch sử 30%, Địa lý 30%)', block: 'C00', subjects: [{ subject: 'Ngữ văn', weight: 0.40, threshold: 8 }, { subject: 'Lịch sử', weight: 0.30, threshold: 7.5 }, { subject: 'Địa lý', weight: 0.30, threshold: 7.5 }] },
  { label: 'Khối D01 (Toán 35%, Ngữ văn 35%, Tiếng Anh 30%)', block: 'D01', subjects: [{ subject: 'Toán', weight: 0.35, threshold: 8 }, { subject: 'Ngữ văn', weight: 0.35, threshold: 7.5 }, { subject: 'Tiếng Anh', weight: 0.30, threshold: 8 }] },
  { label: 'Khối D07 (Toán 40%, Hóa học 30%, Tiếng Anh 30%)', block: 'D07', subjects: [{ subject: 'Toán', weight: 0.40, threshold: 8 }, { subject: 'Hóa học', weight: 0.30, threshold: 7.5 }, { subject: 'Tiếng Anh', weight: 0.30, threshold: 8 }] },
]

const emptyRubric = { schoolCode: '', schoolName: '', majorName: '', method: 'Điểm thi THPT', admissionBlock: '', year: 2025, subjects: [{ subject: 'Toán', weight: 0.4, threshold: 8 }, { subject: 'Vật lý', weight: 0.35, threshold: 7.5 }, { subject: 'Tiếng Anh', weight: 0.25, threshold: 7.5 }] }

export default function CareerRubricsPanel() {
  const [rubrics, setRubrics] = useState([])
  const [form, setForm] = useState(emptyRubric)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterText, setFilterText] = useState('')

  // Major autocomplete search
  const [majorQuery, setMajorQuery] = useState('')
  const [majorSuggestions, setMajorSuggestions] = useState([])
  const [searchingMajors, setSearchingMajors] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await getCareerRubrics()
      setRubrics(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải rubric.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Search admission majors debounce
  useEffect(() => {
    if (!majorQuery.trim() || majorQuery.length < 2) {
      setMajorSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingMajors(true)
      try {
        const res = await searchAdmissionMajors(majorQuery.trim())
        setMajorSuggestions(res.data?.data || [])
      } catch (err) {
        console.warn('Search admission majors error:', err)
      } finally {
        setSearchingMajors(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [majorQuery])

  const selectSuggestion = (item) => {
    setForm((current) => ({
      ...current,
      schoolCode: item.schoolCode || '',
      schoolName: item.schoolName || '',
      majorName: item.majorName || '',
      admissionBlock: (item.admissionBlock || '').split(';')[0]?.trim() || current.admissionBlock || '',
      method: item.method || 'Điểm thi THPT',
    }))
    setMajorQuery('')
    setMajorSuggestions([])
  }

  const applyTemplate = (e) => {
    const idx = Number(e.target.value)
    if (idx > 0 && BLOCK_TEMPLATES[idx]) {
      const t = BLOCK_TEMPLATES[idx]
      setForm((current) => ({
        ...current,
        admissionBlock: t.block || current.admissionBlock,
        subjects: t.subjects.map((s) => ({ ...s })),
      }))
    }
  }

  const totalWeight = useMemo(() => {
    return form.subjects.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
  }, [form.subjects])

  const isWeightValid = Math.abs(totalWeight - 1) <= 0.001

  const save = async (event) => {
    event.preventDefault()
    if (!isWeightValid) {
      setError(`Tổng trọng số phải bằng 1 (hiện tại: ${totalWeight.toFixed(3)}). Vui lòng điều chỉnh lại trọng số các môn.`)
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await saveCareerRubric(form)
      setSuccess('Đã lưu rubric thành công.')
      setForm(emptyRubric)
      await load()
    } catch (err) {
      console.error('Career rubric save failed', err)
      setError(err.response?.data?.error || 'Không thể lưu rubric.')
    } finally {
      setSaving(false)
    }
  }

  const handleSeed = async () => {
    if (!window.confirm('Nạp 6 rubric mẫu chuẩn hóa cho các trường hot năm 2025 (ĐHBK Hà Nội, ĐH Kinh tế Quốc dân, ĐH Ngoại thương, ĐH Sư phạm Hà Nội)?')) return
    setSeeding(true); setError(''); setSuccess('')
    try {
      const res = await seedCareerRubrics()
      setSuccess(`Đã nạp thành công bộ rubric mẫu (${res.data?.rubrics?.length || 6} ngành).`)
      await load()
    } catch (err) {
      console.error('Seed rubrics failed', err)
      setError(err.response?.data?.error || 'Không thể nạp rubric mẫu.')
    } finally {
      setSeeding(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Xóa rubric này?')) return
    try {
      await deleteCareerRubric(id)
      setSuccess('Đã xóa rubric.')
      await load()
    } catch (err) {
      console.error('Career rubric delete failed', err)
      setError(err.response?.data?.error || 'Không thể xóa rubric.')
    }
  }

  const edit = (row) => {
    const subjects = rubrics
      .filter((item) => item.id === row.id)
      .map((item) => ({ subject: item.subject, weight: Number(item.weight), threshold: Number(item.threshold) }))
    setForm({
      schoolCode: row.schoolCode || '',
      schoolName: row.schoolName,
      majorName: row.majorName,
      method: row.method,
      admissionBlock: row.admissionBlock || '',
      year: row.year,
      subjects,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateSubject = (index, field, value) => {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }))
  }

  // Unique list of rubrics
  const uniqueRubrics = useMemo(() => {
    return [...new Map(rubrics.map((row) => [row.id, row])).values()]
  }, [rubrics])

  const filteredRubrics = useMemo(() => {
    if (!filterText.trim()) return uniqueRubrics
    const q = filterText.trim().toLowerCase()
    return uniqueRubrics.filter((r) =>
      String(r.majorName || '').toLowerCase().includes(q) ||
      String(r.schoolName || '').toLowerCase().includes(q) ||
      String(r.admissionBlock || '').toLowerCase().includes(q)
    )
  }, [uniqueRubrics, filterText])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rubric phân tích năng lực</h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình trọng số và ngưỡng năng lực theo từng lựa chọn tuyển sinh (năm 2025). Tổng trọng số phải bằng 1.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleSeed}
          disabled={seeding || loading}
          className="self-start sm:self-auto"
        >
          {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-amber-500" />}
          Nạp 6 rubric mẫu
        </Button>
      </div>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {success && <AdminAlert variant="success">{success}</AdminAlert>}

      {/* Form Tạo/Cập nhật Rubric */}
      <Card>
        <CardHeader>
          <CardTitle>Tạo hoặc Cập nhật Rubric</CardTitle>
          <CardDescription>
            Tìm nhanh ngành tuyển sinh hoặc nhập thủ công thông tin trường, ngành, khối thi và các môn đánh giá.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Gợi ý tra cứu nhanh */}
          <div className="relative rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs font-semibold text-muted-foreground">Gợi ý điền nhanh từ dữ liệu điểm chuẩn tuyển sinh:</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Gõ tên ngành hoặc trường (vd: Bách khoa, Ngoại thương, Kinh tế quốc dân, Sư phạm...)"
                value={majorQuery}
                onChange={(e) => setMajorQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchingMajors && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {majorSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                {majorSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectSuggestion(item)}
                    className="flex w-full items-start justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.majorName}</p>
                      <p className="text-xs text-muted-foreground">{item.schoolName} ({item.schoolCode}) · Khối: {item.admissionBlock || '—'}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">{item.entryScore}đ</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <Label>Mã trường</Label>
                <Input
                  placeholder="Vd: BKA"
                  value={form.schoolCode}
                  onChange={(e) => setForm({ ...form, schoolCode: e.target.value })}
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Tên trường <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Vd: ĐHBK Hà Nội"
                  value={form.schoolName}
                  onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Tên ngành <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Vd: Kỹ thuật Điều khiển - Tự động hoá"
                  value={form.majorName}
                  onChange={(e) => setForm({ ...form, majorName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Phương thức</Label>
                <Input
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Khối thi</Label>
                <Input
                  placeholder="Vd: A00"
                  value={form.admissionBlock}
                  onChange={(e) => setForm({ ...form, admissionBlock: e.target.value })}
                />
              </div>
              <div>
                <Label>Năm xét tuyển</Label>
                <Input
                  type="number"
                  value={form.year}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Mẫu môn theo khối</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={applyTemplate}
                  defaultValue="0"
                >
                  {BLOCK_TEMPLATES.map((tmpl, index) => (
                    <option key={index} value={index}>{tmpl.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Danh sách môn đánh giá */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Cấu hình môn học & Ngưỡng năng lực</Label>
                  <p className="text-xs text-muted-foreground">Mỗi môn có trọng số (0 - 1) và ngưỡng điểm đạt chuẩn (0 - 10).</p>
                </div>
                <div className={`rounded px-2.5 py-1 text-xs font-semibold ${isWeightValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  Tổng trọng số: {(totalWeight * 100).toFixed(1)}% {isWeightValid ? '✓' : '(Phải bằng 100%)'}
                </div>
              </div>

              <div className="space-y-2">
                {form.subjects.map((subject, index) => (
                  <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-md border p-2 sm:p-3">
                    <div className="col-span-12 sm:col-span-5">
                      <Label className="text-xs">Tên môn học</Label>
                      <Input
                        placeholder="Vd: Toán"
                        value={subject.subject}
                        onChange={(e) => updateSubject(index, 'subject', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Label className="text-xs">Trọng số (0.01 - 1.0)</Label>
                      <Input
                        type="number"
                        min="0.001"
                        max="1"
                        step="0.001"
                        value={subject.weight}
                        onChange={(e) => updateSubject(index, 'weight', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Label className="text-xs">Ngưỡng đạt (thang 10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={subject.threshold}
                        onChange={(e) => updateSubject(index, 'threshold', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Xóa môn rubric"
                        onClick={() => setForm({ ...form, subjects: form.subjects.filter((_, i) => i !== index) })}
                        disabled={form.subjects.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm({ ...form, subjects: [...form.subjects, { subject: '', weight: 0.1, threshold: 7 }] })}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Thêm môn
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(emptyRubric)}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Làm mới form
                </Button>
                <Button type="submit" disabled={saving || !isWeightValid}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {saving ? 'Đang lưu...' : 'Lưu rubric'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danh sách Rubric hiện có */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Rubric hiện có ({uniqueRubrics.length})</CardTitle>
              <CardDescription>Các rubric đang được kích hoạt cho phân tích năng lực học sinh.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Lọc rubric..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải danh sách rubric...
            </div>
          ) : filteredRubrics.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredRubrics.map((row) => {
                const subjects = rubrics.filter((item) => item.id === row.id)
                return (
                  <div key={row.id} className="flex flex-col justify-between rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{row.majorName}</p>
                          <p className="text-sm text-muted-foreground">{row.schoolName} {row.schoolCode ? `(${row.schoolCode})` : ''}</p>
                        </div>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {row.admissionBlock || 'Chưa có khối'} · {row.year}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {subjects.map((item, idx) => (
                          <span key={idx} className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                            <strong>{item.subject}</strong>: {(Number(item.weight) * 100).toFixed(0)}% (ngưỡng {item.threshold})
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" onClick={() => edit(row)}>
                        Sửa
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Xóa rubric" onClick={() => remove(row.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {uniqueRubrics.length === 0 ? (
                <div className="space-y-2">
                  <Database className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p>Chưa có rubric nào trong hệ thống.</p>
                  <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
                    <Sparkles className="mr-1.5 h-4 w-4 text-amber-500" /> Nạp bộ rubric mẫu ngay
                  </Button>
                </div>
              ) : (
                <p>Không tìm thấy rubric khớp với từ khóa "{filterText}".</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
