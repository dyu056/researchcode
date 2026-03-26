// Literature Review Engine - Terminal Component
// This is a placeholder for the OpenCode relay integration

import { useState, useRef, useEffect } from 'react';
import './Terminal.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Props {
  treeId: string | null;
  onStartBuild: (topic: string) => void;
}

export function Terminal({ treeId, onStartBuild }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);

    // Handle the build command - works even without treeId
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
      onStartBuild(topic);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Starting autonomous build for: "${topic}"\n\nOpenCode will:\n1. Search for top papers from top universities\n2. Trace citations backward\n3. Stop at roots or textbook-level papers\n\nCheck the tree panel to watch it grow...`,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    } else {
      // Generic response for now
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `[OpenCode would process: "${userMessage}" here]\n\nAvailable commands:\n- "Build tree for [topic]" - Start autonomous tree building\n- "Show tree stats" - Display current tree statistics\n- "Find papers by [author]" - Search current tree\n\nConnect OpenCode relay to enable full functionality.`,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
      }, 500);
    }
  };

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">OpenCode Terminal</span>
        {treeId && <span className="tree-id">Tree: {treeId}</span>}
      </div>

      <div className="terminal-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <p>Welcome to Literature Review Engine</p>
            <p>Type <code>build tree for [topic]</code> to start</p>
            <p>Example: <code>build tree for Attention Mechanisms in Transformers</code></p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-header">
              {msg.role === 'user' ? 'You' : 'OpenCode'}
            </div>
            <pre className="message-content">{msg.content}</pre>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant">
            <div className="message-header">OpenCode</div>
            <pre className="message-content loading">Thinking...</pre>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="terminal-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter command (e.g., 'build tree for Attention Mechanisms')..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}
