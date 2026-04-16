"use client"

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import type { ModelMessage } from "ai"
import type { Task, TaskStatus } from "@/lib/tasks"
import { Markdown } from "@/components/ui/markdown"

type Props = {
  initialTask: Task
  supabaseUrl: string
  supabaseKey: string
}

type Snapshot = {
  messages: ModelMessage[]
  status: TaskStatus
}

type Store = {
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => Snapshot
  initial: Snapshot
  pushLocalUser: (text: string) => void
}

function makeStore(initial: Task, client: SupabaseClient): Store {
  let snapshot: Snapshot = { messages: initial.messages, status: initial.status }
  const listeners = new Set<() => void>()
  let channel: RealtimeChannel | null = null

  const channelName = `task-${initial.id}-${Math.random().toString(36).slice(2, 10)}`

  function emit() {
    for (const l of listeners) l()
  }

  function start() {
    if (channel) return
    channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${initial.id}` },
        (payload) => {
          const row = payload.new as Partial<{
            messages: ModelMessage[] | null
            status: TaskStatus
          }>
          const next: Snapshot = { ...snapshot }
          // Defensive merge: only overwrite fields actually present in the payload.
          // Protects against TOASTed columns being absent from Realtime events.
          if (row && "messages" in row && Array.isArray(row.messages)) {
            next.messages = row.messages
          }
          if (row && "status" in row && row.status) {
            next.status = row.status
          }
          snapshot = next
          emit()
        },
      )
      .subscribe()
  }

  function stop() {
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }

  return {
    subscribe(cb: () => void) {
      listeners.add(cb)
      start()
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0) stop()
      }
    },
    getSnapshot() {
      return snapshot
    },
    get initial() {
      return snapshot
    },
    pushLocalUser(text: string) {
      snapshot = {
        messages: [...snapshot.messages, { role: "user", content: text }],
        status: "in_progress",
      }
      emit()
    },
  }
}

type ToolCall = { id: string; name: string }

function extractParts(content: ModelMessage["content"]): {
  text: string
  tools: ToolCall[]
} {
  if (typeof content === "string") return { text: content, tools: [] }
  let text = ""
  const tools: ToolCall[] = []
  for (const part of content) {
    if (part.type === "text") text += part.text
    else if (part.type === "tool-call") tools.push({ id: part.toolCallId, name: part.toolName })
  }
  return { text, tools }
}

function collectCompletedToolIds(messages: ModelMessage[]): Set<string> {
  const done = new Set<string>()
  for (const m of messages) {
    if (m.role !== "tool" || typeof m.content === "string") continue
    for (const part of m.content) {
      if (part.type === "tool-result") done.add(part.toolCallId)
    }
  }
  return done
}

function statusLabel(s: TaskStatus) {
  switch (s) {
    case "todo":
      return "queued"
    case "in_progress":
      return "working…"
    case "done":
      return "done"
    case "error":
      return "error"
  }
}

export function TaskChat({ initialTask, supabaseUrl, supabaseKey }: Props) {
  const client = useMemo(
    () => createBrowserClient(supabaseUrl, supabaseKey),
    [supabaseUrl, supabaseKey],
  )

  const storeRef = useRef<Store | null>(null)
  if (!storeRef.current || typeof storeRef.current.pushLocalUser !== "function") {
    storeRef.current = makeStore(initialTask, client)
  }
  const store = storeRef.current

  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, () => store.initial)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  const send = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || sending) return
      setSending(true)
      // Optimistic: render the user message immediately and flip to "working".
      store.pushLocalUser(text)
      setInput("")
      try {
        await fetch(`/api/tasks/${initialTask.id}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        })
      } finally {
        setSending(false)
      }
    },
    [initialTask.id, input, sending, store],
  )

  const visible = snap.messages.filter((m) => m.role !== "system" && m.role !== "tool")
  const completedToolIds = collectCompletedToolIds(snap.messages)


  const lastVisible = visible.length > 0 ? visible[visible.length - 1] : null
  const agentTyping =
    snap.status === "in_progress" && (!lastVisible || lastVisible.role === "user")

  return (
    <div className="chat">
      <div className="chat-status">
        <span className={`dot status-${snap.status}`} />
        {statusLabel(snap.status)}
      </div>
      <div className="messages">
        {/* column-reverse + reversed array keeps the view pinned to the latest message */}
        {agentTyping && (
          <div className="msg assistant typing">
            <span className="dots"><i /><i /><i /></span>
          </div>
        )}
        {[...visible].reverse().map((m, i) => {
          const { text, tools } = extractParts(m.content)
          const role = m.role === "user" ? "user" : "assistant"
          if (!text && tools.length === 0) return null
          return (
            <div key={visible.length - 1 - i} className={`msg ${role}`}>
              {text && (role === "assistant" ? <Markdown>{text}</Markdown> : <div>{text}</div>)}
              {tools.map((t) => {
                const done = completedToolIds.has(t.id)
                return (
                  <div
                    key={t.id}
                    className={`tool-chip ${done ? "done" : "pending"}`}
                  >
                    <span className="tool-dot" />
                    {t.name}
                  </div>
                )
              })}
            </div>
          )
        })}
        {visible.length === 0 && snap.status !== "in_progress" && (
          <div className="tool">Waiting for agent to start…</div>
        )}
      </div>
      <form className="composer" onSubmit={send}>
        <input
          placeholder={snap.status === "done" ? "Task done — send to reopen…" : "Reply to the agent…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="primary" disabled={sending || !input.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  )
}
