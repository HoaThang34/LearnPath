import { cn } from '@/lib/utils'

export const REASON_LABELS = {
  thieu_diem_mon: 'Thiếu điểm môn trong tổ hợp',
  thieu_to_hop: 'Chưa xác định được tổ hợp',
  thieu_diem_chuan: 'Ngành chưa có điểm chuẩn',
  diem_chuan_khong_hop_le: 'Điểm chuẩn không hợp lệ',
  diem_chuan_ngoai_phan_bo: 'Điểm chuẩn nằm ngoài phân bố',
  thieu_trong_so_tinh_cach: 'Nhóm ngành chưa có trọng số tính cách',
  chua_du_cau_tra_loi: 'Chưa đủ câu trả lời sở thích',
  thieu_diem_thi: 'Chưa có điểm thi/dự kiến theo tổ hợp',
  thieu_hoc_luc: 'Chưa đủ dữ liệu học lực',
  thieu_tinh_cach: 'Chưa đủ dữ liệu tính cách',
  phuong_thuc_khac: 'Phương thức khác Điểm thi THPT',
  mapping_chua_doi_chieu: 'Mã trường chưa đối chiếu',
}

export function translateReason(reason) {
  return REASON_LABELS[reason] || reason
}

function FitRow({ label, value, tone, dashed = false, reasons = [] }) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value))
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn('tabular-nums font-semibold', hasValue ? tone.text : 'text-slate-400')}>
          {hasValue ? `${Number(value).toFixed(1)} %` : '—'}
        </span>
      </div>
      <div
        className={cn(
          'mt-1 h-2 overflow-hidden rounded-full bg-slate-100',
          dashed && 'border border-dashed border-teal-300 p-px'
        )}
      >
        {hasValue && (
          <div
            className={cn('h-full rounded-full', tone.bar)}
            style={{ width: `${Math.max(0, Math.min(Number(value), 100))}%` }}
          />
        )}
      </div>
      {!hasValue && reasons.length > 0 && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{reasons.map(translateReason).join(' · ')}</p>
      )}
    </div>
  )
}

export default function FitBars({ data, config }) {
  if (!data) {
    return (
      <p className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
        Chưa tải được ba tỉ lệ phù hợp cho ngành này.
      </p>
    )
  }
  const reasons = data.reasons || []
  const hocReasons = reasons.filter((reason) =>
    ['thieu_diem_thi', 'thieu_diem_chuan', 'diem_chuan_khong_hop_le', 'thieu_to_hop', 'diem_chuan_ngoai_phan_bo'].includes(reason)
  )
  const tinhReasons = reasons.filter((reason) =>
    ['chua_du_cau_tra_loi', 'thieu_trong_so_tinh_cach'].includes(reason)
  )
  const tongReasons = reasons.filter((reason) =>
    ['thieu_hoc_luc', 'thieu_tinh_cach', 'chua_du_cau_tra_loi'].includes(reason)
  )
  const wHoc = config?.w_hoc_luc ?? 0.6
  const wTinh = config?.w_tinh_cach ?? 0.4
  return (
    <div className="mt-2 space-y-2 rounded-md border bg-slate-50/60 p-2.5">
      <FitRow
        label="Phù hợp học lực"
        value={data.hocLucFit}
        tone={{ text: 'text-blue-700', bar: 'bg-blue-600' }}
        reasons={hocReasons}
      />
      <FitRow
        label="Phù hợp tính cách"
        value={data.tinhCachFit}
        tone={{ text: 'text-violet-700', bar: 'bg-violet-600' }}
        reasons={tinhReasons}
      />
      <FitRow
        label="Phù hợp tổng thể"
        value={data.tongHopFit}
        tone={{ text: 'text-teal-700', bar: 'bg-teal-600' }}
        dashed
        reasons={tongReasons}
      />
      <p className="text-[10px] leading-snug text-muted-foreground">
        Tổng thể = {Math.round(wHoc * 100)} % học lực + {Math.round(wTinh * 100)} % tính cách. Đây là mức đáp ứng
        yêu cầu của ngành, không phải xác suất trúng tuyển.
      </p>
    </div>
  )
}
