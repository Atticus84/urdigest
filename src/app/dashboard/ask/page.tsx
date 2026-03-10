'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  postsSearched?: number
}

const suggestedQuestions = [
  'What topics do I save the most?',
  'Summarize what I saved this week',
  'Any posts about productivity or habits?',
  'Which creators do I follow most?',
  'What financial advice have I saved?',
  'Find recipes or cooking tips I saved',
]

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
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

      if (!res.ok) {
        throw new Error('Failed to get response')
      }

      const data = await res.json()
      setMessages([...newMessages, {
        role: 'assistant',
        content: data.reply,
        postsSearched: data.postsSearched,
      }])
    } catch (error) {
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
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Ask Your Library</h1>
        <p className="text-gray-400 text-sm">
          Chat with an AI that knows everything you've saved. It searches your posts, transcripts, and extracted text.
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-5xl mb-6">🧠</div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Your personal content brain
            </h2>
            <p className="text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
              Ask anything about your saved posts. I'll search through captions, video transcripts,
              image text, and metadata to find what you need.
            </p>

            {/* Suggested Questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-xl transition border border-gray-100 hover:border-gray-200"
                >
                  <span className="text-gray-400 mr-2">→</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="space-y-6 px-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white rounded-2xl rounded-br-md px-4 py-3'
                    : 'bg-gray-50 text-gray-800 rounded-2xl rounded-bl-md px-4 py-3 border border-gray-100'
                }`}>
                  {/* Message content with simple markdown-like rendering */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.role === 'assistant' ? (
                      <FormattedMessage content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                  {/* Posts searched indicator */}
                  {msg.role === 'assistant' && msg.postsSearched !== undefined && (
                    <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-200/50">
                      Searched {msg.postsSearched} posts
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-gray-400">Searching your library...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 pt-4 border-t border-gray-100">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your saved posts..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-instagram-pink/20 focus:border-instagram-pink/40 transition resize-none"
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="shrink-0 bg-gray-900 text-white p-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-2 text-center">
          Powered by your saved content. Shift+Enter for new line.
        </p>
      </div>
    </div>
  )
}

/** Simple formatting for AI responses — handles bold, links, and lists */
function FormattedMessage({ content }: { content: string }) {
  // Split by lines for basic formatting
  const lines = content.split('\n')

  return (
    <>
      {lines.map((line, i) => {
        // Bold: **text**
        const formatted = line.replace(
          /\*\*(.*?)\*\*/g,
          '<strong>$1</strong>'
        )
        // Links: [text](url)
        const withLinks = formatted.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-instagram-pink underline hover:text-instagram-pink/80">$1</a>'
        )
        // Instagram URLs as clickable links
        const withInstaLinks = withLinks.replace(
          /(https:\/\/(?:www\.)?instagram\.com\/[^\s<]+)/g,
          '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-instagram-pink underline hover:text-instagram-pink/80">View post →</a>'
        )

        if (line.trim() === '') {
          return <br key={i} />
        }

        // Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <p key={i} className="pl-4 py-0.5" style={{ textIndent: '-12px' }}>
              <span className="text-gray-400 mr-1">•</span>
              <span dangerouslySetInnerHTML={{ __html: withInstaLinks.replace(/^[\s]*[-•]\s*/, '') }} />
            </p>
          )
        }

        return (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>
            <span dangerouslySetInnerHTML={{ __html: withInstaLinks }} />
          </p>
        )
      })}
    </>
  )
}
