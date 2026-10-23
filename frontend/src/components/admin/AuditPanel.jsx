import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listAudit } from '@/lib/adminApi'
import { formatDateTime, getErrorMessage } from '@/lib/adminUtils'
import { cn } from '@/lib/utils'
import AdminAlert from './AdminAlert'

const PAGE_SIZE = 50

const ACTION_LABELS = {
  'admin.login.success': 'Đăng nhập thành công',
  'admin.login.failure': 'Đăng nhập thất bại',
  'admin.login.disabled': 'Đăng nhập bị từ chối',
  'admin.logout': 'Đăng xuất',
  'admin.user.create': 'Tạo người dùng',
  'admin.user.bulk_create': 'Tạo người dùng hàng loạt',
  'admin.user.update': 'Sửa người dùng',
  'admin.user.lock': 'Khóa người dùng',
  'admin.user.unlock': 'Mở khóa người dùng',
  'admin.user.restore': 'Khôi phục người dùng',
  'admin.user.reset_password': 'Đặt lại mật khẩu',
  'admin.user.delete': 'Xóa người dùng',
  'admin.data.create': 'Thêm dữ liệu',
  'admin.data.update': 'Sửa dữ liệu',
  'admin.data.force_update': 'Ghi đè dữ liệu',
  'admin.data.delete': 'Xóa dữ liệu',
  'admin.data.force_delete': 'Xóa cưỡng bức dữ liệu',
}

function actionClass(action) {
  if (action.includes('failure') || action.includes('delete') || action.includes('disabled')) {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  if (action.includes('success') || action.includes('create') || action.includes('restore')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (action.includes('lock') || action.includes('reset')) {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function formatDetails(details) {
  if (!details) return ''
  try {
    return JSON.stringify(JSON.parse(details), null, 2)
  } catch (error) {
    return details
  }
}

export default function AuditPanel() {
  const [actionInput, setActionInput] = useState('')
  const [adminInput, setAdminInput] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [applied, setApplied] = useState({ action: '', admin: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ data: [], total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    listAudit({
      action: applied.action || undefined,
      admin: applied.admin || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((response) => {
        if (active) setResult(response.data)
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError, 'Không thể tải nhật ký quản trị.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [applied, page, refreshKey])

  const handleApply = (event) => {
    event.preventDefault()
    setApplied({
      action: actionInput.trim(),
      admin: adminInput.trim(),
      from: fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : '',
      to: toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : '',
    })
    setPage(1)
  }

  const handleReset = () => {
    setActionInput('')
    setAdminInput('')
    setFromDate('')
    setToDate('')
    setApplied({ action: '', admin: '', from: '', to: '' })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(result.total / (result.limit || PAGE_SIZE)))
  const entries = result.data || []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nhật ký quản trị</h1>
          <p className="text-sm text-muted-foreground">
            Lịch sử thao tác quản trị, lưu 180 ngày. Không ghi mật khẩu, token hay cookie.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Làm mới
        </Button>
      </div>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      <form className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={handleApply}>
        <div className="space-y-1">
          <Label htmlFor="audit-action" className="text-xs">
            Hành động
          </Label>
          <Input
            id="audit-action"
            value={actionInput}
            onChange={(event) => setActionInput(event.target.value)}
            placeholder="admin.data.update"
            className="h-9 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="audit-admin" className="text-xs">
            Quản trị viên
          </Label>
          <Input
            id="audit-admin"
            value={adminInput}
            onChange={(event) => setAdminInput(event.target.value)}
            placeholder="username"
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="audit-from" className="text-xs">
            Từ ngày
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="audit-to" className="text-xs">
            Đến ngày
          </Label>
          <Input
            id="audit-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">
            <Search className="mr-2 h-4 w-4" />
            Lọc
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={handleReset}>
            Xóa lọc
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Thời gian</th>
                <th className="px-3 py-2 font-medium">Quản trị viên</th>
                <th className="px-3 py-2 font-medium">Hành động</th>
                <th className="px-3 py-2 font-medium">Đối tượng</th>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải nhật ký...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    Không có bản ghi nhật ký nào khớp điều kiện.
                  </td>
                </tr>
              )}

              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-mono">{entry.adminUsername}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
                        actionClass(entry.action)
                      )}
                    >
                      {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{entry.action}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.entity || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.entityId || '—'}</td>
                  <td className="max-w-[360px] px-3 py-2">
                    {entry.details ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary underline-offset-4 hover:underline">
                          Xem chi tiết
                        </summary>
                        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 text-[11px]">
                          {formatDetails(entry.details)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Tổng {result.total.toLocaleString('vi-VN')} bản ghi · Trang {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages || loading}
            >
              Sau
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
