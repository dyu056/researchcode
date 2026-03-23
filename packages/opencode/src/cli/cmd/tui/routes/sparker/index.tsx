import { Show, Switch, Match } from "solid-js"
import { useRoute, useRouteData } from "@tui/context/route"
import { useTheme } from "@tui/context/theme"
import { TextAttributes } from "@opentui/core"
import { SparkerFolderSelect } from "./dialog-folder-select"
import { SparkerTopicName } from "./dialog-topic-name"
import { SparkerPanel } from "./panel-surveyor"
import { useDirectory } from "@tui/context/directory"

export function Sparker() {
  const route = useRoute()
  const { theme } = useTheme()
  const directory = useDirectory()

  const data = useRouteData("sparker")

  function goBack() {
    if (data.step === "folder") {
      route.navigate({ type: "home" })
    } else if (data.step === "topic") {
      route.navigate({ type: "sparker", step: "folder", rootFolder: data.rootFolder })
    } else if (data.step === "session") {
      // Confirm before going back
      route.navigate({ type: "sparker", step: "topic", rootFolder: data.rootFolder, topic: data.topic })
    }
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
        <Show when={data.step !== "folder"}>
          <text fg={theme.textMuted} onMouseUp={() => goBack()}>
            ← back
          </text>
          <text fg={theme.textMuted}> | </text>
        </Show>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          New Research Session
        </text>
        <Show when={data.step === "session" && data.topic}>
          <text fg={theme.textMuted}> · </text>
          <text fg={theme.text}>{data.topic}</text>
        </Show>
        <box flexGrow={1} />
        <text fg={theme.textMuted}>{directory()}</text>
      </box>

      {/* Content */}
      <box flexGrow={1} minHeight={0}>
        <Switch>
          <Match when={data.step === "folder"}>
            <SparkerFolderSelect />
          </Match>
          <Match when={data.step === "topic"}>
            <SparkerTopicName />
          </Match>
          <Match when={data.step === "session"}>
            <SparkerSessionView
              sessionID={data.sessionID!}
              surveyorSessionID={data.surveyorSessionID!}
              rootFolder={data.rootFolder ?? "."}
              topic={data.topic ?? ""}
            />
          </Match>
        </Switch>
      </box>
    </box>
  )
}

function SparkerSessionView(props: {
  sessionID: string
  surveyorSessionID: string
  rootFolder: string
  topic: string
}) {
  const dimensions = useTerminalDimensions()

  // Calculate panel widths: 40% surveyor, 60% chat
  const leftWidth = () => Math.floor(dimensions().width * 0.4)

  return (
    <box flexGrow={1} minHeight={0} flexDirection="row">
      {/* Left Panel - Surveyor (40%) */}
      <box width={leftWidth()} flexShrink={0} flexDirection="column">
        <SparkerPanel
          sessionId={props.surveyorSessionID}
          title="Surveyor"
          placeholder="Surveyor is doing web research..."
        />
      </box>

      {/* Right Panel - Main Chat (60%) */}
      <box flexGrow={1} minWidth={0} flexDirection="column">
        <SparkerPanel
          sessionId={props.sessionID}
          title="Research Chat"
          placeholder="Ask questions about your research topic..."
        />
      </box>
    </box>
  )
}
