'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  postsSearched?: number
}

const suggestedQuestions = [
  'What topics do I save most?',
  'Summarize this week\'s saves',
  'Any posts about habits?',
  'Which creators appear most?',
  'Financial advice I saved?',
  'Find cooking tips I saved',
]

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px'
    }
  }, [input])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    const userMessage: ChatMessage = { role: 'user', content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: newMessages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) throw new Error('Failed to get response')

      const data = await res.json()
      setMessages([...newMessages, {
        role: 'assistant',
        content: data.reply,
        postsSearched: data.postsSearched,
      }])
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Try again in a moment.',
      }])
    }

    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header — compact on mobile */}
      <div className="mb-3 md:mb-4 shrink-0">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-0.5">Ask Your Library</h1>
        <p className="text-gray-400 text-xs md:text-sm">
          Chat with AI about everything you've saved
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="text-4xl md:text-5xl mb-4 md:mb-6">🧠</div>
            <h2 className="text-base md:text-lg font-medium text-gray-900 mb-1.5">
              Your personal content brain
            </h2>
            <p className="text-gray-400 text-xs md:text-sm max-w-sm mb-6 md:mb-8 leading-relaxed">
              Ask anything about your saved posts. I search captions, video transcripts, and image text.
            </p>

            {/* Suggested Questions — 2 cols on mobile, flexible grid */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs md:text-sm text-gray-600 bg-gray-50 active:bg-gray-100 px-3 py-2.5 md:px-4 md:py-3 rounded-xl transition border border-gray-100"
                >
                  <span className="text-gray-300 mr-1">→</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6 py-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] md:max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 md:px-4 md:py-3'
                    : 'bg-gray-50 text-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 md:px-4 md:py-3 border border-gray-100'
                }`}>
                  <div className="text-[13px] md:text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.role === 'assistant' ? (
                      <FormattedMessage content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.postsSearched !== undefined && (
                    <p className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t border-gray-200/50">
                      Searched {msg.postsSearched} posts
                    </p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px] text-gray-400">Searching...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area — sticky at bottom, above tab bar */}
      <div className="shrink-0 pt-3 border-t border-gray-100 -mx-4 px-4 bg-white">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your saved posts..."
              rows={1}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-instagram-pink/20 focus:border-instagram-pink/40 transition resize-none"
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="shrink-0 bg-gray-900 text-white p-2.5 rounded-xl active:bg-gray-700 transition disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <>
      {lines.map((line, i) => {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        const withLinks = formatted.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-instagram-pink underline">$1</a>'
        )
        const withInstaLinks = withLinks.replace(
          /(https:\/\/(?:www\.)?instagram\.com\/[^\s<]+)/g,
          '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-instagram-pink underline">View post →</a>'
        )

        if (line.trim() === '') return <br key={i} />

        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <p key={i} className="pl-3 py-0.5 text-[13px]" style={{ textIndent: '-10px' }}>
              <span className="text-gray-400 mr-1">•</span>
              <span dangerouslySetInnerHTML={{ __html: withInstaLinks.replace(/^[\s]*[-•]\s*/, '') }} />
            </p>
          )
        }

        return (
          <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
            <span dangerouslySetInnerHTML={{ __html: withInstaLinks }} />
          </p>
        )
      })}
    </>
  )
}
