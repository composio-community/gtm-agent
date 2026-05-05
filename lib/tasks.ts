import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServerSupabase } from "./supabase/server"
import type { ModelMessage } from "ai"
import type { Recurrence } from "./schedule"

/** Ensures `tasks.agent_id` only references an existing row (avoids FK 23503 if UI is stale or agent was deleted). */
export async function resolveAgentIdForTask(
  supabase: SupabaseClient,
  agentId: string | null | undefined,
): Promise<string | null> {
  if (!agentId || !String(agentId).trim()) return null
  const id = String(agentId).trim()
  const { data, error } = await supabase.from("agents").select("id").eq("id", id).maybeSingle()
  if (error) throw error
  return data ? id : null
}

export type TaskStatus = "todo" | "in_progress" | "done" | "error"

export type TaskAgent = {
  id: string
  name: string
  avatar: string
}

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
  agentId?: string | null
  agent?: TaskAgent | null
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
  agent_id: string | null
  /** Filled by hydrateAgentsForRows — avoids brittle PostgREST embeds on tasks→agents. */
  _agent?: { id: string; name: string; avatar: string } | null
  created_at: string
  updated_at: string
}

const TABLE = "tasks"
const COLS =
  "id,title,description,status,output,messages,scheduled_for,recurrence,parent_id,agent_id,created_at,updated_at"

async function hydrateAgentsForRows(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  rows: Row[],
): Promise<void> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.agent_id) ids.add(row.agent_id)
  }
  if (ids.size === 0) return
  const idList = [...ids]
  const { data, error } = await supabase.from("agents").select("id,name,avatar").in("id", idList)
  if (error) throw error
  const byId = new Map((data ?? []).map((a) => [a.id as string, a as { id: string; name: string; avatar: string }]))
  for (const row of rows) {
    if (!row.agent_id) {
      row._agent = null
      continue
    }
    row._agent = byId.get(row.agent_id) ?? null
  }
}

function toTask(row: Row): Task {
  const agent = row._agent ?? null
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
    agentId: row.agent_id,
    agent: agent ?? null,
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
  const rows = (data ?? []) as Row[]
  await hydrateAgentsForRows(supabase, rows)
  return rows.map(toTask)
}

export async function getTask(id: string): Promise<Task | undefined> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return undefined
  const row = data as Row
  await hydrateAgentsForRows(supabase, [row])
  return toTask(row)
}

export async function createTask(input: {
  title: string
  description?: string
  scheduledFor?: string | null
  recurrence?: Recurrence | null
  agentId?: string | null
}): Promise<Task> {
  const supabase = await getServerSupabase()
  const agentId = await resolveAgentIdForTask(supabase, input.agentId)
  const isTemplate = !!input.recurrence
  const seedText = input.description ? `${input.title}\n\n${input.description}` : input.title
  // Templates never run themselves, so don't pre-seed a user message.
  const seedMessages = isTemplate ? [] : [{ role: "user", content: seedText }]
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title: input.title,
      description: input.description ?? null,
      status: "todo",
      messages: seedMessages,
      scheduled_for: input.scheduledFor ?? null,
      recurrence: input.recurrence ?? null,
      agent_id: agentId,
    })
    .select(COLS)
    .single()
  if (error) throw error
  const row = data as Row
  await hydrateAgentsForRows(supabase, [row])
  return toTask(row)
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
  if (!data) return undefined
  const row = data as Row
  await hydrateAgentsForRows(supabase, [row])
  return toTask(row)
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
