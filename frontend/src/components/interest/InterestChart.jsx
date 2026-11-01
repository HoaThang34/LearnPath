import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { axisPercent, describePair } from '@/lib/bipolar'

function groupTone(group, topGroups) {
  if (group.status !== 'complete') return 'border-dashed border-slate-300 bg-slate-50 text-slate-500'
  if (topGroups.includes(group.code)) return 'border-primary/40 bg-primary/5 text-primary'
  return 'border-input bg-background text-foreground'
}

export function GroupBars({ groups = [], topGroups = [] }) {
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const percent = group.max > 0 ? Math.min((group.sum / 50) * 100, 100) : 0
        return (
          <div key={group.code} className={cn('rounded-lg border p-2.5', groupTone(group, topGroups))}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">
                {group.code} · {group.label}
              </span>
              <span className="tabular-nums">
                {group.status === 'empty' ? 'Chưa có dữ liệu' : `${group.sum}/${group.max}`}
                {group.status === 'partial' && ` · thiếu ${group.expected - group.answered} câu`}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full', group.status === 'complete' ? 'bg-primary' : 'bg-slate-300')}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function BipolarBars({ pairs = [] }) {
  return (
    <div className="space-y-3">
      {pairs.map((pair) => {
        // Sign rule lives in @/lib/bipolar: D > 0 leans to the first letter,
        // which is drawn on the LEFT (+24 → 0 %, −24 → 100 %).
        const percent = axisPercent(pair.d)
        const reading = describePair(pair)
        return (
          <div key={pair.code} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">
                {pair.first} — {pair.second}
              </span>
              <span className="text-muted-foreground">{reading.text}</span>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-slate-100">
              <div className="absolute left-1/2 top-0 h-full w-px bg-slate-400" aria-hidden="true" />
              {percent !== null && (
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
                  style={{ left: `${percent}%` }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{pair.first} · +24</span>
              <span>{pair.second} · −24</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function InterestChart({ groups = [], pairs = [], topGroups = [] }) {
  const complete = groups.filter((group) => group.status === 'complete')
  const radarData = complete.map((group) => ({
    group: group.code,
    value: group.sum,
    fullMark: 50,
  }))

  return (
    <div className="space-y-5">
      {radarData.length >= 3 ? (
        <div className="h-64 w-full" role="img" aria-label={`Biểu đồ radar 6 nhóm sở thích: ${complete.map((group) => `${group.code} ${group.sum}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid />
              <PolarAngleAxis dataKey="group" tick={{ fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 50]} tick={{ fontSize: 9 }} tickCount={6} />
              <Radar
                name="Điểm sở thích"
                dataKey="value"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.22}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Cần ít nhất 3 nhóm trả lời đủ 10/10 câu để vẽ biểu đồ radar. Các thanh điểm bên dưới vẫn hiển thị đầy đủ.
        </p>
      )}
      <GroupBars groups={groups} topGroups={topGroups} />
    </div>
  )
}
