import { useState, useEffect } from 'react'
import { BookOpen, Search, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getKhoiThi, getDanhSachKhoiThi, getKhoiThiByMaKhoi } from '@/lib/api'

export default function KhoiThi() {
  const [selectedKhoi, setSelectedKhoi] = useState(null)
  const [danhSachKhoi, setDanhSachKhoi] = useState([])
  const [results, setResults] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDanhSachKhoi()
  }, [])

  const fetchDanhSachKhoi = async () => {
    try {
      const response = await getDanhSachKhoiThi()
      setDanhSachKhoi(response.data.data)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleSelectKhoi = async (maKhoi) => {
    setSelectedKhoi(maKhoi)
    setLoading(true)
    try {
      const response = await getKhoiThiByMaKhoi(maKhoi)
      setResults(response.data.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = results.filter(item =>
    item.ten_truong?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ma_truong?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BookOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Khối thi</h1>
          <p className="text-muted-foreground">Danh sách khối thi và các trường đại học xét tuyển</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Danh sách khối thi */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Danh sách khối</CardTitle>
              <CardDescription>Chọn khối thi để xem trường</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto space-y-1">
                {danhSachKhoi.map((khoi) => (
                  <button
                    key={khoi.ma_khoi}
                    onClick={() => handleSelectKhoi(khoi.ma_khoi)}
                    className={`w-full text-left p-2 rounded-md transition-colors text-sm ${
                      selectedKhoi === khoi.ma_khoi
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">{khoi.ma_khoi}</div>
                    <div className="text-xs opacity-70 truncate">{khoi.mon_xet_tuyen}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kết quả */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {selectedKhoi ? `Khối ${selectedKhoi}` : 'Chọn khối thi'}
                </span>
                {selectedKhoi && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {filteredResults.length} trường
                  </span>
                )}
              </CardTitle>
              {selectedKhoi && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="searchSchool" className="sr-only">Tìm trường</Label>
                    <Input
                      id="searchSchool"
                      placeholder="Tìm trường..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selectedKhoi ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chọn một khối thi từ danh sách bên trái</p>
                </div>
              ) : loading ? (
                <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Mã trường</th>
                        <th className="text-left p-3 font-medium">Tên trường</th>
                        <th className="text-center p-3 font-medium">Số ngành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-mono text-muted-foreground">{item.ma_truong}</td>
                          <td className="p-3">{item.ten_truong}</td>
                          <td className="p-3 text-center">{item.so_nganh}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
