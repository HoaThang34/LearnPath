import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Loader2, Target, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import {
  addCareerSelection, getCareerMajors, getCareerOverview, removeCareerSelection,
  getUserProfile,
} from '@/lib/api'

function RadarChart({ details = [] }) {
  const safeDetails = Array.isArray(details) ? details : []
  const size = 210
  const center = size / 2
  const radius = 76
  const points = (kind) => safeDetails.map((item, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(safeDetails.length, 1)
    const raw = kind === 'student' ? item.score : item.threshold
    const value = Math.max(0, Math.min(Number(raw || 0) / 10, 1))
    const r = radius * value
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`
  }).join(' ')
  return <div className="my-3 flex justify-center"><svg viewBox={`0 0 ${size} ${size}`} className="h-52 w-52" role="img" aria-label="Biểu đồ radar điểm học sinh và ngưỡng rubric">
    {[0.25, 0.5, 0.75, 1].map((scale) => <circle key={scale} cx={center} cy={center} r={radius * scale} fill="none" stroke="#cbd5e1" strokeWidth="1" />)}
    {safeDetails.map((item, index) => { const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(safeDetails.length, 1); return <g key={item.subject}><line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="#cbd5e1" /><text x={center + Math.cos(angle) * (radius + 18)} y={center + Math.sin(angle) * (radius + 18)} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#475569">{item.subject.slice(0, 10)}</text></g> })}
    {safeDetails.length > 2 && <><polygon points={points('threshold')} fill="rgba(249,115,22,.12)" stroke="#f97316" strokeDasharray="4 3" strokeWidth="2" /><polygon points={points('student')} fill="rgba(37,99,235,.2)" stroke="#2563eb" strokeWidth="2" /></>}
  </svg></div>
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
      setOverview(data); setScores(loadedScores); setMajors(majorsResponse.data?.data || []); setMajorTotal(Number(majorsResponse.data?.total || 0)); setProfile(profileResponse.data?.data?.profile || null)
      if ((!snapshot.classLevel || !snapshot.term) && loadedScores[0]) {
        setSnapshot({ classLevel: loadedScores[0].classLevel, term: loadedScores[0].term })
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return
      console.error('Career guidance load failed', err)
      setError(err.response?.data?.error || 'Không thể tải dữ liệu phân tích. Vui lòng thử lại.')
    } finally { if (currentRequest === requestId.current) setLoading(false) }
  }, [filters, majorPage, snapshot])

  useEffect(() => { load() }, [load])

  const snapshots = useMemo(() => [...new Set(scores.map((row) => `${row.classLevel}|${row.term}`))], [scores])
  const visibleScores = scores.filter((row) => row.classLevel === snapshot.classLevel && row.term === snapshot.term)
  const selectMajor = async (major, kind) => {
    try { await addCareerSelection({ schoolCode: major.schoolCode, schoolName: major.schoolName, majorName: major.majorName, method: major.method, admissionBlock: major.admissionBlock, year: major.year, kind }); setSuccess(kind === 'target' ? 'Đã đặt ngành mục tiêu.' : 'Đã ghim ngành quan tâm.'); await load() }
    catch (err) { console.error('Career selection save failed', err); setError(err.response?.data?.error || 'Không thể lưu lựa chọn ngành.') }
  }
  const removeSelection = async (id) => { try { await removeCareerSelection(id); await load() } catch (err) { console.error('Career selection delete failed', err); setError('Không thể bỏ lựa chọn ngành.') } }

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Phân tích năng lực & Định hướng ngành</h1><p className="mt-2 text-muted-foreground">Phân tích dựa trên điểm bạn chọn, minh bạch nguồn dữ liệu và không thay thế tư vấn tuyển sinh.</p></div>
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {success && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
    <Card><CardHeader><CardTitle>1. Hồ sơ điểm phân tích</CardTitle><CardDescription>Điểm chỉ được nhập tại Thông tin cá nhân hoặc khảo sát; trang này đọc trực tiếp hồ sơ đã lưu. Loại điểm dùng chung là trung bình kỳ hoặc trung bình cả năm.</CardDescription></CardHeader><CardContent className="space-y-3">
      <div className="rounded-md bg-muted/50 p-3 text-sm"><strong>Hồ sơ hiện tại:</strong> {profile?.ho_va_ten || user?.username || 'Chưa có tên'} · Lớp {profile?.lop || 'chưa cập nhật'} · Trường {profile?.truong || 'chưa cập nhật'} <a className="ml-2 text-primary underline" href="/thong-tin-ca-nhan">Cập nhật hồ sơ và điểm</a></div>
      {snapshot.classLevel && snapshot.term ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{visibleScores.length ? visibleScores.map((row) => <div key={row.subject} className="flex items-center justify-between rounded-md border p-3 text-sm"><span>{row.subject}</span><strong>{row.score}/10</strong></div>) : <p className="text-sm text-muted-foreground">Chưa có điểm cho lớp {snapshot.classLevel}, {snapshot.term}.</p>}</div> : <p className="text-sm text-muted-foreground">Chọn lớp và kỳ học để xem điểm trung bình môn đã lưu.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Chọn snapshot phân tích</CardTitle><CardDescription>Fit chỉ được tính với rubric đã được quản trị viên xác lập cho đúng lựa chọn tuyển sinh.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-3"><div><Label>Lớp/kỳ học</Label><select className="h-10 rounded-md border bg-background px-3 text-sm" value={`${snapshot.classLevel}|${snapshot.term}`} onChange={(e) => { const [classLevel, term] = e.target.value.split('|'); setSnapshot({ classLevel, term }) }}><option value="|">Chọn lớp và kỳ học</option>{snapshots.map((s) => <option key={s} value={s}>{s.replace('|', ' · ')}</option>)}</select></div><span className="text-sm text-muted-foreground">{user?.username} · đồng bộ từ hồ sơ cá nhân</span></CardContent></Card>
    <Card><CardHeader><CardTitle>3. Kết quả rubric</CardTitle><CardDescription>Điểm phù hợp là chỉ số tham khảo theo trọng số đã công bố; độ phủ cho biết dữ liệu môn học đã đủ đến đâu. Không phải xác suất trúng tuyển.</CardDescription></CardHeader><CardContent>{loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Đang phân tích...</div> : overview?.fits?.length ? <div className="grid gap-3 md:grid-cols-2">{overview.fits.map((fit) => <div key={fit.rubricId} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{fit.majorName}</p><p className="text-sm text-muted-foreground">{fit.schoolName} · {fit.method} · {fit.admissionBlock || 'Chưa có khối'}</p></div><div className="text-right"><p className="text-2xl font-bold text-primary">{fit.fitPct === null ? '—' : `${fit.fitPct}%`}</p><p className="text-xs text-muted-foreground">Độ phủ {fit.coveragePct}%</p></div></div><RadarChart details={fit.details} /><div className="mb-2 flex justify-center gap-4 text-xs"><span className="text-blue-700">● Điểm của bạn</span><span className="text-orange-600">┄ Ngưỡng rubric</span></div><div className="mt-3 space-y-1">{Array.isArray(fit.details) && fit.details.map((detail) => <div key={detail.subject} className="flex justify-between text-sm"><span>{detail.subject}</span><span className={detail.score === null ? 'text-amber-600' : detail.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{detail.score === null ? 'Chưa có điểm' : `${detail.score} / ${detail.threshold}`}</span></div>)}</div></div>)}</div> : <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Chưa có rubric phù hợp với snapshot này. Bạn vẫn có thể khám phá ngành và lưu lựa chọn.</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle>4. Khám phá ngành và điểm chuẩn</CardTitle><CardDescription>Chỉ hiển thị phương thức Điểm thi THPT, dữ liệu năm 2025. “Tỉ lệ đỗ” là chỉ số khoảng cách tham khảo, không phải xác suất trúng tuyển.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Input placeholder="Tìm ngành..." value={filters.search} onChange={(e) => { setMajorPage(1); setFilters({ ...filters, search: e.target.value }) }} /><Input placeholder="Tìm trường..." value={filters.school} onChange={(e) => { setMajorPage(1); setFilters({ ...filters, school: e.target.value }) }} /><Input placeholder="Khối thi (A00, D01...)" value={filters.block} onChange={(e) => { setMajorPage(1); setFilters({ ...filters, block: e.target.value }) }} /><select className="h-10 rounded-md border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" value={filters.sort} aria-label="Sắp xếp danh sách ngành" onChange={(e) => { setMajorPage(1); setFilters({ ...filters, sort: e.target.value }) }}><option value="score_desc">Điểm chuẩn: Cao → Thấp</option><option value="score_asc">Điểm chuẩn: Thấp → Cao</option><option value="rate_desc">Tỉ lệ đỗ: Cao → Thấp</option><option value="rate_asc">Tỉ lệ đỗ: Thấp → Cao</option><option value="school_asc">Tên trường: A → Z</option><option value="school_desc">Tên trường: Z → A</option></select></div><div className="grid gap-3 md:grid-cols-2">{majors.map((major) => <div key={major.id} className="rounded-lg border p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{major.majorName}</p><p className="text-sm text-muted-foreground">{major.schoolName} · Điểm thi THPT</p></div><p className="font-bold">{major.entryScore ?? '—'}</p></div><p className="mt-1 text-xs text-muted-foreground">Khối: {major.admissionBlock || 'Chưa có'} · Năm: {major.year}</p><div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm"><span className="text-muted-foreground">Tỉ lệ đỗ tham khảo: </span><strong className={major.distanceRate === null ? 'text-muted-foreground font-normal' : major.distanceRate >= 100 ? 'text-emerald-600 font-bold' : major.distanceRate >= 90 ? 'text-blue-600 font-bold' : 'text-amber-600 font-semibold'}>{major.distanceRate === null ? 'Chưa đủ dữ liệu' : `${major.distanceRate}%`}</strong></div><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => selectMajor(major, 'pinned')}><Bookmark className="mr-1 h-3.5 w-3.5" />Ghim</Button><Button size="sm" onClick={() => selectMajor(major, 'target')}><Target className="mr-1 h-3.5 w-3.5" />Đặt mục tiêu</Button></div></div>)}</div><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Tổng {majorTotal} dòng điểm chuẩn</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={majorPage === 1} onClick={() => setMajorPage((page) => page - 1)}>Trang trước</Button><span className="px-2 py-1">Trang {majorPage}</span><Button variant="outline" size="sm" disabled={majorPage * 20 >= majorTotal} onClick={() => setMajorPage((page) => page + 1)}>Trang sau</Button></div></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Ngành đã lưu</CardTitle></CardHeader><CardContent>{overview?.selections?.length ? <div className="space-y-2">{overview.selections.map((selection) => <div key={selection.id} className="flex items-center justify-between rounded border p-3 text-sm"><span><strong>{selection.kind === 'target' ? 'Mục tiêu' : 'Quan tâm'}:</strong> {selection.majorName} — {selection.schoolName} ({selection.method}, {selection.year})</span><Button variant="ghost" size="icon" aria-label="Bỏ ngành đã lưu" onClick={() => removeSelection(selection.id)}><X className="h-4 w-4" /></Button></div>)}</div> : <p className="text-sm text-muted-foreground">Chưa có ngành được lưu.</p>}</CardContent></Card>
  </div>
}
