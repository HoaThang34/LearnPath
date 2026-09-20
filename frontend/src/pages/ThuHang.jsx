import { useState } from 'react'
import { Trophy, Calculator, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRanking } from '@/lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const monHoc = [
  { key: 'toan', label: 'Toán', color: '#2563eb' },
  { key: 'van', label: 'Văn', color: '#dc2626' },
  { key: 'ly', label: 'Lý', color: '#16a34a' },
  { key: 'hoa', label: 'Hóa', color: '#ca8a04' },
  { key: 'sinh', label: 'Sinh', color: '#9333ea' },
  { key: 'su', label: 'Sử', color: '#ea580c' },
  { key: 'dia', label: 'Địa', color: '#0891b2' },
  { key: 'ngoai_ngu', label: 'Ngoại ngữ', color: '#db2777' },
  { key: 'tin_hoc', label: 'Tin học', color: '#4f46e5' },
]

export default function ThuHang() {
  const [scores, setScores] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleScoreChange = (key, value) => {
    const numValue = parseFloat(value)
    if (value === '' || (numValue >= 0 && numValue <= 10)) {
      setScores(prev => ({
        ...prev,
        [key]: value === '' ? '' : numValue
      }))
    }
  }

  const handleCalculate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const params = {}
      Object.keys(scores).forEach(key => {
        if (scores[key] !== '' && scores[key] !== undefined) {
          params[key] = scores[key]
        }
      })
      const response = await getRanking(params)
      setResult(response.data.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Trophy className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tra cứu thứ hạng THPTQG 2026</h1>
          <p className="text-muted-foreground">Nhập điểm thi để biết thứ hạng của bạn</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nhập điểm thi</CardTitle>
            <CardDescription>Nhập điểm các môn bạn đã thi (để trống nếu không thi môn đó)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCalculate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {monHoc.map((mon) => (
                  <div key={mon.key} className="space-y-2">
                    <Label htmlFor={mon.key} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: mon.color }}
                      />
                      <span>{mon.label}</span>
                    </Label>
                    <Input
                      id={mon.key}
                      type="number"
                      step="0.25"
                      min="0"
                      max="10"
                      placeholder="0 - 10"
                      value={scores[mon.key] || ''}
                      onChange={(e) => handleScoreChange(mon.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Calculator className="h-4 w-4 mr-2" />
                {loading ? 'Đang tính...' : 'Tính thứ hạng'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Kết quả</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-6">
                {/* Ranking Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-3xl font-bold text-primary">{result.thuHang}</div>
                    <div className="text-sm text-muted-foreground">Thứ hạng</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-3xl font-bold">{result.tongDiem.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Tổng điểm</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-600">
                      Top {result.tyLePhanTram}%
                    </div>
                    <div className="text-sm text-muted-foreground">Phần trăm</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-3xl font-bold">{result.tongThiSinh.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Tổng thí sinh</div>
                  </div>
                </div>

                {/* Score Summary */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Điểm đã nhập:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.diemNhap).map(([key, value]) => {
                      if (value === null) return null
                      const mon = monHoc.find(m => m.key === key)
                      return (
                        <span
                          key={key}
                          className="px-3 py-1 rounded-full text-sm text-white"
                          style={{ backgroundColor: mon?.color }}
                        >
                          {mon?.label}: {value}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Distribution Chart */}
                {result.phanBoDiem && result.phanBoDiem.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Phân bố điểm:</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={result.phanBoDiem}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="khoang_diem" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="so_thi_sinh" fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nhập điểm và nhấn "Tính thứ hạng" để xem kết quả</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
