import "server-only"
import { cache } from "react"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// React.cache dedupes these per-request: layout, page, and any server helpers
// all share one client + one auth.getUser() round-trip.
export const getServerSupabase = cache(async () => {
  const url = process.env.SUPABASE_URL
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishable) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set")
  }
  const cookieStore = await cookies()
  return createServerClient(url, publishable, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // called from a Server Component — middleware will refresh cookies
        }
      },
    },
  })
})

export const getSessionUser = cache(async () => {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
