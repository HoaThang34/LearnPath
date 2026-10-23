import { lazy, Suspense, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import TrangChu from './pages/TrangChu'
import DeAnTuyenSinh from './pages/DeAnTuyenSinh'
import DiemChuan from './pages/DiemChuan'
import KhoiThi from './pages/KhoiThi'
import ThuHang from './pages/ThuHang'
import IntroVideo from './components/IntroVideo'

const AdminPage = lazy(() => import('./pages/AdminPage'))

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-950 text-slate-300">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Đang tải khu vực quản trị...</span>
    </div>
  )
}

function App() {
  const location = useLocation()
  const isAdminRoute =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/')

  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('hasSeenIntro')
  })

  const handleIntroComplete = () => {
    setShowIntro(false)
    sessionStorage.setItem('hasSeenIntro', 'true')
  }

  if (isAdminRoute) {
    return (
      <Suspense fallback={<AdminFallback />}>
        <Routes>
          <Route path="/admin/*" element={<AdminPage />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <>
      {showIntro && <IntroVideo onComplete={handleIntroComplete} />}
      {!showIntro && (
        <Layout>
          <Routes>
            <Route path="/" element={<TrangChu />} />
            <Route path="/dang-nhap" element={<AuthPage mode="login" />} />
            <Route path="/dang-ky" element={<AuthPage mode="register" />} />
            <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
            <Route
              path="/de-an"
              element={
                <ProtectedRoute>
                  <DeAnTuyenSinh />
                </ProtectedRoute>
              }
            />
            <Route
              path="/diem-chuan"
              element={
                <ProtectedRoute>
                  <DiemChuan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/khoi-thi"
              element={
                <ProtectedRoute>
                  <KhoiThi />
                </ProtectedRoute>
              }
            />
            <Route
              path="/thu-hang"
              element={
                <ProtectedRoute>
                  <ThuHang />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      )}
    </>
  )
}

export default App
