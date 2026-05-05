import { NextResponse } from "next/server"
import { listAgents, createAgent } from "@/lib/agents"
import { getSessionUser } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const agents = await listAgents()
  return NextResponse.json(agents)
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }
  if (!body.systemPrompt || typeof body.systemPrompt !== "string") {
    return NextResponse.json({ error: "systemPrompt required" }, { status: 400 })
  }

  const agent = await createAgent({
    name: body.name,
    avatar: typeof body.avatar === "string" ? body.avatar : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    systemPrompt: body.systemPrompt,
  })
  return NextResponse.json(agent, { status: 201 })
}
