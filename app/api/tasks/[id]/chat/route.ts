import { NextResponse, after } from "next/server"
import { getSessionUser } from "@/lib/supabase/server"
import { getTask } from "@/lib/tasks"
import { appendUserMessageAndRun } from "@/lib/agent/harness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const task = await getTask(id)
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 })

  const { text } = await req.json()
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 })
  }

  after(async () => {
    await appendUserMessageAndRun({ taskId: id, userId: user.id, text }).catch((err) => {
      console.error("[POST /api/tasks/:id/chat] background run failed", {
        taskId: id,
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    })
  })

  return NextResponse.json({ ok: true }, { status: 202 })
}
