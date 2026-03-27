// Session types
export interface Session {
  id: string
  title: string
  model?: ModelConfig
  time: {
    created: number
    updated: number
  }
}

export interface ModelConfig {
  apiKey?: string
  apiEndpoint?: string
  providerID?: string
  modelName?: string
}

// Message types
export interface MessagePart {
  type: string
  text?: string
  tool?: string
  state?: {
    status?: string
    input?: unknown
    output?: unknown
    error?: string
  }
  reason?: string
  content?: string
  blockType?: string
  [key: string]: unknown
}

export interface Message {
  info: {
    id: string
    role: string
    time: { created: number; updated: number }
    finish?: string
  }
  parts: MessagePart[]
}

// Aggregate types
export type AggregateStatus = 'Pending' | 'Running' | 'Paused' | 'Complete' | 'Error'

export interface AggregateState {
  status: AggregateStatus
  progress: number
  eta?: string
  taskId?: string
  error?: string
}

// File types
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modified?: number
}

export interface FileContent {
  path: string
  content: string
  type: 'text' | 'image' | 'audio' | 'video' | 'json'
}

// Data sample for inspector
export interface DataSample {
  id: string
  type: 'image' | 'text' | 'audio' | 'video' | 'json'
  path: string
  content: string
  label?: string
  metadata?: Record<string, unknown>
}

// Parse block types from Pioneer output
export type ParseBlockType = 'CLARIFY' | 'MODEL' | 'LOSS' | 'COLLECTING' | 'PROCESSING' | 'AGGREGATE' | 'TRAINING'

export interface ParseBlock {
  blockType: ParseBlockType
  content: string
}
