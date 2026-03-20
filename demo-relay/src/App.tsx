import { useState, useEffect, useCallback } from 'react'

// Types for the relay system
interface ModelConfig {
  apiKey: string
  apiEndpoint: string
  modelName: string
}

interface Session {
  id: string
  title: string
  folderId: string
  model?: ModelConfig
  messages: Message[]
  status: 'idle' | 'running' | 'completed'
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface Folder {
  id: string
  name: string
  sessionIds: string[]
}

// Demo Relay App
export default function App() {
  const [serverUrl, setServerUrl] = useState('http://localhost:4096')
  const [connected, setConnected] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [relayLog, setRelayLog] = useState<string[]>([])

  // New session form state
  const [showNewSessionForm, setShowNewSessionForm] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionFolder, setNewSessionFolder] = useState('')
  const [newModelApiKey, setNewModelApiKey] = useState('')
  const [newModelEndpoint, setNewModelEndpoint] = useState('')
  const [newModelName, setNewModelName] = useState('')

  // Connect to OpenCode server
  const connectToServer = useCallback(async () => {
    try {
      // In real implementation, this would use the SDK:
      // const sdk = createOpencodeClient({ baseUrl: serverUrl })
      // await sdk.health() - check if server is running

      // For demo, we simulate connection
      setConnected(true)
      addRelayLog('Connected to OpenCode server')

      // Create default relay folder
      const relayFolder: Folder = {
        id: 'relay',
        name: 'Relay Hub',
        sessionIds: [],
      }
      setFolders([relayFolder])
      addRelayLog('Relay folder initialized')
    } catch (error) {
      addRelayLog(`Connection failed: ${error}`)
    }
  }, [serverUrl])

  // Create a new session
  const createSession = useCallback(async (config: {
    title: string
    folderId: string
    model?: ModelConfig
  }) => {
    const sessionId = `session-${Date.now()}`

    // In real implementation:
    // const result = await sdk.session.create({
    //   title: config.title,
    //   // Would need to add model credentials to session creation
    // })

    const newSession: Session = {
      id: sessionId,
      title: config.title,
      folderId: config.folderId,
      model: config.model,
      messages: [],
      status: 'idle',
    }

    setSessions(prev => new Map(prev).set(sessionId, newSession))
    setFolders(prev => prev.map(f =>
      f.id === config.folderId
        ? { ...f, sessionIds: [...f.sessionIds, sessionId] }
        : f
    ))

    addRelayLog(`Session created: ${config.title} (${sessionId})`)
    setActiveSessionId(sessionId)
    return sessionId
  }, [])

  // Send message to session
  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    const session = sessions.get(sessionId)
    if (!session) return

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    setSessions(prev => {
      const updated = new Map(prev)
      const s = updated.get(sessionId)!
      updated.set(sessionId, {
        ...s,
        messages: [...s.messages, userMessage],
        status: 'running',
      })
      return updated
    })

    addRelayLog(`[${session.title}] User: ${content.substring(0, 50)}...`)

    // In real implementation:
    // await sdk.session.prompt({
    //   sessionID: sessionId,
    //   parts: [{ type: 'text', text: content }],
    // })

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `[Demo] Received: ${content}\n\nIn real implementation, this would be the AI response from model: ${session.model?.modelName || 'default'}`,
        timestamp: Date.now(),
      }

      setSessions(prev => {
        const updated = new Map(prev)
        const s = updated.get(sessionId)!
        updated.set(sessionId, {
          ...s,
          messages: [...s.messages, aiMessage],
          status: 'idle',
        })
        return updated
      })

      addRelayLog(`[${session.title}] Assistant: Response generated`)
    }, 1000)
  }, [sessions])

  // Spawn child session from parent
  const spawnChildSession = useCallback(async (parentSessionId: string, childTitle: string) => {
    const parent = sessions.get(parentSessionId)
    if (!parent) return

    // Create child in same folder or relay folder
    const childFolderId = parent.folderId === 'relay' ? 'relay' : parent.folderId

    await createSession({
      title: childTitle,
      folderId: childFolderId,
      model: parent.model, // Inherit model config
    })

    addRelayLog(`[${parent.title}] Spawned child session: ${childTitle}`)
  }, [sessions, createSession])

  // Relay message to another session
  const relayMessage = useCallback(async (fromSessionId: string, toSessionId: string, content: string) => {
    const fromSession = sessions.get(fromSessionId)
    const toSession = sessions.get(toSessionId)
    if (!fromSession || !toSession) return

    // In real implementation, this would write to a shared relay folder
    // that all sessions can read from
    addRelayLog(`[Relay] ${fromSession.title} -> ${toSession.title}: ${content.substring(0, 30)}...`)

    // Simulate relay delivery
    const relayMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `[Relay from ${fromSession.title}]: ${content}`,
      timestamp: Date.now(),
    }

    setSessions(prev => {
      const updated = new Map(prev)
      const s = updated.get(toSessionId)!
      updated.set(toSessionId, {
        ...s,
        messages: [...s.messages, relayMsg],
      })
      return updated
    })
  }, [sessions])

  const addRelayLog = (message: string) => {
    setRelayLog(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const activeSession = activeSessionId ? sessions.get(activeSessionId) : null

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
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
                style={{ width: '100%', padding: '8px', marginBottom: '8px', background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
              />
              <button onClick={connectToServer} style={{ width: '100%', padding: '8px', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer' }}>
                Connect
              </button>
            </div>
          ) : (
            <div style={{ color: '#22c55e', fontSize: '12px' }}>● Connected to {serverUrl}</div>
          )}
        </div>

        {/* Folders */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {folders.map(folder => (
            <div key={folder.id} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#888', padding: '4px 8px', background: '#1a1a1a' }}>
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
                    }}
                  >
                    <span style={{ color: session.status === 'running' ? '#22c55e' : '#666' }}>
                      {session.status === 'running' ? '●' : '○'}
                    </span>
                    {session.title}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* New Session Button */}
        <div style={{ padding: '12px', borderTop: '1px solid #333' }}>
          <button
            onClick={() => setShowNewSessionForm(true)}
            style={{ width: '100%', padding: '10px', background: '#22c55e', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + New Session
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
                  Model: {activeSession.model?.modelName || 'default'} | Status: {activeSession.status}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => spawnChildSession(activeSession.id, `Child of ${activeSession.title}`)}
                  style={{ padding: '8px 12px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer' }}
                >
                  Spawn Subagent
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              {activeSession.messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                    {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
                  </div>
                  <div style={{
                    padding: '12px',
                    background: msg.role === 'user' ? '#1e3a5f' : '#1a1a1a',
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: '16px', borderTop: '1px solid #333' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && inputValue.trim()) {
                      sendMessage(activeSession.id, inputValue)
                      setInputValue('')
                    }
                  }}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                />
                <button
                  onClick={() => {
                    if (inputValue.trim()) {
                      sendMessage(activeSession.id, inputValue)
                      setInputValue('')
                    }
                  }}
                  style={{ padding: '12px 24px', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer' }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            Select a session or create a new one
          </div>
        )}
      </div>

      {/* Right Panel - Relay Log */}
      <div style={{ width: '300px', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
          <h3 style={{ fontSize: '13px', color: '#888' }}>🔄 RELAY LOG</h3>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
          {relayLog.map((log, i) => (
            <div key={i} style={{ padding: '4px 0', color: '#22c55e' }}>{log}</div>
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
                style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0a0a0a', border: '1px solid #333', color: '#fff' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Folder</span>
              <select
                value={newSessionFolder}
                onChange={e => setNewSessionFolder(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#0a0a0a', border: '1px solid #333', color: '#fff' }}
              >
                <option value="">Select folder</option>
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
                style={{ width: '100%', padding: '8px', marginTop: '2px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '12px' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>API Endpoint</span>
              <input
                type="text"
                value={newModelEndpoint}
                onChange={e => setNewModelEndpoint(e.target.value)}
                placeholder="https://api.anthropic.com/v1"
                style={{ width: '100%', padding: '8px', marginTop: '2px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '12px' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>Model Name</span>
              <input
                type="text"
                value={newModelName}
                onChange={e => setNewModelName(e.target.value)}
                placeholder="claude-3-5-sonnet-20241022"
                style={{ width: '100%', padding: '8px', marginTop: '2px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '12px' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowNewSessionForm(false)}
                style={{ flex: 1, padding: '10px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  createSession({
                    title: newSessionTitle || 'New Session',
                    folderId: newSessionFolder || 'relay',
                    model: newModelApiKey ? {
                      apiKey: newModelApiKey,
                      apiEndpoint: newModelEndpoint,
                      modelName: newModelName,
                    } : undefined,
                  })
                  setShowNewSessionForm(false)
                  setNewSessionTitle('')
                  setNewModelApiKey('')
                  setNewModelEndpoint('')
                  setNewModelName('')
                }}
                style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}
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
