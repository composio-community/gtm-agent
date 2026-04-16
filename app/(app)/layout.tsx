import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/supabase/server"
import { unreadCount } from "@/lib/notifications"
import { Nav } from "../nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const unread = await unreadCount().catch(() => 0)
  return (
    <>
      <Nav email={user.email ?? undefined} unread={unread} />
      {children}
    </>
  )
}
