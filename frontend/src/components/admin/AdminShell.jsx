import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Users,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import AdminOverview from './AdminOverview'
import UsersPanel from './UsersPanel'
import DataPanel from './DataPanel'
import AuditPanel from './AuditPanel'
import SurveySettingsPanel from './SurveySettingsPanel'
import CareerRubricsPanel from './CareerRubricsPanel'

const NAV_ITEMS = [
  {
    id: 'overview',
    path: '/admin_home',
    alias: ['/admin', '/admin/', '/admin/overview'],
    label: 'Tổng quan',
    icon: LayoutDashboard,
  },
  {
    id: 'users',
    path: '/admin_user',
    alias: ['/admin/users'],
    label: 'Người dùng',
    icon: Users,
  },
  {
    id: 'survey',
    path: '/admin_survey',
    alias: ['/admin/survey'],
    label: 'Cài đặt khảo sát',
    icon: ClipboardList,
  },
  {
    id: 'data',
    path: '/admin_data',
    alias: ['/admin/data'],
    label: 'Dữ liệu',
    icon: Database,
  },
  {
    id: 'career',
    path: '/admin_career',
    alias: ['/admin/career'],
    label: 'Rubric năng lực',
    icon: SlidersHorizontal,
  },
  {
    id: 'audit',
    path: '/admin_audit',
    alias: ['/admin/audit'],
    label: 'Nhật ký',
    icon: ScrollText,
  },
]

export default function AdminShell({ admin, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()

  const [selectedTable, setSelectedTable] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const activeItem =
    NAV_ITEMS.find(
      (item) => item.path === location.pathname || item.alias?.includes(location.pathname)
    ) || NAV_ITEMS[0]

  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin_home', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    document.title = `Quản trị LearnPath - ${activeItem.label}`
  }, [activeItem])

  const handleNavigateToData = (table) => {
    if (table) setSelectedTable(table)
    navigate('/admin_data')
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b bg-slate-950 text-slate-100">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Quản trị LearnPath</p>
              <p className="truncate text-xs text-slate-400">
                {admin.username}
                {admin.lastLoginAt ? ` · Đăng nhập lúc ${new Date(admin.lastLoginAt).toLocaleString('vi-VN')}` : ''}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-60 shrink-0 border-r bg-white lg:block">
          <nav className="sticky top-16 space-y-1 p-3" aria-label="Điều hướng quản trị">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeItem.id === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <nav
            className="flex gap-1 overflow-x-auto border-b bg-white px-2 py-2 lg:hidden"
            aria-label="Điều hướng quản trị"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeItem.id === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <main className="p-4 sm:p-6">
            {activeItem.id === 'overview' && (
              <AdminOverview admin={admin} onNavigateToData={handleNavigateToData} />
            )}
            {activeItem.id === 'users' && <UsersPanel admin={admin} />}
            {activeItem.id === 'survey' && <SurveySettingsPanel admin={admin} />}
            {activeItem.id === 'data' && (
              <DataPanel
                admin={admin}
                initialTable={selectedTable}
                onTableChange={setSelectedTable}
              />
            )}
            {activeItem.id === 'career' && <CareerRubricsPanel admin={admin} />}
            {activeItem.id === 'audit' && <AuditPanel admin={admin} />}
          </main>
        </div>
      </div>
    </div>
  )
}
