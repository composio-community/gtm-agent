import { createMCPClient } from "@ai-sdk/mcp"
import { getAdmin } from "@/lib/supabase/admin"

const MCP_URL = process.env.COMPOSIO_MCP_URL ?? "https://connect.composio.dev/mcp"

async function getUserMCPToken(userId: string): Promise<string | null> {
  const admin = getAdmin()
  const { data } = await admin
    .from("integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", "composio_mcp")
    .maybeSingle()
  return data?.access_token ?? null
}

async function createMCPTools(token: string) {
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: MCP_URL,
      headers: { Authorization: `Bearer ${token}` },
    },
  })
  return await client.tools()
}

function isMCPAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("HTTP 401") || msg.includes("Missing authentication")
}

async function createPlatformTools(userEmail: string) {
  const { Composio } = await import("@composio/core")
  const { VercelProvider } = await import("@composio/vercel")
  const composio = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
    provider: new VercelProvider(),
  })
  const session = await composio.create(userEmail)
  return await session.tools()
}

export async function createTools(userId: string, userEmail: string) {
  // Per-user MCP token (from OAuth flow) takes priority.
  const mcpToken = (await getUserMCPToken(userId).catch(() => null))?.trim() ?? null
  if (mcpToken) {
    try {
      return await createMCPTools(mcpToken)
    } catch (err) {
      // If MCP auth is stale/invalid, gracefully fall back to the shared platform key.
      if (process.env.COMPOSIO_API_KEY && isMCPAuthError(err)) {
        return await createPlatformTools(userEmail)
      }
      throw err
    }
  }

  // Fallback: shared COMPOSIO_API_KEY via the platform SDK, keyed by email.
  if (process.env.COMPOSIO_API_KEY) {
    return await createPlatformTools(userEmail)
  }

  throw new Error(
    "No Composio credentials. Connect via Settings or set COMPOSIO_API_KEY.",
  )
}
