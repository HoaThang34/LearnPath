import { useState, useEffect } from 'react'
import { BarChart3, Search, Filter, ArrowUpDown, ChevronDown, X, Info, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getDiemChuan,
  getDiemChuanStats,
  getPhuongThuc,
  getNhomNganh,
  getDanhSachKhoiThi
} from '@/lib/api'

// Determine score scale info
function getScoreScale(diemChuan, phuongThuc, ghiChu) {
  // SAT/International certificates → 1600 scale
  if (ghiChu?.includes('SAT') || phuongThuc?.includes('V-SAT')) {
    return { scale: 1600, note: 'Thang 1600 (SAT)' }
  }
  // ĐGNL HSA → 1200 scale
  if (phuongThuc?.includes('HSA')) {
    return { scale: 1200, note: 'Thang 1200 (HSA)' }
  }
  // ĐGNL V-ACT, SPT, QDA, H-SCA, SP2E → 1200 scale
  if (phuongThuc?.includes('V-ACT') || phuongThuc?.includes('SPT') ||
      phuongThuc?.includes('QDA') || phuongThuc?.includes('H-SCA') || phuongThuc?.includes('SP2E')) {
    return { scale: 1200, note: 'Thang 1200' }
  }
  // ĐGTD TSA → 1000 scale
  if (phuongThuc?.includes('ĐGTD TSA')) {
    return { scale: 1000, note: 'Thang 1000 (TSA)' }
  }
  // Standard 30-point scale
  if (diemChuan <= 30) {
    return { scale: 30, note: '' }
  }
  // Check for special scales in ghi_chu
  if (ghiChu?.includes('Thang điểm 40')) {
    return { scale: 40, note: 'Thang 40' }
  }
  // Higher scores = combined scale (likely 1000 or similar)
  if (diemChuan > 30) {
    return { scale: 1000, note: 'Thang điểm tổng hợp' }
  }
  return { scale: 30, note: '' }
}

function getScoreColor(diemChuan, scale) {
  if (!diemChuan) return 'bg-gray-100 text-gray-500'

  if (scale === 30) {
    if (diemChuan >= 27) return 'bg-green-100 text-green-700 border-green-200'
    if (diemChuan >= 24) return 'bg-blue-100 text-blue-700 border-blue-200'
    if (diemChuan >= 20) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }
  if (scale === 1200) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (scale === 1600) return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  if (scale === 1000) return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

export default function DiemChuan() {
  const [phuongThucList, setPhuongThucList] = useState([])
  const [selectedPhuongThuc, setSelectedPhuongThuc] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState('diem_desc')
  const [filterKhoiThi, setFilterKhoiThi] = useState('')
  const [filterNhomNganh, setFilterNhomNganh] = useState('')
  const [nhomNganhList, setNhomNganhList] = useState([])
  const [khoiThiList, setKhoiThiList] = useState([])
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 100

  useEffect(() => {
    fetchPhuongThuc()
    fetchNhomNganh()
    fetchKhoiThi()
    fetchStats()
  }, [])

  useEffect(() => {
    if (selectedPhuongThuc) fetchResults()
  }, [selectedPhuongThuc, sort, filterKhoiThi, filterNhomNganh, page])

  const fetchPhuongThuc = async () => {
    try { const res = await getPhuongThuc(); setPhuongThucList(res.data.data) } catch (e) {}
  }
  const fetchNhomNganh = async () => {
    try { const res = await getNhomNganh(); setNhomNganhList(res.data.data) } catch (e) {}
  }
  const fetchKhoiThi = async () => {
    try { const res = await getDanhSachKhoiThi(); setKhoiThiList(res.data.data) } catch (e) {}
  }
  const fetchStats = async () => {
    try { const res = await getDiemChuanStats(); setStats(res.data.data) } catch (e) {}
  }
  const fetchResults = async () => {
    setLoading(true)
    try {
      const res = await getDiemChuan({
        phuong_thuc: selectedPhuongThuc,
        truong: searchTerm || undefined,
        khoi_thi: filterKhoiThi || undefined,
        nhom_nganh: filterNhomNganh || undefined,
        sort,
        limit: PER_PAGE,
        offset: (page - 1) * PER_PAGE
      })
      setResults(res.data.data)
      setTotal(res.data.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchResults() }
  const handleSelectMethod = (method) => { setSelectedPhuongThuc(method); setPage(1) }
  const clearFilters = () => { setSearchTerm(''); setSort('diem_desc'); setFilterKhoiThi(''); setFilterNhomNganh(''); setPage(1) }
  const hasActiveFilters = searchTerm || sort !== 'diem_desc' || filterKhoiThi || filterNhomNganh
  const totalPages = Math.ceil(total / PER_PAGE)

  // Get scale info for selected method
  const methodScaleInfo = (() => {
    if (selectedPhuongThuc?.includes('THPT')) return { scale: 30, desc: 'Thang điểm 30 (tổng 3 môn thi THPT)' }
    if (selectedPhuongThuc?.includes('học bạ')) return { scale: 30, desc: 'Thang điểm 30 (tổng điểm học bạ)' }
    if (selectedPhuongThuc?.includes('kết hợp')) return { scale: null, desc: 'Thang điểm tùy trường' }
    if (selectedPhuongThuc?.includes('thi riêng')) return { scale: null, desc: 'Thang điểm tùy trường' }
    if (selectedPhuongThuc?.includes('HSA')) return { scale: 1200, desc: 'Thang điểm 1200' }
    if (selectedPhuongThuc?.includes('V-ACT')) return { scale: 1200, desc: 'Thang điểm 1200' }
    if (selectedPhuongThuc?.includes('SPT')) return { scale: 1200, desc: 'Thang điểm 1200' }
    if (selectedPhuongThuc?.includes('QDA')) return { scale: 1200, desc: 'Thang điểm 1200' }
    if (selectedPhuongThuc?.includes('H-SCA')) return { scale: 1200, desc: 'Thang điểm 1200' }
    if (selectedPhuongThuc?.includes('SP2E')) return { scale: 1200, desc: 'Thang điểm 1200' }
    if (selectedPhuongThuc?.includes('TSA')) return { scale: 1000, desc: 'Thang điểm 1000' }
    if (selectedPhuongThuc?.includes('V-SAT')) return { scale: 1600, desc: 'Thang điểm 1600' }
    return { scale: null, desc: '' }
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Điểm chuẩn</h1>
          <p className="text-muted-foreground">Tra cứu điểm chuẩn theo phương thức xét tuyển</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.tongTruong}</div><div className="text-xs text-muted-foreground">Trường</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.tongNganh}</div><div className="text-xs text-muted-foreground">Ngành</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-600">{stats.diemCaoNhat}</div><div className="text-xs text-muted-foreground">Điểm cao nhất</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-red-600">{stats.diemThapNhat}</div><div className="text-xs text-muted-foreground">Điểm thấp nhất</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.diemTrungBinh?.toFixed(2)}</div><div className="text-xs text-muted-foreground">Điểm trung bình</div></CardContent></Card>
        </div>
      )}

      {/* Step 1: Select Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
            Chọn phương thức xét tuyển
          </CardTitle>
          <CardDescription>Mỗi phương thức có thang điểm riêng. Chọn để xem dữ liệu tương ứng.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {phuongThucList.map((method) => (
              <Button
                key={method}
                variant={selectedPhuongThuc === method ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSelectMethod(method)}
              >
                {method}
              </Button>
            ))}
          </div>
          {selectedPhuongThuc && (
            <div className="mt-3 p-3 bg-muted rounded-lg text-sm flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{selectedPhuongThuc}</strong>: {methodScaleInfo.desc}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Filters */}
      {selectedPhuongThuc && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              Bộ lọc & Sắp xếp
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — {selectedPhuongThuc}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tìm trường</Label>
                <Input placeholder="Tên trường..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)} />
              </div>
              <div className="space-y-2">
                <Label>Sắp xếp điểm</Label>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="diem_desc">Điểm cao → thấp</option>
                  <option value="diem_asc">Điểm thấp → cao</option>
                  <option value="name_asc">Tên ngành A → Z</option>
                  <option value="name_desc">Tên ngành Z → A</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Khối thi</Label>
                <select value={filterKhoiThi} onChange={(e) => { setFilterKhoiThi(e.target.value); setPage(1) }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Tất cả</option>
                  {khoiThiList.map((k) => (<option key={k.ma_khoi} value={k.ma_khoi}>{k.ma_khoi}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Nhóm ngành</Label>
                <select value={filterNhomNganh} onChange={(e) => { setFilterNhomNganh(e.target.value); setPage(1) }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Tất cả</option>
                  {nhomNganhList.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleSearch}><Search className="h-4 w-4 mr-2" />Tìm kiếm</Button>
              {hasActiveFilters && (<Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Xóa bộ lọc</Button>)}
              <div className="ml-auto text-sm text-muted-foreground">
                {total > 0 && `Tìm thấy ${total.toLocaleString()} kết quả`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {selectedPhuongThuc && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium w-12">#</th>
                    <th className="text-left p-3 font-medium">Trường</th>
                    <th className="text-left p-3 font-medium">Ngành</th>
                    <th className="text-left p-3 font-medium">Tổ hợp môn</th>
                    <th className="text-center p-3 font-medium">Điểm chuẩn</th>
                    <th className="text-center p-3 font-medium">Thang</th>
                    <th className="text-left p-3 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">Đang tải...</td></tr>
                  ) : results.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">Không tìm thấy kết quả</td></tr>
                  ) : (
                    results.map((item, index) => {
                      const scoreInfo = getScoreScale(item.diem_chuan, selectedPhuongThuc, item.ghi_chu)
                      const bgColor = getScoreColor(item.diem_chuan, scoreInfo.scale)
                      return (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-muted-foreground">{(page - 1) * PER_PAGE + index + 1}</td>
                          <td className="p-3">{item.truong}</td>
                          <td className="p-3 font-medium max-w-[300px] truncate" title={item.nganh}>{item.nganh}</td>
                          <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{item.to_hop_mon}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${bgColor}`}>
                              {scoreInfo.scale === 30 ? item.diem_chuan?.toFixed(2) : item.diem_chuan?.toFixed(0)}
                            </span>
                          </td>
                          <td className="p-3 text-center text-xs text-muted-foreground">
                            {scoreInfo.scale === 30 ? '30' : scoreInfo.scale}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{item.ghi_chu}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">Trang {page} / {totalPages}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Trước</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Sau</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedPhuongThuc && (
        <Card><CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Chọn phương thức xét tuyển ở bước 1 để xem dữ liệu</p>
            <p className="text-sm mt-2">Mỗi phương thức có thang điểm riêng, không thể so sánh trực tiếp</p>
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}
