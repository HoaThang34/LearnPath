import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Award,
  BarChart2,
  Table as TableIcon,
  Compass,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import FitBars from '@/components/career/FitBars'
import TinhCachMatrix from '@/components/career/TinhCachMatrix'
import InterestChart from '@/components/interest/InterestChart'
import BipolarAxisChart from '@/components/interest/BipolarAxisChart'
import { cn } from '@/lib/utils'

export default function ArtifactRenderer({ artifact }) {
  if (!artifact || typeof artifact !== 'object') return null

  switch (artifact.type) {
    case 'fit_ranking': {
      const rows = artifact.rows || []
      return (
        <Card className="my-3 border-teal-200/80 bg-teal-50/20 shadow-xs">
          <CardHeader className="py-2.5 px-3.5 border-b bg-teal-50/50">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-xs font-semibold text-teal-900">
                {artifact.title || 'Xếp hạng mức độ phù hợp ngành'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-2.5">
            {rows.map((row, idx) => {
              const bestVal = row.groupFit ?? row.tongHopFit ?? row.hocLucFit ?? 0
              return (
                <div
                  key={`${row.schoolCode || ''}-${row.major}-${idx}`}
                  className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-2xs hover:border-teal-300 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold text-slate-800">
                      <span className="inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded-full bg-teal-100 text-[10px] font-bold text-teal-800">
                        {idx + 1}
                      </span>
                      {row.major}
                    </div>
                    {row.entryScore !== null && row.entryScore !== undefined && (
                      <span className="text-[11px] font-medium text-slate-600 tabular-nums">
                        ĐC 2025: <strong className="text-slate-900">{row.entryScore}</strong>
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground flex flex-wrap gap-x-2">
                    <span>{row.school}</span>
                    {row.block && <span>· Tổ hợp: {row.block}</span>}
                  </div>

                  {/* 3 mini bars */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-blue-50/80 rounded p-1 border border-blue-100">
                      <div className="flex justify-between text-blue-900">
                        <span>Học lực</span>
                        <span className="font-bold">{row.hocLucFit !== null ? `${row.hocLucFit}%` : '—'}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, row.hocLucFit || 0))}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-purple-50/80 rounded p-1 border border-purple-100">
                      <div className="flex justify-between text-purple-900">
                        <span>Tính cách</span>
                        <span className="font-bold">{row.tinhCachFit !== null ? `${row.tinhCachFit}%` : '—'}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, row.tinhCachFit || 0))}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-teal-50/80 rounded p-1 border border-teal-100">
                      <div className="flex justify-between text-teal-900">
                        <span>Tổng thể</span>
                        <span className="font-bold">{bestVal !== null ? `${bestVal}%` : '—'}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-teal-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, bestVal))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {artifact.warning && (
              <p className="text-[10px] text-muted-foreground italic pt-1">{artifact.warning}</p>
            )}
          </CardContent>
        </Card>
      )
    }

    case 'fit_detail': {
      return (
        <Card className="my-3 border-indigo-200/80 bg-indigo-50/20 shadow-xs">
          <CardHeader className="py-2.5 px-3.5 border-b bg-indigo-50/50">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-xs font-semibold text-indigo-900">
                Chi tiết đánh giá · {artifact.title}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            <FitBars data={artifact.data} config={artifact.config} />
            <div className="pt-2">
              <p className="text-[11px] font-medium text-slate-700">Ma trận vị trí năng lực & sở thích (3×2):</p>
              <TinhCachMatrix cell={artifact.matrixCell} compact={true} />
            </div>
          </CardContent>
        </Card>
      )
    }

    case 'interest_profile': {
      return (
        <Card className="my-3 border-amber-200/80 bg-amber-50/20 shadow-xs">
          <CardHeader className="py-2.5 px-3.5 border-b bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-xs font-semibold text-amber-900">
                {artifact.title || 'Biểu đồ sở thích nghề nghiệp (Holland RIASEC)'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-4">
            <InterestChart
              groups={artifact.groups || []}
              pairs={artifact.pairs || []}
              topGroups={artifact.topGroups || []}
            />
            {artifact.pairs && artifact.pairs.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-800 mb-2">4 trục đối lập (Bipolar Pairs):</p>
                <BipolarAxisChart pairs={artifact.pairs} />
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    case 'academic_scores': {
      const rows = artifact.rows || []
      return (
        <Card className="my-3 border-blue-200/80 bg-blue-50/20 shadow-xs">
          <CardHeader className="py-2.5 px-3.5 border-b bg-blue-50/50">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-xs font-semibold text-blue-900">
                {artifact.title || 'Điểm học bạ'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded border bg-white p-2 text-xs">
                  <span className="text-muted-foreground block text-[11px] truncate">{r.subject}</span>
                  <span className="text-sm font-bold text-blue-700">{Number(r.score).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    }

    case 'table': {
      const columns = artifact.columns || []
      const rows = artifact.rows || []
      return (
        <Card className="my-3 border-slate-200 shadow-xs">
          <CardHeader className="py-2.5 px-3.5 border-b bg-slate-50">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-slate-600" />
              <CardTitle className="text-xs font-semibold text-slate-800">
                {artifact.title || 'Bảng dữ liệu'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[11px] text-muted-foreground border-b uppercase font-semibold">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/60">
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                        {row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )
    }

    case 'rank': {
      return (
        <Card className="my-3 border-purple-200 bg-purple-50/30 shadow-xs">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2 text-purple-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="text-xs">
              <p className="font-semibold text-purple-950">
                Thứ hạng ước tính: #{artifact.thuHang?.toLocaleString('vi-VN')} / {artifact.tongThiSinh?.toLocaleString('vi-VN')}
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Tổng 4 môn: <strong>{artifact.tongDiem}</strong> · Top {artifact.topPhanTram}% toàn quốc
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    case 'benchmark': {
      return (
        <Card className="my-3 border-emerald-200 bg-emerald-50/30 shadow-xs">
          <CardHeader className="py-2 px-3 border-b bg-emerald-50/50">
            <CardTitle className="text-xs font-semibold text-emerald-900">{artifact.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white rounded p-2 border border-emerald-100">
              <span className="text-[11px] text-muted-foreground block">Phân vị</span>
              <strong className="text-emerald-700 text-sm">{artifact.percentile}%</strong>
            </div>
            <div className="bg-white rounded p-2 border border-emerald-100">
              <span className="text-[11px] text-muted-foreground block">Tỉ lệ đạt ≥ điểm</span>
              <strong className="text-emerald-700 text-sm">{artifact.pBench}%</strong>
            </div>
            <div className="bg-white rounded p-2 border border-emerald-100">
              <span className="text-[11px] text-muted-foreground block">Điểm trung bình</span>
              <strong className="text-slate-700 text-sm">{artifact.mean}</strong>
            </div>
            <div className="bg-white rounded p-2 border border-emerald-100">
              <span className="text-[11px] text-muted-foreground block">Trung vị</span>
              <strong className="text-slate-700 text-sm">{artifact.median}</strong>
            </div>
          </CardContent>
        </Card>
      )
    }

    case 'links': {
      const links = artifact.links || []
      return (
        <div className="my-2.5 rounded-lg border border-dashed border-sky-300 bg-sky-50/50 p-2.5">
          <p className="text-[11px] font-semibold text-sky-900 mb-1.5 flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5 text-sky-600" />
            {artifact.title || 'Lối tắt thao tác nhanh:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {links.map((link, i) => (
              <Link
                key={i}
                to={link.path}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-white border border-sky-200 text-sky-700 hover:bg-sky-100 hover:text-sky-900 transition-colors shadow-2xs font-medium"
              >
                <span>{link.label}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
