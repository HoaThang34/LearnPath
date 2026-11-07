import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpenCheck,
  Search,
  Filter,
  GraduationCap,
  Layers,
  Clock,
  Award,
  ChevronRight,
  BookOpen,
  FileText,
  AlertCircle,
  Loader2,
  Building2,
  Sparkles,
  Gamepad2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  getCurriculums,
  getCurriculumSchools,
  getCurriculumMajors,
  getCurriculumDetail,
} from '@/lib/api'

export default function ChuongTrinhHoc() {
  const [schools, setSchools] = useState([])
  const [selectedSchool, setSelectedSchool] = useState('')
  const [majors, setMajors] = useState([])
  const [selectedMajor, setSelectedMajor] = useState('')

  const [curriculum, setCurriculum] = useState(null)
  const [allCurriculums, setAllCurriculums] = useState([])
  const [totalCount, setTotalCount] = useState(0)

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('semesters') // 'semesters' | 'content'

  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  // Load initial schools and list of curriculums
  useEffect(() => {
    let active = true
    const init = async () => {
      setLoading(true)
      setError('')
      try {
        const [schoolsRes, listRes] = await Promise.all([
          getCurriculumSchools(),
          getCurriculums({ limit: 100 }),
        ])
        if (!active) return
        setSchools(schoolsRes.data.data || [])
        setAllCurriculums(listRes.data.data || [])
        setTotalCount(listRes.data.total || 0)
      } catch (err) {
        if (!active) return
        console.error('[ChuongTrinhHoc] Error:', err.message)
        setError('Không thể tải dữ liệu chương trình học. Vui lòng thử lại sau.')
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  // When school changes, load majors for that school
  useEffect(() => {
    if (!selectedSchool) {
      setMajors([])
      setSelectedMajor('')
      setCurriculum(null)
      return
    }

    let active = true
    getCurriculumMajors(selectedSchool)
      .then((res) => {
        if (!active) return
        setMajors(res.data.data || [])
        setSelectedMajor('')
        setCurriculum(null)
      })
      .catch((err) => {
        if (!active) return
        console.error('[ChuongTrinhHoc] Error loading majors:', err.message)
      })

    return () => {
      active = false
    }
  }, [selectedSchool])

  // When major changes, load curriculum detail
  useEffect(() => {
    if (!selectedSchool || !selectedMajor) {
      setCurriculum(null)
      return
    }

    let active = true
    setLoadingDetail(true)
    getCurriculumDetail(selectedSchool, selectedMajor)
      .then((res) => {
        if (!active) return
        setCurriculum(res.data.data)
        // If no semesters but has markdown content, default to content tab
        if (
          (!res.data.data.semesters || res.data.data.semesters.length === 0) &&
          res.data.data.content
        ) {
          setActiveTab('content')
        } else {
          setActiveTab('semesters')
        }
      })
      .catch((err) => {
        if (!active) return
        console.error('[ChuongTrinhHoc] Error loading detail:', err.message)
      })
      .finally(() => {
        if (active) setLoadingDetail(false)
      })

    return () => {
      active = false
    }
  }, [selectedSchool, selectedMajor])

  // Filter curriculums for browsing list when no specific major is chosen
  const filteredCurriculums = useMemo(() => {
    return allCurriculums.filter((item) => {
      const matchesSchool =
        !selectedSchool ||
        item.schoolName.toLowerCase() === selectedSchool.toLowerCase()

      const s = search.trim().toLowerCase()
      const matchesSearch =
        !s ||
        item.schoolName.toLowerCase().includes(s) ||
        (item.schoolCode && item.schoolCode.toLowerCase().includes(s)) ||
        item.majorName.toLowerCase().includes(s) ||
        (item.majorCode && item.majorCode.toLowerCase().includes(s))

      return matchesSchool && matchesSearch
    })
  }, [allCurriculums, selectedSchool, search])

  // Quick select an item from the browse list
  const handleQuickSelect = (item) => {
    setSelectedSchool(item.schoolName)
    setSelectedMajor(item.majorName)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Summary stats of currently selected curriculum
  const curriculumStats = useMemo(() => {
    if (!curriculum || !Array.isArray(curriculum.semesters)) {
      return { totalSemesters: 0, totalCourses: 0, totalCredits: 0, requiredCredits: 0 }
    }
    let totalCourses = 0
    let totalCredits = 0
    let requiredCredits = 0

    for (const sem of curriculum.semesters) {
      for (const course of sem.courses || []) {
        totalCourses += 1
        const creds = Number(course.credits) || 0
        totalCredits += creds
        if (course.type === 'Bắt buộc' || course.type === 'Cơ sở ngành' || course.type === 'Đại cương') {
          requiredCredits += creds
        }
      }
    }

    return {
      totalSemesters: curriculum.semesters.length,
      totalCourses,
      totalCredits: curriculum.totalCredits || totalCredits,
      requiredCredits,
    }
  }, [curriculum])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Title & Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-5 sm:px-10 sm:py-10 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-2.5 sm:space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-sm border border-indigo-400/30">
            <BookOpenCheck className="h-4 w-4 text-indigo-300" /> Khung chương trình đào tạo đại học
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Chương trình học các Trường & Ngành
          </h1>
          <p className="text-xs sm:text-base text-slate-300">
            Tra cứu chi tiết lộ trình học tập, cấu trúc môn học theo từng kỳ và chuẩn đầu ra của các ngành đào tạo tại các trường đại học trên cả nước.
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Selection Card */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b pb-3">
            <Filter className="h-4 w-4 text-indigo-600" /> Chọn trường và ngành để xem khung chương trình
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-center">
            {/* 1. Chọn trường */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                1. Chọn trường đại học ({schools.length})
              </label>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Tất cả các trường --</option>
                {schools.map((s) => (
                  <option key={s.schoolName} value={s.schoolName}>
                    {s.schoolCode ? `[${s.schoolCode}] ` : ''}{s.schoolName} ({s.majorCount} ngành)
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Chọn ngành */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                2. Chọn ngành học {selectedSchool ? `(${majors.length})` : ''}
              </label>
              <select
                value={selectedMajor}
                onChange={(e) => setSelectedMajor(e.target.value)}
                disabled={!selectedSchool || majors.length === 0}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {!selectedSchool
                    ? '— Chọn trường trước —'
                    : majors.length === 0
                    ? '— Chưa có ngành nào —'
                    : '-- Chọn ngành học --'}
                </option>
                {majors.map((m) => (
                  <option key={m.id || m.majorName} value={m.majorName}>
                    {m.majorName} {m.majorCode ? `(${m.majorCode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tìm kiếm nhanh */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tìm kiếm nhanh
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tên trường, ngành..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm">Đang tải danh sách chương trình đào tạo...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 space-y-2">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <h3 className="font-semibold">{error}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-2 text-xs"
          >
            Tải lại trang
          </Button>
        </div>
      )}

      {/* EMPTY STATE: Database completely blank (as requested: initial data is empty for admin to add) */}
      {!loading && !error && totalCount === 0 && (
        <Card className="border-dashed border-2 border-slate-200 bg-white">
          <CardContent className="p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner">
              <BookOpenCheck className="h-8 w-8" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Chưa có dữ liệu chương trình học
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Hệ thống chương trình đào tạo hiện đang được ban quản trị cập nhật dữ liệu.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DETAIL VIEW: When a specific school + major is selected and loaded */}
      {!loading && !error && curriculum && (
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {curriculum.schoolCode && (
                      <span className="rounded bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                        {curriculum.schoolCode}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-indigo-900">
                      {curriculum.schoolName}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Ngành {curriculum.majorName}
                  </h2>
                  {curriculum.majorCode && (
                    <p className="text-xs font-mono text-slate-500">
                      Mã ngành: {curriculum.majorCode}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <div className="rounded-lg border bg-white px-3 py-2 text-center shadow-xs">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Hệ đào tạo</span>
                    <span className="text-sm font-bold text-indigo-700">{curriculum.degreeLevel || 'Đại học'}</span>
                  </div>
                  <div className="rounded-lg border bg-white px-3 py-2 text-center shadow-xs">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Thời gian</span>
                    <span className="text-sm font-bold text-slate-800">{curriculum.durationYears} năm</span>
                  </div>
                  {curriculum.totalCredits && (
                    <div className="rounded-lg border bg-white px-3 py-2 text-center shadow-xs">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Tín chỉ</span>
                      <span className="text-sm font-bold text-emerald-600">{curriculum.totalCredits} TC</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {curriculum.description && (
                <div className="mt-4 rounded-lg bg-white border p-3.5 text-xs text-slate-700 leading-relaxed shadow-xs">
                  <strong className="text-indigo-900">Giới thiệu ngành: </strong>
                  {curriculum.description}
                </div>
              )}

              {/* Quick Simulation Link Banner */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-cyan-950 border border-cyan-500/30 p-3.5 shadow-sm text-white">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-100">
                      Bạn muốn biết học ngành này ra trường thực tế sẽ làm gì?
                    </span>
                    <span className="text-[11px] text-slate-300">
                      Trực tiếp nhập vai kỹ sư giải quyết sự cố và lập trình dây chuyền tự động hóa.
                    </span>
                  </div>
                </div>
                <Link to={`/mo-phong-nghe-nghiep?major=${encodeURIComponent(curriculum.majorCode || 'EE-E1')}`}>
                  <Button
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md gap-1.5 whitespace-nowrap"
                  >
                    <Gamepad2 className="h-3.5 w-3.5" /> Trải nghiệm mô phỏng ngành này <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b bg-slate-50/50 px-3 sm:px-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('semesters')}
                className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'semesters'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" /> Khung môn học ({curriculumStats.totalSemesters} kỳ)
              </button>
              {curriculum.content && (
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === 'content'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0" /> Đề cương & Chi tiết đào tạo
                </button>
              )}
            </div>

            {/* Tab Contents */}
            <div className="p-3.5 sm:p-6">
              {activeTab === 'semesters' ? (
                Array.isArray(curriculum.semesters) && curriculum.semesters.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary bar */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-500">Tổng số học kỳ:</span>
                        <p className="text-base font-bold text-slate-900">{curriculumStats.totalSemesters} kỳ</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tổng số môn học:</span>
                        <p className="text-base font-bold text-slate-900">{curriculumStats.totalCourses} môn</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tổng tín chỉ tích lũy:</span>
                        <p className="text-base font-bold text-indigo-600">{curriculumStats.totalCredits} TC</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tín chỉ bắt buộc:</span>
                        <p className="text-base font-bold text-emerald-600">{curriculumStats.requiredCredits} TC</p>
                      </div>
                    </div>

                    {/* Semesters grid */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {curriculum.semesters.map((sem, sIdx) => {
                        const semCredits = (sem.courses || []).reduce(
                          (acc, c) => acc + (Number(c.credits) || 0),
                          0
                        )
                        return (
                          <div
                            key={sIdx}
                            className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                          >
                            <div className="flex items-center justify-between bg-slate-50/90 px-4 py-3 border-b">
                              <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                                  {sIdx + 1}
                                </span>
                                {sem.semester}
                              </span>
                              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                                {semCredits} tín chỉ ({sem.courses?.length || 0} môn)
                              </span>
                            </div>

                            <div className="divide-y divide-slate-100">
                              {(sem.courses || []).map((course, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="flex items-center justify-between p-3 text-xs hover:bg-slate-50/70 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <span className="font-mono text-[10px] text-slate-400 w-5 shrink-0">
                                      {cIdx + 1}
                                    </span>
                                    {course.code && (
                                      <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {course.code}
                                      </span>
                                    )}
                                    <span className="font-medium text-slate-800 truncate">
                                      {course.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                        course.type === 'Bắt buộc'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                          : course.type === 'Tự chọn'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {course.type}
                                    </span>
                                    <span className="font-bold text-slate-900 text-xs w-8 text-right">
                                      {course.credits} TC
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    Ngành này chưa được cập nhật danh sách môn học theo kỳ.
                  </div>
                )
              ) : (
                <div className="prose prose-slate max-w-none text-sm text-slate-700 bg-slate-50/50 p-6 rounded-xl border border-slate-200">
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {curriculum.content}
                  </Markdown>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* BROWSE ALL CURRICULUMS LIST: When user hasn't selected a major or wants to browse */}
      {!loading && !error && !curriculum && totalCount > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
              Danh sách chương trình học ({filteredCurriculums.length})
            </h3>
            {selectedSchool && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSchool('')}
                className="text-xs text-indigo-600 hover:underline"
              >
                Xem tất cả các trường
              </Button>
            )}
          </div>

          {filteredCurriculums.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Không tìm thấy chương trình học phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCurriculums.map((item) => {
                const semCount = Array.isArray(item.semesters) ? item.semesters.length : 0
                const courseCount = Array.isArray(item.semesters)
                  ? item.semesters.reduce((acc, s) => acc + (s.courses?.length || 0), 0)
                  : 0

                return (
                  <Card
                    key={item.id}
                    className="border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                    onClick={() => handleQuickSelect(item)}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                          {item.schoolCode || 'ĐH'}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {item.degreeLevel || 'Đại học'}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.majorName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {item.schoolName}
                        </p>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between border-t pt-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{item.durationYears} năm</span>
                        </div>
                        {semCount > 0 ? (
                          <div className="flex items-center gap-1 text-indigo-600 font-medium">
                            <Layers className="h-3.5 w-3.5" />
                            <span>{semCount} kỳ ({courseCount} môn)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Xem chi tiết</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
