import { useState } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import { getErrorMessage } from '@/lib/adminUtils'

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu quản trị.')
      return
    }

    setSubmitting(true)
    try {
      await onLogin({ username: username.trim(), password })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể đăng nhập quản trị.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Quản trị LearnPath</h1>
          <p className="mt-1 text-sm text-slate-400">
            Khu vực dành riêng cho quản trị viên hệ thống.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Đăng nhập quản trị</CardTitle>
            <CardDescription className="text-slate-400">
              Tài khoản người dùng thông thường không sử dụng được tại đây.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {error && <AdminAlert variant="error">{error}</AdminAlert>}

              <div className="space-y-2">
                <Label htmlFor="admin-username" className="text-slate-200">
                  Tên đăng nhập quản trị
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="admin-username"
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
                    className="border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-500"
                    placeholder="Nhập tên đăng nhập"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-slate-200">
                  Mật khẩu
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="admin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="border-slate-700 bg-slate-950 pl-9 pr-10 text-slate-100 placeholder:text-slate-500"
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Đang kiểm tra...' : 'Đăng nhập'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Mọi thao tác quản trị đều được ghi nhật ký.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
