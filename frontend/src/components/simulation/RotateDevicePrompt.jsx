import { useState, useEffect } from 'react'
import { Smartphone, RotateCw, Sparkles, CheckCircle2, ChevronRight, Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RotateDevicePrompt({ forceShow = false }) {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return

      const width = window.innerWidth
      const height = window.innerHeight
      const isPortrait = height > width
      // Phone / tablet portrait threshold
      const isMobileWidth = width <= 900

      const isTouch =
        window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

      // Trigger if mobile/touch device in portrait mode, or forced
      const shouldPrompt = forceShow || (isMobileWidth && isPortrait && (isTouch || width <= 768))

      setIsPortraitMobile(shouldPrompt)

      // If user rotates to landscape, automatically reset dismissed state
      if (!isPortrait) {
        setDismissed(false)
      }
    }

    checkOrientation()

    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    const mql = window.matchMedia('(orientation: portrait)')
    if (mql?.addEventListener) {
      mql.addEventListener('change', checkOrientation)
    }

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
      if (mql?.removeEventListener) {
        mql.removeEventListener('change', checkOrientation)
      }
    }
  }, [forceShow])

  // If not in portrait mobile or user explicitly dismissed
  if (!isPortraitMobile || dismissed) {
    // If user dismissed in portrait mode, show a subtle floating reminder pill at the top
    if (isPortraitMobile && dismissed) {
      return (
        <div className="sticky top-16 z-30 mx-auto max-w-md px-4 py-2 animate-in fade-in">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 backdrop-blur-md shadow-md">
            <div className="flex items-center gap-2">
              <RotateCw className="h-4 w-4 text-amber-400 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Gợi ý: Xoay ngang màn hình để trải nghiệm mô phỏng 3D trọn vẹn nhất.</span>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(false)}
              className="text-[11px] font-bold text-amber-300 underline shrink-0 hover:text-amber-100"
            >
              Xem yêu cầu
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotate-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-5 text-white backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-center shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        {/* Glow decoration */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-cyan-500/20 blur-2xl pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300">
          <Gamepad2 className="h-3.5 w-3.5 text-cyan-400" />
          <span>Mô Phỏng Nghề Nghiệp 3D</span>
        </div>

        {/* Animated Rotating Phone Illustration */}
        <div className="relative flex items-center justify-center py-2">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-inner">
            <div className="animate-rotate-phone text-cyan-400">
              <Smartphone className="h-12 w-12 stroke-[1.8]" />
            </div>
          </div>
          <div className="absolute -right-1 top-3 text-cyan-400/80 animate-pulse">
            <RotateCw className="h-6 w-6" />
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h2 id="rotate-prompt-title" className="text-xl font-bold tracking-tight text-slate-100">
            Yêu Cầu Xoay Ngang Màn Hình
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Không gian <strong>Mô phỏng nghề nghiệp 3D</strong> cần màn hình ngang (Landscape) để hiển thị đầy đủ góc nhìn, bảng điều khiển và thao tác điều hành nhà máy.
          </p>
        </div>

        {/* Instructions Box */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-left text-xs space-y-2">
          <div className="flex items-start gap-2.5 text-slate-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-800">
              1
            </span>
            <span>Mở thanh điều khiển điện thoại, tắt <strong>Khóa hướng xoay dọc</strong> (Orientation Lock).</span>
          </div>
          <div className="flex items-start gap-2.5 text-slate-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-800">
              2
            </span>
            <span><strong>Xoay ngang điện thoại</strong> — hệ thống sẽ tự động mở màn hình mô phỏng ngay lập tức!</span>
          </div>
        </div>

        {/* Secondary Action: Allow Bypass if User cannot rotate */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-800/60"
          >
            Tiếp tục xem dọc (Không khuyến khích)
          </button>
        </div>
      </div>
    </div>
  )
}
