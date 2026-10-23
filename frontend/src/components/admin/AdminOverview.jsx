import { useCallback, useEffect, useState } from 'react'
import {
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAdminOverview } from '@/lib/adminApi'
import { formatBytes, formatDateTime, getErrorMessage } from '@/lib/adminUtils'
import AdminAlert from './AdminAlert'

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="rounded-md bg-slate-100 p-2 text-slate-700">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getAdminOverview()
      setData(response.data.data)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể tải tổng quan.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải tổng quan...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tổng quan hệ thống</h1>
          <p className="text-sm text-muted-foreground">
            Thống kê dữ liệu tuyển sinh, tài khoản và trạng thái cơ sở dữ liệu.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => load({ background: true })}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {refreshing ? 'Đang làm mới...' : 'Làm mới'}
        </Button>
      </div>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      {data && (
        <>
          {data.database.integrity !== 'ok' && (
            <AdminAlert variant="error">
              Kiểm tra toàn vẹn cơ sở dữ liệu trả về: <strong>{data.database.integrity}</strong>.
              Hãy dừng ghi dữ liệu và kiểm tra máy chủ.
            </AdminAlert>
          )}

          {data.database.writeBlocked && (
            <AdminAlert variant="error">
              Hệ thống đang chặn ghi cơ sở dữ liệu để bảo vệ dữ liệu. Kiểm tra log máy chủ trước khi tiếp tục.
            </AdminAlert>
          )}

          {data.database.backups.length === 0 && (
            <AdminAlert variant="warning">
              Chưa có bản sao lưu nào. Bản sao lưu đầu tiên sẽ được tạo tự động trước thao tác ghi dữ liệu đầu tiên.
            </AdminAlert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Tài khoản người dùng"
              value={data.users.total.toLocaleString('vi-VN')}
              hint={`${data.users.active.toLocaleString('vi-VN')} hoạt động · ${data.users.locked.toLocaleString('vi-VN')} khóa · ${data.users.deleted.toLocaleString('vi-VN')} đã xóa`}
            />
            <StatCard
              icon={ShieldCheck}
              label="Quản trị viên"
              value={data.admins.toLocaleString('vi-VN')}
            />
            <StatCard
              icon={HardDrive}
              label="Dung lượng DB tuyển sinh"
              value={formatBytes(data.database.size)}
              hint={`Toàn vẹn: ${data.database.integrity}`}
            />
            <StatCard
              icon={Database}
              label="Dung lượng DB tài khoản"
              value={formatBytes(data.authDatabase.size)}
              hint={`${data.database.backups.length} bản sao lưu gần nhất`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Số dòng dữ liệu tuyển sinh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.tables.map((table) => (
                  <div
                    key={table.table}
                    className="flex items-center justify-between rounded-md border bg-white px-3 py-2"
                  >
                    <span className="text-sm">{table.label}</span>
                    <span className="font-mono text-sm font-semibold">
                      {table.total.toLocaleString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cơ sở dữ liệu tuyển sinh</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Trạng thái ghi</span>
                  <span className={data.database.writeBlocked ? 'font-medium text-destructive' : 'font-medium text-emerald-700'}>
                    {data.database.writeBlocked ? 'Đang bị chặn' : 'Bình thường'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Lần ghi gần nhất</span>
                  <span>{formatDateTime(data.database.lastWriteAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Sao lưu gần nhất</span>
                  <span className="text-right">
                    {data.database.lastBackup
                      ? `${data.database.lastBackup.name} (${formatBytes(data.database.lastBackup.size)})`
                      : 'Chưa có'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Số bản sao lưu</span>
                  <span>{data.database.backups.length}</span>
                </div>
                <p className="break-all rounded-md bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                  {data.database.path}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Phiên quản trị hiện tại</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Bắt đầu</span>
                  <span>{formatDateTime(data.session.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Hoạt động gần nhất</span>
                  <span>{formatDateTime(data.session.lastSeenAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Hết hạn tuyệt đối</span>
                  <span>{formatDateTime(data.session.expiresAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Giờ máy chủ</span>
                  <span>{formatDateTime(data.serverTime)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
