import type { Session, Message, AggregateState, FileEntry, FileContent } from './types'

const DEFAULT_SERVER_URL = 'http://localhost:4096'
const DEFAULT_DIRECTORY = '/Users/danielyu/Documents/ml-training'

async function apiRequest<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  directory: string = DEFAULT_DIRECTORY
): Promise<T> {
  const url = new URL(path, baseUrl)
  if ((method === 'GET' || method === 'POST') && path.startsWith('/file')) {
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

// Session API
export async function createSession(
  serverUrl: string,
  title: string,
  directory: string = DEFAULT_DIRECTORY
): Promise<Session> {
  return apiRequest<Session>(serverUrl, 'POST', '/session', {
    title,
    directory,
  })
}

export async function getSessions(serverUrl: string): Promise<Session[]> {
  return apiRequest<Session[]>(serverUrl, 'GET', '/session')
}

export async function getSession(serverUrl: string, sessionId: string): Promise<Session> {
  return apiRequest<Session>(serverUrl, 'GET', `/session/${sessionId}`)
}

export async function deleteSession(serverUrl: string, sessionId: string): Promise<void> {
  await apiRequest<{ deleted: number }>(serverUrl, 'DELETE', `/session/${sessionId}`)
}

// Messages API
export async function getMessages(serverUrl: string, sessionId: string): Promise<Message[]> {
  return apiRequest<Message[]>(serverUrl, 'GET', `/session/${sessionId}/message`)
}

export async function sendMessage(
  serverUrl: string,
  sessionId: string,
  content: string,
  directory: string = DEFAULT_DIRECTORY
): Promise<void> {
  await fetch(
    `${serverUrl}/session/${sessionId}/prompt_async?directory=${encodeURIComponent(directory)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: content }],
        agent: 'pioneer',
      }),
    }
  )
}

// Aggregate API
export async function getAggregateStatus(serverUrl: string): Promise<AggregateState> {
  return apiRequest<AggregateState>(serverUrl, 'GET', '/aggregate/status')
}

export async function pauseAggregate(serverUrl: string): Promise<void> {
  await apiRequest<{ paused: boolean }>(serverUrl, 'POST', '/aggregate/pause')
}

export async function continueAggregate(serverUrl: string): Promise<void> {
  await apiRequest<{ continued: boolean }>(serverUrl, 'POST', '/aggregate/continue')
}

// File API
export async function listDirectory(
  serverUrl: string,
  dirPath: string,
  directory: string = DEFAULT_DIRECTORY
): Promise<FileEntry[]> {
  return apiRequest<FileEntry[]>(serverUrl, 'GET', '/file', undefined, directory)
}

export async function readFile(
  serverUrl: string,
  filePath: string,
  directory: string = DEFAULT_DIRECTORY
): Promise<FileContent> {
  return apiRequest<FileContent>(serverUrl, 'GET', '/file/content', undefined, directory)
}

export async function writeFile(
  serverUrl: string,
  filePath: string,
  content: string,
  directory: string = DEFAULT_DIRECTORY
): Promise<{ written: boolean }> {
  return apiRequest<{ written: boolean }>(serverUrl, 'POST', '/file', {
    path: filePath,
    content,
    directory,
  })
}

// Health check
export async function checkHealth(serverUrl: string): Promise<{ healthy: boolean; version: string }> {
  return apiRequest<{ healthy: boolean; version: string }>(serverUrl, 'GET', '/global/health')
}
