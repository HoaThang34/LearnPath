import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import TrangChu from './pages/TrangChu'
import DeAnTuyenSinh from './pages/DeAnTuyenSinh'
import DiemChuan from './pages/DiemChuan'
import KhoiThi from './pages/KhoiThi'
import ThuHang from './pages/ThuHang'
import IntroVideo from './components/IntroVideo'

function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('hasSeenIntro')
  })

  const handleIntroComplete = () => {
    setShowIntro(false)
    sessionStorage.setItem('hasSeenIntro', 'true')
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
