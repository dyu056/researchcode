import { useState, useEffect, useCallback, useRef } from 'react'

// Types
interface ModelConfig {
  apiKey?: string
  apiEndpoint?: string
  providerID?: string
  modelName?: string
}

interface Session {
  id: string
  title: string
  model?: ModelConfig
  time: {
    created: number
    updated: number
  }
}

interface MessagePart {
  type: string
  text?: string
  tool?: string
  state?: {
    status?: string
    input?: any
    output?: any
    error?: string
  }
  reason?: string
  content?: string
  [key: string]: any
}

interface Message {
  info: {
    id: string
    role: string
    time: { created: number; updated: number }
    finish?: string
  }
  parts: MessagePart[]
}

interface RelayMessage {
  messageID: string
  sourceSessionTitle: string
  content: string
  timestamp: number
}

interface Folder {
  id: string
  name: string
  sessionIds: string[]
}

const DEFAULT_DIRECTORY = '/Users/danielyu/Documents/claude_code_modifications/researchcode/packages/opencode'

// API client helper
async function apiRequest<T>(baseUrl: string, method: string, path: string, body?: any, directory: string = DEFAULT_DIRECTORY): Promise<T> {
  const url = new URL(path, baseUrl)
  if (method === 'GET' && directory) {
    url.searchParams.set('directory', directory)
  }

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url.toString(), options)
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://localhost:4096')
  const [connected, setConnected] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [relayLog, setRelayLog] = useState<string[]>([])
  const [serverVersion, setServerVersion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [relayMessages, setRelaysMessages] = useState<Map<string, RelayMessage[]>>(new Map())

  // New session form state
  const [showNewSessionForm, setShowNewSessionForm] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionFolder, setNewSessionFolder] = useState('default')
  const [newModelApiKey, setNewModelApiKey] = useState('')
  const [newModelEndpoint, setNewModelEndpoint] = useState('')
  const [newModelName, setNewModelName] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const addRelayLog = useCallback((message: string) => {
    setRelayLog(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${message}`])
  }, [])

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Connect to OpenCode server
  const connectToServer = useCallback(async () => {
    try {
      const health = await apiRequest<{ healthy: boolean; version: string }>(serverUrl, 'GET', '/global/health')
      if (health.healthy) {
        setConnected(true)
        setServerVersion(health.version)
        addRelayLog(`Connected to OpenCode server (${health.version})`)

        // Initialize default folder
        setFolders([{ id: 'default', name: 'Default', sessionIds: [] }])

        // Load existing sessions
        const listResult = await apiRequest<Session[]>(serverUrl, 'GET', '/session')
        const sessionsMap = new Map<string, Session>()
        for (const session of listResult) {
          sessionsMap.set(session.id, session)
        }
        setSessions(sessionsMap)
        setFolders(prev => prev.map(f => ({
          ...f,
          sessionIds: listResult.map(s => s.id)
        })))
        addRelayLog(`Loaded ${listResult.length} existing sessions`)
      }
    } catch (error) {
      addRelayLog(`Connection failed: ${error}`)
    }
  }, [serverUrl, addRelayLog])

  // Fetch messages for a session
  const fetchMessages = useCallback(async (sessionId: string) => {
    try {
      const msgs = await apiRequest<Message[]>(serverUrl, 'GET', `/session/${sessionId}/message`)
      setMessages(msgs) // oldest first (API returns chronological order)
    } catch (error) {
      addRelayLog(`Failed to fetch messages: ${error}`)
    }
  }, [serverUrl, addRelayLog])

  // Send message to session and get AI response
  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    if (!content.trim()) return

    // Optimistically add user message immediately to show in UI
    const tempUserMessage: Message = {
      info: {
        id: `temp-${Date.now()}`,
        role: 'user',
        time: { created: Date.now(), updated: Date.now() }
      },
      parts: [{ type: 'text', text: content }]
    }

    setMessages(prev => [...prev, tempUserMessage])
    setIsLoading(true)
    addRelayLog(`[Session] Sending: ${content.substring(0, 50)}...`)

    try {
      // Send message via prompt_async endpoint (non-blocking)
      const response = await fetch(`${serverUrl}/session/${sessionId}/prompt_async?directory=${encodeURIComponent(DEFAULT_DIRECTORY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [{ type: 'text', text: content }]
        })
      })

      if (!response.ok) {
        throw new Error(`Prompt error: ${response.status}`)
      }

      addRelayLog(`[Session] Response received`)

      // Wait for the AI to process, then refresh messages
      await new Promise(r => setTimeout(r, 8000))
      await fetchMessages(sessionId)
    } catch (error) {
      addRelayLog(`Failed to send message: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, addRelayLog, fetchMessages])

  // Create a new session
  const createSession = useCallback(async (config: {
    title: string
    folderId: string
    model?: ModelConfig
  }) => {
    try {
      const body: any = { title: config.title }
      if (config.model?.apiKey) {
        body.model = {
          apiKey: config.model.apiKey,
          apiEndpoint: config.model.apiEndpoint,
          providerID: config.model.providerID,
          modelName: config.model.modelName,
        }
      }

      const newSession = await apiRequest<Session>(serverUrl, 'POST', '/session', body)
      setSessions(prev => new Map(prev).set(newSession.id, newSession))
      setFolders(prev => prev.map(f =>
        f.id === config.folderId
          ? { ...f, sessionIds: [...f.sessionIds, newSession.id] }
          : f
      ))
      addRelayLog(`Session created: ${config.title} (${newSession.id.substring(0, 20)}...)`)
      setActiveSessionId(newSession.id)
    } catch (error) {
      addRelayLog(`Failed to create session: ${error}`)
    }
  }, [serverUrl, addRelayLog])

  // Relay message to another session
  const relayMessage = useCallback(async (fromSessionId: string, toSessionId: string, content: string) => {
    const fromSession = sessions.get(fromSessionId)
    const toSession = sessions.get(toSessionId)
    if (!fromSession || !toSession) return

    try {
      await apiRequest(serverUrl, 'POST', `/session/${fromSessionId}/relay`, {
        targetSessionID: toSessionId,
        content,
      })
      addRelayLog(`[Relay] ${fromSession.title} -> ${toSession.title}: ${content.substring(0, 30)}...`)
    } catch (error) {
      addRelayLog(`Relay failed: ${error}`)
    }
  }, [serverUrl, sessions, addRelayLog])

  // Fetch relay messages for a session
  const fetchRelayMessages = useCallback(async (sessionId: string) => {
    try {
      const msgs = await apiRequest<RelayMessage[]>(serverUrl, 'GET', `/session/${sessionId}/relay`)
      setRelaysMessages(prev => new Map(prev).set(sessionId, msgs))
    } catch (error) {
      addRelayLog(`Failed to fetch relay messages: ${error}`)
    }
  }, [serverUrl, addRelayLog])

  // Refresh sessions list
  const refreshSessions = useCallback(async () => {
    try {
      const listResult = await apiRequest<Session[]>(serverUrl, 'GET', '/session')
      const sessionsMap = new Map<string, Session>()
      for (const session of listResult) {
        sessionsMap.set(session.id, session)
      }
      setSessions(sessionsMap)
    } catch (error) {
      addRelayLog(`Failed to refresh sessions: ${error}`)
    }
  }, [serverUrl, addRelayLog])

  // Delete all sessions
  const deleteAllSessions = useCallback(async () => {
    const confirmed = window.confirm(`Delete ALL sessions? This cannot be undone.`)
    if (!confirmed) return

    try {
      const result = await apiRequest<{ deleted: number; total: number }>(serverUrl, 'DELETE', '/session/all')
      addRelayLog(`Cleanup complete: ${result.deleted}/${result.total} sessions deleted`)

      // Clear local state
      setSessions(new Map())
      setFolders(prev => prev.map(f => ({ ...f, sessionIds: [] })))
      setActiveSessionId(null)
      setMessages([])
    } catch (error) {
      addRelayLog(`Failed to delete all sessions: ${error}`)
    }
  }, [serverUrl, addRelayLog])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId || !connected) return
    fetchMessages(activeSessionId)
    fetchRelayMessages(activeSessionId)
  }, [activeSessionId, connected, fetchMessages, fetchRelayMessages])

  const activeSession = activeSessionId ? sessions.get(activeSessionId) : null
  const activeRelayMessages = activeSessionId ? relayMessages.get(activeSessionId) || [] : []

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#fff' }}>
      {/* Left Panel - Folders & Sessions */}
      <div style={{ width: '280px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
          <h2 style={{ fontSize: '14px', marginBottom: '12px', color: '#888' }}>OPENCODE RELAY</h2>
          {!connected ? (
            <div>
              <input
                type="text"
                placeholder="Server URL"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '8px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
              />
              <button
                onClick={connectToServer}
                style={{ width: '100%', padding: '8px', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px' }}
              >
                Connect
              </button>
            </div>
          ) : (
            <div style={{ color: '#22c55e', fontSize: '12px' }}>● Connected ({serverVersion})</div>
          )}
        </div>

        {/* Folders */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {folders.map(folder => (
            <div key={folder.id} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#888', padding: '4px 8px', background: '#1a1a1a', borderRadius: '4px' }}>
                📁 {folder.name}
              </div>
              {folder.sessionIds.map(sessionId => {
                const session = sessions.get(sessionId)
                if (!session) return null
                return (
                  <div
                    key={sessionId}
                    onClick={() => setActiveSessionId(sessionId)}
                    style={{
                      padding: '8px 12px',
                      margin: '2px 0',
                      background: activeSessionId === sessionId ? '#1e3a5f' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ color: '#666' }}>○</span>
                    <div>
                      <div>{session.title}</div>
                      {session.model && (
                        <div style={{ fontSize: '10px', color: '#888' }}>
                          {session.model.modelName || 'Custom Model'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: '12px', borderTop: '1px solid #333', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowNewSessionForm(true)}
            style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', color: '#000', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}
          >
            + New Session
          </button>
          <button
            onClick={refreshSessions}
            style={{ padding: '10px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px' }}
          >
            🔄
          </button>
          <button
            onClick={deleteAllSessions}
            style={{ padding: '10px', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px' }}
            title="Delete all sessions"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Center Panel - Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px' }}>{activeSession.title}</h3>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Model: {activeSession.model?.modelName || 'default'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => fetchMessages(activeSession.id)}
                  style={{ padding: '8px 12px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px' }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              {messages.length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', marginTop: '40%' }}>
                  No messages yet. Start a conversation!
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: msg.info.role === 'user' ? '#3b82f6' : '#22c55e', marginBottom: '4px' }}>
                      {msg.info.role === 'user' ? '👤 You' : '🤖 Assistant'}
                      {msg.info.finish && <span style={{ color: '#888', marginLeft: '8px' }}>[{msg.info.finish}]</span>}
                    </div>
                    <div style={{
                      padding: '12px',
                      background: msg.info.role === 'user' ? '#1e3a5f' : '#1a1a1a',
                      borderRadius: '8px',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.parts.map((part, pIdx) => {
                        // Text part
                        if (part.type === 'text') {
                          return (
                            <div key={pIdx} style={{ marginBottom: '8px' }}>
                              <span style={{ color: '#fff' }}>{part.text}</span>
                            </div>
                          )
                        }
                        // Reasoning part (thinking)
                        if (part.type === 'reasoning') {
                          return (
                            <div key={pIdx} style={{ marginBottom: '8px', padding: '8px', background: '#2a2a2a', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                              <div style={{ fontSize: '10px', color: '#f59e0b', marginBottom: '4px', fontWeight: 'bold' }}>💭 Thinking</div>
                              <div style={{ color: '#d1d5db', fontSize: '12px' }}>{part.text}</div>
                            </div>
                          )
                        }
                        // Tool call part
                        if (part.type === 'tool') {
                          const state = part.state as any
                          const status = state?.status
                          const isError = status === 'error'
                          const isSuccess = status === 'success' || status === 'input'
                          return (
                            <div key={pIdx} style={{ marginBottom: '8px', padding: '8px', background: isError ? '#3f1515' : '#1a2e1a', borderRadius: '4px', borderLeft: `3px solid ${isError ? '#ef4444' : isSuccess ? '#22c55e' : '#3b82f6'}` }}>
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
                                  <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                    {JSON.stringify(state.input, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {state?.output !== undefined && !isError && (
                                <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                                  <div style={{ color: '#888' }}>Output:</div>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{typeof state.output === 'object' ? JSON.stringify(state.output) : String(state.output)}</div>
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
                        // Step start
                        if (part.type === 'step-start') {
                          return (
                            <div key={pIdx} style={{ marginBottom: '8px', padding: '4px 8px', background: '#252525', borderRadius: '4px', fontSize: '10px', color: '#888' }}>
                              → Step started
                            </div>
                          )
                        }
                        // Step finish
                        if (part.type === 'step-finish') {
                          return (
                            <div key={pIdx} style={{ marginBottom: '8px', padding: '4px 8px', background: '#252525', borderRadius: '4px', fontSize: '10px', color: '#888' }}>
                              ✓ Step finished
                              {part.reason && <span style={{ marginLeft: '8px' }}>({part.reason})</span>}
                            </div>
                          )
                        }
                        // Bash tool
                        if (part.type === 'bash' || part.tool === 'bash') {
                          const content = part.content || part.text || ''
                          return (
                            <div key={pIdx} style={{ marginBottom: '8px', padding: '8px', background: '#1e1e1e', borderRadius: '4px', borderLeft: '3px solid #22c55e' }}>
                              <div style={{ fontSize: '10px', color: '#22c55e', marginBottom: '4px' }}>⌨️ Bash</div>
                              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#d1d5db' }}>{content}</div>
                            </div>
                          )
                        }
                        // Other unknown types
                        return (
                          <div key={pIdx} style={{ marginBottom: '4px', padding: '4px', background: '#2a2a2a', borderRadius: '2px', fontSize: '11px' }}>
                            <span style={{ color: '#888' }}>[{part.type}]</span>
                            <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap', fontSize: '10px', color: '#d1d5db' }}>
                              {JSON.stringify(part, null, 2).substring(0, 500)}
                            </pre>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#22c55e', marginBottom: '4px' }}>🤖 Assistant</div>
                  <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '8px' }}>
                    <span style={{ animation: 'blink 1s infinite' }}>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '16px', borderTop: '1px solid #333' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !isLoading && inputValue.trim()) {
                      sendMessage(activeSession.id, inputValue)
                      setInputValue('')
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={isLoading}
                  style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                />
                <button
                  onClick={() => {
                    if (!isLoading && inputValue.trim()) {
                      sendMessage(activeSession.id, inputValue)
                      setInputValue('')
                    }
                  }}
                  disabled={isLoading}
                  style={{ padding: '12px 24px', background: isLoading ? '#333' : '#3b82f6', border: 'none', color: '#fff', cursor: isLoading ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            Select a session to start chatting
          </div>
        )}
      </div>

      {/* Right Panel - Relay */}
      <div style={{ width: '300px', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
          <h3 style={{ fontSize: '13px', color: '#888' }}>🔄 RELAY</h3>
        </div>

        {/* Relay to another session */}
        {activeSession && (
          <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Send to another session:</div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              <select
                id="relay-target"
                style={{ flex: 1, padding: '6px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
              >
                <option value="">Select...</option>
                {Array.from(sessions.values())
                  .filter(s => s.id !== activeSession.id)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))
                }
              </select>
            </div>
            <textarea
              id="relay-content"
              placeholder="Message to relay..."
              style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px', fontSize: '12px', minHeight: '60px', marginBottom: '8px' }}
            />
            <button
              onClick={() => {
                const targetSelect = document.getElementById('relay-target') as HTMLSelectElement
                const contentArea = document.getElementById('relay-content') as HTMLTextAreaElement
                if (targetSelect?.value && contentArea?.value) {
                  relayMessage(activeSession.id, targetSelect.value, contentArea.value)
                  contentArea.value = ''
                }
              }}
              style={{ width: '100%', padding: '8px', background: '#8b5cf6', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}
            >
              Relay Message
            </button>
          </div>
        )}

        {/* Relay Messages Received */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>📨 Messages from other sessions:</div>
          {activeRelayMessages.length === 0 ? (
            <div style={{ color: '#666', fontSize: '12px' }}>No relay messages</div>
          ) : (
            activeRelayMessages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '12px', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                  From: {msg.sourceSessionTitle}
                </div>
                <div style={{ fontSize: '12px' }}>{msg.content}</div>
              </div>
            ))
          )}
        </div>

        {/* Relay Log */}
        <div style={{ padding: '12px', borderTop: '1px solid #333', maxHeight: '150px', overflow: 'auto' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>📋 Log:</div>
          {relayLog.slice(-10).map((log, i) => (
            <div key={i} style={{ fontSize: '10px', color: '#22c55e', fontFamily: 'monospace' }}>{log}</div>
          ))}
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSessionForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ background: '#1a1a1a', padding: '24px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Create New Session</h3>

            <label style={{ display: 'block', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Title</span>
              <input
                type="text"
                value={newSessionTitle}
                onChange={e => setNewSessionTitle(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Folder</span>
              <select
                value={newSessionFolder}
                onChange={e => setNewSessionFolder(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
              >
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>

            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', marginTop: '16px' }}>
              Model Configuration (optional)
            </div>

            <label style={{ display: 'block', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>API Key</span>
              <input
                type="password"
                value={newModelApiKey}
                onChange={e => setNewModelApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ width: '100%', padding: '8px', marginTop: '2px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>API Endpoint</span>
              <input
                type="text"
                value={newModelEndpoint}
                onChange={e => setNewModelEndpoint(e.target.value)}
                placeholder="https://api.anthropic.com/v1"
                style={{ width: '100%', padding: '8px', marginTop: '2px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>Model Name</span>
              <input
                type="text"
                value={newModelName}
                onChange={e => setNewModelName(e.target.value)}
                placeholder="claude-3-5-sonnet-20241022"
                style={{ width: '100%', padding: '8px', marginTop: '2px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowNewSessionForm(false)}
                style={{ flex: 1, padding: '10px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  createSession({
                    title: newSessionTitle || 'New Session',
                    folderId: newSessionFolder || 'default',
                    model: newModelApiKey ? {
                      apiKey: newModelApiKey,
                      apiEndpoint: newModelEndpoint,
                      providerID: 'openai',
                      modelName: newModelName,
                    } : undefined,
                  })
                  setShowNewSessionForm(false)
                  setNewSessionTitle('')
                  setNewModelApiKey('')
                  setNewModelEndpoint('')
                  setNewModelName('')
                }}
                style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
