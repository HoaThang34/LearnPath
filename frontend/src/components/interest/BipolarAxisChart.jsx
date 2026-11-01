import { axisPercent, describePair, formatD, isMissingD } from '@/lib/bipolar'

const TONES = {
  first: '#2563eb',
  second: '#7c3aed',
  balanced: '#64748b',
}

function toneFor(pair) {
  if (isMissingD(pair?.d)) return TONES.balanced
  const d = Number(pair.d)
  if (d > 0) return TONES.first
  if (d < 0) return TONES.second
  return TONES.balanced
}

// One combined diverging chart for the four bipolar pairs.
//
// The geometry lives in @/lib/bipolar so this chart, the per-pair bars and any
// future consumer share one sign rule: D > 0 leans to the first letter, which
// is drawn on the LEFT. Do not mirror it here.
export default function BipolarAxisChart({ pairs = [] }) {
  if (!Array.isArray(pairs) || pairs.length === 0) return null

  const width = 680
  const x0 = 64
  const x1 = 488
  const center = (x0 + x1) / 2
  const half = (x1 - x0) / 2
  const firstRowY = 34
  const rowGap = 50
  const height = firstRowY + (pairs.length - 1) * rowGap + 28
  const xForPercent = (percent) => x0 + (percent / 100) * (x1 - x0)
  const ticks = [24, 12, 0, -12, -24]
  const dColumnX = 512

  const aria = pairs
    .map((pair) => `${pair.first}–${pair.second}: ${describePair(pair).text}`)
    .join('; ')

  return (
    <figure className="rounded-lg border bg-white p-3">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-xs font-semibold text-foreground">Biểu đồ bốn cặp xu hướng</span>
        <span className="text-[10px] text-muted-foreground">
          Trái = chữ thứ nhất (+24) · Phải = chữ thứ hai (−24)
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Biểu đồ bốn cặp xu hướng. ${aria}`}
      >
        {ticks.map((tick) => {
          const x = xForPercent(axisPercent(tick))
          const label = tick > 0 ? `+${tick}` : tick === 0 ? '0' : `−${Math.abs(tick)}`
          return (
            <g key={tick}>
              <line
                x1={x}
                x2={x}
                y1={24}
                y2={height - 20}
                stroke={tick === 0 ? '#94a3b8' : '#e2e8f0'}
                strokeWidth={1}
                strokeDasharray={tick === 0 ? '3 3' : undefined}
              />
              <text x={x} y={14} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
                {label}
              </text>
            </g>
          )
        })}

        {pairs.map((pair, index) => {
          const y = firstRowY + index * rowGap
          const d = isMissingD(pair.d) ? null : Number(pair.d)
          const tone = toneFor(pair)
          const percent = axisPercent(d)
          const markerX = percent === null ? null : xForPercent(percent)
          const reading = describePair(pair)
          return (
            <g key={pair.code || `${pair.first}${pair.second}`}>
              <rect x={x0} y={y - 5} width={half - 2} height={10} rx={5} fill="#dbeafe" />
              <rect x={center + 2} y={y - 5} width={half - 2} height={10} rx={5} fill="#ede9fe" />

              <text x={x0 - 10} y={y + 4.5} textAnchor="end" fontSize="13" fontWeight="700" fill="#1e293b">
                {pair.first}
              </text>
              <text x={x1 + 10} y={y + 4.5} textAnchor="start" fontSize="13" fontWeight="700" fill="#1e293b">
                {pair.second}
              </text>

              {markerX === null ? (
                <text x={center} y={y + 4} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
                  —
                </text>
              ) : (
                <>
                  <circle cx={markerX} cy={y} r={10} fill={tone} opacity="0.15" />
                  <circle cx={markerX} cy={y} r={6.5} fill={tone} stroke="#ffffff" strokeWidth="2" />
                </>
              )}

              <text x={dColumnX} y={y - 1} fontSize="11.5" fontWeight="600" fill={tone}>
                {d === null ? 'Chưa đủ dữ liệu' : `D = ${formatD(d)}`}
              </text>
              {d !== null && (
                <text x={dColumnX} y={y + 12} fontSize="10" fill="#64748b">
                  {reading.text.replace(/^D = .*?· /, '')}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
        D là chênh lệch xu hướng trả lời (Σ câu chẵn − Σ câu lẻ), không phải điểm mạnh hay mức độ của một phẩm chất.
        Cặp chưa đủ 12/12 câu không được tính D.
      </p>
    </figure>
  )
}
