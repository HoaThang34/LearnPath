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
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
    setIsStreaming(true)
    setStreamStatusText('Đang kết nối...')

    const controller = new AbortController()
    abortControllerRef.current = controller

    let accumulatedContent = ''
    const accumulatedArtifacts = []

    try {
      await streamAgentChat({
        message: text,
        conversationId: activeConversationId,
        signal: controller.signal,
        onStatus: (data) => {
          setStreamStatusText(data.text || '')
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
        <span className="text-sm font-medium">Đang khởi tạo Trợ lý AI...</span>
      </div>
    )
  }

  if (statusError || (status && !status.enabled)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-xl border border-amber-200 bg-amber-50/50 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Trợ lý AI hiện chưa khả dụng</h2>
        <p className="text-xs text-muted-foreground">
          {statusError || 'Tính năng Trợ lý AI đang tạm tắt trên hệ thống. Vui lòng quay lại sau.'}
        </p>
        <Button size="sm" variant="outline" onClick={loadStatus} className="text-xs">
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Consent Dialog if user hasn't consented */}
      {status && !status.consented && (
        <ConsentDialog
          onAccept={handleAcceptConsent}
          onCancel={() => navigate('/')}
          accepting={acceptingConsent}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onDelete={handleDeleteConversation}
          loading={loadingConversations}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/50 backdrop-blur-2xs flex">
          <div className="w-72 max-w-[80vw] h-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-xs font-semibold text-slate-700">Lịch sử trò chuyện</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Top Header */}
        <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
              aria-label="Mở lịch sử chat"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 truncate">
              <div className="h-7 w-7 rounded-full bg-linear-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  Trợ lý AI cá nhân hóa
                </h1>
              </div>
            </div>
          </div>

          {/* Right Quota badge */}
          {status?.usage && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              <Info className="h-3 w-3 text-slate-400" />
              <span>
                Hôm nay: <strong className="text-slate-800">{status.usage.today}</strong>/{status.usage.dailyLimit} lượt
              </span>
            </div>
          )}
        </div>

        {/* Messages Scroll Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4"
        >
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
              <span>Đang tải tin nhắn...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="max-w-xl mx-auto py-8 sm:py-12 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-linear-to-tr from-teal-50 to-emerald-100 border border-teal-200 text-teal-600 flex items-center justify-center shadow-xs">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Chào bạn! Mình có thể giúp gì cho bạn?
                </h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Mình đã sẵn sàng đọc điểm học bạ, điểm thi tự khai và kết quả sở thích của bạn để tư vấn chọn ngành, chọn trường chuẩn xác nhất.
                </p>
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

        {/* Bottom Input Area */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/40 shrink-0">
          <div className="max-w-3xl mx-auto">
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
