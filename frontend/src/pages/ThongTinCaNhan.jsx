import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  GraduationCap,
  Heart,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Save,
  School,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { getUserProfile, updateUserProfile, getInterestLatestResult, getExamScores, getExamScoreOptions, saveExamScores } from '@/lib/api'
import { cn } from '@/lib/utils'
import AcademicScoresEditor, { inferAcademicClassLevel, inferAcademicTerm } from '@/components/AcademicScoresEditor'
import TargetMajorSelector from '@/components/TargetMajorSelector'

const SUGGESTED_CERTIFICATES = [
  'IELTS',
  'TOEIC',
  'TOEFL iBT',
  'HSA (ĐGNL ĐHQGHN)',
  'TSA (ĐGTD ĐHBK Hà Nội)',
  'V-ACT (ĐGNL ĐHQG TP.HCM)',
  'SAT',
  'ACT',
  'Chứng chỉ tiếng Trung (HSK)',
  'Chứng chỉ tiếng Nhật (JLPT)',
]

const THPTQG_EXAM_SUBJECTS = [
  'Toán',
  'Ngữ văn',
  'Tiếng Anh',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Lịch sử',
  'Địa lí',
  'Tin học',
  'Công nghệ',
  'GDKT&PL',
]

const QUICK_COMBINATIONS = [
  { code: 'A00', subjects: ['Toán', 'Vật lý', 'Hóa học'] },
  { code: 'A01', subjects: ['Toán', 'Vật lý', 'Tiếng Anh'] },
  { code: 'B00', subjects: ['Toán', 'Hóa học', 'Sinh học'] },
  { code: 'C00', subjects: ['Ngữ văn', 'Lịch sử', 'Địa lí'] },
  { code: 'D01', subjects: ['Toán', 'Ngữ văn', 'Tiếng Anh'] },
  { code: 'D07', subjects: ['Toán', 'Hóa học', 'Tiếng Anh'] },
]

function validatePasswordInputs(current, next, confirm) {
  if (!current) return 'Vui lòng nhập mật khẩu hiện tại.'
  if (next.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự.'
  if (next.length > 128) return 'Mật khẩu mới không được dài quá 128 ký tự.'
  if (!/\p{L}/u.test(next) || !/\p{Nd}/u.test(next)) {
    return 'Mật khẩu mới phải có ít nhất một chữ cái và một chữ số.'
  }
  if (next !== confirm) return 'Mật khẩu xác nhận không khớp.'
  if (next === current) return 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  return ''
}

export default function ThongTinCaNhan() {
  const { user, changePassword } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // State đổi mật khẩu
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [academicClassLevel, setAcademicClassLevel] = useState('10')
  const [academicTerm, setAcademicTerm] = useState('Kỳ 1')
  const [interestResult, setInterestResult] = useState(null)
  const [examScores, setExamScores] = useState([])
  const [examOptions, setExamOptions] = useState([])
  const [examSaving, setExamSaving] = useState(false)
  const [examError, setExamError] = useState('')
  const [examSuccess, setExamSuccess] = useState('')

  const [form, setForm] = useState({
    ho_va_ten: '',
    lop: '',
    truong: '',
    diem_lop: [],
    chung_chi: [],
    chung_chi_mong_muon: [],
    truong_muc_tieu: '',
    nganh_muc_tieu: '',
    to_hop_mong_muon: [],
    khac: '',
    updated_at: null,
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      getUserProfile(),
      getInterestLatestResult().catch(() => ({ data: { data: null } })),
      getExamScores().catch(() => ({ data: { data: [] } })),
      getExamScoreOptions().catch(() => ({ data: { data: [] } })),
    ])
      .then(([profileResponse, interestResponse, examResponse, optionsResponse]) => {
        if (!active) return
        const p = profileResponse.data.data.profile
        const scores = Array.isArray(p.diem_lop) ? p.diem_lop : []
        setAcademicClassLevel(inferAcademicClassLevel(p.lop, scores))
        setAcademicTerm(inferAcademicTerm(scores))
        setForm({
          ho_va_ten: p.ho_va_ten || '',
          lop: p.lop || '',
          truong: p.truong || '',
          diem_lop: scores,
          chung_chi: Array.isArray(p.chung_chi) ? p.chung_chi : [],
          chung_chi_mong_muon: Array.isArray(p.chung_chi_mong_muon) ? p.chung_chi_mong_muon : [],
          truong_muc_tieu: p.truong_muc_tieu || '',
          nganh_muc_tieu: p.nganh_muc_tieu || '',
          to_hop_mong_muon: Array.isArray(p.to_hop_mong_muon) ? p.to_hop_mong_muon : [],
          khac: p.khac || '',
          updated_at: p.updated_at,
        })
        setInterestResult(interestResponse.data?.data || null)
        setExamScores(
          (examResponse.data?.data || []).map((row) => ({ block: row.block, score: String(row.score) }))
        )
        setExamOptions(optionsResponse.data?.data || [])
      })
      .catch((err) => {
        if (!active) return
        setError(err.response?.data?.error || 'Không thể tải thông tin hồ sơ cá nhân.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Chứng chỉ đã có
  const handleAddCertificate = () => {
    setForm((prev) => ({
      ...prev,
      chung_chi: [...prev.chung_chi, { loai: '', diem: '' }],
    }))
  }

  const handleUpdateCertificate = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.chung_chi]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, chung_chi: updated }
    })
  }

  const handleRemoveCertificate = (index) => {
    setForm((prev) => ({
      ...prev,
      chung_chi: prev.chung_chi.filter((_, i) => i !== index),
    }))
  }

  // Chứng chỉ mong muốn có trong thời gian tới
  const handleAddDesiredCertificate = () => {
    setForm((prev) => ({
      ...prev,
      chung_chi_mong_muon: [...(prev.chung_chi_mong_muon || []), { loai: '', diem: '' }],
    }))
  }

  const handleUpdateDesiredCertificate = (index, field, value) => {
    setForm((prev) => {
      const updated = [...(prev.chung_chi_mong_muon || [])]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, chung_chi_mong_muon: updated }
    })
  }

  const handleRemoveDesiredCertificate = (index) => {
    setForm((prev) => ({
      ...prev,
      chung_chi_mong_muon: (prev.chung_chi_mong_muon || []).filter((_, i) => i !== index),
    }))
  }

  // Tổ hợp môn mong muốn (tối đa 3 môn)
  const handleToggleExamSubject = (subjectName) => {
    setForm((prev) => {
      const current = prev.to_hop_mong_muon || []
      if (current.includes(subjectName)) {
        return {
          ...prev,
          to_hop_mong_muon: current.filter((s) => s !== subjectName),
        }
      }
      if (current.length >= 3) {
        // Thay thế hoặc chặn nếu đã đủ 3 môn
        return prev
      }
      return {
        ...prev,
        to_hop_mong_muon: [...current, subjectName],
      }
    })
  }

  const handleSelectQuickCombination = (comboSubjects) => {
    setForm((prev) => ({
      ...prev,
      to_hop_mong_muon: [...comboSubjects],
    }))
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    const valErr = validatePasswordInputs(currentPassword, newPassword, newPasswordConfirm)
    if (valErr) {
      setPasswordError(valErr)
      return
    }

    setPasswordSubmitting(true)
    try {
      await changePassword({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      })
      setPasswordSuccess('Đổi mật khẩu tài khoản thành công!')
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    } catch (err) {
      setPasswordError(
        err.response?.data?.error || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.'
      )
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordError('')
    setPasswordSuccess('')
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirm('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setSaving(true)

    try {
      const payload = {
        ho_va_ten: form.ho_va_ten,
        lop: form.lop,
        truong: form.truong,
        diem_lop: form.diem_lop.filter((item) => item.mon && item.diem !== ''),
        chung_chi: form.chung_chi.filter((item) => item.loai || item.diem),
        chung_chi_mong_muon: (form.chung_chi_mong_muon || []).filter((item) => item.loai || item.diem),
        truong_muc_tieu: form.truong_muc_tieu,
        nganh_muc_tieu: form.nganh_muc_tieu,
        to_hop_mong_muon: form.to_hop_mong_muon,
        khac: form.khac,
      }

      const response = await updateUserProfile(payload)
      const p = response.data.data.profile
      const scores = Array.isArray(p.diem_lop) ? p.diem_lop : []
      setAcademicClassLevel(inferAcademicClassLevel(p.lop, scores))
      setAcademicTerm(inferAcademicTerm(scores))
      setForm({
        ho_va_ten: p.ho_va_ten || '',
        lop: p.lop || '',
        truong: p.truong || '',
        diem_lop: scores,
        chung_chi: Array.isArray(p.chung_chi) ? p.chung_chi : [],
        chung_chi_mong_muon: Array.isArray(p.chung_chi_mong_muon) ? p.chung_chi_mong_muon : [],
        truong_muc_tieu: p.truong_muc_tieu || '',
        nganh_muc_tieu: p.nganh_muc_tieu || '',
        to_hop_mong_muon: Array.isArray(p.to_hop_mong_muon) ? p.to_hop_mong_muon : [],
        khac: p.khac || '',
        updated_at: p.updated_at,
      })

      setSuccessMessage('Đã lưu và cập nhật thông tin cá nhân thành công!')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu thông tin. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveExamScores = async () => {
    setExamError('')
    setExamSuccess('')
    setExamSaving(true)
    try {
      const payload = examScores
        .filter((row) => row.block && row.score !== '')
        .map((row) => ({ block: row.block, score: Number(row.score), source: 'tự khai' }))
      const response = await saveExamScores(payload)
      setExamScores(
        (response.data?.data?.scores || []).map((row) => ({ block: row.block, score: String(row.score) }))
      )
      setExamSuccess('Đã lưu điểm thi/dự kiến theo tổ hợp.')
    } catch (err) {
      setExamError(err.response?.data?.error || 'Không thể lưu điểm thi theo tổ hợp.')
    } finally {
      setExamSaving(false)
    }
  }

  const handleAddExamScore = () => {
    const used = new Set(examScores.map((row) => row.block))
    const next = examOptions.find((option) => !used.has(option.block))
    setExamScores((prev) => [...prev, { block: next?.block || '', score: '' }])
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Đang tải thông tin cá nhân...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Thông Tin Cá Nhân
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              Học sinh
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Lưu trữ thông tin học tập, bảng điểm, chứng chỉ và mục tiêu xét tuyển của bạn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPasswordModal(true)}
            className="gap-1.5 border-slate-200 bg-white shadow-sm hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <KeyRound className="h-4 w-4 text-primary" />
            <span>Đổi mật khẩu</span>
          </Button>

          {form.updated_at && (
            <div className="text-right text-xs text-muted-foreground">
              <span>Cập nhật lần cuối: </span>
              <span className="font-medium text-foreground">
                {new Date(form.updated_at).toLocaleString('vi-VN')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Thông báo trạng thái */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Phần 1: Thông tin học sinh & Tài khoản */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Thông tin học sinh
                </CardTitle>
                <CardDescription>
                  Tên tài khoản, họ tên, lớp và ngôi trường cấp 3 bạn đang theo học.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordModal(true)}
                className="h-8 gap-1.5 text-xs font-medium text-slate-700 hover:text-primary"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Đổi mật khẩu
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tên đăng nhập - chỉ xem, không thể sửa */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="username" className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Tên đăng nhập (Username)
                  </Label>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                    Chỉ xem, không thể sửa
                  </span>
                </div>
                <Input
                  id="username"
                  value={user?.username || ''}
                  readOnly
                  disabled
                  aria-readonly="true"
                  className="cursor-not-allowed border-slate-200 bg-slate-100/90 font-medium text-slate-700 select-all"
                  title="Tên đăng nhập cố định, không thể thay đổi"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tên tài khoản cố định dùng để đăng nhập vào hệ thống LearnPath.
                </p>
              </div>

              {/* Họ và Tên */}
              <div className="space-y-1.5">
                <Label htmlFor="ho_va_ten">Họ và Tên</Label>
                <Input
                  id="ho_va_ten"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={form.ho_va_ten}
                  onChange={(e) => setForm({ ...form, ho_va_ten: e.target.value })}
                  maxLength={255}
                />
                <p className="text-[11px] text-muted-foreground">
                  Họ và tên của bạn để hiển thị trong hồ sơ học tập.
                </p>
              </div>

              {/* Lớp */}
              <div className="space-y-1.5">
                <Label htmlFor="lop">Lớp</Label>
                <Input
                  id="lop"
                  placeholder="Ví dụ: 12A1"
                  value={form.lop}
                  onChange={(e) => setForm({ ...form, lop: e.target.value })}
                  maxLength={64}
                />
                <p className="text-[11px] text-muted-foreground">
                  Lớp học hiện tại của bạn ở trường THPT.
                </p>
              </div>

              {/* Trường THPT */}
              <div className="space-y-1.5">
                <Label htmlFor="truong">Trường THPT</Label>
                <Input
                  id="truong"
                  placeholder="Ví dụ: THPT Chuyên Hà Nội - Amsterdam"
                  value={form.truong}
                  onChange={(e) => setForm({ ...form, truong: e.target.value })}
                  maxLength={255}
                />
                <p className="text-[11px] text-muted-foreground">
                  Trường cấp 3 bạn đang hoặc từng theo học.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sở thích nghề nghiệp */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Compass className="h-5 w-5 text-primary" />
              Sở thích nghề nghiệp
            </CardTitle>
            <CardDescription>
              Kết quả khám phá Holland/RIASEC và 4 cặp xu hướng được dùng làm chỉ báo khám phá trong Phân tích năng lực.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {interestResult ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50/60 p-3">
                <div>
                  <p className="font-semibold">
                    Mã tham khảo: {interestResult.part1.code || '—'} · Phần 2: {interestResult.part2.referenceCode}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nộp lúc{' '}
                    {interestResult.submittedAt
                      ? new Date(interestResult.submittedAt).toLocaleString('vi-VN')
                      : '—'}
                    {interestResult.completeness === 'partial'
                      ? ` · còn ${interestResult.unansweredCount} câu chưa trả lời`
                      : ' · đủ 108 câu'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to="/kham-pha-so-thich/ket-qua">
                    <Button type="button" variant="outline" size="sm">
                      Xem kết quả
                    </Button>
                  </Link>
                  <Link to="/kham-pha-so-thich">
                    <Button type="button" variant="ghost" size="sm">
                      Làm lại
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                <p className="text-muted-foreground">
                  Bạn chưa làm bài khám phá sở thích. Bài gồm 108 câu, khoảng 12–15 phút.
                </p>
                <Link to="/kham-pha-so-thich">
                  <Button type="button" size="sm">
                    Bắt đầu
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phần 2: Điểm các môn trên lớp */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Điểm của các môn trên lớp
                </CardTitle>
                <CardDescription>
                  Danh sách môn học được chuẩn bị sẵn. Chọn lớp và loại điểm một lần, sau đó nhập điểm cho các môn cần thiết. Dữ liệu được dùng chung với Phân tích năng lực.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <AcademicScoresEditor
              scores={form.diem_lop}
              onChange={(scores) => setForm((prev) => ({ ...prev, diem_lop: scores }))}
              classLevel={academicClassLevel}
              onClassLevelChange={setAcademicClassLevel}
              term={academicTerm}
              onTermChange={setAcademicTerm}
            />
          </CardContent>
        </Card>

        {/* Điểm thi/dự kiến theo tổ hợp */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Điểm thi/dự kiến theo tổ hợp
                </CardTitle>
                <CardDescription>
                  Nhập tổng điểm 3 môn theo từng tổ hợp (thang 0–30) nếu bạn đã thi hoặc có điểm dự kiến. Đây là dữ liệu
                  tự khai, không phải điểm thi chính thức và không được quy đổi từ điểm học bạ.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddExamScore} className="h-8 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Thêm tổ hợp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {examError && <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">{examError}</div>}
            {examSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{examSuccess}</div>}
            {examScores.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Chưa có điểm thi/dự kiến. Không nhập cũng được; khi đó Phân tích năng lực sẽ hiện “Chưa đủ dữ liệu” thay
                vì tự suy đoán.
              </p>
            ) : (
              <div className="space-y-2">
                {examScores.map((row, index) => {
                  const option = examOptions.find((item) => item.block === row.block)
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border bg-slate-50/60 p-2.5">
                      <select
                        value={row.block}
                        onChange={(event) =>
                          setExamScores((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, block: event.target.value } : item
                            )
                          )
                        }
                        className="h-9 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="">-- Chọn tổ hợp --</option>
                        {examOptions.map((item) => (
                          <option key={item.block} value={item.block}>
                            {item.block} ({item.subjects.join(', ')})
                          </option>
                        ))}
                      </select>
                      <span className="hidden text-[11px] text-muted-foreground sm:inline">
                        {option ? option.subjects.join(' + ') : ''}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        step="0.01"
                        value={row.score}
                        onChange={(event) =>
                          setExamScores((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, score: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Tổng 0–30"
                        className="h-9 w-32 bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setExamScores((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-destructive"
                        title="Xoá tổ hợp này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleSaveExamScores} disabled={examSaving}>
              {examSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Lưu điểm thi theo tổ hợp
            </Button>
          </CardContent>
        </Card>

        {/* Phần 3: Chứng chỉ đã có */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-primary" />
                  Chứng chỉ bạn đã có (TSA, HSA, V-ACT, IELTS,...)
                </CardTitle>
                <CardDescription>
                  Ghi nhận các chứng chỉ đánh giá năng lực, chứng chỉ ngoại ngữ và mức điểm đã đạt.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCertificate}
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Thêm chứng chỉ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <datalist id="suggested-certificates">
              {SUGGESTED_CERTIFICATES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            {form.chung_chi.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                <Award className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p>Chưa có chứng chỉ nào được lưu.</p>
                <p className="text-xs text-muted-foreground">
                  Nhấn &ldquo;Thêm chứng chỉ&rdquo; để lưu các kết quả thi TSA, HSA, IELTS, v.v.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {form.chung_chi.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-md border bg-slate-50/60 p-2.5 transition hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <Input
                        list="suggested-certificates"
                        placeholder="Tên chứng chỉ (VD: IELTS, HSA, TSA, SAT...)"
                        value={item.loai}
                        onChange={(e) => handleUpdateCertificate(index, 'loai', e.target.value)}
                        className="bg-white text-sm"
                      />
                    </div>
                    <div className="w-36 sm:w-44">
                      <Input
                        placeholder="Mức điểm (VD: 7.5, 95/150)"
                        value={item.diem}
                        onChange={(e) => handleUpdateCertificate(index, 'diem', e.target.value)}
                        className="bg-white text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCertificate(index)}
                      className="rounded-md p-2 text-muted-foreground transition hover:bg-red-50 hover:text-destructive"
                      title="Xóa chứng chỉ này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phần: Chứng chỉ mong muốn có trong thời gian tới */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Chứng chỉ bạn mong muốn có trong thời gian tới (TSA, HSA, V-ACT, IELTS,...)
                </CardTitle>
                <CardDescription>
                  Ghi nhận mục tiêu các chứng chỉ đánh giá năng lực, chứng chỉ ngoại ngữ và mức điểm kỳ vọng trong tương lai.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDesiredCertificate}
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Thêm chứng chỉ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(form.chung_chi_mong_muon || []).length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p>Chưa có chứng chỉ mong muốn nào được lưu.</p>
                <p className="text-xs text-muted-foreground">
                  Nhấn &ldquo;Thêm chứng chỉ&rdquo; để lưu mục tiêu thi TSA, HSA, IELTS, v.v. trong thời gian tới.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(form.chung_chi_mong_muon || []).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-md border bg-slate-50/60 p-2.5 transition hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <Input
                        list="suggested-certificates"
                        placeholder="Tên chứng chỉ (VD: IELTS, HSA, TSA, SAT...)"
                        value={item.loai}
                        onChange={(e) => handleUpdateDesiredCertificate(index, 'loai', e.target.value)}
                        className="bg-white text-sm"
                      />
                    </div>
                    <div className="w-36 sm:w-44">
                      <Input
                        placeholder="Mức điểm mục tiêu (VD: 7.5, 95/150)"
                        value={item.diem}
                        onChange={(e) => handleUpdateDesiredCertificate(index, 'diem', e.target.value)}
                        className="bg-white text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDesiredCertificate(index)}
                      className="rounded-md p-2 text-muted-foreground transition hover:bg-red-50 hover:text-destructive"
                      title="Xóa chứng chỉ này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phần 4: Mục tiêu xét tuyển */}
        <Card className="relative z-20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Mục tiêu xét tuyển
            </CardTitle>
            <CardDescription>
              Chọn trường đại học và ngành nghề bạn ước mơ được theo học. Dữ liệu được liên kết trực tiếp với Phân tích năng lực.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TargetMajorSelector
              schoolValue={form.truong_muc_tieu}
              majorValue={form.nganh_muc_tieu}
              onChange={({ schoolName, majorName }) => {
                setForm((prev) => ({
                  ...prev,
                  truong_muc_tieu: schoolName,
                  nganh_muc_tieu: majorName,
                }))
              }}
              showAnalysisLink={true}
            />
          </CardContent>
        </Card>

        {/* Phần 5: Tổ hợp mong muốn thi THPTQG */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Tổ hợp mong muốn thi THPTQG (Chọn 3 môn)
            </CardTitle>
            <CardDescription>
              Bạn có thể nhấn chọn nhanh một tổ hợp chuẩn hoặc tự chọn 3 môn thi bất kỳ dưới đây.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gợi ý tổ hợp nhanh */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chọn nhanh tổ hợp phổ biến:
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_COMBINATIONS.map((combo) => {
                  const isSelected =
                    form.to_hop_mong_muon.length === 3 &&
                    combo.subjects.every((s) => form.to_hop_mong_muon.includes(s))
                  return (
                    <button
                      key={combo.code}
                      type="button"
                      onClick={() => handleSelectQuickCombination(combo.subjects)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                        isSelected
                          ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                          : 'border bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      )}
                    >
                      <span className="font-bold">{combo.code}</span> ({combo.subjects.join(', ')})
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Danh sách môn tích chọn */}
            <div className="rounded-lg border bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Danh sách môn thi ({form.to_hop_mong_muon.length}/3 môn đã chọn):
                </span>
                {form.to_hop_mong_muon.length === 3 && (
                  <span className="text-xs font-medium text-emerald-600">
                    ✓ Đã chọn đủ 3 môn
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {THPTQG_EXAM_SUBJECTS.map((subject) => {
                  const checked = form.to_hop_mong_muon.includes(subject)
                  const disabled = !checked && form.to_hop_mong_muon.length >= 3

                  return (
                    <label
                      key={subject}
                      className={cn(
                        'flex cursor-pointer select-none items-center gap-2 rounded-md border p-2 text-xs transition-colors',
                        checked
                          ? 'border-primary/40 bg-primary/10 font-semibold text-primary'
                          : disabled
                          ? 'cursor-not-allowed opacity-40 bg-white text-muted-foreground'
                          : 'bg-white text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleToggleExamSubject(subject)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span>{subject}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phần 6: Khác (Sở thích, tính cách,...) - Freestyle */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-primary" />
              Khác (Sở thích, tính cách, thế mạnh...)
            </CardTitle>
            <CardDescription>
              Lưu trữ tự do dưới dạng văn bản về tính cách, sở trường, sở thích, câu trả lời khảo sát từ quản trị viên (định dạng: Câu hỏi - Câu trả lời) hay những định hướng cá nhân của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              id="khac"
              rows={5}
              placeholder="Ví dụ: Đam mê công nghệ, thích tìm hiểu cách hoạt động của máy tính. Tính cách hướng nội, cẩn thận, thích làm việc với số liệu..."
              value={form.khac}
              onChange={(e) => setForm({ ...form, khac: e.target.value })}
              maxLength={5000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {form.khac.length}/5.000 ký tự
            </p>
          </CardContent>
        </Card>

        {/* Nút lưu */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" size="lg" disabled={saving} className="px-8 shadow-sm">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Lưu thông tin cá nhân
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Mục Quản lý tài khoản & Bảo mật */}
      <Card className="mt-8 border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-800">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Tài khoản & Bảo mật
          </CardTitle>
          <CardDescription className="text-xs">
            Quản lý trạng thái tài khoản và thông tin bảo mật của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{user?.username}</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Đang hoạt động
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mật khẩu: •••••••• (Định kỳ đổi mật khẩu để tăng cường an toàn tài khoản)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordModal(true)}
              className="shrink-0 gap-1.5 text-xs font-medium"
            >
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              Đổi mật khẩu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Đổi mật khẩu */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClosePasswordModal()
          }}
        >
          <div className="relative w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="change-password-modal-title" className="text-lg font-bold text-foreground">
                    Đổi mật khẩu tài khoản
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tài khoản: <span className="font-semibold text-foreground">{user?.username}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClosePasswordModal}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {passwordSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="modal-current-password">Mật khẩu hiện tại</Label>
                <Input
                  id="modal-current-password"
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu đang dùng"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                  required
                  maxLength={128}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modal-new-password">Mật khẩu mới</Label>
                <Input
                  id="modal-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  maxLength={128}
                />
                <p className="text-[11px] text-muted-foreground">
                  Tối thiểu 8 ký tự, có ít nhất một chữ cái và một chữ số.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modal-new-password-confirm">Xác nhận mật khẩu mới</Label>
                <Input
                  id="modal-new-password-confirm"
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu mới"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  maxLength={128}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showPasswords ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClosePasswordModal}
                  disabled={passwordSubmitting}
                >
                  {passwordSuccess ? 'Đóng' : 'Hủy'}
                </Button>
                {!passwordSuccess && (
                  <Button type="submit" size="sm" disabled={passwordSubmitting}>
                    {passwordSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {passwordSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
