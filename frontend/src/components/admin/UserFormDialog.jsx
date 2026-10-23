import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createUser, updateUser } from '@/lib/adminApi'
import { getErrorMessage } from '@/lib/adminUtils'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'

const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{1,30})[A-Za-z0-9]$/

function validateUsername(value) {
  const username = value.trim()
  if (username.length < 3 || username.length > 32) {
    return 'Tên đăng nhập phải có từ 3 đến 32 ký tự.'
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Tên đăng nhập chỉ được chứa chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang; phải bắt đầu và kết thúc bằng chữ cái hoặc chữ số.'
  }
  return ''
}

export default function UserFormDialog({ open, user, onClose, onSaved }) {
  const isEdit = Boolean(user)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setUsername(user ? user.username : '')
    setError('')
    setSubmitting(false)
  }, [open, user])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validationError = validateUsername(username)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        const response = await updateUser(user.id, { username: username.trim() })
        onSaved({ user: response.data.data })
      } else {
        const response = await createUser({ username: username.trim() })
        onSaved({ created: response.data.data })
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminDialog
      open={open}
      title={isEdit ? 'Sửa tên đăng nhập' : 'Tạo tài khoản người dùng'}
      description={
        isEdit
          ? 'Tên đăng nhập mới phải là duy nhất (không phân biệt hoa thường).'
          : 'Hệ thống sẽ tạo một mật khẩu tạm ngẫu nhiên và yêu cầu đổi ở lần đăng nhập đầu tiên.'
      }
      onClose={submitting ? undefined : onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" form="user-form" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </>
      }
    >
      <form id="user-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <div className="space-y-2">
          <Label htmlFor="user-username">Tên đăng nhập</Label>
          <Input
            id="user-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            Từ 3 đến 32 ký tự, chỉ gồm chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang.
          </p>
        </div>
      </form>
    </AdminDialog>
  )
}
