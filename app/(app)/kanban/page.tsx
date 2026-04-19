"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition, useSyncExternalStore } from "react"
import type { Task, TaskStatus } from "@/lib/tasks"
import type { Recurrence } from "@/lib/schedule"
import { humanize } from "@/lib/schedule"

type Store = {
  tasks: Task[]
  listeners: Set<() => void>
  loaded: boolean
  pollTimer: ReturnType<typeof setInterval> | null
}

const store: Store = { tasks: [], listeners: new Set(), loaded: false, pollTimer: null }

function notify() {
  for (const l of store.listeners) l()
}

async function refresh() {
  const res = await fetch("/api/tasks", { cache: "no-store" })
  store.tasks = await res.json()
  store.loaded = true
  notify()
  ensurePolling()
}

function ensurePolling() {
  const hasRunning = store.tasks.some(
    (t) => t.status === "todo" || t.status === "in_progress",
  )
  if (hasRunning && !store.pollTimer) {
    store.pollTimer = setInterval(() => void refresh(), 3000)
  } else if (!hasRunning && store.pollTimer) {
    clearInterval(store.pollTimer)
    store.pollTimer = null
  }
}

function subscribe(cb: () => void) {
  store.listeners.add(cb)
  void refresh()
  return () => {
    store.listeners.delete(cb)
    if (store.listeners.size === 0 && store.pollTimer) {
      clearInterval(store.pollTimer)
      store.pollTimer = null
    }
  }
}

function getSnapshot() {
  return store.tasks
}

const EMPTY: Task[] = []
function getServerSnapshot(): Task[] {
  return EMPTY
}

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
  { key: "error", label: "Error" },
]

export default function KanbanPage() {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [scheduleMode, setScheduleMode] = useState<"now" | "once" | Recurrence>("now")
  const [onceAt, setOnceAt] = useState("")
  const [timeOfDay, setTimeOfDay] = useState("09:00")
  const [weeklyDow, setWeeklyDow] = useState(1) // Monday
  const [hourlyMinute, setHourlyMinute] = useState(0)
  const [creating, startCreate] = useTransition()
  const [errorToast, setErrorToast] = useState<{ id: string; title: string; message: string } | null>(null)
  const [seenErrors, setSeenErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    const nextError = tasks.find((t) => t.status === "error" && !seenErrors.has(t.id))
    if (!nextError) return

    const firstAssistant = nextError.messages.find(
      (m) => m.role === "assistant" && typeof m.content === "string" && m.content.includes("**Error:**"),
    )
    const message =
      typeof firstAssistant?.content === "string"
        ? firstAssistant.content.replace("**Error:**", "").trim()
        : "Task failed. Open the task to inspect details."

    setErrorToast({ id: nextError.id, title: nextError.title, message })
    setSeenErrors((prev) => new Set(prev).add(nextError.id))
  }, [tasks, seenErrors])

  const create = useCallback(() => {
    if (!title.trim()) return
    let scheduledFor: string | null = null
    let recurrence: Recurrence | null = null

    if (scheduleMode === "once") {
      if (!onceAt) return
      scheduledFor = new Date(onceAt).toISOString()
    } else if (scheduleMode === "daily") {
      recurrence = "daily"
      const [h, m] = timeOfDay.split(":").map(Number)
      const d = new Date()
      d.setSeconds(0, 0)
      d.setHours(h, m, 0, 0)
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
      scheduledFor = d.toISOString()
    } else if (scheduleMode === "weekly") {
      recurrence = "weekly"
      const [h, m] = timeOfDay.split(":").map(Number)
      const d = new Date()
      d.setSeconds(0, 0)
      d.setHours(h, m, 0, 0)
      const daysAhead = (weeklyDow - d.getDay() + 7) % 7
      if (daysAhead === 0 && d.getTime() <= Date.now()) d.setDate(d.getDate() + 7)
      else d.setDate(d.getDate() + daysAhead)
      scheduledFor = d.toISOString()
    } else if (scheduleMode === "hourly") {
      recurrence = "hourly"
      const d = new Date()
      d.setSeconds(0, 0)
      d.setMinutes(hourlyMinute, 0, 0)
      if (d.getTime() <= Date.now()) d.setHours(d.getHours() + 1)
      scheduledFor = d.toISOString()
    }

    startCreate(async () => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, scheduledFor, recurrence }),
      })
      setTitle("")
      setDescription("")
      setScheduleMode("now")
      setOnceAt("")
      await refresh()
    })
  }, [title, description, scheduleMode, onceAt, timeOfDay, weeklyDow, hourlyMinute])

  const remove = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      await fetch(`/api/tasks/${id}`, { method: "DELETE" })
      await refresh()
    },
    [],
  )

  return (
    <div className="container">
      {errorToast && (
        <div
          role="status"
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 2000,
            maxWidth: 420,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ flex: 1 }}>Task failed: {errorToast.title}</strong>
            <button onClick={() => setErrorToast(null)}>Dismiss</button>
          </div>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>{errorToast.message}</p>
          <div style={{ marginTop: 8 }}>
            <Link href={`/kanban/${errorToast.id}`}>
              <button>Open task</button>
            </Link>
          </div>
        </div>
      )}

      <div className="board-header">
        <form
          className="new-task"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <div className="new-task-row">
            <input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              placeholder="Details (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="new-task-row">
            <select
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as typeof scheduleMode)}
            >
              <option value="now">Run now</option>
              <option value="once">Once at…</option>
              <option value="daily">Every day at…</option>
              <option value="weekly">Every week on…</option>
              <option value="hourly">Every hour at :mm</option>
            </select>

            {scheduleMode === "once" && (
              <input
                type="datetime-local"
                value={onceAt}
                onChange={(e) => setOnceAt(e.target.value)}
              />
            )}
            {scheduleMode === "daily" && (
              <input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            )}
            {scheduleMode === "weekly" && (
              <>
                <select
                  value={weeklyDow}
                  onChange={(e) => setWeeklyDow(Number(e.target.value))}
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={0}>Sunday</option>
                </select>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                />
              </>
            )}
            {scheduleMode === "hourly" && (
              <input
                type="number"
                min={0}
                max={59}
                value={hourlyMinute}
                onChange={(e) => setHourlyMinute(Number(e.target.value))}
                placeholder=":mm"
              />
            )}

            <button className="primary" disabled={creating || !title.trim()}>
              {creating ? "Adding…" : scheduleMode === "now" ? "Add task" : "Schedule"}
            </button>
          </div>
        </form>
      </div>

      <div className="kanban">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key)
          return (
            <div className="column" key={col.key}>
              <h3>
                <span>{col.label}</span>
                <span>{items.length}</span>
              </h3>
              <div className="column-scroll">
                {items.map((t) => (
                  <Link href={`/kanban/${t.id}`} key={t.id} className="card-link">
                    <div className="card">
                      <h4>{t.title}</h4>
                      {t.description && <p>{t.description}</p>}
                      {t.scheduledFor && (
                        <div className={`scheduled-chip${t.recurrence ? " recurring" : ""}`}>
                          {t.recurrence ? "🔁" : "🕑"} {humanize(t.scheduledFor, t.recurrence)}
                        </div>
                      )}
                      {t.parentId && !t.recurrence && (
                        <div className="scheduled-chip child">↑ from recurring</div>
                      )}
                      <div className="row">
                        <button onClick={(e) => remove(t.id, e)}>Delete</button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
