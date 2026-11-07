import { useState, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bot,
  User,
  Clock,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  BarChart3,
  Lightbulb,
  Copy,
  Check,
  Cpu,
} from 'lucide-react'
import ArtifactRenderer from './ArtifactRenderer'
import { parseAssistantMessage } from '@/lib/agentMessageParser'
import { cn } from '@/lib/utils'

const TOOL_DISPLAY_NAMES = {
  get_user_overview: 'Đọc tổng quan hồ sơ',
  get_academic_scores: 'Đọc điểm học bạ',
  get_interest_result: 'Đọc sở thích nghề nghiệp (RIASEC/MBTI)',
  get_career_recommendations: 'Chạy phân tích năng lực',
  get_benchmark: 'So sánh phân bố điểm thi THPT',
  search_diem_chuan: 'Tra cứu điểm chuẩn đại học',
  get_khoi_thi: 'Tra cứu tổ hợp môn khối thi',
  get_de_an_excerpt: 'Đọc đề án tuyển sinh',
  rank_thpt_score: 'Tính thứ hạng điểm thi',
  get_career_selections: 'Đọc nguyện vọng đã lưu',
}

export default function MessageBubble({ message, isStreaming = false, statusText = '' }) {
  const isAssistant = message.role === 'assistant'
  const artifacts = message.artifacts || []
  const trace = message.trace || []

  const [copied, setCopied] = useState(false)
  const [thinkingExpanded, setThinkingExpanded] = useState(true)

  // Parse structured sections: thinking, analysis, answer
  const parsed = useMemo(() => {
    if (!isAssistant) return null
    return parseAssistantMessage(message.content || '')
  }, [isAssistant, message.content])

  const handleCopy = async () => {
    if (!message.content) return
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }

  // User Message
  if (!isAssistant) {
    return (
      <div className="flex gap-3 py-3 px-2 sm:px-4 justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] space-y-1.5 flex flex-col items-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-slate-700">Bạn</span>
            {message.createdAt && (
              <span className="text-[10px] text-slate-400">
                {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <div className="rounded-2xl rounded-tr-xs bg-linear-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-white text-xs sm:text-sm leading-relaxed shadow-xs">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
        <div className="shrink-0 pt-1">
          <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shadow-2xs font-semibold text-xs">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    )
  }

  // Assistant Message
  const hasThinking = Boolean(
    parsed?.thinking ||
    parsed?.isThinkingStreaming ||
    trace.length > 0 ||
    (isStreaming && statusText)
  )

  const showBouncingDots = isStreaming && !parsed?.thinking && !parsed?.answer && !parsed?.analysis

  return (
    <div className="flex gap-3 py-4 px-2 sm:px-4 rounded-xl transition-colors bg-white/70 border border-slate-100 shadow-2xs">
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xs">
          <Bot className="h-4.5 w-4.5" />
        </div>
      </div>

      {/* Message content container */}
      <div className="flex-1 min-w-0 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Trợ lý LearnPath</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200/60">
              AI Tuyển sinh
            </span>
          </div>

          <div className="flex items-center gap-2">
            {message.createdAt && (
              <span className="text-[10px] text-slate-400">
                {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {message.content && !isStreaming && (
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Sao chép nội dung"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-teal-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Live status banner if streaming and tools executing */}
        {isStreaming && statusText && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 text-xs font-medium border border-teal-200 animate-pulse">
            <Clock className="h-3.5 w-3.5 text-teal-600 animate-spin" />
            <span>{statusText}</span>
          </div>
        )}

        {/* 1. KHỐI THINKING / SUY NGHĨ & THU THẬP DỮ LIỆU */}
        {hasThinking && (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 overflow-hidden shadow-2xs transition-all">
            <button
              type="button"
              onClick={() => setThinkingExpanded(!thinkingExpanded)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-left bg-slate-100/70 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-5 w-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Brain className={cn('h-3.5 w-3.5', isStreaming && 'animate-pulse text-indigo-600')} />
                </div>
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {isStreaming && (parsed?.isThinkingStreaming || (!parsed?.answer && !parsed?.analysis))
                    ? 'Đang suy nghĩ & phân tích yêu cầu…'
                    : 'Quá trình suy nghĩ & xử lý'}
                </span>

                {/* Badges for tools */}
                {trace.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-medium">
                    <Cpu className="h-2.5 w-2.5" />
                    <span>{trace.length} thao tác dữ liệu</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <span className="hidden sm:inline">{thinkingExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                {thinkingExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>

            {thinkingExpanded && (
              <div className="p-3.5 space-y-3 border-t border-slate-200/70 text-xs text-slate-700">
                {/* Tool trace list */}
                {trace.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Dữ liệu đã thu thập:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {trace.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200/80 text-[11px]"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="truncate text-slate-700">
                            {TOOL_DISPLAY_NAMES[t.tool] || t.tool}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thinking reasoning text */}
                {parsed?.thinking && (
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Lập luận tư duy:
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200/80 font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {parsed.thinking}
                      {parsed.isThinkingStreaming && (
                        <span className="inline-block w-1.5 h-3 ml-1 bg-teal-600 animate-pulse align-middle" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Intro greeting (if any) */}
        {parsed?.intro && (
          <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{parsed.intro}</Markdown>
          </div>
        )}

        {/* 2. KHỐI PHÂN TÍCH (ANALYSIS) */}
        {parsed?.analysis && (
          <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/20 overflow-hidden shadow-2xs">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50/60 border-b border-indigo-100">
              <div className="h-5 w-5 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <BarChart3 className="h-3 w-3" />
              </div>
              <h3 className="text-xs font-bold text-indigo-950">Phân tích chuyên sâu & Dữ liệu</h3>
            </div>
            <div className="p-3.5 prose prose-sm prose-slate max-w-none text-slate-800 text-xs sm:text-sm leading-relaxed">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-indigo-950">{children}</strong>,
                }}
              >
                {parsed.analysis}
              </Markdown>
            </div>
          </div>
        )}

        {/* Render attached visual artifacts */}
        {artifacts.length > 0 && (
          <div className="space-y-2 pt-1">
            {artifacts.map((artifact, idx) => (
              <ArtifactRenderer key={idx} artifact={artifact} />
            ))}
          </div>
        )}

        {/* 3. KHỐI CÂU TRẢ LỜI & LỜI KHUYÊN (ANSWER / ADVICE) */}
        {parsed?.answer && (
          <div
            className={cn(
              'rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed',
              parsed.hasStructuredSections
                ? 'border border-teal-200/90 bg-teal-50/15 p-3.5 shadow-2xs space-y-2'
                : 'space-y-2'
            )}
          >
            {parsed.hasStructuredSections && (
              <div className="flex items-center gap-2 pb-1.5 border-b border-teal-100">
                <div className="h-5 w-5 rounded-md bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <Lightbulb className="h-3 w-3" />
                </div>
                <h3 className="text-xs font-bold text-teal-950">Câu trả lời & Định hướng hành động</h3>
              </div>
            )}
            <div className="prose prose-sm prose-slate max-w-none text-slate-800 text-xs sm:text-sm leading-relaxed">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 underline font-medium hover:text-teal-800"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {parsed.answer}
              </Markdown>
            </div>
          </div>
        )}

        {/* Bouncing dots if waiting for first response */}
        {showBouncingDots && (
          <div className="flex items-center gap-1.5 py-2 px-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]" />
            <span className="text-xs text-muted-foreground ml-2">Đang xử lý câu hỏi...</span>
          </div>
        )}
      </div>
    </div>
  )
}
