import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User, Clock } from 'lucide-react'
import ArtifactRenderer from './ArtifactRenderer'
import { cn } from '@/lib/utils'

export default function MessageBubble({ message, isStreaming = false, statusText = '' }) {
  const isAssistant = message.role === 'assistant'
  const artifacts = message.artifacts || []

  return (
    <div
      className={cn(
        'flex gap-3 py-3 px-2 rounded-lg transition-colors',
        isAssistant ? 'bg-slate-50/60' : 'bg-transparent'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        {isAssistant ? (
          <div className="h-8 w-8 rounded-full bg-linear-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xs">
            <Bot className="h-4.5 w-4.5" />
          </div>
        ) : (
          <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shadow-xs">
            <User className="h-4.5 w-4.5" />
          </div>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span className="font-semibold text-slate-800">
            {isAssistant ? 'Trợ lý LearnPath' : 'Bạn'}
          </span>
          {message.createdAt && (
            <span className="text-[10px] text-slate-400">
              {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Live status banner if streaming */}
        {isStreaming && statusText && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100/70 text-teal-800 text-[11px] font-medium animate-pulse mb-2">
            <Clock className="h-3 w-3" />
            <span>{statusText}</span>
          </div>
        )}

        {/* Text body formatted as Markdown */}
        {message.content ? (
          <div className="prose prose-sm prose-slate max-w-none text-slate-800 leading-relaxed text-xs sm:text-sm">
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
              {message.content}
            </Markdown>
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-1 py-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]" />
          </div>
        ) : null}

        {/* Render attached visual artifacts */}
        {artifacts.length > 0 && (
          <div className="space-y-2 pt-1">
            {artifacts.map((artifact, idx) => (
              <ArtifactRenderer key={idx} artifact={artifact} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
