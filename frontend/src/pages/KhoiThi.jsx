import { useState, useEffect } from 'react'
import { Layers, Search, X, Plus, BarChart3, ChevronRight, ArrowLeft, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getKhoiThiList,
  getKhoiThiById,
  getDiemChuan,
  compareDiemChuan,
  getPhuongThuc
} from '@/lib/api'

function getScoreColor(diemChuan, phuongThuc) {
  if (!diemChuan) return 'bg-gray-100 text-gray-500 border-gray-200'
  if (phuongThuc?.includes('SAT')) return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  if (phuongThuc?.includes('V-ACT')) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (phuongThuc?.includes('HSA')) return 'bg-cyan-100 text-cyan-700 border-cyan-200'
  if (phuongThuc?.includes('TSA')) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (diemChuan >= 27) return 'bg-green-100 text-green-700 border-green-200'
  if (diemChuan >= 24) return 'bg-blue-100 text-blue-700 border-blue-200'
  if (diemChuan >= 20) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

function StepIndicator({ currentStep }) {
  const steps = [
    { num: 1, label: 'Chọn khối thi' },
    { num: 2, label: 'Chọn trường' },
    { num: 3, label: 'Xem ngành' },
  ]
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              currentStep > s.num ? 'bg-green-500 text-white' :
              currentStep === s.num ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
              'bg-muted text-muted-foreground'
            }`}>
              {currentStep > s.num ? <Check className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-xs mt-1 whitespace-nowrap ${
              currentStep >= s.num ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-1 mt-[-18px] ${
              currentStep > s.num ? 'bg-green-500' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function KhoiThi() {
  const [khoiThiList, setKhoiThiList] = useState([])
  const [selectedKhoi, setSelectedKhoi] = useState(null)
  const [khoiInfo, setKhoiInfo] = useState(null)
  const [truongList, setTruongList] = useState([])
  const [selectedTruong, setSelectedTruong] = useState(null)
  const [tenTruong, setTenTruong] = useState('')
  const [nganhList, setNganhList] = useState([])
  const [phuongThucList, setPhuongThucList] = useState([])
  const [filterPhuongThuc, setFilterPhuongThuc] = useState('')
  const [searchKhoi, setSearchKhoi] = useState('')
  const [searchTruong, setSearchTruong] = useState('')
  const [searchNganh, setSearchNganh] = useState('')
  const [compareList, setCompareList] = useState([])
  const [compareData, setCompareData] = useState([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  useEffect(() => {
    fetchKhoiThiList()
    fetchPhuongThuc()
  }, [])

  const fetchKhoiThiList = async () => {
    try {
      const res = await getKhoiThiList()
      setKhoiThiList(res.data.data)
    } catch (e) {}
  }

  const fetchPhuongThuc = async () => {
    try {
      const res = await getPhuongThuc()
      setPhuongThucList(res.data.data)
    } catch (e) {}
  }

  const handleSelectKhoi = async (khoi) => {
    setLoading(true)
    setSelectedKhoi(khoi.ma_khoi)
    setKhoiInfo(khoi)
    setSelectedTruong(null)
    setNganhList([])
    setStep(2)
    try {
      const res = await getKhoiThiById(khoi.ma_khoi)
      setTruongList(res.data.data.truong)
    } catch (e) {}
    finally { setLoading(false) }
  }

  const handleSelectTruong = async (truong) => {
    setLoading(true)
    setSelectedTruong(truong.ma_truong)
    setTenTruong(truong.ten_truong)
    setStep(3)
    setFilterPhuongThuc('')
    setSearchNganh('')
    try {
      const res = await getDiemChuan({ ma_truong: truong.ma_truong, khoi_thi: selectedKhoi, limit: 500 })
      setNganhList(res.data.data)
    } catch (e) {}
    finally { setLoading(false) }
  }

  const handleFilterPhuongThuc = async (value) => {
    setFilterPhuongThuc(value)
    if (!selectedTruong) return
    setLoading(true)
    try {
      const params = { ma_truong: selectedTruong, khoi_thi: selectedKhoi, limit: 500 }
      if (value) params.phuong_thuc = value
      const res = await getDiemChuan(params)
      setNganhList(res.data.data)
    } catch (e) {}
    finally { setLoading(false) }
  }

  const handleAddCompare = (item) => {
    if (compareList.find(c => c.id === item.id)) return
    if (compareList.length >= 5) return
    setCompareList([...compareList, item])
  }

  const handleRemoveCompare = (id) => {
    setCompareList(compareList.filter(c => c.id !== id))
  }

  const handleCompare = async () => {
    if (compareList.length < 2) return
    try {
      const res = await compareDiemChuan(compareList.map(c => c.id))
      setCompareData(res.data.data)
    } catch (e) {}
  }

  const goBack = () => {
    if (step === 3) {
      setStep(2)
      setSelectedTruong(null)
      setNganhList([])
    } else if (step === 2) {
      setStep(1)
      setSelectedKhoi(null)
      setTruongList([])
    }
  }

  const filteredKhoi = khoiThiList.filter(k =>
    k.ma_khoi.toLowerCase().includes(searchKhoi.toLowerCase()) ||
    k.mon_thi.toLowerCase().includes(searchKhoi.toLowerCase())
  )

  const filteredTruong = truongList.filter(t =>
    t.ten_truong.toLowerCase().includes(searchTruong.toLowerCase())
  )

  const filteredNganh = nganhList.filter(n =>
    n.nganh.toLowerCase().includes(searchNganh.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Layers className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Khối thi & Ngành đào tạo</h1>
          <p className="text-muted-foreground">Xem điểm chuẩn theo khối thi, trường và ngành</p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* STEP 1: Chọn khối thi */}
      {step === 1 && (
        <div>
          <div className="mb-4 text-sm text-muted-foreground">
            Chọn một khối thi để xem các trường xét tuyển khối đó
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã khối hoặc tên môn (ví dụ: A00, Toán, Văn, Anh...)"
              value={searchKhoi}
              onChange={(e) => setSearchKhoi(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredKhoi.map((khoi) => (
              <button
                key={khoi.ma_khoi}
                onClick={() => handleSelectKhoi(khoi)}
                className="group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className="text-xl font-bold text-primary group-hover:text-primary">{khoi.ma_khoi}</div>
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-[32px]">{khoi.mon_thi}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{khoi.so_truong} trường</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
            {filteredKhoi.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Không tìm thấy khối thi phù hợp
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Chọn trường */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Đổi khối
            </Button>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm">{selectedKhoi}</span>
              <span className="text-sm text-muted-foreground">— {khoiInfo?.mon_thi}</span>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tên trường..."
              value={searchTruong}
              onChange={(e) => setSearchTruong(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredTruong.map((truong) => (
                <button
                  key={truong.ma_truong}
                  onClick={() => handleSelectTruong(truong)}
                  className="group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
                >
                  <div className="font-medium text-sm line-clamp-2 min-h-[36px]">{truong.ten_truong}</div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{truong.ma_truong}</span>
                    <span className="text-xs text-muted-foreground">{truong.so_nganh} ngành</span>
                  </div>
                </button>
              ))}
              {filteredTruong.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Không tìm thấy trường nào
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Xem ngành */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Đổi trường
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm">{selectedKhoi}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">{tenTruong}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm tên ngành..."
                value={searchNganh}
                onChange={(e) => setSearchNganh(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={filterPhuongThuc}
              onChange={(e) => handleFilterPhuongThuc(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">Tất cả phương thức</option>
              {phuongThucList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
          ) : filteredNganh.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Không tìm thấy ngành nào</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredNganh.map((item) => {
                const colorClass = getScoreColor(item.diem_chuan, item.phuong_thuc)
                const isComparing = compareList.find(c => c.id === item.id)
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isComparing ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/30 hover:shadow-sm bg-card'
                    }`}
                  >
                    <div className="font-medium text-sm line-clamp-2 min-h-[40px]">{item.nganh}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold border ${colorClass}`}>
                        {item.diem_chuan?.toFixed(2) || '-'}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.phuong_thuc}</span>
                    </div>
                    {item.to_hop_mon && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Tổ hợp: {item.to_hop_mon}
                      </div>
                    )}
                    <Button
                      variant={isComparing ? "default" : "outline"}
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => isComparing ? handleRemoveCompare(item.id) : handleAddCompare(item)}
                      disabled={!isComparing && compareList.length >= 5}
                    >
                      {isComparing ? (
                        <><X className="h-3.5 w-3.5 mr-1" /> Bỏ so sánh</>
                      ) : (
                        <><Plus className="h-3.5 w-3.5 mr-1" /> Thêm so sánh</>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Compare Panel - fixed at bottom */}
      {compareList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
          <div className="container mx-auto px-4 py-3">
            {/* Selected items */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <BarChart3 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium shrink-0">So sánh ({compareList.length}/5):</span>
              {compareList.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-xs"
                >
                  <span className="line-clamp-1 max-w-[120px]">{item.nganh}</span>
                  <button
                    onClick={() => handleRemoveCompare(item.id)}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Compare results inline */}
            {compareData.length > 0 && (
              <div className="mt-2 mb-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {compareData.sort((a, b) => (b.diem_chuan || 0) - (a.diem_chuan || 0)).map((item) => (
                    <div key={item.id} className="p-2 rounded-lg border bg-muted/30 text-xs">
                      <div className="font-medium line-clamp-1">{item.nganh}</div>
                      <div className="text-muted-foreground line-clamp-1 mt-0.5">{item.truong}</div>
                      <div className="mt-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${getScoreColor(item.diem_chuan, item.phuong_thuc)}`}>
                          {item.diem_chuan?.toFixed(2)}
                        </span>
                        <span className="ml-1 text-muted-foreground">{item.phuong_thuc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => { setCompareList([]); setCompareData([]) }}>
                Xóa hết
              </Button>
              <Button size="sm" onClick={handleCompare} disabled={compareList.length < 2}>
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                So sánh ngay
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for compare panel */}
      {compareList.length > 0 && <div className="h-20" />}
    </div>
  )
}
