import { listAgents } from "@/lib/agents"
import { AgentsClient } from "./agents-client"

export const dynamic = "force-dynamic"

export default async function AgentsPage() {
  const agents = await listAgents()
  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <h1>Agents</h1>
      <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
        Reusable personas with their own system prompt. Pick one when creating a task.
      </p>
      <div className="agents-scroll">
        <AgentsClient initialAgents={agents} />
      </div>
    </div>
  )
}
