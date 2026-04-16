import { getServerSupabase } from "@/lib/supabase/server"
import { disconnectAction } from "./actions"

export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ connected?: string; error?: string }> }

export default async function SettingsPage({ searchParams }: Props) {
  const { connected, error } = await searchParams
  const supabase = await getServerSupabase()
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, provider, created_at")
    .eq("provider", "composio_mcp")
    .maybeSingle()

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>Settings</h1>

      {connected && <div className="alert info" style={{ marginTop: 14 }}>Connected to {connected}.</div>}
      {error && <div className="alert error" style={{ marginTop: 14 }}>{error}</div>}

      <div className="card" style={{ marginTop: 24 }}>
        <h4>Composio MCP</h4>
        <p style={{ marginTop: 4 }}>
          Connect your Composio account for personalized tool access via MCP.
        </p>

        {integration ? (
          <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
            <span className="scheduled-chip recurring" style={{ margin: 0 }}>Connected</span>
            <form action={disconnectAction}>
              <input type="hidden" name="provider" value="composio_mcp" />
              <button type="submit">Disconnect</button>
            </form>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <a href="/api/oauth/composio/start" target="_blank" rel="noopener noreferrer">
              <button className="primary">Connect Composio</button>
            </a>
          </div>
        )}
      </div>

    </div>
  )
}
