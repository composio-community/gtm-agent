import { NextResponse, after } from "next/server"
import { getAdmin } from "@/lib/supabase/admin"
import { runAgentConversation } from "@/lib/agent/harness"
import { nextRunTime, type Recurrence } from "@/lib/schedule"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type DueRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  scheduled_for: string
  recurrence: Recurrence | null
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

async function dispatch() {
  const admin = getAdmin()
  const { data, error } = await admin
    .from("tasks")
    .select("id, user_id, title, description, scheduled_for, recurrence")
    .eq("status", "todo")
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", new Date().toISOString())
    .limit(50)

  if (error) throw error
  const due = (data ?? []) as DueRow[]
  if (due.length === 0) return { dispatched: 0 }

  let dispatched = 0

  for (const t of due) {
    if (t.recurrence) {
      // Recurring template: clone into a child task, run it, advance template.
      const seedText = t.description ? `${t.title}\n\n${t.description}` : t.title
      const { data: childRow, error: cloneErr } = await admin
        .from("tasks")
        .insert({
          user_id: t.user_id,
          title: t.title,
          description: t.description,
          status: "todo",
          messages: [{ role: "user", content: seedText }],
          parent_id: t.id,
        })
        .select("id, user_id")
        .single()

      if (cloneErr || !childRow) continue

      after(() =>
        runAgentConversation({ taskId: childRow.id, userId: childRow.user_id }),
      )

      const next = nextRunTime(new Date(t.scheduled_for), t.recurrence)
      await admin
        .from("tasks")
        .update({ scheduled_for: next.toISOString() })
        .eq("id", t.id)

      dispatched++
    } else {
      // One-off: clear schedule, run the task itself.
      await admin
        .from("tasks")
        .update({ scheduled_for: null })
        .eq("id", t.id)

      after(() => runAgentConversation({ taskId: t.id, userId: t.user_id }))
      dispatched++
    }
  }

  return { dispatched }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const result = await dispatch()
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const result = await dispatch()
  return NextResponse.json(result)
}
