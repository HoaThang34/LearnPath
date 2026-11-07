import { useEffect, useState, useMemo } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  Layers,
  GraduationCap,
  Clock,
  Award,
  Loader2,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AdminAlert from './AdminAlert'
import ConfirmDialog from './ConfirmDialog'
import CurriculumFormDialog from './CurriculumFormDialog'
import AdminDialog from './AdminDialog'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  getAdminCurriculums,
  getAdminCurriculumOptions,
  createAdminCurriculum,
  updateAdminCurriculum,
  deleteAdminCurriculum,
} from '@/lib/adminApi'
import { getErrorMessage } from '@/lib/adminUtils'

export default function CurriculumPanel({ admin }) {
  const [items, setItems] = useState([])
  const [options, setOptions] = useState({ schools: [], majors: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)
  const [previewItem, setPreviewItem] = useState(null)

  // Success alert
  const [successMessage, setSuccessMessage] = useState('')

  const fetchCurriculums = async () => {
    setLoading(true)
    setError('')
    try {
      const [curriculumsRes, optionsRes] = await Promise.all([
        getAdminCurriculums({ limit: 100 }),
        getAdminCurriculumOptions(),
      ])
      setItems(curriculumsRes.data.data || [])
      setOptions(optionsRes.data.data || { schools: [], majors: [] })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurriculums()
  }, [])

  // Filter items locally based on search & selectedSchool
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
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
  }, [items, search, selectedSchool])

  // Get distinct schools in current items for the filter
  const schoolFilters = useMemo(() => {
    const set = new Set()
    for (const item of items) {
      if (item.schoolName) set.add(item.schoolName)
    }
    return Array.from(set).sort()
  }, [items])

  const handleCreateNew = () => {
    setEditingItem(null)
    setFormOpen(true)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormOpen(true)
  }

  const handleSave = async (payload) => {
    if (editingItem?.id) {
      const res = await updateAdminCurriculum(editingItem.id, payload)
      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? res.data.data : it))
      )
      setSuccessMessage(`Đã cập nhật chương trình học ngành "${payload.majorName}".`)
    } else {
      const res = await createAdminCurriculum(payload)
      setItems((prev) => [res.data.data, ...prev])
      setSuccessMessage(`Đã thêm mới chương trình học ngành "${payload.majorName}".`)
    }
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingItem?.id) return
    await deleteAdminCurriculum(deletingItem.id)
    setItems((prev) => prev.filter((it) => it.id !== deletingItem.id))
    setSuccessMessage(`Đã xóa chương trình học ngành "${deletingItem.majorName}".`)
    setDeletingItem(null)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý chương trình học
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cấu hình khung chương trình đào tạo của các ngành và trường đại học theo cấu trúc:{' '}
            <span className="font-semibold text-slate-700">Trường → Ngành → Chương trình học</span>.
          </p>
        </div>
        <Button
          onClick={handleCreateNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" /> Thêm chương trình học
        </Button>
      </div>

      {successMessage && (
        <AdminAlert variant="success" message={successMessage} />
      )}
      {error && <AdminAlert variant="error" message={error} />}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Tìm theo tên trường, mã trường, tên ngành hoặc mã ngành..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500 shrink-0" />
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Tất cả các trường ({schoolFilters.length})</option>
            {schoolFilters.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Đang tải dữ liệu chương trình học...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            {items.length === 0
              ? 'Chưa có chương trình học nào'
              : 'Không tìm thấy kết quả phù hợp'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {items.length === 0
              ? 'Cơ sở dữ liệu chương trình học hiện đang để trống. Quản trị viên có thể thêm mới theo cấu trúc: Trường -> Ngành -> Chương trình học của ngành.'
              : 'Thử điều chỉnh lại từ khóa tìm kiếm hoặc bỏ chọn bộ lọc trường để xem toàn bộ danh sách.'}
          </p>
          {items.length === 0 && (
            <div className="mt-6">
              <Button
                onClick={handleCreateNew}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" /> Bắt đầu thêm chương trình học
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3.5">Trường đại học</th>
                <th scope="col" className="px-4 py-3.5">Ngành học</th>
                <th scope="col" className="px-4 py-3.5">Hệ & Thời gian</th>
                <th scope="col" className="px-4 py-3.5 text-center">Cấu trúc</th>
                <th scope="col" className="px-4 py-3.5">Cập nhật</th>
                <th scope="col" className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const semesterCount = Array.isArray(item.semesters) ? item.semesters.length : 0
                const courseCount = Array.isArray(item.semesters)
                  ? item.semesters.reduce((acc, sem) => acc + (sem.courses?.length || 0), 0)
                  : 0
                const hasMarkdown = Boolean(item.content && item.content.trim())

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {item.schoolCode && (
                          <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                            {item.schoolCode}
                          </span>
                        )}
                        <span className="font-medium text-slate-900">{item.schoolName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{item.majorName}</span>
                        {item.majorCode && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-500">
                            {item.majorCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs space-y-0.5">
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          {item.degreeLevel || 'Đại học'}
                        </span>
                        <div className="text-slate-500">
                          {item.durationYears} năm {item.totalCredits ? `· ${item.totalCredits} tín chỉ` : ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1 text-xs">
                        {semesterCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                            <Layers className="h-3 w-3" /> {semesterCount} kỳ ({courseCount} môn)
                          </span>
                        ) : null}
                        {hasMarkdown ? (
                          <span className="text-[11px] text-slate-400">Có nội dung mô tả</span>
                        ) : null}
                        {semesterCount === 0 && !hasMarkdown && (
                          <span className="text-xs text-amber-500">Chưa có khung môn</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewItem(item)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                          title="Xem trước chương trình"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800"
                          title="Chỉnh sửa chương trình"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingItem(item)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Xóa chương trình"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog Thêm/Sửa */}
      <CurriculumFormDialog
        open={formOpen}
        initialData={editingItem}
        options={options}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      {/* Dialog Xóa */}
      <ConfirmDialog
        open={Boolean(deletingItem)}
        title="Xóa chương trình học"
        description={`Bạn có chắc chắn muốn xóa chương trình học của ngành "${deletingItem?.majorName}" thuộc trường "${deletingItem?.schoolName}" không? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa chương trình"
        destructive
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingItem(null)}
      />

      {/* Dialog Xem trước (Preview) */}
      {previewItem && (
        <AdminDialog
          open={Boolean(previewItem)}
          title={`Chi tiết chương trình: ${previewItem.majorName}`}
          description={`${previewItem.schoolName}${previewItem.schoolCode ? ` (${previewItem.schoolCode})` : ''}`}
          onClose={() => setPreviewItem(null)}
          size="xl"
          footer={
            <Button variant="outline" onClick={() => setPreviewItem(null)}>
              Đóng
            </Button>
          }
        >
          <div className="space-y-6 py-2">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                Hệ đào tạo: <span className="text-indigo-600">{previewItem.degreeLevel}</span>
              </span>
              <span>·</span>
              <span>Thời gian: <strong>{previewItem.durationYears} năm</strong></span>
              {previewItem.totalCredits && (
                <>
                  <span>·</span>
                  <span>Tổng số tín chỉ: <strong>{previewItem.totalCredits}</strong></span>
                </>
              )}
            </div>

            {/* Description */}
            {previewItem.description && (
              <div className="rounded-md border-l-4 border-indigo-500 bg-indigo-50/50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-indigo-900 mb-1">Mục tiêu & Giới thiệu ngành:</p>
                <p>{previewItem.description}</p>
              </div>
            )}

            {/* Semesters view */}
            {Array.isArray(previewItem.semesters) && previewItem.semesters.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" /> Khung chương trình đào tạo theo kỳ
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {previewItem.semesters.map((sem, sIdx) => {
                    const totalSemCredits = (sem.courses || []).reduce(
                      (acc, c) => acc + (Number(c.credits) || 0),
                      0
                    )
                    return (
                      <div
                        key={sIdx}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between border-b pb-1.5">
                          <span className="font-bold text-xs text-indigo-950">
                            {sem.semester}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {totalSemCredits} tín chỉ ({sem.courses?.length || 0} môn)
                          </span>
                        </div>
                        <div className="space-y-1">
                          {(sem.courses || []).map((course, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-center justify-between text-xs py-0.5 hover:bg-slate-50 px-1 rounded"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {course.code && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    [{course.code}]
                                  </span>
                                )}
                                <span className="truncate text-slate-700 font-medium">
                                  {course.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.2 text-slate-500">
                                  {course.type}
                                </span>
                                <span className="font-semibold text-slate-800 text-[11px] w-6 text-right">
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
            )}

            {/* Markdown content */}
            {previewItem.content && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm text-slate-900">
                  Nội dung chi tiết & Đề cương môn học
                </h4>
                <div className="prose prose-sm max-w-none text-xs text-slate-700 rounded-lg border bg-slate-50/50 p-4">
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {previewItem.content}
                  </Markdown>
                </div>
              </div>
            )}
          </div>
        </AdminDialog>
      )}
    </div>
  )
}
