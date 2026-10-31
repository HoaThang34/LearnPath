import { useCallback, useEffect, useState } from 'react'
import { Download, Eye, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'
import {
  exportInterestResults,
  getInterestResultDetail,
  getInterestStats,
} from '@/lib/adminApi'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN')
}

export default function InterestStatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getInterestStats()
      setStats(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải thống kê sở thích.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (attemptId) => {
    setDetailLoading(true)
    setError('')
    try {
      const response = await getInterestResultDetail(attemptId)
      setDetail(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể xem chi tiết lượt làm.')
    } finally {
      setDetailLoading(false)
    }
  }

  const downloadCsv = async () => {
    setExporting(true)
    setError('')
    try {
      const response = await exportInterestResults()
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'interest-results.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể xuất CSV.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải thống kê...</span>
      </div>
    )
  }

  const distribution = stats?.topGroupDistribution || []
  const maxCount = Math.max(1, ...distribution.map((row) => row.count))

  return (
    <div className="space-y-5">
      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Tổng lượt làm</p>
            <p className="text-2xl font-bold">{stats?.totalAttempts ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Đã nộp</p>
            <p className="text-2xl font-bold">{stats?.submitted ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Đang làm dở</p>
            <p className="text-2xl font-bold">{stats?.drafts ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-500">Tỉ lệ hoàn thành</p>
            <p className="text-2xl font-bold">{stats?.completionRate ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Làm mới
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={exporting}>
          {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
          Xuất CSV (ẩn danh)
        </Button>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Phân bố nhóm sở thích dẫn đầu</h3>
        {distribution.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có kết quả đã nộp.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {distribution.map((row) => (
              <div key={row.code} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-mono font-semibold">{row.code}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(row.count / maxCount) * 100}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums text-slate-600">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Lượt</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Bắt đầu</th>
              <th className="px-3 py-2">Nộp</th>
              <th className="px-3 py-2 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(stats?.recent || []).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70">
                <td className="px-3 py-2 font-mono text-xs">#{row.id}</td>
                <td className="px-3 py-2 text-xs">{row.status}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDate(row.startedAt)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDate(row.submittedAt)}</td>
                <td className="px-3 py-2 text-right">
                  {row.status === 'submitted' ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(row.id)} disabled={detailLoading}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Xem
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {(stats?.recent || []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  Chưa có lượt làm nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminDialog
        open={Boolean(detail)}
        title={`Chi tiết lượt #${detail?.attempt_id ?? ''}`}
        description="Thao tác xem chi tiết đã được ghi vào nhật ký quản trị (admin.interest.result.view)."
        onClose={() => setDetail(null)}
        footer={
          <Button type="button" variant="outline" onClick={() => setDetail(null)}>
            Đóng
          </Button>
        }
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>Học sinh:</strong> {detail.username}
            </p>
            <p>
              <strong>Thuật toán:</strong> {detail.algorithm_version} · <strong>Độ phủ:</strong>{' '}
              {detail.completeness === 'full' ? 'đủ 108 câu' : `thiếu ${detail.unanswered_count} câu`}
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
              {['r', 'i', 'a', 's', 'e', 'c'].map((code) => (
                <div key={code} className="rounded border p-2 text-center">
                  <p className="font-bold uppercase">{code}</p>
                  <p className="tabular-nums">{detail[code]}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {['d_ei', 'd_sn', 'd_tf', 'd_jp'].map((key) => (
                <div key={key} className="rounded border p-2 text-center">
                  <p className="font-bold uppercase">{key.replace('d_', '')}</p>
                  <p className="tabular-nums">{detail[key] === null ? '—' : detail[key]}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Mã tham khảo: {detail.code || '—'} · Nộp lúc {formatDate(detail.submitted_at)}
            </p>
          </div>
        )}
      </AdminDialog>
    </div>
  )
}
