import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  clearAdminCsrfToken,
  getAdminMe,
  loginAdmin,
  logoutAdmin,
  setAdminCsrfToken,
} from '@/lib/adminApi'
import AdminLogin from '@/components/admin/AdminLogin'
import AdminShell from '@/components/admin/AdminShell'

function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-950 text-slate-300">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Đang kiểm tra phiên quản trị...</span>
    </div>
  )
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Quản trị LearnPath'

    let meta = document.querySelector('meta[name="robots"]')
    let createdMeta = false
    const previousContent = meta ? meta.getAttribute('content') : null

    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      document.head.appendChild(meta)
      createdMeta = true
    }
    meta.setAttribute('content', 'noindex,nofollow')

    return () => {
      document.title = previousTitle
      if (createdMeta) {
        meta.remove()
      } else if (previousContent === null) {
        meta.removeAttribute('content')
      } else {
        meta.setAttribute('content', previousContent)
      }
    }
  }, [])

  useEffect(() => {
    let active = true

    getAdminMe()
      .then((response) => {
        if (!active) return
        setAdminCsrfToken(response.data.data.csrfToken)
        setAdmin(response.data.data.admin)
      })
      .catch((error) => {
        if (error.response?.status !== 401) {
          console.error('[admin] Không thể kiểm tra phiên quản trị:', error.message)
        }
        if (active) setAdmin(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAdminCsrfToken()
      setAdmin(null)
      setLoading(false)
    }

    window.addEventListener('admin:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized)
  }, [])

  const handleLogin = useCallback(async (credentials) => {
    const response = await loginAdmin(credentials)
    setAdminCsrfToken(response.data.data.csrfToken)
    setAdmin(response.data.data.admin)
    return response.data.data.admin
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await logoutAdmin()
    } catch (error) {
      // A missing or already expired session still ends the local admin UI.
      if (error.response?.status !== 401) {
        console.error('[admin] Không thể đăng xuất:', error.message)
      }
    } finally {
      clearAdminCsrfToken()
      setAdmin(null)
    }
  }, [])

  if (loading) return <AdminLoading />

  if (!admin) return <AdminLogin onLogin={handleLogin} />

  return <AdminShell admin={admin} onLogout={handleLogout} />
}
