import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  GraduationCap,
  Layers,
  Link2,
  Loader2,
  RotateCcw,
  School,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
  Flame,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import HotMajorBadge from '@/components/career/HotMajorBadge'
import { HOT_MAJORS, getHotMajorInfo, isHotMajor } from '@/lib/hotMajors'
import { getCareerTargetOptions } from '@/lib/api'
import { cn } from '@/lib/utils'

function removeVietnameseTones(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export default function TargetMajorSelector({
  schoolValue = '',
  majorValue = '',
  onChange,
  required = false,
  showAnalysisLink = false,
  disabled = false,
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [targets, setTargets] = useState([])
  const [isSchoolOpen, setIsSchoolOpen] = useState(false)
  const [isMajorOpen, setIsMajorOpen] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [majorSearch, setMajorSearch] = useState('')
  const [filterHotOnly, setFilterHotOnly] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)

  const schoolDropdownRef = useRef(null)
  const majorDropdownRef = useRef(null)
  const schoolSearchInputRef = useRef(null)
  const majorSearchInputRef = useRef(null)

  // Tải danh sách trường và ngành từ dữ liệu Phân tích năng lực
  useEffect(() => {
    let active = true
    setLoading(true)
    getCareerTargetOptions()
      .then((res) => {
        if (!active) return
        const list = res.data?.data?.targets || []
        setTargets(list)

        // Nếu đã có mục tiêu hiện tại trên server nhưng form chưa có, có thể dùng
        const currentTarget = res.data?.data?.currentTarget
        if (!schoolValue && !majorValue && currentTarget && onChange) {
          onChange({
            schoolName: currentTarget.schoolName || '',
            majorName: currentTarget.majorName || '',
            schoolCode: currentTarget.schoolCode || '',
            admissionBlock: currentTarget.admissionBlock || '',
            entryScore: currentTarget.entryScore || null,
          })
        }
      })
      .catch((err) => {
        if (!active) return
        console.error('Không thể tải danh sách mục tiêu xét tuyển:', err)
        setError('Không thể tải danh sách trường có sẵn. Bạn có thể nhập thủ công.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (schoolDropdownRef.current && !schoolDropdownRef.current.contains(e.target)) {
        setIsSchoolOpen(false)
      }
      if (majorDropdownRef.current && !majorDropdownRef.current.contains(e.target)) {
        setIsMajorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus ô tìm kiếm khi mở dropdown
  useEffect(() => {
    if (isSchoolOpen && schoolSearchInputRef.current) {
      schoolSearchInputRef.current.focus()
    }
  }, [isSchoolOpen])

  useEffect(() => {
    if (isMajorOpen && majorSearchInputRef.current) {
      majorSearchInputRef.current.focus()
    }
  }, [isMajorOpen])

  // Danh sách trường duy nhất kèm thông tin
  const schoolList = useMemo(() => {
    const map = new Map()
    for (const t of targets) {
      const name = t.schoolName
      if (!name) continue
      if (!map.has(name)) {
        map.set(name, {
          name,
          code: t.schoolCode || '',
          majorCount: 0,
        })
      }
      map.get(name).majorCount += 1
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [targets])

  // Lọc trường theo ô tìm kiếm
  const filteredSchools = useMemo(() => {
    const q = removeVietnameseTones(schoolSearch)
    if (!q) return schoolList
    return schoolList.filter((s) => {
      const nameNorm = removeVietnameseTones(s.name)
      const codeNorm = removeVietnameseTones(s.code)
      return nameNorm.includes(q) || codeNorm.includes(q)
    })
  }, [schoolList, schoolSearch])

  // Danh sách ngành của trường đã chọn (hoặc toàn bộ nếu chưa chọn trường)
  const availableMajors = useMemo(() => {
    if (!schoolValue) return []
    return targets
      .filter((t) => t.schoolName === schoolValue)
      .sort((a, b) => (a.majorName || '').localeCompare(b.majorName || '', 'vi'))
  }, [targets, schoolValue])

  // Lọc ngành theo ô tìm kiếm và bộ lọc ngành HOT
  const filteredMajors = useMemo(() => {
    let list = availableMajors
    if (filterHotOnly) {
      list = list.filter((m) => isHotMajor(m.majorName, m.entryScore))
    }
    const q = removeVietnameseTones(majorSearch)
    if (!q) return list
    return list.filter((m) => {
      const nameNorm = removeVietnameseTones(m.majorName)
      const groupNorm = removeVietnameseTones(m.majorGroup)
      const blockNorm = removeVietnameseTones(m.admissionBlock)
      return nameNorm.includes(q) || groupNorm.includes(q) || blockNorm.includes(q)
    })
  }, [availableMajors, majorSearch, filterHotOnly])

  // Chi tiết ngành mục tiêu đang chọn nếu khớp với catalog
  const matchedTarget = useMemo(() => {
    if (!schoolValue || !majorValue) return null
    return targets.find(
      (t) =>
        t.schoolName?.trim().toLowerCase() === schoolValue.trim().toLowerCase() &&
        t.majorName?.trim().toLowerCase() === majorValue.trim().toLowerCase()
    ) || null
  }, [targets, schoolValue, majorValue])

  // Xử lý khi chọn trường
  const handleSelectSchool = (school) => {
    setIsSchoolOpen(false)
    setSchoolSearch('')
    // Nếu trường mới không có ngành hiện tại, reset ngành
    const majorsAtNewSchool = targets.filter((t) => t.schoolName === school.name)
    const majorStillValid = majorsAtNewSchool.some((m) => m.majorName === majorValue)

    const nextMajor = majorStillValid ? majorValue : ''
    const matched = majorsAtNewSchool.find((m) => m.majorName === nextMajor)

    if (onChange) {
      onChange({
        schoolName: school.name,
        majorName: nextMajor,
        schoolCode: school.code,
        admissionBlock: matched?.admissionBlock || '',
        entryScore: matched?.entryScore || null,
        majorGroup: matched?.majorGroup || '',
      })
    }

    // Mở luôn dropdown ngành để người dùng chọn tiếp
    if (!nextMajor) {
      setTimeout(() => setIsMajorOpen(true), 120)
    }
  }

  // Xử lý khi chọn ngành
  const handleSelectMajor = (major) => {
    setIsMajorOpen(false)
    setMajorSearch('')
    if (onChange) {
      onChange({
        schoolName: major.schoolName,
        majorName: major.majorName,
        schoolCode: major.schoolCode,
        admissionBlock: major.admissionBlock || '',
        entryScore: major.entryScore || null,
        majorGroup: major.majorGroup || '',
      })
    }
  }

  // Xóa mục tiêu
  const handleClear = () => {
    setIsSchoolOpen(false)
    setIsMajorOpen(false)
    if (onChange) {
      onChange({
        schoolName: '',
        majorName: '',
        schoolCode: '',
        admissionBlock: '',
        entryScore: null,
        majorGroup: '',
      })
    }
  }

  // Xử lý nhập thủ công
  const handleManualChange = (field, value) => {
    if (!onChange) return
    if (field === 'school') {
      onChange({
        schoolName: value,
        majorName: majorValue,
        schoolCode: '',
        admissionBlock: '',
        entryScore: null,
      })
    } else {
      onChange({
        schoolName: schoolValue,
        majorName: value,
        schoolCode: '',
        admissionBlock: '',
        entryScore: null,
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Chuyển đổi chế độ: Chọn từ Phân tích năng lực vs Nhập tự do */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            {isManualMode
              ? 'Đang ở chế độ nhập tự do'
              : 'Dữ liệu được liên kết trực tiếp với Phân tích năng lực'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsManualMode((prev) => !prev)
            setIsSchoolOpen(false)
            setIsMajorOpen(false)
          }}
          className="text-xs font-medium text-primary hover:underline underline-offset-2 transition"
        >
          {isManualMode
            ? '← Quay lại chọn từ danh mục Phân tích năng lực'
            : 'Hoặc nhập thủ công nếu không có trong danh sách'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}

      {isManualMode ? (
        // Chế độ nhập tự do
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="manual_truong_muc_tieu" className="flex items-center gap-1.5">
              <School className="h-4 w-4 text-muted-foreground" />
              Trường đại học mục tiêu {required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="manual_truong_muc_tieu"
              placeholder="Ví dụ: Đại học Bách khoa Hà Nội"
              value={schoolValue}
              onChange={(e) => handleManualChange('school', e.target.value)}
              maxLength={255}
              disabled={disabled}
              required={required}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="manual_nganh_muc_tieu" className="flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-muted-foreground" />
              Ngành học mục tiêu {required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="manual_nganh_muc_tieu"
              placeholder="Ví dụ: Khoa học máy tính, Kỹ thuật điện..."
              value={majorValue}
              onChange={(e) => handleManualChange('major', e.target.value)}
              maxLength={255}
              disabled={disabled}
              required={required}
            />
          </div>

          {/* Gợi ý 10 ngành HOT xu hướng hàng đầu */}
          <div className="sm:col-span-2 rounded-xl border border-rose-200/80 dark:border-rose-950/60 bg-gradient-to-br from-rose-50/60 via-amber-50/30 to-background dark:from-rose-950/20 dark:via-background dark:to-background p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                <Flame className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                Gợi ý 10 ngành HOT xu hướng hàng đầu:
              </span>
              <span className="text-[11px] text-muted-foreground">Nhấp để điền nhanh</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HOT_MAJORS.map((hot) => {
                const isSelected = majorValue === hot.name
                return (
                  <button
                    key={hot.id}
                    type="button"
                    onClick={() => handleManualChange('major', hot.name)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition border',
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-background hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-rose-300 hover:text-rose-700'
                    )}
                  >
                    <span className="font-bold text-[10px] text-rose-500">#{hot.id}</span>
                    <span>{hot.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        // Chế độ chọn từ dữ liệu Phân tích năng lực
        <div className="grid gap-4 sm:grid-cols-2 relative">
          {/* Ô chọn Trường đại học */}
          <div className={cn('space-y-1.5 relative', isSchoolOpen ? 'z-50' : 'z-20')} ref={schoolDropdownRef}>
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <School className="h-4 w-4 text-primary" />
              <span>Trường đại học mục tiêu</span>
              {required && <span className="text-destructive">*</span>}
            </Label>

            <div className="relative">
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => {
                  setIsSchoolOpen((prev) => !prev)
                  setIsMajorOpen(false)
                }}
                className={cn(
                  'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left transition',
                  !schoolValue && 'text-muted-foreground',
                  isSchoolOpen && 'ring-2 ring-primary border-primary'
                )}
              >
                <span className="truncate">
                  {loading
                    ? 'Đang tải danh sách trường...'
                    : schoolValue || 'Chọn hoặc tìm trường đại học...'}
                </span>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2',
                      isSchoolOpen && 'rotate-180'
                    )}
                  />
                )}
              </button>

              {/* Popover danh sách trường */}
              {isSchoolOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[280px] sm:min-w-[360px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xl ring-1 ring-black/10 animate-in fade-in-0 zoom-in-95">
                  <div className="sticky top-0 bg-white dark:bg-slate-900 pb-2 z-10 border-b border-slate-100 dark:border-slate-800 mb-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={schoolSearchInputRef}
                        placeholder="Gõ tên trường hoặc mã (VD: Bách khoa, BKA)..."
                        value={schoolSearch}
                        onChange={(e) => setSchoolSearch(e.target.value)}
                        className="pl-8 h-9 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                      />
                      {schoolSearch && (
                        <button
                          type="button"
                          onClick={() => setSchoolSearch('')}
                          className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1 text-xs">
                    {filteredSchools.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">
                        <p>Không tìm thấy trường nào phù hợp.</p>
                        <p className="text-[11px] mt-1 text-muted-foreground/80">
                          Bạn có thể dùng nút &ldquo;nhập thủ công&rdquo; ở trên nếu trường chưa có trong hệ thống.
                        </p>
                      </div>
                    ) : (
                      filteredSchools.map((school) => {
                        const isSelected = school.name === schoolValue
                        return (
                          <button
                            key={school.name}
                            type="button"
                            onClick={() => handleSelectSchool(school)}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition',
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground font-semibold shadow-xs'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{school.name}</div>
                              <div
                                className={cn(
                                  'text-[10px] mt-0.5 flex items-center gap-1.5',
                                  isSelected ? 'text-white/80 dark:text-primary-foreground/80' : 'text-muted-foreground'
                                )}
                              >
                                {school.code && (
                                  <span
                                    className={cn(
                                      'font-mono font-semibold px-1 py-0.2 rounded',
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    )}
                                  >
                                    {school.code}
                                  </span>
                                )}
                                <span>{school.majorCount} ngành xét tuyển</span>
                              </div>
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ô chọn Ngành học mục tiêu */}
          <div className={cn('space-y-1.5 relative', isMajorOpen ? 'z-50' : 'z-10')} ref={majorDropdownRef}>
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Compass className="h-4 w-4 text-primary" />
              <span>Ngành xét tuyển mục tiêu</span>
              {required && <span className="text-destructive">*</span>}
            </Label>

            <div className="relative">
              <button
                type="button"
                disabled={disabled || loading || !schoolValue}
                onClick={() => {
                  if (!schoolValue) return
                  setIsMajorOpen((prev) => !prev)
                  setIsSchoolOpen(false)
                }}
                className={cn(
                  'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left transition',
                  (!majorValue || !schoolValue) && 'text-muted-foreground',
                  isMajorOpen && 'ring-2 ring-primary border-primary'
                )}
              >
                <span className="truncate">
                  {!schoolValue
                    ? 'Vui lòng chọn trường trước'
                    : majorValue || 'Chọn hoặc tìm kiếm ngành học...'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2',
                    isMajorOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Popover danh sách ngành */}
              {isMajorOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[300px] sm:min-w-[420px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xl ring-1 ring-black/10 animate-in fade-in-0 zoom-in-95">
                  <div className="sticky top-0 bg-white dark:bg-slate-900 pb-2 z-10 border-b border-slate-100 dark:border-slate-800 mb-1.5 space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={majorSearchInputRef}
                        placeholder={`Tìm ngành trong ${schoolValue}...`}
                        value={majorSearch}
                        onChange={(e) => setMajorSearch(e.target.value)}
                        className="pl-8 h-9 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                      />
                      {majorSearch && (
                        <button
                          type="button"
                          onClick={() => setMajorSearch('')}
                          className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={() => setFilterHotOnly((prev) => !prev)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition border',
                          filterHotOnly
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-rose-50/70 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                        )}
                      >
                        <Flame className="h-3 w-3 fill-rose-500 text-rose-500" />
                        <span>Chỉ ngành HOT (≥27đ)</span>
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        {filteredMajors.length} ngành
                      </span>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {filteredMajors.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">
                        <p>Không tìm thấy ngành phù hợp trong trường này.</p>
                      </div>
                    ) : (
                      filteredMajors.map((major) => {
                        const isSelected = major.majorName === majorValue
                        return (
                          <button
                            key={major.id || major.majorName}
                            type="button"
                            onClick={() => handleSelectMajor(major)}
                            className={cn(
                              'flex w-full items-start justify-between gap-2 rounded-lg p-2.5 text-left transition',
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground shadow-xs'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                                <span>{major.majorName}</span>
                                <HotMajorBadge majorName={major.majorName} entryScore={major.entryScore} variant="compact" />
                              </div>
                              <div
                                className={cn(
                                  'flex flex-wrap items-center gap-1.5 mt-1 text-[11px]',
                                  isSelected ? 'text-white/90 dark:text-primary-foreground/90' : 'text-muted-foreground'
                                )}
                              >
                                {major.admissionBlock && (
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 font-semibold',
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-primary/10 text-primary'
                                    )}
                                  >
                                    Khối {major.admissionBlock}
                                  </span>
                                )}
                                {major.entryScore !== null && major.entryScore !== undefined && (
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 font-medium',
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    )}
                                  >
                                    Điểm chuẩn 2025: {major.entryScore}đ
                                  </span>
                                )}
                                {major.majorGroup && (
                                  <span className="opacity-75">• {major.majorGroup}</span>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 mt-0.5" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thẻ hiển thị Mục tiêu đã liên kết */}
      {schoolValue && majorValue && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-background to-background p-4 shadow-sm transition">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/15 p-2 text-primary shrink-0 mt-0.5">
                <Target className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <Sparkles className="h-3 w-3" />
                    Đã liên kết với Phân tích năng lực
                  </span>
                  {matchedTarget?.schoolCode && (
                    <span className="font-mono text-xs font-semibold rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      Mã: {matchedTarget.schoolCode}
                    </span>
                  )}
                </div>

                <div className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2 flex-wrap">
                  <span>{majorValue}</span>
                  <HotMajorBadge majorName={majorValue} entryScore={matchedTarget?.entryScore} variant="pill" />
                </div>
                <HotMajorBadge majorName={majorValue} entryScore={matchedTarget?.entryScore} variant="full" className="mt-1" />
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5" />
                  <span>{schoolValue}</span>
                </div>

                {matchedTarget && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {matchedTarget.admissionBlock && (
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary text-[11px]">
                        <BookOpen className="h-3 w-3" />
                        Khối {matchedTarget.admissionBlock}
                      </span>
                    )}
                    {matchedTarget.entryScore !== null && matchedTarget.entryScore !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-400 text-[11px]">
                        <GraduationCap className="h-3 w-3" />
                        Điểm chuẩn 2025: {matchedTarget.entryScore}đ
                      </span>
                    )}
                    {matchedTarget.majorGroup && (
                      <span className="text-[11px] text-muted-foreground">
                        Nhóm: {matchedTarget.majorGroup}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {showAnalysisLink && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5"
                >
                  <Link to="/phan-tich-nang-luc">
                    <span>Xem phân tích</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Bỏ chọn mục tiêu này"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                <span>Đặt lại</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
