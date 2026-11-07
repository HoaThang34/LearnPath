import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  Sparkles,
  AlertCircle,
  Menu,
  X,
  RefreshCw,
  Info,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Compass,
  GraduationCap,
  BarChart3,
  Cpu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getAgentStatus,
  giveAgentConsent,
  getAgentConversations,
  getAgentConversation,
  deleteAgentConversation,
  streamAgentChat,
} from '@/lib/api'
import MessageBubble from '@/components/agent/MessageBubble'
import ChatComposer from '@/components/agent/ChatComposer'
import ConversationSidebar from '@/components/agent/ConversationSidebar'
import ConsentDialog from '@/components/agent/ConsentDialog'
import { cn } from '@/lib/utils'

export default function TroLyAI() {
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState('')

  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState(null)

  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatusText, setStreamStatusText] = useState('')
  const [acceptingConsent, setAcceptingConsent] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const scrollRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Fetch status on mount
  const loadStatus = async () => {
    setLoadingStatus(true)
    setStatusError('')
    try {
      const res = await getAgentStatus()
      setStatus(res.data?.data || null)
    } catch (err) {
      console.error('[agent] Error loading status:', err)
      setStatusError(err.response?.data?.error || 'Không thể kiểm tra trạng thái trợ lý AI.')
    } finally {
      setLoadingStatus(false)
    }
  }

  // Fetch conversation list
  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const res = await getAgentConversations()
      const list = res.data?.data || []
      setConversations(list)
    } catch (err) {
      console.error('[agent] Error loading conversations:', err)
    } finally {
      setLoadingConversations(false)
    }
  }

  useEffect(() => {
    loadStatus()
    loadConversations()
  }, [])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamStatusText, isStreaming])

  // Select a conversation
  const handleSelectConversation = async (id) => {
    if (isStreaming) return
    setActiveConversationId(id)
    setLoadingMessages(true)
    setMobileSidebarOpen(false)
    try {
      const res = await getAgentConversation(id)
      setMessages(res.data?.data?.messages || [])
    } catch (err) {
      console.error('[agent] Error loading conversation detail:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  // New Chat
  const handleNewChat = () => {
    if (isStreaming) return
    setActiveConversationId(null)
    setMessages([])
    setMobileSidebarOpen(false)
  }

  // Delete conversation
  const handleDeleteConversation = async (id) => {
    try {
      await deleteAgentConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch (err) {
      console.error('[agent] Error deleting conversation:', err)
    }
  }

  // Handle user giving consent
  const handleAcceptConsent = async () => {
    setAcceptingConsent(true)
    try {
      await giveAgentConsent()
      setStatus((prev) => (prev ? { ...prev, consented: true } : { consented: true }))
    } catch (err) {
      console.error('[agent] Error giving consent:', err)
    } finally {
      setAcceptingConsent(false)
    }
  }

  // Send message
  const handleSendMessage = async (text) => {
    if (!text.trim() || isStreaming) return

    const userMsg = {
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }

    const assistantPlaceholder = {
      role: 'assistant',
      content: '',
      artifacts: [],
      trace: [],
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
    setIsStreaming(true)
    setStreamStatusText('Đang kết nối...')

    const controller = new AbortController()
    abortControllerRef.current = controller

    let accumulatedContent = ''
    const accumulatedArtifacts = []
    const accumulatedTrace = []

    try {
      await streamAgentChat({
        message: text,
        conversationId: activeConversationId,
        signal: controller.signal,
        onStatus: (data) => {
          setStreamStatusText(data.text || '')
          if (data.tool) {
            accumulatedTrace.push({ tool: data.tool, ok: true })
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  trace: [...accumulatedTrace],
                }
              }
              return next
            })
          }
        },
        onArtifact: (artifact) => {
          accumulatedArtifacts.push(artifact)
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                artifacts: [...accumulatedArtifacts],
              }
            }
            return next
          })
        },
        onMessage: (data) => {
          accumulatedContent = data.content || ''
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                content: accumulatedContent,
              }
            }
            return next
          })
        },
        onDone: (data) => {
          if (data.conversationId) {
            setActiveConversationId(data.conversationId)
            loadConversations()
          }
          if (data.trace) {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  trace: data.trace,
                }
              }
              return next
            })
          }
          // Increment daily count in status
          setStatus((prev) => {
            if (!prev || !prev.usage) return prev
            return {
              ...prev,
              usage: { ...prev.usage, today: (prev.usage.today || 0) + 1 },
            }
          })
        },
        onError: (errData) => {
          const errMsg = errData.error || 'Đã xảy ra lỗi khi tạo phản hồi.'
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                content: `⚠️ **Lỗi:** ${errMsg}`,
              }
            }
            return next
          })
        },
      })
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('[agent] Send message error:', err)
      }
    } finally {
      setIsStreaming(false)
      setStreamStatusText('')
      abortControllerRef.current = null
    }
  }

  // Stop generation
  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamStatusText('')
  }

  if (loadingStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
        <span className="text-sm font-medium">Đang khởi tạo Trợ lý AI toàn màn hình...</span>
      </div>
    )
  }

  if (statusError || (status && !status.enabled)) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="max-w-md w-full p-6 rounded-2xl border border-amber-200 bg-amber-50/70 text-center space-y-3 shadow-xs">
          <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Trợ lý AI hiện chưa khả dụng</h2>
          <p className="text-xs text-muted-foreground">
            {statusError || 'Tính năng Trợ lý AI đang tạm tắt trên hệ thống. Vui lòng quay lại sau.'}
          </p>
          <Button size="sm" variant="outline" onClick={loadStatus} className="text-xs">
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-slate-50/40">
      {/* Consent Dialog if user hasn't consented */}
      {status && !status.consented && (
        <ConsentDialog
          onAccept={handleAcceptConsent}
          onCancel={() => navigate('/')}
          accepting={acceptingConsent}
        />
      )}

      {/* Desktop Sidebar (Collapsible) */}
      <div
        className={cn(
          'hidden md:block h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden',
          desktopSidebarOpen ? 'w-64 border-r border-slate-200' : 'w-0'
        )}
      >
        <div className="w-64 h-full">
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
            onDelete={handleDeleteConversation}
            loading={loadingConversations}
          />
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/50 backdrop-blur-xs flex">
          <div className="w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-800">Lịch sử trò chuyện</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationSidebar
                conversations={conversations}
                activeId={activeConversationId}
                onSelect={handleSelectConversation}
                onNewChat={handleNewChat}
                onDelete={handleDeleteConversation}
                loading={loadingConversations}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white">
        {/* Top Header */}
        <div className="h-14 border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between bg-white shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Desktop Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen((prev) => !prev)}
              className="hidden md:inline-flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title={desktopSidebarOpen ? 'Thu gọn danh sách chat' : 'Mở danh sách chat'}
              aria-label="Đóng mở danh sách chat"
            >
              {desktopSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>

            {/* Mobile Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Mở danh sách chat"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* New chat quick button */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleNewChat}
              className="h-8 gap-1.5 text-xs font-medium rounded-lg text-slate-700 hover:text-teal-700 hover:border-teal-300"
            >
              <Plus className="h-3.5 w-3.5 text-teal-600" />
              <span className="hidden sm:inline">Đoạn chat mới</span>
            </Button>

            {/* Title / AI indicator */}
            <div className="flex items-center gap-2 min-w-0 ml-1">
              <div className="h-7 w-7 rounded-lg bg-linear-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0 hidden xs:block">
                <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  Trợ lý AI Hướng nghiệp
                </h1>
              </div>
            </div>
          </div>

          {/* Right Quota badge */}
          <div className="flex items-center gap-2">
            {status?.model && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                <Cpu className="h-3 w-3 text-slate-400" />
                <span>{status.model}</span>
              </span>
            )}
            {status?.usage && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
                <Info className="h-3 w-3 text-teal-600" />
                <span>
                  Hôm nay: <strong className="text-slate-800">{status.usage.today}</strong>/{status.usage.dailyLimit}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-6"
        >
          <div className="max-w-4xl mx-auto space-y-5">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-20 text-xs text-muted-foreground gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
                <span>Đang tải lịch sử tin nhắn...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 sm:py-14 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-linear-to-tr from-teal-500/10 via-emerald-500/10 to-teal-500/20 border border-teal-200/80 text-teal-600 flex items-center justify-center shadow-xs">
                  <Sparkles className="h-8 w-8 text-teal-600" />
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Chào bạn! Mình có thể đồng hành gì cùng bạn hôm nay?
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Mình là Trợ lý AI cá nhân hoá của LearnPath. Mình có thể truy xuất học bạ, điểm thi tự khai và hồ sơ sở thích nghề nghiệp của bạn để đưa ra phân tích chuyên sâu và định hướng tuyển sinh chuẩn xác nhất.
                  </p>
                </div>

                {/* 3 Quick Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2 text-left">
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Dựa vào học lực và sở thích, hãy phân tích ngành nào phù hợp nhất với mình?')}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-xs transition-all text-xs space-y-1.5 group"
                  >
                    <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-slate-800">Phân tích ngành phù hợp</div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      Đánh giá mức độ tương thích giữa học lực và sở thích RIASEC.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendMessage('Tra cứu điểm chuẩn năm 2025 các trường đào tạo Công nghệ thông tin?')}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-xs transition-all text-xs space-y-1.5 group"
                  >
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-slate-800">Tra cứu điểm chuẩn</div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      Tra cứu điểm chuẩn 2025 theo khối thi và so sánh cơ hội trúng tuyển.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendMessage('Tóm tắt hồ sơ của mình và cho biết mình còn thiếu những dữ liệu gì?')}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-xs transition-all text-xs space-y-1.5 group"
                  >
                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Compass className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-slate-800">Kiểm tra hồ sơ cá nhân</div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      Xem tổng quan điểm số, kết quả khảo sát và các gợi ý hoàn thiện.
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isLast = index === messages.length - 1
                return (
                  <MessageBubble
                    key={msg.id || index}
                    message={msg}
                    isStreaming={isLast && isStreaming}
                    statusText={isLast && isStreaming ? streamStatusText : ''}
                  />
                )
              })
            )}
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="border-t border-slate-200 bg-white/90 backdrop-blur-xs px-3 sm:px-6 py-3 shrink-0">
          <div className="max-w-4xl mx-auto">
            <ChatComposer
              onSend={handleSendMessage}
              onStop={handleStopStream}
              isStreaming={isStreaming}
              disabled={loadingMessages || !status?.consented}
              maxLength={status?.maxMessageLength || 2000}
              showStarters={messages.length === 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
