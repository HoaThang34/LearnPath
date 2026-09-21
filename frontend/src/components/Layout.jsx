import { Link, useLocation } from 'react-router-dom'
import {
  GraduationCap,
  Search,
  BarChart3,
  BookOpen,
  Trophy,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

const menuItems = [
  { path: '/', label: 'Trang chủ', icon: GraduationCap },
  { path: '/de-an', label: 'Đề án tuyển sinh', icon: Search },
  { path: '/diem-chuan', label: 'Điểm chuẩn', icon: BarChart3 },
  { path: '/khoi-thi', label: 'Khối thi', icon: BookOpen },
  { path: '/thu-hang', label: 'Thứ hạng THPTQG', icon: Trophy },
]

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-10 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">LearnPath</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
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

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t p-4 space-y-2">
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
          </nav>
        )}
      </header>

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
