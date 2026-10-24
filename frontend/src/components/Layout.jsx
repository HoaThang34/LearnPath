import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Search,
  BarChart3,
  BookOpen,
  Trophy,
  Menu,
  X,
  LogIn,
  LogOut,
  ShieldCheck,
  User,
  UserPlus,
  Sparkles,
  ChevronRight,
  Activity,
} from 'lucide-react'
import { useState } from 'react'
import { Button, buttonVariants } from './ui/button'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const menuItems = [
  { path: '/', label: 'Trang chủ', icon: GraduationCap },
  { path: '/de-an', label: 'Đề án tuyển sinh', icon: Search },
  { path: '/diem-chuan', label: 'Điểm chuẩn', icon: BarChart3 },
  { path: '/khoi-thi', label: 'Khối thi', icon: BookOpen },
  { path: '/thu-hang', label: 'Thứ hạng THPTQG', icon: Trophy },
  { path: '/phan-tich-nang-luc', label: 'Phân tích năng lực', icon: Activity },
]

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()

  const handleLogout = async () => {
    setLogoutError('')
    setLoggingOut(true)

    try {
      await logout()
      setMobileMenuOpen(false)
      navigate('/')
    } catch (error) {
      setLogoutError(
        error.response?.data?.error ||
          'Không thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.'
      )
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center space-x-2">
            <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-10 w-auto" />
            <span className="hidden text-xl font-bold sm:inline">LearnPath</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-1 lg:flex">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {loading ? (
              <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden="true" />
            ) : user ? (
              <>
                <Link
                  to="/thong-tin-ca-nhan"
                  className={buttonVariants({
                    variant: location.pathname === '/thong-tin-ca-nhan' ? 'default' : 'outline',
                    size: 'sm',
                  })}
                  title="Xem và chỉnh sửa thông tin cá nhân"
                >
                  <User className="mr-1.5 h-4 w-4" />
                  <span>Thông tin cá nhân</span>
                </Link>
                <Link
                  to="/doi-mat-khau"
                  className={buttonVariants({
                    variant: location.pathname === '/doi-mat-khau' ? 'default' : 'ghost',
                    size: 'sm',
                  })}
                  title="Đổi mật khẩu tài khoản"
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  <span>Đổi mật khẩu</span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut className="mr-1.5 h-4 w-4" />
                  {loggingOut ? 'Đang...' : 'Đăng xuất'}
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/dang-nhap"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Đăng nhập
                </Link>
                <Link to="/dang-ky" className={buttonVariants({ size: 'sm' })}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Đăng ký
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="border-t p-4 lg:hidden">
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            <div className="mt-3 space-y-2 border-t pt-3">
              {loading ? (
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />
              ) : user ? (
                <>
                  <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground">
                    <span>Tài khoản:</span>
                    <strong className="font-medium text-foreground">{user.username}</strong>
                  </div>
                  <Link
                    to="/thong-tin-ca-nhan"
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonVariants({
                      variant: location.pathname === '/thong-tin-ca-nhan' ? 'default' : 'outline',
                      className: 'w-full justify-start',
                    })}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Thông tin cá nhân
                  </Link>
                  <Link
                    to="/doi-mat-khau"
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonVariants({
                      variant: location.pathname === '/doi-mat-khau' ? 'default' : 'outline',
                      className: 'w-full justify-start',
                    })}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Đổi mật khẩu
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    to="/dang-nhap"
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonVariants({ variant: 'outline', className: 'w-full' })}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Đăng nhập
                  </Link>
                  <Link
                    to="/dang-ky"
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonVariants({ className: 'w-full' })}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}

        {logoutError && (
          <div
            className="border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
            role="alert"
          >
            {logoutError}
          </div>
        )}
      </header>

      {user && !user.surveyCompleted && location.pathname !== '/khao-sat' && (
        <div className="bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground py-2.5 px-4 shadow-sm border-b">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300 animate-pulse" />
              <span>
                👋 Chào mừng bạn! Hãy hoàn thành <strong>bài khảo sát khởi đầu</strong> để kích hoạt đầy đủ tính năng tư vấn và cá nhân hóa lộ trình tuyển sinh.
              </span>
            </div>
            <Link
              to="/khao-sat"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-slate-100 transition-colors"
            >
              <span>Làm khảo sát ngay</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-6 w-auto opacity-60" />
              <span className="text-sm text-muted-foreground">
                © 2026 LearnPath - Hệ thống tư vấn hướng nghiệp
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Dữ liệu tuyển sinh năm 2026
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
