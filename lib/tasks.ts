import "server-only"
import { getServerSupabase } from "./supabase/server"
import type { ModelMessage } from "ai"
import type { Recurrence } from "./schedule"

export type TaskStatus = "todo" | "in_progress" | "done" | "error"

export type Task = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  output?: string | null
  messages: ModelMessage[]
  scheduledFor?: string | null
  recurrence?: Recurrence | null
  parentId?: string | null
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  output: string | null
  messages: ModelMessage[] | null
  scheduled_for: string | null
  recurrence: Recurrence | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

const TABLE = "tasks"
const COLS =
  "id,title,description,status,output,messages,scheduled_for,recurrence,parent_id,created_at,updated_at"

function toTask(row: Row): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    output: row.output,
    messages: row.messages ?? [],
    scheduledFor: row.scheduled_for,
    recurrence: row.recurrence,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listTasks(): Promise<Task[]> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data as Row[]).map(toTask)
}

export async function getTask(id: string): Promise<Task | undefined> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? toTask(data as Row) : undefined
}

export async function createTask(input: {
  userId: string
  title: string
  description?: string
  scheduledFor?: string | null
  recurrence?: Recurrence | null
}): Promise<Task> {
  const supabase = await getServerSupabase()
  const isTemplate = !!input.recurrence
  const seedText = input.description ? `${input.title}\n\n${input.description}` : input.title
  // Templates never run themselves, so don't pre-seed a user message.
  const seedMessages = isTemplate ? [] : [{ role: "user", content: seedText }]
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: input.userId,
      title: input.title,
      description: input.description ?? null,
      status: "todo",
      messages: seedMessages,
      scheduled_for: input.scheduledFor ?? null,
      recurrence: input.recurrence ?? null,
    })
    .select(COLS)
    .single()
  if (error) throw error
  return toTask(data as Row)
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "description" | "status" | "output">>,
): Promise<Task | undefined> {
  const dbPatch: Record<string, unknown> = {}
  if ("title" in patch) dbPatch.title = patch.title
  if ("description" in patch) dbPatch.description = patch.description ?? null
  if ("status" in patch) dbPatch.status = patch.status
  if ("output" in patch) dbPatch.output = patch.output ?? null

  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .update(dbPatch)
    .eq("id", id)
    .select(COLS)
    .maybeSingle()
  if (error) throw error
  return data ? toTask(data as Row) : undefined
}

export async function deleteTask(id: string): Promise<boolean> {
  const supabase = await getServerSupabase()
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: "exact" })
    .eq("id", id)
  if (error) throw error
  return (count ?? 0) > 0
}
