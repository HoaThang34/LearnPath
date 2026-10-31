import { cn } from '@/lib/utils'

export default function LikertScale({ value, onChange, labels = [], disabled = false, name = 'likert' }) {
  const options = [1, 2, 3, 4, 5]
  return (
    <div
      role="radiogroup"
      aria-label="Mức độ bạn thích hoạt động này"
      className="grid grid-cols-5 gap-1.5 sm:gap-2"
      data-scale={name}
    >
      {options.map((option) => {
        const selected = Number(value) === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              selected
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-input bg-background text-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <span className="text-base font-bold tabular-nums">{option}</span>
            <span className={cn('text-[10px] leading-tight sm:text-[11px]', selected ? 'opacity-90' : 'text-muted-foreground')}>
              {labels[option - 1] || ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
