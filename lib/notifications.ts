import "server-only"
import { getServerSupabase } from "./supabase/server"

export type Notification = {
  id: string
  taskId: string | null
  type: string
  title: string
  body: string | null
  readAt: string | null
  createdAt: string
}

type Row = {
  id: string
  task_id: string | null
  type: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}

const COLS = "id,task_id,type,title,body,read_at,created_at"

function toNotif(row: Row): Notification {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function listNotifications(): Promise<Notification[]> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("notifications")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return (data as Row[]).map(toNotif)
}

export async function unreadCount(): Promise<number> {
  const supabase = await getServerSupabase()
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
  if (error) throw error
  return count ?? 0
}

export async function markRead(id: string): Promise<void> {
  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function markAllRead(): Promise<void> {
  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
  if (error) throw error
}
