import { NextResponse, after } from "next/server"
import { listTasks, createTask } from "@/lib/tasks"
import { getSessionUser } from "@/lib/supabase/server"
import { runAgentConversation } from "@/lib/agent/harness"
import { isRecurrence } from "@/lib/schedule"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET() {
  const tasks = await listTasks()
  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 })
  }

  let scheduledFor: string | null = null
  if (body.scheduledFor && typeof body.scheduledFor === "string") {
    const d = new Date(body.scheduledFor)
    if (!Number.isNaN(d.getTime())) scheduledFor = d.toISOString()
  }
  const recurrence = isRecurrence(body.recurrence) ? body.recurrence : null

  // Templates (recurring) require a scheduled_for to know when to first fire.
  // One-off runs immediately if scheduled_for is empty or in the past.
  const now = Date.now()
  const hasFutureTime =
    scheduledFor !== null && new Date(scheduledFor).getTime() > now

  let runImmediately = false
  if (recurrence) {
    // Recurring: must have a scheduled_for in the future (when first run fires).
    if (!hasFutureTime) {
      return NextResponse.json(
        { error: "recurring tasks require a future scheduled_for" },
        { status: 400 },
      )
    }
  } else {
    // One-off: run now unless a future time was given.
    runImmediately = !hasFutureTime
  }

  const task = await createTask({
    userId: user.id,
    title: body.title,
    description: body.description,
    scheduledFor: recurrence || hasFutureTime ? scheduledFor : null,
    recurrence,
  })

  if (runImmediately) {
    after(async () => {
      await runAgentConversation({ taskId: task.id, userId: user.id }).catch((err) => {
        console.error("[POST /api/tasks] background run failed", {
          taskId: task.id,
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        })
      })
    })
  }

  return NextResponse.json(task, { status: 201 })
}
