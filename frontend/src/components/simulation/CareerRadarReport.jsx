import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Award,
  BookOpen,
  GraduationCap,
  Sparkles,
  Compass,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CareerRadarReport({ simData, userResults, onReplay }) {
  const radarAxes = [
    { key: 'logic', label: 'Tư duy Logic', value: 92 },
    { key: 'troubleshooting', label: 'Bắt bệnh sự cố', value: 88 },
    { key: 'stress', label: 'Chịu áp lực ca kíp', value: 85 },
    { key: 'precision', label: 'Tính chuẩn xác', value: 90 },
    { key: 'speed', label: 'Tốc độ phản xạ', value: 82 },
  ]

  // Calculate SVG polygon points for radar chart (center = 120, 120; radius = 80)
  const radarPoints = useMemo(() => {
    const cx = 120
    const cy = 120
    const radius = 80
    const total = radarAxes.length

    return radarAxes
      .map((axis, i) => {
        const angle = (Math.PI * 2 / total) * i - Math.PI / 2
        const r = (axis.value / 100) * radius
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [radarAxes])

  const unlockedBadges = userResults?.badges || [
    { id: 'b1', name: 'Bàn Tay Vàng Xử Lý Sự Cố', icon: 'Wrench' },
    { id: 'b2', name: 'Chúa Tể Băng Chuyền', icon: 'Cpu' },
    { id: 'b3', name: 'Bậc Thầy Cân Bằng PID', icon: 'Activity' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Congratulations */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 border-2 border-indigo-500/40 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200 border border-indigo-400/30">
            <Trophy className="h-4 w-4 text-amber-400" /> Báo Cáo Tố Chất Nghề Nghiệp Sau Ca Trực
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Chúc mừng bạn đã hoàn thành ca trực Kỹ sư Tự động hóa!
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Bạn đã xuất sắc vượt qua các tình huống thực tế của sàn sản xuất: xử lý lỗi tủ điện PLC,
            thiết lập logic tuần tự băng chuyền và cân bằng nhiệt độ lò luyện vòng kín.
          </p>
        </div>
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Chart & Badges Card */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" /> Biểu Đồ Radar Tố Chất
                </h4>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  Fit Index: 91%
                </span>
              </div>

              {/* Pure SVG Radar Chart */}
              <div className="flex justify-center py-2">
                <svg width="240" height="240" className="overflow-visible">
                  {/* Background grid rings */}
                  {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                    const r = 80 * ratio
                    return (
                      <circle
                        key={ratio}
                        cx="120"
                        cy="120"
                        r={r}
                        fill="none"
                        stroke="#334155"
                        strokeWidth="1"
                        strokeDasharray={ratio < 1.0 ? '2,2' : undefined}
                      />
                    )
                  })}

                  {/* Axis lines */}
                  {radarAxes.map((_, i) => {
                    const angle = (Math.PI * 2 / radarAxes.length) * i - Math.PI / 2
                    const x2 = 120 + 80 * Math.cos(angle)
                    const y2 = 120 + 80 * Math.sin(angle)
                    return (
                      <line
                        key={i}
                        x1="120"
                        y1="120"
                        x2={x2}
                        y2={y2}
                        stroke="#475569"
                        strokeWidth="1"
                      />
                    )
                  })}

                  {/* Filled Value Polygon */}
                  <polygon
                    points={radarPoints}
                    fill="rgba(6, 182, 212, 0.3)"
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />

                  {/* Value dots & Labels */}
                  {radarAxes.map((axis, i) => {
                    const angle = (Math.PI * 2 / radarAxes.length) * i - Math.PI / 2
                    const x = 120 + ((axis.value / 100) * 80) * Math.cos(angle)
                    const y = 120 + ((axis.value / 100) * 80) * Math.sin(angle)

                    const labelX = 120 + 98 * Math.cos(angle)
                    const labelY = 120 + 98 * Math.sin(angle)

                    return (
                      <g key={axis.key}>
                        <circle cx={x} cy={y} r="3.5" fill="#38bdf8" />
                        <text
                          x={labelX}
                          y={labelY}
                          fill="#94a3b8"
                          fontSize="9"
                          fontFamily="sans-serif"
                          fontWeight="600"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {axis.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Unlocked Badges */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block">
                  Huy hiệu thành tựu đã mở khóa:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {unlockedBadges.map((badge, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-800/80 border border-amber-500/30 text-xs"
                    >
                      <Award className="h-4 w-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-200 block">{badge.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {badge.description || 'Đạt thành tích xuất sắc trong ca trực.'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Insights & Academic Bridge */}
        <div className="lg:col-span-7 space-y-6">
          {/* Holland RIASEC Fit */}
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Compass className="h-4 w-4 text-indigo-400" />
                <span>Liên kết Sở thích Nghề nghiệp (Holland RIASEC: R-I)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ngành Tự động hóa thuộc nhóm đặc trưng <strong>Realistic (Kỹ thuật/Thực tế)</strong> kết hợp{' '}
                <strong>Investigative (Nghiên cứu)</strong>. Bạn là mẫu người thích làm việc trực tiếp với máy
                móc, thiết bị và công nghệ phần cứng, thỏa mãn cảm giác khi biến những dòng code trừu tượng thành
                chuyển động nhịp nhàng ngoài đời thực.
              </p>
            </CardContent>
          </Card>

          {/* Admission & Curriculum Bridge */}
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <GraduationCap className="h-4 w-4" />
                  <span>Cầu nối Đào tạo Đại học: {simData?.admissionReference?.schoolName}</span>
                </div>
                <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                  {simData?.admissionReference?.majorCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Benchmark History */}
                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                  <span className="font-bold text-slate-200 block">Điểm chuẩn các năm gần nhất:</span>
                  <div className="space-y-1 font-mono">
                    {simData?.admissionReference?.benchmarkHistory?.map((bh) => (
                      <div key={bh.year} className="flex justify-between text-slate-300">
                        <span>Năm {bh.year}:</span>
                        <strong className="text-amber-400">{bh.score} điểm</strong>
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 block pt-1">
                    Tổ hợp xét tuyển: A00 (Toán-Lý-Hóa), A01 (Toán-Lý-Anh)
                  </span>
                </div>

                {/* Practical Subject Mapping */}
                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                  <span className="font-bold text-slate-200 block">3 Môn học cốt lõi đã áp dụng:</span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside text-[11px]">
                    <li>
                      <code>EE3110</code> Kỹ thuật đo lường & Cảm biến
                    </li>
                    <li>
                      <code>EE4220</code> Điều khiển logic và PLC
                    </li>
                    <li>
                      <code>EE3288</code> Lý thuyết điều khiển tuyến tính
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Link to="/chuong-trinh-hoc">
                      <Button
                        size="sm"
                        variant="link"
                        className="text-xs text-cyan-400 hover:text-cyan-300 p-0 h-auto gap-1"
                      >
                        <BookOpen className="h-3.5 w-3.5" /> Xem toàn bộ 145 tín chỉ khung đào tạo
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action replay */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={onReplay}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg"
            >
              Trải nghiệm lại ca trực
            </Button>
            <Link to="/chuong-trinh-hoc">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
              >
                Tra cứu chương trình học các trường khác <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
