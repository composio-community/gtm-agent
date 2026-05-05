import "server-only"
import { getServerSupabase } from "./supabase/server"

export type Agent = {
  id: string
  name: string
  avatar: string
  description?: string | null
  systemPrompt: string
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  name: string
  avatar: string
  description: string | null
  system_prompt: string
  created_at: string
  updated_at: string
}

const TABLE = "agents"
const COLS = "id,name,avatar,description,system_prompt,created_at,updated_at"

function toAgent(row: Row): Agent {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    description: row.description,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAgents(): Promise<Agent[]> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data as Row[]).map(toAgent)
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? toAgent(data as Row) : undefined
}

export async function createAgent(input: {
  name: string
  avatar?: string
  description?: string
  systemPrompt: string
}): Promise<Agent> {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("unauthorized")

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      name: input.name,
      avatar: input.avatar?.trim() ?? "",
      description: input.description ?? null,
      system_prompt: input.systemPrompt,
    })
    .select(COLS)
    .single()
  if (error) throw error
  return toAgent(data as Row)
}

export async function updateAgent(
  id: string,
  patch: Partial<Pick<Agent, "name" | "avatar" | "description" | "systemPrompt">>,
): Promise<Agent | undefined> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ("name" in patch) dbPatch.name = patch.name
  if ("avatar" in patch) dbPatch.avatar = patch.avatar?.trim() ?? ""
  if ("description" in patch) dbPatch.description = patch.description ?? null
  if ("systemPrompt" in patch) dbPatch.system_prompt = patch.systemPrompt

  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .update(dbPatch)
    .eq("id", id)
    .select(COLS)
    .maybeSingle()
  if (error) throw error
  return data ? toAgent(data as Row) : undefined
}

export async function deleteAgent(id: string): Promise<boolean> {
  const supabase = await getServerSupabase()
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: "exact" })
    .eq("id", id)
  if (error) throw error
  return (count ?? 0) > 0
}
