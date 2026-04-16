import "server-only"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

export function getAdmin(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set")
  }
  client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
