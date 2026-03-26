import { useState, useEffect, useCallback, useRef } from 'react'
import { getMessages, sendMessage } from './api'
import type { Message, MessagePart, ParseBlock, ParseBlockType } from './types'

interface PioneerChatProps {
  serverUrl: string
  sessionId: string | null
  sessionTitle?: string
}

interface ChoiceOption {
  id: string
  label: string
  value: string
}

export function PioneerChat({ serverUrl, sessionId, sessionTitle }: PioneerChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [choices, setChoices] = useState<ChoiceOption[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInputValue, setCustomInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastAgentMessageRef = useRef<string>('')

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return
    try {
      const msgs = await getMessages(serverUrl, sessionId)
      setMessages(msgs)

      // Check if there's a new agent response
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.info.role === 'assistant') {
        const textContent = lastMsg.parts
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join('')

        // Only show choices if we got a new response
        if (textContent && textContent !== lastAgentMessageRef.current) {
          lastAgentMessageRef.current = textContent
          const extractedChoices = extractChoicesFromResponse(textContent)
          setChoices(extractedChoices)
          setShowCustomInput(false)
          setCustomInputValue('')
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }, [serverUrl, sessionId])

  // Extract multiple choice options from agent response
  const extractChoicesFromResponse = (text: string): ChoiceOption[] => {
    // Look for numbered options like "1. Option text" or "2) Option text"
    const optionRegex = /(?:^|\n)([1-4][.)]\s*)(.+?)(?=\n[1-4][.)]|\n\n|$)/gi
    const matches = [...text.matchAll(optionRegex)]

    if (matches.length > 0) {
      return matches.map((match, idx) => ({
        id: `choice-${idx}`,
        label: match[2].trim(),
        value: match[2].trim(),
      }))
    }

    // Default choices based on context keywords in the message
    const lowerText = text.toLowerCase()

    if (lowerText.includes('model') || lowerText.includes('bert') || lowerText.includes('gpt')) {
      return [
        { id: 'choice-1', label: 'Use the suggested model', value: 'Use the suggested model' },
        { id: 'choice-2', label: 'Browse other models on HuggingFace', value: 'Browse other models on HuggingFace' },
        { id: 'choice-3', label: 'Custom model specification', value: 'I want to specify a custom model' },
        { id: 'custom', label: 'Type your own answer', value: '' },
      ]
    }

    if (lowerText.includes('loss') || lowerText.includes('loss function')) {
      return [
        { id: 'choice-1', label: 'Use the suggested loss function', value: 'Use the suggested loss function' },
        { id: 'choice-2', label: 'Modify the loss function', value: 'Modify the loss function parameters' },
        { id: 'choice-3', label: 'Try a different loss', value: 'Try a different loss function' },
        { id: 'custom', label: 'Type your own answer', value: '' },
      ]
    }

    if (lowerText.includes('data') || lowerText.includes('dataset') || lowerText.includes('sample')) {
      return [
        { id: 'choice-1', label: 'Start data collection', value: 'Start data collection with the suggested sources' },
        { id: 'choice-2', label: 'Add more data sources', value: 'Add more data sources' },
        { id: 'choice-3', label: 'Upload existing dataset', value: 'Upload my own dataset' },
        { id: 'custom', label: 'Type your own answer', value: '' },
      ]
    }

    if (lowerText.includes('training') || lowerText.includes('train')) {
      return [
        { id: 'choice-1', label: 'Start training', value: 'Start training with these parameters' },
        { id: 'choice-2', label: 'Adjust hyperparameters', value: 'Adjust the hyperparameters' },
        { id: 'choice-3', label: 'Review training code', value: 'Review the generated training code first' },
        { id: 'custom', label: 'Type your own answer', value: '' },
      ]
    }

    if (lowerText.includes('aggregate') || lowerText.includes('aggregation')) {
      return [
        { id: 'choice-1', label: 'Start aggregation', value: 'Start aggregation now' },
        { id: 'choice-2', label: 'Configure aggregation', value: 'Configure aggregation settings' },
        { id: 'choice-3', label: 'Pause for now', value: 'Pause aggregation and continue later' },
        { id: 'custom', label: 'Type your own answer', value: '' },
      ]
    }

    // Default generic choices
    return [
      { id: 'choice-1', label: 'Continue with this approach', value: 'Continue with this approach' },
      { id: 'choice-2', label: 'Modify the suggestion', value: 'Modify this suggestion' },
      { id: 'choice-3', label: 'Ask for alternatives', value: 'Show me alternatives' },
      { id: 'custom', label: 'Type your own answer', value: '' },
    ]
  }

  useEffect(() => {
    if (!sessionId) return
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [sessionId, fetchMessages])

  const handleSend = async (text?: string) => {
    const textToSend = text || inputValue
    if (!sessionId || !textToSend.trim() || isLoading) return

    setIsLoading(true)
    setInputValue('')
    setChoices([])
    setShowCustomInput(false)
    setCustomInputValue('')

    // Optimistically add user message
    const tempUserMessage: Message = {
      info: {
        id: `temp-${Date.now()}`,
        role: 'user',
        time: { created: Date.now(), updated: Date.now() },
      },
      parts: [{ type: 'text', text: textToSend }],
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      await sendMessage(serverUrl, sessionId, textToSend)
      // Wait for response
      setTimeout(async () => {
        await fetchMessages()
      }, 3000)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChoiceSelect = (choice: ChoiceOption) => {
    if (choice.id === 'custom') {
      setShowCustomInput(true)
    } else {
      handleSend(choice.value)
    }
  }

  const handleCustomSubmit = () => {
    if (customInputValue.trim()) {
      handleSend(customInputValue)
    }
  }

  const parseBlocks = (text: string): ParseBlock[] => {
    const blocks: ParseBlock[] = []
    const regex = /\[(MODEL|LOSS|COLLECTING|PROCESSING|AGGREGATE|TRAINING)\]([\s\S]*?)(?=\[(MODEL|LOSS|COLLECTING|PROCESSING|AGGREGATE|TRAINING)\]|$)/gi

    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({
          blockType: 'TRAINING',
          content: text.slice(lastIndex, match.index).trim(),
        })
      }
      blocks.push({
        blockType: match[1].toUpperCase() as ParseBlockType,
        content: match[2].trim(),
      })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      blocks.push({
        blockType: 'TRAINING',
        content: text.slice(lastIndex).trim(),
      })
    }

    return blocks.filter(b => b.content)
  }

  const blockColors: Record<ParseBlockType, { bg: string; border: string; label: string }> = {
    MODEL: { bg: '#1e3a5f', border: '#3b82f6', label: '🤖 MODEL' },
    LOSS: { bg: '#3d1e5f', border: '#a855f7', label: '📉 LOSS' },
    COLLECTING: { bg: '#1e4a3f', border: '#22c55e', label: '📥 COLLECTING' },
    PROCESSING: { bg: '#4a3d1e', border: '#f59e0b', label: '⚙️ PROCESSING' },
    AGGREGATE: { bg: '#3d1e3d', border: '#ec4899', label: '🔗 AGGREGATE' },
    TRAINING: { bg: '#1e1e3d', border: '#6366f1', label: '🚀 TRAINING' },
  }

  if (!sessionId) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: '14px',
      }}>
        Create a session to start fine-tuning
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333',
        background: '#1a1a1a',
      }}>
        <h3 style={{ fontSize: '14px', margin: 0 }}>{sessionTitle || 'Pioneer Session'}</h3>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          Agent: Pioneer (ML Fine-tuning)
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        paddingBottom: choices.length > 0 ? '200px' : '120px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            marginTop: '40%',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚀</div>
            <div>Start a conversation to begin your ML fine-tuning journey</div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#555' }}>
              Tell Pioneer what model you want to fine-tune and what task
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '11px',
                  color: msg.info.role === 'user' ? '#3b82f6' : '#22c55e',
                  marginBottom: '4px',
                }}>
                  {msg.info.role === 'user' ? '👤 You' : '🚀 Pioneer'}
                </div>
                <div style={{
                  padding: '12px',
                  background: msg.info.role === 'user' ? '#1e3a5f' : '#1a1a1a',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${msg.info.role === 'user' ? '#3b82f6' : '#22c55e'}`,
                }}>
                  {msg.parts.map((part, pIdx) => (
                    <MessagePartRenderer
                      key={pIdx}
                      part={part}
                      parseBlocks={parseBlocks}
                      blockColors={blockColors}
                    />
                  ))}
                </div>

                {/* Show choices after assistant message */}
                {msg.info.role === 'assistant' && choices.length > 0 && idx === messages.length - 1 && !isLoading && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #333',
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#888',
                      marginBottom: '8px',
                    }}>
                      Select an option:
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}>
                      {choices.map((choice) => (
                        <button
                          key={choice.id}
                          onClick={() => handleChoiceSelect(choice)}
                          style={{
                            padding: '10px 16px',
                            background: choice.id === 'custom' ? '#252525' : '#22c55e',
                            border: choice.id === 'custom' ? '1px dashed #888' : 'none',
                            color: choice.id === 'custom' ? '#888' : '#000',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            fontSize: '12px',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (choice.id !== 'custom') {
                              e.currentTarget.style.background = '#16a34a'
                            } else {
                              e.currentTarget.style.borderColor = '#fff'
                              e.currentTarget.style.color = '#fff'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (choice.id !== 'custom') {
                              e.currentTarget.style.background = '#22c55e'
                            } else {
                              e.currentTarget.style.borderColor = '#888'
                              e.currentTarget.style.color = '#888'
                            }
                          }}
                        >
                          {choice.id === 'custom' ? '✏️ ' : '👉 '}{choice.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom input when "Type your own answer" is selected */}
                    {showCustomInput && (
                      <div style={{ marginTop: '12px' }}>
                        <input
                          type="text"
                          value={customInputValue}
                          onChange={e => setCustomInputValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customInputValue.trim()) {
                              handleCustomSubmit()
                            }
                          }}
                          placeholder="Type your response..."
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: '#0a0a0a',
                            border: '1px solid #22c55e',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        />
                        <button
                          onClick={handleCustomSubmit}
                          disabled={!customInputValue.trim()}
                          style={{
                            marginTop: '8px',
                            width: '100%',
                            padding: '8px 16px',
                            background: customInputValue.trim() ? '#22c55e' : '#333',
                            border: 'none',
                            color: customInputValue.trim() ? '#000' : '#888',
                            cursor: customInputValue.trim() ? 'pointer' : 'not-allowed',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '11px',
                  color: '#22c55e',
                  marginBottom: '4px',
                }}>
                  🚀 Pioneer
                </div>
                <div style={{
                  padding: '12px',
                  background: '#1a1a1a',
                  borderRadius: '8px',
                  borderLeft: '3px solid #22c55e',
                }}>
                  <span style={{ animation: 'blink 1s infinite' }}>Processing...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Default Input - only show when no choices */}
      {choices.length === 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 'calc(100% - 400px)',
          padding: '16px',
          background: '#1a1a1a',
          borderTop: '1px solid #333',
        }}>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '1200px', margin: '0 auto' }}>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isLoading && inputValue.trim()) {
                  handleSend()
                }
              }}
              placeholder="e.g., Fine-tune BERT for sentiment analysis on customer reviews"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px',
                background: '#0a0a0a',
                border: '1px solid #333',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              style={{
                padding: '12px 24px',
                background: isLoading || !inputValue.trim() ? '#333' : '#22c55e',
                border: 'none',
                color: isLoading || !inputValue.trim() ? '#888' : '#000',
                cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontWeight: 'bold',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MessagePartRenderer({
  part,
  parseBlocks,
  blockColors,
}: {
  part: MessagePart
  parseBlocks: (text: string) => ParseBlock[]
  blockColors: Record<ParseBlockType, { bg: string; border: string; label: string }>
}) {
  if (part.type === 'text' && part.text) {
    const blocks = parseBlocks(part.text)

    if (blocks.length === 0) {
      return (
        <div style={{ color: '#fff', whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
          {part.text}
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {blocks.map((block, idx) => {
          const colors = blockColors[block.blockType]
          return (
            <div
              key={idx}
              style={{
                background: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
                borderRadius: '4px',
                padding: '8px 12px',
              }}
            >
              <div style={{
                fontSize: '10px',
                fontWeight: 'bold',
                color: colors.border,
                marginBottom: '4px',
              }}>
                {colors.label}
              </div>
              <div style={{
                color: '#fff',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}>
                {block.content}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (part.type === 'reasoning') {
    return (
      <div style={{
        marginBottom: '8px',
        padding: '8px',
        background: '#2a2a2a',
        borderRadius: '4px',
        borderLeft: '3px solid #f59e0b',
      }}>
        <div style={{
          fontSize: '10px',
          color: '#f59e0b',
          marginBottom: '4px',
          fontWeight: 'bold',
        }}>
          💭 Thinking
        </div>
        <div style={{ color: '#d1d5db', fontSize: '12px' }}>{part.text}</div>
      </div>
    )
  }

  if (part.type === 'tool') {
    const state = part.state as { status?: string; input?: unknown; output?: unknown; error?: string } | undefined
    const status = state?.status
    const isError = status === 'error'
    const isSuccess = status === 'success' || status === 'input'

    return (
      <div style={{
        marginBottom: '8px',
        padding: '8px',
        background: isError ? '#3f1515' : '#1a2e1a',
        borderRadius: '4px',
        borderLeft: `3px solid ${isError ? '#ef4444' : isSuccess ? '#22c55e' : '#3b82f6'}`,
      }}>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
          🔧 Tool: <span style={{ color: '#fff' }}>{part.tool}</span>
          {state?.status && (
            <span style={{ color: isError ? '#ef4444' : '#22c55e', marginLeft: '8px' }}>
              [{state.status}]
            </span>
          )}
        </div>
        {state?.input && (
          <div style={{ fontSize: '11px', color: '#d1d5db' }}>
            <div style={{ color: '#888' }}>Input:</div>
            <pre style={{
              margin: '4px 0',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '10px',
            }}>
              {JSON.stringify(state.input, null, 2)}
            </pre>
          </div>
        )}
        {state?.output !== undefined && !isError && (
          <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
            <div style={{ color: '#888' }}>Output:</div>
            <div style={{ whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'auto' }}>
              {typeof state.output === 'object'
                ? JSON.stringify(state.output)
                : String(state.output)}
            </div>
          </div>
        )}
        {state?.error && (
          <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
            <div style={{ color: '#888' }}>Error:</div>
            <div>{state.error}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      marginBottom: '4px',
      padding: '4px',
      background: '#2a2a2a',
      borderRadius: '2px',
      fontSize: '11px',
    }}>
      <span style={{ color: '#888' }}>[{part.type}]</span>
      <pre style={{
        margin: '4px 0',
        whiteSpace: 'pre-wrap',
        fontSize: '10px',
        color: '#d1d5db',
      }}>
        {JSON.stringify(part, null, 2).substring(0, 200)}
      </pre>
    </div>
  )
}
