import { Link } from 'react-router-dom'
import { Search, BarChart3, BookOpen, Trophy, ArrowRight, GraduationCap, Users, School } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const features = [
  {
    title: 'Đề án tuyển sinh',
    description: 'Tra cứu đề án tuyển sinh các trường đại học năm 2026',
    icon: Search,
    link: '/de-an',
    color: 'text-blue-600'
  },
  {
    title: 'Điểm chuẩn',
    description: 'Xem điểm chuẩn các trường đại học qua các năm',
    icon: BarChart3,
    link: '/diem-chuan',
    color: 'text-green-600'
  },
  {
    title: 'Khối thi',
    description: 'Danh sách khối thi và các trường đại học xét tuyển',
    icon: BookOpen,
    link: '/khoi-thi',
    color: 'text-purple-600'
  },
  {
    title: 'Thứ hạng THPTQG',
    description: 'Tra cứu thứ hạng dựa trên điểm thi THPTQG 2026',
    icon: Trophy,
    link: '/thu-hang',
    color: 'text-orange-600'
  }
]

export default function TrangChu() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 py-12">
        <div className="flex justify-center">
          <img src="/logo/LearnPath_xoanen.png" alt="LearnPath" className="h-24 w-auto" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          LearnPath
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Hệ thống tư vấn hướng nghiệp giúp bạn tìm ra ngành học và trường đại học phù hợp
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/de-an">
              Bắt đầu khám phá
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trường đại học</CardTitle>
            <School className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">200+</div>
            <p className="text-xs text-muted-foreground">Trường đại học trên cả nước</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ngành đào tạo</CardTitle>
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1000+</div>
            <p className="text-xs text-muted-foreground">Ngành đào tạo đa dạng</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thí sinh</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1M+</div>
            <p className="text-xs text-muted-foreground">Thí sinh dự thi THPTQG</p>
          </CardContent>
        </Card>
      </section>

      {/* Features Section */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-8">Tính năng chính</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.link} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg bg-muted ${feature.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={feature.link}>
                      Khám phá ngay
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Guide Section */}
      <section className="bg-muted rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Hướng dẫn sử dụng</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
              1
            </div>
            <h3 className="font-medium">Tra cứu thông tin</h3>
            <p className="text-sm text-muted-foreground">
              Tìm kiếm trường đại học, ngành học và điểm chuẩn
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
              2
            </div>
            <h3 className="font-medium">So sánh lựa chọn</h3>
            <p className="text-sm text-muted-foreground">
              So sánh điểm chuẩn, khối thi giữa các trường
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
              3
            </div>
            <h3 className="font-medium">Xác định thứ hạng</h3>
            <p className="text-sm text-muted-foreground">
              Nhập điểm thi để biết thứ hạng của bạn
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
