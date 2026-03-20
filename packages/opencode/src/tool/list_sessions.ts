import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"

export const ListSessionsTool = Tool.define("list_sessions", async () => {
  return {
    description:
      "List all available sessions. Use this to discover sessions you can communicate with via the relay tool. Each session has an ID and title.",
    parameters: z.object({
      search: z
        .string()
        .describe("Filter sessions by title (case-insensitive search)")
        .optional(),
      limit: z
        .number()
        .describe("Maximum number of sessions to return")
        .optional()
        .default(20),
    }),
    async execute(params, ctx) {
      const sessions: Session.Info[] = []
      for await (const session of Session.list({
        search: params.search,
        limit: params.limit,
      })) {
        sessions.push(session)
      }

      // Filter out the current session from the list
      const otherSessions = sessions.filter((s) => s.id !== ctx.sessionID)

      if (otherSessions.length === 0) {
        return {
          title: "No other sessions found",
          metadata: {},
          output: "There are no other sessions available to relay messages to.",
        }
      }

      const sessionList = otherSessions
        .map((s) => `- ${s.id}: "${s.title}"`)
        .join("\n")

      return {
        title: `Listed ${otherSessions.length} sessions`,
        metadata: {},
        output: `Available sessions:\n${sessionList}`,
      }
    },
  }
})
