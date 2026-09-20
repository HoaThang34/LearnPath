import { useState, useEffect } from 'react'
import { Search, ExternalLink, BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDeAn, getDeAnByMaTruong } from '@/lib/api'

export default function DeAnTuyenSinh() {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    setLoading(true)
    try {
      const response = await getDeAn({ search: searchTerm, limit: 50 })
      setResults(response.data.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchResults()
  }

  const handleSelectSchool = async (maTruong) => {
    setLoading(true)
    try {
      const response = await getDeAnByMaTruong(maTruong)
      setSelectedSchool(response.data.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Search className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tra cứu đề án tuyển sinh</h1>
          <p className="text-muted-foreground">Tìm kiếm đề án tuyển sinh các trường đại học năm 2026</p>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Tìm kiếm trường</CardTitle>
          <CardDescription>Nhập tên trường hoặc mã trường để tìm kiếm</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Tìm kiếm</Label>
              <Input
                id="search"
                placeholder="Nhập tên trường hoặc mã trường..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit">
              <Search className="h-4 w-4 mr-2" />
              Tìm kiếm
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List of schools */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách trường ({results.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">Đang tải...</div>
                ) : results.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">Không tìm thấy kết quả</div>
                ) : (
                  results.map((school) => (
                    <button
                      key={school.ma_truong}
                      onClick={() => handleSelectSchool(school.ma_truong)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedSchool?.ma_truong === school.ma_truong
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium text-sm">[{school.ma_truong}]</div>
                      <div className="text-xs opacity-80">{school.ten_truong}</div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedSchool ? selectedSchool.ten_truong : 'Chọn trường để xem chi tiết'}
              </CardTitle>
              {selectedSchool && (
                <CardDescription>Mã trường: {selectedSchool.ma_truong}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedSchool ? (
                <div className="space-y-4">
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm">
                      {selectedSchool.noi_dung}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chọn một trường từ danh sách bên trái để xem đề án tuyển sinh</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
