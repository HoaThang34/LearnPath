import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import { deleteCareerRubric, getCareerRubrics, saveCareerRubric } from '@/lib/adminApi'

const emptyRubric = { schoolCode: '', schoolName: '', majorName: '', method: 'Điểm thi THPT', admissionBlock: '', year: 2025, subjects: [{ subject: '', weight: 1, threshold: 7 }] }

export default function CareerRubricsPanel() {
  const [rubrics, setRubrics] = useState([])
  const [form, setForm] = useState(emptyRubric)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await getCareerRubrics(); setRubrics(response.data?.data || []) } catch (err) { setError(err.response?.data?.error || 'Không thể tải rubric.') } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  const save = async (event) => { event.preventDefault(); setSaving(true); setError(''); setSuccess(''); try { await saveCareerRubric(form); setSuccess('Đã lưu rubric.'); setForm(emptyRubric); await load() } catch (err) { console.error('Career rubric save failed', err); setError(err.response?.data?.error || 'Không thể lưu rubric.') } finally { setSaving(false) } }
  const remove = async (id) => { if (!window.confirm('Xóa rubric này?')) return; try { await deleteCareerRubric(id); await load() } catch (err) { console.error('Career rubric delete failed', err); setError(err.response?.data?.error || 'Không thể xóa rubric.') } }
  const edit = (row) => { const subjects = rubrics.filter((item) => item.id === row.id).map((item) => ({ subject: item.subject, weight: Number(item.weight), threshold: Number(item.threshold) })); setForm({ schoolCode: row.schoolCode || '', schoolName: row.schoolName, majorName: row.majorName, method: row.method, admissionBlock: row.admissionBlock || '', year: row.year, subjects }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const updateSubject = (index, field, value) => setForm((current) => ({ ...current, subjects: current.subjects.map((row, i) => i === index ? { ...row, [field]: value } : row) }))
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Rubric phân tích năng lực</h1><p className="text-sm text-muted-foreground">Cấu hình theo lựa chọn tuyển sinh; năm hiện triển khai là 2025. Tổng trọng số phải bằng 1.</p></div>
    {error && <AdminAlert variant="error">{error}</AdminAlert>}{success && <AdminAlert variant="success">{success}</AdminAlert>}
    <Card><CardHeader><CardTitle>Tạo/cập nhật rubric</CardTitle><CardDescription>Mỗi môn có trọng số và ngưỡng trên thang 0–10.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="space-y-4"><div className="grid gap-3 md:grid-cols-3">{[['schoolCode','Mã trường'],['schoolName','Tên trường'],['majorName','Tên ngành'],['method','Phương thức'],['admissionBlock','Khối thi']].map(([key,label]) => <div key={key}><Label>{label}</Label><Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== 'schoolCode' && key !== 'admissionBlock'} /></div>)}</div>
      <div className="space-y-2">{form.subjects.map((subject,index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_150px_150px_auto] md:items-end"><div><Label>Môn</Label><Input value={subject.subject} onChange={(e) => updateSubject(index,'subject',e.target.value)} required /></div><div><Label>Trọng số</Label><Input type="number" min="0.001" max="1" step="0.001" value={subject.weight} onChange={(e) => updateSubject(index,'weight',Number(e.target.value))} required /></div><div><Label>Ngưỡng</Label><Input type="number" min="0" max="10" step="0.1" value={subject.threshold} onChange={(e) => updateSubject(index,'threshold',Number(e.target.value))} required /></div><Button type="button" variant="ghost" size="icon" aria-label="Xóa môn rubric" onClick={() => setForm({ ...form, subjects: form.subjects.filter((_,i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setForm({ ...form, subjects: [...form.subjects,{subject:'',weight:0,threshold:7}] })}><Plus className="mr-2 h-4 w-4" />Thêm môn</Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Đang lưu...' : 'Lưu rubric'}</Button></div></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Rubric hiện có</CardTitle></CardHeader><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : rubrics.length ? <div className="space-y-2">{[...new Map(rubrics.map((row) => [row.id, row])).values()].map((row) => { const subjects = rubrics.filter((item) => item.id === row.id); return <div key={row.id} className="flex items-start justify-between gap-3 rounded border p-3"><div><p className="font-medium">{row.majorName} — {row.schoolName}</p><p className="text-sm text-muted-foreground">{row.method} · {row.admissionBlock || 'Chưa có khối'} · {row.year}</p><p className="mt-1 text-xs">{subjects.map((item) => `${item.subject}: ${(item.weight * 100).toFixed(1)}% / ngưỡng ${item.threshold}`).join(' · ')}</p></div><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => edit(row)}>Sửa</Button><Button variant="ghost" size="icon" aria-label="Xóa rubric" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div> })}</div> : <p className="text-sm text-muted-foreground">Chưa có rubric.</p>}</CardContent></Card>
  </div>
}
