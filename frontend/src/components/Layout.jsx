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
  Compass,
  Bot,
  PanelLeft,
  PanelLeftClose,
  BookOpenCheck,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button, buttonVariants } from './ui/button'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const menuItems = [
  { path: '/', label: 'Trang chủ', icon: GraduationCap },
  { path: '/chuong-trinh-hoc', label: 'Chương trình học', icon: BookOpenCheck },
  { path: '/de-an', label: 'Đề án tuyển sinh', icon: Search },
  { path: '/diem-chuan', label: 'Điểm chuẩn', icon: BarChart3 },
  { path: '/khoi-thi', label: 'Khối thi', icon: BookOpen },
  { path: '/thu-hang', label: 'Tra cứu thứ hạng', icon: Trophy },
  { path: '/phan-tich-nang-luc', label: 'Phân tích năng lực', icon: Activity },
  { path: '/kham-pha-so-thich', label: 'Sở thích nghề nghiệp', icon: Compass },
  { path: '/tro-ly-ai', label: 'Trợ lý AI', icon: Bot },
]

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('learnpath_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [interestBannerDismissed, setInterestBannerDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem('interestBannerDismissed') === '1'
  )
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const isAuthPage = location.pathname === '/dang-nhap' || location.pathname === '/dang-ky'
  const isChatPage = location.pathname === '/tro-ly-ai'
  const hideNavMenu = (!user && location.pathname === '/') || isAuthPage

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('learnpath_sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }

  // Keyboard shortcut Ctrl + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Automatically close mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

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

  const isItemActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const currentMenuItem = menuItems.find((item) => isItemActive(item.path))
  const getPageTitle = () => {
    if (currentMenuItem) return currentMenuItem.label
    if (location.pathname === '/thong-tin-ca-nhan') return 'Thông tin cá nhân'
    if (location.pathname === '/doi-mat-khau') return 'Đổi mật khẩu'
    if (location.pathname === '/khao-sat') return 'Khảo sát ban đầu'
    return ''
  }

  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* Desktop Left Vertical Sidebar */}
      {!hideNavMenu && (
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-white shadow-sm transition-all duration-300 ease-in-out lg:flex",
            sidebarCollapsed ? "w-[72px]" : "w-64"
          )}
        >
          {/* Logo & Brand Header */}
          <div
            className={cn(
              "flex h-16 shrink-0 items-center border-b transition-all duration-300",
              sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
            )}
          >
            {!sidebarCollapsed ? (
              <>
                <Link to="/" className="flex items-center space-x-2.5 overflow-hidden">
                  <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-9 w-auto shrink-0" />
                  <span className="text-xl font-bold tracking-tight text-foreground truncate">LearnPath</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  title="Thu nhỏ menu (Ctrl + B)"
                  aria-label="Thu nhỏ menu"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                className="group relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                title="Mở rộng menu (Ctrl + B)"
                aria-label="Mở rộng menu"
              >
                <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-8 w-auto transition-transform group-hover:scale-105" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                  <ChevronRight className="h-2.5 w-2.5" />
                </span>
              </button>
            )}
          </div>

          {/* Navigation Menu */}
          <div className="flex-1 overflow-y-auto px-2 py-4">
            {!sidebarCollapsed ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Menu chính
              </p>
            ) : (
              <div className="my-2 border-t border-slate-100" />
            )}
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const active = isItemActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-all group relative",
                      sidebarCollapsed
                        ? "justify-center h-10 w-10 mx-auto"
                        : "space-x-3 px-3 py-2.5",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    {/* Tooltip on hover when collapsed */}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 hidden group-hover:flex items-center rounded-md bg-slate-900 text-white text-xs px-2.5 py-1 font-medium whitespace-nowrap shadow-lg z-50 pointer-events-none animate-in fade-in duration-150">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* User Account & Actions Footer */}
          {user && (
            <div
              className={cn(
                "shrink-0 border-t bg-slate-50/80 transition-all duration-300",
                sidebarCollapsed ? "p-2 flex flex-col items-center gap-2" : "p-3"
              )}
            >
              {!sidebarCollapsed ? (
                <>
                  <div className="flex items-center gap-3 px-2 py-1.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{user.fullName || user.username}</p>
                      <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 border-t border-slate-200/70 pt-2">
                    <Link
                      to="/doi-mat-khau"
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        "h-8 flex-1 justify-start px-2 text-xs text-muted-foreground hover:text-foreground"
                      )}
                      title="Đổi mật khẩu tài khoản"
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Đổi mật khẩu</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Đăng xuất"
                    >
                      <LogOut className="mr-1 h-3.5 w-3.5 shrink-0" />
                      <span>{loggingOut ? '...' : 'Đăng xuất'}</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm cursor-pointer"
                    title={`${user.fullName || user.username} (@${user.username})`}
                  >
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col gap-1 w-full items-center pt-1 border-t border-slate-200/70">
                    <Link
                      to="/doi-mat-khau"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group relative"
                      title="Đổi mật khẩu"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span className="absolute left-full ml-3 hidden group-hover:flex items-center rounded-md bg-slate-900 text-white text-xs px-2.5 py-1 font-medium whitespace-nowrap shadow-lg z-50 pointer-events-none animate-in fade-in duration-150">
                        Đổi mật khẩu
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors group relative"
                      title="Đăng xuất"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span className="absolute left-full ml-3 hidden group-hover:flex items-center rounded-md bg-slate-900 text-white text-xs px-2.5 py-1 font-medium whitespace-nowrap shadow-lg z-50 pointer-events-none animate-in fade-in duration-150">
                        Đăng xuất
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      )}

      {/* Mobile Drawer (Slide-over) */}
      {!hideNavMenu && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[80vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2"
              >
                <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-8 w-auto" />
                <span className="text-lg font-bold">LearnPath</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Menu chính
              </p>
              {menuItems.map((item) => {
                const Icon = item.icon
                const active = isItemActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {user && (
              <div className="border-t bg-slate-50 p-4 space-y-2">
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{user.fullName || user.username}</p>
                    <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
                <Link
                  to="/thong-tin-ca-nhan"
                  onClick={() => setMobileMenuOpen(false)}
                  className={buttonVariants({
                    variant: location.pathname === '/thong-tin-ca-nhan' ? 'default' : 'outline',
                    className: 'w-full justify-start',
                    size: 'sm',
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
                    size: 'sm',
                  })}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Đổi mật khẩu
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  size="sm"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Main Content Area (Offset by sidebar width on desktop when nav is shown) */}
      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          isChatPage ? "h-screen overflow-hidden" : "min-h-screen",
          !hideNavMenu && (sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              {!hideNavMenu && (
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
              )}

              {/* Desktop Toggle Button on Navbar */}
              {!hideNavMenu && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={toggleSidebar}
                  title={sidebarCollapsed ? "Mở rộng menu (Ctrl + B)" : "Thu nhỏ menu (Ctrl + B)"}
                  aria-label={sidebarCollapsed ? "Mở rộng menu" : "Thu nhỏ menu"}
                >
                  {sidebarCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* Logo (shown on mobile or when nav menu is hidden like unauthenticated landing/auth) */}
              {hideNavMenu ? (
                <Link to="/" className="flex shrink-0 items-center space-x-2">
                  <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-10 w-auto" />
                  <span className="text-xl font-bold sm:inline">LearnPath</span>
                </Link>
              ) : (
                <div className="flex items-center gap-2 lg:hidden">
                  <Link to="/" className="flex items-center space-x-2">
                    <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-8 w-auto" />
                    <span className="text-lg font-bold">LearnPath</span>
                  </Link>
                </div>
              )}

              {/* Current Page Title on Desktop */}
              {!hideNavMenu && (
                <div className="hidden lg:flex items-center gap-2 text-sm">
                  {currentMenuItem && (
                    <>
                      <currentMenuItem.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{currentMenuItem.label}</span>
                    </>
                  )}
                  {!currentMenuItem && getPageTitle() && (
                    <span className="font-semibold text-foreground">{getPageTitle()}</span>
                  )}
                </div>
              )}
            </div>

            {/* Top Right: Giữ lại nút "thông tin cá nhân" ở góc bên trên tay phải */}
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden="true" />
              ) : user ? (
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
              ) : (
                <>
                  {location.pathname !== '/dang-nhap' && (
                    <Link
                      to="/dang-nhap"
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Đăng nhập
                    </Link>
                  )}
                  {location.pathname !== '/dang-ky' && (
                    <Link to="/dang-ky" className={buttonVariants({ size: 'sm' })}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Đăng ký
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          {logoutError && (
            <div
              className="border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
              role="alert"
            >
              {logoutError}
            </div>
          )}
        </header>

        {/* Survey Banner */}
        {user && !user.surveyCompleted && location.pathname !== '/khao-sat' && (
          <div className="bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground py-2.5 px-4 shadow-sm border-b">
            <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
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

        {/* Interest Banner */}
        {user &&
          user.surveyCompleted &&
          !user.interestCompleted &&
          !interestBannerDismissed &&
          !location.pathname.startsWith('/kham-pha-so-thich') && (
            <div className="border-b bg-indigo-50 px-4 py-2 text-indigo-900">
              <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 text-xs sm:flex-row sm:items-center sm:text-sm">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    Bạn đã hoàn thành khảo sát khởi đầu. Hãy khám phá <strong>sở thích nghề nghiệp</strong> để
                    kết hợp với điểm học tập khi chọn ngành.
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to="/kham-pha-so-thich"
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Khám phá ngay
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    aria-label="Đóng nhắc nhở sở thích"
                    onClick={() => {
                      sessionStorage.setItem('interestBannerDismissed', '1')
                      setInterestBannerDismissed(true)
                    }}
                    className="rounded-full p-1 text-indigo-700 hover:bg-indigo-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Main Content */}
        <main
          className={cn(
            "flex-1 w-full",
            isChatPage
              ? "overflow-hidden p-0 max-w-none flex flex-col"
              : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
          )}
        >
          {children}
        </main>

        {/* Footer */}
        {!isChatPage && (
          <footer className="border-t bg-muted/40 mt-auto shrink-0">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        )}
      </div>
    </div>
  )
}
