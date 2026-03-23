import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useToast } from "@tui/ui/toast"
import { Spinner } from "@tui/component/spinner"
import type { Message, Part } from "@opencode-ai/sdk/v2"

export type SparkerPanelProps = {
  sessionId: string
  title: string
  placeholder?: string
  onSendMessage?: (content: string) => void
}

export function SparkerPanel(props: SparkerPanelProps) {
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()

  const [inputValue, setInputValue] = createSignal("")
  const [isLoading, setIsLoading] = createSignal(false)

  // Sync session messages when session changes
  createEffect(() => {
    const sessionId = props.sessionId
    if (!sessionId) return
    sync.session.sync(sessionId)
  })

  // Get messages for this session from sync store
  const messages = createMemo(() => {
    const sessionId = props.sessionId
    if (!sessionId) return []
    return sync.data.message[sessionId] ?? []
  })

  // Get parts for a message
  function getMessageParts(messageId: string): Part[] {
    return sync.data.part[messageId] ?? []
  }

  // Send a message to the session
  async function sendMessage(content: string) {
    const sessionId = props.sessionId
    if (!sessionId || !content.trim()) return

    // If there's a custom handler, use it
    if (props.onSendMessage) {
      props.onSendMessage(content)
      setInputValue("")
      return
    }

    try {
      setIsLoading(true)
      await sdk.client.session.prompt({
        sessionID: sessionId,
        parts: [{ type: "text", text: content }],
      })
      setInputValue("")
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
              <Show when={part.type === "text"}>
                <text fg={theme.text}>{part.text}</text>
              </Show>
              <Show when={part.type === "tool"}>
                <text fg={theme.textMuted}>
                  [{part.tool}]{" "}
                  {part.state?.status === "completed" ? "✓" : part.state?.status === "running" ? "..." : "✗"}
                </text>
              </Show>
              <Show when={part.type === "reasoning"}>
                <text
                  fg={theme.textMuted}
                  attributes={TextAttributes.ITALIC}
                >{`Reasoning: ${part.text?.substring(0, 100)}...`}</text>
              </Show>
            </box>
          )}
        </For>
      </box>
    )
  }

  return (
    <box flexGrow={1} minWidth={0} flexDirection="column" borderRight={1}>
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
          {props.title}
        </text>
        <box flexGrow={1} />
        <text fg={theme.textMuted}>Surveyor</text>
      </box>

      {/* Messages area */}
      <scrollbox flexGrow={1} padding={1}>
        <Show
          when={messages().length > 0}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
              <text fg={theme.textMuted}>{props.placeholder ?? "Send a message to start..."}</text>
            </box>
          }
        >
          <For each={messages()}>{(message) => renderMessage(message)}</For>
        </Show>
      </scrollbox>

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
    </box>
  )
}
