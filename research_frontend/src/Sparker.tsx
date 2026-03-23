import { useState, useEffect, useCallback, useRef } from 'react'

interface ModelConfig {
  apiKey?: string
  apiEndpoint?: string
  providerID?: string
  modelName?: string
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

interface SparkerProps {
  serverUrl: string
  onClose: () => void
}

export function Sparker({ serverUrl, onClose }: SparkerProps) {
  const [step, setStep] = useState<'folder' | 'topic' | 'session'>('folder')
  const [rootFolder, setRootFolder] = useState('.')
  const [topicName, setTopicName] = useState('')
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState('.')
  const [isCreating, setIsCreating] = useState(false)

  // Native folder picker using File System Access API
  const pickFolder = async () => {
    try {
      // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
      const dirHandle = await window.showDirectoryPicker()
      // Get the path from the handle - this is limited in browsers
      // We'll use the name as a display and store the handle for later use
      const path = dirHandle.name
      setRootFolder(path)
      setStep('topic')
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to pick folder:', err)
      }
      // Fallback: use a default path for development/testing
      setRootFolder('.')
      setStep('topic')
    }
  }
  const [error, setError] = useState<string | null>(null)

  const [sparkerSessionId, setSparkerSessionId] = useState<string | null>(null)
  const [surveyorSessionId, setSurveyorSessionId] = useState<string | null>(null)
  const [sparkerMessages, setSparkerMessages] = useState<Message[]>([])
  const [surveyorMessages, setSurveyorMessages] = useState<Message[]>([])
  const [sparkerInput, setSparkerInput] = useState('')
  const [surveyorInput, setSurveyorInput] = useState('')
  const [sparkerLoading, setSparkerLoading] = useState(false)
  const [surveyorLoading, setSurveyorLoading] = useState(false)

  // Model configs for each agent
  const [sparkerModel, setSparkerModel] = useState<ModelConfig>({
    apiKey: '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',
    apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    providerID: 'openrouter',
    modelName: 'google/gemini-3-flash-preview',
  })
  const [surveyorModel, setSurveyorModel] = useState<ModelConfig>({
    apiKey: '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',
    apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    providerID: 'openrouter',
    modelName: 'google/gemini-3-flash-preview',
  })

  const [showSettings, setShowSettings] = useState(false)
  const [editingModelFor, setEditingModelFor] = useState<'sparker' | 'surveyor' | null>(null)
  const [tempModel, setTempModel] = useState<ModelConfig>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (step === 'folder') {
      fetchFolders(currentPath)
    }
  }, [step, currentPath])

  const fetchFolders = async (path: string) => {
    setFoldersLoading(true)
    try {
      const response = await fetch(`${serverUrl}/file?path=${encodeURIComponent(path)}`)
      if (!response.ok) throw new Error('Failed to fetch folders')
      const files = await response.json() as Array<{ name: string; type: string; path: string }>
      const dirs = files.filter((f: any) => f.type === 'directory' && !f.name.startsWith('.'))
      setFolders(dirs.map((d: any) => ({ name: d.name, path: d.path })))
    } catch (err) {
      console.error('Failed to fetch folders:', err)
      setFolders([])
    } finally {
      setFoldersLoading(false)
    }
  }

  const createSparkerSessions = async (topic: string) => {
    setIsCreating(true)
    setError(null)

    try {
      const sparkerSession = await apiRequest<{ id?: string; error?: string }>(
        serverUrl, 'POST', '/session',
        {
          title: `${topic} - Sparker`,
          model: sparkerModel,
        }
      )

      if (!sparkerSession.id) {
        throw new Error(sparkerSession.error || 'Failed to create Sparker session')
      }

      const surveyorSession = await apiRequest<{ id?: string; error?: string }>(
        serverUrl, 'POST', '/session',
        {
          title: `${topic} - Surveyor`,
          model: surveyorModel,
        }
      )

      if (!surveyorSession.id) {
        throw new Error(surveyorSession.error || 'Failed to create Surveyor session')
      }

      setSparkerSessionId(sparkerSession.id)
      setSurveyorSessionId(surveyorSession.id)
      setStep('session')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCreating(false)
    }
  }

  const fetchMessages = useCallback(async (sessionId: string, setMessages: React.Dispatch<React.SetStateAction<Message[]>>) => {
    try {
      const msgs = await apiRequest<Message[]>(serverUrl, 'GET', `/session/${sessionId}/message`)
      setMessages(msgs)
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    }
  }, [serverUrl])

  const sendMessage = useCallback(async (sessionId: string, content: string, isSurveyor: boolean) => {
    if (!content.trim()) return

    if (isSurveyor) setSurveyorLoading(true)
    else setSparkerLoading(true)

    try {
      const response = await fetch(`${serverUrl}/session/${sessionId}/prompt_async?directory=${encodeURIComponent(DEFAULT_DIRECTORY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text: content }] })
      })

      if (!response.ok) throw new Error(`Prompt error: ${response.status}`)

      await new Promise(r => setTimeout(r, 5000))

      if (isSurveyor) {
        await fetchMessages(sessionId, setSurveyorMessages)
      } else {
        await fetchMessages(sessionId, setSparkerMessages)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSurveyorLoading(false)
      setSparkerLoading(false)
    }
  }, [serverUrl, fetchMessages])

  useEffect(() => {
    if (sparkerSessionId && step === 'session') {
      fetchMessages(sparkerSessionId, setSparkerMessages)
    }
    if (surveyorSessionId && step === 'session') {
      fetchMessages(surveyorSessionId, setSurveyorMessages)
    }
  }, [sparkerSessionId, surveyorSessionId, step, fetchMessages])

  useEffect(() => {
    if (step !== 'session') return
    const interval = setInterval(() => {
      if (sparkerSessionId) fetchMessages(sparkerSessionId, setSparkerMessages)
      if (surveyorSessionId) fetchMessages(surveyorSessionId, setSurveyorMessages)
    }, 5000)
    return () => clearInterval(interval)
  }, [step, sparkerSessionId, surveyorSessionId, fetchMessages])

  const renderMessage = (msg: Message, isUser: boolean) => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px'
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '12px 16px',
        background: isUser
          ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
          : '#252535',
        color: '#fff',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {msg.parts.map((part, pIdx) => (
          <div key={pIdx}>
            {part.type === 'text' && <span>{part.text}</span>}
            {part.type === 'tool' && (
              <span style={{ color: '#a1a1aa', fontSize: '12px', fontStyle: 'italic' }}>
                [Tool: {part.tool} - {part.state?.status || 'running'}]
              </span>
            )}
          </div>
        ))}
      </div>
      <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', marginLeft: '4px', marginRight: '4px' }}>
        {isUser ? 'You' : 'Assistant'}
      </span>
    </div>
  )

  // Step 1: Folder Selection
  if (step === 'folder') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#1a1a1a', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid #333' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#fff' }}>🔬 New Research Session</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>Step 1: Select Root Folder</p>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <button
              onClick={pickFolder}
              style={{ padding: '20px 40px', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' }}>
              📂 Choose Folder...
            </button>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>Use your system's native folder picker</p>
          </div>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '6px' }}>Cancel</button>
        </div>
      </div>
    )
  }

  // Step 2: Topic Naming
  if (step === 'topic') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#1a1a1a', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid #333' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#fff' }}>🔬 New Research Session</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Step 2: Name Your Research Topic</p>
          {error && (
            <div style={{ padding: '10px', background: '#3f1515', border: '1px solid #ef4444', borderRadius: '6px', marginBottom: '16px', color: '#ef4444', fontSize: '13px' }}>{error}</div>
          )}
          <input type="text" value={topicName} onChange={(e) => { setTopicName(e.target.value); setError(null) }}
            placeholder="e.g., AI Safety Research, Climate Tech Analysis"
            style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '14px', marginBottom: '16px' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && topicName.trim()) createSparkerSessions(topicName.trim()) }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep('folder')} style={{ padding: '10px 20px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '6px' }}>Back</button>
            <button onClick={() => topicName.trim() && createSparkerSessions(topicName.trim())} disabled={!topicName.trim() || isCreating}
              style={{ padding: '10px 20px', background: topicName.trim() && !isCreating ? '#22c55e' : '#333', border: 'none', color: topicName.trim() && !isCreating ? '#000' : '#888', cursor: topicName.trim() && !isCreating ? 'pointer' : 'not-allowed', borderRadius: '6px', fontWeight: 'bold' }}>
              {isCreating ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Split View Session
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f0f1a', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', background: '#16162a', borderBottom: '1px solid #2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🔬</div>
          <div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>Research: {topicName}</div>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>Sparker Research Session</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowSettings(true)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #3a3a5a', color: '#a1a1aa', cursor: 'pointer', borderRadius: '8px', fontSize: '13px' }}>⚙️ Settings</button>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #3a3a5a', color: '#a1a1aa', cursor: 'pointer', borderRadius: '8px', fontSize: '13px' }}>Close</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Surveyor (40%) */}
        <div style={{ width: '40%', borderRight: '1px solid #2a2a4a', display: 'flex', flexDirection: 'column', background: '#0f0f1a' }}>
          <div style={{ padding: '16px 20px', background: '#16162a', borderBottom: '1px solid #2a2a4a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🔍</div>
              <div>
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '14px' }}>Surveyor</div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>Web Research Agent</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            {surveyorMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                <div style={{ fontSize: '14px' }}>Surveyor is ready to research</div>
              </div>
            ) : (
              surveyorMessages.map((msg, idx) => renderMessage(msg, msg.info.role === 'user'))
            )}
            {surveyorLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', padding: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }}></div>
                Surveyor is researching...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '16px 20px', background: '#16162a', borderTop: '1px solid #2a2a4a' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="text" value={surveyorInput} onChange={(e) => setSurveyorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && surveyorInput.trim() && surveyorSessionId) { sendMessage(surveyorSessionId, surveyorInput, true); setSurveyorInput('') } }}
                placeholder="Ask Surveyor to research..." disabled={surveyorLoading || !surveyorSessionId}
                style={{ flex: 1, padding: '12px 16px', background: '#1f1f35', border: '1px solid #2a2a4a', color: '#fff', borderRadius: '12px', fontSize: '14px', outline: 'none' }} />
              <button onClick={() => { if (surveyorInput.trim() && surveyorSessionId) { sendMessage(surveyorSessionId, surveyorInput, true); setSurveyorInput('') } }}
                disabled={surveyorLoading || !surveyorInput.trim() || !surveyorSessionId}
                style={{ padding: '12px 20px', background: surveyorLoading || !surveyorInput.trim() ? '#2a2a4a' : '#10b981', border: 'none', color: surveyorLoading || !surveyorInput.trim() ? '#6b7280' : '#fff', cursor: surveyorLoading || !surveyorInput.trim() ? 'not-allowed' : 'pointer', borderRadius: '12px', fontWeight: 500, fontSize: '14px' }}>
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Main Chat (60%) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f1a' }}>
          <div style={{ padding: '16px 20px', background: '#16162a', borderBottom: '1px solid #2a2a4a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>💬</div>
              <div>
                <div style={{ color: '#a78bfa', fontWeight: 600, fontSize: '14px' }}>Research Chat</div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>Ask questions about your research</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            {sparkerMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
                <div style={{ fontSize: '14px' }}>Start a conversation about your research</div>
              </div>
            ) : (
              sparkerMessages.map((msg, idx) => renderMessage(msg, msg.info.role === 'user'))
            )}
            {sparkerLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a78bfa', padding: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa', animation: 'pulse 1.5s infinite' }}></div>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '16px 20px', background: '#16162a', borderTop: '1px solid #2a2a4a' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="text" value={sparkerInput} onChange={(e) => setSparkerInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && sparkerInput.trim() && sparkerSessionId) { sendMessage(sparkerSessionId, sparkerInput, false); setSparkerInput('') } }}
                placeholder="Ask about your research..." disabled={sparkerLoading || !sparkerSessionId}
                style={{ flex: 1, padding: '12px 16px', background: '#1f1f35', border: '1px solid #2a2a4a', color: '#fff', borderRadius: '12px', fontSize: '14px', outline: 'none' }} />
              <button onClick={() => { if (sparkerInput.trim() && sparkerSessionId) { sendMessage(sparkerSessionId, sparkerInput, false); setSparkerInput('') } }}
                disabled={sparkerLoading || !sparkerInput.trim() || !sparkerSessionId}
                style={{ padding: '12px 20px', background: sparkerLoading || !sparkerInput.trim() ? '#2a2a4a' : '#7c3aed', border: 'none', color: sparkerLoading || !sparkerInput.trim() ? '#6b7280' : '#fff', cursor: sparkerLoading || !sparkerInput.trim() ? 'not-allowed' : 'pointer', borderRadius: '12px', fontWeight: 500, fontSize: '14px' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        input::placeholder { color: #6b7280; }
        input:focus { border-color: #7c3aed !important; }
      `}</style>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#1a1a2e', padding: '24px', borderRadius: '16px', width: '480px', border: '1px solid #3a3a5a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginBottom: '20px', color: '#fff', fontSize: '18px', fontWeight: 600 }}>⚙️ Model Settings</h3>

            {/* Surveyor Model */}
            <div style={{ marginBottom: '16px', padding: '16px', background: '#16162a', borderRadius: '12px', border: '1px solid #2a2a4a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🔍</div>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Surveyor</span>
                </div>
                <button
                  onClick={() => { setTempModel(surveyorModel); setEditingModelFor('surveyor') }}
                  style={{ padding: '6px 14px', background: '#10b981', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
                  Edit
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                <div><span style={{ color: '#6b7280' }}>Model:</span> {surveyorModel.modelName || 'not set'}</div>
                <div><span style={{ color: '#6b7280' }}>Provider:</span> {surveyorModel.providerID || 'not set'}</div>
              </div>
            </div>

            {/* Sparker/Research Chat Model */}
            <div style={{ marginBottom: '20px', padding: '16px', background: '#16162a', borderRadius: '12px', border: '1px solid #2a2a4a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>💬</div>
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>Research Chat</span>
                </div>
                <button
                  onClick={() => { setTempModel(sparkerModel); setEditingModelFor('sparker') }}
                  style={{ padding: '6px 14px', background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
                  Edit
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                <div><span style={{ color: '#6b7280' }}>Model:</span> {sparkerModel.modelName || 'not set'}</div>
                <div><span style={{ color: '#6b7280' }}>Provider:</span> {sparkerModel.providerID || 'not set'}</div>
              </div>
            </div>

            <button onClick={() => setShowSettings(false)} style={{ width: '100%', padding: '12px', background: '#2a2a4a', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '10px', fontSize: '14px', fontWeight: 500 }}>Close</button>
          </div>
        </div>
      )}

      {/* Model Edit Modal */}
      {editingModelFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#1a1a2e', padding: '24px', borderRadius: '16px', width: '450px', border: '1px solid #3a3a5a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginBottom: '20px', color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              {editingModelFor === 'surveyor' ? '🔍 Surveyor' : '💬 Research Chat'} Model
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>API Key</label>
              <input type="password" value={tempModel.apiKey || ''} onChange={(e) => setTempModel({ ...tempModel, apiKey: e.target.value })}
                placeholder="sk-or-v1-..." style={{ width: '100%', padding: '12px 14px', background: '#16162a', border: '1px solid #2a2a4a', color: '#fff', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>API Endpoint</label>
              <input type="text" value={tempModel.apiEndpoint || ''} onChange={(e) => setTempModel({ ...tempModel, apiEndpoint: e.target.value })}
                placeholder="https://openrouter.ai/api/v1/chat/completions" style={{ width: '100%', padding: '12px 14px', background: '#16162a', border: '1px solid #2a2a4a', color: '#fff', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Provider ID</label>
              <input type="text" value={tempModel.providerID || ''} onChange={(e) => setTempModel({ ...tempModel, providerID: e.target.value })}
                placeholder="openrouter" style={{ width: '100%', padding: '12px 14px', background: '#16162a', border: '1px solid #2a2a4a', color: '#fff', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Model Name</label>
              <input type="text" value={tempModel.modelName || ''} onChange={(e) => setTempModel({ ...tempModel, modelName: e.target.value })}
                placeholder="google/gemini-3-flash-preview" style={{ width: '100%', padding: '12px 14px', background: '#16162a', border: '1px solid #2a2a4a', color: '#fff', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditingModelFor(null)} style={{ flex: 1, padding: '12px', background: '#2a2a4a', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '10px', fontSize: '14px', fontWeight: 500 }}>Cancel</button>
              <button onClick={() => {
                if (editingModelFor === 'surveyor') {
                  setSurveyorModel(tempModel)
                } else {
                  setSparkerModel(tempModel)
                }
                setEditingModelFor(null)
              }} style={{ flex: 1, padding: '12px', background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
