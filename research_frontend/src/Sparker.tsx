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

const DEFAULT_DIRECTORY = 'Research_Sessions'

// Agent Memory Constants
const SPARKER_SOUL = `You are a Socratic research companion - a thinking partner, not an answer provider. Your role is to guide users to discover insights through questioning, not to give them direct answers. You help users deepen their understanding by asking probing questions, identifying gaps in reasoning, and challenging assumptions.`

const SPARKER_AGENT = `Your Socratic questioning methodology:

PHASE 1 - Core Mental Models
Ask: "What are the 5 core mental models that every expert in this field shares?"

PHASE 2 - Expert Disagreements
Ask: "What are the 3 places where experts fundamentally disagree, and each side's strongest argument?"

PHASE 3 - Deep Understanding Questions
Generate questions that expose whether someone deeply understands vs. just memorized facts.

PHASE 4 - Follow-up Learning
When user gives wrong answers: "Explain why this is wrong and what you're missing."

Never provide direct answers. Guide users to discover insights through questioning.`

const SURVEYOR_SOUL = `You are a diligent academic researcher seeking comprehensive, rigorous literature review. Your mission is to find the most influential research from top university labs and trace how ideas evolved through citation trees.`

const SURVEYOR_AGENT = `Your methodology:
1. Find TOP UNIVERSITY LABS doing this research (MIT, Stanford, Berkeley, Carnegie Mellon, Harvard, Oxford, Cambridge, etc.)
2. Only locate literatures from those elite teams
3. Rank papers by influence index (citation count, venue prestige, award winners)
4. Trace paper lineage - find citation trees showing how work evolved
5. Identify papers that USE tree diagrams to represent citations
6. Write literature review in LaTeX format (like top academic reviews)
7. Save to: literature-review.tex, top-labs.md, citation-trees.md`

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
  const [step, setStep] = useState<'folder' | 'existing' | 'topic' | 'session'>('existing')
  const [rootFolder, setRootFolder] = useState('.')
  const [rootFolderHandle, setRootFolderHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [topicName, setTopicName] = useState('')
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState('.')
  const [isCreating, setIsCreating] = useState(false)

  // User-configurable session directory (where opencode sessions and memory files live)
  const [sessionDirectory, setSessionDirectory] = useState(DEFAULT_DIRECTORY)

  // Existing research sessions detected in root folder
  const [existingSessions, setExistingSessions] = useState<{ name: string; path: string }[]>([])

  // Native folder picker using File System Access API
  const pickFolder = async () => {
    try {
      // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
      const dirHandle = await window.showDirectoryPicker()
      setRootFolderHandle(dirHandle)
      setRootFolder(dirHandle.name)
      await checkExistingSessions(dirHandle.name)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to pick folder:', err)
      }
      // Fallback: use a default path for development/testing
      setRootFolder('.')
      await checkExistingSessions('.')
    }
  }

  // Check if selected folder has existing sparker research sessions
  const checkExistingSessions = async (folderPath: string) => {
    try {
      const sessions: { name: string; path: string }[] = []

      // Use server API to list directories in sessionDirectory
      const listUrl = `${serverUrl}/file?path=${encodeURIComponent(sessionDirectory)}`
      const response = await fetch(listUrl)
      if (response.ok) {
        const files = await response.json() as Array<{ name: string; type: string; path: string }>
        const dirs = files.filter((f: any) => f.type === 'directory' && !f.name.startsWith('.'))
        sessions.push(...dirs.map((d: any) => ({ name: d.name, path: d.name })))
      }

      setExistingSessions(sessions)
    } catch {
      setExistingSessions([])
    }
    setStep('existing')
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

  // Surveyor 4-tab interface
  type SurveyorTab = 'literature' | 'console' | 'labs' | 'trees'
  const [surveyorTab, setSurveyorTab] = useState<SurveyorTab>('literature')

  // Surveyor output content for each tab
  const [surveyorContent, setSurveyorContent] = useState<{
    literature: string
    console: string[]
    labs: { name: string; url: string; description: string; papers: { title: string; authors: string; citations: string; influenceIndex: number }[]; influenceIndex: number }[]
    trees: { labName: string; paper: string; citations: string }[]
  }>({
    literature: '',
    console: [],
    labs: [],
    trees: []
  })

  // Typed terminal entries with color info
  type TerminalEntryType = 'separator' | 'user' | 'reasoning' | 'text' | 'tool_call' | 'tool_input' | 'tool_output' | 'status' | 'info'
  interface TerminalEntry {
    type: TerminalEntryType
    content: string
  }
  const [terminalLines, setTerminalLines] = useState<TerminalEntry[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const consoleScrollRef = useRef<HTMLDivElement>(null)
  const surveyorInitializedRef = useRef(false)

  // Surveyor initial prompt with methodology
  const surveyorInitialPrompt = `You are Surveyor - an academic literature researcher. Your mission is to conduct a comprehensive literature review on "${topicName}".

## YOUR METHODOLOGY:

1. Find TOP UNIVERSITY LABS doing research on this topic
   - Focus on: MIT, Stanford, Berkeley, Carnegie Mellon, Harvard, Oxford, Cambridge
   - Check: lab websites, arXiv, Google Scholar

2. LOCATE ONLY papers from elite university teams

3. RANK by influence:
   - Citation count
   - Venue prestige (NeurIPS, ICML, Nature, Science, etc.)
   - Award winners
   - Assign each lab an "Influence Index" (0-100)

4. TRACE paper lineage - build citation trees

5. OUTPUT YOUR FINDINGS in structured format with Labs → Papers hierarchy:

For each lab, output BOTH a structured block AND a markdown file:
[LABS]
- Lab Name: <lab name>
  Influence Index: <0-100>
  URL: <official link>
  Description: <what they do and why they're influential>
  [PAPERS]
  - Paper: <paper title>
    Authors: <authors>
    Citations: <citation count and info>
    Influence: <0-100>
  [/PAPERS]
[/LABS]

For citation trees:
[TREES]
- Paper: <title>
  Lab: <lab name>
  Citations: <full citation tree and lineage information>
[/TREES]

For the literature review:
[LITERATURE_REVIEW]
<LaTeX formatted literature review with sections for Introduction, Top Labs, Papers, and Conclusions>
[/LITERATURE_REVIEW]

SURVEYOR FILE STRUCTURE:
The server's working directory is: /Volumes/UBag/Documents/claude_code_modifications/researchcode/packages/opencode
Your session's research folder is at: ${topicName} (this is your session's working directory)
Write files to the surveyor/ subdirectory within your session's working directory.

ABSOLUTE RULE:
- NEVER use absolute paths like /Volumes/... or /Users/... in any command
- ALWAYS use the Write tool with path: surveyor/filename.tex (relative to your session directory)
- Example: {"path": "surveyor/literature-review.tex", "content": "..."}

WRONG (DO NOT USE):
- {"path": "Research_Sessions/...", ...}
- {"path": "/Volumes/.../surveyor/...", ...}
- mkdir -p /Volumes/.../surveyor
- echo "content" > /Volumes/.../surveyor/file.tex

CORRECT (USE THIS):
- Use Write tool with path: surveyor/literature-review.tex
- Use Write tool with path: surveyor/top-labs.md
- Use Write tool with path: surveyor/citation-trees.md

Start by searching for top labs working on "${topicName}". After finding labs, search for their key papers and build citation trees. OUTPUT THE STRUCTURED BLOCKS IN YOUR RESPONSE so the UI can parse them.`

  // Send initial literature review prompt to surveyor when session starts
  useEffect(() => {
    if (surveyorSessionId && step === 'session' && !surveyorInitializedRef.current) {
      surveyorInitializedRef.current = true
      sendMessage(surveyorSessionId, surveyorInitialPrompt, true)
    }
  }, [surveyorSessionId, step, surveyorInitialPrompt])

  useEffect(() => {
    if (step === 'folder') {
      fetchFolders(currentPath)
    }
  }, [step, currentPath])

  // Check for existing sessions on mount when step is 'existing'
  useEffect(() => {
    if (step === 'existing') {
      checkExistingSessions(sessionDirectory)
    }
  }, [step, sessionDirectory])

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
      // Create the folder structure using File System Access API
      // This creates folders directly in the user's selected directory
      if (rootFolderHandle) {
        // Create: <selected>/<topic>/
        const topicHandle = await rootFolderHandle.getDirectoryHandle(topic, { create: true })
        // Create: <selected>/<topic>/surveyor/
        await topicHandle.getDirectoryHandle('surveyor', { create: true })
      } else {
        // Fallback to server-side folder creation if no handle (e.g., in non-supporting browsers)
        // Use sessionDirectory which points to the shared Research_Sessions folder
        const folderPath = `${sessionDirectory}/${topic}`
        const surveyorPath = `${folderPath}/surveyor`
        await fetch(`${serverUrl}/folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: folderPath })
        })
        await fetch(`${serverUrl}/folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: surveyorPath })
        })
      }

      const sparkerSession = await apiRequest<{ id?: string; error?: string }>(
        serverUrl, 'POST', '/session',
        {
          title: `${topic} - Sparker`,
          model: sparkerModel,
          directory: DEFAULT_DIRECTORY,
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
          directory: `${DEFAULT_DIRECTORY}/${topic}`,
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
      const response = await fetch(`${serverUrl}/session/${sessionId}/prompt_async`, {
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

  // Parse Surveyor messages to extract content for tabs
  const parseSurveyorMessages = useCallback((messages: Message[]) => {
    const consoleLines: string[] = []
    const terminalOutput: TerminalEntry[] = []
    let literatureContent = ''
    const labsMap: Map<string, { name: string; url: string; description: string; papers: { title: string; authors: string; citations: string; influenceIndex: number }[]; influenceIndex: number }> = new Map()
    const treePapers: { labName: string; paper: string; citations: string }[] = []

    messages.forEach(msg => {
      const isUser = msg.info.role === 'user'
      const isAssistant = msg.info.role === 'assistant'

      // Add separator for user messages
      if (isUser) {
        terminalOutput.push({ type: 'separator', content: '─'.repeat(50) })
        terminalOutput.push({ type: 'user', content: '👤 User:' })
      }

      msg.parts.forEach(part => {
        // Show reasoning/thinking step
        if (part.type === 'reasoning' && part.text && part.text.trim()) {
          terminalOutput.push({ type: 'reasoning', content: `💭 ${part.text}` })
          consoleLines.push(`💭 ${part.text}`)
        }

        // Show text content from assistant
        if (part.type === 'text' && part.text && isAssistant) {
          terminalOutput.push({ type: 'text', content: part.text })
          consoleLines.push(part.text)

          // Parse [LITERATURE_REVIEW] blocks
          const litMatch = part.text.match(/\[LITERATURE_REVIEW\]([\s\S]*?)\[\/LITERATURE_REVIEW\]/i)
          if (litMatch) {
            literatureContent = litMatch[1].trim()
          }

          // Fallback: look for raw LaTeX patterns
          if (!literatureContent && (part.text.includes('\\documentclass') || part.text.includes('\\section{') || part.text.includes('\\begin{document}'))) {
            const docMatch = part.text.match(/(\\begin\{document\}([\s\S]*?)\\end\{document\})/)
            if (docMatch) {
              literatureContent = docMatch[1]
            } else if (part.text.includes('\\begin{')) {
              literatureContent = part.text
            }
          }

          // Parse [LABS] blocks
          const labsBlockRegex = /\[LABS\]([\s\S]*?)\[\/LABS\]/gi
          let labsBlockMatch
          while ((labsBlockMatch = labsBlockRegex.exec(part.text)) !== null) {
            const labsText = labsBlockMatch[1]
            const labEntryRegex = /-\s*Lab\s+Name:\s*(.+?)(?=(?:-\s*Lab\s+Name:)|(?:\[LABS\])|(?:\[PAPERS\])|(?:\[TREES\])|(?:\[LITERATURE_REVIEW\])|(?:\[$)|(?:<\/)|$)/gi
            let labEntryMatch
            while ((labEntryMatch = labEntryRegex.exec(labsText)) !== null) {
              const entry = labEntryMatch[1]
              const nameMatch = entry.match(/^(.+?)(?:\s+Influence\s+Index:|$)/i)
              const influenceMatch = entry.match(/Influence\s+Index:\s*(\d+)/i)
              const urlMatch = entry.match(/URL:\s*(https?:\/\/[^\s\]]+)/i)
              const descMatch = entry.match(/Description:\s*(.+?)(?:\s*\[PAPERS\]|$)/i)

              // Parse papers under this lab
              const papers: { title: string; authors: string; citations: string; influenceIndex: number }[] = []
              const papersMatch = entry.match(/\[PAPERS\]([\s\S]*?)\[\/PAPERS\]/i)
              if (papersMatch) {
                const papersText = papersMatch[1]
                const paperRegex = /-\s*Paper:\s*(.+?)(?=(?:-\s*Paper:)|(?:\[PAPERS\])|(?:\[LABS\])|$)/gi
                let paperMatch
                while ((paperMatch = paperRegex.exec(papersText)) !== null) {
                  const paperText = paperMatch[1]
                  const paperTitleMatch = paperText.match(/^(.+?)(?:\s+Authors?:|$)/i)
                  const paperAuthorsMatch = paperText.match(/Authors?:\s*(.+?)(?:\s+Citations?:|$)/i)
                  const paperCitationsMatch = paperText.match(/Citations?:\s*(.+?)(?:\s+Influence:|$)/i)
                  const paperInfluenceMatch = paperText.match(/Influence:\s*(\d+)/i)

                  if (paperTitleMatch) {
                    papers.push({
                      title: paperTitleMatch[1].trim(),
                      authors: paperAuthorsMatch ? paperAuthorsMatch[1].trim() : '',
                      citations: paperCitationsMatch ? paperCitationsMatch[1].trim() : '',
                      influenceIndex: paperInfluenceMatch ? parseInt(paperInfluenceMatch[1]) : 0
                    })
                  }
                }
              }

              if (nameMatch) {
                const labName = nameMatch[1].trim()
                labsMap.set(labName, {
                  name: labName,
                  url: urlMatch ? urlMatch[1] : '',
                  description: descMatch ? descMatch[1].trim() : '',
                  papers: papers,
                  influenceIndex: influenceMatch ? parseInt(influenceMatch[1]) : 0
                })
              }
            }
          }

          // Parse [TREES] blocks
          const treesMatch = part.text.match(/\[TREES\]([\s\S]*?)\[\/TREES\]/i)
          if (treesMatch) {
            const treesText = treesMatch[1]
            const treeEntries = treesText.split(/(?=^\s*[-*])/m).filter(t => t.trim())
            treeEntries.forEach(treeEntry => {
              const paperMatch = treeEntry.match(/Paper:\s*(.+)/i)
              const labMatch = treeEntry.match(/Lab:\s*(.+)/i)
              if (paperMatch) {
                treePapers.push({
                  labName: labMatch ? labMatch[1].trim() : 'Unknown Lab',
                  paper: paperMatch[1].trim(),
                  citations: treeEntry
                })
              }
            })
          }
        }

        // Show tool calls
        if (part.type === 'tool') {
          const toolName = part.tool || 'unknown'
          const status = part.state?.status || 'running'
          const input = part.state?.input
          const output = part.state?.output

          terminalOutput.push({ type: 'tool_call', content: `$ ${toolName}` })
          consoleLines.push(`$ ${toolName}`)

          if (input) {
            const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2)
            if (inputStr) {
              terminalOutput.push({ type: 'tool_input', content: inputStr })
              consoleLines.push(`> ${inputStr}`)
            }
          }

          if (output) {
            const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
            if (outputStr) {
              terminalOutput.push({ type: 'tool_output', content: outputStr })
              consoleLines.push(outputStr)
            }
          }

          if (status !== 'completed') {
            terminalOutput.push({ type: 'status', content: `[${status}]` })
            consoleLines.push(`[${status}]`)
          }
          terminalOutput.push({ type: 'info', content: '' })
        }
      })
    })

    const sortedLabs = Array.from(labsMap.values()).sort((a, b) => b.influenceIndex - a.influenceIndex)

    setSurveyorContent(prev => ({
      literature: literatureContent || prev.literature,
      console: consoleLines.slice(-200),
      labs: sortedLabs.slice(0, 10),
      trees: treePapers.slice(0, 20)
    }))
    setTerminalLines(terminalOutput.slice(-500))
  }, [])

  // Parse Surveyor messages when they update
  useEffect(() => {
    if (surveyorMessages.length > 0) {
      parseSurveyorMessages(surveyorMessages)
    }
  }, [surveyorMessages, parseSurveyorMessages])

  // Auto-scroll console to bottom when terminalLines update
  useEffect(() => {
    if (consoleScrollRef.current) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight
    }
  }, [terminalLines])

  // Render terminal-style message with colors
  const renderTerminalEntry = (entry: TerminalEntry, idx: number) => {
    const colors: Record<TerminalEntryType, string> = {
      separator: '#3a3a5a',
      user: '#58a6ff',
      reasoning: '#d29922',
      text: '#ffffff',
      tool_call: '#3fb950',
      tool_input: '#f78166',
      tool_output: '#8b949e',
      status: '#a78bfa',
      info: '#6b7280'
    }
    return (
      <div key={idx} style={{
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        fontSize: '12px',
        lineHeight: '1.4',
        color: colors[entry.type] || '#ffffff',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: entry.type === 'separator' ? '8px 0' : '2px 0',
        borderLeft: entry.type === 'user' ? '2px solid #58a6ff' : entry.type === 'reasoning' ? '2px solid #d29922' : 'none',
        paddingLeft: entry.type === 'user' || entry.type === 'reasoning' ? '8px' : '0'
      }}>
        {entry.content}
      </div>
    )
  }

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

  // Step 2: Existing Sessions Detection
  if (step === 'existing') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#1a1a2e', padding: '24px', borderRadius: '16px', width: '500px', border: '1px solid #3a3a5a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>📂 {sessionDirectory}</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Root folder selected</p>

          {existingSessions.length > 0 ? (
            <>
              <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>Detected {existingSessions.length} existing research session{existingSessions.length > 1 ? 's' : ''}:</p>
              <div style={{ marginBottom: '20px', maxHeight: '200px', overflow: 'auto' }}>
                {existingSessions.map((session) => (
                  <div key={session.path} onClick={() => {
                    setTopicName(session.name)
                    setStep('topic')
                  }}
                    style={{ padding: '12px 16px', background: '#16162a', border: '1px solid #2a2a4a', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>📁</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{session.name}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>Continue research</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #2a2a4a', paddingTop: '16px' }}>
                <button onClick={() => setStep('topic')} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #3a3a5a', color: '#a1a1aa', cursor: 'pointer', borderRadius: '10px', fontSize: '14px' }}>
                  + Start New Research
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>No existing research sessions found in this folder.</p>
              <button onClick={() => setStep('topic')} style={{ width: '100%', padding: '14px', background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '10px', fontSize: '15px', fontWeight: 600 }}>
                Start New Research
              </button>
            </>
          )}

          <button onClick={() => {
            fetch(`${serverUrl}/exec`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: `open "/Volumes/UBag/Documents/claude_code_modifications/researchcode/packages/opencode/${sessionDirectory}"`, directory: '/tmp' })
            })
          }} style={{ width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px' }}>
            🔍 Open Folder
          </button>
          <button onClick={async () => {
            const aliasCommand = `ln -sf "/Volumes/UBag/Documents/claude_code_modifications/researchcode/packages/opencode/${sessionDirectory}" "/Users/danielyu/Documents/${sessionDirectory}"`
            await fetch(`${serverUrl}/exec`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: aliasCommand, directory: '/Users/danielyu/Documents' })
            })
          }} style={{ width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px' }}>
            🔗 Create Alias in Documents
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Topic Naming
  if (step === 'topic') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#1a1a1a', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid #333' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#fff' }}>🔬 New Research Session</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Step 3: Name Your Research Topic</p>
          {error && (
            <div style={{ padding: '10px', background: '#3f1515', border: '1px solid #ef4444', borderRadius: '6px', marginBottom: '16px', color: '#ef4444', fontSize: '13px' }}>{error}</div>
          )}
          <input type="text" value={topicName} onChange={(e) => { setTopicName(e.target.value); setError(null) }}
            placeholder="e.g., AI Safety Research, Climate Tech Analysis"
            style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '14px', marginBottom: '16px' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && topicName.trim()) createSparkerSessions(topicName.trim()) }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep('existing')} style={{ padding: '10px 20px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '6px' }}>Back</button>
            <button onClick={() => topicName.trim() && createSparkerSessions(topicName.trim())} disabled={!topicName.trim() || isCreating}
              style={{ padding: '10px 20px', background: topicName.trim() && !isCreating ? '#22c55e' : '#333', border: 'none', color: topicName.trim() && !isCreating ? '#000' : '#888', cursor: topicName.trim() && !isCreating ? 'pointer' : 'not-allowed', borderRadius: '6px', fontWeight: 'bold' }}>
              {isCreating ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 4: Split View Session
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
                <div style={{ color: '#6b7280', fontSize: '11px' }}>Literature Review Agent</div>
              </div>
            </div>
            {/* 4-Tab Interface */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '12px', background: '#0f0f1a', borderRadius: '8px', padding: '4px' }}>
              {(['literature', 'console', 'labs', 'trees'] as SurveyorTab[]).map(tab => (
                <button key={tab} onClick={() => setSurveyorTab(tab)}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', borderRadius: '6px',
                    background: surveyorTab === tab ? '#10b981' : 'transparent',
                    color: surveyorTab === tab ? '#000' : '#9ca3af',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                    textTransform: 'capitalize'
                  }}>
                  {tab === 'literature' ? '📄 Review' : tab === 'console' ? '💻 Console' : tab === 'labs' ? '🏛️ Labs' : '🌳 Trees'}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Literature Review Tab */}
            {surveyorTab === 'literature' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {surveyorContent.literature ? (
                  <div style={{ fontFamily: 'Monaco, Menlo, monospace', fontSize: '13px', lineHeight: '1.6', color: '#e5e5e5', whiteSpace: 'pre-wrap' }}>
                    {surveyorContent.literature}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563', height: '100%' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
                    <div style={{ fontSize: '14px' }}>Literature review will appear here</div>
                  </div>
                )}
              </div>
            )}

            {/* Console Tab */}
            {surveyorTab === 'console' && (
              <div ref={consoleScrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#0a0a0a' }}>
                {terminalLines.length > 0 ? (
                  terminalLines.map((entry, idx) => renderTerminalEntry(entry, idx))
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563', height: '100%' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>💻</div>
                    <div style={{ fontSize: '14px' }}>Console output will appear here</div>
                  </div>
                )}
              </div>
            )}

            {/* Labs Tab */}
            {surveyorTab === 'labs' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {surveyorContent.labs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {surveyorContent.labs.map((lab, idx) => (
                      <div key={idx} style={{ background: '#16162a', borderRadius: '10px', padding: '14px', border: '1px solid #2a2a4a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ color: '#10b981', fontWeight: 600, fontSize: '14px' }}>{lab.name}</div>
                          <div style={{ background: '#10b981', color: '#000', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                            {lab.influenceIndex}
                          </div>
                        </div>
                        {lab.url && <a href={lab.url} target="_blank" rel="noopener" style={{ color: '#58a6ff', fontSize: '12px', textDecoration: 'none' }}>{lab.url}</a>}
                        <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>{lab.description}</p>
                        {lab.papers.length > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #2a2a4a' }}>
                            <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '6px' }}>Papers ({lab.papers.length})</div>
                            {lab.papers.slice(0, 3).map((paper, pIdx) => (
                              <div key={pIdx} style={{ fontSize: '12px', marginBottom: '6px' }}>
                                <div style={{ color: '#e5e5e5' }}>{paper.title}</div>
                                <div style={{ color: '#6b7280', fontSize: '11px' }}>{paper.authors} • {paper.citations}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563', height: '100%' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏛️</div>
                    <div style={{ fontSize: '14px' }}>Top labs will appear here</div>
                  </div>
                )}
              </div>
            )}

            {/* Trees Tab */}
            {surveyorTab === 'trees' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {surveyorContent.trees.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {surveyorContent.trees.map((tree, idx) => (
                      <div key={idx} style={{ background: '#16162a', borderRadius: '10px', padding: '14px', border: '1px solid #2a2a4a' }}>
                        <div style={{ color: '#10b981', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{tree.paper}</div>
                        <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '8px' }}>{tree.labName}</div>
                        <pre style={{ color: '#8b949e', fontSize: '11px', fontFamily: 'Monaco, Menlo, monospace', whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                          {tree.citations}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563', height: '100%' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌳</div>
                    <div style={{ fontSize: '14px' }}>Citation trees will appear here</div>
                  </div>
                )}
              </div>
            )}
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
