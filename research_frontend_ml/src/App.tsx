import { useState, useEffect, useCallback } from 'react'
import { AggregatePanel } from './AggregatePanel'
import { PioneerChat } from './PioneerChat'
import { checkHealth, createSession, getSessions, sendMessage } from './api'
import type { Session } from './types'

const DEFAULT_SERVER_URL = 'http://localhost:4096'

export default function App() {
  const [serverUrl] = useState(DEFAULT_SERVER_URL)
  const [connected, setConnected] = useState(false)
  const [serverVersion, setServerVersion] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState('')

  const connectToServer = useCallback(async () => {
    try {
      const health = await checkHealth(serverUrl)
      if (health.healthy) {
        setConnected(true)
        setServerVersion(health.version)
        const sessionList = await getSessions(serverUrl)
        setSessions(sessionList)
      }
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }, [serverUrl])

  useEffect(() => {
    connectToServer()
  }, [connectToServer])

  const handleCreateSession = useCallback(async () => {
    if (!newSessionTitle.trim()) return
    const fullMessage = `I wish to ${newSessionTitle.trim()}`
    try {
      const session = await createSession(serverUrl, fullMessage)
      // Send the initial message to start the conversation
      await sendMessage(serverUrl, session.id, fullMessage)
      setSessions(prev => [...prev, session])
      setActiveSessionId(session.id)
      setShowNewSession(false)
      setNewSessionTitle('')
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }, [serverUrl, newSessionTitle])

  const activeSession = sessions.find(s => s.id === activeSessionId)

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      background: '#0a0a0a',
      color: '#fff',
    }}>
      {/* Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 'bold' }}>Pioneer ML</h1>
          {connected && (
            <span style={{ fontSize: '11px', color: '#22c55e' }}>
              ● Connected ({serverVersion})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowNewSession(true)}
            style={{
              padding: '6px 12px',
              background: '#22c55e',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            New Session
          </button>
          <button
            style={{
              padding: '6px 12px',
              background: '#333',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        marginTop: '48px',
        height: 'calc(100vh - 48px)',
        width: '100%',
      }}>
        {/* Left Panel - Aggregate & Files (400px) */}
        <div style={{
          width: '400px',
          borderRight: '1px solid #333',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <AggregatePanel serverUrl={serverUrl} />
        </div>

        {/* Right Panel - Pioneer Chat (flex) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <PioneerChat
            serverUrl={serverUrl}
            sessionId={activeSessionId}
            sessionTitle={activeSession?.title}
          />
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSession && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '24px',
            borderRadius: '12px',
            width: '450px',
          }}>
            <h3 style={{ marginBottom: '16px' }}>New Pioneer Session</h3>
            <label style={{ display: 'block', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>What would you like to do?</span>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                <span style={{
                  padding: '8px 12px',
                  background: '#252525',
                  border: '1px solid #333',
                  borderRight: 'none',
                  borderRadius: '4px 0 0 4px',
                  color: '#22c55e',
                  fontSize: '14px',
                }}>
                  I wish to
                </span>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={e => setNewSessionTitle(e.target.value)}
                  placeholder="fine-tune BERT for sentiment analysis"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#0a0a0a',
                    border: '1px solid #22c55e',
                    color: '#fff',
                    borderRadius: '0 4px 4px 0',
                    fontSize: '14px',
                  }}
                />
              </div>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowNewSession(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#333',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#22c55e',
                  border: 'none',
                  color: '#000',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                }}
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
