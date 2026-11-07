import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function ConversationSidebar({
  conversations = [],
  activeId = null,
  onSelect,
  onNewChat,
  onDelete,
  loading = false,
}) {
  return (
    <div className="flex flex-col h-full bg-slate-50/70 border-r border-slate-200 w-64 shrink-0">
      {/* Top New Chat button */}
      <div className="p-3 border-b border-slate-200">
        <Button
          type="button"
          onClick={onNewChat}
          className="w-full gap-2 justify-start h-9 text-xs bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 hover:text-slate-900 shadow-2xs font-semibold"
        >
          <Plus className="h-4 w-4 text-teal-600" />
          <span>Đoạn chat mới</span>
        </Button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && conversations.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Đang tải lịch sử...
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-3 text-xs text-muted-foreground">
            <MessageSquare className="h-6 w-6 text-slate-300 mx-auto mb-2" />
            <p>Chưa có cuộc trò chuyện nào.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeId === conv.id
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  'group flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all',
                  isActive
                    ? 'bg-teal-600 text-white font-medium shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/60'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-teal-100' : 'text-slate-400')} />
                  <span className="truncate">{conv.title || 'Cuộc trò chuyện mới'}</span>
                </div>

                <button
                  type="button"
                  title="Xoá đoạn chat này"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('Bạn có chắc muốn xoá đoạn chat này không?')) {
                      onDelete(conv.id)
                    }
                  }}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 transition-opacity',
                    isActive ? 'text-white' : 'text-slate-400 hover:text-red-600'
                  )}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer usage summary */}
      <div className="p-2.5 border-t border-slate-200 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="truncate">Tự động lưu lịch sử hội thoại</span>
      </div>
    </div>
  )
}
