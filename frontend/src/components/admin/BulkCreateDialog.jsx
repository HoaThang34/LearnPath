import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { bulkCreateUsers } from '@/lib/adminApi'
import { getErrorMessage } from '@/lib/adminUtils'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'

const MAX_BULK = 50

export default function BulkCreateDialog({ open, onClose, onCreated }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setText('')
    setError('')
    setSubmitting(false)
  }, [open])

  const usernames = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (usernames.length === 0) {
      setError('Vui lòng nhập ít nhất một tên đăng nhập.')
      return
    }

    if (usernames.length > MAX_BULK) {
      setError(`Mỗi lần chỉ được tạo tối đa ${MAX_BULK} tài khoản.`)
      return
    }

    setSubmitting(true)
    try {
      const response = await bulkCreateUsers({ usernames })
      onCreated({ data: response.data.data, skipped: response.data.skipped })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminDialog
      open={open}
      title="Tạo tài khoản hàng loạt"
      description={`Mỗi dòng một tên đăng nhập, tối đa ${MAX_BULK} tài khoản mỗi lần.`}
      onClose={submitting ? undefined : onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" form="bulk-form" disabled={submitting || usernames.length === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? 'Đang tạo...' : `Tạo ${usernames.length || ''} tài khoản`}
          </Button>
        </>
      }
    >
      <form id="bulk-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <div className="space-y-2">
          <Label htmlFor="bulk-usernames">Danh sách tên đăng nhập</Label>
          <textarea
            id="bulk-usernames"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={'nguyenvana\nnguyenvanb\nnguyenvancc'}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <p className="text-xs text-muted-foreground">
            Đã nhập {usernames.length} tên. Tên không hợp lệ hoặc đã tồn tại sẽ được báo lại sau khi tạo.
          </p>
        </div>

        <AdminAlert variant="info">
          Mỗi tài khoản sẽ nhận một mật khẩu tạm riêng. Mật khẩu chỉ hiển thị một lần sau khi tạo.
        </AdminAlert>
      </form>
    </AdminDialog>
  )
}
