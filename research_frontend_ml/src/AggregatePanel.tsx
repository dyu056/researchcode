import { useState, useEffect, useCallback } from 'react'
import { getAggregateStatus, pauseAggregate, continueAggregate, listDirectory, readFile } from './api'
import type { AggregateState, FileEntry, FileContent } from './types'

interface AggregatePanelProps {
  serverUrl: string
}

type TabType = 'aggregation' | 'files'

export function AggregatePanel({ serverUrl }: AggregatePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('aggregation')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1a1a1a',
    }}>
      {/* Tab Headers */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #333',
      }}>
        <button
          onClick={() => setActiveTab('aggregation')}
          style={{
            flex: 1,
            padding: '12px',
            background: activeTab === 'aggregation' ? '#252525' : 'transparent',
            border: 'none',
            color: activeTab === 'aggregation' ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'aggregation' ? 'bold' : 'normal',
            borderBottom: activeTab === 'aggregation' ? '2px solid #22c55e' : '2px solid transparent',
          }}
        >
          Aggregation
        </button>
        <button
          onClick={() => setActiveTab('files')}
          style={{
            flex: 1,
            padding: '12px',
            background: activeTab === 'files' ? '#252525' : 'transparent',
            border: 'none',
            color: activeTab === 'files' ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'files' ? 'bold' : 'normal',
            borderBottom: activeTab === 'files' ? '2px solid #22c55e' : '2px solid transparent',
          }}
        >
          Files
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'aggregation' ? (
          <AggregationTab serverUrl={serverUrl} />
        ) : (
          <FilesTab serverUrl={serverUrl} />
        )}
      </div>
    </div>
  )
}

// Aggregation Tab
function AggregationTab({ serverUrl }: { serverUrl: string }) {
  const [aggregateState, setAggregateState] = useState<AggregateState>({
    status: 'Pending',
    progress: 0,
  })
  const [isLoading, setIsLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getAggregateStatus(serverUrl)
      setAggregateState(status)
    } catch (error) {
      console.error('Failed to fetch aggregate status:', error)
    }
  }, [serverUrl])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const handlePause = async () => {
    setIsLoading(true)
    try {
      await pauseAggregate(serverUrl)
      await fetchStatus()
    } catch (error) {
      console.error('Failed to pause:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async () => {
    setIsLoading(true)
    try {
      await continueAggregate(serverUrl)
      await fetchStatus()
    } catch (error) {
      console.error('Failed to continue:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statusColor = {
    Pending: '#888',
    Running: '#3b82f6',
    Paused: '#f59e0b',
    Complete: '#22c55e',
    Error: '#ef4444',
  }[aggregateState.status]

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ fontSize: '14px', marginBottom: '16px', color: '#888' }}>
        Aggregate Task Status
      </h3>

      {/* Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
      }}>
        <span style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: statusColor,
        }} />
        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
          {aggregateState.status}
        </span>
        {aggregateState.status === 'Running' && (
          <span style={{ fontSize: '11px', color: '#888' }}>
            {aggregateState.progress}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {aggregateState.status === 'Running' && (
        <div style={{
          height: '8px',
          background: '#333',
          borderRadius: '4px',
          marginBottom: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${aggregateState.progress}%`,
            background: '#3b82f6',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* ETA */}
      {aggregateState.eta && aggregateState.status === 'Running' && (
        <div style={{
          fontSize: '11px',
          color: '#888',
          marginBottom: '16px',
        }}>
          ETA: {aggregateState.eta}
        </div>
      )}

      {/* Error Message */}
      {aggregateState.error && (
        <div style={{
          padding: '8px 12px',
          background: '#3f1515',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
          color: '#ef4444',
        }}>
          {aggregateState.error}
        </div>
      )}

      {/* Task ID */}
      {aggregateState.taskId && (
        <div style={{
          fontSize: '11px',
          color: '#888',
          marginBottom: '16px',
          fontFamily: 'monospace',
        }}>
          Task ID: {aggregateState.taskId}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {aggregateState.status === 'Running' && (
          <button
            onClick={handlePause}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              background: '#f59e0b',
              border: 'none',
              color: '#000',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontWeight: 'bold',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Pause
          </button>
        )}
        {(aggregateState.status === 'Paused' || aggregateState.status === 'Pending') && (
          <button
            onClick={handleContinue}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              background: '#22c55e',
              border: 'none',
              color: '#000',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontWeight: 'bold',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Continue
          </button>
        )}
        <button
          onClick={fetchStatus}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px',
            background: '#333',
            border: 'none',
            color: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          Check Status
        </button>
      </div>
    </div>
  )
}

// Files Tab
function FilesTab({ serverUrl }: { serverUrl: string }) {
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchFiles = useCallback(async (path: string) => {
    setIsLoading(true)
    try {
      const entries = await listDirectory(serverUrl, path)
      setFiles(entries)
    } catch (error) {
      console.error('Failed to fetch files:', error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl])

  const fetchFileContent = useCallback(async (file: FileEntry) => {
    setIsLoading(true)
    try {
      const content = await readFile(serverUrl, file.path)
      setFileContent(content)
    } catch (error) {
      console.error('Failed to fetch file content:', error)
      setFileContent(null)
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl])

  useEffect(() => {
    fetchFiles(currentPath)
  }, [currentPath, fetchFiles])

  const handleFileClick = (file: FileEntry) => {
    if (file.isDirectory) {
      setCurrentPath(file.path)
      setSelectedFile(null)
      setFileContent(null)
    } else {
      setSelectedFile(file)
      fetchFileContent(file)
    }
  }

  const handleNavigateUp = () => {
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
    setSelectedFile(null)
    setFileContent(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Directory Tree */}
      <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
        {currentPath && (
          <button
            onClick={handleNavigateUp}
            style={{
              padding: '4px 8px',
              background: '#333',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '11px',
              marginBottom: '8px',
            }}
          >
            ← Up
          </button>
        )}
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
          {currentPath || '/'}
        </div>
        {isLoading ? (
          <div style={{ color: '#888', fontSize: '12px' }}>Loading...</div>
        ) : (
          <div style={{
            maxHeight: '200px',
            overflow: 'auto',
            background: '#0a0a0a',
            borderRadius: '4px',
            padding: '4px',
          }}>
            {files.length === 0 ? (
              <div style={{ color: '#888', fontSize: '12px', padding: '8px' }}>
                Empty directory
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  style={{
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: selectedFile?.path === file.path ? '#252525' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                  }}
                >
                  <span>{file.isDirectory ? '📁' : '📄'}</span>
                  <span style={{ color: selectedFile?.path === file.path ? '#fff' : '#ccc' }}>
                    {file.name}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Data Inspector */}
      {selectedFile && fileContent && (
        <DataInspector file={selectedFile} content={fileContent} serverUrl={serverUrl} />
      )}
    </div>
  )
}

// Data Inspector Component
type InspectorTab = 'images' | 'text' | 'audio' | 'video' | 'json'

function DataInspector({
  file,
  content,
  serverUrl,
}: {
  file: FileEntry
  content: FileContent
  serverUrl: string
}) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('json')
  const [editedContent, setEditedContent] = useState(content.content)

  const detectTab = (): InspectorTab => {
    const ext = file.name.toLowerCase()
    if (ext.endsWith('.json')) return 'json'
    if (ext.endsWith('.txt') || ext.endsWith('.md')) return 'text'
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.gif')) return 'images'
    if (ext.endsWith('.mp3') || ext.endsWith('.wav') || ext.endsWith('.ogg')) return 'audio'
    if (ext.endsWith('.mp4') || ext.endsWith('.webm') || ext.endsWith('.mov')) return 'video'
    return 'text'
  }

  useEffect(() => {
    const tab = detectTab()
    setActiveTab(tab)
    setEditedContent(content.content)
  }, [content, file])

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'images', label: 'Images' },
    { id: 'text', label: 'Text' },
    { id: 'audio', label: 'Audio' },
    { id: 'video', label: 'Video' },
    { id: 'json', label: 'JSON Editor' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Inspector Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #333',
        background: '#151515',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 12px',
              background: activeTab === tab.id ? '#1a1a1a' : 'transparent',
              border: 'none',
              color: activeTab === tab.id ? '#fff' : '#888',
              cursor: 'pointer',
              fontSize: '11px',
              borderBottom: activeTab === tab.id ? '2px solid #22c55e' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {activeTab === 'json' && (
          <div>
            <div style={{
              fontSize: '11px',
              color: '#888',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>JSON Editor</span>
              <button
                onClick={() => {/* save functionality */}}
                style={{
                  padding: '4px 8px',
                  background: '#22c55e',
                  border: 'none',
                  color: '#000',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                }}
              >
                Save
              </button>
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '200px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '8px',
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {activeTab === 'text' && (
          <div style={{
            background: '#0a0a0a',
            borderRadius: '4px',
            padding: '12px',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}>
            {content.content}
          </div>
        )}

        {activeTab === 'images' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '8px',
          }}>
            <img
              src={`file://${content.path}`}
              alt={file.name}
              style={{
                maxWidth: '100%',
                borderRadius: '4px',
              }}
            />
          </div>
        )}

        {activeTab === 'audio' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <audio
              controls
              src={`file://${content.path}`}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
              {file.name}
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div style={{ textAlign: 'center' }}>
            <video
              controls
              src={`file://${content.path}`}
              style={{ maxWidth: '100%', borderRadius: '4px' }}
            />
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
              {file.name}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
