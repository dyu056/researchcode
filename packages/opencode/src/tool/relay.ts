import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import type { SessionID } from "../session/schema"

export const RelayTool = Tool.define("relay", async () => {
  return {
    description:
      "Send a message to another session. Use this to communicate with other sessions or delegate tasks. The message will appear as a user message in the target session.",
    parameters: z.object({
      targetSessionID: z.string().describe("The session ID to send the message to"),
      content: z.string().describe("The message content to send"),
    }),
    async execute(params, ctx) {
      const targetSessionID = params.targetSessionID as SessionID
      const currentSessionID = ctx.sessionID as SessionID

      // Verify target session exists
      const targetSession = await Session.get(targetSessionID)

      // Get current session info
      const currentSession = await Session.get(currentSessionID)

      // Send the relayed message to target session
      await SessionPrompt.prompt({
        sessionID: targetSessionID,
        parts: [
          {
            type: "text" as const,
            text: `[Relay from "${currentSession.title}"]:\n${params.content}`,
          },
        ],
        noReply: true,
      })

      return {
        title: `Relayed to ${targetSession.title}`,
        metadata: {},
        output: `Successfully sent message to session "${targetSession.title}" (${params.targetSessionID})`,
      }
    },
  }
})
