import { Session } from "@/session"
import { z } from "zod"

const createSessionSchema = z.object({
  title: z.string().optional().describe("Title for the new session"),
  api_endpoint: z.string().optional().describe("API endpoint URL for the model provider"),
  api_key: z.string().optional().describe("API key for the model provider"),
  model: z.string().optional().describe("Model name to use"),
  instruction_prompt: z.string().optional().describe("Instructions for the agent (like agent.md content)"),
})

interface MCPRequest {
  jsonrpc: "2.0"
  id: number | string
  method: string
  params?: Record<string, unknown>
}

interface MCPResponse {
  jsonrpc: "2.0"
  id: number | string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// MCP Protocol handler
export async function handleMcpSessionCreator(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id",
        "Access-Control-Max-Age": "86400",
      },
    })
  }

  try {
    const body = await request.json() as MCPRequest

    // Initialize request handler
    if (body.method === "initialize") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: { name: "session-creator", version: "1.0.0" },
        },
      } as MCPResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Tools list handler
    if (body.method === "tools/list") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "create_session",
              description: "Create a new OpenCode session with optional model configuration and agent instructions",
              inputSchema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Title for the new session" },
                  api_endpoint: { type: "string", description: "API endpoint URL for the model provider" },
                  api_key: { type: "string", description: "API key for the model provider" },
                  model: { type: "string", description: "Model name to use" },
                  instruction_prompt: { type: "string", description: "Instructions for the agent (like agent.md content)" },
                },
                required: [],
              },
            },
          ],
        },
      } as MCPResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Tool call handler
    if (body.method === "tools/call") {
      const params = body.params as { name: string; arguments?: Record<string, unknown> } | undefined

      if (params?.name === "create_session") {
        const args = params.arguments ?? {}
        const parsed = createSessionSchema.parse(args)

        const session = await Session.createNext({
          title: parsed.title,
          directory: process.cwd(),
          model:
            parsed.api_key || parsed.api_endpoint || parsed.model
              ? {
                  apiKey: parsed.api_key,
                  apiEndpoint: parsed.api_endpoint,
                  modelName: parsed.model,
                }
              : undefined,
          instructionPrompt: parsed.instruction_prompt,
        })

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ session_id: session.id }),
              },
            ],
          },
        } as MCPResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: `Unknown tool: ${params?.name}` },
      } as MCPResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Unknown method
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    } as MCPResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}