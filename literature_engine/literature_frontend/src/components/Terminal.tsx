// Literature Review Engine - Terminal Component
// OpenCode SSE streaming integration

import { useState, useRef, useEffect } from 'react';
import './Terminal.css';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tool?: string;
}

interface ToolEvent {
  type: 'start' | 'tool' | 'complete' | 'done';
  tool?: string;
  title?: string;
  status?: string;
  nodeCount?: number;
}

interface Props {
  treeId: string | null;
  onStartBuild: (topic: string) => void;
  onBuildComplete?: (nodeCount: number) => void;
}

export function Terminal({ treeId, onStartBuild, onBuildComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, buildProgress]);

  const connectToBuildStream = (tid: string) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/trees/${tid}/build`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: ToolEvent = JSON.parse(event.data);

        if (data.type === 'start') {
          setBuildProgress(prev => [...prev, `🚀 ${data.title || 'Starting...'}`]);
        } else if (data.type === 'tool' && data.tool) {
          const icon = data.status === 'completed' ? '✅' : data.status === 'error' ? '❌' : '⚙️';
          setBuildProgress(prev => [...prev, `${icon} ${data.title || data.tool}`]);
        } else if (data.type === 'complete' || data.type === 'done') {
          setBuildProgress(prev => [...prev, `📊 Found ${data.nodeCount || 0} papers`]);
          setIsLoading(false);

          // Final message
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `Build complete! Found ${data.nodeCount || 0} papers.\n\nProgress:\n${buildProgress.slice(-10).join('\n')}`,
              timestamp: new Date(),
            },
          ]);

          if (onBuildComplete && data.nodeCount !== undefined) {
            onBuildComplete(data.nodeCount);
          }

          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: 'Connection error. Check if OpenCode is running.',
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      eventSource.close();
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !treeId) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setBuildProgress([]);

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);

    // Handle the build command
    if (userMessage.toLowerCase().startsWith('build tree for')) {
      const topic = userMessage.replace(/^build tree for\s*/i, '').trim();
      if (!topic) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Please specify a topic. Example: build tree for Attention Mechanisms',
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Start the build via API call first
      onStartBuild(topic);

      // Add initial message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Starting autonomous build for: "${topic}"\n\nOpenCode will:\n1. Search for top papers from top universities\n2. Trace citations backward\n3. Stop at roots or textbook-level papers\n\nConnecting to OpenCode stream...`,
          timestamp: new Date(),
        },
      ]);

      // Connect to SSE stream
      connectToBuildStream(treeId);
    } else {
      // Generic response
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `[OpenCode would process: "${userMessage}" here]\n\nAvailable commands:\n- "Build tree for [topic]" - Start autonomous tree building\n- "Show tree stats" - Display current tree statistics\n\nOpenCode is ready to help!`,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
      }, 500);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">OpenCode Terminal</span>
        {treeId && <span className="tree-id">Tree: {treeId}</span>}
        {isLoading && <span className="status">Running...</span>}
      </div>

      <div className="terminal-messages">
        {messages.length === 0 && !isLoading && (
          <div className="welcome-message">
            <p>Welcome to Literature Review Engine</p>
            <p>Type <code>build tree for [topic]</code> to start</p>
            <p>Example: <code>build tree for Attention Mechanisms in Transformers</code></p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-header">
              {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'OpenCode'}
            </div>
            <pre className="message-content">{msg.content}</pre>
          </div>
        ))}

        {isLoading && buildProgress.length > 0 && (
          <div className="message assistant">
            <div className="message-header">OpenCode Progress</div>
            <pre className="message-content progress">
              {buildProgress.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </pre>
          </div>
        )}

        {isLoading && buildProgress.length === 0 && (
          <div className="message assistant">
            <div className="message-header">OpenCode</div>
            <pre className="message-content loading">Starting OpenCode...</pre>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="terminal-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={treeId ? "Enter command (e.g., 'build tree for Attention Mechanisms')..." : "Create a tree first with 'build tree for [topic]'"}
          disabled={isLoading || !treeId}
        />
        <button type="submit" disabled={isLoading || !treeId}>
          Send
        </button>
      </form>
    </div>
  );
}
