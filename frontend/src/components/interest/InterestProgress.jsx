import { cn } from '@/lib/utils'

export default function InterestProgress({ stages = [], currentIndex = 0, onSelect }) {
  const total = stages.reduce((sum, stage) => sum + (stage.total || 0), 0)
  const answered = stages.reduce((sum, stage) => sum + (stage.answered || 0), 0)
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">
          Đã trả lời <strong className="text-foreground">{answered}</strong>/{total} câu
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stages.map((stage, index) => {
          const complete = stage.total > 0 && stage.answered === stage.total
          const current = index === currentIndex
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onSelect?.(index)}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                current
                  ? 'border-primary bg-primary text-primary-foreground'
                  : complete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {stage.shortLabel || stage.label} · {stage.answered}/{stage.total}
            </button>
          )
        })}
      </div>
    </div>
  )
}
