import { Flame } from 'lucide-react'
import { getHotMajorBadge } from '@/lib/hotMajors'
import { cn } from '@/lib/utils'

/**
 * Thẻ/Huy hiệu đánh dấu Ngành HOT xu hướng
 * Điều kiện: Thuộc 1 trong 10 nhóm ngành HOT VÀ điểm chuẩn từ 27 điểm trở lên (>= 27đ)
 *
 * @param {string} majorName - Tên ngành cần kiểm tra
 * @param {number|string|null} [entryScore] - Điểm chuẩn tuyển sinh (bắt buộc >= 27đ)
 * @param {'compact'|'badge'|'full'|'pill'} [variant='badge']
 *   - 'compact': Chỉ hiện "HOT" kèm ngọn lửa
 *   - 'badge': "🔥 Ngành HOT · [Tên rút gọn]"
 *   - 'full': "🔥 Ngành HOT (≥27đ): [Tên đầy đủ nhóm]"
 *   - 'pill': Pill nhỏ tinh gọn
 * @param {string} [className]
 */
export default function HotMajorBadge({
  majorName,
  entryScore,
  variant = 'badge',
  className = '',
}) {
  const badgeInfo = getHotMajorBadge(majorName, entryScore)
  if (!badgeInfo) return null

  if (variant === 'compact') {
    return (
      <span
        title={`Ngành HOT xu hướng: ${badgeInfo.name} (Điểm chuẩn: ${badgeInfo.entryScore}đ ≥ 27đ)`}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-orange-500/15 text-rose-600 dark:text-rose-400 border border-rose-300/40 dark:border-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold shadow-2xs select-none shrink-0',
          className
        )}
      >
        <Flame className="h-2.5 w-2.5 fill-rose-500 text-rose-500 animate-pulse" />
        <span>HOT</span>
      </span>
    )
  }

  if (variant === 'pill') {
    return (
      <span
        title={`Ngành HOT xu hướng: ${badgeInfo.name} (Điểm chuẩn: ${badgeInfo.entryScore}đ ≥ 27đ)`}
        className={cn(
          'inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-2xs select-none',
          className
        )}
      >
        <Flame className="h-3 w-3 fill-rose-500 text-rose-500" />
        <span>Ngành HOT · {badgeInfo.entryScore}đ</span>
      </span>
    )
  }

  if (variant === 'full') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-orange-500/10 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-300/50 dark:border-rose-700/50 shadow-xs',
          className
        )}
      >
        <Flame className="h-3.5 w-3.5 fill-rose-500 text-rose-500 shrink-0 animate-pulse" />
        <span className="font-extrabold text-rose-800 dark:text-rose-200">Ngành HOT ({badgeInfo.entryScore}đ ≥ 27đ):</span>
        <span className="truncate">{badgeInfo.name}</span>
      </div>
    )
  }

  // Mặc định variant = 'badge'
  return (
    <span
      title={`Ngành HOT xu hướng: ${badgeInfo.name} (Điểm chuẩn: ${badgeInfo.entryScore}đ ≥ 27đ)`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-orange-500/15 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 dark:text-rose-300 border border-rose-300/40 dark:border-rose-700/40 shadow-2xs select-none transition-all hover:scale-[1.02]',
        className
      )}
    >
      <Flame className="h-3 w-3 fill-rose-500 text-rose-500 shrink-0 animate-pulse" />
      <span>Ngành HOT · {badgeInfo.shortName}</span>
      <span className="rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 px-1 py-0.2 text-[9.5px] font-extrabold">
        {badgeInfo.entryScore}đ
      </span>
    </span>
  )
}
