import Link from "next/link"
import { listNotifications } from "@/lib/notifications"
import { markAllReadAction, markReadAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const items = await listNotifications()
  const hasUnread = items.some((n) => !n.readAt)

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ flex: 1 }}>Inbox</h1>
        {hasUnread && (
          <form action={markAllReadAction}>
            <button type="submit">Mark all read</button>
          </form>
        )}
      </div>

      {items.length === 0 && (
        <p style={{ color: "var(--muted)", marginTop: 20 }}>No notifications yet.</p>
      )}

      <div className="inbox-list">
        {items.map((n) => (
          <div
            key={n.id}
            className="card"
            style={{
              opacity: n.readAt ? 0.65 : 1,
              borderLeft: n.readAt ? undefined : "3px solid var(--text)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h4 style={{ flex: 1 }}>{n.title}</h4>
              <span className="tool">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            {n.body && <p>{n.body}</p>}
            <div className="row">
              {n.taskId && (
                <Link href={`/kanban/${n.taskId}`}>
                  <button>Open task</button>
                </Link>
              )}
              {!n.readAt && (
                <form action={markReadAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit">Mark read</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
