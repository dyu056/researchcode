import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useSDK } from "@tui/context/sdk"
import { useToast } from "../../ui/toast"
import { Spinner } from "@tui/component/spinner"
import { ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import type { Message, Part } from "@opencode-ai/sdk/v2"

export function RelayPanel() {
  const route = useRoute()
  const sync = useSync()
  const sdk = useSDK()
  const toast = useToast()
  const { theme } = useTheme()

  const [activeSessionId, setActiveSessionId] = createSignal<string | null>(null)
  const [messages, setMessages] = createStore<Message[]>([])
  const [inputValue, setInputValue] = createSignal("")
  const [isLoading, setIsLoading] = createSignal(false)
  const [showNewSessionForm, setShowNewSessionForm] = createSignal(false)
  const [newSessionTitle, setNewSessionTitle] = createSignal("")

  // Get sessions from sync store
  const sessions = createMemo(() => sync.data.session)

  // Sync session messages when active session changes
  createEffect(() => {
    const sessionId = activeSessionId()
    if (!sessionId) return
    sync.session.sync(sessionId)
  })

  // Get messages for active session from sync store
  const activeMessages = createMemo(() => {
    const sessionId = activeSessionId()
    if (!sessionId) return []
    return sync.data.message[sessionId] ?? []
  })

  // Get parts for a message
  function getMessageParts(messageId: string): Part[] {
    return sync.data.part[messageId] ?? []
  }

  // Create a new session
  async function createSession(title: string) {
    try {
      setIsLoading(true)
      const result = await sdk.client.session.create({
        title,
        permission: [
          { permission: "question", action: "deny", pattern: "*" },
          { permission: "plan_enter", action: "deny", pattern: "*" },
          { permission: "plan_exit", action: "deny", pattern: "*" },
        ],
      })

      if (result.data?.id) {
        setActiveSessionId(result.data.id)
        setShowNewSessionForm(false)
        setNewSessionTitle("")
        toast.show({ message: `Session created: ${title}`, variant: "info" })
      }
    } catch (error) {
      toast.show({ message: `Failed to create session: ${error}`, variant: "error" })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete a session
  async function deleteSession(sessionId: string, e: MouseEvent) {
    e.stopPropagation()
    try {
      await sdk.client.session.delete({ sessionID: sessionId })
      if (activeSessionId() === sessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
      toast.show({ message: "Session deleted", variant: "info" })
    } catch (error) {
      toast.show({ message: `Failed to delete session: ${error}`, variant: "error" })
    }
  }

  // Send a message to the active session
  async function sendMessage(content: string) {
    const sessionId = activeSessionId()
    if (!sessionId || !content.trim()) return

    try {
      setIsLoading(true)
      // Use the SDK to send a message - this will trigger AI processing
      await sdk.client.session.prompt({
        sessionID: sessionId,
        parts: [{ type: "text", text: content }],
      })
      setInputValue("")
      // Trigger sync to get updated messages
      await sync.session.sync(sessionId)
    } catch (error) {
      toast.show({ message: `Failed to send message: ${error}`, variant: "error" })
    } finally {
      setIsLoading(false)
    }
  }

  // Render a single message
  function renderMessage(message: Message) {
    const parts = getMessageParts(message.info.id)
    return (
      <box flexDirection="column" gap={1} paddingBottom={1}>
        <box>
          <text fg={message.info.role === "user" ? theme.primary : theme.text} attributes={TextAttributes.BOLD}>
            {message.info.role === "user" ? "You" : "Assistant"}
          </text>
          <text fg={theme.textMuted}> · </text>
          <text fg={theme.textMuted}>{new Date(message.info.time.created).toLocaleTimeString()}</text>
        </box>
        <For each={parts}>
          {(part) => (
            <box paddingLeft={2}>
              <Switch>
                <Match when={part.type === "text"}>
                  <text fg={theme.text}>{part.text}</text>
                </Match>
                <Match when={part.type === "tool"}>
                  <text fg={theme.textMuted}>
                    [{part.tool}] {part.state?.status === "completed" ? "✓" : part.state?.status === "running" ? "..." : "✗"}
                  </text>
                </Match>
                <Match when={part.type === "reasoning"}>
                  <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
                    Reasoning: {part.text?.substring(0, 100)}...
                  </text>
                </Match>
              </Switch>
            </box>
          )}
        </For>
      </box>
    )
  }

  return (
    <box width="100%" height="100%" flexDirection="column">
      {/* Header */}
      <box
        flexShrink={0}
        paddingLeft={1}
        paddingRight={1}
        height={3}
        flexDirection="row"
        alignItems="center"
        borderBottom={1}
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Relay Panel
        </text>
        <box flexGrow={1} />
        <text fg={theme.textMuted}>/relay to close</text>
      </box>

      {/* Main content area */}
      <box flexGrow={1} minHeight={0} flexDirection="row">
        {/* Left sidebar - Session list */}
        <box width={30} flexShrink={0} flexDirection="column" borderRight={1}>
          {/* New session button */}
          <box padding={1}>
            <Show
              when={!showNewSessionForm()}
              fallback={
                <box flexDirection="column" gap={1}>
                  <box>
                    <text fg={theme.text}>Title: </text>
                    <input
                      value={newSessionTitle()}
                      onChange={(e) => setNewSessionTitle(e.target.value)}
                      fg={theme.text}
                      backgroundColor={theme.background}
                    />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <button
                      onClick={() => createSession(newSessionTitle() || "New Session")}
                      backgroundColor={theme.primary}
                      paddingX={1}
                    >
                      <text fg={theme.background}>Create</text>
                    </button>
                    <button onClick={() => setShowNewSessionForm(false)} paddingX={1}>
                      <text fg={theme.text}>Cancel</text>
                    </button>
                  </box>
                </box>
              }
            >
              <button onClick={() => setShowNewSessionForm(true)} width="100%">
                <text fg={theme.text}>+ New Session</text>
              </button>
            </Show>
          </box>

          {/* Session list */}
          <ScrollBoxRenderable flexGrow={1}>
            <For each={sessions().filter(Boolean)}>
              {(session) => (
                <Show when={session}>
                  <box
                    paddingLeft={1}
                    paddingRight={1}
                    paddingY={1}
                    backgroundColor={activeSessionId() === session.id ? theme.primary : undefined}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <box flexDirection="column" gap={1}>
                      <text
                        fg={activeSessionId() === session.id ? theme.background : theme.text}
                        attributes={TextAttributes.BOLD}
                      >
                        {session.title || "Untitled"}
                      </text>
                      <text
                        fg={activeSessionId() === session.id ? theme.background : theme.textMuted}
                      >
                        {new Date(session.time.updated).toLocaleDateString()}
                      </text>
                    </box>
                    <box flexGrow={1} />
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      paddingX={1}
                    >
                      <text fg={theme.error}>×</text>
                    </button>
                  </box>
                </Show>
              )}
            </For>
          </ScrollBoxRenderable>
        </box>

        {/* Right side - Messages and input */}
        <box flexGrow={1} minWidth={0} flexDirection="column">
          <Show
            when={activeSessionId()}
            fallback={
              <box flexGrow={1} alignItems="center" justifyContent="center">
                <text fg={theme.textMuted}>Select a session to view messages</text>
              </box>
            }
          >
            {/* Messages area */}
            <ScrollBoxRenderable flexGrow={1} padding={1}>
              <For each={activeMessages()}>
                {(message) => renderMessage(message)}
              </For>
            </ScrollBoxRenderable>

            {/* Input area */}
            <box padding={1} borderTop={1} flexDirection="row" gap={1} alignItems="center">
              <box flexGrow={1}>
                <input
                  value={inputValue()}
                  onChange={(e) => setInputValue(e.target.value)}
                  onSubmit={() => sendMessage(inputValue())}
                  placeholder="Type a message..."
                  fg={theme.text}
                  backgroundColor={theme.background}
                  width="100%"
                />
              </box>
              <Show when={isLoading()}>
                <Spinner />
              </Show>
              <button
                onClick={() => sendMessage(inputValue())}
                disabled={!inputValue().trim() || isLoading()}
                backgroundColor={theme.primary}
                paddingX={2}
              >
                <text fg={theme.background}>Send</text>
              </button>
            </box>
          </Show>
        </box>
      </box>
    </box>
  )
}
