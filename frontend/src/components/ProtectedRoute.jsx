import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

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
    return <Navigate to="/dang-nhap" state={{ from: location }} replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/doi-mat-khau" replace />
  }

  return children
}
