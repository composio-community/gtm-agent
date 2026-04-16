"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOutAction } from "./login/actions"

export function Nav({ email, unread = 0 }: { email?: string; unread?: number }) {
  const pathname = usePathname()
  const is = (p: string) => pathname === p || pathname.startsWith(p + "/")
  return (
    <nav className="nav">
      <Link href="/kanban" className="brand">GTM Agent</Link>
      <div className="links">
        <Link href="/kanban" className={is("/kanban") ? "active" : ""}>Kanban</Link>
        <Link href="/inbox" className={is("/inbox") ? "active" : ""}>
          Inbox
          {unread > 0 && <span className="badge">{unread}</span>}
        </Link>
        <Link href="/settings" className={is("/settings") ? "active" : ""}>Settings</Link>
        {email && <span className="user-chip">{email}</span>}
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </nav>
  )
}
