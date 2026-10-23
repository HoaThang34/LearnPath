import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  error: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  info: {
    icon: Info,
    className: 'border-sky-300 bg-sky-50 text-sky-800',
  },
}

export default function AdminAlert({ variant = 'info', className, children }) {
  const config = VARIANTS[variant] || VARIANTS.info
  const Icon = config.icon

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-2 rounded-md border p-3 text-sm',
        config.className,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}
