import { useState, useEffect } from 'react'
import {
  Wrench,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  Eye,
  Activity,
  Flame,
  Volume2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { factoryAudio } from './FactoryAudio'

export default function CabinetTroubleshooter({ roundData, onComplete, onDowntimeTick }) {
  const [doorOpen, setDoorOpen] = useState(false)
  const [activeTool, setActiveTool] = useState(null) // 'vom' | 'inspect' | null
  const [vomMeasured, setVomMeasured] = useState(false)
  const [plcInspected, setPlcInspected] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [isResolved, setIsResolved] = useState(false)

  const [timeLeft, setTimeLeft] = useState(roundData?.timeLimitSeconds || 75)
  const [downtimeCost, setDowntimeCost] = useState(0)

  // Timer loop for countdown and downtime cost
  useEffect(() => {
    if (isResolved) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
      setDowntimeCost((cost) => {
        const next = cost + (roundData?.downtimeCostPerSecond || 50000)
        onDowntimeTick?.(next)
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isResolved, onDowntimeTick, roundData?.downtimeCostPerSecond])

  // Periodic alarm sound when issue is unresolved
  useEffect(() => {
    if (isResolved) return
    const alarmInterval = setInterval(() => {
      factoryAudio.playAlarm()
    }, 4500)
    return () => clearInterval(alarmInterval)
  }, [isResolved])

  const handleOpenDoor = () => {
    factoryAudio.playClick()
    setDoorOpen(true)
  }

  const handleUseVom = () => {
    factoryAudio.playClick()
    setActiveTool('vom')
    setVomMeasured(true)
  }

  const handleInspectPlc = () => {
    factoryAudio.playClick()
    setActiveTool('inspect')
    setPlcInspected(true)
  }

  const handleSelectOption = (opt) => {
    factoryAudio.playClick()
    setSelectedOption(opt.id)

    if (opt.isCorrect) {
      factoryAudio.playSuccess()
      setIsResolved(true)
      setFeedback({
        type: 'success',
        text: opt.feedback,
      })
      onComplete?.({
        roundId: roundData.roundId,
        score: Math.max(100, (roundData.expReward || 350) - Math.floor(downtimeCost / 100000)),
        downtimeSaved: Math.max(0, 15000000 - downtimeCost),
        badge: roundData.badgeAwarded,
        linkedCourse: roundData.linkedCourse,
      })
    } else {
      factoryAudio.playError()
      setDowntimeCost((c) => c + 1500000) // 1.5M VND penalty
      setFeedback({
        type: 'error',
        text: opt.feedback,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Alarm Banner */}
      <div
        className={`rounded-xl border p-4 transition-all ${
          isResolved
            ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
            : 'border-red-500/60 bg-red-950/60 text-red-200 animate-pulse'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                isResolved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {isResolved ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6 animate-bounce" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-base">
                {isResolved
                  ? 'SỰ CỐ ĐÃ KHẮC PHỤC THÀNH CÔNG!'
                  : 'BÁO ĐỘNG ĐỎ: DÂY CHUYỀN ĐÓNG NẮP DỪNG ĐỘT NGỘT!'}
              </h4>
              <p className="text-xs text-slate-300">{roundData?.faultStory}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-md bg-slate-900/80 px-3 py-1.5 border border-slate-700 text-center font-mono">
              <span className="block text-[10px] uppercase text-slate-400">Thời gian còn lại</span>
              <span className={`text-lg font-bold ${timeLeft <= 20 ? 'text-red-400' : 'text-amber-300'}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="rounded-md bg-slate-900/80 px-3 py-1.5 border border-slate-700 text-center font-mono">
              <span className="block text-[10px] uppercase text-slate-400">Thiệt hại gián đoạn</span>
              <span className="text-lg font-bold text-red-400">
                {downtimeCost.toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Work Area: Virtual Cabinet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Industrial Cabinet Visual */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border-2 border-slate-800 p-5 shadow-2xl relative overflow-hidden">
          {/* Cabinet Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Tủ Điều Khiển Trung Tâm PLC-CP01
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">24VDC / 3-PHASE 380V</span>
          </div>

          {!doorOpen ? (
            /* Cabinet Door Closed View */
            <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-slate-900/60 rounded-xl border border-dashed border-slate-700">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 shadow-inner">
                <Wrench className="h-8 w-8 text-amber-400" />
              </div>
              <div className="text-center space-y-1">
                <h5 className="text-sm font-semibold text-slate-200">Cửa tủ điện đang đóng khóa an toàn</h5>
                <p className="text-xs text-slate-400 max-w-sm">
                  Là kỹ sư trực ca, bước đầu tiên hãy mở khóa tủ để tiếp cận bộ não điều khiển PLC.
                </p>
              </div>
              <Button
                onClick={handleOpenDoor}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg gap-2"
              >
                <Wrench className="h-4 w-4" /> Mở khóa cánh tủ điện
              </Button>
            </div>
          ) : (
            /* Cabinet Interior View (Open) */
            <div className="space-y-4">
              {/* Top Rail: Power Supply 24VDC & Relays */}
              <div className="grid grid-cols-12 gap-2 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                <div
                  onClick={handleUseVom}
                  className={`col-span-5 p-2.5 rounded border cursor-pointer transition-all ${
                    activeTool === 'vom'
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-cyan-900/40 shadow-md'
                      : 'border-slate-700 bg-slate-800/80 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-200 mb-1">
                    <span>Nguồn SITOP 24V</span>
                    <Zap className="h-3.5 w-3.5 text-yellow-400" />
                  </div>
                  <div className="text-[10px] text-slate-400">Bấm để dùng que đo VOM</div>
                  {vomMeasured && (
                    <div className="mt-2 rounded bg-black px-2 py-1 font-mono text-xs font-bold text-emerald-400 border border-emerald-900">
                      VOM: 24.2 VDC (OK)
                    </div>
                  )}
                </div>

                <div className="col-span-7 p-2.5 rounded border border-slate-700 bg-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-200">Dãy Rơ le OMRON</span>
                    <span className="text-[10px] text-slate-400">Cuộn hút 24VDC đóng cắt</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-4 w-3 rounded-xs ${
                          isResolved ? 'bg-emerald-500' : i === 3 ? 'bg-slate-700' : 'bg-emerald-500/70'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle Rail: SIEMENS S7-1200 PLC Rack */}
              <div
                onClick={handleInspectPlc}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  activeTool === 'inspect'
                    ? 'border-indigo-400 bg-indigo-950/40 shadow-indigo-900/40 shadow-md'
                    : 'border-slate-700 bg-slate-900/90 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-indigo-700 px-2 py-0.5 rounded">
                      SIEMENS
                    </span>
                    <span className="text-xs font-bold text-slate-200">SIMATIC S7-1200 (CPU 1214C)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isResolved ? 'bg-emerald-400' : 'bg-red-500 animate-ping'
                      }`}
                    />
                    <span className="text-[10px] font-mono font-bold text-slate-300">
                      {isResolved ? 'RUN' : 'FAULT / ERROR'}
                    </span>
                  </div>
                </div>

                {/* Digital Inputs LED Indicators */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-mono text-slate-400">
                    Trạng thái ngõ vào số (Digital Inputs %I0.0 - %I0.7):
                  </span>
                  <div className="grid grid-cols-8 gap-1.5">
                    {['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.4', 'I0.5', 'I0.6', 'I0.7'].map(
                      (name, idx) => {
                        const isTarget = name === 'I0.3'
                        const isLit = isResolved ? true : idx !== 3
                        return (
                          <div
                            key={name}
                            className={`rounded p-1.5 text-center border font-mono text-[9px] ${
                              isTarget && !isResolved
                                ? 'border-red-500/80 bg-red-950/60 text-red-300 ring-2 ring-red-500/50'
                                : isLit
                                ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                                : 'border-slate-800 bg-slate-950 text-slate-600'
                            }`}
                          >
                            <span className="block font-bold">{name}</span>
                            <span className="text-[8px]">{isLit ? 'ON' : 'OFF'}</span>
                          </div>
                        )
                      }
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    👉 <strong className="text-amber-300">%I0.3</strong>: Tín hiệu Cảm biến quang định vị chai
                  </div>
                </div>
              </div>

              {/* Status diagnosis prompt */}
              {plcInspected && (
                <div className="p-3 rounded-lg bg-indigo-950/50 border border-indigo-700/50 text-xs text-indigo-200">
                  💡 <strong>Kết quả chẩn đoán:</strong> Đèn ngõ vào <code>%I0.3</code> TẮT ngúm dù chai nước
                  đang nằm ngay trạm đóng nắp! Cảm biến quang đang không gửi tín hiệu về cho PLC.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Decision Panel & Action Options */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Wrench className="h-4 w-4 text-amber-400" />
                <h4 className="font-bold text-sm text-slate-200">Quyết định khắc phục của Kỹ sư</h4>
              </div>

              {!doorOpen ? (
                <p className="text-xs text-slate-400 italic">
                  Vui lòng bấm nút mở cửa tủ điện bên cạnh để bắt đầu thao tác chẩn đoán.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Sau khi soi đèn và đo kiểm, bạn đưa ra phương án xử lý nào để dây chuyền chạy lại an toàn?
                  </p>

                  <div className="space-y-2">
                    {roundData?.interactiveSteps?.[2]?.options?.map((opt) => (
                      <button
                        key={opt.id}
                        disabled={isResolved}
                        onClick={() => handleSelectOption(opt)}
                        className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-start gap-2.5 ${
                          selectedOption === opt.id
                            ? opt.isCorrect
                              ? 'border-emerald-500 bg-emerald-950/60 text-emerald-200'
                              : 'border-red-500 bg-red-950/60 text-red-200'
                            : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                        } disabled:cursor-not-allowed`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-[10px] text-white">
                          {opt.id.replace('opt', '')}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`rounded-lg p-3 text-xs leading-relaxed border ${
                    feedback.type === 'success'
                      ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
                      : 'border-red-500/50 bg-red-950/80 text-red-200'
                  }`}
                >
                  <strong>{feedback.type === 'success' ? '🎯 CHUẨN XÁC: ' : '❌ THẤT BẠI: '}</strong>
                  {feedback.text}
                </div>
              )}

              {/* Course Connection Box */}
              {isResolved && roundData?.linkedCourse && (
                <div className="rounded-lg bg-indigo-950/80 border border-indigo-700/60 p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Môn học áp dụng kiến thức này:</span>
                  </div>
                  <p className="text-slate-300 font-semibold">
                    [{roundData.linkedCourse.code}] {roundData.linkedCourse.name} ({roundData.linkedCourse.credits} tín chỉ)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Đào tạo tại: {roundData.linkedCourse.school}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
