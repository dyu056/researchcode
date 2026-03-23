import { Hono } from "hono"
import { handleMcpSessionCreator } from "../../mcp/session-creator"
import { lazy } from "../../util/lazy"

export const SessionCreatorMcpRoutes = lazy(() =>
  new Hono().all("/", (c) => handleMcpSessionCreator(c.req.raw)),
)
