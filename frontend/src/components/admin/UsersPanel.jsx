import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteUser,
  listUsers,
  lockUser,
  resetUserPassword,
  restoreUser,
  unlockUser,
} from '@/lib/adminApi'
import { formatDateTime, getErrorMessage } from '@/lib/adminUtils'
import { cn } from '@/lib/utils'
import AdminAlert from './AdminAlert'
import BulkCreateDialog from './BulkCreateDialog'
import ConfirmDialog from './ConfirmDialog'
import CredentialsDialog from './CredentialsDialog'
import UserFormDialog from './UserFormDialog'

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'locked', label: 'Đã khóa' },
  { value: 'deleted', label: 'Đã xóa' },
]

const STATUS_LABELS = {
  active: 'Đang hoạt động',
  locked: 'Đã khóa',
  deleted: 'Đã xóa',
}

const STATUS_CLASSES = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  locked: 'border-amber-200 bg-amber-50 text-amber-700',
  deleted: 'border-red-200 bg-red-50 text-red-700',
}

export default function UsersPanel() {
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ data: [], total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [busyId, setBusyId] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [credentials, setCredentials] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    listUsers({ query, status, page, limit: PAGE_SIZE })
      .then((response) => {
        if (active) setResult(response.data)
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError, 'Không thể tải danh sách tài khoản.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [query, status, page, refreshKey])

  const refresh = () => setRefreshKey((value) => value + 1)

  const handleToggleLock = async (user) => {
    setActionError('')
    setNotice('')
    setBusyId(user.id)

    try {
      if (user.status === 'locked') {
        await unlockUser(user.id)
        setNotice(`Đã mở khóa tài khoản ${user.username}.`)
      } else if (user.status === 'deleted') {
        await restoreUser(user.id)
        setNotice(`Đã khôi phục tài khoản ${user.username}.`)
      } else {
        await lockUser(user.id)
        setNotice(`Đã khóa tài khoản ${user.username} và thu hồi phiên đăng nhập.`)
      }
      refresh()
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    await deleteUser(deleteTarget.id, { confirmUsername: deleteTarget.username })
    setNotice(`Đã xóa tài khoản ${deleteTarget.username}. Có thể khôi phục từ bộ lọc "Đã xóa".`)
    setDeleteTarget(null)
    refresh()
  }

  const handleResetPassword = async () => {
    const response = await resetUserPassword(resetTarget.id)
    setResetTarget(null)
    setCredentials({
      title: 'Mật khẩu tạm mới',
      entries: [
        {
          username: response.data.data.username,
          password: response.data.data.password,
        },
      ],
    })
    setNotice(`Đã đặt lại mật khẩu cho ${response.data.data.username}.`)
    refresh()
  }

  const totalPages = Math.max(1, Math.ceil(result.total / (result.limit || PAGE_SIZE)))
  const users = result.data || []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground">
            Tạo tài khoản, khóa/mở khóa, đặt lại mật khẩu và xóa mềm người dùng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Tạo hàng loạt
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo tài khoản
          </Button>
        </div>
      </div>

      {notice && <AdminAlert variant="success">{notice}</AdminAlert>}
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {actionError && <AdminAlert variant="error">{actionError}</AdminAlert>}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm theo tên đăng nhập..."
            className="pl-9"
            aria-label="Tìm người dùng"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Lọc trạng thái"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={loading}
          aria-label="Làm mới danh sách"
        >
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Tên đăng nhập</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Ngày tạo</th>
                <th className="px-3 py-2 font-medium">Đăng nhập cuối</th>
                <th className="px-3 py-2 font-medium">Mật khẩu</th>
                <th className="px-3 py-2 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải danh sách...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    Không có tài khoản nào khớp điều kiện tìm kiếm.
                  </td>
                </tr>
              )}

              {users.map((user) => {
                const busy = busyId === user.id
                return (
                  <tr key={user.id} className="border-t align-middle">
                    <td className="px-3 py-2">
                      <div className="font-mono font-medium">{user.username}</div>
                      <div className="text-xs text-muted-foreground">ID {user.id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                          STATUS_CLASSES[user.status] || 'border-slate-200 bg-slate-50 text-slate-700'
                        )}
                      >
                        {STATUS_LABELS[user.status] || user.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(user.lastLoginAt)}</td>
                    <td className="px-3 py-2">
                      {user.mustChangePassword ? (
                        <span className="text-xs font-medium text-amber-700">Bắt buộc đổi</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Bình thường</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {user.status !== 'deleted' && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleLock(user)}
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : user.status === 'locked' ? (
                                <Unlock className="mr-1 h-3.5 w-3.5" />
                              ) : (
                                <Lock className="mr-1 h-3.5 w-3.5" />
                              )}
                              {user.status === 'locked' ? 'Mở khóa' : 'Khóa'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditUser(user)}
                              disabled={busy}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Sửa
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setResetTarget(user)}
                              disabled={busy}
                            >
                              <KeyRound className="mr-1 h-3.5 w-3.5" />
                              Đặt lại MK
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(user)}
                              disabled={busy}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Xóa
                            </Button>
                          </>
                        )}

                        {user.status === 'deleted' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleLock(user)}
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            )}
                            Khôi phục
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Tổng {result.total.toLocaleString('vi-VN')} tài khoản · Trang {page}/{totalPages}
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

      <UserFormDialog
        open={createOpen}
        user={null}
        onClose={() => setCreateOpen(false)}
        onSaved={({ created }) => {
          setCreateOpen(false)
          setNotice(`Đã tạo tài khoản ${created.username}.`)
          setCredentials({ title: 'Tài khoản đã tạo', entries: [created] })
          refresh()
        }}
      />

      <UserFormDialog
        open={Boolean(editUser)}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={({ user }) => {
          setEditUser(null)
          setNotice(`Đã cập nhật tên đăng nhập thành ${user.username}.`)
          refresh()
        }}
      />

      <BulkCreateDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onCreated={({ data, skipped }) => {
          setBulkOpen(false)
          setNotice(`Đã tạo ${data.length} tài khoản, bỏ qua ${skipped.length} mục.`)
          setCredentials({ title: 'Tài khoản đã tạo hàng loạt', entries: data, skipped })
          refresh()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa tài khoản"
        description="Tài khoản sẽ bị xóa mềm, thu hồi mọi phiên đăng nhập và có thể khôi phục sau."
        confirmLabel="Xóa tài khoản"
        destructive
        requireText={deleteTarget?.username}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        <p className="text-sm">
          Bạn đang xóa tài khoản <strong className="font-mono">{deleteTarget?.username}</strong>. Người dùng
          sẽ không thể đăng nhập cho đến khi được khôi phục.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Đặt lại mật khẩu"
        description="Mật khẩu hiện tại sẽ ngừng hiệu lực và mọi phiên đăng nhập của người dùng sẽ bị thu hồi."
        confirmLabel="Đặt lại mật khẩu"
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetPassword}
      >
        <p className="text-sm">
          Tạo mật khẩu tạm mới cho <strong className="font-mono">{resetTarget?.username}</strong>? Người dùng
          sẽ phải đổi mật khẩu ở lần đăng nhập tiếp theo.
        </p>
      </ConfirmDialog>

      <CredentialsDialog
        open={Boolean(credentials)}
        title={credentials?.title}
        entries={credentials?.entries || []}
        skipped={credentials?.skipped || []}
        onClose={() => setCredentials(null)}
      />
    </div>
  )
}
