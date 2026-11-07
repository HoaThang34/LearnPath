import { useEffect, useState } from 'react'
import { Plus, Trash2, BookOpen, Layers, FileText, Eye, Code, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { getErrorMessage } from '@/lib/adminUtils'

export default function CurriculumFormDialog({
  open,
  initialData = null,
  options = { schools: [], majors: [] },
  onClose,
  onSave,
}) {
  const isEditing = Boolean(initialData?.id)

  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [isCustomSchool, setIsCustomSchool] = useState(false)

  const [majorName, setMajorName] = useState('')
  const [majorCode, setMajorCode] = useState('')
  const [isCustomMajor, setIsCustomMajor] = useState(false)

  const [degreeLevel, setDegreeLevel] = useState('Đại học')
  const [durationYears, setDurationYears] = useState(4)
  const [totalCredits, setTotalCredits] = useState('')
  const [description, setDescription] = useState('')

  const [curriculumTab, setCurriculumTab] = useState('semesters') // 'semesters' | 'content'
  const [semesters, setSemesters] = useState([])
  const [content, setContent] = useState('')
  const [previewContent, setPreviewContent] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    setError('')
    setBusy(false)
    setPreviewContent(false)

    if (initialData) {
      setSchoolName(initialData.schoolName || '')
      setSchoolCode(initialData.schoolCode || '')
      setIsCustomSchool(true)

      setMajorName(initialData.majorName || '')
      setMajorCode(initialData.majorCode || '')
      setIsCustomMajor(true)

      setDegreeLevel(initialData.degreeLevel || 'Đại học')
      setDurationYears(initialData.durationYears || 4)
      setTotalCredits(initialData.totalCredits != null ? String(initialData.totalCredits) : '')
      setDescription(initialData.description || '')

      setSemesters(
        Array.isArray(initialData.semesters) && initialData.semesters.length > 0
          ? JSON.parse(JSON.stringify(initialData.semesters))
          : []
      )
      setContent(initialData.content || '')
    } else {
      setSchoolName('')
      setSchoolCode('')
      setIsCustomSchool(false)

      setMajorName('')
      setMajorCode('')
      setIsCustomMajor(false)

      setDegreeLevel('Đại học')
      setDurationYears(4)
      setTotalCredits('')
      setDescription('')
      setSemesters([
        {
          semester: 'Học kỳ 1',
          courses: [
            { code: '', name: '', credits: 3, type: 'Bắt buộc' },
          ],
        },
      ])
      setContent('')
    }
  }, [open, initialData])

  // Filter available majors based on chosen school
  const filteredMajors = (options.majors || []).filter((m) => {
    if (!schoolName) return true
    return !m.schoolName || m.schoolName.toLowerCase() === schoolName.toLowerCase()
  })

  // Handle school dropdown selection
  const handleSelectSchool = (e) => {
    const val = e.target.value
    if (val === '__custom__') {
      setIsCustomSchool(true)
      setSchoolName('')
      setSchoolCode('')
    } else {
      setIsCustomSchool(false)
      const found = (options.schools || []).find((s) => s.name === val)
      setSchoolName(val)
      setSchoolCode(found?.code || '')
    }
  }

  // Handle major dropdown selection
  const handleSelectMajor = (e) => {
    const val = e.target.value
    if (val === '__custom__') {
      setIsCustomMajor(true)
      setMajorName('')
      setMajorCode('')
    } else {
      setIsCustomMajor(false)
      setMajorName(val)
    }
  }

  // Semester builder handlers
  const handleAddSemester = () => {
    const nextIdx = semesters.length + 1
    setSemesters([
      ...semesters,
      {
        semester: `Học kỳ ${nextIdx}`,
        courses: [{ code: '', name: '', credits: 3, type: 'Bắt buộc' }],
      },
    ])
  }

  const handleRemoveSemester = (sIdx) => {
    setSemesters(semesters.filter((_, idx) => idx !== sIdx))
  }

  const handleSemesterNameChange = (sIdx, value) => {
    setSemesters((prev) =>
      prev.map((sem, idx) => (idx === sIdx ? { ...sem, semester: value } : sem))
    )
  }

  const handleAddCourse = (sIdx) => {
    setSemesters((prev) =>
      prev.map((sem, idx) => {
        if (idx !== sIdx) return sem
        return {
          ...sem,
          courses: [
            ...sem.courses,
            { code: '', name: '', credits: 3, type: 'Bắt buộc' },
          ],
        }
      })
    )
  }

  const handleRemoveCourse = (sIdx, cIdx) => {
    setSemesters((prev) =>
      prev.map((sem, idx) => {
        if (idx !== sIdx) return sem
        return {
          ...sem,
          courses: sem.courses.filter((_, i) => i !== cIdx),
        }
      })
    )
  }

  const handleCourseChange = (sIdx, cIdx, field, value) => {
    setSemesters((prev) =>
      prev.map((sem, idx) => {
        if (idx !== sIdx) return sem
        const courses = sem.courses.map((course, i) => {
          if (i !== cIdx) return course
          return { ...course, [field]: value }
        })
        return { ...sem, courses }
      })
    )
  }

  // Calculate sum of credits from semesters
  const calculatedCredits = semesters.reduce((acc, sem) => {
    return (
      acc +
      (sem.courses || []).reduce((cAcc, c) => {
        const val = Number(c.credits) || 0
        return cAcc + val
      }, 0)
    )
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedSchool = schoolName.trim()
    const trimmedMajor = majorName.trim()

    if (!trimmedSchool) {
      setError('Vui lòng chọn hoặc nhập tên trường đại học.')
      return
    }
    if (!trimmedMajor) {
      setError('Vui lòng chọn hoặc nhập tên ngành học.')
      return
    }

    // Clean up semesters (filter empty course names)
    const cleanedSemesters = semesters
      .map((sem) => ({
        semester: sem.semester.trim(),
        courses: (sem.courses || [])
          .filter((c) => c.name && c.name.trim())
          .map((c) => ({
            code: (c.code || '').trim(),
            name: c.name.trim(),
            credits: Number(c.credits) || 0,
            type: c.type || 'Bắt buộc',
          })),
      }))
      .filter((sem) => sem.courses.length > 0)

    const payload = {
      schoolName: trimmedSchool,
      schoolCode: schoolCode.trim(),
      majorName: trimmedMajor,
      majorCode: majorCode.trim(),
      degreeLevel: degreeLevel.trim() || 'Đại học',
      durationYears: Number(durationYears) || 4,
      totalCredits: totalCredits !== '' ? Number(totalCredits) : (calculatedCredits > 0 ? calculatedCredits : null),
      description: description.trim(),
      content: content.trim(),
      semesters: cleanedSemesters,
    }

    setBusy(true)
    try {
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminDialog
      open={open}
      title={isEditing ? 'Chỉnh sửa chương trình học' : 'Thêm chương trình học mới'}
      description="Nhập thông tin theo thứ tự cấu trúc: Trường đại học -> Ngành học -> Khung chương trình học của ngành."
      onClose={busy ? undefined : onClose}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-slate-500">
            {calculatedCredits > 0 && `Tổng số tín chỉ tính toán theo kỳ: ${calculatedCredits}`}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : isEditing ? (
                'Cập nhật chương trình'
              ) : (
                'Thêm chương trình học'
              )}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 py-2">
        {error && <AdminAlert variant="error" message={error} />}

        {/* BƯỚC 1: TRƯỜNG ĐẠI HỌC */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                1
              </span>
              <Label className="text-sm font-semibold text-slate-900">
                Trường đại học <span className="text-red-500">*</span>
              </Label>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCustomSchool(!isCustomSchool)
                if (!isCustomSchool) {
                  setSchoolName('')
                  setSchoolCode('')
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              {isCustomSchool ? '← Chọn từ danh sách trường' : '+ Nhập trường mới tùy chỉnh'}
            </button>
          </div>

          {!isCustomSchool ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <select
                  value={schoolName}
                  onChange={handleSelectSchool}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn trường đại học --</option>
                  {(options.schools || []).map((s) => (
                    <option key={s.code ? `${s.code}-${s.name}` : s.name} value={s.name}>
                      {s.code ? `[${s.code}] ` : ''}{s.name}
                    </option>
                  ))}
                  <option value="__custom__">+ Nhập trường khác...</option>
                </select>
              </div>
              <div>
                <Input
                  placeholder="Mã trường"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  readOnly={!isCustomSchool}
                  className="bg-slate-100"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Tên trường đại học (VD: Trường Đại học Bách khoa Hà Nội)"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  placeholder="Mã trường (VD: BKA)"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* BƯỚC 2: NGÀNH HỌC */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                2
              </span>
              <Label className="text-sm font-semibold text-slate-900">
                Ngành học <span className="text-red-500">*</span>
              </Label>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCustomMajor(!isCustomMajor)
                if (!isCustomMajor) {
                  setMajorName('')
                  setMajorCode('')
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              {isCustomMajor ? '← Chọn từ danh sách ngành' : '+ Nhập ngành mới tùy chỉnh'}
            </button>
          </div>

          {!isCustomMajor ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <select
                  value={majorName}
                  onChange={handleSelectMajor}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn ngành học --</option>
                  {filteredMajors.map((m, idx) => (
                    <option key={`${m.name}-${idx}`} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                  <option value="__custom__">+ Nhập ngành khác...</option>
                </select>
              </div>
              <div>
                <Input
                  placeholder="Mã ngành (tùy chọn)"
                  value={majorCode}
                  onChange={(e) => setMajorCode(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Tên ngành học (VD: Khoa học máy tính)"
                  value={majorName}
                  onChange={(e) => setMajorName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  placeholder="Mã ngành (VD: IT1 hoặc 7480201)"
                  value={majorCode}
                  onChange={(e) => setMajorCode(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* BƯỚC 3: THÔNG TIN CHUNG */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-900">
            3. Thông tin đào tạo chung
          </Label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-slate-600">Hệ đào tạo</Label>
              <select
                value={degreeLevel}
                onChange={(e) => setDegreeLevel(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Đại học">Đại học</option>
                <option value="Cử nhân">Cử nhân</option>
                <option value="Kỹ sư">Kỹ sư</option>
                <option value="Chương trình tiên tiến">Chương trình tiên tiến</option>
                <option value="Chất lượng cao">Chất lượng cao</option>
                <option value="Thạc sĩ">Thạc sĩ</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Thời gian đào tạo (năm)</Label>
              <Input
                type="number"
                step="0.5"
                min="1"
                max="10"
                value={durationYears}
                onChange={(e) => setDurationYears(e.target.value)}
                className="mt-1"
                placeholder="4"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Tổng số tín chỉ</Label>
              <Input
                type="number"
                min="0"
                max="500"
                value={totalCredits}
                onChange={(e) => setTotalCredits(e.target.value)}
                className="mt-1"
                placeholder={calculatedCredits > 0 ? String(calculatedCredits) : 'VD: 135'}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Mô tả / Giới thiệu tổng quan ngành học</Label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu sơ lược về ngành, mục tiêu đào tạo, cơ hội nghề nghiệp sau khi tốt nghiệp..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* BƯỚC 4: CHƯƠNG TRÌNH HỌC CHI TIẾT */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <Label className="text-sm font-semibold text-slate-900">
              4. Khung chương trình học của ngành
            </Label>
            <div className="flex items-center gap-1 rounded-lg border bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCurriculumTab('semesters')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  curriculumTab === 'semesters'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Cấu trúc học kỳ & môn học ({semesters.length} kỳ)
              </button>
              <button
                type="button"
                onClick={() => setCurriculumTab('content')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  curriculumTab === 'content'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Nội dung chi tiết / Markdown
              </button>
            </div>
          </div>

          {curriculumTab === 'semesters' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Thêm các học kỳ và danh sách môn học thuộc từng học kỳ.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSemester}
                  className="text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Thêm học kỳ
                </Button>
              </div>

              {semesters.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Chưa có học kỳ nào. Nhấn "+ Thêm học kỳ" để bắt đầu xây dựng khung chương trình.
                </div>
              ) : (
                <div className="space-y-4">
                  {semesters.map((sem, sIdx) => {
                    const semCredits = (sem.courses || []).reduce(
                      (acc, c) => acc + (Number(c.credits) || 0),
                      0
                    )
                    return (
                      <div
                        key={sIdx}
                        className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3 border-b pb-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={sem.semester}
                              onChange={(e) => handleSemesterNameChange(sIdx, e.target.value)}
                              className="h-8 w-44 font-semibold text-slate-800"
                              placeholder={`Học kỳ ${sIdx + 1}`}
                            />
                            <span className="text-xs text-slate-500">
                              · {semCredits} tín chỉ ({sem.courses?.length || 0} môn)
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddCourse(sIdx)}
                              className="h-7 text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              <Plus className="mr-1 h-3 w-3" /> Thêm môn
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSemester(sIdx)}
                              className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Danh sách môn trong kỳ */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-12 gap-2 text-[11px] font-medium text-slate-500 px-1">
                            <div className="col-span-2">Mã môn</div>
                            <div className="col-span-5">Tên môn học <span className="text-red-500">*</span></div>
                            <div className="col-span-2 text-center">Tín chỉ</div>
                            <div className="col-span-2">Loại môn</div>
                            <div className="col-span-1"></div>
                          </div>
                          {(sem.courses || []).map((course, cIdx) => (
                            <div
                              key={cIdx}
                              className="grid grid-cols-12 items-center gap-2 rounded bg-slate-50 p-1"
                            >
                              <div className="col-span-2">
                                <Input
                                  value={course.code || ''}
                                  onChange={(e) =>
                                    handleCourseChange(sIdx, cIdx, 'code', e.target.value)
                                  }
                                  placeholder="Mã môn"
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div className="col-span-5">
                                <Input
                                  value={course.name || ''}
                                  onChange={(e) =>
                                    handleCourseChange(sIdx, cIdx, 'name', e.target.value)
                                  }
                                  placeholder="Tên môn học (bắt buộc)"
                                  className="h-7 text-xs"
                                  required
                                />
                              </div>
                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="30"
                                  value={course.credits}
                                  onChange={(e) =>
                                    handleCourseChange(sIdx, cIdx, 'credits', e.target.value)
                                  }
                                  className="h-7 text-center text-xs"
                                />
                              </div>
                              <div className="col-span-2">
                                <select
                                  value={course.type || 'Bắt buộc'}
                                  onChange={(e) =>
                                    handleCourseChange(sIdx, cIdx, 'type', e.target.value)
                                  }
                                  className="h-7 w-full rounded border border-slate-300 bg-white px-1 text-xs"
                                >
                                  <option value="Bắt buộc">Bắt buộc</option>
                                  <option value="Tự chọn">Tự chọn</option>
                                  <option value="Đại cương">Đại cương</option>
                                  <option value="Cơ sở ngành">Cơ sở ngành</option>
                                  <option value="Chuyên ngành">Chuyên ngành</option>
                                  <option value="Thực tập/Đồ án">Thực tập/Đồ án</option>
                                </select>
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCourse(sIdx, cIdx)}
                                  className="text-slate-400 hover:text-red-500"
                                  title="Xóa môn học này"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Nội dung chi tiết, khung chuẩn đầu ra, điều kiện tốt nghiệp (định dạng Markdown).
                </p>
                <button
                  type="button"
                  onClick={() => setPreviewContent(!previewContent)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  {previewContent ? (
                    <>
                      <Code className="h-3.5 w-3.5" /> Chế độ soạn thảo
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Xem trước định dạng
                    </>
                  )}
                </button>
              </div>

              {previewContent ? (
                <div className="max-h-72 min-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-4 prose prose-sm max-w-none">
                  {content ? (
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {content}
                    </Markdown>
                  ) : (
                    <span className="text-xs italic text-slate-400">
                      Chưa có nội dung văn bản.
                    </span>
                  )}
                </div>
              ) : (
                <textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="## 1. Mục tiêu đào tạo&#10;- Trang bị kiến thức...&#10;&#10;## 2. Khung chương trình chi tiết&#10;| Học kỳ | Môn học | Tín chỉ |&#10;| --- | --- | --- |&#10;| Kỳ 1 | Giải tích 1 | 4 |&#10;&#10;## 3. Điều kiện tốt nghiệp&#10;- Tích lũy tối thiểu 135 tín chỉ..."
                  className="w-full rounded-md border border-slate-300 font-mono text-xs p-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>
          )}
        </div>
      </form>
    </AdminDialog>
  )
}
