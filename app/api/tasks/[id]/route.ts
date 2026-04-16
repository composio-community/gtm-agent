import { NextResponse } from "next/server"
import { getTask, updateTask, deleteTask } from "@/lib/tasks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const task = await getTask(id)
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const patch = await req.json()
  const task = await updateTask(id, patch)
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(task)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await deleteTask(id)
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
