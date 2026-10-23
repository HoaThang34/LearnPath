import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteTableRow } from '@/lib/adminApi'
import { getErrorMessage } from '@/lib/adminUtils'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'

export default function DeleteRowDialog({ open, tableMeta, row, onClose, onDeleted }) {
  const [force, setForce] = useState(false)
  const [dependencyError, setDependencyError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForce(false)
    setDependencyError('')
    setError('')
    setBusy(false)
  }, [open, row])

  if (!tableMeta || !row) return null

  const handleDelete = async () => {
    setError('')
    setBusy(true)

    try {
      await deleteTableRow(tableMeta.table, row.id, {
        confirm: true,
        ...(force ? { force: true } : {}),
      })
      onDeleted()
    } catch (requestError) {
      const data = requestError.response?.data
      if (data?.code === 'DEPENDENCIES_EXIST') {
        setDependencyError(data.error)
        setForce(false)
      } else {
        setError(getErrorMessage(requestError))
      }
    } finally {
      setBusy(false)
    }
  }

  const identifier =
    row.ma_truong || row.ma_khoi || row.sbd || row.ten_truong || `ID ${row.id}`

  return (
    <AdminDialog
      open={open}
      title={`Xóa ${tableMeta.label}`}
      description="Thao tác này xóa vĩnh viễn dòng dữ liệu khỏi cơ sở dữ liệu tuyển sinh."
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={busy || (Boolean(dependencyError) && !force)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? 'Đang xóa...' : force ? 'Xóa cưỡng bức' : 'Xóa dòng'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <p className="text-sm">
          Bạn đang xóa <strong className="font-mono">{identifier}</strong> khỏi bảng{' '}
          <strong>{tableMeta.label}</strong> (ID {row.id}). Hệ thống sẽ tạo bản sao lưu trước khi xóa.
        </p>

        {dependencyError && (
          <div className="space-y-3">
            <AdminAlert variant="warning">{dependencyError}</AdminAlert>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                Tôi hiểu dữ liệu liên quan sẽ không bị xóa theo và có thể trở nên mồ côi. Xóa cưỡng bức.
              </span>
            </label>
          </div>
        )}
      </div>
    </AdminDialog>
  )
}
