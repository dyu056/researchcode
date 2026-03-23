import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { TextAttributes, TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { onMount, createSignal, Show } from "solid-js"
import { Spinner } from "@tui/component/spinner"
import { useRoute, useRouteData } from "@tui/context/route"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useToast } from "@tui/ui/toast"
import fs from "fs/promises"
import { join } from "path"

export function SparkerTopicName() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const navigate = useRoute()
  const route = useRouteData("sparker")
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()

  let textarea: TextareaRenderable
  const [topicName, setTopicName] = createSignal("")
  const [isCreating, setIsCreating] = createSignal(false)
  const [error, setError] = createSignal<string | undefined>()

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
    }
  })

  onMount(() => {
    dialog.setSize("medium")
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      textarea.focus()
    }, 1)
  })

  function validateTopicName(name: string): string | undefined {
    if (!name.trim()) {
      return "Topic name cannot be empty"
    }
    // Check for invalid characters in folder names
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(name)) {
      return "Topic name contains invalid characters"
    }
    // Check for reserved names
    const reserved = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "LPT1", "LPT2"]
    if (reserved.includes(name.toUpperCase())) {
      return "Topic name is a reserved name"
    }
    return undefined
  }

  async function createSparkerSession() {
    const name = topicName().trim()
    const validationError = validateTopicName(name)
    if (validationError) {
      setError(validationError)
      return
    }

    const rootFolder = route.rootFolder ?? "."
    const sparkerPath = join(rootFolder, "sparker", name)
    const surveyorPath = join(sparkerPath, "surveyor")

    setIsCreating(true)
    setError(undefined)

    try {
      // Create folder structure
      await fs.mkdir(surveyorPath, { recursive: true })

      // Create sparker session
      const sparkerResult = await sdk.client.session.create({
        title: `${name} - Sparker`,
        permission: [
          { permission: "question", action: "deny", pattern: "*" },
          { permission: "plan_enter", action: "deny", pattern: "*" },
          { permission: "plan_exit", action: "deny", pattern: "*" },
        ],
      })

      if (!sparkerResult.data?.id) {
        throw new Error("Failed to create sparker session")
      }

      // Create surveyor session
      const surveyorResult = await sdk.client.session.create({
        title: `${name} - Surveyor`,
        permission: [
          { permission: "question", action: "deny", pattern: "*" },
          { permission: "plan_enter", action: "deny", pattern: "*" },
          { permission: "plan_exit", action: "deny", pattern: "*" },
        ],
      })

      if (!surveyorResult.data?.id) {
        throw new Error("Failed to create surveyor session")
      }

      // Navigate to the sparker session view
      navigate.navigate({
        type: "sparker",
        step: "session",
        rootFolder,
        topic: name,
        sessionID: sparkerResult.data.id,
        surveyorSessionID: surveyorResult.data.id,
      })

      toast.show({ message: `Created research session: ${name}`, variant: "info" })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Failed to create session: ${message}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Name Your Research Topic
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>

      <Show when={error()}>
        <box paddingTop={1}>
          <text fg={theme.error}>{error()}</text>
        </box>
      </Show>

      <box gap={1} paddingTop={1}>
        <text fg={theme.textMuted}>Enter a name for your research topic:</text>
        <textarea
          onSubmit={() => createSparkerSession()}
          height={3}
          keyBindings={[{ name: "return", action: "submit" }]}
          ref={(val: TextareaRenderable) => (textarea = val)}
          initialValue={topicName()}
          onInput={(val) => {
            setTopicName(val)
            setError(undefined)
          }}
          placeholder="e.g., AI Safety Research, Climate Tech Analysis"
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />
      </box>

      <box flexDirection="row" gap={1} paddingTop={1}>
        <Show when={isCreating()}>
          <Spinner />
        </Show>
        <text fg={theme.text}>
          enter <span style={{ fg: theme.textMuted }}>create</span>
        </text>
      </box>
    </box>
  )
}
