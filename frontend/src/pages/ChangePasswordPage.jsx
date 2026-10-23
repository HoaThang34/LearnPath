import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'

function validateForm(currentPassword, newPassword, newPasswordConfirm) {
  if (!currentPassword) return 'Vui lòng nhập mật khẩu hiện tại.'
  if (newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự.'
  if (newPassword.length > 128) return 'Mật khẩu mới không được dài quá 128 ký tự.'
  if (!/\p{L}/u.test(newPassword) || !/\p{Nd}/u.test(newPassword)) {
    return 'Mật khẩu mới phải có ít nhất một chữ cái và một chữ số.'
  }
  if (newPassword !== newPasswordConfirm) return 'Mật khẩu xác nhận không khớp.'
  if (newPassword === currentPassword) return 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  return ''
}

export default function ChangePasswordPage() {
  const { user, loading, changePassword } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang kiểm tra đăng nhập...</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dang-nhap" replace />
  }

  const forced = Boolean(user.mustChangePassword)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validationError = validateForm(currentPassword, newPassword, newPasswordConfirm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      await changePassword({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      })
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          'Không thể đổi mật khẩu. Vui lòng kiểm tra kết nối và thử lại.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-8">
      <div className="mb-6 text-center">
        <img
          src="/logo/LearnPath_xoanen.png"
          alt="LearnPath"
          className="mx-auto h-16 w-auto"
        />
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck className="h-6 w-6" />
            Đổi mật khẩu
          </CardTitle>
          <CardDescription>
            {forced
              ? 'Tài khoản của bạn đang dùng mật khẩu tạm. Hãy đổi mật khẩu trước khi tiếp tục.'
              : 'Cập nhật mật khẩu mới cho tài khoản của bạn.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {forced && (
              <div
                role="status"
                className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
              >
                Bạn phải đổi mật khẩu thì mới sử dụng được các tính năng dữ liệu tuyển sinh.
              </div>
            )}

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="current-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tối thiểu 8 ký tự, có ít nhất một chữ cái và một chữ số.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password-confirm">Xác nhận mật khẩu mới</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password-confirm"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  value={newPasswordConfirm}
                  onChange={(event) => setNewPasswordConfirm(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            </button>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </Button>
          </form>

          {!forced && (
            <p className="mt-6 text-center text-sm">
              <Link to="/" className="text-muted-foreground underline-offset-4 hover:underline">
                Quay lại trang chủ
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
