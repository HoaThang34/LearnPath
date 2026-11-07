import { useState, useEffect, useRef } from 'react'
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Scan,
  Clock,
  Zap,
  Cpu,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { factoryAudio } from './FactoryAudio'

export default function LogicRunner({ roundData, onComplete }) {
  const availableBlocks = roundData?.availableBlocks || []
  const correctSequence = roundData?.correctSequence || []

  // Current order of blocks that the student is assembling
  const [sequence, setSequence] = useState(() => {
    // Shuffle initial blocks to create a puzzle
    return [...availableBlocks].sort(() => 0.5 - Math.random()).map((b) => b.id)
  })

  const [isRunning, setIsRunning] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [productsSorted, setProductsSorted] = useState(0)

  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)

  // Simulation physics state
  const simState = useRef({
    beltOffset: 0,
    items: [],
    pistonPos: 0, // 0 = retracted, 1 = extended
    pistonTarget: 0,
    lastSpawn: 0,
    passedCount: 0,
    rejectedCount: 0,
    jammed: false,
  })

  const moveBlock = (index, direction) => {
    factoryAudio.playClick()
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sequence.length) return
    const next = [...sequence]
    const temp = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = temp
    setSequence(next)
    setFeedback(null)
  }

  const resetBlocks = () => {
    factoryAudio.playClick()
    setIsRunning(false)
    setIsSuccess(false)
    setFeedback(null)
    setProductsSorted(0)
    simState.current = {
      beltOffset: 0,
      items: [],
      pistonPos: 0,
      pistonTarget: 0,
      lastSpawn: 0,
      passedCount: 0,
      rejectedCount: 0,
      jammed: false,
    }
  }

  const handleRunSimulation = () => {
    factoryAudio.playClick()
    factoryAudio.startMotorHum()
    setIsRunning(true)
    setFeedback(null)

    // Check if sequence matches
    const isMatch =
      sequence.length === correctSequence.length &&
      sequence.every((id, idx) => id === correctSequence[idx])

    simState.current.items = []
    simState.current.jammed = !isMatch
    simState.current.passedCount = 0
    simState.current.rejectedCount = 0

    // Schedule 5 items over time
    let count = 0
    const spawnTimer = setInterval(() => {
      count++
      const isDefect = count === 2 || count === 4
      simState.current.items.push({
        id: count,
        x: 0,
        isDefect,
        sorted: false,
        kicked: false,
      })

      if (count >= 5) {
        clearInterval(spawnTimer)

        // Evaluate after items have passed through
        setTimeout(() => {
          factoryAudio.stopMotorHum()
          if (isMatch) {
            factoryAudio.playSuccess()
            setIsSuccess(true)
            setFeedback({
              type: 'success',
              text: 'CHÍNH XÁC 100%! Băng chuyền phân loại trơn tru, piston kích hoạt đúng thời điểm không làm kẹt hàng.',
            })
            onComplete?.({
              roundId: roundData.roundId,
              score: roundData.expReward || 450,
              badge: roundData.badgeAwarded,
              linkedCourse: roundData.linkedCourse,
            })
          } else {
            factoryAudio.playError()
            setIsRunning(false)
            setFeedback({
              type: 'error',
              text: 'SỰ CỐ KẸT HÀNG! Thứ tự logic chưa đúng khiến lon nước bị va chạm hoặc gạt trượt. Hãy rà soát lại khối điều kiện & hành động!',
            })
          }
        }, 4000)
      }
    }, 900)
  }

  // Canvas render loop for 2D visual simulation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const render = () => {
      const w = canvas.width
      const h = canvas.height

      // Clear background
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)

      // Draw Conveyor Belt (Y = 130, Height = 40)
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(40, 130, w - 80, 40)

      // Conveyor stripes (moving animation)
      if (isRunning) {
        simState.current.beltOffset = (simState.current.beltOffset + 2) % 20
      }
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 2
      for (let x = 40 + simState.current.beltOffset; x < w - 40; x += 20) {
        ctx.beginPath()
        ctx.moveTo(x, 130)
        ctx.lineTo(x, 170)
        ctx.stroke()
      }

      // Draw AI Camera Scan Line at X = 200
      ctx.strokeStyle = '#06b6d4'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.setLineDash([4, 4])
      ctx.moveTo(200, 70)
      ctx.lineTo(200, 170)
      ctx.stroke()
      ctx.setLineDash([])

      // Camera Box
      ctx.fillStyle = '#0891b2'
      ctx.fillRect(185, 55, 30, 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.fillText('CAM', 188, 69)

      // Draw Pneumatic Piston at X = 360, Y = 60
      const pistonExtension = simState.current.pistonPos * 45
      ctx.fillStyle = '#475569'
      ctx.fillRect(350, 40, 25, 40) // Piston base

      ctx.fillStyle = '#cbd5e1'
      ctx.fillRect(358, 80, 9, 30 + pistonExtension) // Piston rod

      ctx.fillStyle = '#e11d48'
      ctx.fillRect(345, 110 + pistonExtension, 35, 10) // Piston pusher plate

      // Draw Scrap Reject Bin at Bottom of Piston (Y = 190)
      ctx.fillStyle = '#3f1118'
      ctx.strokeStyle = '#e11d48'
      ctx.lineWidth = 1.5
      ctx.fillRect(330, 185, 65, 45)
      ctx.strokeRect(330, 185, 65, 45)
      ctx.fillStyle = '#fca5a5'
      ctx.font = '9px sans-serif'
      ctx.fillText('THÙNG PHẾ', 335, 210)

      // Update & Draw Cans
      const items = simState.current.items
      items.forEach((item) => {
        if (isRunning) {
          item.x += 2.5
        }

        // Logic check: When defect passes camera at X ~ 200
        if (item.isDefect && item.x > 195 && item.x < 210) {
          // Camera detect flash
          ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'
          ctx.fillRect(190, 80, 20, 90)
        }

        // Logic check: Piston trigger when defect reaches X ~ 340
        if (item.isDefect && item.x > 330 && item.x < 370 && !item.kicked) {
          if (!simState.current.jammed) {
            simState.current.pistonPos = 1
            item.kicked = true
            item.y = 195 // pushed into reject bin
            setProductsSorted((prev) => prev + 1)
          } else {
            // Jammed: Piston didn't fire or hit wrong
            simState.current.pistonPos = 0
          }
        }

        // Retract piston after pass
        if (item.x > 380 && simState.current.pistonPos > 0) {
          simState.current.pistonPos = 0
        }

        // Render can
        const drawY = item.kicked ? item.y || 195 : 125
        if (item.isDefect) {
          // Red defective can (dented)
          ctx.fillStyle = '#ef4444'
          ctx.fillRect(item.x, drawY, 20, 28)
          ctx.fillStyle = '#7f1d1d'
          ctx.fillRect(item.x + 5, drawY + 8, 8, 6) // dent crack
        } else {
          // Blue healthy can
          ctx.fillStyle = '#38bdf8'
          ctx.fillRect(item.x, drawY, 20, 28)
          ctx.fillStyle = '#0284c7'
          ctx.fillRect(item.x + 2, drawY + 2, 16, 4) // cap
        }
      })

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isRunning])

  return (
    <div className="space-y-6">
      {/* 2D Simulation Canvas Screen */}
      <div className="relative rounded-2xl bg-slate-950 border-2 border-slate-800 p-4 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold uppercase text-slate-300">
              Mô Phỏng Trạm Băng Tải Phân Loại 2D (Visual Simulation)
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Sản phẩm phân loại:</span>
            <span className="font-bold text-cyan-400">{productsSorted}/2</span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={640}
          height={240}
          className="w-full h-auto rounded-xl bg-slate-950 border border-slate-900 block"
        />

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-cyan-400" />
            <span>Lon đạt chuẩn (Cho qua)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-red-500" />
            <span>Lon móp méo (Piston phải gạt)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-cyan-600 border border-dashed border-cyan-300" />
            <span>Vùng Camera AI nhận diện</span>
          </div>
        </div>
      </div>

      {/* Logic Sequence Reorder Panel */}
      <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-200">
                Sắp xếp Thứ tự Khối Lệnh PLC (State Machine Pipeline)
              </h4>
              <p className="text-xs text-slate-400">
                Dùng các mũi tên ⬆️ ⬇️ để di chuyển các khối lệnh theo đúng trình tự logic điều khiển.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetBlocks}
                disabled={isRunning}
                className="text-xs border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Đặt lại
              </Button>
              <Button
                onClick={handleRunSimulation}
                disabled={isRunning || isSuccess}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg gap-1.5"
              >
                <Play className="h-3.5 w-3.5" /> Nạp code & Chạy thử
              </Button>
            </div>
          </div>

          {/* Draggable/Reorderable Sequence Cards */}
          <div className="space-y-2">
            {sequence.map((blockId, index) => {
              const block = availableBlocks.find((b) => b.id === blockId)
              if (!block) return null

              const isFirst = index === 0
              const isLast = index === sequence.length - 1

              return (
                <div
                  key={blockId}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:border-cyan-500/50 transition-all text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-cyan-950 text-cyan-400 font-mono font-bold text-xs border border-cyan-800">
                      #{index + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-200 block">{block.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        Khối {block.category}
                      </span>
                    </div>
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isFirst || isRunning}
                      onClick={() => moveBlock(index, -1)}
                      className="h-7 w-7 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isLast || isRunning}
                      onClick={() => moveBlock(index, 1)}
                      className="h-7 w-7 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`rounded-lg p-3 text-xs leading-relaxed border ${
                feedback.type === 'success'
                  ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
                  : 'border-red-500/50 bg-red-950/80 text-red-200'
              }`}
            >
              <strong>{feedback.type === 'success' ? '🚀 XUẤT SẮC: ' : '⚠️ CHÚ Ý: '}</strong>
              {feedback.text}
            </div>
          )}

          {/* Linked Course Box */}
          {isSuccess && roundData?.linkedCourse && (
            <div className="rounded-lg bg-indigo-950/80 border border-indigo-700/60 p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Môn học cung cấp kiến thức lập trình này:</span>
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
  )
}
