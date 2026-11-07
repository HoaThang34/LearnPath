import { useState, useEffect } from 'react'
import {
  Trophy,
  Calculator,
  TrendingUp,
  AlertTriangle,
  GraduationCap,
  Award,
  Sparkles,
  ExternalLink,
  Search,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  BarChart3,
  RefreshCw,
  Image as ImageIcon,
  X,
  Lock,
  RotateCcw,
  Check
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getRanking,
  getHsaExams,
  getHsaRanking,
  getTsaExams,
  getTsaRanking
} from '@/lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

const BAT_BUOC = [
  { key: 'toan', label: 'Toán', color: '#2563eb', required: true, description: 'Bắt buộc' },
  { key: 'van', label: 'Ngữ văn', color: '#dc2626', required: true, description: 'Bắt buộc' },
]

const TU_CHON = [
  { key: 'ly', label: 'Vật lí', color: '#16a34a' },
  { key: 'hoa', label: 'Hóa học', color: '#ca8a04' },
  { key: 'sinh', label: 'Sinh học', color: '#9333ea' },
  { key: 'su', label: 'Lịch sử', color: '#ea580c' },
  { key: 'dia', label: 'Địa lí', color: '#0891b2' },
  { key: 'tin_hoc', label: 'Tin học', color: '#4f46e5' },
  { key: 'ngoai_ngu', label: 'Ngoại ngữ', color: '#db2777' },
]

const monHoc = [...BAT_BUOC, ...TU_CHON]

const QUICK_PRESETS = [
  { label: 'Vật lí + Hóa học', keys: ['ly', 'hoa'] },
  { label: 'Hóa học + Sinh học', keys: ['hoa', 'sinh'] },
  { label: 'Vật lí + Tin học', keys: ['ly', 'tin_hoc'] },
  { label: 'Vật lí + Ngoại ngữ', keys: ['ly', 'ngoai_ngu'] },
  { label: 'Lịch sử + Địa lí', keys: ['su', 'dia'] },
  { label: 'Lịch sử + Ngoại ngữ', keys: ['su', 'ngoai_ngu'] },
]

const DEFAULT_HSA_EXAMS = [
  {
    id: 25,
    name: 'HSA tất cả các đợt năm 2026',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/709883021-1695292892056849-1248372962989095024-n.jpg',
    localImage: '/images/hsa/hsa-25.jpg',
    proxyImage: '/api/diem-thi/hsa/image/25',
    isDefault: true,
  },
  {
    id: 21,
    name: 'HSA đợt 601 - 603 năm 2026',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-hsa-2026-dot-1-2-3.png',
    localImage: '/images/hsa/hsa-21.png',
    proxyImage: '/api/diem-thi/hsa/image/21',
    isDefault: false,
  },
  {
    id: 11,
    name: 'HSA tất cả các đợt năm 2025',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/hsa-2025.png',
    localImage: '/images/hsa/hsa-11.png',
    proxyImage: '/api/diem-thi/hsa/image/11',
    isDefault: false,
  },
  {
    id: 7,
    name: 'HSA đợt 501-502 năm 2025',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/2025/0402/pho-diem-hsa-dot-501-502.png',
    localImage: '/images/hsa/hsa-7.png',
    proxyImage: '/api/diem-thi/hsa/image/7',
    isDefault: false,
  },
  {
    id: 3,
    name: 'HSA đợt 401 - 406 năm 2024',
    year: 2024,
    image: 'https://images.tuyensinh247.com/picture/2025/0108/hsa-tat-ca-cac-dot.jpg',
    localImage: '/images/hsa/hsa-3.jpg',
    proxyImage: '/api/diem-thi/hsa/image/3',
    isDefault: false,
  },
]

const DEFAULT_TSA_EXAMS = [
  {
    id: 24,
    name: 'Tổng 3 đợt thi TSA 2026',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/tsa-2026_1.png',
    localImage: '/images/tsa/tsa-24.png',
    proxyImage: '/api/diem-thi/tsa/image/24',
    isDefault: true,
  },
  {
    id: 23,
    name: 'TSA 2026 đợt 3',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/tsa-dot-3.jpg',
    localImage: '/images/tsa/tsa-23.jpg',
    proxyImage: '/api/diem-thi/tsa/image/23',
    isDefault: false,
  },
  {
    id: 20,
    name: 'TSA 2026 đợt 2',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-thi-tsa-2026-dot-2.png',
    localImage: '/images/tsa/tsa-20.png',
    proxyImage: '/api/diem-thi/tsa/image/20',
    isDefault: false,
  },
  {
    id: 19,
    name: 'TSA 2026 đợt 1',
    year: 2026,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-thi-tsa-2026-dot-1.png',
    localImage: '/images/tsa/tsa-19.png',
    proxyImage: '/api/diem-thi/tsa/image/19',
    isDefault: false,
  },
  {
    id: 10,
    name: 'Tổng 3 đợt thi TSA 2025',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-tsa-3-dot1.png',
    localImage: '/images/tsa/tsa-10.png',
    proxyImage: '/api/diem-thi/tsa/image/10',
    isDefault: false,
  },
  {
    id: 9,
    name: 'TSA 2025 đợt 3',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/diemthi/ts247/images/pho-diem-tsa-dot-3.png',
    localImage: '/images/tsa/tsa-9.png',
    proxyImage: '/api/diem-thi/tsa/image/9',
    isDefault: false,
  },
  {
    id: 6,
    name: 'TSA 2025 đợt 2',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/2025/0318/pho-diem-tsa-dot-2.png',
    localImage: '/images/tsa/tsa-6.png',
    proxyImage: '/api/diem-thi/tsa/image/6',
    isDefault: false,
  },
  {
    id: 5,
    name: 'TSA 2025 đợt 1',
    year: 2025,
    image: 'https://images.tuyensinh247.com/picture/2025/0124/pho-diem-tsa-dot-1.png',
    localImage: '/images/tsa/tsa-5.png',
    proxyImage: '/api/diem-thi/tsa/image/5',
    isDefault: false,
  },
  {
    id: 4,
    name: 'TSA 2024 đợt 2',
    year: 2024,
    image: 'https://images.tuyensinh247.com/picture/2025/0108/tsa-dot-2.jpg',
    localImage: '/images/tsa/tsa-4.jpg',
    proxyImage: '/api/diem-thi/tsa/image/4',
    isDefault: false,
  },
]

export default function ThuHang() {
  const [activeTab, setActiveTab] = useState('thptqg') // 'thptqg' | 'hsa' | 'tsa'

  // --- State for THPTQG Ranking ---
  const [scores, setScores] = useState({
    toan: '',
    van: '',
    ly: '',
    hoa: '',
    sinh: '',
    su: '',
    dia: '',
    tin_hoc: '',
    ngoai_ngu: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Đếm các môn tự chọn đã có điểm
  const selectedElectives = TU_CHON.filter(
    (m) => scores[m.key] !== '' && scores[m.key] !== undefined && scores[m.key] !== null
  ).map((m) => m.key)
  const electiveCount = selectedElectives.length
  const isElectiveLimitReached = electiveCount >= 2

  // --- State for ĐGNL HSA Ranking ---
  const [hsaExams, setHsaExams] = useState(DEFAULT_HSA_EXAMS)
  const [selectedExamId, setSelectedExamId] = useState(25)
  const [hsaScore, setHsaScore] = useState('')
  const [hsaResult, setHsaResult] = useState(null)
  const [loadingHsa, setLoadingHsa] = useState(false)
  const [errorHsa, setErrorHsa] = useState('')
  const [hsaImgSrc, setHsaImgSrc] = useState('')
  const [hsaImgLoading, setHsaImgLoading] = useState(true)
  const [hsaImgError, setHsaImgError] = useState(false)
  const [hsaDisplayMode, setHsaDisplayMode] = useState('both') // 'both' | 'chart' | 'image'

  // --- State for ĐGTD TSA Ranking ---
  const [tsaExams, setTsaExams] = useState(DEFAULT_TSA_EXAMS)
  const [selectedTsaExamId, setSelectedTsaExamId] = useState(24)
  const [tsaScore, setTsaScore] = useState('')
  const [tsaResult, setTsaResult] = useState(null)
  const [loadingTsa, setLoadingTsa] = useState(false)
  const [errorTsa, setErrorTsa] = useState('')
  const [tsaImgSrc, setTsaImgSrc] = useState('')
  const [tsaImgLoading, setTsaImgLoading] = useState(true)
  const [tsaImgError, setTsaImgError] = useState(false)
  const [tsaDisplayMode, setTsaDisplayMode] = useState('both') // 'both' | 'chart' | 'image'

  // Load dynamic exams on mount
  useEffect(() => {
    // HSA exams
    getHsaExams()
      .then(res => {
        if (res?.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setHsaExams(res.data.data)
          const def = res.data.data.find(e => e.isDefault)
          if (def) setSelectedExamId(def.id)
        }
      })
      .catch(err => {
        console.warn('Không thể tải danh sách đợt thi HSA động:', err.message)
      })

    // TSA exams
    getTsaExams()
      .then(res => {
        if (res?.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setTsaExams(res.data.data)
          const def = res.data.data.find(e => e.isDefault)
          if (def) setSelectedTsaExamId(def.id)
        }
      })
      .catch(err => {
        console.warn('Không thể tải danh sách đợt thi TSA động:', err.message)
      })
  }, [])

  // Sync HSA image source
  useEffect(() => {
    if (hsaResult) {
      const primarySrc = hsaResult.localImage || `/images/hsa/hsa-${hsaResult.examId}.${hsaResult.examId === 21 || hsaResult.examId === 11 || hsaResult.examId === 7 ? 'png' : 'jpg'}`
      setHsaImgSrc(primarySrc)
      setHsaImgLoading(true)
      setHsaImgError(false)
    }
  }, [hsaResult])

  const handleHsaImageError = () => {
    if (hsaResult) {
      if (hsaImgSrc !== hsaResult.proxyImage && hsaResult.proxyImage) {
        setHsaImgSrc(hsaResult.proxyImage)
      } else if (hsaImgSrc !== hsaResult.image && hsaResult.image) {
        setHsaImgSrc(hsaResult.image)
      } else {
        setHsaImgError(true)
        setHsaImgLoading(false)
      }
    } else {
      setHsaImgError(true)
      setHsaImgLoading(false)
    }
  }

  // Sync TSA image source
  useEffect(() => {
    if (tsaResult) {
      const isJpg = tsaResult.examId === 23 || tsaResult.examId === 4
      const primarySrc = tsaResult.localImage || `/images/tsa/tsa-${tsaResult.examId}.${isJpg ? 'jpg' : 'png'}`
      setTsaImgSrc(primarySrc)
      setTsaImgLoading(true)
      setTsaImgError(false)
    }
  }, [tsaResult])

  const handleTsaImageError = () => {
    if (tsaResult) {
      if (tsaImgSrc !== tsaResult.proxyImage && tsaResult.proxyImage) {
        setTsaImgSrc(tsaResult.proxyImage)
      } else if (tsaImgSrc !== tsaResult.image && tsaResult.image) {
        setTsaImgSrc(tsaResult.image)
      } else {
        setTsaImgError(true)
        setTsaImgLoading(false)
      }
    } else {
      setTsaImgError(true)
      setTsaImgLoading(false)
    }
  }

  // Handle THPTQG input change with validation
  const handleScoreChange = (key, rawValue) => {
    setError('')

    if (rawValue === '') {
      setScores((prev) => ({ ...prev, [key]: '' }))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    const normalized = rawValue.replace(',', '.')
    const num = parseFloat(normalized)

    if (isNaN(num)) {
      setFieldErrors((prev) => ({ ...prev, [key]: 'Điểm phải là số' }))
      setScores((prev) => ({ ...prev, [key]: rawValue }))
      return
    }

    if (num < 0 || num > 10) {
      setFieldErrors((prev) => ({ ...prev, [key]: 'Điểm từ 0 đến 10' }))
      setScores((prev) => ({ ...prev, [key]: rawValue }))
      return
    }

    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setScores((prev) => ({ ...prev, [key]: rawValue }))
  }

  const handleClearSubject = (key) => {
    setError('')
    setScores((prev) => ({ ...prev, [key]: '' }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleResetThpt = () => {
    setScores({
      toan: '',
      van: '',
      ly: '',
      hoa: '',
      sinh: '',
      su: '',
      dia: '',
      tin_hoc: '',
      ngoai_ngu: '',
    })
    setFieldErrors({})
    setResult(null)
    setError('')
  }

  const handleApplyPreset = (keys) => {
    setError('')
    setScores((prev) => {
      const next = { ...prev }
      TU_CHON.forEach((m) => {
        if (!keys.includes(m.key)) {
          next[m.key] = ''
        }
      })
      return next
    })
    setFieldErrors((prev) => {
      const next = { ...prev }
      TU_CHON.forEach((m) => {
        if (!keys.includes(m.key)) {
          delete next[m.key]
        }
      })
      return next
    })
  }

  // Handle THPTQG calculate (4 subjects: Toan, Van + 2 electives)
  const handleCalculate = async (e) => {
    if (e) e.preventDefault()
    setError('')

    // 1. Kiểm tra môn Toán (bắt buộc)
    const toanVal =
      scores.toan !== '' && scores.toan !== undefined
        ? parseFloat(String(scores.toan).replace(',', '.'))
        : NaN
    if (isNaN(toanVal)) {
      setError('Vui lòng nhập điểm môn Toán (môn thi bắt buộc).')
      return
    }
    if (toanVal < 0 || toanVal > 10) {
      setError('Điểm môn Toán không hợp lệ (phải từ 0 đến 10).')
      return
    }

    // 2. Kiểm tra môn Ngữ văn (bắt buộc)
    const vanVal =
      scores.van !== '' && scores.van !== undefined
        ? parseFloat(String(scores.van).replace(',', '.'))
        : NaN
    if (isNaN(vanVal)) {
      setError('Vui lòng nhập điểm môn Ngữ văn (môn thi bắt buộc).')
      return
    }
    if (vanVal < 0 || vanVal > 10) {
      setError('Điểm môn Ngữ văn không hợp lệ (phải từ 0 đến 10).')
      return
    }

    // 3. Kiểm tra môn tự chọn: phải đúng 2 môn
    const chosen = []
    for (const m of TU_CHON) {
      const val = scores[m.key]
      if (val !== '' && val !== undefined && val !== null) {
        const num = parseFloat(String(val).replace(',', '.'))
        if (isNaN(num) || num < 0 || num > 10) {
          setError(`Điểm môn ${m.label} không hợp lệ (phải từ 0 đến 10).`)
          return
        }
        chosen.push({ key: m.key, label: m.label, score: num })
      }
    }

    if (chosen.length !== 2) {
      setError(`Quy chế thi THPT yêu cầu chọn đúng 2 môn tự chọn (hiện tại: ${chosen.length}/2 môn).`)
      return
    }

    setLoading(true)
    try {
      const params = {
        toan: toanVal,
        van: vanVal,
        [chosen[0].key]: chosen[0].score,
        [chosen[1].key]: chosen[1].score,
      }
      const response = await getRanking(params)
      setResult(response.data.data)
    } catch (err) {
      console.error('Error calculating THPTQG ranking:', err)
      setError(
        err.response?.data?.error ||
        'Không thể tính thứ hạng THPTQG. Vui lòng kiểm tra kết nối và thử lại.'
      )
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Handle HSA query
  const handleHsaCalculate = async (e) => {
    if (e) e.preventDefault()
    if (hsaScore === '' || hsaScore === undefined) {
      setErrorHsa('Vui lòng nhập điểm thi HSA.')
      return
    }

    const numScore = parseFloat(String(hsaScore).replace(',', '.'))
    if (isNaN(numScore) || numScore < 0 || numScore > 150) {
      setErrorHsa('Điểm thi HSA phải là số từ 0 đến 150.')
      return
    }

    setLoadingHsa(true)
    setErrorHsa('')
    try {
      const response = await getHsaRanking({
        your_score: numScore,
        exam_id: selectedExamId,
      })
      setHsaResult(response.data.data)
    } catch (err) {
      console.error('Error querying HSA ranking:', err)
      setErrorHsa(
        err.response?.data?.error ||
        'Không thể tra cứu xếp hạng điểm HSA từ cổng Tuyensinh247 lúc này. Vui lòng thử lại sau.'
      )
      setHsaResult(null)
    } finally {
      setLoadingHsa(false)
    }
  }

  // Handle TSA query
  const handleTsaCalculate = async (e) => {
    if (e) e.preventDefault()
    if (tsaScore === '' || tsaScore === undefined) {
      setErrorTsa('Vui lòng nhập điểm thi TSA.')
      return
    }

    const numScore = parseFloat(String(tsaScore).replace(',', '.'))
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      setErrorTsa('Điểm thi TSA phải là số từ 0 đến 100.')
      return
    }

    setLoadingTsa(true)
    setErrorTsa('')
    try {
      const response = await getTsaRanking({
        your_score: numScore,
        exam_id: selectedTsaExamId,
      })
      setTsaResult(response.data.data)
    } catch (err) {
      console.error('Error querying TSA ranking:', err)
      setErrorTsa(
        err.response?.data?.error ||
        'Không thể tra cứu xếp hạng điểm TSA từ cổng Tuyensinh247 lúc này. Vui lòng thử lại sau.'
      )
      setTsaResult(null)
    } finally {
      setLoadingTsa(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tra cứu thứ hạng</h1>
            <p className="text-sm text-muted-foreground">
              Tra cứu vị trí xếp hạng điểm thi THPTQG, Đánh giá năng lực ĐHQGHN (HSA) và Đánh giá tư duy ĐHBKHN (TSA)
            </p>
          </div>
        </div>
      </div>

      {/* Segmented View Switcher: 3 Tabs */}
      <div className="flex border-b border-border pb-1 overflow-x-auto">
        <div className="inline-flex rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => setActiveTab('thptqg')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'thptqg'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Thứ hạng THPTQG
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hsa')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'hsa'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Award className="h-4 w-4" />
            Thứ hạng ĐGNL - HSA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tsa')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'tsa'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Thứ hạng ĐGTD - TSA
          </button>
        </div>
      </div>

      {/* SECTION 1: THỨ HẠNG THPTQG */}
      {activeTab === 'thptqg' && (
        <div className="space-y-6">
          {/* Rules Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900 shadow-2xs dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <Info className="h-5 w-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="space-y-1">
              <div className="font-semibold text-blue-950 dark:text-blue-100">
                Quy chế thi tốt nghiệp THPT (Chương trình GDPT 2018)
              </div>
              <p className="text-xs sm:text-sm text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                Thí sinh thi <strong>4 môn</strong> gồm: <strong>2 môn bắt buộc</strong> (Toán, Ngữ văn) và <strong>đúng 2 môn tự chọn</strong> trong số 7 môn (Vật lí, Hóa học, Sinh học, Lịch sử, Địa lí, Ngoại ngữ, Tin học). Thang điểm mỗi môn từ 0 đến 10 (tổng điểm tối đa 40 điểm). Hệ thống sẽ tự động khóa các môn tự chọn còn lại khi bạn đã nhập đủ 2 môn.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Input Form Column (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-5">
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        Nhập điểm 4 môn thi THPT
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Nhập 2 môn bắt buộc + chọn đúng 2 môn tự chọn
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetThpt}
                      className="text-xs h-8 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Đặt lại
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  <form onSubmit={handleCalculate} className="space-y-5">
                    {/* KHỐI 1: MÔN BẮT BUỘC */}
                    <div className="space-y-3 p-3.5 rounded-xl bg-muted/40 border border-border/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                            1
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            Môn thi bắt buộc (2 môn)
                          </span>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          Bắt buộc
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        {BAT_BUOC.map((mon) => {
                          const hasValue = scores[mon.key] !== '' && scores[mon.key] !== undefined
                          const fieldError = fieldErrors[mon.key]
                          return (
                            <div key={mon.key} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <Label htmlFor={`thpt-${mon.key}`} className="flex items-center gap-1.5 font-medium cursor-pointer">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mon.color }} />
                                  <span>{mon.label}</span>
                                  <span className="text-red-500 font-bold">*</span>
                                </Label>
                                {hasValue && (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                                    <Check className="h-3 w-3" /> Đã nhập
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <Input
                                  id={`thpt-${mon.key}`}
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0.0 - 10.0"
                                  value={scores[mon.key] ?? ''}
                                  onChange={(e) => handleScoreChange(mon.key, e.target.value)}
                                  className={`h-9 pr-8 text-sm ${fieldError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                />
                                {hasValue && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearSubject(mon.key)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                                    title={`Xóa điểm ${mon.label}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              {fieldError && (
                                <p className="text-[11px] text-red-600 dark:text-red-400">{fieldError}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* KHỐI 2: MÔN TỰ CHỌN */}
                    <div className="space-y-3 p-3.5 rounded-xl bg-muted/40 border border-border/80">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                            2
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            Môn thi tự chọn (Chọn đúng 2 môn)
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 self-start sm:self-auto">
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                              electiveCount === 2
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60'
                                : electiveCount === 1
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            Đã chọn: {electiveCount}/2 môn
                          </span>
                        </div>
                      </div>

                      {/* Gợi ý tổ hợp nhanh */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] text-muted-foreground font-medium">Gợi ý tổ hợp phổ biến:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_PRESETS.map((preset) => {
                            const isCurrentActive =
                              selectedElectives.length === 2 &&
                              preset.keys.every((k) => selectedElectives.includes(k))
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => handleApplyPreset(preset.keys)}
                                className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                                  isCurrentActive
                                    ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-2xs'
                                    : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                                }`}
                              >
                                {preset.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Danh sách 7 môn tự chọn */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {TU_CHON.map((mon) => {
                          const isSelected = selectedElectives.includes(mon.key)
                          const hasValue = scores[mon.key] !== '' && scores[mon.key] !== undefined
                          const isDisabled = isElectiveLimitReached && !isSelected
                          const fieldError = fieldErrors[mon.key]

                          return (
                            <div
                              key={mon.key}
                              className={`p-2.5 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-background border-primary/50 shadow-2xs ring-1 ring-primary/20'
                                  : isDisabled
                                  ? 'bg-muted/30 border-border/40 opacity-60'
                                  : 'bg-background/80 border-border/70 hover:border-border'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <Label
                                  htmlFor={`thpt-${mon.key}`}
                                  className={`flex items-center gap-1.5 font-medium ${
                                    isDisabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'
                                  }`}
                                >
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: mon.color, opacity: isDisabled ? 0.4 : 1 }}
                                  />
                                  <span>{mon.label}</span>
                                </Label>
                                {isSelected ? (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40">
                                    Đã chọn
                                  </span>
                                ) : isDisabled ? (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Lock className="h-2.5 w-2.5" /> Đã khóa
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Tùy chọn</span>
                                )}
                              </div>

                              <div className="relative">
                                <Input
                                  id={`thpt-${mon.key}`}
                                  type="text"
                                  inputMode="decimal"
                                  disabled={isDisabled}
                                  placeholder={isDisabled ? 'Đã đủ 2 môn tự chọn' : '0.0 - 10.0'}
                                  value={scores[mon.key] ?? ''}
                                  onChange={(e) => handleScoreChange(mon.key, e.target.value)}
                                  className={`h-8 pr-7 text-xs ${
                                    isDisabled
                                      ? 'bg-muted/50 cursor-not-allowed placeholder:text-muted-foreground/60'
                                      : fieldError
                                      ? 'border-red-500'
                                      : ''
                                  }`}
                                />
                                {hasValue && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearSubject(mon.key)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                                    title={`Xóa điểm ${mon.label}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {fieldError && (
                                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{fieldError}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {isElectiveLimitReached && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Bạn đã chọn đủ 2 môn tự chọn. Nhấn biểu tượng <span className="font-semibold text-foreground">✕</span> ở môn đã chọn nếu muốn đổi sang môn khác.
                          </span>
                        </p>
                      )}
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-10 font-semibold"
                      disabled={loading || electiveCount !== 2 || scores.toan === '' || scores.van === ''}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      {loading ? 'Đang tính toán thứ hạng...' : 'Tính thứ hạng THPTQG (4 môn)'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Results Column (5 cols on lg) */}
            <div className="lg:col-span-5">
              <Card className="border-border shadow-xs sticky top-4">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Kết quả xếp hạng THPTQG
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Thứ hạng và phổ điểm toàn quốc trên thang điểm 40
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {result ? (
                    <div className="space-y-5">
                      {/* 4 Stats Cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 bg-primary/5 border border-primary/15 rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                            #{result.thuHang.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5">Thứ hạng toàn quốc</div>
                        </div>
                        <div className="p-3.5 bg-muted/60 border border-border rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
                            {result.tongDiem.toFixed(2)}
                            <span className="text-xs text-muted-foreground font-normal ml-1">/ 40</span>
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5">Tổng điểm 4 môn</div>
                        </div>
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                            Top {result.tyLePhanTram}%
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5">Vị trí tương đối</div>
                        </div>
                        <div className="p-3.5 bg-muted/60 border border-border rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
                            {result.tongThiSinh.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5">Tổng thí sinh</div>
                        </div>
                      </div>

                      {/* Chi tiết 4 môn */}
                      <div className="p-3.5 border rounded-xl bg-muted/20 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">Điểm 4 môn đã nhập:</span>
                          <span className="text-[11px] text-muted-foreground">2 bắt buộc + 2 tự chọn</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(result.diemNhap).map(([key, value]) => {
                            if (value === null || value === undefined) return null
                            const mon = monHoc.find((m) => m.key === key)
                            const isBatBuoc = key === 'toan' || key === 'van'
                            return (
                              <div
                                key={key}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-background text-xs"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: mon?.color }} />
                                  <span className="font-medium truncate">{mon?.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                  <span className="font-bold text-foreground">{value}</span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                      isBatBuoc
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                        : 'bg-primary/10 text-primary'
                                    }`}
                                  >
                                    {isBatBuoc ? 'Bắt buộc' : 'Tự chọn'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Phổ điểm toàn quốc Recharts */}
                      {result.phanBoDiem && result.phanBoDiem.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <BarChart3 className="h-3.5 w-3.5 text-primary" />
                              Phổ điểm toàn quốc (Thang 40):
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Thí sinh
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Bạn
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={result.phanBoDiem} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="khoang_diem" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip
                                  formatter={(value) => [Number(value).toLocaleString() + ' thí sinh', 'Số lượng']}
                                  labelFormatter={(label) => `Khoảng điểm: ${label}`}
                                />
                                <Bar dataKey="so_thi_sinh" radius={[4, 4, 0, 0]}>
                                  {result.phanBoDiem.map((entry, index) => {
                                    const [min, max] = entry.khoang_diem.split('-').map(Number)
                                    const isUserBin =
                                      result.tongDiem >= min && (max === 40 ? result.tongDiem <= max : result.tongDiem < max)
                                    return (
                                      <Cell
                                        key={`thpt-cell-${index}`}
                                        fill={isUserBin ? '#f59e0b' : '#3b82f6'}
                                      />
                                    )
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground space-y-3">
                      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Chưa có kết quả</p>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                          Nhập điểm 2 môn bắt buộc (Toán, Văn) và chọn 2 môn tự chọn, sau đó nhấn &quot;Tính thứ hạng THPTQG&quot;
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: THỨ HẠNG ĐGNL - HSA */}
      {activeTab === 'hsa' && (
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
            <div className="space-y-1">
              <span className="font-semibold">Tra cứu thứ hạng thi Đánh giá năng lực ĐHQGHN (HSA)</span>
              <p className="text-xs text-blue-700">
                Thang điểm HSA tối đa 150 điểm. Dữ liệu xếp hạng và phổ điểm được đối chiếu từ cổng phân tích phổ điểm Tuyensinh247.com theo từng đợt thi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Card */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Nhập thông tin thi HSA
                  </CardTitle>
                  <CardDescription>
                    Chọn đợt thi và nhập điểm số bài thi HSA của bạn (0 - 150)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleHsaCalculate} className="space-y-5">
                    {/* Select Exam Batch */}
                    <div className="space-y-2">
                      <Label htmlFor="hsa-exam" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Đợt thi HSA
                      </Label>
                      <select
                        id="hsa-exam"
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {hsaExams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name} {exam.isDefault ? '(Mới nhất)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Input Score */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="hsa-score" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Calculator className="h-3.5 w-3.5" />
                          Điểm thi của bạn
                        </Label>
                        <span className="text-xs text-muted-foreground">Thang điểm: 0 - 150</span>
                      </div>
                      <Input
                        id="hsa-score"
                        type="number"
                        step="0.5"
                        min="0"
                        max="150"
                        placeholder="Ví dụ: 95.5 hoặc 102"
                        value={hsaScore}
                        onChange={(e) => {
                          setHsaScore(e.target.value)
                          if (errorHsa) setErrorHsa('')
                        }}
                        className="text-base font-semibold"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground font-medium">Gợi ý mốc điểm nhanh:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[75, 85, 90, 95, 100, 110, 120].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setHsaScore(String(preset))
                              if (errorHsa) setErrorHsa('')
                            }}
                            className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            {preset}đ
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loadingHsa}>
                      <Search className="h-4 w-4 mr-2" />
                      {loadingHsa ? 'Đang tra cứu Tuyensinh247...' : 'Tra cứu thứ hạng HSA'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Note Card */}
              <Card className="bg-muted/40 border-dashed">
                <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    <span>Lưu ý về thứ hạng HSA:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Thứ hạng được xác định trực tiếp trên phổ điểm thí sinh của đợt thi đã chọn.</li>
                    <li>Chưa bao gồm điểm ưu tiên đối tượng, khu vực hay điểm thưởng xét tuyển riêng của từng trường.</li>
                    <li>
                      Nguồn dữ liệu:{' '}
                      <a
                        href="https://diemthi.tuyensinh247.com/tra-cuu-xep-hang-diem-thi.html?phuongthuc=HSA"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-0.5 hover:text-primary/80"
                      >
                        Tuyensinh247.com <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Result Card */}
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Kết quả xếp hạng ĐGNL (HSA)</span>
                    {hsaResult && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                        {hsaResult.examName}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errorHsa && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{errorHsa}</span>
                    </div>
                  )}

                  {loadingHsa && (
                    <div className="text-center py-14 space-y-3">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Đang kết nối và lấy phổ điểm từ Tuyensinh247...
                      </p>
                    </div>
                  )}

                  {!loadingHsa && hsaResult && (
                    <div className="space-y-6">
                      {/* Top KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                            #{hsaResult.thuHangTu.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Thứ hạng ước tính</div>
                        </div>

                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                            Top {hsaResult.tyLePhanTram}%
                          </div>
                          <div className="text-xs text-emerald-800 mt-1 font-medium">Vị trí năng lực</div>
                        </div>

                        <div className="p-3.5 bg-muted/60 border border-border rounded-xl text-center">
                          <div className="text-xl sm:text-2xl font-bold text-foreground">
                            {hsaResult.from} - {hsaResult.to}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Khoảng điểm phổ</div>
                        </div>

                        <div className="p-3.5 bg-muted/60 border border-border rounded-xl text-center">
                          <div className="text-xl sm:text-2xl font-bold text-foreground">
                            {hsaResult.tongThiSinh.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Tổng số thí sinh</div>
                        </div>
                      </div>

                      {/* Detailed Breakdown */}
                      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Phân bố thí sinh so với điểm {hsaResult.diem} của bạn
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-lg bg-red-50/70 border border-red-100">
                            <span className="text-xs text-red-700 font-medium">Điểm cao hơn bạn</span>
                            <span className="text-lg font-bold text-red-700">
                              {hsaResult.larger.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-red-600/80">
                              ({hsaResult.tongThiSinh > 0 ? ((hsaResult.larger / hsaResult.tongThiSinh) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-lg bg-blue-50/70 border border-blue-100">
                            <span className="text-xs text-blue-700 font-medium">Cùng khoảng điểm</span>
                            <span className="text-lg font-bold text-blue-700">
                              {hsaResult.same.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-blue-600/80">
                              ({hsaResult.tongThiSinh > 0 ? ((hsaResult.same / hsaResult.tongThiSinh) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                            <span className="text-xs text-emerald-700 font-medium">Điểm thấp hơn bạn</span>
                            <span className="text-lg font-bold text-emerald-700">
                              {hsaResult.smaller.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-emerald-600/80">
                              ({hsaResult.tongThiSinh > 0 ? ((hsaResult.smaller / hsaResult.tongThiSinh) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>

                        {/* Visual Ratio Bar */}
                        {hsaResult.tongThiSinh > 0 && (
                          <div className="pt-2 space-y-1.5">
                            <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                              <div
                                style={{ width: `${(hsaResult.smaller / hsaResult.tongThiSinh) * 100}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Điểm thấp hơn: ${hsaResult.smaller.toLocaleString()}`}
                              />
                              <div
                                style={{ width: `${Math.max(1, (hsaResult.same / hsaResult.tongThiSinh) * 100)}%` }}
                                className="bg-blue-500 h-full"
                                title={`Cùng khoảng điểm: ${hsaResult.same.toLocaleString()}`}
                              />
                              <div
                                style={{ width: `${(hsaResult.larger / hsaResult.tongThiSinh) * 100}%` }}
                                className="bg-rose-400 h-full"
                                title={`Điểm cao hơn: ${hsaResult.larger.toLocaleString()}`}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Thấp hơn ({((hsaResult.smaller / hsaResult.tongThiSinh) * 100).toFixed(1)}%)
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Cùng khoảng ({((hsaResult.same / hsaResult.tongThiSinh) * 100).toFixed(1)}%)
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Cao hơn ({((hsaResult.larger / hsaResult.tongThiSinh) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* View Mode Toggle: Interactive Chart or Official Image */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Dạng hiển thị phổ điểm:
                          </span>
                          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => setHsaDisplayMode('both')}
                              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                hsaDisplayMode === 'both' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Tất cả
                            </button>
                            <button
                              type="button"
                              onClick={() => setHsaDisplayMode('chart')}
                              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                hsaDisplayMode === 'chart' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <BarChart3 className="h-3 w-3 inline mr-1" />
                              Biểu đồ cột
                            </button>
                            <button
                              type="button"
                              onClick={() => setHsaDisplayMode('image')}
                              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                hsaDisplayMode === 'image' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <ImageIcon className="h-3 w-3 inline mr-1" />
                              Ảnh gốc
                            </button>
                          </div>
                        </div>

                        {hsaResult.image && (
                          <a
                            href={hsaResult.image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                          >
                            Xem ảnh gốc <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {/* 1. INTERACTIVE BAR CHART OF SCORE DISTRIBUTION */}
                      {(hsaDisplayMode === 'both' || hsaDisplayMode === 'chart') && hsaResult.phanBoDiem && hsaResult.phanBoDiem.length > 0 && (
                        <div className="rounded-xl border border-border p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <BarChart3 className="h-3.5 w-3.5 text-primary" />
                              Biểu đồ phổ điểm thi HSA ({hsaResult.examName})
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              Cột cam: Khoảng điểm của bạn ({hsaResult.from} - {hsaResult.to}đ)
                            </span>
                          </div>

                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                              data={hsaResult.phanBoDiem}
                              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                              <XAxis
                                dataKey="khoang_diem"
                                tick={{ fontSize: 10 }}
                                interval={1}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null
                                  const item = payload[0].payload
                                  const isUser = (hsaResult.from === item.from && hsaResult.to === item.to) ||
                                    (hsaResult.diem >= item.from && hsaResult.diem < item.to)
                                  return (
                                    <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md text-xs space-y-1">
                                      <p className="font-semibold text-popover-foreground">
                                        Khoảng điểm: {item.khoang_diem}
                                      </p>
                                      <p className="text-muted-foreground">
                                        Số thí sinh: <b className="text-foreground">{item.so_thi_sinh.toLocaleString()}</b>
                                        {hsaResult.tongThiSinh > 0 && (
                                          <span className="ml-1 text-[11px] text-muted-foreground">
                                            ({((item.so_thi_sinh / hsaResult.tongThiSinh) * 100).toFixed(1)}%)
                                          </span>
                                        )}
                                      </p>
                                      {isUser && (
                                        <p className="pt-0.5 text-amber-600 font-semibold flex items-center gap-1">
                                          ★ Điểm của bạn ({hsaResult.diem}đ) nằm trong khoảng này
                                        </p>
                                      )}
                                    </div>
                                  )
                                }}
                              />
                              <Bar dataKey="so_thi_sinh" radius={[4, 4, 0, 0]}>
                                {hsaResult.phanBoDiem.map((entry, index) => {
                                  const isUserBin = (hsaResult.from === entry.from && hsaResult.to === entry.to) ||
                                    (hsaResult.diem >= entry.from && hsaResult.diem < entry.to)
                                  return (
                                    <Cell
                                      key={`hsa-cell-${index}`}
                                      fill={isUserBin ? '#ea580c' : '#2563eb'}
                                    />
                                  )
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>

                          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-xs bg-[#2563eb] inline-block" /> Phổ điểm chung
                            </span>
                            <span className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span className="w-3 h-3 rounded-xs bg-[#ea580c] inline-block" /> Khoảng điểm của bạn ({hsaResult.from} - {hsaResult.to}đ)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 2. OFFICIAL PUBLISHED DISTRIBUTION IMAGE */}
                      {(hsaDisplayMode === 'both' || hsaDisplayMode === 'image') && (
                        <div className="rounded-xl border border-border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5" />
                              Ảnh chụp phổ điểm chính thức ({hsaResult.examName})
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setHsaImgError(false)
                                  setHsaImgLoading(true)
                                  if (hsaImgSrc.startsWith('/images/hsa/')) {
                                    setHsaImgSrc(hsaResult.proxyImage || hsaResult.image)
                                  } else {
                                    setHsaImgSrc(hsaResult.localImage || `/images/hsa/hsa-${hsaResult.examId}.jpg`)
                                  }
                                }}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                title="Tải lại nguồn ảnh"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Đổi nguồn ảnh
                              </Button>
                            </div>
                          </div>

                          <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20 min-h-[260px] flex items-center justify-center p-3">
                            {hsaImgLoading && !hsaImgError && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-xs text-xs text-muted-foreground space-y-2 z-10">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                                <span>Đang tải biểu đồ phổ điểm...</span>
                              </div>
                            )}

                            {hsaImgError ? (
                              <div className="text-center p-6 space-y-3">
                                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">Không thể hiển thị ảnh trực tiếp</p>
                                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                    Ảnh có thể bị chặn bởi trình duyệt hoặc tiện ích chặn quảng cáo. Bạn có thể xem biểu đồ cột tương tác ở trên hoặc mở ảnh trực tiếp tại tab mới.
                                  </p>
                                </div>
                                <div className="flex justify-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setHsaImgError(false)
                                      setHsaImgLoading(true)
                                      setHsaImgSrc(hsaResult.proxyImage || hsaResult.localImage)
                                    }}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                    Tải qua proxy
                                  </Button>
                                  {hsaResult.image && (
                                    <a
                                      href={hsaResult.image}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                      Mở ảnh tại tab mới <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <img
                                src={hsaImgSrc}
                                alt={`Phổ điểm ${hsaResult.examName}`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onLoad={() => setHsaImgLoading(false)}
                                onError={handleHsaImageError}
                                className="max-h-[440px] w-auto max-w-full object-contain rounded transition-all hover:scale-[1.01]"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!loadingHsa && !hsaResult && (
                    <div className="text-center py-14 text-muted-foreground space-y-3">
                      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40" />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Chưa có kết quả tra cứu</p>
                        <p className="text-xs">
                          Chọn đợt thi HSA, nhập điểm thi của bạn ở khung bên trái và bấm &quot;Tra cứu thứ hạng HSA&quot;.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: THỨ HẠNG ĐGTD - TSA */}
      {activeTab === 'tsa' && (
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-sm text-purple-900">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-purple-600" />
            <div className="space-y-1">
              <span className="font-semibold">Tra cứu thứ hạng thi Đánh giá tư duy ĐHBK Hà Nội (TSA)</span>
              <p className="text-xs text-purple-700">
                Thang điểm TSA tối đa 100 điểm. Dữ liệu xếp hạng và phổ điểm được đối chiếu từ cổng phân tích phổ điểm Tuyensinh247.com theo từng đợt thi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Card */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Nhập thông tin thi TSA
                  </CardTitle>
                  <CardDescription>
                    Chọn đợt thi và nhập điểm số bài thi TSA của bạn (0 - 100)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTsaCalculate} className="space-y-5">
                    {/* Select Exam Batch */}
                    <div className="space-y-2">
                      <Label htmlFor="tsa-exam" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Đợt thi TSA
                      </Label>
                      <select
                        id="tsa-exam"
                        value={selectedTsaExamId}
                        onChange={(e) => setSelectedTsaExamId(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {tsaExams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name} {exam.isDefault ? '(Mới nhất)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Input Score */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="tsa-score" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Calculator className="h-3.5 w-3.5" />
                          Điểm thi của bạn
                        </Label>
                        <span className="text-xs text-muted-foreground">Thang điểm: 0 - 100</span>
                      </div>
                      <Input
                        id="tsa-score"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="Ví dụ: 68.5 hoặc 75"
                        value={tsaScore}
                        onChange={(e) => {
                          setTsaScore(e.target.value)
                          if (errorTsa) setErrorTsa('')
                        }}
                        className="text-base font-semibold"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground font-medium">Gợi ý mốc điểm nhanh:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[50, 60, 65, 70, 75, 80, 85, 90].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setTsaScore(String(preset))
                              if (errorTsa) setErrorTsa('')
                            }}
                            className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            {preset}đ
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled={loadingTsa}>
                      <Search className="h-4 w-4 mr-2" />
                      {loadingTsa ? 'Đang tra cứu Tuyensinh247...' : 'Tra cứu thứ hạng TSA'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Note Card */}
              <Card className="bg-muted/40 border-dashed">
                <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="h-3.5 w-3.5 text-purple-600" />
                    <span>Lưu ý về thứ hạng TSA:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Thứ hạng được xác định trực tiếp trên phổ điểm thí sinh của đợt thi TSA đã chọn.</li>
                    <li>Chưa bao gồm điểm ưu tiên đối tượng, khu vực hay điểm thưởng xét tuyển riêng của từng trường.</li>
                    <li>
                      Nguồn dữ liệu:{' '}
                      <a
                        href="https://diemthi.tuyensinh247.com/tra-cuu-xep-hang-diem-thi.html?phuongthuc=TSA"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-0.5 hover:text-primary/80"
                      >
                        Tuyensinh247.com (Phương thức TSA) <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Result Card */}
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Kết quả xếp hạng ĐGTD (TSA)</span>
                    {tsaResult && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                        {tsaResult.examName}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errorTsa && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{errorTsa}</span>
                    </div>
                  )}

                  {loadingTsa && (
                    <div className="text-center py-14 space-y-3">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Đang kết nối và lấy phổ điểm TSA từ Tuyensinh247...
                      </p>
                    </div>
                  )}

                  {!loadingTsa && tsaResult && (
                    <div className="space-y-6">
                      {/* Top KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-purple-700">
                            #{tsaResult.thuHangTu.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Thứ hạng ước tính</div>
                        </div>

                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                            Top {tsaResult.tyLePhanTram}%
                          </div>
                          <div className="text-xs text-emerald-800 mt-1 font-medium">Vị trí năng lực</div>
                        </div>

                        <div className="p-3.5 bg-muted/60 border border-border rounded-xl text-center">
                          <div className="text-xl sm:text-2xl font-bold text-foreground">
                            {tsaResult.from} - {tsaResult.to}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Khoảng điểm phổ</div>
                        </div>

                        <div className="p-3.5 bg-muted/60 border border-border rounded-xl text-center">
                          <div className="text-xl sm:text-2xl font-bold text-foreground">
                            {tsaResult.tongThiSinh.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Tổng số thí sinh</div>
                        </div>
                      </div>

                      {/* Detailed Breakdown */}
                      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Phân bố thí sinh so với điểm {tsaResult.diem} của bạn
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-lg bg-red-50/70 border border-red-100">
                            <span className="text-xs text-red-700 font-medium">Điểm cao hơn bạn</span>
                            <span className="text-lg font-bold text-red-700">
                              {tsaResult.larger.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-red-600/80">
                              ({tsaResult.tongThiSinh > 0 ? ((tsaResult.larger / tsaResult.tongThiSinh) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-lg bg-purple-50/70 border border-purple-100">
                            <span className="text-xs text-purple-700 font-medium">Cùng khoảng điểm</span>
                            <span className="text-lg font-bold text-purple-700">
                              {tsaResult.same.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-purple-600/80">
                              ({tsaResult.tongThiSinh > 0 ? ((tsaResult.same / tsaResult.tongThiSinh) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                            <span className="text-xs text-emerald-700 font-medium">Điểm thấp hơn bạn</span>
                            <span className="text-lg font-bold text-emerald-700">
                              {tsaResult.smaller.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-emerald-600/80">
                              ({tsaResult.tongThiSinh > 0 ? ((tsaResult.smaller / tsaResult.tongThiSinh) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>

                        {/* Visual Ratio Bar */}
                        {tsaResult.tongThiSinh > 0 && (
                          <div className="pt-2 space-y-1.5">
                            <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                              <div
                                style={{ width: `${(tsaResult.smaller / tsaResult.tongThiSinh) * 100}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Điểm thấp hơn: ${tsaResult.smaller.toLocaleString()}`}
                              />
                              <div
                                style={{ width: `${Math.max(1, (tsaResult.same / tsaResult.tongThiSinh) * 100)}%` }}
                                className="bg-purple-500 h-full"
                                title={`Cùng khoảng điểm: ${tsaResult.same.toLocaleString()}`}
                              />
                              <div
                                style={{ width: `${(tsaResult.larger / tsaResult.tongThiSinh) * 100}%` }}
                                className="bg-rose-400 h-full"
                                title={`Điểm cao hơn: ${tsaResult.larger.toLocaleString()}`}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Thấp hơn ({((tsaResult.smaller / tsaResult.tongThiSinh) * 100).toFixed(1)}%)
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Cùng khoảng ({((tsaResult.same / tsaResult.tongThiSinh) * 100).toFixed(1)}%)
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Cao hơn ({((tsaResult.larger / tsaResult.tongThiSinh) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* View Mode Toggle: Interactive Chart or Official Image */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Dạng hiển thị phổ điểm:
                          </span>
                          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => setTsaDisplayMode('both')}
                              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                tsaDisplayMode === 'both' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Tất cả
                            </button>
                            <button
                              type="button"
                              onClick={() => setTsaDisplayMode('chart')}
                              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                tsaDisplayMode === 'chart' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <BarChart3 className="h-3 w-3 inline mr-1" />
                              Biểu đồ cột
                            </button>
                            <button
                              type="button"
                              onClick={() => setTsaDisplayMode('image')}
                              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                tsaDisplayMode === 'image' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <ImageIcon className="h-3 w-3 inline mr-1" />
                              Ảnh gốc
                            </button>
                          </div>
                        </div>

                        {tsaResult.image && (
                          <a
                            href={tsaResult.image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                          >
                            Xem ảnh gốc <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {/* 1. INTERACTIVE BAR CHART OF SCORE DISTRIBUTION */}
                      {(tsaDisplayMode === 'both' || tsaDisplayMode === 'chart') && tsaResult.phanBoDiem && tsaResult.phanBoDiem.length > 0 && (
                        <div className="rounded-xl border border-border p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <BarChart3 className="h-3.5 w-3.5 text-purple-600" />
                              Biểu đồ phổ điểm thi TSA ({tsaResult.examName})
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              Cột cam: Khoảng điểm của bạn ({tsaResult.from} - {tsaResult.to}đ)
                            </span>
                          </div>

                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                              data={tsaResult.phanBoDiem}
                              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                              <XAxis
                                dataKey="khoang_diem"
                                tick={{ fontSize: 9 }}
                                interval={2}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null
                                  const item = payload[0].payload
                                  const isUser = (tsaResult.from === item.from && tsaResult.to === item.to) ||
                                    (tsaResult.diem >= item.from && tsaResult.diem < item.to)
                                  return (
                                    <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md text-xs space-y-1">
                                      <p className="font-semibold text-popover-foreground">
                                        Khoảng điểm: {item.khoang_diem}
                                      </p>
                                      <p className="text-muted-foreground">
                                        Số thí sinh: <b className="text-foreground">{item.so_thi_sinh.toLocaleString()}</b>
                                        {tsaResult.tongThiSinh > 0 && (
                                          <span className="ml-1 text-[11px] text-muted-foreground">
                                            ({((item.so_thi_sinh / tsaResult.tongThiSinh) * 100).toFixed(1)}%)
                                          </span>
                                        )}
                                      </p>
                                      {isUser && (
                                        <p className="pt-0.5 text-amber-600 font-semibold flex items-center gap-1">
                                          ★ Điểm của bạn ({tsaResult.diem}đ) nằm trong khoảng này
                                        </p>
                                      )}
                                    </div>
                                  )
                                }}
                              />
                              <Bar dataKey="so_thi_sinh" radius={[4, 4, 0, 0]}>
                                {tsaResult.phanBoDiem.map((entry, index) => {
                                  const isUserBin = (tsaResult.from === entry.from && tsaResult.to === entry.to) ||
                                    (tsaResult.diem >= entry.from && tsaResult.diem < entry.to)
                                  return (
                                    <Cell
                                      key={`tsa-cell-${index}`}
                                      fill={isUserBin ? '#ea580c' : '#7c3aed'}
                                    />
                                  )
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>

                          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-xs bg-[#7c3aed] inline-block" /> Phổ điểm chung TSA
                            </span>
                            <span className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span className="w-3 h-3 rounded-xs bg-[#ea580c] inline-block" /> Khoảng điểm của bạn ({tsaResult.from} - {tsaResult.to}đ)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 2. OFFICIAL PUBLISHED DISTRIBUTION IMAGE */}
                      {(tsaDisplayMode === 'both' || tsaDisplayMode === 'image') && (
                        <div className="rounded-xl border border-border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5" />
                              Ảnh chụp phổ điểm chính thức ({tsaResult.examName})
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTsaImgError(false)
                                  setTsaImgLoading(true)
                                  if (tsaImgSrc.startsWith('/images/tsa/')) {
                                    setTsaImgSrc(tsaResult.proxyImage || tsaResult.image)
                                  } else {
                                    const isJpg = tsaResult.examId === 23 || tsaResult.examId === 4
                                    setTsaImgSrc(tsaResult.localImage || `/images/tsa/tsa-${tsaResult.examId}.${isJpg ? 'jpg' : 'png'}`)
                                  }
                                }}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                title="Tải lại nguồn ảnh"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Đổi nguồn ảnh
                              </Button>
                            </div>
                          </div>

                          <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20 min-h-[260px] flex items-center justify-center p-3">
                            {tsaImgLoading && !tsaImgError && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-xs text-xs text-muted-foreground space-y-2 z-10">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-r-transparent" />
                                <span>Đang tải biểu đồ phổ điểm TSA...</span>
                              </div>
                            )}

                            {tsaImgError ? (
                              <div className="text-center p-6 space-y-3">
                                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">Không thể hiển thị ảnh trực tiếp</p>
                                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                    Ảnh có thể bị chặn bởi trình duyệt hoặc tiện ích chặn quảng cáo. Bạn có thể xem biểu đồ cột tương tác ở trên hoặc mở ảnh trực tiếp tại tab mới.
                                  </p>
                                </div>
                                <div className="flex justify-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setTsaImgError(false)
                                      setTsaImgLoading(true)
                                      setTsaImgSrc(tsaResult.proxyImage || tsaResult.localImage)
                                    }}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                    Tải qua proxy
                                  </Button>
                                  {tsaResult.image && (
                                    <a
                                      href={tsaResult.image}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700"
                                    >
                                      Mở ảnh tại tab mới <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <img
                                src={tsaImgSrc}
                                alt={`Phổ điểm ${tsaResult.examName}`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onLoad={() => setTsaImgLoading(false)}
                                onError={handleTsaImageError}
                                className="max-h-[440px] w-auto max-w-full object-contain rounded transition-all hover:scale-[1.01]"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!loadingTsa && !tsaResult && (
                    <div className="text-center py-14 text-muted-foreground space-y-3">
                      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40" />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Chưa có kết quả tra cứu</p>
                        <p className="text-xs">
                          Chọn đợt thi TSA, nhập điểm thi của bạn ở khung bên trái và bấm &quot;Tra cứu thứ hạng TSA&quot;.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
