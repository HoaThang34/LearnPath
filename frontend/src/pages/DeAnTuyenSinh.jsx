import { useState, useEffect, useMemo } from 'react'
import { Search, BookOpen, ArrowLeft, Check, FileText, List, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { getDeAn, getDeAnByMaTruong } from '@/lib/api'

function StepIndicator({ currentStep }) {
  const steps = [
    { num: 1, label: 'Chọn trường' },
    { num: 2, label: 'Xem đề án' },
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
            <div className={`w-16 h-0.5 mx-2 mt-[-18px] ${
              currentStep > s.num ? 'bg-green-500' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

// Generate heading ID matching rehype-slug behavior
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
}

// Extract headings from markdown for TOC
function extractHeadings(markdown) {
  const headings = []
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)/)
    if (match) {
      const level = match[1].length
      // Remove markdown formatting for display text
      const text = match[2]
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // links
        .replace(/[*_`~]/g, '')  // inline formatting
        .replace(/#{1,4}\s*/g, '')  // heading markers
        .trim()
      const id = slugify(text)
      headings.push({ level, text, id })
    }
  }
  return headings
}

// Custom Markdown components for styling
const markdownComponents = {
  h1: ({ children, ...props }) => {
    const text = typeof children === 'string' ? children : props.node?.children?.[0]?.value || ''
    const id = slugify(String(text).replace(/[*_`#]/g, '').trim())
    return <h1 id={id} className="text-2xl font-bold mt-8 mb-4 pb-2 border-b">{children}</h1>
  },
  h2: ({ children, ...props }) => {
    const text = typeof children === 'string' ? children : props.node?.children?.[0]?.value || ''
    const id = slugify(String(text).replace(/[*_`#]/g, '').trim())
    return <h2 id={id} className="text-xl font-bold mt-6 mb-3 pb-2 border-b">{children}</h2>
  },
  h3: ({ children, ...props }) => {
    const text = typeof children === 'string' ? children : props.node?.children?.[0]?.value || ''
    const id = slugify(String(text).replace(/[*_`#]/g, '').trim())
    return <h3 id={id} className="text-lg font-semibold mt-5 mb-2">{children}</h3>
  },
  h4: ({ children, ...props }) => {
    const text = typeof children === 'string' ? children : props.node?.children?.[0]?.value || ''
    const id = slugify(String(text).replace(/[*_`#]/g, '').trim())
    return <h4 id={id} className="text-base font-semibold mt-4 mb-2">{children}</h4>
  },
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border px-3 py-2 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border px-3 py-2">{children}</td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary pl-4 my-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),
}

function TableOfContents({ headings, isVisible, onToggle }) {
  if (headings.length === 0) return null

  return (
    <div className="mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="mb-2"
      >
        <List className="h-4 w-4 mr-2" />
        {isVisible ? 'Ẩn mục lục' : 'Hiện mục lục'}
      </Button>

      {isVisible && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2 text-muted-foreground">Mục lục:</div>
            <nav className="space-y-1">
              {headings.map((h, i) => (
                <a
                  key={i}
                  href={`#${h.id}`}
                  className={`block py-1 text-sm hover:text-primary transition-colors ${
                    h.level === 1 ? 'font-medium' :
                    h.level === 2 ? 'pl-4' :
                    h.level === 3 ? 'pl-8' :
                    'pl-12 text-muted-foreground'
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    const el = document.getElementById(h.id)
                    if (el) {
                      const offset = 80 // header height
                      const top = el.getBoundingClientRect().top + window.scrollY - offset
                      window.scrollTo({ top, behavior: 'smooth' })
                    }
                  }}
                >
                  <ChevronRight className="h-3 w-3 inline mr-1 opacity-50" />
                  {h.text}
                </a>
              ))}
            </nav>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function DeAnTuyenSinh() {
  const [schoolList, setSchoolList] = useState([])
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [schoolDetail, setSchoolDetail] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [showToc, setShowToc] = useState(true)

  useEffect(() => {
    fetchSchoolList()
  }, [])

  const fetchSchoolList = async () => {
    setLoading(true)
    try {
      const res = await getDeAn({ limit: 500 })
      setSchoolList(res.data.data)
    } catch (e) {}
    finally { setLoading(false) }
  }

  const handleSelectSchool = async (school) => {
    setLoading(true)
    setSelectedSchool(school)
    setStep(2)
    setShowToc(true)
    try {
      const res = await getDeAnByMaTruong(school.ma_truong)
      setSchoolDetail(res.data.data)
    } catch (e) {}
    finally { setLoading(false) }
  }

  const goBack = () => {
    setStep(1)
    setSelectedSchool(null)
    setSchoolDetail(null)
  }

  const filteredSchools = schoolList.filter(s =>
    s.ten_truong.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.ma_truong.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const headings = useMemo(() => {
    if (!schoolDetail?.noi_dung) return []
    return extractHeadings(schoolDetail.noi_dung)
  }, [schoolDetail])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <BookOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Đề án tuyển sinh</h1>
          <p className="text-muted-foreground">Tra cứu đề án tuyển sinh các trường đại học năm 2026</p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* STEP 1: Chọn trường */}
      {step === 1 && (
        <div>
          <div className="mb-4 text-sm text-muted-foreground">
            Chọn một trường để xem đề án tuyển sinh chi tiết
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tên trường hoặc mã trường..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredSchools.map((school) => (
                <button
                  key={school.ma_truong}
                  onClick={() => handleSelectSchool(school)}
                  className="group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono inline-block mb-2">
                        {school.ma_truong}
                      </div>
                      <div className="font-medium text-sm line-clamp-2 min-h-[40px]">{school.ten_truong}</div>
                    </div>
                    <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-2 shrink-0" />
                  </div>
                </button>
              ))}
              {filteredSchools.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Không tìm thấy trường nào
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Xem đề án */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Đổi trường
            </Button>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm font-mono">
                {selectedSchool?.ma_truong}
              </span>
              <span className="text-sm font-medium">{selectedSchool?.ten_truong}</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
          ) : schoolDetail ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Table of Contents - sidebar */}
              {headings.length > 0 && (
                <div className="lg:col-span-1 order-2 lg:order-1">
                  <div className="lg:sticky lg:top-24">
                    <TableOfContents
                      headings={headings}
                      isVisible={showToc}
                      onToggle={() => setShowToc(!showToc)}
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className={headings.length > 0 ? 'lg:col-span-3 order-1 lg:order-2' : ''}>
                <Card>
                  <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={markdownComponents}
                      >
                        {schoolDetail.noi_dung}
                      </Markdown>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Không tìm thấy đề án tuyển sinh của trường này</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
