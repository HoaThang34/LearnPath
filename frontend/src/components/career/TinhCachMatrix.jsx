import { cn } from '@/lib/utils'

const CELLS = [
  {
    id: 1,
    title: '① Vừa sức · Vừa hợp',
    hint: 'Ưu tiên khám phá',
    range: 'học lực ≥ 70 · tính cách ≥ 65',
  },
  {
    id: 2,
    title: '② Vừa sức · Chưa hợp',
    hint: 'Xem lại vì sao chọn',
    range: 'học lực ≥ 70 · tính cách < 65',
  },
  {
    id: 3,
    title: '③ Cần cân nhắc kỹ',
    hint: 'Nâng điểm hoặc đổi ngành',
    range: '50 ≤ học lực < 70 · tính cách ≥ 65',
  },
  {
    id: 4,
    title: '④ Trung tính',
    hint: 'Chưa đủ tín hiệu',
    range: '50 ≤ học lực < 70 · tính cách < 65',
  },
  {
    id: 5,
    title: '⑤ Mơ ước · Cần lộ trình',
    hint: 'Mục tiêu dài hạn',
    range: 'học lực < 50 · tính cách ≥ 65',
  },
  {
    id: 6,
    title: '⑥ Không nên ưu tiên',
    hint: 'Tìm hiểu thêm trước khi quyết định',
    range: 'học lực < 50 · tính cách < 65',
  },
]

export default function TinhCachMatrix({ cell, compact = false }) {
  return (
    <div className={cn('mt-2 grid grid-cols-2 gap-1.5', compact && 'text-[10px]')}>
      {CELLS.map((item) => {
        const active = Number(cell) === item.id
        return (
          <div
            key={item.id}
            className={cn(
              'rounded-md border p-1.5',
              active
                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'border-slate-200 bg-white text-slate-600'
            )}
            title={item.range}
          >
            <p className="font-semibold leading-tight">{item.title}</p>
            <p className="text-[10px] leading-tight opacity-80">{item.hint}</p>
          </div>
        )
      })}
      {cell === null || cell === undefined ? (
        <p className="col-span-2 text-[10px] text-muted-foreground">
          Chưa đủ một trong hai tỉ lệ để xác định ô ma trận.
        </p>
      ) : null}
    </div>
  )
}
