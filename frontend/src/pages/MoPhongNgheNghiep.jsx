import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Gamepad2,
  Briefcase,
  Clock,
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  Building2,
  CheckCircle2,
  Layers,
  GraduationCap,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Search,
  Filter,
  Play,
  Cpu,
  Lock,
  Bot,
  Boxes,
  Activity,
  Rotate3d,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCareerSimulations, getCareerSimulationDetail } from '@/lib/api'
import CasualAutomationGame from '@/components/simulation/CasualAutomationGame'
import RotateDevicePrompt from '@/components/simulation/RotateDevicePrompt'

export default function MoPhongNgheNghiep() {
  const [searchParams, setSearchParams] = useSearchParams()
  const majorFromUrl = searchParams.get('major')

  // Selected major to play (null = show Hub Menu)
  const [selectedMajor, setSelectedMajor] = useState(majorFromUrl || null)

  // List of all industry simulations (Hub data)
  const [simulations, setSimulations] = useState([])
  const [loadingList, setLoadingList] = useState(true)

  // Active game data when a major is chosen
  const [activeSimData, setActiveSimData] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  // Hub Search & Filter
  const [search, setSearch] = useState('')
  const [selectedCluster, setSelectedCluster] = useState('ALL')

  // 1. Fetch all simulations for the Hub Menu
  useEffect(() => {
    let active = true
    setLoadingList(true)
    getCareerSimulations()
      .then((res) => {
        if (!active) return
        setSimulations(res.data.data || [])
      })
      .catch((err) => {
        if (!active) return
        console.error('[MoPhongNgheNghiep] Error loading hub list:', err.message)
      })
      .finally(() => {
        if (active) setLoadingList(false)
      })

    return () => {
      active = false
    }
  }, [])

  // 2. Sync URL params with selected major
  useEffect(() => {
    if (majorFromUrl) {
      setSelectedMajor(majorFromUrl)
    }
  }, [majorFromUrl])

  // 3. Load simulation detail when a playable major is chosen
  useEffect(() => {
    if (!selectedMajor) {
      setActiveSimData(null)
      return
    }

    let active = true
    setLoadingDetail(true)
    setError('')

    getCareerSimulationDetail(selectedMajor)
      .then((res) => {
        if (!active) return
        setActiveSimData(res.data.data)
      })
      .catch((err) => {
        if (!active) return
        console.error('[MoPhongNgheNghiep] Error loading detail:', err.message)
        setError('Không thể tải kịch bản mô phỏng. Vui lòng thử lại sau.')
      })
      .finally(() => {
        if (active) setLoadingDetail(false)
      })

    return () => {
      active = false
    }
  }, [selectedMajor])

  const handleSelectMajor = (majorCode) => {
    setSelectedMajor(majorCode)
    setSearchParams({ major: majorCode })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToHub = () => {
    setSelectedMajor(null)
    setSearchParams({})
  }

  // Filtered simulations for Hub Menu
  const filteredSimulations = useMemo(() => {
    return simulations.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.majorName.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase()) ||
        item.majorCode?.toLowerCase().includes(search.toLowerCase())

      const matchCluster =
        selectedCluster === 'ALL' || item.industryCluster === selectedCluster

      return matchSearch && matchCluster
    })
  }, [simulations, search, selectedCluster])

  // Clusters list
  const clusters = useMemo(() => {
    const set = new Set(simulations.map((s) => s.industryCluster).filter(Boolean))
    return ['ALL', ...Array.from(set)]
  }, [simulations])

  // ==================== VIEW 1: PLAYING CASUAL GAME ====================
  if (selectedMajor && (loadingDetail || activeSimData || error)) {
    if (loadingDetail) {
      return (
        <div className="flex flex-col items-center justify-center py-28 text-slate-400 space-y-3">
          <RotateDevicePrompt />
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="text-sm">Đang tải sàn mô phỏng nhanh 5 phút...</p>
        </div>
      )
    }

    if (error || !activeSimData) {
      return (
        <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-red-950/40 border border-red-800 text-center space-y-3 text-red-200">
          <RotateDevicePrompt />
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
          <h3 className="font-bold text-base">{error || 'Không tìm thấy dữ liệu ngành này.'}</h3>
          <Button onClick={handleBackToHub} className="bg-red-700 hover:bg-red-600 text-xs">
            Quay lại menu các ngành
          </Button>
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <RotateDevicePrompt />
        <CasualAutomationGame simData={activeSimData} onBackToHub={handleBackToHub} />
      </div>
    )
  }

  // ==================== VIEW 2: HUB MENU BIỂU THỊ MÔ PHỎNG TỪNG NGÀNH ====================
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <RotateDevicePrompt />
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 px-6 py-8 sm:px-10 sm:py-10 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200 border border-cyan-400/30">
            <Gamepad2 className="h-4 w-4 text-cyan-300" /> Khu trải nghiệm & Mô phỏng nghề nghiệp
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Thử việc 5-10 phút trước khi đăng ký Nguyện vọng!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            Bạn băn khoăn học ngành này ra trường sẽ làm gì? Công việc thực tế sẽ ra sao? Hãy trực
            tiếp nhập vai xử lý các tình huống vui nhộn, giải trí và khám phá độ phù hợp của bản thân.
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-800 bg-slate-900 text-white shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3 justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm ngành nghề mô phỏng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
            />
          </div>

          {/* Cluster filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {clusters.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCluster(c)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCluster === c
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {c === 'ALL' ? 'Tất cả khối ngành' : c}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loadingList && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="text-xs">Đang tải danh mục các ngành mô phỏng...</p>
        </div>
      )}

      {/* Industry Cards Grid */}
      {!loadingList && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSimulations.map((item) => {
            const isPlayable = item.isPlayable || item.status === 'published'

            return (
              <Card
                key={item.majorCode}
                className={`flex flex-col justify-between border transition-all duration-200 shadow-md ${
                  isPlayable
                    ? 'border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 hover:border-cyan-400 hover:shadow-cyan-950/30 hover:shadow-xl'
                    : 'border-slate-800 bg-slate-900/60 opacity-80'
                }`}
              >
                <CardContent className="p-6 space-y-4">
                  {/* Visual Graphic Header */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner ${
                        isPlayable
                          ? 'bg-gradient-to-br from-cyan-500/20 to-indigo-500/30 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {item.majorCode === 'EE-E1' ? (
                        <Rotate3d className="h-6 w-6 text-cyan-300 animate-pulse" />
                      ) : item.majorCode === 'IT-SE' ? (
                        <Cpu className="h-6 w-6 text-indigo-400" />
                      ) : item.majorCode === 'ME-ROBOT' ? (
                        <Bot className="h-6 w-6 text-amber-400" />
                      ) : item.majorCode === 'LOG-01' ? (
                        <Boxes className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <Activity className="h-6 w-6 text-rose-400" />
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isPlayable
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.tag || (isPlayable ? 'Chơi ngay' : 'Sắp ra mắt')}
                    </span>
                  </div>

                  {/* Title & Code */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                      {item.industryCluster}
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 leading-snug">
                      {item.majorName}
                    </h3>
                    {item.majorCode && (
                      <span className="text-[11px] font-mono text-cyan-400 block">
                        Mã ngành: {item.majorCode}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {item.description}
                  </p>

                  {/* Quick Specs */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{item.estimatedMinutes || 5} phút trải nghiệm</span>
                    </div>
                    {item.salaryStart && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="truncate">{item.salaryStart}</span>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Footer Action Button */}
                <div className="p-6 pt-0">
                  {isPlayable ? (
                    <Button
                      onClick={() => handleSelectMajor(item.majorCode)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md gap-2"
                    >
                      <Play className="h-3.5 w-3.5" /> Bắt đầu thử việc (5 phút) <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full border-slate-800 bg-slate-900/40 text-slate-500 text-xs gap-1.5 cursor-not-allowed"
                    >
                      <Lock className="h-3.5 w-3.5" /> Đang hoàn thiện kịch bản
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
