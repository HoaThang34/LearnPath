import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  UserRound,
} from 'lucide-react'
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

const MODE_CONFIG = {
  login: {
    title: 'Đăng nhập',
    description: 'Đăng nhập để tiếp tục sử dụng các tính năng của LearnPath.',
    submitLabel: 'Đăng nhập',
    switchText: 'Chưa có tài khoản?',
    switchLabel: 'Đăng ký ngay',
    switchTo: '/dang-ky',
  },
  register: {
    title: 'Tạo tài khoản',
    description: 'Tạo tài khoản miễn phí để sử dụng các tính năng của LearnPath.',
    submitLabel: 'Đăng ký',
    switchText: 'Đã có tài khoản?',
    switchLabel: 'Đăng nhập',
    switchTo: '/dang-nhap',
  },
}

const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{1,30})[A-Za-z0-9]$/

function getRedirectTarget(location) {
  const from = location.state?.from
  if (!from || typeof from.pathname !== 'string') return '/'
  if (!from.pathname.startsWith('/') || from.pathname.startsWith('//')) return '/'
  if (from.pathname === '/dang-nhap' || from.pathname === '/dang-ky') return '/'

  const search = typeof from.search === 'string' ? from.search : ''
  const hash = typeof from.hash === 'string' ? from.hash : ''
  return `${from.pathname}${search}${hash}`
}

function validateForm(mode, username, password, passwordConfirm) {
  const trimmedUsername = username.trim()

  if (!trimmedUsername) return 'Vui lòng nhập tên đăng nhập.'
  if (!password) return 'Vui lòng nhập mật khẩu.'

  if (mode === 'login') return ''

  if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
    return 'Tên đăng nhập phải có từ 3 đến 32 ký tự.'
  }

  if (!USERNAME_PATTERN.test(trimmedUsername)) {
    return (
      'Tên đăng nhập chỉ được chứa chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang; ' +
      'phải bắt đầu và kết thúc bằng chữ cái hoặc chữ số.'
    )
  }

  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.'
  if (password.length > 128) return 'Mật khẩu không được dài quá 128 ký tự.'
  if (!/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) {
    return 'Mật khẩu phải có ít nhất một chữ cái và một chữ số.'
  }
  if (password !== passwordConfirm) return 'Mật khẩu xác nhận không khớp.'

  return ''
}

export default function AuthPage({ mode = 'login' }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.login
  const isRegister = mode === 'register'
  const location = useLocation()
  const { user, loading, login, register } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = getRedirectTarget(location)

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

  if (user) {
    if (user.mustChangePassword) {
      return <Navigate to="/doi-mat-khau" replace />
    }
    if (isRegister || !user.surveyCompleted) {
      return <Navigate to="/khao-sat" replace />
    }
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validationError = validateForm(mode, username, password, passwordConfirm)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      if (isRegister) {
        await register({
          username: username.trim(),
          password,
          passwordConfirm,
        })
      } else {
        await login({
          username: username.trim(),
          password,
        })
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          'Không thể kết nối tới máy chủ. Vui lòng thử lại.'
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
          <CardTitle className="text-2xl">{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
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
              <Label htmlFor="username">Tên đăng nhập</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                  maxLength={32}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="pl-9"
                  placeholder="Nhập tên đăng nhập"
                  aria-describedby={isRegister ? 'username-hint' : undefined}
                />
              </div>
              {isRegister && (
                <p id="username-hint" className="text-xs text-muted-foreground">
                  Từ 3 đến 32 ký tự, chỉ gồm chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9 pr-10"
                  placeholder="Nhập mật khẩu"
                  aria-describedby={isRegister ? 'password-hint' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isRegister && (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  Tối thiểu 8 ký tự, có ít nhất một chữ cái và một chữ số.
                </p>
              )}
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="password-confirm">Xác nhận mật khẩu</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password-confirm"
                    name="passwordConfirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    className="pl-9"
                    placeholder="Nhập lại mật khẩu"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Đang xử lý...' : config.submitLabel}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {config.switchText}{' '}
            <Link
              to={config.switchTo}
              state={location.state}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {config.switchLabel}
            </Link>
          </p>

          <p className="mt-3 text-center text-sm">
            <Link to="/" className="text-muted-foreground underline-offset-4 hover:underline">
              Quay lại trang chủ
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
