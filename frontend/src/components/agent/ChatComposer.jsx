import { useState, useRef, useEffect } from 'react'
import { Send, Square, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STARTER_PROMPTS = [
  'Dựa vào học lực và sở thích, hãy phân tích ngành nào phù hợp nhất với mình?',
  'Tóm tắt hồ sơ của mình và cho biết mình còn thiếu những dữ liệu gì?',
  'So sánh điểm thi tự khai của mình với phân bố điểm thi khối A00?',
  'Tra cứu điểm chuẩn 2025 các ngành Công nghệ thông tin tại Hà Nội?',
]

export default function ChatComposer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  maxLength = 2000,
  showStarters = false,
}) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [text])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  const submitMessage = (msg) => {
    const messageToSend = (msg !== undefined ? msg : text).trim()
    if (!messageToSend || isStreaming || disabled) return
    onSend(messageToSend)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const charsLeft = maxLength - text.length

  return (
    <div className="space-y-2">
      {/* Starter Prompts */}
      {showStarters && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {STARTER_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => submitMessage(prompt)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 border border-slate-200 hover:border-teal-300 transition-all text-left shadow-2xs"
            >
              <Sparkles className="h-3 w-3 text-teal-600 shrink-0" />
              <span className="truncate max-w-xs">{prompt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="relative rounded-xl border border-slate-300 bg-white shadow-xs focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 transition-all p-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi trợ lý AI (Ví dụ: Ngành nào hợp nhất với tôi, tra điểm chuẩn, phân tích học lực...)"
          disabled={disabled || isStreaming}
          rows={1}
          className="w-full resize-none px-2.5 py-1.5 text-xs sm:text-sm text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-100 text-[11px] text-muted-foreground">
          <span>
            {text.length > maxLength * 0.8 && (
              <span className={charsLeft < 100 ? 'text-amber-600 font-semibold' : ''}>
                Còn {charsLeft} ký tự
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onStop}
                className="h-7 px-2.5 text-xs gap-1 rounded-md"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Dừng</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => submitMessage()}
                disabled={!text.trim() || disabled}
                className="h-7 px-3 text-xs gap-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white"
              >
                <span>Gửi</span>
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-center text-muted-foreground">
        Nhấn Enter để gửi, Shift+Enter để xuống dòng. Trợ lý AI có thể mắc sai sót, vui lòng kiểm tra lại thông tin quan trọng.
      </p>
    </div>
  )
}
