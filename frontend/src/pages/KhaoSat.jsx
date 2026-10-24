import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  School,
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
import { getSurveyQuestions, getUserProfile, submitSurvey } from '@/lib/api'
import { cn } from '@/lib/utils'

const SUGGESTED_SUBJECTS = [
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
  'Giáo dục kinh tế và pháp luật',
]

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

export default function KhaoSat() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Danh sách câu hỏi custom của admin
  const [customQuestions, setCustomQuestions] = useState([])
  const [customAnswers, setCustomAnswers] = useState({})

  // Form câu hỏi cố định
  const [form, setForm] = useState({
    ho_va_ten: '',
    lop: '',
    truong: '',
    truong_muc_tieu: '',
    nganh_muc_tieu: '',
    to_hop_mong_muon: [],
    diem_lop: [],
    chung_chi: [],
    khac: '',
  })

  // State thêm điểm môn học
  const [newMon, setNewMon] = useState('')
  const [newDiem, setNewDiem] = useState('')

  // State thêm chứng chỉ
  const [newCertLoai, setNewCertLoai] = useState('')
  const [newCertDiem, setNewCertDiem] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      getSurveyQuestions().catch((err) => {
        console.error('Không thể tải câu hỏi khảo sát bổ sung:', err)
        return { data: { data: { questions: [] } } }
      }),
      getUserProfile().catch(() => ({ data: { data: { profile: null } } })),
    ])
      .then(([questionsRes, profileRes]) => {
        if (!active) return

        const questions = questionsRes.data?.data?.questions || []
        setCustomQuestions(questions)

        const existingProfile = profileRes.data?.data?.profile
        if (existingProfile) {
          setForm({
            ho_va_ten: existingProfile.ho_va_ten || '',
            lop: existingProfile.lop || '',
            truong: existingProfile.truong || '',
            truong_muc_tieu: existingProfile.truong_muc_tieu || '',
            nganh_muc_tieu: existingProfile.nganh_muc_tieu || '',
            to_hop_mong_muon: Array.isArray(existingProfile.to_hop_mong_muon)
              ? existingProfile.to_hop_mong_muon
              : [],
            diem_lop: Array.isArray(existingProfile.diem_lop)
              ? existingProfile.diem_lop
              : [],
            chung_chi: Array.isArray(existingProfile.chung_chi)
              ? existingProfile.chung_chi
              : [],
            khac: existingProfile.khac || '',
          })
        }
      })
      .catch((err) => {
        if (!active) return
        setError('Không thể tải dữ liệu khảo sát. Vui lòng tải lại trang.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Xử lý chọn môn tổ hợp
  const toggleSubject = (sub) => {
    setForm((prev) => {
      const current = prev.to_hop_mong_muon || []
      if (current.includes(sub)) {
        return { ...prev, to_hop_mong_muon: current.filter((s) => s !== sub) }
      }
      if (current.length >= 3) {
        return prev
      }
      return { ...prev, to_hop_mong_muon: [...current, sub] }
    })
  }

  const applyQuickCombination = (combo) => {
    setForm((prev) => ({ ...prev, to_hop_mong_muon: [...combo.subjects] }))
  }

  // Thêm điểm môn học
  const handleAddDiemLop = () => {
    if (!newMon.trim()) return
    const parsed = Number(newDiem)
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      alert('Điểm số phải là số hợp lệ từ 0 đến 10.')
      return
    }

    setForm((prev) => {
      const filtered = prev.diem_lop.filter((d) => d.mon !== newMon.trim())
      return {
        ...prev,
        diem_lop: [...filtered, { mon: newMon.trim(), diem: Math.round(parsed * 100) / 100 }],
      }
    })
    setNewMon('')
    setNewDiem('')
  }

  const handleRemoveDiemLop = (mon) => {
    setForm((prev) => ({
      ...prev,
      diem_lop: prev.diem_lop.filter((d) => d.mon !== mon),
    }))
  }

  // Thêm chứng chỉ
  const handleAddChungChi = () => {
    if (!newCertLoai.trim()) return
    setForm((prev) => {
      const filtered = prev.chung_chi.filter((c) => c.loai !== newCertLoai.trim())
      return {
        ...prev,
        chung_chi: [
          ...filtered,
          { loai: newCertLoai.trim(), diem: newCertDiem.trim() || 'Đã có' },
        ],
      }
    })
    setNewCertLoai('')
    setNewCertDiem('')
  }

  const handleRemoveChungChi = (loai) => {
    setForm((prev) => ({
      ...prev,
      chung_chi: prev.chung_chi.filter((c) => c.loai !== loai),
    }))
  }

  // Gửi bài khảo sát
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate cố định
    if (!form.ho_va_ten.trim()) {
      setError('Vui lòng nhập Họ và tên.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!form.lop.trim()) {
      setError('Vui lòng nhập Lớp của bạn.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!form.truong.trim()) {
      setError('Vui lòng nhập Trường THPT bạn đang theo học.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!form.truong_muc_tieu.trim()) {
      setError('Vui lòng nhập Trường đại học mục tiêu.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!form.nganh_muc_tieu.trim()) {
      setError('Vui lòng nhập Ngành xét tuyển mục tiêu.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (form.to_hop_mong_muon.length !== 3) {
      setError('Vui lòng chọn đúng 3 môn thi THPTQG cho tổ hợp mong muốn.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Validate câu hỏi custom bắt buộc
    for (const q of customQuestions) {
      if (q.isRequired) {
        const val = customAnswers[q.id]?.trim()
        if (!val) {
          setError(`Vui lòng trả lời câu hỏi bắt buộc: "${q.question}".`)
          return
        }
      }
    }

    // Chuẩn bị custom_answers mảng
    const customAnswersArray = customQuestions.map((q) => ({
      id: q.id,
      question: q.question,
      answer: customAnswers[q.id]?.trim() || '',
    }))

    setSubmitting(true)
    try {
      const payload = {
        ho_va_ten: form.ho_va_ten.trim(),
        lop: form.lop.trim(),
        truong: form.truong.trim(),
        truong_muc_tieu: form.truong_muc_tieu.trim(),
        nganh_muc_tieu: form.nganh_muc_tieu.trim(),
        to_hop_mong_muon: form.to_hop_mong_muon,
        diem_lop: form.diem_lop,
        chung_chi: form.chung_chi,
        custom_answers: customAnswersArray,
        khac: form.khac,
      }

      await submitSurvey(payload)
      setSuccess(true)

      // Cập nhật session user trong state nếu có
      if (user) {
        user.surveyCompleted = true
      }

      setTimeout(() => {
        navigate('/thong-tin-ca-nhan')
      }, 1500)
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Không thể hoàn thành khảo sát. Vui lòng kiểm tra lại thông tin và thử lại.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Đang chuẩn bị nội dung khảo sát...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6 sm:p-8 border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Khảo sát khởi đầu</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Khảo sát thông tin tuyển sinh
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Dành 1-2 phút hoàn thiện mục tiêu xét tuyển và học lực để LearnPath cá nhân hóa
              trải nghiệm tra cứu, so sánh điểm chuẩn và gợi ý thông tin phù hợp nhất cho bạn!
            </p>
          </div>

          <div className="flex shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              Tạm bỏ qua & về trang chủ
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        {user?.surveyCompleted && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Tài khoản của bạn đã hoàn thành khảo sát trước đó. Bạn có thể xem lại hoặc chỉnh sửa
              thông tin tại{' '}
              <Link to="/thong-tin-ca-nhan" className="font-semibold underline">
                Trang Thông tin cá nhân
              </Link>{' '}
              hoặc cập nhật lại tại biểu mẫu này.
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>
            Khảo sát đã được lưu thành công! Đang chuyển hướng bạn đến trang Thông tin cá nhân...
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Phần 1: Thông tin học sinh */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <User className="h-4 w-4" />
              <span>Phần 1</span>
            </div>
            <CardTitle className="text-xl">Thông tin học sinh</CardTitle>
            <CardDescription>
              Các thông tin cơ bản giúp hệ thống nhận diện và hiển thị trong hồ sơ của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ho_va_ten">
                  Họ và tên <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ho_va_ten"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={form.ho_va_ten}
                  onChange={(e) => setForm({ ...form, ho_va_ten: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lop">
                  Lớp đang học <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lop"
                  placeholder="Ví dụ: 12A1, 12 Chuyên Toán..."
                  value={form.lop}
                  onChange={(e) => setForm({ ...form, lop: e.target.value })}
                  maxLength={64}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="truong">
                  Trường THPT <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="truong"
                  placeholder="Ví dụ: THPT Chu Văn An"
                  value={form.truong}
                  onChange={(e) => setForm({ ...form, truong: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phần 2: Mục tiêu xét tuyển */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Target className="h-4 w-4" />
              <span>Phần 2</span>
            </div>
            <CardTitle className="text-xl">Mục tiêu xét tuyển đại học</CardTitle>
            <CardDescription>
              Trường và ngành học bạn mong muốn trúng tuyển nhất trong kỳ thi tuyển sinh tới.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="truong_muc_tieu">
                  Trường đại học mục tiêu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="truong_muc_tieu"
                  placeholder="Ví dụ: Đại học Bách khoa Hà Nội"
                  value={form.truong_muc_tieu}
                  onChange={(e) => setForm({ ...form, truong_muc_tieu: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nganh_muc_tieu">
                  Ngành học mục tiêu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nganh_muc_tieu"
                  placeholder="Ví dụ: Khoa học máy tính, Kỹ thuật điện..."
                  value={form.nganh_muc_tieu}
                  onChange={(e) => setForm({ ...form, nganh_muc_tieu: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>
            </div>

            {/* Tổ hợp môn mong muốn */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <Label className="text-sm font-semibold">
                  Tổ hợp môn mong muốn thi THPTQG <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  Đã chọn: <span className="font-bold text-primary">{form.to_hop_mong_muon.length}/3 môn</span>
                </span>
              </div>

              {/* Gợi ý khối nhanh */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Chọn nhanh khối xét tuyển phổ biến:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_COMBINATIONS.map((combo) => (
                    <button
                      key={combo.code}
                      type="button"
                      onClick={() => applyQuickCombination(combo)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-semibold transition-all border',
                        form.to_hop_mong_muon.length === 3 &&
                          combo.subjects.every((s) => form.to_hop_mong_muon.includes(s))
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                      )}
                    >
                      {combo.code} ({combo.subjects.join(' - ')})
                    </button>
                  ))}
                </div>
              </div>

              {/* Danh sách 11 môn thi THPTQG */}
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-muted-foreground font-medium">Hoặc chọn từng môn thi:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THPTQG_EXAM_SUBJECTS.map((sub) => {
                    const isSelected = form.to_hop_mong_muon.includes(sub)
                    const isFull = form.to_hop_mong_muon.length >= 3 && !isSelected
                    return (
                      <button
                        key={sub}
                        type="button"
                        disabled={isFull}
                        onClick={() => toggleSubject(sub)}
                        className={cn(
                          'flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : isFull
                            ? 'opacity-40 cursor-not-allowed border-border bg-background'
                            : 'border-border bg-background hover:bg-muted/50 text-foreground'
                        )}
                      >
                        <span className="truncate">{sub}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phần 3: Kết quả học tập & Chứng chỉ (Tùy chọn) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <BookOpen className="h-4 w-4" />
                <span>Phần 3</span>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                Không bắt buộc điền
              </span>
            </div>
            <CardTitle className="text-xl">Điểm học tập & Chứng chỉ</CardTitle>
            <CardDescription>
              Nếu đã có điểm học bạ hoặc chứng chỉ ngoại ngữ / ĐGNL, bạn có thể điền để lưu hồ sơ. Có thể bỏ qua và cập nhật sau.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Điểm các môn */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span>Điểm các môn trên lớp (Học bạ):</span>
                <span className="text-xs text-muted-foreground font-normal">Tùy chọn</span>
              </Label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Tên môn (Toán, Văn, Anh...)"
                    value={newMon}
                    onChange={(e) => setNewMon(e.target.value)}
                    list="suggested-subjects-list"
                  />
                  <datalist id="suggested-subjects-list">
                    {SUGGESTED_SUBJECTS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="w-full sm:w-32">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="Điểm (0-10)"
                    value={newDiem}
                    onChange={(e) => setNewDiem(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddDiemLop}>
                  <Plus className="mr-1 h-4 w-4" /> Thêm môn
                </Button>
              </div>

              {form.diem_lop.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.diem_lop.map((item) => (
                    <span
                      key={item.mon}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium"
                    >
                      <span className="text-muted-foreground">{item.mon}:</span>
                      <strong className="text-foreground">{item.diem}</strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveDiemLop(item.mon)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Chứng chỉ */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span>Chứng chỉ ngoại ngữ & ĐGNL đã có:</span>
                <span className="text-xs text-muted-foreground font-normal">Tùy chọn</span>
              </Label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Loại chứng chỉ (IELTS, TSA, HSA...)"
                    value={newCertLoai}
                    onChange={(e) => setNewCertLoai(e.target.value)}
                    list="suggested-certs-list"
                  />
                  <datalist id="suggested-certs-list">
                    {SUGGESTED_CERTIFICATES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="w-full sm:w-48">
                  <Input
                    placeholder="Kết quả / Điểm đạt được"
                    value={newCertDiem}
                    onChange={(e) => setNewCertDiem(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddChungChi}>
                  <Plus className="mr-1 h-4 w-4" /> Thêm CC
                </Button>
              </div>

              {form.chung_chi.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.chung_chi.map((item) => (
                    <span
                      key={item.loai}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>{item.loai}:</span>
                      <strong>{item.diem}</strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveChungChi(item.loai)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Phần 4: Câu hỏi thêm từ Quản trị viên (nếu có) */}
        {customQuestions.length > 0 && (
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <FileQuestion className="h-4 w-4" />
                <span>Phần 4</span>
              </div>
              <CardTitle className="text-xl">Câu hỏi khảo sát bổ sung</CardTitle>
              <CardDescription>
                Những câu hỏi này sẽ giúp LearnPath hiểu rõ hơn về bạn giúp cá nhân hóa trải nghiệm. Hãy trả lời ngay nhé!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customQuestions.map((q, index) => {
                const answer = customAnswers[q.id] || ''
                return (
                  <div key={q.id} className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
                    <Label htmlFor={`custom_q_${q.id}`} className="text-sm font-semibold flex items-center gap-1.5">
                      <span>
                        {index + 1}. {q.question}
                      </span>
                      {q.isRequired && <span className="text-destructive">*</span>}
                    </Label>

                    {q.questionType === 'textarea' ? (
                      <textarea
                        id={`custom_q_${q.id}`}
                        rows={3}
                        placeholder={q.placeholder || 'Nhập câu trả lời của bạn...'}
                        value={answer}
                        onChange={(e) =>
                          setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })
                        }
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        required={q.isRequired}
                      />
                    ) : (
                      <Input
                        id={`custom_q_${q.id}`}
                        placeholder={q.placeholder || 'Nhập câu trả lời của bạn...'}
                        value={answer}
                        onChange={(e) =>
                          setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })
                        }
                        required={q.isRequired}
                      />
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Nút nộp */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            disabled={submitting}
          >
            Tạm bỏ qua & về trang chủ
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 font-semibold shadow-md"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu khảo sát...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Hoàn thành khảo sát
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
