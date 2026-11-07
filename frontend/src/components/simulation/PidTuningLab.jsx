import { useState, useEffect, useRef } from 'react'
import {
  Activity,
  Sliders,
  Flame,
  Wind,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { factoryAudio } from './FactoryAudio'

export default function PidTuningLab({ roundData, onComplete }) {
  const [kp, setKp] = useState(25)
  const [ki, setKi] = useState(10)
  const [kd, setKd] = useState(10)

  const [currentTemp, setCurrentTemp] = useState(165)
  const [isStable, setIsStable] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const canvasRef = useRef(null)
  const historyRef = useRef([]) // Store past 80 temperature points
  const animRef = useRef(null)

  const targetTemp = roundData?.targetValue || 200

  // Thermal physics loop with user's PID values
  useEffect(() => {
    let temp = currentTemp
    let integral = 0
    let lastError = targetTemp - temp

    const interval = setInterval(() => {
      const error = targetTemp - temp
      integral += error * 0.05
      // Anti-windup
      integral = Math.max(-100, Math.min(100, integral))

      const derivative = (error - lastError) / 0.05
      lastError = error

      // PID control output (Heater Power %)
      const pTerm = (kp / 100) * error
      const iTerm = (ki / 100) * integral
      const dTerm = (kd / 100) * derivative
      const output = Math.max(0, Math.min(100, pTerm + iTerm + dTerm))

      // Oven thermal equation: heating + heat dissipation to ambient (25°C)
      const heatLoss = (temp - 25) * 0.015
      const heatGain = output * 0.035
      temp = temp + heatGain - heatLoss

      setCurrentTemp(temp)

      historyRef.current.push(temp)
      if (historyRef.current.length > 100) {
        historyRef.current.shift()
      }

      // Check stability in last 20 frames
      if (historyRef.current.length >= 40) {
        const recent = historyRef.current.slice(-25)
        const maxDiff = Math.max(...recent) - Math.min(...recent)
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length

        if (maxDiff < 2.2 && Math.abs(avg - targetTemp) < 2.0 && !isStable) {
          setIsStable(true)
          factoryAudio.playSuccess()
          setFeedback({
            type: 'success',
            text: 'TUYỆT VỜI! Hệ thống đã đạt trạng thái cân bằng bền vững ở 200°C chuẩn xác, vọt lố đã bị dập tắt!',
          })
          onComplete?.({
            roundId: roundData.roundId,
            score: roundData.expReward || 500,
            badge: roundData.badgeAwarded,
            linkedCourse: roundData.linkedCourse,
          })
        }
      }
    }, 50)

    return () => clearInterval(interval)
  }, [kp, ki, kd, targetTemp, isStable, roundData, onComplete])

  // Canvas graph renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const render = () => {
      const w = canvas.width
      const h = canvas.height

      // Dark background
      ctx.fillStyle = '#0a0f1d'
      ctx.fillRect(0, 0, w, h)

      // Grid lines
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      for (let y = 30; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(40, y)
        ctx.lineTo(w - 20, y)
        ctx.stroke()
      }

      // Target temperature line (200°C) -> Y coordinate mapping
      // Map 100°C..250°C to canvas height
      const mapY = (t) => h - 30 - ((t - 100) / 150) * (h - 60)
      const targetY = mapY(targetTemp)

      // Safe band around 200°C (+/- 2°C)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'
      ctx.fillRect(40, mapY(targetTemp + 3), w - 60, mapY(targetTemp - 3) - mapY(targetTemp + 3))

      // Target line (dashed green)
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(40, targetY)
      ctx.lineTo(w - 20, targetY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#10b981'
      ctx.font = '10px monospace'
      ctx.fillText(`${targetTemp}°C (MỤC TIÊU)`, w - 110, targetY - 6)

      // Draw Temperature Response Curve
      const history = historyRef.current
      if (history.length > 1) {
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2.5
        ctx.beginPath()

        const stepX = (w - 70) / 100
        history.forEach((tempPoint, i) => {
          const x = 40 + i * stepX
          const y = mapY(tempPoint)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [targetTemp])

  const injectDisturbance = () => {
    factoryAudio.playAlarm()
    setCurrentTemp((t) => Math.max(100, t - 35))
    setIsStable(false)
    setFeedback({
      type: 'warning',
      text: 'BÁO ĐỘNG: Cửa lò bất ngờ mở toang! Nhiệt độ sụt nhanh -35°C, hãy quan sát bộ điều khiển PID bù nhiệt!',
    })
  }

  const handleApplyPreset = () => {
    factoryAudio.playClick()
    setKp(60)
    setKi(30)
    setKd(45)
  }

  return (
    <div className="space-y-6">
      {/* Live Graph & Oven View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real-time Oscilloscope Canvas */}
        <div className="lg:col-span-8 rounded-2xl bg-slate-950 border-2 border-slate-800 p-5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold uppercase text-slate-300">
                Đồ Thị Đáp Ứng Nhiệt Độ Thời Gian Thực (Oscilloscope)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">Nhiệt độ hiện tại:</span>
              <span
                className={`text-base font-mono font-bold ${
                  Math.abs(currentTemp - targetTemp) <= 2.5 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {currentTemp.toFixed(1)}°C
              </span>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={600}
            height={260}
            className="w-full h-auto rounded-xl bg-slate-950 border border-slate-900 block"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Dải màu xanh: Vùng nhiệt độ an toàn đạt chuẩn (198°C - 202°C)</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={injectDisturbance}
              className="text-xs border-amber-600/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 gap-1.5 h-8"
            >
              <Wind className="h-3.5 w-3.5 text-amber-400" /> Thử thách: Gió lạnh ùa vào lò (-35°C)
            </Button>
          </div>
        </div>

        {/* PID Tuning Sliders Control Cockpit */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-cyan-400" />
                  <h4 className="font-bold text-sm text-slate-200">Bộ Tham Số Điều Khiển PID</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleApplyPreset}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 p-0 h-auto"
                >
                  ⚡ Gợi ý Mentor
                </Button>
              </div>

              {/* Slider P */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300">Kp (Hệ số tỉ lệ - Phản ứng nhanh)</span>
                  <span className="text-cyan-400 font-bold">{kp}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={kp}
                  onChange={(e) => {
                    factoryAudio.playClick()
                    setKp(Number(e.target.value))
                    setIsStable(false)
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  Càng cao lò nóng càng nhanh, nhưng dễ bị vọt lố (Overshoot) quá nhiệt.
                </span>
              </div>

              {/* Slider I */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300">Ki (Tích phân - Khử sai số tĩnh)</span>
                  <span className="text-indigo-400 font-bold">{ki}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ki}
                  onChange={(e) => {
                    factoryAudio.playClick()
                    setKi(Number(e.target.value))
                    setIsStable(false)
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  Khử triệt để độ lệch nhiệt độ tồn đọng, đưa nhiệt về đúng mốc 200°C.
                </span>
              </div>

              {/* Slider D */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300">Kd (Vi phân - Giảm xóc / Hãm vọt)</span>
                  <span className="text-emerald-400 font-bold">{kd}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={kd}
                  onChange={(e) => {
                    factoryAudio.playClick()
                    setKd(Number(e.target.value))
                    setIsStable(false)
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  Dự đoán xu hướng và ghìm dao động, chống rung lắc kim đo.
                </span>
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`rounded-lg p-3 text-xs leading-relaxed border ${
                    feedback.type === 'success'
                      ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
                      : 'border-amber-500/50 bg-amber-950/80 text-amber-200'
                  }`}
                >
                  <strong>{feedback.type === 'success' ? '🏆 ĐẠT CHUẨN: ' : '⚠️ CHÚ Ý: '}</strong>
                  {feedback.text}
                </div>
              )}

              {/* Course Connection Box */}
              {isStable && roundData?.linkedCourse && (
                <div className="rounded-lg bg-indigo-950/80 border border-indigo-700/60 p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Môn học dạy thuật toán này:</span>
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
