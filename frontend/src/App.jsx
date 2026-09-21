import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
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
            <Route path="/de-an" element={<DeAnTuyenSinh />} />
            <Route path="/diem-chuan" element={<DiemChuan />} />
            <Route path="/khoi-thi" element={<KhoiThi />} />
            <Route path="/thu-hang" element={<ThuHang />} />
          </Routes>
        </Layout>
      )}
    </>
  )
}

export default App
