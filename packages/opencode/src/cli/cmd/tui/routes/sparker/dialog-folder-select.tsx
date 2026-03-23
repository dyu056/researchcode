import { createMemo, Show, createSignal } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useDialog } from "@tui/ui/dialog"
import { useTheme } from "@tui/context/theme"
import { TextAttributes } from "@opentui/core"
import { Spinner } from "@tui/component/spinner"
import fs from "fs/promises"
import { join } from "path"

export function SparkerFolderSelect() {
  const route = useRoute()
  const dialog = useDialog()
  const { theme } = useTheme()
  const [loading, setLoading] = createSignal(true)
  const [folderOptions, setFolderOptions] = createSignal<DialogSelectOption<string>[]>([])
  const currentPath = "."

  // Load folders on mount
  createMemo(async () => {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })
      const dirs = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => ({
          title: entry.name,
          value: join(currentPath, entry.name),
        }))
        .sort((a, b) => a.title.localeCompare(b.title))

      // Add parent directory option if not at root
      const options: DialogSelectOption<string>[] = []
      if (currentPath !== "/" && currentPath !== "") {
        options.push({ title: ".. (parent)", value: join(currentPath, "..") })
      }
      options.push(...dirs)

      setFolderOptions(options)
    } catch (error) {
      console.error("Failed to load folders:", error)
      setFolderOptions([])
    } finally {
      setLoading(false)
    }
  })

  function navigateToTopicStep(folderPath: string) {
    route.navigate({
      type: "sparker",
      step: "topic",
      rootFolder: folderPath,
    })
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Select Root Folder
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <Show when={loading()}>
        <box paddingTop={1}>
          <Spinner />
        </box>
      </Show>
      <Show when={!loading()}>
        <DialogSelect
          title=""
          placeholder="Search folders..."
          options={folderOptions()}
          onSelect={(option) => navigateToTopicStep(option.value)}
        />
      </Show>
    </box>
  )
}
