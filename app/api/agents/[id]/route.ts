import { NextResponse } from "next/server"
import { getAgent, updateAgent, deleteAgent } from "@/lib/agents"
import { getSessionUser } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const agent = await getAgent(id)
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(agent)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const patch = await req.json()
  const agent = await updateAgent(id, patch)
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(agent)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const ok = await deleteAgent(id)
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
