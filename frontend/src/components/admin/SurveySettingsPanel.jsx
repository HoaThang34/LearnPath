import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  Edit2,
  FileQuestion,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'
import ConfirmDialog from './ConfirmDialog'
import {
  createAdminSurveyQuestion,
  createSampleSurveyQuestions,
  deleteAdminSurveyQuestion,
  getAdminSurveyQuestions,
  updateAdminSurveyQuestion,
} from '@/lib/adminApi'
import { cn } from '@/lib/utils'

export default function SurveySettingsPanel() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState('create') // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    questionType: 'text',
    placeholder: '',
    isRequired: false,
    orderIndex: 0,
    isActive: true,
  })

  // Action states
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  // Auto-clear success message after 4s
  useEffect(() => {
    if (!success) return undefined
    const timer = setTimeout(() => setSuccess(''), 4000)
    return () => clearTimeout(timer)
  }, [success])

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getAdminSurveyQuestions()
      setQuestions(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải danh sách câu hỏi khảo sát.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  const openCreateDialog = () => {
    setDialogMode('create')
    setEditingId(null)
    setFormData({
      question: '',
      questionType: 'text',
      placeholder: '',
      isRequired: false,
      orderIndex: questions.length + 1,
      isActive: true,
    })
    setDialogError('')
    setDialogOpen(true)
  }

  const openEditDialog = (q) => {
    setDialogMode('edit')
    setEditingId(q.id)
    setFormData({
      question: q.question,
      questionType: q.questionType || 'text',
      placeholder: q.placeholder || '',
      isRequired: Boolean(q.isRequired),
      orderIndex: q.orderIndex || 0,
      isActive: Boolean(q.isActive),
    })
    setDialogError('')
    setDialogOpen(true)
  }

  const handleSaveQuestion = async (e) => {
    if (e && e.preventDefault) e.preventDefault()

    const trimmedQuestion = formData.question.trim()
    if (!trimmedQuestion) {
      setDialogError('Vui lòng nhập nội dung câu hỏi.')
      return
    }

    const orderIndex =
      formData.orderIndex === '' ? 0 : Math.max(0, parseInt(formData.orderIndex, 10) || 0)

    const payload = {
      question: trimmedQuestion,
      questionType: formData.questionType === 'textarea' ? 'textarea' : 'text',
      placeholder: formData.placeholder?.trim() || '',
      isRequired: Boolean(formData.isRequired),
      orderIndex,
      isActive: Boolean(formData.isActive),
    }

    setSubmitting(true)
    setDialogError('')
    try {
      if (dialogMode === 'create') {
        await createAdminSurveyQuestion(payload)
        setSuccess('Đã tạo câu hỏi khảo sát mới thành công.')
      } else {
        await updateAdminSurveyQuestion(editingId, payload)
        setSuccess('Đã cập nhật câu hỏi khảo sát thành công.')
      }
      setDialogOpen(false)
      loadQuestions()
    } catch (err) {
      setDialogError(err.response?.data?.error || 'Không thể lưu câu hỏi khảo sát.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (q) => {
    if (togglingId) return
    setTogglingId(q.id)
    try {
      await updateAdminSurveyQuestion(q.id, {
        question: q.question,
        questionType: q.questionType,
        placeholder: q.placeholder,
        isRequired: q.isRequired,
        orderIndex: q.orderIndex,
        isActive: !q.isActive,
      })
      setSuccess(`Đã ${q.isActive ? 'tắt' : 'bật'} câu hỏi "${q.question}".`)
      await loadQuestions()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể đổi trạng thái câu hỏi.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAdminSurveyQuestion(deleteTarget.id)
      setSuccess(`Đã xóa câu hỏi "${deleteTarget.question}".`)
      setDeleteTarget(null)
      loadQuestions()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể xóa câu hỏi khảo sát.')
    } finally {
      setDeleting(false)
    }
  }

  const handleLoadSampleQuestions = async () => {
    setLoadingSample(true)
    setError('')
    try {
      await createSampleSurveyQuestions()
      setSuccess('Đã nạp thành công bộ 5 câu hỏi khảo sát mẫu vào hệ thống.')
      loadQuestions()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể nạp bộ câu hỏi khảo sát mẫu.')
    } finally {
      setLoadingSample(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cài đặt câu hỏi khảo sát
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý các câu hỏi khảo sát tùy chỉnh hiển thị cho học sinh khi vừa đăng ký tài khoản.
            Câu trả lời được tự động lưu vào mục <strong>Khác</strong> trong thông tin cá nhân dưới định dạng:{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-800">
              Câu hỏi - Câu trả lời từ user
            </code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadQuestions}
            disabled={loading || loadingSample}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Làm mới
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSampleQuestions}
            disabled={loading || loadingSample}
            className="border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100"
          >
            {loadingSample ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
                Đang nạp...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4 text-indigo-600" />
                Thêm 5 câu hỏi mẫu
              </>
            )}
          </Button>

          <Button type="button" size="sm" onClick={openCreateDialog} disabled={loadingSample}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm câu hỏi mới
          </Button>
        </div>
      </div>

      {error && (
        <AdminAlert variant="error" className="mb-4">
          {error}
        </AdminAlert>
      )}

      {success && (
        <AdminAlert variant="success" className="mb-4">
          {success}
        </AdminAlert>
      )}

      {/* Main Table */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            <span>Đang tải danh sách câu hỏi khảo sát...</span>
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <FileQuestion className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Chưa có câu hỏi bổ sung nào</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Hiện tại học sinh chỉ làm các câu hỏi khảo sát cố định (Họ tên, lớp, trường, mục tiêu...).
              Bạn có thể nạp sẵn bộ 5 câu hỏi mẫu để thử nghiệm ngay lập tức hoặc tự thêm câu hỏi mới.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={handleLoadSampleQuestions}
                disabled={loadingSample}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {loadingSample ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang nạp câu hỏi mẫu...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Nạp bộ 5 câu hỏi mẫu có sẵn
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Tự thêm câu hỏi mới
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 w-16 text-center">
                    Thứ tự
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Nội dung câu hỏi
                  </th>
                  <th scope="col" className="px-4 py-3 w-32">
                    Loại câu trả lời
                  </th>
                  <th scope="col" className="px-4 py-3 w-28 text-center">
                    Bắt buộc
                  </th>
                  <th scope="col" className="px-4 py-3 w-32 text-center">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3 w-36 text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {questions.map((q) => {
                  const isToggling = togglingId === q.id
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 text-center font-semibold">
                        #{q.orderIndex}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="max-w-lg">
                          <p className="break-words">{q.question}</p>
                          {q.placeholder && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              Gợi ý: "{q.placeholder}"
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {q.questionType === 'textarea' ? (
                          <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700 font-medium border border-indigo-200">
                            Đoạn văn dài
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-1 text-slate-700 font-medium border border-slate-200">
                            Văn bản ngắn
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {q.isRequired ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Check className="h-3.5 w-3.5" /> Có
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleActive(q)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                            isToggling
                              ? 'opacity-60 cursor-wait bg-slate-100 text-slate-400'
                              : q.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          )}
                          title="Bấm để bật/tắt kích hoạt câu hỏi này"
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Power className="h-3 w-3" />
                          )}
                          {q.isActive ? 'Đang bật' : 'Đã tắt'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(q)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                            title="Chỉnh sửa câu hỏi"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(q)}
                            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            title="Xóa câu hỏi"
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
      </div>

      {/* Dialog Thêm / Sửa câu hỏi */}
      <AdminDialog
        open={dialogOpen}
        title={dialogMode === 'create' ? 'Thêm câu hỏi khảo sát mới' : 'Chỉnh sửa câu hỏi khảo sát'}
        description="Câu hỏi này sẽ xuất hiện trong bài khảo sát khi học sinh vừa đăng ký tài khoản."
        onClose={() => setDialogOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="survey-question-form"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu câu hỏi'
              )}
            </Button>
          </div>
        }
      >
        <form id="survey-question-form" onSubmit={handleSaveQuestion} className="space-y-4">
          {dialogError && <AdminAlert variant="error">{dialogError}</AdminAlert>}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="question_input">
                Nội dung câu hỏi <span className="text-destructive">*</span>
              </Label>
              <span className="text-[11px] text-slate-400">
                {formData.question.length}/500 ký tự
              </span>
            </div>
            <Input
              id="question_input"
              placeholder="Ví dụ: Bạn có định hướng du học trong tương lai không?"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              maxLength={500}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="question_type_select">Loại câu trả lời</Label>
              <select
                id="question_type_select"
                value={formData.questionType}
                onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="text">Văn bản ngắn (1 dòng)</option>
                <option value="textarea">Đoạn văn bản dài (nhiều dòng)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order_index_input">Thứ tự hiển thị</Label>
              <Input
                id="order_index_input"
                type="number"
                min="0"
                value={formData.orderIndex}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    orderIndex:
                      e.target.value === ''
                        ? ''
                        : Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="placeholder_input">Gợi ý câu trả lời (Placeholder)</Label>
            <Input
              id="placeholder_input"
              placeholder="Ví dụ: Có / Chưa rõ / Đã có học bổng..."
              value={formData.placeholder}
              onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              maxLength={255}
            />
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm font-medium text-slate-700">
                Bắt buộc học sinh phải trả lời câu hỏi này
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm font-medium text-slate-700">
                Kích hoạt hiển thị câu hỏi này trong bài khảo sát
              </span>
            </label>
          </div>
        </form>
      </AdminDialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa câu hỏi khảo sát"
        description={`Bạn có chắc chắn muốn xóa câu hỏi "${deleteTarget?.question}"? Thao tác này sẽ không xóa các câu trả lời đã lưu trong hồ sơ của học sinh trước đây.`}
        confirmLabel={deleting ? 'Đang xóa...' : 'Xóa câu hỏi'}
        variant="destructive"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
