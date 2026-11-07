import { useState, useEffect, useRef } from 'react'
import {
  Rotate3d,
  Play,
  Zap,
  Eye,
  Bot,
  Flame,
  CheckCircle2,
  Sparkles,
  Maximize2,
  Volume2,
  VolumeX,
  Gauge,
  Pause,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { factoryAudio } from './FactoryAudio'

export default function Factory3DCanvas({ onStateChange }) {
  // Machine interactive states
  const [powerOn, setPowerOn] = useState(false)
  const [sensorOn, setSensorOn] = useState(false)
  const [robotOn, setRobotOn] = useState(false)
  const [filterDefectOn, setFilterDefectOn] = useState(false)

  // Speed Mode: 'slow' (mặc định - chậm nhất để dễ hiểu), 'superslow', 'normal', 'paused'
  const [simSpeed, setSimSpeed] = useState('slow')

  // Camera Orbit rotation angles
  const [camRotX, setCamRotX] = useState(0.45) // Tilt pitch
  const [camRotY, setCamRotY] = useState(0.65) // Orbit yaw
  const [zoom, setZoom] = useState(1.0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)

  // Simulation internal physical coordinates
  const sim = useRef({
    beltPhase: 0,
    cans: [
      { id: 1, pos: -150, isDefect: false, gripped: false },
      { id: 2, pos: -70, isDefect: true, gripped: false },
      { id: 3, pos: 10, isDefect: false, gripped: false },
      { id: 4, pos: 90, isDefect: false, gripped: false },
    ],
    robotAngle: 0,
    robotArmReach: 0,
    robotGripper: 0,
    robotCycle: 0, // 0..100
    palletCansCount: 0,
    laserFlash: 0,
    pistonPush: 0,
  })

  // Toggle helpers
  const handleTogglePower = () => {
    factoryAudio.playClick()
    const next = !powerOn
    setPowerOn(next)
    if (next) {
      factoryAudio.playSuccess()
      factoryAudio.startMotorHum()
    } else {
      factoryAudio.stopMotorHum()
      setSensorOn(false)
      setRobotOn(false)
      setFilterDefectOn(false)
    }
  }

  const handleToggleSensor = () => {
    if (!powerOn) return
    factoryAudio.playClick()
    setSensorOn(!sensorOn)
  }

  const handleToggleRobot = () => {
    if (!powerOn) return
    factoryAudio.playClick()
    setRobotOn(!robotOn)
  }

  const handleToggleDefectFilter = () => {
    if (!powerOn) return
    factoryAudio.playClick()
    setFilterDefectOn(!filterDefectOn)
  }

  // Camera preset views
  const setCameraPreset = (preset) => {
    factoryAudio.playClick()
    if (preset === 'front') {
      setCamRotX(0.2)
      setCamRotY(0.1)
    } else if (preset === 'robot') {
      setCamRotX(0.55)
      setCamRotY(1.1)
      setZoom(1.2)
    } else if (preset === 'iso') {
      setCamRotX(0.45)
      setCamRotY(0.65)
      setZoom(1.0)
    }
  }

  // Mouse / Touch Drag to Rotate 3D View
  const handlePointerDown = (e) => {
    setIsDragging(true)
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0
    dragStart.current = { x: clientX, y: clientY }
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0
    const dx = clientX - dragStart.current.x
    const dy = clientY - dragStart.current.y

    setCamRotY((prev) => prev + dx * 0.008)
    setCamRotX((prev) => Math.max(0.1, Math.min(1.2, prev + dy * 0.008)))
    dragStart.current = { x: clientX, y: clientY }
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // 3D Rendering & Animation Loop with Speed Factor
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Speed multiplier: 'slow' = 0.35x (chậm rãi, xem rất rõ), 'superslow' = 0.18x, 'normal' = 0.8x, 'paused' = 0
    const speedFactor =
      simSpeed === 'paused'
        ? 0
        : simSpeed === 'superslow'
        ? 0.18
        : simSpeed === 'slow'
        ? 0.35
        : 0.8

    // --- 3D Projection Math Engine ---
    const project = (x, y, z, cx, cy) => {
      // 1. Rotate Yaw (around Y axis)
      const cosY = Math.cos(camRotY)
      const sinY = Math.sin(camRotY)
      const x1 = x * cosY - z * sinY
      const z1 = x * sinY + z * cosY

      // 2. Rotate Pitch (around X axis)
      const cosX = Math.cos(camRotX)
      const sinX = Math.sin(camRotX)
      const y2 = y * cosX - z1 * sinX
      const z2 = y * sinX + z1 * cosX

      // 3. Perspective Projection
      const cameraDist = 480 / zoom
      const fov = cameraDist / (cameraDist + z2)

      return {
        x: cx + x1 * fov,
        y: cy + y2 * fov,
        depth: z2,
        scale: fov,
      }
    }

    // Helper: draw shaded 3D polygon with light shading
    const draw3DPoly = (poly, fill, stroke = null) => {
      if (poly.length < 3) return
      ctx.beginPath()
      ctx.moveTo(poly[0].x, poly[0].y)
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y)
      }
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    const render = () => {
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2 + 30

      // Clear Canvas (Dark tech factory gradient)
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)

      // Ambient Floor Grid in 3D
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      for (let gx = -240; gx <= 240; gx += 40) {
        const p1 = project(gx, 70, -240, cx, cy)
        const p2 = project(gx, 70, 240, cx, cy)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
      for (let gz = -240; gz <= 240; gz += 40) {
        const p1 = project(-240, 70, gz, cx, cy)
        const p2 = project(240, 70, gz, cx, cy)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      // --- 1. CONVEYOR BELT 3D MODEL ---
      const beltY = 25
      const beltH = 30
      const beltW = 360
      const beltDepth = 50

      // Belt side faces
      const bTL = project(-beltW / 2, beltY, -beltDepth / 2, cx, cy)
      const bTR = project(beltW / 2, beltY, -beltDepth / 2, cx, cy)
      const bBR = project(beltW / 2, beltY, beltDepth / 2, cx, cy)
      const bBL = project(-beltW / 2, beltY, beltDepth / 2, cx, cy)

      const bBottomTL = project(-beltW / 2, beltY + beltH, -beltDepth / 2, cx, cy)
      const bBottomTR = project(beltW / 2, beltY + beltH, -beltDepth / 2, cx, cy)
      const bBottomBR = project(beltW / 2, beltY + beltH, beltDepth / 2, cx, cy)
      const bBottomBL = project(-beltW / 2, beltY + beltH, beltDepth / 2, cx, cy)

      // Stand legs
      ;[-140, 0, 140].forEach((legX) => {
        const legT = project(legX, beltY + beltH, 0, cx, cy)
        const legB = project(legX, 70, 0, cx, cy)
        ctx.strokeStyle = '#475569'
        ctx.lineWidth = 4 * legT.scale
        ctx.beginPath()
        ctx.moveTo(legT.x, legT.y)
        ctx.lineTo(legB.x, legB.y)
        ctx.stroke()
      })

      // Front edge of belt
      draw3DPoly([bBL, bBR, bBottomBR, bBottomBL], '#1e293b', '#334155')
      // Top surface of belt (Rolling surface)
      draw3DPoly([bTL, bTR, bBR, bBL], powerOn ? '#0f172a' : '#1e293b', '#38bdf8')

      // Animated Rolling Lines on Belt (Runs slowly according to speedFactor)
      if (powerOn && speedFactor > 0) {
        sim.current.beltPhase = (sim.current.beltPhase + 2.0 * speedFactor) % 30
        for (let rx = -beltW / 2 + sim.current.beltPhase; rx < beltW / 2; rx += 30) {
          const l1 = project(rx, beltY, -beltDepth / 2, cx, cy)
          const l2 = project(rx, beltY, beltDepth / 2, cx, cy)
          ctx.strokeStyle = '#334155'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(l1.x, l1.y)
          ctx.lineTo(l2.x, l2.y)
          ctx.stroke()
        }
      }

      // --- 2. SENSOR ARCH & 3D LASER BEAM (At X = -40) ---
      const sensorX = -40
      const sArchTopL = project(sensorX, -45, -beltDepth / 2 - 15, cx, cy)
      const sArchTopR = project(sensorX, -45, beltDepth / 2 + 15, cx, cy)
      const sArchBottomL = project(sensorX, beltY, -beltDepth / 2 - 15, cx, cy)
      const sArchBottomR = project(sensorX, beltY, beltDepth / 2 + 15, cx, cy)

      // Draw Arch Frame
      ctx.strokeStyle = sensorOn ? '#06b6d4' : '#64748b'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(sArchBottomL.x, sArchBottomL.y)
      ctx.lineTo(sArchTopL.x, sArchTopL.y)
      ctx.lineTo(sArchTopR.x, sArchTopR.y)
      ctx.lineTo(sArchBottomR.x, sArchBottomR.y)
      ctx.stroke()

      // 3D Laser Scanning Curtain (When Sensor ON)
      if (sensorOn) {
        const laserTL = project(sensorX, -40, -beltDepth / 2, cx, cy)
        const laserTR = project(sensorX, -40, beltDepth / 2, cx, cy)
        const laserBR = project(sensorX, beltY, beltDepth / 2, cx, cy)
        const laserBL = project(sensorX, beltY, -beltDepth / 2, cx, cy)

        draw3DPoly([laserTL, laserTR, laserBR, laserBL], 'rgba(6, 182, 212, 0.28)')

        // Glowing emitter node
        ctx.fillStyle = '#06b6d4'
        ctx.beginPath()
        ctx.arc(sArchTopL.x, sArchTopL.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // --- 3. PRODUCTS / SODA CANS MOVING SLOWLY IN 3D ---
      sim.current.cans.forEach((can) => {
        if (powerOn && !can.gripped && speedFactor > 0) {
          can.pos += 1.6 * speedFactor
          if (can.pos > 180) {
            can.pos = -170
            can.isDefect = Math.random() < 0.35 // 35% chance defect
          }
        }

        // Piston defect kicker logic at X = 20 (Slow, clearly visible kick)
        if (filterDefectOn && can.isDefect && can.pos > 8 && can.pos < 30) {
          can.pos = 300 // Kicked off the belt into scrap
          sim.current.pistonPush = 1
        }

        // Only draw cans that are on the belt
        if (can.pos < 220) {
          const canY = beltY - 24
          const canR = 10

          // Check if under sensor laser beam
          const isScanning = sensorOn && Math.abs(can.pos - sensorX) < 18
          const pCanBase = project(can.pos, beltY, 0, cx, cy)
          const pCanTop = project(can.pos, canY, 0, cx, cy)

          const canColor = can.isDefect ? '#ef4444' : isScanning ? '#38bdf8' : '#0284c7'

          // 3D Cylinder
          ctx.fillStyle = canColor
          ctx.beginPath()
          ctx.roundRect(
            pCanTop.x - canR * pCanTop.scale,
            pCanTop.y,
            canR * 2 * pCanTop.scale,
            pCanBase.y - pCanTop.y,
            4
          )
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 0.5
          ctx.stroke()

          // Clear Visual Instructional Tag when scanning slowly
          if (isScanning) {
            ctx.fillStyle = can.isDefect ? '#fee2e2' : '#e0f2fe'
            ctx.fillRect(pCanTop.x - 38, pCanTop.y - 18, 76, 15)
            ctx.strokeStyle = can.isDefect ? '#ef4444' : '#0284c7'
            ctx.strokeRect(pCanTop.x - 38, pCanTop.y - 18, 76, 15)

            ctx.fillStyle = can.isDefect ? '#b91c1c' : '#0369a1'
            ctx.font = 'bold 8px sans-serif'
            ctx.fillText(can.isDefect ? '🚨 LON MÓP MÉO' : '✓ ĐẠT CHUẨN', pCanTop.x - 34, pCanTop.y - 7)
          }
        }
      })

      // Reset piston
      if (sim.current.pistonPush > 0) {
        sim.current.pistonPush -= 0.05 * (speedFactor || 0.3)
      }

      // --- 4. ARTICULATED 3D ROBOTIC ARM (MOVING SLOWLY & DELIBERATELY) ---
      const rBaseX = 80
      const rBaseZ = 85
      const rBaseY = 70

      // Base cylinder
      const pBase = project(rBaseX, rBaseY, rBaseZ, cx, cy)
      const pBaseTop = project(rBaseX, rBaseY - 20, rBaseZ, cx, cy)
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.ellipse(pBase.x, pBase.y, 24 * pBase.scale, 12 * pBase.scale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Robot motion loop with slow speedFactor (takes ~7-8 seconds for full cycle)
      if (robotOn && speedFactor > 0) {
        sim.current.robotCycle = (sim.current.robotCycle + 0.8 * speedFactor) % 100
      } else if (!robotOn) {
        sim.current.robotCycle = 0
      }

      // Arm kinematics interpolation
      let reachX = rBaseX
      let reachY = rBaseY - 50
      let reachZ = rBaseZ
      let robotActionText = ''

      if (robotOn) {
        const phase = sim.current.robotCycle
        if (phase < 40) {
          // Reach toward conveyor
          const t = phase / 40
          reachX = rBaseX + (80 - rBaseX) * t
          reachZ = rBaseZ + (0 - rBaseZ) * t
          reachY = (rBaseY - 50) + (beltY - 20 - (rBaseY - 50)) * Math.sin(t * Math.PI)
          robotActionText = '🤖 Robot vươn tay hạ xuống gắp lon...'
        } else if (phase < 75) {
          // Swing to Pallet
          const t = (phase - 40) / 35
          reachX = 80 + (140 - 80) * t
          reachZ = 0 + (120 - 0) * t
          reachY = rBaseY - 40 - Math.sin(t * Math.PI) * 20
          robotActionText = '📦 Robot nhấc lon và xoay sang Pallet...'
        } else {
          // Return
          const t = (phase - 75) / 25
          reachX = 140 + (rBaseX - 140) * t
          reachZ = 120 + (rBaseZ - 120) * t
          reachY = rBaseY - 50
          robotActionText = '✓ Đã xếp thùng hàng, trở về vị trí gốc'
        }
      }

      // Shoulder Joint
      const pShoulder = project(rBaseX, rBaseY - 35, rBaseZ, cx, cy)
      // Elbow Joint
      const elbowX = (rBaseX + reachX) / 2
      const elbowZ = (rBaseZ + reachZ) / 2
      const elbowY = Math.min(pShoulder.y, reachY) - 50
      const pElbow = project(elbowX, elbowY, elbowZ, cx, cy)
      // End effector / Gripper
      const pHand = project(reachX, reachY, reachZ, cx, cy)

      // Draw Lower Arm Link
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 8 * pShoulder.scale
      ctx.beginPath()
      ctx.moveTo(pBaseTop.x, pBaseTop.y)
      ctx.lineTo(pShoulder.x, pShoulder.y)
      ctx.lineTo(pElbow.x, pElbow.y)
      ctx.stroke()

      // Draw Upper Arm Link
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 6 * pElbow.scale
      ctx.beginPath()
      ctx.moveTo(pElbow.x, pElbow.y)
      ctx.lineTo(pHand.x, pHand.y)
      ctx.stroke()

      // Robot Gripper Head
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(pHand.x, pHand.y, 6 * pHand.scale, 0, Math.PI * 2)
      ctx.fill()

      // Draw Gripped Can when moving to pallet
      if (robotOn && sim.current.robotCycle > 38 && sim.current.robotCycle < 75) {
        ctx.fillStyle = '#0284c7'
        ctx.fillRect(pHand.x - 7, pHand.y, 14, 20)
      }

      // Display floating robot status badge when running
      if (robotOn && robotActionText) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
        ctx.fillRect(pHand.x - 70, pHand.y - 32, 140, 18)
        ctx.strokeStyle = '#f59e0b'
        ctx.strokeRect(pHand.x - 70, pHand.y - 32, 140, 18)
        ctx.fillStyle = '#fef3c7'
        ctx.font = 'bold 9px sans-serif'
        ctx.fillText(robotActionText, pHand.x - 65, pHand.y - 20)
      }

      // --- 5. PALLET BOX STACK (At X = 140, Z = 120) ---
      const palX = 140
      const palZ = 120
      const pPal = project(palX, 68, palZ, cx, cy)
      ctx.fillStyle = '#78350f' // Wood pallet
      ctx.fillRect(pPal.x - 24, pPal.y, 48, 12)

      // Stacked boxes
      ctx.fillStyle = '#b45309'
      ctx.fillRect(pPal.x - 20, pPal.y - 20, 40, 20)
      ctx.fillStyle = '#fef3c7'
      ctx.font = '8px sans-serif'
      ctx.fillText('XUẤT XƯỞNG', pPal.x - 18, pPal.y - 8)

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [powerOn, sensorOn, robotOn, filterDefectOn, camRotX, camRotY, zoom, simSpeed])

  return (
    <div className="space-y-4">
      {/* 3D Interactive Viewport Container */}
      <div className="relative rounded-2xl bg-slate-950 border-2 border-slate-800 shadow-2xl overflow-hidden select-none">
        {/* Floating Top Control HUD: Status & Speed Controller & Camera Presets */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
          {/* Status Pill */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold font-mono flex items-center gap-1.5 backdrop-blur-md border ${
                powerOn
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  powerOn ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              {powerOn ? 'NHÀ MÁY ĐANG VẬN HÀNH 3D' : 'HỆ THỐNG ĐANG TẮT'}
            </span>
          </div>

          {/* Speed Controller Bar (Giảm thời gian chạy để xem chậm nhất dễ hiểu) */}
          <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 text-xs">
            <span className="text-[10px] text-slate-400 font-bold px-1.5 uppercase hidden sm:inline">
              Tốc độ:
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSimSpeed('slow')}
              className={`text-[11px] h-7 px-2.5 font-semibold rounded-lg ${
                simSpeed === 'slow'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Tốc độ chậm rãi, thư thái, xem rõ từng nhịp máy"
            >
              🐢 Chậm dễ hiểu
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSimSpeed('superslow')}
              className={`text-[11px] h-7 px-2.5 font-semibold rounded-lg ${
                simSpeed === 'superslow'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Tốc độ siêu chậm, soi rõ từng góc cạnh của khớp tay robot"
            >
              🔍 Siêu chậm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSimSpeed(simSpeed === 'paused' ? 'slow' : 'paused')}
              className={`text-[11px] h-7 px-2 font-semibold rounded-lg ${
                simSpeed === 'paused'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={simSpeed === 'paused' ? 'Tiếp tục chạy' : 'Tạm dừng màn hình'}
            >
              {simSpeed === 'paused' ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
              {simSpeed === 'paused' ? 'Tiếp tục' : 'Dừng'}
            </Button>
          </div>

          {/* Camera View Angle Buttons */}
          <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/80">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCameraPreset('iso')}
              className="text-[11px] h-7 px-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800"
            >
              <Rotate3d className="h-3.5 w-3.5 mr-1" /> 3D
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCameraPreset('robot')}
              className="text-[11px] h-7 px-2 text-slate-300 hover:text-amber-400 hover:bg-slate-800"
            >
              <Bot className="h-3.5 w-3.5 mr-1" /> Robot
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCameraPreset('front')}
              className="text-[11px] h-7 px-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800"
            >
              Chính Diện
            </Button>
          </div>
        </div>

        {/* 3D Canvas element with Mouse/Touch Orbit Dragging */}
        <canvas
          ref={canvasRef}
          width={860}
          height={420}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="w-full h-auto block cursor-grab active:cursor-grabbing"
        />

        {/* Floating Bottom Hint */}
        <div className="absolute bottom-3 left-3 text-[11px] text-slate-400 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm pointer-events-none border border-slate-800 flex items-center gap-1.5">
          <Rotate3d className="h-3.5 w-3.5 text-cyan-400" />
          <span>Kéo chuột hoặc vuốt tay trên màn hình để xoay góc nhìn 360 độ</span>
        </div>
      </div>

      {/* ================= 4 NÚT THAO TÁC ĐỒ HỌA TO RÕ DỄ HIỂU ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Nút 1: Bật nguồn */}
        <button
          type="button"
          onClick={handleTogglePower}
          className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
            powerOn
              ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-lg ring-1 ring-emerald-500/50'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300'
          }`}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-md ${
              powerOn ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">
              {powerOn ? '1. Đã Bật Nguồn' : '1. Bật Nguồn 3D'}
            </span>
            <span className="text-[10px] text-slate-400">Khởi động băng tải</span>
          </div>
        </button>

        {/* Nút 2: Mắt thần cảm biến */}
        <button
          type="button"
          disabled={!powerOn}
          onClick={handleToggleSensor}
          className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
            sensorOn
              ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-lg ring-1 ring-cyan-500/50'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-md ${
              sensorOn ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">
              {sensorOn ? '2. Mắt Thần Đang Quét' : '2. Bật Mắt Thần Cảm Biến'}
            </span>
            <span className="text-[10px] text-slate-400">Tia laser phát hiện lon</span>
          </div>
        </button>

        {/* Nút 3: Cánh tay Robot */}
        <button
          type="button"
          disabled={!powerOn}
          onClick={handleToggleRobot}
          className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
            robotOn
              ? 'border-amber-500 bg-amber-950/40 text-amber-200 shadow-lg ring-1 ring-amber-500/50'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-md ${
              robotOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">
              {robotOn ? '3. Robot Đang Gắp' : '3. Bật Robot Xếp Hàng'}
            </span>
            <span className="text-[10px] text-slate-400">Tự động gắp vào thùng</span>
          </div>
        </button>

        {/* Nút 4: Tự động loại bỏ lon lỗi */}
        <button
          type="button"
          disabled={!powerOn}
          onClick={handleToggleDefectFilter}
          className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
            filterDefectOn
              ? 'border-purple-500 bg-purple-950/40 text-purple-200 shadow-lg ring-1 ring-purple-500/50'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-md ${
              filterDefectOn ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">
              {filterDefectOn ? '4. Tự Lọc Sản Phẩm Lỗi' : '4. Bật Tự Bắt Lỗi'}
            </span>
            <span className="text-[10px] text-slate-400">Piston tự gạt lon móp</span>
          </div>
        </button>
      </div>

      {/* Lời giải thích ngắn gọn */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-xs text-slate-300 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-cyan-400 shrink-0" />
        <div>
          <strong className="text-white block">Hiểu đơn giản về ngành Tự động hóa:</strong>
          Kỹ sư Tự động hóa là người lập trình để <strong>cảm biến</strong> làm mắt nhìn,{' '}
          <strong>robot</strong> làm tay gắp, và <strong>máy tính</strong> làm bộ não điều hành thay cho
          hàng trăm công nhân vất vả!
        </div>
      </div>
    </div>
  )
}
